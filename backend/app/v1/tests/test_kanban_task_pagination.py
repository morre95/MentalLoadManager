from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
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
os.environ.setdefault("INSTAGRAM_CLIENT_SECRET", "test-facebook-client-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/test_db")
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_MODEL", "test-model")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS", "test-fallback")
os.environ.setdefault("RESEND_API_KEY", "test-resend-key")
os.environ.setdefault("CONTACT_RECIPIENT_EMAIL", "contact@example.com")

from models import UserEmail  # noqa: E402
from routers.kanban import service  # noqa: E402


class _FakeSessionContext:
    def __init__(self, db: object) -> None:
        self._db = db

    def __enter__(self) -> object:
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class KanbanTaskPaginationTest(unittest.TestCase):
    def test_list_kanban_tasks_returns_pagination_metadata(self) -> None:
        db = object()
        current_user = UserEmail(
            username="alice",
            user_id=uuid4(),
            email="alice@example.com",
            display_name="Alice",
        )
        household_id = uuid4()
        db_user = SimpleNamespace(user_id=current_user.user_id)
        task_row = SimpleNamespace(
            task_id=uuid4(),
            household_id=household_id,
            name="Buy milk",
            description="2 liters",
            status="todo",
            priority="medium",
            due_date=None,
            recurrence_enabled=False,
            recurrence_frequency=None,
            recurrence_interval=None,
            assignee_user_id=None,
            assignee_name=None,
            category_name="Shopping",
        )

        with patch.object(service, "get_session_local", return_value=lambda: _FakeSessionContext(db)):
            with patch.object(service, "_get_me", return_value=db_user):
                with patch.object(service, "_require_membership") as require_membership_mock:
                    with patch.object(service, "count_tasks_for_member", return_value=73) as count_mock:
                        with patch.object(service, "list_tasks_for_member", return_value=[task_row]) as list_mock:
                            result = service.list_kanban_tasks(household_id, 50, 25, current_user)

        require_membership_mock.assert_called_once_with(
            db,
            db_user.user_id,
            household_id,
            "User is not a member of the specified household",
        )
        count_mock.assert_called_once_with(db, db_user.user_id, household_id)
        list_mock.assert_called_once_with(
            db,
            db_user.user_id,
            household_id,
            limit=50,
            offset=25,
        )
        self.assertEqual(result.total, 73)
        self.assertEqual(result.limit, 50)
        self.assertEqual(result.offset, 25)
        self.assertEqual(len(result.tasks), 1)


if __name__ == "__main__":
    unittest.main()
