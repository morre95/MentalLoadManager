from __future__ import annotations

import os
import sys
import unittest
from datetime import date
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

from routers.ai_summaries import service  # noqa: E402
from app.v1.models import UserEmail  # noqa: E402


class _FakeSessionContext:
    def __init__(self, db: object) -> None:
        self._db = db

    def __enter__(self) -> object:
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class _FakeDB:
    def __init__(self) -> None:
        self.committed = False
        self.rolled_back = False
        self.refreshed: list[object] = []

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True

    def refresh(self, value: object) -> None:
        self.refreshed.append(value)


class _BackgroundTasksStub:
    def __init__(self) -> None:
        self.tasks: list[tuple[object, dict[str, object]]] = []

    def add_task(self, func, **kwargs) -> None:  # noqa: ANN001
        self.tasks.append((func, kwargs))


class AISummaryActionsServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.db = _FakeDB()
        self.user_id = uuid4()
        self.household_id = uuid4()
        self.summary_id = uuid4()
        self.current_user = UserEmail(
            username="alice",
            user_id=self.user_id,
            email="alice@example.com",
            display_name="Alice",
        )

    def _session_local(self):
        return _FakeSessionContext(self.db)

    def test_queue_weekly_summary_generation_preserves_requested_model(self) -> None:
        requested_model = "google/gemini-2.5-flash-lite"
        new_summary = SimpleNamespace(
            ai_summary_id=uuid4(),
            household_id=self.household_id,
            week_start=date(2026, 3, 16),
            week_end=date(2026, 3, 23),
            status="pending",
            model=requested_model,
            content="",
            prompt_hash=None,
            error=None,
        )
        background_tasks = _BackgroundTasksStub()
        payload = service.GenerateWeeklySummaryRequest(
            household_id=self.household_id,
            period_type="weekly",
            week_start=date(2026, 3, 16),
            model=requested_model,
        )

        with patch.object(
            service, "get_session_local", return_value=self._session_local
        ):
            with patch.object(
                service,
                "_validate_membership",
            ):
                with patch.object(
                    service,
                    "create_ai_summary",
                    return_value=new_summary,
                ) as create_mock:
                    response = service.queue_weekly_summary_generation(
                        payload,
                        self.current_user,
                        background_tasks,
                    )

        self.assertTrue(self.db.committed)
        self.assertEqual(self.db.refreshed, [new_summary])
        create_mock.assert_called_once_with(
            self.db,
            household_id=self.household_id,
            week_start=date(2026, 3, 16),
            week_end=date(2026, 3, 23),
            content="",
            model=requested_model,
            prompt_hash=None,
            status="pending",
            error=None,
        )
        self.assertEqual(len(background_tasks.tasks), 1)
        task_func, task_kwargs = background_tasks.tasks[0]
        self.assertIs(task_func, service._run_weekly_summary_generation_task)
        self.assertEqual(task_kwargs["ai_summary_id"], new_summary.ai_summary_id)
        self.assertEqual(task_kwargs["household_id"], self.household_id)
        self.assertEqual(task_kwargs["week_start"], date(2026, 3, 16))
        self.assertEqual(task_kwargs["period_type"], "weekly")
        self.assertEqual(task_kwargs["model"], requested_model)
        self.assertEqual(task_kwargs["username"], "alice")
        self.assertEqual(response.ai_summary_id, str(new_summary.ai_summary_id))
        self.assertEqual(response.model, requested_model)
        self.assertEqual(response.status, "pending")
        self.assertEqual(response.period_type, "weekly")

    def test_regenerate_weekly_summary_creates_new_pending_summary(self) -> None:
        existing_model = "google/gemini-2.5-flash-lite"
        existing_summary = SimpleNamespace(
            ai_summary_id=self.summary_id,
            household_id=self.household_id,
            week_start=date(2026, 3, 16),
            model=existing_model,
        )
        new_summary = SimpleNamespace(
            ai_summary_id=uuid4(),
            household_id=self.household_id,
            week_start=date(2026, 3, 16),
            week_end=date(2026, 3, 23),
            status="pending",
            model=existing_model,
            content="",
            prompt_hash=None,
            error=None,
        )
        background_tasks = _BackgroundTasksStub()

        with patch.object(
            service, "get_session_local", return_value=self._session_local
        ):
            with patch.object(
                service,
                "get_user_by_username",
                return_value=SimpleNamespace(user_id=self.user_id),
            ):
                with patch.object(
                    service,
                    "get_ai_summary",
                    return_value=existing_summary,
                ):
                    with patch.object(
                        service,
                        "has_household_membership",
                        return_value=True,
                    ):
                        with patch.object(
                            service,
                            "create_ai_summary",
                            return_value=new_summary,
                        ) as create_mock:
                            response = service.regenerate_weekly_summary(
                                self.summary_id,
                                self.current_user,
                                background_tasks,
                            )

        self.assertTrue(self.db.committed)
        self.assertEqual(self.db.refreshed, [new_summary])
        create_mock.assert_called_once_with(
            self.db,
            household_id=self.household_id,
            week_start=date(2026, 3, 16),
            week_end=date(2026, 3, 23),
            content="",
            model=existing_model,
            prompt_hash=None,
            status="pending",
            error=None,
        )
        self.assertEqual(len(background_tasks.tasks), 1)
        task_func, task_kwargs = background_tasks.tasks[0]
        self.assertIs(task_func, service._run_weekly_summary_generation_task)
        self.assertEqual(task_kwargs["ai_summary_id"], new_summary.ai_summary_id)
        self.assertEqual(task_kwargs["household_id"], self.household_id)
        self.assertEqual(task_kwargs["week_start"], date(2026, 3, 16))
        self.assertEqual(task_kwargs["period_type"], "weekly")
        self.assertEqual(task_kwargs["model"], existing_model)
        self.assertEqual(task_kwargs["username"], "alice")
        self.assertEqual(response.ai_summary_id, str(new_summary.ai_summary_id))
        self.assertEqual(response.model, existing_model)
        self.assertEqual(response.status, "pending")
        self.assertEqual(response.period_type, "weekly")

    def test_run_weekly_summary_generation_task_passes_model_to_generation(self) -> None:
        ai_summary = SimpleNamespace(
            week_end=None,
            content=None,
            model=None,
            prompt_hash=None,
            status="pending",
            error=None,
        )

        with patch.object(
            service, "get_session_local", return_value=self._session_local
        ):
            with patch.object(
                service,
                "_generate_summary_payload",
                return_value={
                    "week_start": date(2026, 3, 16),
                    "week_end": date(2026, 3, 23),
                    "summary_text": "Summary",
                    "model": "google/gemini-2.5-flash-lite",
                    "prompt_hash": "hash",
                },
            ) as generate_mock:
                with patch.object(
                    service,
                    "get_ai_summary",
                    return_value=ai_summary,
                ):
                    service._run_weekly_summary_generation_task(
                        ai_summary_id=self.summary_id,
                        household_id=self.household_id,
                        week_start=date(2026, 3, 16),
                        period_type="weekly",
                        model="google/gemini-2.5-flash-lite",
                        username="alice",
                    )

        request_payload = generate_mock.call_args.args[0]
        self.assertEqual(request_payload.household_id, self.household_id)
        self.assertEqual(request_payload.period_type, "weekly")
        self.assertEqual(request_payload.week_start, date(2026, 3, 16))
        self.assertEqual(request_payload.model, "google/gemini-2.5-flash-lite")
        self.assertTrue(self.db.committed)
        self.assertEqual(ai_summary.model, "google/gemini-2.5-flash-lite")

    def test_queue_monthly_summary_generation_uses_first_day_of_month(self) -> None:
        requested_model = "google/gemini-2.5-flash-lite"
        new_summary = SimpleNamespace(
            ai_summary_id=uuid4(),
            household_id=self.household_id,
            week_start=date(2026, 3, 1),
            week_end=date(2026, 4, 1),
            status="pending",
            model=requested_model,
            content="",
            prompt_hash=None,
            error=None,
        )
        background_tasks = _BackgroundTasksStub()
        payload = service.GenerateWeeklySummaryRequest(
            household_id=self.household_id,
            period_type="monthly",
            year=2026,
            month=3,
            model=requested_model,
        )

        with patch.object(
            service, "get_session_local", return_value=self._session_local
        ):
            with patch.object(service, "_validate_membership"):
                with patch.object(
                    service,
                    "create_ai_summary",
                    return_value=new_summary,
                ) as create_mock:
                    response = service.queue_weekly_summary_generation(
                        payload,
                        self.current_user,
                        background_tasks,
                    )

        create_mock.assert_called_once_with(
            self.db,
            household_id=self.household_id,
            week_start=date(2026, 3, 1),
            week_end=date(2026, 4, 1),
            content="",
            model=requested_model,
            prompt_hash=None,
            status="pending",
            error=None,
        )
        self.assertEqual(len(background_tasks.tasks), 1)
        _, task_kwargs = background_tasks.tasks[0]
        self.assertEqual(task_kwargs["week_start"], date(2026, 3, 1))
        self.assertEqual(task_kwargs["period_type"], "monthly")
        self.assertEqual(response.period_type, "monthly")

    def test_regenerate_weekly_summary_forbidden_for_non_member(self) -> None:
        existing_summary = SimpleNamespace(
            ai_summary_id=self.summary_id,
            household_id=self.household_id,
            week_start=date(2026, 3, 16),
        )

        with patch.object(
            service, "get_session_local", return_value=self._session_local
        ):
            with patch.object(
                service,
                "get_user_by_username",
                return_value=SimpleNamespace(user_id=self.user_id),
            ):
                with patch.object(
                    service,
                    "get_ai_summary",
                    return_value=existing_summary,
                ):
                    with patch.object(
                        service,
                        "has_household_membership",
                        return_value=False,
                    ):
                        with self.assertRaises(HTTPException) as exc:
                            service.regenerate_weekly_summary(
                                self.summary_id,
                                self.current_user,
                                _BackgroundTasksStub(),
                            )

        self.assertEqual(exc.exception.status_code, 403)

    def test_delete_summary_deletes_when_member(self) -> None:
        existing_summary = SimpleNamespace(
            ai_summary_id=self.summary_id,
            household_id=self.household_id,
        )

        with patch.object(
            service, "get_session_local", return_value=self._session_local
        ):
            with patch.object(
                service,
                "get_user_by_username",
                return_value=SimpleNamespace(user_id=self.user_id),
            ):
                with patch.object(
                    service,
                    "get_ai_summary",
                    return_value=existing_summary,
                ):
                    with patch.object(
                        service,
                        "has_household_membership",
                        return_value=True,
                    ):
                        with patch.object(
                            service,
                            "delete_ai_summary",
                        ) as delete_mock:
                            response = service.delete_summary(
                                self.summary_id,
                                self.current_user,
                            )

        self.assertTrue(self.db.committed)
        delete_mock.assert_called_once_with(self.db, existing_summary)
        self.assertEqual(response.ai_summary_id, str(self.summary_id))
        self.assertTrue(response.deleted)


if __name__ == "__main__":
    unittest.main()
