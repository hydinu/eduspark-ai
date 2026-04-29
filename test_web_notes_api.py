"""
Final verification: test the full /api/web-page-notes pipeline live.
Tests GeeksForGeeks, MDN, and W3Schools with Playwright + Groq.
"""
import requests
import json

BACKEND = "http://localhost:8000"

test_cases = [
    {
        "name": "GeeksForGeeks - Python Lists",
        "url": "https://www.geeksforgeeks.org/python-list/",
        "title": "Python List - GeeksForGeeks"
    },
    {
        "name": "MDN Web Docs - Array",
        "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array",
        "title": "Array - JavaScript | MDN"
    },
    {
        "name": "W3Schools - Python Lists",
        "url": "https://www.w3schools.com/python/python_lists.asp",
        "title": "Python Lists - W3Schools"
    },
]

print("=== Live /api/web-page-notes Test ===\n")

for case in test_cases:
    print(f"Testing: {case['name']}")
    print(f"  URL: {case['url']}")
    try:
        r = requests.post(
            f"{BACKEND}/api/web-page-notes",
            json={"url": case["url"], "title": case["title"]},
            timeout=60
        )
        if r.status_code == 200:
            data = r.json()
            notes_count = len(data.get("notes", []))
            source = data.get("source", "?")
            title = data.get("video_title", "?")[:50]
            print(f"  HTTP 200 OK")
            print(f"  Source: {source} | Notes sections: {notes_count} | Title: {title}")
            if data.get("notes"):
                first = data["notes"][0]
                print(f"  First section: [{first.get('timestamp','?')}] {first.get('section_title','?')}")
                content_preview = first.get("content","")[:120].replace("\n", " | ")
                print(f"  Content: {content_preview}...")
        else:
            err = r.json().get("detail", r.text[:200])
            print(f"  HTTP {r.status_code} - {err}")
    except requests.exceptions.ConnectionError:
        print("  ERROR: Backend not running (start with: python backend.py)")
    except Exception as e:
        print(f"  ERROR: {e}")
    print()

print("=== /api/web-resources Test ===")
r2 = requests.get(f"{BACKEND}/api/web-resources?topic=machine+learning", timeout=10)
data2 = r2.json()
print(f"HTTP {r2.status_code} - {len(data2.get('resources', []))} resources")
for res in data2.get("resources", [])[:4]:
    print(f"  [{res.get('site_label','?')}] {res.get('title','')[:55]}")

print("\n=== Summary ===")
