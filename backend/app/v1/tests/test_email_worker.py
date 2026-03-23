from __future__ import annotations

import os
import sys
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4


BACKEND_DIR = Path(__file__).resolve().parents[3]
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

from app.v1.email_worker import process_email_job  # noqa: E402


class EmailWorkerTests(unittest.TestCase):
    def test_process_weekly_summary_household_job_returns_remaining_recipients_on_partial_send_failure(
        self,
    ) -> None:
        job = SimpleNamespace(
            job_type="weekly_summary_household",
            payload={
                "household_id": str(uuid4()),
                "household_name": "Example Home",
                "username": "alex",
                "week_start": "2026-03-09",
                "recipients": [
                    {
                        "user_id": str(uuid4()),
                        "email": "alex@example.com",
                        "recipient_name": "Alex",
                    },
                    {
                        "user_id": str(uuid4()),
                        "email": "sam@example.com",
                        "recipient_name": "Sam",
                    },
                ],
            },
        )

        import app.v1.email_worker as worker

        def _generate_summary_payload(*args, **kwargs):
            return {
                "week_start": date(2026, 3, 9),
                "week_end": date(2026, 3, 16),
                "summary_text": "Neutral weekly summary.",
            }

        calls: list[str] = []

        def _send_email(**kwargs):
            calls.append(kwargs["recipient_email"])
            if kwargs["recipient_email"] == "sam@example.com":
                raise RuntimeError("Resend failure")

        original_generate = worker._generate_summary_payload
        original_send = worker._send_weekly_summary_email
        worker._generate_summary_payload = _generate_summary_payload
        worker._send_weekly_summary_email = _send_email
        try:
            succeeded, next_payload, last_error = process_email_job(job)
        finally:
            worker._generate_summary_payload = original_generate
            worker._send_weekly_summary_email = original_send

        self.assertFalse(succeeded)
        self.assertEqual(calls, ["alex@example.com", "sam@example.com"])
        self.assertIsNotNone(next_payload)
        self.assertEqual(len(next_payload["recipients"]), 1)
        self.assertEqual(next_payload["recipients"][0]["email"], "sam@example.com")
        self.assertIn("sam@example.com", last_error or "")


if __name__ == "__main__":
    unittest.main()
