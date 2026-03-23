from __future__ import annotations

import os
import sys
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4


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
os.environ.setdefault("INSTAGRAM_CLIENT_SECRET", "test-instagram-client-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/test_db")
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_MODEL", "test-model")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS", "test-fallback")
os.environ.setdefault("RESEND_API_KEY", "re_test_key")
os.environ.setdefault("MAIL_FROM", "noreply@example.com")
os.environ.setdefault("CONTACT_RECIPIENT_EMAIL", "support@example.com")
os.environ.setdefault("WEEKLY_SUMMARY_CRON_SECRET", "cron-test-secret")

from fastapi import HTTPException  # noqa: E402
from routers.ai_summaries import service  # noqa: E402


class _FakeDB:
    def __init__(self) -> None:
        self.commit_calls = 0

    def commit(self) -> None:
        self.commit_calls += 1


class _FakeSessionContext:
    def __init__(self, db: object) -> None:
        self._db = db

    def __enter__(self) -> object:
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class AIWeeklySummaryEmailDispatchServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.db = _FakeDB()

    def _session_local(self):
        return _FakeSessionContext(self.db)

    def test_dispatch_enqueues_one_household_job_for_targets(self) -> None:
        household_id = uuid4()
        user_id_1 = uuid4()
        user_id_2 = uuid4()
        dispatch_date = date(2026, 3, 16)

        targets = [
            SimpleNamespace(
                user_id=user_id_1,
                username="alex",
                email="alex@example.com",
                display_name="Alex",
                household_id=household_id,
                household_name="Example Home",
            ),
            SimpleNamespace(
                user_id=user_id_2,
                username="sam",
                email="sam@example.com",
                display_name="Sam",
                household_id=household_id,
                household_name="Example Home",
            ),
        ]

        captured_jobs = []

        def _capture_enqueue(db, jobs):
            self.assertIs(db, self.db)
            captured_jobs.extend(jobs)
            return 1

        with patch.object(service, "get_session_local", return_value=self._session_local):
            with patch.object(
                service,
                "list_weekly_summary_email_targets",
                return_value=targets,
            ) as targets_mock:
                with patch.object(service, "enqueue_email_jobs", side_effect=_capture_enqueue):
                    response = service.dispatch_weekly_summary_emails(
                        cron_secret="cron-test-secret",
                        dispatch_date=dispatch_date,
                    )

        self.assertEqual(response.dispatch_date, dispatch_date)
        self.assertEqual(response.first_day_of_week, "monday")
        self.assertEqual(response.week_start, date(2026, 3, 9))
        self.assertEqual(response.week_end, date(2026, 3, 16))
        self.assertEqual(response.users_targeted, 2)
        self.assertEqual(response.households_targeted, 1)
        self.assertEqual(response.jobs_enqueued, 1)
        self.assertEqual(response.jobs_skipped, 0)
        targets_mock.assert_called_once_with(self.db)
        self.assertEqual(self.db.commit_calls, 1)
        self.assertEqual(len(captured_jobs), 1)
        queued_job = captured_jobs[0]
        self.assertEqual(queued_job["job_type"], "weekly_summary_household")
        self.assertEqual(
            queued_job["idempotency_key"],
            f"weekly_summary_household:{household_id}:2026-03-09",
        )
        self.assertEqual(queued_job["payload"]["household_id"], str(household_id))
        self.assertEqual(len(queued_job["payload"]["recipients"]), 2)

    def test_dispatch_rejects_invalid_cron_secret(self) -> None:
        with self.assertRaises(HTTPException) as exc:
            service.dispatch_weekly_summary_emails(
                cron_secret="wrong-secret",
                dispatch_date=date(2026, 3, 16),
            )

        self.assertEqual(exc.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
