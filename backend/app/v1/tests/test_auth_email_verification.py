from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
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
os.environ.setdefault("INSTAGRAM_CLIENT_SECRET", "test-instagram-client-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/test_db")
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_MODEL", "test-model")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS", "test-fallback")
os.environ.setdefault("RESEND_API_KEY", "test-resend-key")
os.environ.setdefault("CONTACT_RECIPIENT_EMAIL", "contact@example.com")

from routers.login import service as login_service  # noqa: E402
from routers.users import service as users_service  # noqa: E402
from routers.users.schemas import (  # noqa: E402
    RegisterUserRequest,
    VerifyEmailCodeRequest,
)


class _FakeSessionContext:
    def __init__(self, db) -> None:  # noqa: ANN001
        self._db = db

    def __enter__(self):  # noqa: ANN001
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class _FakeDB:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.commit_calls = 0
        self.flush_calls = 0
        self.refresh_calls = 0
        self.rollback_calls = 0

    def add(self, obj) -> None:  # noqa: ANN001
        self.added.append(obj)

    def commit(self) -> None:
        self.commit_calls += 1

    def flush(self) -> None:
        self.flush_calls += 1

    def refresh(self, _obj) -> None:  # noqa: ANN001
        self.refresh_calls += 1

    def rollback(self) -> None:
        self.rollback_calls += 1


class AuthEmailVerificationTests(unittest.TestCase):
    def test_register_user_issues_verification_email(self) -> None:
        db = _FakeDB()
        user = SimpleNamespace(
            user_id=uuid4(),
            username="alice",
            email="alice@example.com",
            display_name="Alice",
            email_verified_at=None,
        )
        created_tokens: list[dict[str, object]] = []

        def _session_local():
            return _FakeSessionContext(db)

        payload = RegisterUserRequest(
            username="alice",
            password="password123",
            email="Alice@example.com",
            display_name="Alice",
        )

        with patch.object(users_service, "get_session_local", return_value=_session_local):
            with patch.object(users_service, "find_existing_user", return_value=None):
                with patch.object(users_service, "create_user", return_value=user):
                    with patch.object(
                        users_service,
                        "delete_active_email_verification_tokens",
                    ) as delete_tokens:
                        with patch.object(
                            users_service,
                            "create_email_verification_token",
                            side_effect=lambda db, **kwargs: created_tokens.append(kwargs),
                        ):
                            with patch.object(
                                users_service,
                                "_send_verification_email",
                            ) as send_email:
                                result = users_service.register_user(payload)

        self.assertEqual(result.username, "alice")
        self.assertTrue(result.email_verification_required)
        self.assertEqual(result.message, "Verify your email before logging in")
        delete_tokens.assert_called_once_with(
            db,
            user_id=user.user_id,
            email="alice@example.com",
        )
        self.assertEqual(len(created_tokens), 1)
        self.assertEqual(created_tokens[0]["email"], "alice@example.com")
        self.assertEqual(db.commit_calls, 1)
        self.assertEqual(db.refresh_calls, 1)
        send_email.assert_called_once()

    def test_verify_email_code_marks_user_verified(self) -> None:
        db = _FakeDB()
        token_row = SimpleNamespace(
            user_id=uuid4(),
            email="alice@example.com",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            consumed_at=None,
        )
        user = SimpleNamespace(
            user_id=token_row.user_id,
            email="alice@example.com",
            email_verified_at=None,
        )

        def _session_local():
            return _FakeSessionContext(db)

        payload = VerifyEmailCodeRequest(
            email="alice@example.com",
            code="123456",
        )

        with patch.object(users_service, "get_session_local", return_value=_session_local):
            with patch.object(
                users_service,
                "find_email_verification_token_by_code_hash",
                return_value=token_row,
            ):
                with patch.object(users_service, "find_user_by_id", return_value=user):
                    result = users_service.verify_email_code(payload)

        self.assertEqual(result.message, "Email verified successfully")
        self.assertIsNotNone(token_row.consumed_at)
        self.assertIsNotNone(user.email_verified_at)
        self.assertEqual(db.commit_calls, 1)

    def test_oauth_verified_email_links_existing_user(self) -> None:
        db = _FakeDB()
        user = SimpleNamespace(
            user_id=uuid4(),
            username="alice",
            email="alice@example.com",
            display_name=None,
            email_verified_at=None,
            last_login=None,
        )

        def _session_local():
            return _FakeSessionContext(db)

        with patch.object(login_service, "get_session_local", return_value=_session_local):
            with patch.object(
                login_service,
                "get_oauth_account_by_provider_user_id",
                return_value=None,
            ):
                with patch.object(login_service, "find_user", return_value=user):
                    username = login_service._resolve_oauth_user(
                        provider="google",
                        provider_user_id="provider-123",
                        email="alice@example.com",
                        email_verified=True,
                        display_name="Alice",
                    )

        self.assertEqual(username, "alice")
        self.assertEqual(user.display_name, "Alice")
        self.assertIsNotNone(user.email_verified_at)
        self.assertEqual(db.commit_calls, 1)
        self.assertEqual(len(db.added), 1)

    def test_oauth_unverified_email_is_rejected_without_existing_link(self) -> None:
        db = _FakeDB()

        def _session_local():
            return _FakeSessionContext(db)

        with patch.object(login_service, "get_session_local", return_value=_session_local):
            with patch.object(
                login_service,
                "get_oauth_account_by_provider_user_id",
                return_value=None,
            ):
                with patch.object(login_service, "find_user", return_value=None):
                    with self.assertRaises(HTTPException) as exc_info:
                        login_service._resolve_oauth_user(
                            provider="facebook",
                            provider_user_id="provider-123",
                            email="alice@example.com",
                            email_verified=False,
                            display_name="Alice",
                        )

        self.assertEqual(exc_info.exception.status_code, 409)
        self.assertEqual(
            exc_info.exception.detail,
            "Provider email must be verified before it can be linked",
        )


if __name__ == "__main__":
    unittest.main()
