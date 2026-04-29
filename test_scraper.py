import sys
sys.path.insert(0, '.')

print("=== 1. Checking Dependencies ===")
try:
    from playwright.async_api import async_playwright
    print("OK: playwright installed")
    playwright_ok = True
except ImportError as e:
    print(f"MISSING playwright: {e}")
    playwright_ok = False

try:
    from bs4 import BeautifulSoup
    print("OK: beautifulsoup4 installed")
except ImportError as e:
    print(f"MISSING bs4: {e}")

print()
print("=== 2. DuckDuckGo Search Test ===")
from web_scraper import search_duckduckgo
results = search_duckduckgo("python lists tutorial", num_results=6)
print(f"Results found: {len(results)}")
for r in results:
    label = r.get("site_label", "?")
    title = r.get("title", "")[:60]
    url = r.get("url", "")[:75]
    print(f"  [{label}] {title}")
    print(f"    {url}")

print()
print("=== 3. Playwright Content Extraction ===")
if playwright_ok:
    import asyncio
    from web_scraper import extract_with_playwright, extract_with_requests

    test_urls = [
        ("GeeksForGeeks", "https://www.geeksforgeeks.org/python-list/"),
        ("MDN Web Docs",  "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array"),
        ("W3Schools",     "https://www.w3schools.com/python/python_lists.asp"),
        ("freeCodeCamp",  "https://www.freecodecamp.org/news/python-list-tutorial/"),
    ]

    for name, url in test_urls:
        print(f"\n  Testing: {name}")
        print(f"  URL: {url}")
        try:
            content = asyncio.run(extract_with_playwright(url))
            words = len(content.split()) if content else 0
            print(f"  Playwright: {words} words extracted  OK" if words > 50 else f"  Playwright: too little content ({words} words) - FAIL")
        except Exception as e:
            print(f"  Playwright: ERROR - {e}")
            try:
                content = extract_with_requests(url)
                words = len(content.split()) if content else 0
                print(f"  Requests fallback: {words} words  {'OK' if words > 50 else 'FAIL'}")
            except Exception as e2:
                print(f"  Requests fallback: ERROR - {e2}")
else:
    print("  Skipped (playwright not installed)")
    print()
    print("=== Testing requests fallback ===")
    from web_scraper import extract_with_requests
    url = "https://www.w3schools.com/python/python_lists.asp"
    content = extract_with_requests(url)
    words = len(content.split()) if content else 0
    print(f"  W3Schools (requests): {words} words  {'OK' if words > 50 else 'FAIL'}")
    print(f"  Preview: {content[:200]}")

print()
print("=== 4. Backend API Test ===")
import requests as req
try:
    r = req.get("http://localhost:8000/api/web-resources?topic=python+lists", timeout=10)
    data = r.json()
    res_count = len(data.get("resources", []))
    print(f"HTTP {r.status_code} - {res_count} resources returned")
    for item in data.get("resources", [])[:3]:
        print(f"  [{item.get('site_label','?')}] {item.get('title','')[:55]}")
except Exception as e:
    print(f"  API ERROR: {e}")

print()
print("=== Done ===")
