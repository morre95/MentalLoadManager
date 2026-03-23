from __future__ import annotations

import os
import sys
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "60")
os.environ.setdefault("BACKEND_URL", "http://localhost:8000")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
os.environ.setdefault("FACEBOOK_CLIENT_ID", "test-facebook-client-id")
os.environ.setdefault("FACEBOOK_CLIENT_SECRET", "test-facebook-client-secret")
os.environ.setdefault("INSTAGRAM_CLIENT_ID", "test-instagram-client-id")
os.environ.setdefault("INSTAGRAM_CLIENT_SECRET", "test-facebook-client-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/test_db")
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_MODEL", "test-model")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS", "test-fallback")
os.environ.setdefault("RESEND_API_KEY", "test-resend-key")
os.environ.setdefault("CONTACT_RECIPIENT_EMAIL", "contact@example.com")

import helpers  # noqa: E402


class _FakeInspector:
    def get_columns(self, table_name: str):  # noqa: ANN001
        if table_name == "tasks":
            return [
                {"name": "task_id"},
                {"name": "due_date"},
                {"name": "name"},
                {"name": "description"},
                {"name": "status"},
                {"name": "priority"},
                {"name": "complete_date"},
                {"name": "created_at"},
                {"name": "assigns_to"},
                {"name": "created_by"},
                {"name": "started_at"},
                {"name": "household_id"},
                {"name": "updated_at"},
            ]
        return []


class _FakeConnection:
    def __init__(self) -> None:
        self.statements: list[str] = []

    def execute(self, clause, *args, **kwargs) -> None:  # noqa: ANN001
        self.statements.append(str(clause))


class _FakeBegin:
    def __init__(self, connection: _FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> _FakeConnection:
        return self.connection

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class _FakeEngine:
    def __init__(self, connection: _FakeConnection) -> None:
        self.connection = connection

    def begin(self) -> _FakeBegin:
        return _FakeBegin(self.connection)


class SetupDbAndTablesTests(unittest.TestCase):
    def test_adds_missing_task_recurrence_columns_for_existing_databases(self) -> None:
        fake_connection = _FakeConnection()
        fake_engine = _FakeEngine(fake_connection)

        with (
            patch.object(helpers.Base.metadata, "create_all"),
            patch.object(helpers, "engine", fake_engine),
            patch.object(helpers, "inspect", return_value=_FakeInspector()),
        ):
            helpers.setup_db_and_tables()

        executed = "\n".join(fake_connection.statements)
        self.assertIn("ADD COLUMN IF NOT EXISTS recurrence_enabled", executed)
        self.assertIn("ADD COLUMN IF NOT EXISTS recurrence_frequency", executed)
        self.assertIn("ADD COLUMN IF NOT EXISTS recurrence_interval", executed)
        self.assertIn("ADD COLUMN IF NOT EXISTS recurrence_parent_task_id", executed)
        self.assertIn("ADD COLUMN IF NOT EXISTS recurrence_exceptions", executed)
        self.assertIn("tasks_recurrence_frequency_check", executed)
        self.assertIn("tasks_recurrence_interval_check", executed)
        self.assertIn("idx_tasks_recurrence_parent", executed)
        self.assertIn(
            "ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS weekly_analytics_email",
            executed,
        )
        self.assertIn("CREATE INDEX IF NOT EXISTS idx_email_jobs_status_run_after", executed)
        self.assertIn("CREATE INDEX IF NOT EXISTS idx_email_jobs_job_type_status", executed)
        self.assertIn(
            "ALTER TABLE analytics_ai_insights_cache ADD COLUMN IF NOT EXISTS created_at",
            executed,
        )
        self.assertIn(
            "ALTER TABLE analytics_ai_questions_cache ADD COLUMN IF NOT EXISTS created_at",
            executed,
        )
        self.assertIn(
            "ALTER TABLE goal_ai_checkins_cache ADD COLUMN IF NOT EXISTS created_at",
            executed,
        )
        self.assertIn("DROP TABLE IF EXISTS mood_tracker_artworks", executed)



if __name__ == "__main__":
    unittest.main()
