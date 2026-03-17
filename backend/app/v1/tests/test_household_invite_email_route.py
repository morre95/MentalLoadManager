from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

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

from helpers import get_current_user  # noqa: E402
from models import UserEmail  # noqa: E402
from routers.household.routes import router as household_router  # noqa: E402


class HouseholdInviteEmailRouteTest(unittest.TestCase):
    def test_post_invite_email_returns_service_response(self) -> None:
        app = FastAPI()
        app.include_router(household_router)
        app.dependency_overrides[get_current_user] = lambda: UserEmail(
            username="alex",
            email="alex@example.com",
            display_name="Alex Example",
        )

        household_id = str(uuid4())
        service_response = {
            "message": "Invite email sent successfully",
            "invite_url": "http://localhost:5173/join?code=test-code",
            "expires_at": "2026-03-21T12:00:00Z",
        }

        with patch(
            "routers.household.routes.email_invite",
            return_value=service_response,
        ) as email_invite_mock:
            client = TestClient(app)
            response = client.post(
                "/api/v1/household/invite/email",
                json={
                    "household_id": household_id,
                    "email": "invitee@example.com",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), service_response)
        email_invite_mock.assert_awaited_once()
        payload_arg = email_invite_mock.await_args.args[0]
        current_user_arg = email_invite_mock.await_args.args[1]
        self.assertEqual(str(payload_arg.household_id), household_id)
        self.assertEqual(payload_arg.email, "invitee@example.com")
        self.assertEqual(current_user_arg.username, "alex")


if __name__ == "__main__":
    unittest.main()
