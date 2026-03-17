from datetime import date
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from models import MoodEntries, MoodTrackerArtworks


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


def get_mood_tracker_artwork_for_period(
    db: Session,
    *,
    user_id: UUID,
    period_type: str,
    period_key: str,
) -> MoodTrackerArtworks | None:
    return db.scalar(
        select(MoodTrackerArtworks).where(
            MoodTrackerArtworks.user_id == user_id,
            MoodTrackerArtworks.period_type == period_type,
            MoodTrackerArtworks.period_key == period_key,
        )
    )


def create_mood_tracker_artwork(
    db: Session,
    *,
    user_id: UUID,
    period_type: str,
    period_key: str,
    start_date: date,
    end_date: date,
    image_id: str | None,
    source: str | None,
    status: str,
    error: str | None,
    svg_markup: str | None,
    region_ids: list[str],
    prompt_version: str | None,
) -> MoodTrackerArtworks:
    artwork = MoodTrackerArtworks(
        user_id=user_id,
        period_type=period_type,
        period_key=period_key,
        start_date=start_date,
        end_date=end_date,
        image_id=image_id,
        source=source,
        status=status,
        error=error,
        svg_markup=svg_markup,
        region_ids=region_ids,
        prompt_version=prompt_version,
    )
    db.add(artwork)
    return artwork


def list_pending_mood_tracker_artworks(
    db: Session,
    *,
    limit: int = 10,
) -> list[MoodTrackerArtworks]:
    return db.scalars(
        select(MoodTrackerArtworks)
        .where(MoodTrackerArtworks.status.in_(("pending", "in_progress")))
        .order_by(MoodTrackerArtworks.created_at.asc())
        .limit(limit)
    ).all()


def list_active_mood_tracker_user_ids(db: Session) -> list[UUID]:
    mood_entry_user_ids = select(MoodEntries.user_id.label("user_id"))
    artwork_user_ids = select(MoodTrackerArtworks.user_id.label("user_id"))
    combined = mood_entry_user_ids.union(artwork_user_ids).subquery()
    return list(db.scalars(select(combined.c.user_id)))


def list_mood_tracker_artworks_for_user(
    db: Session,
    *,
    user_id: UUID,
    period_type: str | None = None,
) -> list[MoodTrackerArtworks]:
    query = select(MoodTrackerArtworks).where(MoodTrackerArtworks.user_id == user_id)
    if period_type:
        query = query.where(MoodTrackerArtworks.period_type == period_type)
    return db.scalars(query.order_by(MoodTrackerArtworks.start_date.asc())).all()
