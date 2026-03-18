from __future__ import annotations

import os
import sys
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


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

from routers.ai_summaries.routes import router as ai_router  # noqa: E402


class AIWeeklySummaryEmailDispatchRouteTest(unittest.TestCase):
    def test_post_email_dispatch_returns_service_response(self) -> None:
        app = FastAPI()
        app.include_router(ai_router)

        service_response = {
            "dispatch_date": "2026-03-16",
            "first_day_of_week": "monday",
            "week_start": "2026-03-09",
            "week_end": "2026-03-16",
            "users_targeted": 2,
            "households_targeted": 1,
            "emails_sent": 2,
            "emails_failed": 0,
            "summary_generation_failures": 0,
        }

        with patch(
            "routers.ai_summaries.routes.dispatch_weekly_summary_emails",
            return_value=service_response,
        ) as dispatch_mock:
            client = TestClient(app)
            response = client.post(
                "/api/v1/ai/weekly-summary/email-dispatch?dispatch_date=2026-03-16",
                headers={"X-Cron-Secret": "cron-test-secret"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), service_response)
        dispatch_mock.assert_called_once_with(
            cron_secret="cron-test-secret",
            dispatch_date=date(2026, 3, 16),
        )


if __name__ == "__main__":
    unittest.main()
