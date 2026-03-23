from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

from sqlalchemy.dialects import postgresql


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

from routers.ai_summaries.repository import list_weekly_summary_email_targets  # noqa: E402


class _CaptureResult:
    def all(self):
        return []


class _CaptureSession:
    def __init__(self) -> None:
        self.statement = None

    def execute(self, statement):
        self.statement = statement
        return _CaptureResult()


class AIWeeklySummaryEmailTargetsQueryTest(unittest.TestCase):
    def test_query_filters_on_weekly_analytics_email_without_calendar_preference_gate(
        self,
    ) -> None:
        db = _CaptureSession()

        list_weekly_summary_email_targets(db)

        compiled = str(
            db.statement.compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )

        self.assertIn("notification_settings.weekly_analytics_email IS true", compiled)
        self.assertNotIn("notification_settings.email_notifications", compiled)
        self.assertNotIn("preferences.first_day_of_week", compiled)


if __name__ == "__main__":
    unittest.main()
