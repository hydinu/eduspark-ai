"""
EduSpark AI — Python Backend
Provides real YouTube transcript extraction and AI-powered study notes.
Runs on http://localhost:8000
"""

import os
import re
import json
import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
from google import genai
from google.genai import types

# ── Config ──────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyD2r5Yte8rMRdA-AwACq6MQ-yntnF3Ww_I")
YOUTUBE_API_KEY = os.getenv("VITE_YOUTUBE_API_KEY", "AIzaSyB1huPRyS6SOq_vDvrgNCSfK6eV4k4x3jE")

client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI(title="EduSpark AI Backend", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ──────────────────────────────────────────────────────────────────

def extract_video_id(url: str) -> str | None:
    """Extract YouTube video ID from any YouTube URL."""
    patterns = [
        r"(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})",
        r"^([a-zA-Z0-9_-]{11})$",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


def get_transcript(video_id: str) -> list[dict]:
    """Fetch real captions/subtitles from YouTube."""
    try:
        # Try English first, then any available language
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US", "en-GB"])
        return transcript
    except NoTranscriptFound:
        try:
            # Fallback: get whatever language is available
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            transcript = transcript_list.find_generated_transcript(["en", "hi", "es", "fr", "de"])
            return transcript.fetch()
        except Exception:
            return []
    except TranscriptsDisabled:
        return []
    except Exception:
        return []


def format_timestamp(seconds: float) -> str:
    """Convert seconds to mm:ss or h:mm:ss."""
    s = int(seconds)
    h = s // 3600
    m = (s % 3600) // 60
    sec = s % 60
    if h > 0:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m}:{sec:02d}"


def transcript_to_text(transcript: list[dict], max_chars: int = 8000) -> str:
    """Convert transcript entries to plain text, truncated."""
    lines = []
    total = 0
    for entry in transcript:
        line = f"[{format_timestamp(entry['start'])}] {entry['text']}"
        total += len(line)
        if total > max_chars:
            lines.append("... (transcript truncated)")
            break
        lines.append(line)
    return "\n".join(lines)


def get_youtube_videos(topic: str, max_results: int = 10) -> list[dict]:
    """Search YouTube videos via Data API v3."""
    search_url = "https://www.googleapis.com/youtube/v3/search"
    search_params = {
        "part": "snippet",
        "q": f"{topic} tutorial explanation educational",
        "type": "video",
        "maxResults": max_results,
        "order": "relevance",
        "videoCategoryId": "27",
        "safeSearch": "strict",
        "key": YOUTUBE_API_KEY,
    }
    r = requests.get(search_url, params=search_params, timeout=10)
    if not r.ok:
        raise HTTPException(status_code=r.status_code, detail=f"YouTube API error: {r.text[:200]}")
    
    search_data = r.json()
    if not search_data.get("items"):
        return []

    video_ids = ",".join(item["id"]["videoId"] for item in search_data["items"])
    details_url = "https://www.googleapis.com/youtube/v3/videos"
    detail_r = requests.get(details_url, params={
        "part": "snippet,contentDetails,statistics",
        "id": video_ids,
        "key": YOUTUBE_API_KEY,
    }, timeout=10)
    
    if not detail_r.ok:
        raise HTTPException(status_code=detail_r.status_code, detail="Failed to fetch video details")
    
    detail_data = detail_r.json()
    videos = []
    for item in detail_data.get("items", []):
        snippet = item["snippet"]
        stats = item.get("statistics", {})
        duration_iso = item.get("contentDetails", {}).get("duration", "")
        
        # Parse ISO 8601 duration
        duration = ""
        dm = re.match(r"PT(\d+H)?(\d+M)?(\d+S)?", duration_iso)
        if dm:
            h = int((dm.group(1) or "0H")[:-1])
            m = int((dm.group(2) or "0M")[:-1])
            s = int((dm.group(3) or "0S")[:-1])
            duration = f"{h}:{m:02d}:{s:02d}" if h > 0 else f"{m}:{s:02d}"

        video_id = item["id"]
        # Check if transcript exists
        has_transcript = len(get_transcript(video_id)) > 0

        videos.append({
            "title": snippet["title"],
            "video_id": video_id,
            "link": f"https://youtube.com/watch?v={video_id}",
            "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
            "channel": snippet.get("channelTitle", ""),
            "published_at": snippet.get("publishedAt", ""),
            "view_count": int(stats.get("viewCount", 0)),
            "duration": duration,
            "description": snippet.get("description", "")[:500],
            "has_transcript": has_transcript,
        })
    return videos


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "EduSpark AI Backend running", "version": "2.0"}


@app.get("/api/search-videos")
def search_videos(
    topic: str = Query(..., min_length=1),
    max_results: int = Query(default=10, le=25),
):
    """Search YouTube videos for a topic and return structured data."""
    videos = get_youtube_videos(topic, max_results)
    return {"topic": topic, "videos": videos, "source": "youtube-api"}


class NotesRequest(BaseModel):
    video_url: str
    video_title: str = ""


@app.post("/api/generate-notes")
def generate_notes(body: NotesRequest):
    """
    Fetch the real YouTube transcript and generate timestamped study notes
    using Gemini AI.
    """
    video_id = extract_video_id(body.video_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    # ── Step 1: Get real transcript ──────────────────────────────────────────
    transcript = get_transcript(video_id)

    if transcript:
        transcript_text = transcript_to_text(transcript, max_chars=8000)
        source = "real_transcript"
    else:
        # No transcript available — tell Gemini to generate from title
        transcript_text = None
        source = "ai_generated"

    # ── Step 2: Build Gemini prompt ──────────────────────────────────────────
    title = body.video_title or f"YouTube video {video_id}"

    if transcript_text:
        prompt = f"""You are an expert study notes generator. Below is the REAL transcript from a YouTube video titled "{title}".

TRANSCRIPT:
{transcript_text}

Based on this real transcript, generate comprehensive timestamped study notes. Use the actual timestamps from the transcript. Create 5-8 logical sections that cover the entire video.

Return ONLY valid JSON with no markdown, no extra text:
{{
  "video_title": "{title}",
  "source": "real_transcript",
  "notes": [
    {{
      "timestamp": "0:00",
      "section_title": "Introduction",
      "content": "• Key point from the actual transcript\\n• Another real point\\n• Quote or concept from the video"
    }}
  ]
}}"""
    else:
        prompt = f"""You are an expert study notes generator. The YouTube video "{title}" does not have subtitles available.

Generate realistic educational timestamped study notes as if you had watched this entire video. Base them on what would typically be covered in a video with this title. Create 5-7 sections.

Return ONLY valid JSON with no markdown, no extra text:
{{
  "video_title": "{title}",
  "source": "ai_generated",
  "notes": [
    {{
      "timestamp": "0:00",
      "section_title": "Introduction",
      "content": "• Key point\\n• Key point\\n• Key point"
    }}
  ]
}}"""

    # ── Step 3: Call Gemini ──────────────────────────────────────────────────
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        raw = response.text.strip()

        # Strip markdown fences if present
        raw = re.sub(r"^```json\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"^```\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"```\s*$", "", raw)

        result = json.loads(raw.strip())
        result["source"] = source
        result["has_real_transcript"] = transcript_text is not None
        return result

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    print("Starting EduSpark AI Backend on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
