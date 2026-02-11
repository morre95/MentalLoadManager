import os
from pathlib import Path
from typing import LiteralString, cast

import psycopg
from dotenv import load_dotenv

# Load .env only if it exists (local dev). On Railway, env vars come from platform vars.
if Path(".env").exists():
    load_dotenv()
else:
    print("Copy .env.example to .env anf fill it with real data")
    exit()


def main() -> None:
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set (Railway Variables or local .env)")

    # Resolve seed_data.sql relative to this file (works regardless of cwd).
    base_dir = Path(__file__).resolve().parent
    sql_file = base_dir / "seed_data.sql"
    if not sql_file.exists():
        raise FileNotFoundError(f"{sql_file} not found")

    seed_sql = sql_file.read_text(encoding="utf-8")
    # The SQL comes from a local static file in this repo; cast for psycopg type checkers.
    seed_query = cast(LiteralString, seed_sql)

    conn = psycopg.connect(db_url)
    conn.autocommit = True

    try:
        with conn.cursor() as cursor:
            cursor.execute(seed_query)
            print("Seed data applied successfully.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
