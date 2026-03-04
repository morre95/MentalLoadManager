from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import UUID, uuid4

from starlette.requests import Request


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Required at import-time by backend/config.py -> Settings().
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

from models import PasswordRefreshToken, UserDB  # noqa: E402
from routers.login.schemas import RefreshTokenRequest  # noqa: E402
from routers.login import service  # noqa: E402


class _FakeSessionContext:
    def __init__(self, db: "_FakeDB") -> None:
        self._db = db

    def __enter__(self) -> "_FakeDB":
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class _FakeDB:
    def __init__(self, token_row: PasswordRefreshToken, user: UserDB) -> None:
        self._token_row = token_row
        self._user = user
        self._scalar_calls = 0
        self._pending_token_ids: set[UUID] = set()
        self.inserted_token_ids: set[UUID] = {token_row.token_id}
        self.flush_called = False
        self.commit_calls = 0

    def scalar(self, _query):  # noqa: ANN001
        self._scalar_calls += 1
        if self._scalar_calls == 1:
            return self._token_row
        if self._scalar_calls == 2:
            return self._user
        return None

    def add(self, obj):  # noqa: ANN001
        if isinstance(obj, PasswordRefreshToken):
            self._pending_token_ids.add(obj.token_id)

    def flush(self) -> None:
        self.flush_called = True
        self.inserted_token_ids.update(self._pending_token_ids)
        self._pending_token_ids.clear()

    def commit(self) -> None:
        self.commit_calls += 1
        # Simulate the FK constraint on replaced_by_token_id. This is the
        # behavior that used to fail before db.flush() was added.
        if (
            self._token_row.replaced_by_token_id is not None
            and self._token_row.replaced_by_token_id not in self.inserted_token_ids
        ):
            raise AssertionError(
                "FK regression: replaced_by_token_id references a row that is not inserted yet"
            )


class RefreshPasswordSessionRegressionTest(unittest.TestCase):
    def test_refresh_rotation_flushes_new_token_before_fk_link(self) -> None:
        user_id = uuid4()
        family_id = uuid4()
        old_token_id = uuid4()
        incoming_refresh_token = f"{old_token_id}.{'x' * 64}"
        now_utc = datetime.now(timezone.utc)

        token_row = PasswordRefreshToken(
            token_id=old_token_id,
            user_id=user_id,
            family_id=family_id,
            token_hash=service._refresh_token_hash(incoming_refresh_token),
            expires_at=now_utc + timedelta(days=1),
            created_ip="127.0.0.1",
            created_user_agent="test-agent",
        )
        user = UserDB(user_id=user_id, username="test-user", password=None, email=None)
        db = _FakeDB(token_row=token_row, user=user)

        def _session_local():
            return _FakeSessionContext(db)

        request = Request(
            {
                "type": "http",
                "asgi": {"version": "3.0", "spec_version": "2.3"},
                "http_version": "1.1",
                "scheme": "http",
                "method": "POST",
                "path": "/api/password/refresh",
                "raw_path": b"/api/password/refresh",
                "query_string": b"",
                "headers": [(b"user-agent", b"pytest-agent")],
                "client": ("127.0.0.1", 12345),
                "server": ("testserver", 80),
            }
        )
        payload = RefreshTokenRequest(refresh_token=incoming_refresh_token)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(service, "create_access_token", return_value="new-access"):
                result = service.refresh_password_session(payload=payload, request=request)

        self.assertEqual(result.access_token, "new-access")
        self.assertEqual(result.token_type, "bearer")
        self.assertTrue(result.refresh_token)
        self.assertTrue(db.flush_called)
        self.assertEqual(db.commit_calls, 1)
        self.assertIsNotNone(token_row.replaced_by_token_id)
        self.assertIn(token_row.replaced_by_token_id, db.inserted_token_ids)


if __name__ == "__main__":
    unittest.main()
