// src/lib/youtube-api.ts

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || "";
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const MAX_RESULTS = 10;

export interface AIContent {
  summary: string;
  key_concepts: string[];
  explanation_for_students: string;
  quiz_questions: string[];
}

export interface YouTubeVideo {
  title: string;
  video_id: string;
  link: string;
  thumbnail: string;
  channel: string;
  published_at: string;
  view_count: number;
  duration: string;
  description: string;
  has_transcript: boolean;
  ai_content: AIContent;
}

export interface VideoFetchResult {
  topic: string;
  videos: YouTubeVideo[];
  source: string;
}

/**
 * Generate AI-style study content from video metadata.
 */
export function generateAIContent(title: string, description: string, topic: string): AIContent {
  const cleanDesc = description
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\n\r]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const allText = (title + ' ' + cleanDesc).toLowerCase();
  const words = allText.split(/\W+/).filter(w => w.length > 3);

  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(e => e[0]);

  const stops = new Set([
    'this','that','with','from','have','will','your','what','about','been',
    'they','their','more','when','also','than','them','some','into','each',
    'make','like','just','over','only','such','very','most','even','does',
    'through','after','these','would','could','other','which','those','then',
    'first','where','before','should','still','being'
  ]);
  const keywords = topWords.filter(w => !stops.has(w));

  const keyConcepts = keywords.slice(0, 7).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  );

  const summaryBase = cleanDesc.length > 30
    ? cleanDesc.substring(0, 350).replace(/\s\S*$/, '') + '...'
    : `This video covers ${topic} in an educational and student-friendly format. Watch to learn the core concepts, explanations, and practical examples related to this topic.`;

  const summary = `📚 "${title}" — ${summaryBase}`;

  const explanation = cleanDesc.length > 50
    ? `This video is about ${topic}. Here's what you'll learn:\n\n${cleanDesc.substring(0, 600).replace(/\s\S*$/, '')}...\n\nThe video breaks down complex ideas into simpler parts, making it great for students who are just starting to learn about ${topic}. Pay attention to the examples and try to relate them to what you already know!`
    : `This video teaches you about ${topic} in a clear, easy-to-follow way. It covers the fundamental concepts and builds up to more advanced ideas step by step. Great for students who want a solid foundation in ${topic}. Take notes while watching and pause at key moments to test your understanding!`;

  const quizQuestions = [
    `What are the main concepts covered in "${title}"?`,
    `Explain the most important idea from this video about ${topic} in your own words.`,
    `How does ${topic} apply to real-world scenarios? Give an example.`,
    `What are the key terms or vocabulary related to ${topic} mentioned in this video?`,
    `If you had to teach ${topic} to a friend, what would you emphasize based on this video?`
  ];

  return {
    summary,
    key_concepts: keyConcepts.length > 0 ? keyConcepts : [topic, 'Fundamentals', 'Examples', 'Practice', 'Review'],
    explanation_for_students: explanation,
    quiz_questions: quizQuestions,
  };
}

function formatDuration(isoDuration: string): string {
  // Simple ISO 8601 duration parser for PT#M#S
  const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return "";
  
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  const s = parseInt(match[3] || "0");
  
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function fetchVideosViaBackend(topic: string): Promise<VideoFetchResult> {
  const url = `${BACKEND_URL}/api/search-videos?topic=${encodeURIComponent(topic)}&max_results=${MAX_RESULTS}`;
  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Backend returned ${res.status}`);
  }

  const data = await res.json();

  const videos = data.videos.map((v: any) => ({
    title: v.title,
    video_id: v.video_id,
    link: v.link,
    thumbnail: v.thumbnail,
    channel: v.channel,
    published_at: v.published_at,
    view_count: 0,
    duration: '',
    description: v.description || '',
    has_transcript: v.has_transcript,
    ai_content: generateAIContent(v.title, v.description || '', topic),
  }));

  return { topic, videos, source: 'ytfetcher' };
}

async function fetchVideosViaYouTubeAPI(topic: string): Promise<VideoFetchResult> {
  if (!YOUTUBE_API_KEY) {
    throw new Error("Missing YOUTUBE_API_KEY");
  }

  const searchParams = new URLSearchParams({
    part: 'snippet',
    q: topic + ' tutorial explanation educational',
    type: 'video',
    maxResults: MAX_RESULTS.toString(),
    order: 'relevance',
    videoCategoryId: '27',
    safeSearch: 'strict',
    key: YOUTUBE_API_KEY,
  });

  const searchRes = await fetch(`${YOUTUBE_SEARCH_URL}?${searchParams}`);
  if (!searchRes.ok) {
    const errData = await searchRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `YouTube API ${searchRes.status}`);
  }
  const searchData = await searchRes.json();

  if (!searchData.items || searchData.items.length === 0) {
    return { topic, videos: [], source: 'youtube-api' };
  }

  const videoIds = searchData.items.map((i: any) => i.id.videoId).join(',');
  const detailRes = await fetch(
    `${YOUTUBE_VIDEOS_URL}?${new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: videoIds,
      key: YOUTUBE_API_KEY,
    })}`
  );
  if (!detailRes.ok) throw new Error('Failed to fetch video details');
  const detailData = await detailRes.json();

  const videos = detailData.items.map((item: any) => {
    const snippet = item.snippet;
    const stats = item.statistics;
    return {
      title: snippet.title,
      video_id: item.id,
      link: `https://youtube.com/watch?v=${item.id}`,
      thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
      channel: snippet.channelTitle,
      published_at: snippet.publishedAt,
      view_count: parseInt(stats.viewCount || "0"),
      duration: formatDuration(item.contentDetails.duration),
      description: snippet.description || '',
      has_transcript: false, // Don't know via public API without extra calls
      ai_content: generateAIContent(snippet.title, snippet.description || '', topic),
    };
  });

  return { topic, videos, source: 'youtube-api' };
}

export async function fetchYouTubeVideos(topic: string): Promise<VideoFetchResult> {
  // Use YouTube Data API directly — no Python backend dependency
  console.info('[api] Fetching via YouTube Data API…');
  const result = await fetchVideosViaYouTubeAPI(topic);
  console.info(`[api] YouTube API returned ${result.videos.length} videos`);
  return result;
}

