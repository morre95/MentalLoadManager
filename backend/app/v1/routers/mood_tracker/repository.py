from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path
import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.v1.models import MoodEntries

MOOD_TRACKER_ASSET_DIR = Path(__file__).resolve().parents[4] / "assets" / "mood-tracker"


@dataclass(slots=True)
class FileMoodTrackerArtwork:
    period_type: str
    day_count: int
    cycle_order: int
    image_id: str
    source: str
    svg_markup: str
    region_ids: list[str]


def _slugify_title(title: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", title.strip().lower())
    normalized = normalized.strip("-")
    return normalized or "mood-tracker-artwork"


@lru_cache(maxsize=1)
def _load_file_mood_tracker_artworks() -> tuple[FileMoodTrackerArtwork, ...]:
    if not MOOD_TRACKER_ASSET_DIR.exists():
        return ()

    artworks: list[FileMoodTrackerArtwork] = []
    asset_groups = [
        ("weekly", 7, MOOD_TRACKER_ASSET_DIR / "weekly"),
        ("monthly", 28, MOOD_TRACKER_ASSET_DIR / "monthly" / "28"),
        ("monthly", 29, MOOD_TRACKER_ASSET_DIR / "monthly" / "29"),
        ("monthly", 30, MOOD_TRACKER_ASSET_DIR / "monthly" / "30"),
        ("monthly", 31, MOOD_TRACKER_ASSET_DIR / "monthly" / "31"),
    ]

    for period_type, day_count, folder in asset_groups:
        if not folder.exists():
            continue

        svg_paths = sorted(
            path for path in folder.iterdir() if path.is_file() and path.suffix.lower() == ".svg"
        )
        for cycle_order, svg_path in enumerate(svg_paths, start=1):
            svg_markup = svg_path.read_text(encoding="utf-8").strip()
            if not svg_markup:
                continue

            region_ids = re.findall(r'data-region-id="([^"]+)"', svg_markup)
            if not region_ids or len(region_ids) != day_count:
                continue

            artworks.append(
                FileMoodTrackerArtwork(
                    period_type=period_type,
                    day_count=day_count,
                    cycle_order=cycle_order,
                    image_id=_slugify_title(svg_path.stem),
                    source="file",
                    svg_markup=svg_markup,
                    region_ids=region_ids,
                )
            )

    return tuple(artworks)


def list_mood_entries_for_date_range(
    db: Session,
    *,
    user_id: UUID,
    start_date: date,
    end_date: date,
) -> list[MoodEntries]:
    return db.scalars(
        select(MoodEntries)
        .where(
            MoodEntries.user_id == user_id,
            MoodEntries.entry_date >= start_date,
            MoodEntries.entry_date <= end_date,
        )
        .order_by(MoodEntries.entry_date.asc(), MoodEntries.created_at.asc())
    ).all()


def get_mood_entry_for_user_and_date(
    db: Session,
    *,
    user_id: UUID,
    entry_date: date,
) -> MoodEntries | None:
    return db.scalar(
        select(MoodEntries).where(
            MoodEntries.user_id == user_id,
            MoodEntries.entry_date == entry_date,
        )
    )


def create_mood_entry(
    db: Session,
    *,
    user_id: UUID,
    entry_date: date,
    color_token: str,
    mood_label: str | None,
) -> MoodEntries:
    entry = MoodEntries(
        user_id=user_id,
        entry_date=entry_date,
        color_token=color_token,
        mood_label=mood_label,
    )
    db.add(entry)
    return entry

def list_file_mood_tracker_artworks_by_type(
    db: Session | None = None,
    *,
    period_type: str,
    day_count: int,
) -> list[FileMoodTrackerArtwork]:
    del db
    return [
        artwork
        for artwork in _load_file_mood_tracker_artworks()
        if artwork.period_type == period_type and artwork.day_count == day_count
    ]
