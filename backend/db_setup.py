import os
from pathlib import Path
import psycopg
from dotenv import load_dotenv

# Load .env only if it exists (local dev). On Railway, env vars come from the platform.
if Path(".env").exists():
    load_dotenv()

def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set (Railway Variables or local .env)")

    # Resolve setup_db.sql relative to this file (works regardless of working directory)
    base_dir = Path(__file__).resolve().parent
    sql_file = base_dir / "setup_db.sql"
    if not sql_file.exists():
        raise FileNotFoundError(f"{sql_file} not found")

    schema_sql = sql_file.read_text(encoding="utf-8")

    conn = psycopg.connect(db_url)
    conn.autocommit = True

    try:
        with conn.cursor() as cursor:
            cursor.execute(schema_sql)
            print("Database schema applied successfully.")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
