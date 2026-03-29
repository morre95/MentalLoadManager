from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timezone
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

from app.v1.routers.goals import service
from app.v1.routers.goals.schemas import AchievementResponse


class GoalsPerformanceRegressionTests(unittest.TestCase):
    def test_apply_achievement_unlock_state_uses_prefetched_completion_keys(self) -> None:
        user_id = uuid4()
        existing_unlock = SimpleNamespace(
            achievement_id="a1",
            completion_key="a1:5",
            unlocked_at=datetime.now(timezone.utc),
        )
        achievements = [
            AchievementResponse(
                id="a1",
                title="Existing",
                description="",
                icon="star",
                current=5,
                target=5,
                category="Tasks",
                completion_key="a1:5",
            ),
            AchievementResponse(
                id="a2",
                title="New",
                description="",
                icon="star",
                current=2,
                target=2,
                category="Tasks",
                completion_key="a2:2",
            ),
        ]

        with (
            patch.object(
                service,
                "list_all_achievement_unlocks_for_user",
                return_value=[existing_unlock],
            ),
            patch.object(
                service,
                "create_achievement_unlock",
                side_effect=lambda *args, **kwargs: SimpleNamespace(
                    achievement_id=kwargs["achievement_id"],
                    completion_key=kwargs["completion_key"],
                    unlocked_at=datetime.now(timezone.utc),
                ),
            ) as create_unlock,
        ):
            enriched, timeline = service._apply_achievement_unlock_state(
                object(),
                user_id=user_id,
                achievements=achievements,
            )

        self.assertEqual(len(enriched), 2)
        self.assertEqual(len(timeline), 1)
        self.assertEqual(create_unlock.call_count, 1)
        self.assertEqual(create_unlock.call_args.kwargs["completion_key"], "a2:2")

    def test_sync_derived_goal_progress_reuses_count_cache(self) -> None:
        user_id = uuid4()
        progress_goal_a = SimpleNamespace(
            type="tasks",
            tracking_style="weekly",
            current_value=0,
            updated_at=None,
        )
        progress_goal_b = SimpleNamespace(
            type="tasks",
            tracking_style="weekly",
            current_value=0,
            updated_at=None,
        )
        count_cache: dict[tuple[datetime | None, datetime | None], int] = {}

        with (
            patch.object(
                service,
                "_close_goal_period_if_needed",
                side_effect=lambda db, goal, user_id, now: goal,
            ),
            patch.object(
                service,
                "_period_bounds_for_goal",
                return_value=(
                    "period-key",
                    datetime(2026, 3, 24, tzinfo=timezone.utc),
                    datetime(2026, 3, 31, tzinfo=timezone.utc),
                ),
            ),
            patch.object(
                service,
                "count_completed_personal_tasks_in_window",
                return_value=7,
            ) as counter,
        ):
            service._sync_derived_goal_progress_with_cache(
                SimpleNamespace(flush=lambda: None),
                progress_goal_a,
                user_id,
                count_cache=count_cache,
            )
            service._sync_derived_goal_progress_with_cache(
                SimpleNamespace(flush=lambda: None),
                progress_goal_b,
                user_id,
                count_cache=count_cache,
            )

        self.assertEqual(counter.call_count, 1)
        self.assertEqual(progress_goal_a.current_value, 7)
        self.assertEqual(progress_goal_b.current_value, 7)


if __name__ == "__main__":
    unittest.main()
