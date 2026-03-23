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


class _FakeSessionContext:
    def __init__(self, db: object) -> None:
        self._db = db

    def __enter__(self) -> object:
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class AIWeeklySummaryEmailDispatchServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.db = object()

    def _session_local(self):
        return _FakeSessionContext(self.db)

    def test_dispatch_sends_emails_for_targets_and_reuses_household_summary(self) -> None:
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

        with patch.object(service, "get_session_local", return_value=self._session_local):
            with patch.object(
                service,
                "list_weekly_summary_email_targets",
                return_value=targets,
            ) as targets_mock:
                with patch.object(
                    service,
                    "_generate_summary_payload",
                    return_value={
                        "week_start": date(2026, 3, 9),
                        "week_end": date(2026, 3, 16),
                        "summary_text": "Neutral weekly summary.",
                        "model": "test-model",
                        "prompt_hash": "abc123",
                    },
                ) as summary_mock:
                    with patch.object(service, "_send_weekly_summary_email") as send_mock:
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
        self.assertEqual(response.emails_sent, 2)
        self.assertEqual(response.emails_failed, 0)
        self.assertEqual(response.summary_generation_failures, 0)
        targets_mock.assert_called_once_with(self.db)
        summary_mock.assert_called_once()
        send_mock.assert_called()
        self.assertEqual(send_mock.call_count, 2)

    def test_dispatch_rejects_invalid_cron_secret(self) -> None:
        with self.assertRaises(HTTPException) as exc:
            service.dispatch_weekly_summary_emails(
                cron_secret="wrong-secret",
                dispatch_date=date(2026, 3, 16),
            )

        self.assertEqual(exc.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
