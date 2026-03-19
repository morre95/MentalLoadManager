from __future__ import annotations

import os
import sys
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import patch

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
from routers.mood_tracker.artwork_catalog import list_mood_tracker_artworks  # noqa: E402
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
        self.assertIn('data-region-id="week-region-1"', artwork.svg_markup)
        self.assertIn('data-region-id="week-region-7"', artwork.svg_markup)

    def test_monthly_artwork_matches_month_length(self) -> None:
        artwork = generate_procedural_mood_artwork(
            period_type="monthly",
            period_key="2026-02",
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
        )

        self.assertEqual(len(artwork.region_ids), 28)
        self.assertIn('data-region-id="month-region-28"', artwork.svg_markup)


class MoodTrackerServiceTests(unittest.TestCase):
    def test_static_catalog_contains_weekly_and_monthly_artworks(self) -> None:
        weekly = list_mood_tracker_artworks("weekly", 7)
        monthly = list_mood_tracker_artworks("monthly", 31)

        self.assertEqual([art.image_id for art in weekly], [
            "weekly-bloom",
            "weekly-butterfly",
            "weekly-cactus",
            "weekly-seaside",
        ])
        self.assertEqual([art.image_id for art in monthly], [
            "monthly-mosaic",
            "monthly-garden",
            "monthly-lanterns",
        ])

    def test_weekly_period_uses_cycled_static_artwork(self) -> None:
        fake_db = _FakeDB()
        fake_user = SimpleNamespace(user_id=uuid4())

        def _session_local():
            return _FakeSessionContext(fake_db)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(service, "list_mood_entries_for_date_range", return_value=[]):
                result = service.get_mood_tracker_period(
                    period_type="weekly",
                    anchor_date_raw="2026-03-11",
                    current_user=fake_user,
                )

        self.assertEqual(result.image_id, "weekly-cactus")
        self.assertEqual(result.artwork_source, "static")

    def test_get_period_returns_static_artwork_metadata(self) -> None:
        fake_db = _FakeDB()
        fake_user = SimpleNamespace(user_id=uuid4())

        def _session_local():
            return _FakeSessionContext(fake_db)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(service, "list_mood_entries_for_date_range", return_value=[]):
                result = service.get_mood_tracker_period(
                    period_type="weekly",
                    anchor_date_raw="2026-03-11",
                    current_user=fake_user,
                )

        self.assertEqual(result.image_id, "weekly-cactus")
        self.assertEqual(result.artwork_source, "static")
        self.assertEqual(result.region_ids, [
            "week-region-1",
            "week-region-2",
            "week-region-3",
            "week-region-4",
            "week-region-5",
            "week-region-6",
            "week-region-7",
        ])
        self.assertIsNone(result.svg_markup)


if __name__ == "__main__":
    unittest.main()
