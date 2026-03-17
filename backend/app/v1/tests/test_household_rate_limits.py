from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware


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
from limiter import limiter  # noqa: E402
from models import UserEmail  # noqa: E402
from routers.household.routes import router as household_router  # noqa: E402


def _build_test_app() -> FastAPI:
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(household_router)
    app.dependency_overrides[get_current_user] = lambda: UserEmail(
        username="alex",
        email="alex@example.com",
        display_name="Alex Example",
    )
    return app


class HouseholdRateLimitTest(unittest.TestCase):
    def test_create_invite_rate_limit_returns_429(self) -> None:
        app = _build_test_app()
        client = TestClient(app)
        household_id = str(uuid4())

        with patch(
            "routers.household.routes.create_invite",
            return_value={
                "code": "test-code",
                "invite_url": "http://localhost:5173/join?code=test-code",
                "expires_at": "2026-03-21T12:00:00Z",
            },
        ):
            for _ in range(5):
                response = client.post("/api/v1/household/invite", json={"household_id": household_id})
                self.assertEqual(response.status_code, 200)

            response = client.post("/api/v1/household/invite", json={"household_id": household_id})
            self.assertEqual(response.status_code, 429)

    def test_email_invite_rate_limit_returns_429(self) -> None:
        app = _build_test_app()
        client = TestClient(app)
        household_id = str(uuid4())

        with patch(
            "routers.household.routes.email_invite",
            return_value={
                "message": "Invite email queued",
                "invite_url": "http://localhost:5173/join?code=test-code",
                "expires_at": "2026-03-21T12:00:00Z",
            },
        ):
            for attempt in range(10):
                response = client.post(
                    "/api/v1/household/invite/email",
                    json={
                        "household_id": household_id,
                        "email": f"invitee{attempt}@example.com",
                    },
                )
                self.assertEqual(response.status_code, 200)

            response = client.post(
                "/api/v1/household/invite/email",
                json={
                    "household_id": household_id,
                    "email": "overflow@example.com",
                },
            )
            self.assertEqual(response.status_code, 429)

    def test_create_household_rate_limit_returns_429(self) -> None:
        app = _build_test_app()
        client = TestClient(app)

        with patch(
            "routers.household.routes.create_household",
            side_effect=lambda payload, _current_user: {
                "household_id": str(uuid4()),
                "name": payload.name,
            },
        ):
            for attempt in range(5):
                response = client.post("/api/v1/household", json={"name": f"Home {attempt}"})
                self.assertEqual(response.status_code, 201)

            response = client.post("/api/v1/household", json={"name": "Overflow Home"})
            self.assertEqual(response.status_code, 429)


if __name__ == "__main__":
    unittest.main()
