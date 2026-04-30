"""
EduSpark AI — Web Scraper Module
Scrapes educational sites and generates study notes from web content.
"""

import re
import asyncio
import requests
from urllib.parse import quote, unquote, urlparse
from bs4 import BeautifulSoup

# ── Target educational sites ──────────────────────────────────────────────────
EDU_SITES = [
    "geeksforgeeks.org",
    "freecodecamp.org",
    "developer.mozilla.org",
    "w3schools.com",
    "towardsdatascience.com",
    "tutorialspoint.com",
    "css-tricks.com",
    "realpython.com",
]

SITE_LABELS = {
    "geeksforgeeks.org": "GeeksForGeeks",
    "freecodecamp.org": "freeCodeCamp",
    "developer.mozilla.org": "MDN Web Docs",
    "w3schools.com": "W3Schools",
    "towardsdatascience.com": "Towards Data Science",
    "tutorialspoint.com": "Tutorialspoint",
    "css-tricks.com": "CSS-Tricks",
    "realpython.com": "Real Python",
}

COURSE_SITES = [
    "coursera.org",
    "udemy.com",
    "edx.org",
    "pluralsight.com",
    "codecademy.com",
    "khanacademy.org"
]

COURSE_LABELS = {
    "coursera.org": "Coursera",
    "udemy.com": "Udemy",
    "edx.org": "edX",
    "pluralsight.com": "Pluralsight",
    "codecademy.com": "Codecademy",
    "khanacademy.org": "Khan Academy"
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def search_duckduckgo(topic: str, num_results: int = 8) -> list[dict]:
    """
    Search DuckDuckGo HTML (no API key needed) for educational content.
    Falls back to curated direct links if DDG returns nothing.
    """
    site_filter = " OR ".join(f"site:{s}" for s in EDU_SITES[:6])
    query = f"{topic} tutorial {site_filter}"
    url = f"https://html.duckduckgo.com/html/?q={quote(query)}"

    results = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")

        # DuckDuckGo HTML structure — try multiple selectors
        blocks = (
            soup.find_all("div", class_="result__body")
            or soup.find_all("div", class_="results_links_deep")
            or soup.find_all("div", attrs={"data-nir": True})
            or soup.find_all("article")  # newer DDG layout
        )

        for block in blocks[:num_results * 2]:   # fetch extra, filter below
            # title / link
            title_el = (
                block.find("a", class_="result__a")
                or block.find("a", class_="result__url")
                or block.find("h2", class_="result__title")
                or block.find("a")
            )
            snippet_el = (
                block.find("a", class_="result__snippet")
                or block.find("div", class_="result__snippet")
                or block.find("span", class_="result__snippet")
            )
            if not title_el:
                continue

            href = title_el.get("href", "")
            # DuckDuckGo uses redirect URLs — extract real URL
            if "uddg=" in href:
                try:
                    real_url = unquote(href.split("uddg=")[1].split("&")[0])
                except Exception:
                    real_url = href
            else:
                real_url = href

            if not real_url.startswith("http"):
                continue

            parsed = urlparse(real_url)
            domain = parsed.netloc.replace("www.", "")

            # Skip non-edu sites
            if not any(site in domain for site in EDU_SITES):
                continue

            site_label = next((v for k, v in SITE_LABELS.items() if k in domain), domain)

            results.append({
                "title": title_el.get_text(strip=True),
                "url": real_url,
                "site": domain,
                "site_label": site_label,
                "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
                "favicon": f"https://www.google.com/s2/favicons?domain={domain}&sz=32",
            })

            if len(results) >= num_results:
                break

    except Exception as e:
        print(f"[scraper] DuckDuckGo search failed: {e}")

    # ── Fallback: curated direct site search links ─────────────────────────
    if not results:
        print(f"[scraper] DDG returned 0 results, using curated fallback for: {topic}")
        q = quote(topic)
        fallback_sites = [
            ("geeksforgeeks.org",      "GeeksForGeeks",   f"https://www.geeksforgeeks.org/?s={q}"),
            ("freecodecamp.org",       "freeCodeCamp",    f"https://www.freecodecamp.org/news/search/?query={q}"),
            ("developer.mozilla.org", "MDN Web Docs",    f"https://developer.mozilla.org/en-US/search?q={q}"),
            ("w3schools.com",          "W3Schools",       f"https://www.w3schools.com/search/search_result.php?search={q}"),
            ("realpython.com",         "Real Python",     f"https://realpython.com/search?q={q}"),
            ("tutorialspoint.com",     "Tutorialspoint",  f"https://www.tutorialspoint.com/search/search_result.php?search={q}"),
            ("css-tricks.com",         "CSS-Tricks",      f"https://css-tricks.com/?s={q}"),
            ("towardsdatascience.com", "Towards Data Science", f"https://towardsdatascience.com/search?q={q}"),
        ]
        for domain, label, search_url in fallback_sites[:num_results]:
            results.append({
                "title": f"{topic} — {label}",
                "url": search_url,
                "site": domain,
                "site_label": label,
                "snippet": f"Search {label} for articles and tutorials on {topic}",
                "favicon": f"https://www.google.com/s2/favicons?domain={domain}&sz=32",
            })

    return results[:num_results]

def search_courses(topic: str, num_results: int = 8) -> list[dict]:
    """
    Search DuckDuckGo HTML for full online courses from Coursera, Udemy, edX, etc.
    """
    site_filter = " OR ".join(f"site:{s}" for s in COURSE_SITES)
    query = f"{topic} course {site_filter}"
    url = f"https://html.duckduckgo.com/html/?q={quote(query)}"

    results = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")

        blocks = (
            soup.find_all("div", class_="result__body")
            or soup.find_all("div", class_="results_links_deep")
            or soup.find_all("div", attrs={"data-nir": True})
            or soup.find_all("article")
        )

        for block in blocks[:num_results * 2]:
            title_el = (
                block.find("a", class_="result__a")
                or block.find("a", class_="result__url")
                or block.find("h2", class_="result__title")
                or block.find("a")
            )
            snippet_el = (
                block.find("a", class_="result__snippet")
                or block.find("div", class_="result__snippet")
                or block.find("span", class_="result__snippet")
            )
            if not title_el:
                continue

            href = title_el.get("href", "")
            if "uddg=" in href:
                try:
                    real_url = unquote(href.split("uddg=")[1].split("&")[0])
                except Exception:
                    real_url = href
            else:
                real_url = href

            if not real_url.startswith("http"):
                continue

            parsed = urlparse(real_url)
            domain = parsed.netloc.replace("www.", "")

            if not any(site in domain for site in COURSE_SITES):
                continue

            site_label = next((v for k, v in COURSE_LABELS.items() if k in domain), domain)

            results.append({
                "title": title_el.get_text(strip=True),
                "url": real_url,
                "site": domain,
                "site_label": site_label,
                "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
                "favicon": f"https://www.google.com/s2/favicons?domain={domain}&sz=32",
            })

            if len(results) >= num_results:
                break
    except Exception as e:
        print(f"[scraper] DuckDuckGo course search failed: {e}")

    if not results:
        q = quote(topic)
        fallback_sites = [
            ("coursera.org", "Coursera", f"https://www.coursera.org/search?query={q}"),
            ("udemy.com", "Udemy", f"https://www.udemy.com/courses/search/?src=ukw&q={q}"),
            ("edx.org", "edX", f"https://www.edx.org/search?q={q}"),
            ("codecademy.com", "Codecademy", f"https://www.codecademy.com/search?query={q}"),
        ]
        for domain, label, search_url in fallback_sites[:num_results]:
            results.append({
                "title": f"Search for {topic} on {label}",
                "url": search_url,
                "site": domain,
                "site_label": label,
                "snippet": f"Find full courses and certifications on {topic}",
                "favicon": f"https://www.google.com/s2/favicons?domain={domain}&sz=32",
            })

    return results[:num_results]


def search_youtube_videos(topic: str, num_results: int = 10) -> list[dict]:
    """
    Search DuckDuckGo HTML for YouTube videos about a topic — no API key needed.
    Returns a list of video dicts compatible with the /api/search-videos response format.
    """
    query = f"{topic} tutorial site:youtube.com"
    url = f"https://html.duckduckgo.com/html/?q={quote(query)}"

    results = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")

        blocks = (
            soup.find_all("div", class_="result__body")
            or soup.find_all("div", class_="results_links_deep")
            or soup.find_all("div", attrs={"data-nir": True})
            or soup.find_all("article")
        )

        for block in blocks[:num_results * 2]:
            title_el = (
                block.find("a", class_="result__a")
                or block.find("a", class_="result__url")
                or block.find("h2", class_="result__title")
                or block.find("a")
            )
            snippet_el = (
                block.find("a", class_="result__snippet")
                or block.find("div", class_="result__snippet")
                or block.find("span", class_="result__snippet")
            )
            if not title_el:
                continue

            href = title_el.get("href", "")
            if "uddg=" in href:
                try:
                    real_url = unquote(href.split("uddg=")[1].split("&")[0])
                except Exception:
                    real_url = href
            else:
                real_url = href

            if not real_url.startswith("http"):
                continue

            # Only keep YouTube video links
            if "youtube.com/watch" not in real_url and "youtu.be/" not in real_url:
                continue

            # Extract video ID
            video_id = None
            if "youtube.com/watch?v=" in real_url:
                video_id = real_url.split("v=")[1].split("&")[0][:11]
            elif "youtu.be/" in real_url:
                video_id = real_url.split("youtu.be/")[1].split("?")[0][:11]

            if not video_id:
                continue

            title = title_el.get_text(strip=True)
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""

            # Remove " - YouTube" suffix common in DDG results
            title = re.sub(r"\s*[-–]\s*YouTube\s*$", "", title, flags=re.IGNORECASE).strip()

            # Try to extract channel from snippet (often "Channel Name · duration ago")
            channel = ""
            channel_match = re.match(r"^([^·•\-]+)[·•]", snippet)
            if channel_match:
                channel = channel_match.group(1).strip()

            results.append({
                "title": title,
                "video_id": video_id,
                "link": f"https://youtube.com/watch?v={video_id}",
                "thumbnail": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
                "channel": channel or "YouTube",
                "published_at": "",
                "view_count": 0,
                "duration": "",
                "description": snippet,
                "has_transcript": True,
            })

            if len(results) >= num_results:
                break

    except Exception as e:
        print(f"[scraper] DuckDuckGo YouTube search failed: {e}")

    # ── Fallback: curated YouTube search links ─────────────────────────────
    if not results:
        print(f"[scraper] DDG YouTube returned 0 results, generating fallback search link for: {topic}")
        q = quote(topic + " tutorial")
        # Return a single "search" card pointing to YouTube search
        results = [{
            "title": f"Search YouTube for '{topic}' tutorials",
            "video_id": "",
            "link": f"https://www.youtube.com/results?search_query={q}",
            "thumbnail": "https://www.google.com/s2/favicons?domain=youtube.com&sz=128",
            "channel": "YouTube Search",
            "published_at": "",
            "view_count": 0,
            "duration": "",
            "description": f"Click to browse YouTube tutorials on '{topic}'",
            "has_transcript": False,
        }]

    return results[:num_results]


def extract_with_requests(url: str) -> str:
    """Fallback: extract text using requests + BeautifulSoup."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")

        # Remove clutter
        for tag in soup(["script", "style", "nav", "footer", "header",
                          "aside", "form", "noscript", ".advertisement"]):
            tag.decompose()

        # Try common content selectors
        for sel in ["article", "main", "[role='main']", ".content", "#content",
                    "#main-content", ".post-body", ".article-body", ".entry-content"]:
            el = soup.select_one(sel)
            if el:
                text = el.get_text(separator="\n", strip=True)
                if len(text) > 300:
                    return text[:7000]

        # Fallback to full body
        return soup.get_text(separator="\n", strip=True)[:7000]
    except Exception as e:
        return f"Could not fetch page: {e}"


async def extract_with_playwright(url: str) -> str:
    """Extract content using Playwright to handle JavaScript-rendered sites."""
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(
                user_agent=HEADERS["User-Agent"],
                extra_http_headers={"Accept-Language": HEADERS["Accept-Language"]}
            )
            # Route interception to block images/media and speed up loading
            await page.route("**/*", lambda route: route.continue_() if route.request.resource_type in ["document", "script", "xhr", "fetch"] else route.abort())
            
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            
            # Wait a brief moment for JS frameworks to hydrate
            await page.wait_for_timeout(2000)
            
            html = await page.content()
            await browser.close()
            
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header",
                              "aside", "form", "noscript", ".advertisement"]):
                tag.decompose()
            
            for sel in ["article", "main", "[role='main']", ".content", "#content",
                        "#main-content", ".post-body", ".article-body", ".entry-content"]:
                el = soup.select_one(sel)
                if el:
                    text = el.get_text(separator="\n", strip=True)
                    if len(text) > 300:
                        return text[:7000]
            
            return soup.get_text(separator="\n", strip=True)[:7000]
    except Exception as e:
        print(f"[scraper] Playwright failed: {e}")
        return extract_with_requests(url)


async def extract_page_content(url: str) -> str:
    """Extract content using Playwright with requests fallback."""
    return await extract_with_playwright(url)


def generate_web_notes(content: str, title: str, url: str, call_groq_fn) -> dict:
    """
    Use Groq Llama 3 to convert scraped web content into structured study notes.
    """
    # Clean and truncate
    clean = re.sub(r"\n{3,}", "\n\n", content).strip()[:5500]

    site = urlparse(url).netloc.replace("www.", "")

    prompt = f"""You are an expert study notes generator. Below is content scraped from the educational article titled "{title}" at {site}.

ARTICLE CONTENT:
{clean}

Generate 4-6 concise timestamped study sections from this content. Use section numbers as timestamps (e.g. "1", "2"…).

Return ONLY valid JSON, no markdown fences:
{{
  "video_title": "{title}",
  "source_url": "{url}",
  "source_site": "{site}",
  "notes": [
    {{
      "timestamp": "1",
      "section_title": "Clear section heading",
      "content": "• Key point from the article\\n• Another key point\\n• Important concept"
    }}
  ]
}}"""

    try:
        raw = call_groq_fn([
            {"role": "system", "content": "You generate study notes from web articles as JSON only."},
            {"role": "user", "content": prompt},
        ])
        raw = re.sub(r"^```json\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"^```\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"```\s*$", "", raw).strip()
        parsed = json.loads(raw)
        parsed["has_real_transcript"] = True
        parsed["source"] = "web_scrape"
        return parsed
    except Exception as e:
        # Fallback: build plain notes from raw text paragraphs
        paras = [p.strip() for p in clean.split("\n\n") if len(p.strip()) > 50]
        notes = []
        for i, para in enumerate(paras[:6], 1):
            bullets = [f"• {s.strip()}" for s in para.split(". ") if len(s.strip()) > 20][:4]
            notes.append({
                "timestamp": str(i),
                "section_title": f"Section {i}",
                "content": "\n".join(bullets) or f"• {para[:200]}",
            })
        return {
            "video_title": title,
            "source_url": url,
            "source_site": site,
            "notes": notes,
            "has_real_transcript": True,
            "source": "web_scrape_direct",
        }


import json  # needed by generate_web_notes
