import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

def main():
    # Load environment variables from .env
    load_dotenv()

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set in .env")

    # Read SQL file
    sql_file = Path("setup_db.sql")
    if not sql_file.exists():
        raise FileNotFoundError("setup_db.sql not found")

    schema_sql = sql_file.read_text(encoding="utf-8")

    # Connect to Postgres
    conn = psycopg2.connect(db_url)
    conn.autocommit = True  # Important for CREATE EXTENSION, CREATE TABLE

    try:
        with conn.cursor() as cursor:
            cursor.execute(schema_sql)
            print("✅ Database schema applied successfully.")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
