from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.v1.models import MoodEntries, MoodTrackerArtworks


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

def list_completed_mood_tracker_artworks_by_type(
    db: Session,
    *,
    period_type: str,
    day_count: int,
) -> list[MoodTrackerArtworks]:
    return db.scalars(
        select(MoodTrackerArtworks)
        .where(
            MoodTrackerArtworks.period_type == period_type,
            MoodTrackerArtworks.day_count == day_count,
            MoodTrackerArtworks.svg_markup.is_not(None),
        )
        .order_by(
            MoodTrackerArtworks.cycle_order.asc(),
            MoodTrackerArtworks.mood_tracker_artwork_id.asc(),
        )
    ).all()
