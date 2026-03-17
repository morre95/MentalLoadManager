from __future__ import annotations

import os
import sys
import unittest
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

import cache_maintenance  # noqa: E402


class _FakeResult:
    def __init__(self, *, rowcount: int | None = None, scalar_value=None) -> None:
        self.rowcount = rowcount
        self._scalar_value = scalar_value

    def scalar_one(self):
        return self._scalar_value


class _FakeDB:
    def __init__(self) -> None:
        self.delete_calls: list[str] = []
        self.select_calls: list[str] = []
        self.commit_calls = 0
        self.rollback_calls = 0

    def execute(self, clause, params=None):  # noqa: ANN001
        sql = str(clause)
        if sql.startswith("DELETE FROM"):
            self.delete_calls.append(sql)
            return _FakeResult(rowcount=7)
        if "SELECT COUNT(*) FROM" in sql:
            self.select_calls.append(sql)
            return _FakeResult(scalar_value=11)
        if "SELECT pg_total_relation_size" in sql:
            self.select_calls.append(sql)
            return _FakeResult(scalar_value=4096)
        raise AssertionError(f"Unexpected SQL: {sql} params={params}")

    def commit(self) -> None:
        self.commit_calls += 1

    def rollback(self) -> None:
        self.rollback_calls += 1


class _FakeSessionContext:
    def __init__(self, db: _FakeDB) -> None:
        self._db = db

    def __enter__(self) -> _FakeDB:
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


def _session_local_factory(db: _FakeDB):
    def _session_local():
        return _FakeSessionContext(db)

    return _session_local


class CacheMaintenanceTests(unittest.TestCase):
    def test_cleanup_deletes_from_all_ai_cache_tables_and_logs_stats(self) -> None:
        db = _FakeDB()

        with patch.object(
            cache_maintenance,
            "get_session_local",
            return_value=_session_local_factory(db),
        ):
            cache_maintenance.run_ai_cache_maintenance_once()

        self.assertEqual(len(db.delete_calls), 3)
        self.assertTrue(
            any("DELETE FROM analytics_ai_insights_cache" in sql for sql in db.delete_calls)
        )
        self.assertTrue(
            any("DELETE FROM analytics_ai_questions_cache" in sql for sql in db.delete_calls)
        )
        self.assertTrue(
            any("DELETE FROM goal_ai_checkins_cache" in sql for sql in db.delete_calls)
        )
        self.assertEqual(db.commit_calls, 1)
        self.assertEqual(db.rollback_calls, 0)


if __name__ == "__main__":
    unittest.main()
