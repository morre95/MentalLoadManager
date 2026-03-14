from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
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

from models import UserEmail  # noqa: E402
from routers.household import service  # noqa: E402
from routers.household.schemas import InviteEmailRequest  # noqa: E402


class _FakeSessionContext:
    def __init__(self, db: "_FakeDB") -> None:
        self._db = db

    def __enter__(self) -> "_FakeDB":
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class _FakeDB:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.commit_calls = 0

    def add(self, obj) -> None:  # noqa: ANN001
        self.added.append(obj)

    def commit(self) -> None:
        self.commit_calls += 1


class HouseholdInviteEmailServiceTest(unittest.TestCase):
    def test_email_invite_creates_invite_and_queues_email(self) -> None:
        db = _FakeDB()
        household_id = uuid4()
        user_id = uuid4()
        current_user = UserEmail(
            username="alex",
            email="alex@example.com",
            display_name="Alex Example",
        )
        payload = InviteEmailRequest(
            household_id=household_id,
            email=" invited@example.com ",
        )

        db_user = SimpleNamespace(
            user_id=user_id,
            username="alex",
            display_name="Alex Example",
            email="alex@example.com",
        )
        household = SimpleNamespace(name="Example Home")
        mock_background_tasks = MagicMock()

        def _session_local():
            return _FakeSessionContext(db)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(service, "_get_db_user", return_value=db_user):
                with patch.object(service, "find_membership", return_value=object()):
                    with patch.object(service, "find_household_by_id", return_value=household):
                        result = service.email_invite(payload, current_user, mock_background_tasks)

        self.assertEqual(result.message, "Invite email queued")
        self.assertTrue(result.invite_url.startswith("http://localhost:5173/join?code="))
        self.assertEqual(db.commit_calls, 1)
        self.assertEqual(len(db.added), 1)
        mock_background_tasks.add_task.assert_called_once()
        call_kwargs = mock_background_tasks.add_task.call_args.kwargs
        self.assertEqual(call_kwargs["recipient_email"], "invited@example.com")
        self.assertEqual(call_kwargs["household_name"], "Example Home")
        self.assertEqual(call_kwargs["inviter_name"], "Alex Example")
        self.assertEqual(call_kwargs["inviter_email"], "alex@example.com")


if __name__ == "__main__":
    unittest.main()
