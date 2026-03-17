from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
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

from routers.kanban import service  # noqa: E402


class _FakeDB:
    def __init__(self) -> None:
        self.added: list[object] = []

    def add(self, obj) -> None:  # noqa: ANN001
        self.added.append(obj)


class KanbanRecurringTaskTest(unittest.TestCase):
    def test_calculate_next_due_date_handles_end_of_month(self) -> None:
        due_date = datetime(2026, 1, 31, 9, 0, tzinfo=timezone.utc)

        next_due_date = service._calculate_next_due_date(due_date, "monthly", 1)

        self.assertEqual(
            next_due_date,
            datetime(2026, 2, 28, 9, 0, tzinfo=timezone.utc),
        )

    def test_spawn_next_recurring_task_clones_template_once(self) -> None:
        db = _FakeDB()
        now_utc = datetime(2026, 3, 16, 12, 0, tzinfo=timezone.utc)
        due_date = datetime(2026, 3, 20, 8, 30, tzinfo=timezone.utc)
        task = SimpleNamespace(
            task_id=uuid4(),
            household_id=uuid4(),
            name="Take out trash",
            description="Bins on the curb",
            status="done",
            priority="medium",
            due_date=due_date,
            recurrence_enabled=True,
            recurrence_frequency="weekly",
            recurrence_interval=1,
            category_id=uuid4(),
            assigns_to=uuid4(),
            created_by=uuid4(),
        )

        service._maybe_spawn_next_recurring_task(db, task, now_utc)

        self.assertEqual(len(db.added), 1)
        next_task = db.added[0]
        self.assertEqual(next_task.name, task.name)
        self.assertEqual(next_task.status, "todo")
        self.assertEqual(next_task.recurrence_parent_task_id, task.task_id)
        self.assertEqual(
            next_task.due_date,
            datetime(2026, 3, 27, 8, 30, tzinfo=timezone.utc),
        )

    def test_spawn_next_recurring_task_skips_when_child_exists(self) -> None:
        db = _FakeDB()
        task = SimpleNamespace(
            task_id=uuid4(),
            household_id=uuid4(),
            name="Water plants",
            description=None,
            status="done",
            priority="low",
            due_date=datetime(2026, 3, 16, 9, 0, tzinfo=timezone.utc),
            recurrence_enabled=True,
            recurrence_frequency="daily",
            recurrence_interval=1,
            category_id=None,
            assigns_to=None,
            created_by=uuid4(),
        )

        original_lookup = service.get_generated_recurring_child
        try:
            service.get_generated_recurring_child = lambda _db, _task_id: object()
            service._maybe_spawn_next_recurring_task(
                db,
                task,
                datetime(2026, 3, 16, 12, 0, tzinfo=timezone.utc),
            )
        finally:
            service.get_generated_recurring_child = original_lookup

        self.assertEqual(db.added, [])


if __name__ == "__main__":
    unittest.main()
