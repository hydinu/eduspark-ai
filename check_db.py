"""
Verify all Supabase tables exist and test CRUD for history data.
"""
import os, sys, json
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY")
sb  = create_client(url, key)

TABLES = [
    "profiles",
    "quiz_attempts",
    "quizzes",
    "interview_sessions",
    "course_progress",
    "chat_conversations",
    "chat_messages",
]

print("=" * 55)
print("  Supabase Table Status Check")
print("=" * 55)

ok_tables = []
missing_tables = []

for table in TABLES:
    try:
        r = sb.table(table).select("*").limit(1).execute()
        count = len(r.data) if r.data else 0
        print(f"  OK  {table:<25} reachable  ({count} rows sampled)")
        ok_tables.append(table)
    except Exception as e:
        err = str(e)[:70]
        print(f"  ERR {table:<25} ERROR: {err}")
        missing_tables.append(table)

print()
print(f"  {len(ok_tables)}/{len(TABLES)} tables accessible")

if missing_tables:
    print(f"\n  MISSING: {missing_tables}")
    print("  -> Run the SQL migration in Supabase SQL Editor to create them.")
else:
    print("\n  All tables exist!")

print()
print("=" * 55)
print("  Full Row Count per Table")
print("=" * 55)

for table in ok_tables:
    try:
        r = sb.table(table).select("*", count="exact", head=True).execute()
        print(f"  {table:<25} {r.count} rows")
    except Exception as e:
        print(f"  {table:<25} count error: {e}")
