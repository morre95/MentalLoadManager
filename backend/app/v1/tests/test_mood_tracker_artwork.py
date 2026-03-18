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


class _DetachableArtwork:
    def __init__(
        self,
        *,
        user_id,
        period_type: str,
        period_key: str,
        start_date: date,
        end_date: date,
    ) -> None:
        self._attached = True
        self.user_id = user_id
        self.period_type = period_type
        self.period_key = period_key
        self.start_date = start_date
        self.end_date = end_date
        self.status = "pending"
        self.error = None
        self.updated_at = None

    def detach(self) -> None:
        self._attached = False

    def __getattribute__(self, name: str):  # noqa: ANN204
        tracked_fields = {"user_id", "period_type", "period_key", "start_date", "end_date"}
        if name in tracked_fields and not object.__getattribute__(self, "_attached"):
            raise RuntimeError(f"Detached artwork attribute access: {name}")
        return object.__getattribute__(self, name)


class _DetachingSessionContext:
    def __init__(self, db, artwork) -> None:  # noqa: ANN001
        self._db = db
        self._artwork = artwork

    def __enter__(self):  # noqa: ANN001
        return self._db

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        self._artwork.detach()
        return False


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
    def test_shared_period_artwork_lookup_ignores_current_user(self) -> None:
        fake_db = _FakeDB()
        fake_user = SimpleNamespace(user_id=uuid4())
        shared_artwork = SimpleNamespace(
            user_id=uuid4(),
            image_id="shared-weekly-art",
            source="procedural",
            svg_markup="<svg><rect data-region-id='week-region-1' /></svg>",
            region_ids=["week-region-1"],
            prompt_version="v-test",
            status="completed",
            error=None,
            generated_at=None,
            updated_at=None,
        )

        def _session_local():
            return _FakeSessionContext(fake_db)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(service, "get_mood_tracker_artwork_for_period", return_value=shared_artwork) as artwork_lookup:
                with patch.object(service, "list_mood_entries_for_date_range", return_value=[]):
                    result = service.get_mood_tracker_period(
                        period_type="weekly",
                        anchor_date_raw="2026-03-11",
                        current_user=fake_user,
                    )

        self.assertEqual(result.image_id, "shared-weekly-art")
        _, kwargs = artwork_lookup.call_args
        self.assertNotIn("user_id", kwargs)

    def test_get_period_returns_persisted_svg_markup(self) -> None:
        fake_db = _FakeDB()
        fake_user = SimpleNamespace(user_id=uuid4())
        fake_artwork = SimpleNamespace(
            image_id="weekly-orbit",
            source="procedural",
            svg_markup="<svg><rect data-region-id='week-region-1' /></svg>",
            region_ids=["week-region-1"],
        )

        def _session_local():
            return _FakeSessionContext(fake_db)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(service, "get_mood_tracker_artwork_for_period", return_value=fake_artwork):
                with patch.object(service, "list_mood_entries_for_date_range", return_value=[]):
                    result = service.get_mood_tracker_period(
                        period_type="weekly",
                        anchor_date_raw="2026-03-11",
                        current_user=fake_user,
                    )

        self.assertEqual(result.image_id, "weekly-orbit")
        self.assertEqual(result.artwork_source, "procedural")
        self.assertEqual(result.region_ids, ["week-region-1"])
        self.assertEqual(result.svg_markup, "<svg><rect data-region-id='week-region-1' /></svg>")

    def test_get_period_generates_artwork_on_demand_when_pending(self) -> None:
        fake_db = _FakeDB()
        fake_user = SimpleNamespace(user_id=uuid4())
        pending_artwork = SimpleNamespace(
            user_id=fake_user.user_id,
            period_type="weekly",
            period_key="2026-W11",
            start_date=date(2026, 3, 9),
            end_date=date(2026, 3, 15),
            image_id=None,
            source=None,
            svg_markup=None,
            region_ids=["week-region-1"],
            prompt_version="v-old",
            status="pending",
            error=None,
            generated_at=None,
            updated_at=None,
        )
        generated = SimpleNamespace(
            image_id="generated-image",
            source="procedural",
            svg_markup="<svg />",
            region_ids=["week-region-1"],
            prompt_version="v-test",
        )

        def _session_local():
            return _FakeSessionContext(fake_db)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(service, "get_mood_tracker_artwork_for_period", return_value=pending_artwork):
                with patch.object(service, "generate_mood_artwork", return_value=generated):
                    with patch.object(service, "list_mood_entries_for_date_range", return_value=[]):
                        result = service.get_mood_tracker_period(
                            period_type="weekly",
                            anchor_date_raw="2026-03-11",
                            current_user=fake_user,
                        )

        self.assertEqual(result.image_id, "generated-image")
        self.assertEqual(result.artwork_source, "procedural")
        self.assertEqual(result.svg_markup, "<svg />")
        self.assertEqual(pending_artwork.status, "completed")
        self.assertGreaterEqual(fake_db.commit_calls, 2)

    def test_get_period_regenerates_invalid_persisted_svg(self) -> None:
        fake_db = _FakeDB()
        fake_user = SimpleNamespace(user_id=uuid4())
        persisted_artwork = SimpleNamespace(
            user_id=fake_user.user_id,
            period_type="weekly",
            period_key="2026-W11",
            start_date=date(2026, 3, 9),
            end_date=date(2026, 3, 15),
            image_id="broken-image",
            source="ai",
            svg_markup='<svg xmlns="http://www.w3.org/2000/svg"><path data-region-id="week-region-1" d="M0 0" broken="</svg>',
            region_ids=["week-region-1", "week-region-2", "week-region-3", "week-region-4", "week-region-5", "week-region-6", "week-region-7"],
            prompt_version=service.PROMPT_VERSION,
            status="completed",
            error=None,
            generated_at=None,
            updated_at=None,
        )
        generated = SimpleNamespace(
            image_id="regenerated-image",
            source="procedural",
            svg_markup="<svg />",
            region_ids=["week-region-1"],
            prompt_version="v-test",
        )

        def _session_local():
            return _FakeSessionContext(fake_db)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(service, "get_mood_tracker_artwork_for_period", return_value=persisted_artwork):
                with patch.object(service, "generate_mood_artwork", return_value=generated):
                    with patch.object(service, "list_mood_entries_for_date_range", return_value=[]):
                        result = service.get_mood_tracker_period(
                            period_type="weekly",
                            anchor_date_raw="2026-03-11",
                            current_user=fake_user,
                        )

        self.assertEqual(result.image_id, "regenerated-image")
        self.assertEqual(result.svg_markup, "<svg />")
        self.assertEqual(persisted_artwork.status, "completed")
        self.assertGreaterEqual(fake_db.commit_calls, 2)

    def test_process_pending_artworks_uses_snapshotted_values_after_session_close(self) -> None:
        fake_db = _FakeDB()
        user_id = uuid4()
        pending_artwork = _DetachableArtwork(
            user_id=user_id,
            period_type="weekly",
            period_key="2026-W11",
            start_date=date(2026, 3, 9),
            end_date=date(2026, 3, 15),
        )
        refreshed_artwork = SimpleNamespace(
            image_id=None,
            source=None,
            svg_markup=None,
            region_ids=[],
            prompt_version=None,
            status="in_progress",
            error=None,
            generated_at=None,
            updated_at=None,
        )
        generated = SimpleNamespace(
            image_id="generated-image",
            source="procedural",
            svg_markup="<svg />",
            region_ids=["week-region-1"],
            prompt_version="v-test",
        )

        def _session_local():
            return _DetachingSessionContext(fake_db, pending_artwork)

        with patch.object(service, "get_session_local", return_value=_session_local):
            with patch.object(service, "list_pending_mood_tracker_artworks", return_value=[pending_artwork]):
                with patch.object(service, "generate_mood_artwork", return_value=generated):
                    with patch.object(
                        service,
                        "get_mood_tracker_artwork_for_period",
                        return_value=refreshed_artwork,
                    ):
                        service.process_pending_mood_tracker_artworks_once(limit=1)

        self.assertEqual(refreshed_artwork.image_id, "generated-image")
        self.assertEqual(refreshed_artwork.status, "completed")
        self.assertEqual(fake_db.commit_calls, 2)


if __name__ == "__main__":
    unittest.main()
