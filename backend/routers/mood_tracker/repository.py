from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import MoodEntries


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
