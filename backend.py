"""
EduSpark AI — Python Backend v3
- Primary AI: Groq (free, open-source Llama 3, 14,400 req/day)
- Fallback: Direct transcript parsing (NO AI, always works)
- Auto port management: kills old process if port is busy
- Database: Supabase (PostgreSQL)
"""

import os
import re
import json
import socket
import signal
import subprocess
import sys
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
from web_scraper import search_duckduckgo, extract_page_content, generate_web_notes

# Try to import Supabase, but make it optional
try:
    from supabase import create_client
    Client = None
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False
    create_client = None
    Client = None

# Load .env file automatically
load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
GROQ_API_KEY    = os.getenv("GROQ_API_KEY", "")
YOUTUBE_API_KEY = os.getenv("VITE_YOUTUBE_API_KEY", "AIzaSyB1huPRyS6SOq_vDvrgNCSfK6eV4k4x3jE")
PORT            = int(os.getenv("BACKEND_PORT", "8000"))

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://irasryypizosrzepkfrq.supabase.co")
# Try all possible key env var names (server-side has no VITE_ prefix)
SUPABASE_KEY = (
    os.getenv("SUPABASE_PUBLISHABLE_KEY")
    or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or ""
)

_supabase = None

def get_supabase():
    """Lazily initialize and return the Supabase client. Returns None if Supabase is not available."""
    global _supabase
    if not HAS_SUPABASE:
        return None
    if _supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("Warning: SUPABASE_URL and/or SUPABASE_PUBLISHABLE_KEY not set. Supabase features disabled.")
            return None
        try:
            _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            print(f"Warning: Failed to initialize Supabase client: {e}. Supabase features disabled.")
            return None
    return _supabase

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="EduSpark AI Backend", version="3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_video_id(url: str) -> str | None:
    m = re.search(
        r"(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})",
        url
    )
    return m.group(1) if m else None


def fmt_ts(seconds: float) -> str:
    s = int(seconds)
    h, m, sec = s // 3600, (s % 3600) // 60, s % 60
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


def get_transcript(video_id: str) -> list[dict]:
    try:
        return YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US", "en-GB", "hi"])
    except (NoTranscriptFound, TranscriptsDisabled):
        try:
            tl = YouTubeTranscriptApi.list_transcripts(video_id)
            t = next(iter(tl))
            return t.fetch()
        except Exception:
            return []
    except Exception:
        return []


def call_groq(messages: list[dict], model: str = "llama-3.3-70b-versatile") -> str:
    """Call Groq API — free, open-source Llama 3."""
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set")
    resp = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
        json={"model": model, "messages": messages, "temperature": 0.4, "max_tokens": 3000},
        timeout=30,
    )
    if not resp.ok:
        body = resp.text[:300]
        raise RuntimeError(f"Groq error ({resp.status_code}): {body}")
    return resp.json()["choices"][0]["message"]["content"]


def build_notes_from_transcript(transcript: list[dict], title: str, section_duration: int = 120) -> dict:
    """
    Parse transcript into timestamped sections WITHOUT any AI.
    Groups captions into ~2-minute sections, extracts key bullet points.
    Always works — no API key needed.
    """
    if not transcript:
        return None

    sections = []
    current_section = []
    section_start = transcript[0]["start"]
    section_num = 1

    for entry in transcript:
        current_section.append(entry)
        elapsed = entry["start"] - section_start

        if elapsed >= section_duration or entry is transcript[-1]:
            # Build bullet points from current section text
            raw_text = " ".join(e["text"].replace("\n", " ") for e in current_section)

            # Split into sentences / meaningful phrases
            sentences = re.split(r'(?<=[.!?])\s+', raw_text.strip())
            bullets = []
            for s in sentences:
                s = s.strip()
                if len(s) > 20:   # skip very short fragments
                    bullets.append(f"• {s}")
            if not bullets:
                bullets = [f"• {raw_text.strip()[:200]}"]

            content = "\n".join(bullets[:6])  # max 6 bullets per section

            # Generate a simple section title from the first sentence
            first = sentences[0].strip() if sentences else "Section"
            section_title = first[:60] + ("…" if len(first) > 60 else "")
            if section_title.lower().startswith("•"):
                section_title = section_title[1:].strip()

            sections.append({
                "timestamp": fmt_ts(section_start),
                "section_title": section_title or f"Section {section_num}",
                "content": content,
            })

            # Reset for next section
            current_section = []
            section_start = entry["start"]
            section_num += 1

    return {
        "video_title": title,
        "source": "direct_transcript",
        "has_real_transcript": True,
        "notes": sections[:10],   # max 10 sections
    }


def build_notes_with_groq(transcript: list[dict], title: str) -> dict:
    """Use Groq (Llama 3) to generate polished notes from real transcript."""
    # Build text chunk (max 6000 chars to stay within token limits)
    lines = []
    total = 0
    for entry in transcript:
        line = f"[{fmt_ts(entry['start'])}] {entry['text'].replace(chr(10), ' ')}"
        total += len(line)
        if total > 6000:
            break
        lines.append(line)
    transcript_text = "\n".join(lines)

    prompt = f"""You are an expert study notes generator. Below is the REAL transcript from a YouTube video titled "{title}".

TRANSCRIPT:
{transcript_text}

Generate 5-8 timestamped study notes sections. Use the actual timestamps from the transcript.

Return ONLY valid JSON, no markdown fences:
{{
  "video_title": "{title}",
  "notes": [
    {{
      "timestamp": "0:00",
      "section_title": "Clear section title",
      "content": "• Real point from transcript\\n• Another real point\\n• Key concept explained"
    }}
  ]
}}"""

    content = call_groq([
        {"role": "system", "content": "You are a study notes generator. Respond with valid JSON only."},
        {"role": "user", "content": prompt},
    ])

    # Strip fences if present
    content = re.sub(r"^```json\s*", "", content, flags=re.IGNORECASE)
    content = re.sub(r"^```\s*", "", content, flags=re.IGNORECASE)
    content = re.sub(r"```\s*$", "", content).strip()

    parsed = json.loads(content)
    parsed["source"] = "groq_llama3"
    parsed["has_real_transcript"] = True
    return parsed


def build_notes_groq_no_transcript(title: str, video_url: str) -> dict:
    """Groq notes when no transcript available."""
    prompt = f"""Generate educational study notes for a YouTube video titled: "{title}"

Return ONLY valid JSON, no markdown:
{{
  "video_title": "{title}",
  "notes": [
    {{
      "timestamp": "0:00",
      "section_title": "Introduction",
      "content": "• Key concept\\n• Key concept\\n• Key concept"
    }}
  ]
}}"""

    content = call_groq([
        {"role": "system", "content": "You generate study notes as JSON only."},
        {"role": "user", "content": prompt},
    ])
    content = re.sub(r"^```json\s*", "", content, flags=re.IGNORECASE)
    content = re.sub(r"^```\s*", "", content, flags=re.IGNORECASE)
    content = re.sub(r"```\s*$", "", content).strip()
    parsed = json.loads(content)
    parsed["source"] = "groq_ai_generated"
    parsed["has_real_transcript"] = False
    return parsed


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "status": "EduSpark AI Backend v3 running",
        "ai_provider": "Groq (Llama 3)" if GROQ_API_KEY else "Direct transcript parsing (no AI key needed)",
        "database": "Supabase (PostgreSQL)" if SUPABASE_URL else "not configured",
        "port": PORT,
    }


@app.get("/api/db-status")
def db_status():
    """
    Health-check endpoint that verifies live connectivity to Supabase.
    Performs a lightweight SELECT on the profiles table.
    """
    try:
        sb = get_supabase()
        # Lightweight ping — select 1 row limit from profiles
        result = sb.table("profiles").select("id").limit(1).execute()
        return {
            "connected": True,
            "supabase_url": SUPABASE_URL,
            "database": "Supabase (PostgreSQL)",
            "tables_accessible": ["profiles", "chat_conversations", "chat_messages",
                                   "quizzes", "quiz_attempts", "interview_sessions", "course_progress"],
            "message": "✅ Supabase database connected successfully",
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail={
            "connected": False,
            "supabase_url": SUPABASE_URL,
            "error": str(e),
            "message": "❌ Supabase connection failed",
        })


@app.get("/api/health")
def health_check():
    """Full health check for all services."""
    services = {}

    # Check Supabase
    try:
        sb = get_supabase()
        sb.table("profiles").select("id").limit(1).execute()
        services["supabase"] = {"status": "ok", "url": SUPABASE_URL}
    except Exception as e:
        services["supabase"] = {"status": "error", "error": str(e)}

    # Check Groq API key
    services["groq"] = {
        "status": "ok" if GROQ_API_KEY else "not_configured",
        "model": "llama-3.3-70b-versatile" if GROQ_API_KEY else None,
    }

    # Check YouTube API key
    services["youtube"] = {
        "status": "ok" if YOUTUBE_API_KEY else "not_configured",
    }

    overall = "healthy" if all(
        s["status"] == "ok" for s in services.values()
    ) else "degraded"

    return {"overall": overall, "services": services}


# ── History Routes ─────────────────────────────────────────────────────────────
# These endpoints allow the frontend to fetch/save history via the backend.
# They use the user's JWT token (passed as Authorization header) so Supabase
# RLS is enforced per-user.

def _user_supabase(authorization: str | None):
    """Create a Supabase client scoped to the user's JWT token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.replace("Bearer ", "")
    return create_client(SUPABASE_URL, SUPABASE_KEY, options={
        "global": {"headers": {"Authorization": f"Bearer {token}"}}
    })


from fastapi import Header
from typing import Optional


@app.get("/api/history/quizzes")
def get_quiz_history(
    limit: int = Query(default=50, le=100),
    authorization: Optional[str] = Header(default=None)
):
    """Fetch all quiz attempts for the authenticated user."""
    try:
        sb = _user_supabase(authorization)
        r = (sb.table("quiz_attempts")
               .select("*, quizzes(topic, difficulty, questions)")
               .order("created_at", ascending=False)
               .limit(limit)
               .execute())
        return {"data": r.data, "count": len(r.data)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history/interviews")
def get_interview_history(
    limit: int = Query(default=50, le=100),
    authorization: Optional[str] = Header(default=None)
):
    """Fetch all interview sessions for the authenticated user."""
    try:
        sb = _user_supabase(authorization)
        r = (sb.table("interview_sessions")
               .select("*")
               .order("created_at", ascending=False)
               .limit(limit)
               .execute())
        return {"data": r.data, "count": len(r.data)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history/courses")
def get_course_history(
    authorization: Optional[str] = Header(default=None)
):
    """Fetch all course progress records for the authenticated user."""
    try:
        sb = _user_supabase(authorization)
        r = (sb.table("course_progress")
               .select("*")
               .order("updated_at", ascending=False)
               .execute())
        return {"data": r.data, "count": len(r.data)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history/dashboard")
def get_dashboard_stats(
    authorization: Optional[str] = Header(default=None)
):
    """
    Aggregate dashboard stats for the authenticated user:
    - Quiz average score & attempts
    - Course progress counts
    - Interview count & average score
    """
    try:
        sb = _user_supabase(authorization)

        # Fetch in parallel using individual queries
        attempts_r  = sb.table("quiz_attempts").select("score,total,created_at").order("created_at", ascending=False).limit(20).execute()
        quiz_r      = sb.table("quizzes").select("id", count="exact", head=True).execute()
        courses_r   = sb.table("course_progress").select("status").execute()
        interview_r = sb.table("interview_sessions").select("score,created_at").order("created_at", ascending=False).limit(5).execute()

        att = attempts_r.data or []
        total_score    = sum(a["score"] for a in att)
        total_possible = sum(a["total"] for a in att)
        avg_pct = round((total_score / total_possible) * 100) if total_possible else 0

        c = courses_r.data or []
        interviews = interview_r.data or []

        return {
            "quiz": {
                "avg_pct": avg_pct,
                "attempts": len(att),
                "quiz_count": quiz_r.count or 0,
                "recent": att[:5],
            },
            "courses": {
                "bookmarked":  sum(1 for x in c if x["status"] == "bookmarked"),
                "in_progress": sum(1 for x in c if x["status"] == "in_progress"),
                "completed":   sum(1 for x in c if x["status"] == "completed"),
                "total":       len(c),
            },
            "interviews": {
                "count": len(interviews),
                "avg_score": round(sum(i["score"] or 0 for i in interviews) / len(interviews)) if interviews else 0,
                "recent": interviews[:5],
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CourseStatusUpdate(BaseModel):
    status: str  # bookmarked | in_progress | completed


@app.patch("/api/history/courses/{course_id}")
def update_course_status(
    course_id: str,
    body: CourseStatusUpdate,
    authorization: Optional[str] = Header(default=None)
):
    """Update the status of a course progress record."""
    allowed = {"bookmarked", "in_progress", "completed"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")
    try:
        from datetime import datetime, timezone
        sb = _user_supabase(authorization)
        r = (sb.table("course_progress")
               .update({"status": body.status, "updated_at": datetime.now(timezone.utc).isoformat()})
               .eq("id", course_id)
               .execute())
        return {"success": True, "data": r.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/history/courses/{course_id}")
def delete_course(
    course_id: str,
    authorization: Optional[str] = Header(default=None)
):
    """Delete a course progress record."""
    try:
        sb = _user_supabase(authorization)
        sb.table("course_progress").delete().eq("id", course_id).execute()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search-videos")
def search_videos(topic: str = Query(..., min_length=1), max_results: int = Query(default=10, le=25)):
    search_url = "https://www.googleapis.com/youtube/v3/search"
    r = requests.get(search_url, params={
        "part": "snippet", "q": f"{topic} tutorial educational",
        "type": "video", "maxResults": max_results, "order": "relevance",
        "safeSearch": "strict", "key": YOUTUBE_API_KEY,
    }, timeout=10)
    if not r.ok:
        raise HTTPException(status_code=r.status_code, detail=f"YouTube API error: {r.text[:200]}")
    search_data = r.json()
    if not search_data.get("items"):
        return {"topic": topic, "videos": [], "source": "youtube-api"}

    video_ids = ",".join(item["id"]["videoId"] for item in search_data["items"])
    detail_r = requests.get("https://www.googleapis.com/youtube/v3/videos", params={
        "part": "snippet,contentDetails,statistics", "id": video_ids, "key": YOUTUBE_API_KEY,
    }, timeout=10)
    if not detail_r.ok:
        raise HTTPException(status_code=detail_r.status_code, detail="Failed to fetch video details")

    videos = []
    for item in detail_r.json().get("items", []):
        snippet = item["snippet"]
        stats = item.get("statistics", {})
        dur_iso = item.get("contentDetails", {}).get("duration", "")
        dm = re.match(r"PT(\d+H)?(\d+M)?(\d+S)?", dur_iso)
        if dm:
            h = int((dm.group(1) or "0H")[:-1])
            m = int((dm.group(2) or "0M")[:-1])
            s = int((dm.group(3) or "0S")[:-1])
            duration = f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
        else:
            duration = ""
        video_id = item["id"]
        videos.append({
            "title": snippet["title"],
            "video_id": video_id,
            "link": f"https://youtube.com/watch?v={video_id}",
            "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
            "channel": snippet.get("channelTitle", ""),
            "published_at": snippet.get("publishedAt", ""),
            "view_count": int(stats.get("viewCount", 0)),
            "duration": duration,
            "description": snippet.get("description", "")[:400],
            "has_transcript": True,  # checked lazily on demand
        })
    return {"topic": topic, "videos": videos, "source": "youtube-api"}


class NotesRequest(BaseModel):
    video_url: str
    video_title: str = ""


@app.post("/api/generate-notes")
def generate_notes(body: NotesRequest):
    video_id = extract_video_id(body.video_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL — could not extract video ID.")

    title = body.video_title or f"YouTube video {video_id}"
    transcript = get_transcript(video_id)

    # ── Strategy 1: Groq + real transcript (best quality) ──────────────────
    if GROQ_API_KEY and transcript:
        try:
            return build_notes_with_groq(transcript, title)
        except Exception as e:
            print(f"[warn] Groq+transcript failed: {e} — falling back")

    # ── Strategy 2: Direct transcript parsing (no AI, always works) ────────
    if transcript:
        result = build_notes_from_transcript(transcript, title)
        if result:
            return result

    # ── Strategy 3: Groq without transcript ────────────────────────────────
    if GROQ_API_KEY:
        try:
            return build_notes_groq_no_transcript(title, body.video_url)
        except Exception as e:
            print(f"[warn] Groq no-transcript failed: {e}")

    # ── Strategy 4: Hardcoded placeholder (absolute last resort) ───────────
    return {
        "video_title": title,
        "source": "unavailable",
        "has_real_transcript": False,
        "notes": [{
            "timestamp": "0:00",
            "section_title": "Subtitles not available",
            "content": (
                "• This video does not have subtitles/captions enabled\n"
                "• Add a GROQ_API_KEY to your .env for AI-generated notes\n"
                "• Get a free key at: https://console.groq.com"
            ),
        }],
    }

# ── Web Resource Routes ────────────────────────────────────────────────────────

@app.get("/api/web-resources")
def web_resources(topic: str = Query(..., min_length=1)):
    """
    Search DuckDuckGo for educational web articles about a topic
    across GeeksForGeeks, freeCodeCamp, MDN, W3Schools, etc.
    """
    results = search_duckduckgo(topic, num_results=8)
    if not results:
        # Fallback: return curated links for well-known sites
        from urllib.parse import quote
        q = quote(topic)
        results = [
            {"title": f"{topic} - GeeksForGeeks", "url": f"https://www.geeksforgeeks.org/?s={q}",
             "site": "geeksforgeeks.org", "site_label": "GeeksForGeeks",
             "snippet": f"Comprehensive articles on {topic}",
             "favicon": "https://www.google.com/s2/favicons?domain=geeksforgeeks.org&sz=32"},
            {"title": f"{topic} - freeCodeCamp", "url": f"https://www.freecodecamp.org/news/search/?query={q}",
             "site": "freecodecamp.org", "site_label": "freeCodeCamp",
             "snippet": f"Free tutorials and articles on {topic}",
             "favicon": "https://www.google.com/s2/favicons?domain=freecodecamp.org&sz=32"},
            {"title": f"{topic} - MDN Web Docs", "url": f"https://developer.mozilla.org/en-US/search?q={q}",
             "site": "developer.mozilla.org", "site_label": "MDN Web Docs",
             "snippet": f"Official web documentation for {topic}",
             "favicon": "https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=32"},
        ]
    return {"topic": topic, "resources": results}


class WebNotesRequest(BaseModel):
    url: str
    title: str = ""


@app.post("/api/web-page-notes")
def web_page_notes(body: WebNotesRequest):
    """
    1. Use Playwright to fetch full rendered content from the URL.
    2. Use Groq Llama 3 to generate structured timestamped notes.
    3. Return notes in the same format as video notes (for PDF download).
    """
    if not body.url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid URL")

    # Step 1: Extract content
    print(f"[web] Extracting content from: {body.url}")
    content = extract_page_content(body.url)

    if not content or len(content.strip()) < 100:
        raise HTTPException(
            status_code=422,
            detail="Could not extract enough content from this page. It may require login or be paywalled."
        )

    # Step 2: Generate notes
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY not configured. Add it to .env for web notes generation."
        )

    title = body.title or body.url
    return generate_web_notes(content, title, body.url, call_groq)


# ── Port management & startup ─────────────────────────────────────────────────

def kill_port(port: int):
    """Kill any process using the given port (Windows)."""
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True
        )
        for line in result.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.strip().split()
                pid = int(parts[-1])
                if pid != os.getpid():
                    subprocess.run(["taskkill", "/PID", str(pid), "/F"],
                                   capture_output=True)
                    print(f"Killed old process PID {pid} on port {port}")
    except Exception as e:
        print(f"Could not auto-kill port {port}: {e}")


if __name__ == "__main__":
    import uvicorn
    kill_port(PORT)  # auto-kill any old process on this port
    ai_mode = "Groq Llama 3 (open-source)" if GROQ_API_KEY else "Direct transcript parsing (no API key needed)"
    print(f"EduSpark AI Backend v3 starting on http://localhost:{PORT}")
    print(f"AI mode: {ai_mode}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
