from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from starlette.requests import Request


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

from models import LoginAttempt, User  # noqa: E402
from routers.login import service  # noqa: E402


class _FakeSessionContext:
    def __init__(self, db: "_FakeDB") -> None:
        self._db = db

    def __enter__(self) -> "_FakeDB":
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class _FakeDB:
    def __init__(self, attempt: LoginAttempt | None = None) -> None:
        self.attempt = attempt
        self.commit_calls = 0
        self.added_attempts: list[LoginAttempt] = []
        self.refresh_token_rows: list[object] = []

    def scalar(self, _query):  # noqa: ANN001
        return self.attempt

    def add(self, obj):  # noqa: ANN001
        if isinstance(obj, LoginAttempt):
            self.attempt = obj
            self.added_attempts.append(obj)
            return
        self.refresh_token_rows.append(obj)

    def commit(self) -> None:
        self.commit_calls += 1


def _session_local_factory(db: _FakeDB):
    def _session_local():
        return _FakeSessionContext(db)

    return _session_local


def _build_request() -> Request:
    return Request(
        {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "scheme": "http",
            "method": "POST",
            "path": "/api/v1/password/login",
            "raw_path": b"/api/v1/password/login",
            "query_string": b"",
            "headers": [(b"user-agent", b"pytest-agent")],
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
        }
    )


class LoginLockoutTests(unittest.TestCase):
    def test_failed_logins_require_captcha_after_three_attempts(self) -> None:
        db = _FakeDB()
        request = _build_request()
        form = OAuth2PasswordRequestForm(username="user@example.com", password="bad")

        with patch.object(service, "get_session_local", return_value=_session_local_factory(db)):
            with patch.object(service, "authenticate_user", return_value=None):
                for _ in range(2):
                    with self.assertRaises(HTTPException) as exc_info:
                        service.login(form, request)
                    self.assertEqual(exc_info.exception.detail, "Invalid credentials")
                    self.assertNotIn("X-Captcha-Required", exc_info.exception.headers)

                with self.assertRaises(HTTPException) as exc_info:
                    service.login(form, request)

        self.assertEqual(exc_info.exception.detail, "Invalid credentials")
        self.assertEqual(exc_info.exception.headers.get("X-Captcha-Required"), "true")
        self.assertEqual(db.attempt.failed_attempts, 3)
        self.assertIsNone(db.attempt.locked_until)

    def test_fifth_failed_login_locks_account_for_fifteen_minutes(self) -> None:
        db = _FakeDB()
        request = _build_request()
        form = OAuth2PasswordRequestForm(username="user@example.com", password="bad")

        with patch.object(service, "get_session_local", return_value=_session_local_factory(db)):
            with patch.object(service, "authenticate_user", return_value=None):
                for _ in range(4):
                    with self.assertRaises(HTTPException):
                        service.login(form, request)

                with self.assertRaises(HTTPException) as exc_info:
                    service.login(form, request)

        self.assertEqual(exc_info.exception.detail, "Invalid credentials")
        self.assertEqual(exc_info.exception.headers.get("X-Captcha-Required"), "true")
        self.assertIsNotNone(db.attempt.locked_until)
        self.assertGreaterEqual(
            db.attempt.locked_until,
            datetime.now(timezone.utc) + timedelta(minutes=14, seconds=50),
        )
        self.assertIn("Retry-After", exc_info.exception.headers)

    def test_lockout_is_checked_before_authentication(self) -> None:
        locked_until = datetime.now(timezone.utc) + timedelta(minutes=10)
        db = _FakeDB(
            attempt=LoginAttempt(
                username_key="user@example.com",
                ip_address="127.0.0.1",
                failed_attempts=5,
                captcha_required=True,
                locked_until=locked_until,
            )
        )
        request = _build_request()
        form = OAuth2PasswordRequestForm(username="user@example.com", password="bad")

        with patch.object(service, "get_session_local", return_value=_session_local_factory(db)):
            with patch.object(service, "authenticate_user") as authenticate_user:
                with self.assertRaises(HTTPException) as exc_info:
                    service.login(form, request)

        authenticate_user.assert_not_called()
        self.assertEqual(exc_info.exception.detail, "Invalid credentials")
        self.assertEqual(exc_info.exception.headers.get("X-Captcha-Required"), "true")
        self.assertIn("Retry-After", exc_info.exception.headers)

    def test_successful_login_resets_failed_attempts(self) -> None:
        db = _FakeDB(
            attempt=LoginAttempt(
                username_key="user@example.com",
                ip_address="127.0.0.1",
                failed_attempts=4,
                captcha_required=True,
                first_failed_at=datetime.now(timezone.utc) - timedelta(minutes=5),
                last_failed_at=datetime.now(timezone.utc) - timedelta(minutes=1),
            )
        )
        request = _build_request()
        form = OAuth2PasswordRequestForm(username="user@example.com", password="good")
        user = User(username="user@example.com", user_id=uuid4())

        with patch.object(service, "get_session_local", return_value=_session_local_factory(db)):
            with patch.object(service, "authenticate_user", return_value=user):
                with patch.object(service, "create_access_token", return_value="access-token"):
                    token = service.login(form, request)

        self.assertEqual(token.access_token, "access-token")
        self.assertEqual(db.attempt.failed_attempts, 0)
        self.assertFalse(db.attempt.captcha_required)
        self.assertIsNone(db.attempt.locked_until)
        self.assertEqual(len(db.refresh_token_rows), 1)


if __name__ == "__main__":
    unittest.main()
