from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException


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

from routers.analytics import service  # noqa: E402
from routers.analytics.schemas import AnalyticsAIInsightsRequest, AnalyticsAskRequest  # noqa: E402
from app.v1.models import UserEmail  # noqa: E402


class _FakeSessionContext:
    def __init__(self, db: object) -> None:
        self._db = db

    def __enter__(self) -> object:
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class AnalyticsAuthorizationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = object()
        self.user_id = uuid4()
        self.household_id = uuid4()
        self.current_user = UserEmail(
            username="alice",
            user_id=self.user_id,
            email="alice@example.com",
            display_name="Alice",
        )

    def _session_local(self):
        return _FakeSessionContext(self.db)

    def test_summary_forbidden_for_non_member_household(self) -> None:
        with patch.object(service, "get_session_local", return_value=self._session_local):
            with patch.object(
                service,
                "_get_db_user",
                return_value=SimpleNamespace(user_id=self.user_id),
            ):
                with patch.object(service, "has_membership", return_value=False) as membership_mock:
                    with self.assertRaises(HTTPException) as exc:
                        service.get_analytics_summary(
                            self.household_id,
                            "30d",
                            self.current_user,
                        )

        self.assertEqual(exc.exception.status_code, 403)
        membership_mock.assert_called_once_with(self.db, self.user_id, self.household_id)

    def test_ai_insights_forbidden_for_non_member_household(self) -> None:
        payload = AnalyticsAIInsightsRequest(
            household_id=self.household_id,
            timeframe="30d",
            refresh=False,
        )

        with patch.object(service, "get_session_local", return_value=self._session_local):
            with patch.object(
                service,
                "_get_db_user",
                return_value=SimpleNamespace(user_id=self.user_id),
            ):
                with patch.object(service, "has_membership", return_value=False) as membership_mock:
                    with self.assertRaises(HTTPException) as exc:
                        service.get_analytics_ai_insights(payload, self.current_user)

        self.assertEqual(exc.exception.status_code, 403)
        membership_mock.assert_called_once_with(self.db, self.user_id, self.household_id)

    def test_ask_forbidden_for_non_member_household(self) -> None:
        payload = AnalyticsAskRequest(
            household_id=self.household_id,
            timeframe="30d",
            question="Who is overloaded?",
            refresh=False,
        )

        with patch.object(service, "get_session_local", return_value=self._session_local):
            with patch.object(
                service,
                "_get_db_user",
                return_value=SimpleNamespace(user_id=self.user_id),
            ):
                with patch.object(service, "has_membership", return_value=False) as membership_mock:
                    with self.assertRaises(HTTPException) as exc:
                        service.get_analytics_ask_answer(payload, self.current_user)

        self.assertEqual(exc.exception.status_code, 403)
        membership_mock.assert_called_once_with(self.db, self.user_id, self.household_id)


if __name__ == "__main__":
    unittest.main()
