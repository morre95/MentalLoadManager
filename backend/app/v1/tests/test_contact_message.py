from __future__ import annotations

import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
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

from routers.contact.schemas import SendMessageRequest  # noqa: E402
from routers.contact import service  # noqa: E402


class _FakeSessionContext:
    def __init__(self, db: "_FakeDB") -> None:
        self._db = db

    def __enter__(self) -> "_FakeDB":
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class _FakeContactMessage:
    def __init__(self, *, name: str, email: str, message: str, user_id) -> None:  # noqa: ANN001
        self.name = name
        self.email = email
        self.message = message
        self.user_id = user_id


class _FakeDB:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.commit_calls = 0
        self.refresh_calls = 0

    def add(self, obj) -> None:  # noqa: ANN001
        self.added.append(obj)

    def commit(self) -> None:
        self.commit_calls += 1

    def rollback(self) -> None:
        return None

    def refresh(self, _obj) -> None:  # noqa: ANN001
        self.refresh_calls += 1


class ContactMessageServiceTest(unittest.TestCase):
    def test_send_message_stores_record_and_sends_email(self) -> None:
        db = _FakeDB()
        payload = SendMessageRequest(
            name=" Jane Doe ",
            email=" jane@example.com ",
            message=" Hello from the contact form. ",
        )
        user_id = uuid4()
        created_record = _FakeContactMessage(
            name="Jane Doe",
            email="jane@example.com",
            message="Hello from the contact form.",
            user_id=user_id,
        )

        def _session_local():
            return _FakeSessionContext(db)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(
                service,
                "save_contact_message",
                return_value=created_record,
            ) as save_mock:
                with patch.object(
                    service,
                    "_send_contact_email",
                    new=AsyncMock(),
                ) as send_mock:
                    result = asyncio.run(service.send_message(payload, user_id))

        self.assertEqual(result["message"], "Message sent successfully")
        self.assertEqual(db.commit_calls, 1)
        self.assertEqual(db.refresh_calls, 1)
        save_mock.assert_called_once_with(
            db,
            name="Jane Doe",
            email="jane@example.com",
            message="Hello from the contact form.",
            user_id=user_id,
        )
        send_mock.assert_awaited_once_with(
            name="Jane Doe",
            email="jane@example.com",
            message="Hello from the contact form.",
            user_id=user_id,
        )


if __name__ == "__main__":
    unittest.main()
