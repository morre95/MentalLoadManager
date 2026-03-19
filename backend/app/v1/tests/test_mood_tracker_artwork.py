from __future__ import annotations

import os
import sys
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import patch

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

from routers.mood_tracker.artwork_generator import generate_procedural_mood_artwork  # noqa: E402
from routers.mood_tracker import service  # noqa: E402


class _FakeSessionContext:
    def __init__(self, db) -> None:  # noqa: ANN001
        self._db = db

    def __enter__(self):  # noqa: ANN001
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class _FakeDB:
    def __init__(self) -> None:
        self.commit_calls = 0

    def commit(self) -> None:
        self.commit_calls += 1

    def rollback(self) -> None:
        return None


class MoodTrackerArtworkGeneratorTests(unittest.TestCase):
    def test_weekly_artwork_has_exactly_seven_regions(self) -> None:
        artwork = generate_procedural_mood_artwork(
            period_type="weekly",
            period_key="2026-W11",
            start_date=date(2026, 3, 9),
            end_date=date(2026, 3, 15),
        )

        self.assertEqual(len(artwork.region_ids), 7)
        self.assertEqual(artwork.image_id, "weekly-seaside")
        self.assertEqual(artwork.source, "procedural")
        self.assertEqual(artwork.svg_markup, "")
        self.assertEqual(artwork.region_ids[0], "week-region-1")
        self.assertEqual(artwork.region_ids[-1], "week-region-7")

    def test_monthly_artwork_matches_month_length(self) -> None:
        artwork = generate_procedural_mood_artwork(
            period_type="monthly",
            period_key="2026-02",
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
        )

        self.assertEqual(len(artwork.region_ids), 28)
        self.assertEqual(artwork.image_id, "monthly-lanterns")
        self.assertEqual(artwork.source, "procedural")
        self.assertEqual(artwork.svg_markup, "")
        self.assertEqual(artwork.region_ids[-1], "month-region-28")


class MoodTrackerServiceTests(unittest.TestCase):
    def test_weekly_period_uses_cycled_database_artwork(self) -> None:
        fake_db = _FakeDB()
        fake_user = SimpleNamespace(user_id=uuid4())
        weekly_artworks = [
            SimpleNamespace(
                image_id="shared-weekly-art-1",
                source="file",
                svg_markup="<svg><rect data-region-id='week-region-1' /></svg>",
                region_ids=["week-region-1"],
                cycle_order=1,
            ),
            SimpleNamespace(
                image_id="shared-weekly-art-2",
                source="file",
                svg_markup="<svg><rect data-region-id='week-region-1' /></svg>",
                region_ids=["week-region-1"],
                cycle_order=2,
            ),
        ]

        def _session_local():
            return _FakeSessionContext(fake_db)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(
                service,
                "list_file_mood_tracker_artworks_by_type",
                return_value=weekly_artworks,
            ) as artwork_lookup:
                with patch.object(service, "list_mood_entries_for_date_range", return_value=[]):
                    result = service.get_mood_tracker_period(
                        period_type="weekly",
                        anchor_date_raw="2026-03-11",
                        current_user=fake_user,
                    )

        self.assertEqual(result.image_id, "shared-weekly-art-2")
        _, kwargs = artwork_lookup.call_args
        self.assertEqual(kwargs["period_type"], "weekly")
        self.assertEqual(kwargs["day_count"], 7)

    def test_monthly_period_cycles_within_same_day_count_group(self) -> None:
        fake_db = _FakeDB()
        fake_user = SimpleNamespace(user_id=uuid4())
        monthly_31_artworks = [
            SimpleNamespace(
                image_id="monthly-31-art-1",
                source="file",
                svg_markup="<svg><rect data-region-id='month-region-1' /></svg>",
                region_ids=["month-region-1"],
            ),
            SimpleNamespace(
                image_id="monthly-31-art-2",
                source="file",
                svg_markup="<svg><rect data-region-id='month-region-1' /></svg>",
                region_ids=["month-region-1"],
            ),
        ]

        def _session_local():
            return _FakeSessionContext(fake_db)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(
                service,
                "list_file_mood_tracker_artworks_by_type",
                return_value=monthly_31_artworks,
            ) as artwork_lookup:
                with patch.object(service, "list_mood_entries_for_date_range", return_value=[]):
                    january_result = service.get_mood_tracker_period(
                        period_type="monthly",
                        anchor_date_raw="2026-01-15",
                        current_user=fake_user,
                    )
                    march_result = service.get_mood_tracker_period(
                        period_type="monthly",
                        anchor_date_raw="2026-03-15",
                        current_user=fake_user,
                    )

        self.assertEqual(january_result.image_id, "monthly-31-art-1")
        self.assertEqual(march_result.image_id, "monthly-31-art-2")
        self.assertEqual(artwork_lookup.call_args_list[0].kwargs["day_count"], 31)
        self.assertEqual(artwork_lookup.call_args_list[1].kwargs["day_count"], 31)

    def test_get_period_returns_file_svg_markup(self) -> None:
        fake_db = _FakeDB()
        fake_user = SimpleNamespace(user_id=uuid4())
        fake_artwork = SimpleNamespace(
            image_id="weekly-orbit",
            source="file",
            svg_markup="<svg><rect data-region-id='week-region-1' /></svg>",
            region_ids=["week-region-1"],
        )

        def _session_local():
            return _FakeSessionContext(fake_db)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(
                service,
                "list_file_mood_tracker_artworks_by_type",
                return_value=[fake_artwork],
            ):
                with patch.object(service, "list_mood_entries_for_date_range", return_value=[]):
                    result = service.get_mood_tracker_period(
                        period_type="weekly",
                        anchor_date_raw="2026-03-11",
                        current_user=fake_user,
                    )

        self.assertEqual(result.image_id, "weekly-orbit")
        self.assertEqual(result.artwork_source, "file")
        self.assertEqual(result.region_ids, ["week-region-1"])
        self.assertEqual(result.svg_markup, "<svg><rect data-region-id='week-region-1' /></svg>")

    def test_get_period_raises_when_no_file_artworks_exist_for_period_type(self) -> None:
        fake_db = _FakeDB()
        fake_user = SimpleNamespace(user_id=uuid4())

        def _session_local():
            return _FakeSessionContext(fake_db)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(
                service,
                "list_file_mood_tracker_artworks_by_type",
                return_value=[],
            ):
                with self.assertRaises(HTTPException) as ctx:
                    service.get_mood_tracker_period(
                        period_type="weekly",
                        anchor_date_raw="2026-03-11",
                        current_user=fake_user,
                    )

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertEqual(
            ctx.exception.detail,
            "No weekly mood tracker artworks are configured for 7 days",
        )


if __name__ == "__main__":
    unittest.main()
