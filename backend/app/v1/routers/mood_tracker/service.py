from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.v1.helpers import get_session_local
from app.v1.models import UserEmail

from .artwork_generator import PROMPT_VERSION, generate_mood_artwork
from .repository import (
    create_mood_entry,
    create_mood_tracker_artwork,
    get_mood_entry_for_user_and_date,
    get_mood_tracker_artwork_for_period,
    list_active_mood_tracker_user_ids,
    list_mood_entries_for_date_range,
    list_pending_mood_tracker_artworks,
)
from .schemas import (
    MoodTrackerDateStatusResponse,
    MoodTrackerDayResponse,
    MoodTrackerPeriodResponse,
    UpsertMoodEntryRequest,
)

logger = logging.getLogger(__name__)

ALLOWED_COLOR_TOKENS = {
    "sage",
    "terracotta",
    "lavender",
    "sky",
    "primary",
    "accent",
    "status-todo",
    "status-doing",
    "status-done",
    "sand",
}


def _parse_anchor_date(anchor_date_raw: str | None) -> date:
    if not anchor_date_raw:
        return datetime.now(timezone.utc).date()

    try:
        return date.fromisoformat(anchor_date_raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="anchor_date must be a valid ISO date",
        ) from exc


def _normalize_period_type(period_type: str) -> str:
    normalized = str(period_type or "").strip().lower()
    if normalized not in {"weekly", "monthly"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="period_type must be one of: weekly, monthly",
        )
    return normalized


def _period_bounds(period_type: str, anchor_date: date) -> tuple[date, date]:
    if period_type == "weekly":
        start_date = anchor_date - timedelta(days=anchor_date.weekday())
        end_date = start_date + timedelta(days=6)
        return start_date, end_date

    start_date = anchor_date.replace(day=1)
    if start_date.month == 12:
        next_month = start_date.replace(year=start_date.year + 1, month=1)
    else:
        next_month = start_date.replace(month=start_date.month + 1)
    end_date = next_month - timedelta(days=1)
    return start_date, end_date


def _period_key(period_type: str, start_date: date) -> str:
    if period_type == "weekly":
        iso_year, iso_week, _ = start_date.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    return f"{start_date.year}-{start_date.month:02d}"


def _period_label(period_type: str, start_date: date, end_date: date) -> str:
    if period_type == "weekly":
        return f"{start_date.strftime('%b %d')} - {end_date.strftime('%b %d, %Y')}"
    return start_date.strftime("%B %Y")


def _region_ids(period_type: str, start_date: date, end_date: date) -> list[str]:
    count = (end_date - start_date).days + 1
    prefix = "week" if period_type == "weekly" else "month"
    return [f"{prefix}-region-{index + 1}" for index in range(count)]


def _region_field_name(period_type: str) -> str:
    return "weekly_region_id" if period_type == "weekly" else "monthly_region_id"


def _pick_region_for_date(
    *,
    period_key: str,
    entry_date: date,
    available_region_ids: list[str],
) -> str:
    if not available_region_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No mood tracker regions are available for this period",
        )

    seed = sum(
        (index + 1) * ord(char)
        for index, char in enumerate(f"{period_key}:{entry_date.isoformat()}")
    )
    return available_region_ids[seed % len(available_region_ids)]


def _validate_entry_date(
    period_type: str, entry_date: date, start_date: date, end_date: date
):
    today = datetime.now(timezone.utc).date()
    if entry_date < start_date or entry_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="entry_date is outside the selected period",
        )
    if entry_date > today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Future dates cannot be painted yet",
        )


def _build_period_response(
    *,
    period_type: str,
    anchor_date: date,
    start_date: date,
    end_date: date,
    period_key: str,
    artwork,
    entries: list,
) -> MoodTrackerPeriodResponse:
    region_field_name = _region_field_name(period_type)
    region_ids = list(
        artwork.region_ids or _region_ids(period_type, start_date, end_date)
    )
    entries_by_date = {entry.entry_date: entry for entry in entries}
    today = datetime.now(timezone.utc).date()
    dates = []
    painted_days = []
    current_date = start_date

    while current_date <= end_date:
        entry = entries_by_date.get(current_date)
        dates.append(
            MoodTrackerDateStatusResponse(
                date=current_date,
                is_painted=entry is not None,
                is_future=current_date > today,
                color_token=entry.color_token if entry else None,
                mood_label=entry.mood_label if entry else None,
            )
        )
        if entry is not None:
            painted_days.append(
                MoodTrackerDayResponse(
                    date=entry.entry_date,
                    color_token=entry.color_token,
                    mood_label=entry.mood_label,
                    region_id=getattr(entry, region_field_name),
                )
            )
        current_date += timedelta(days=1)

    return MoodTrackerPeriodResponse(
        period_type=period_type,
        period_key=period_key,
        period_label=_period_label(period_type, start_date, end_date),
        anchor_date=anchor_date,
        start_date=start_date,
        end_date=end_date,
        image_id=artwork.image_id,
        artwork_source=artwork.source,
        artwork_status=artwork.status,
        artwork_error=artwork.error,
        artwork_generated_at=artwork.generated_at,
        svg_markup=artwork.svg_markup,
        region_ids=region_ids,
        painted_days=painted_days,
        dates=dates,
    )


def _ensure_artwork_job(
    db,
    *,
    user_id: UUID,
    period_type: str,
    period_key: str,
    start_date: date,
    end_date: date,
):
    artwork = get_mood_tracker_artwork_for_period(
        db,
        period_type=period_type,
        period_key=period_key,
    )
    expected_region_ids = _region_ids(period_type, start_date, end_date)

    if artwork is None:
        artwork = create_mood_tracker_artwork(
            db,
            period_type=period_type,
            period_key=period_key,
            start_date=start_date,
            end_date=end_date,
            image_id=None,
            source=None,
            status="pending",
            error=None,
            svg_markup=None,
            region_ids=expected_region_ids,
            prompt_version=PROMPT_VERSION,
        )
        db.commit()
        db.refresh(artwork)
        return artwork

    artwork.start_date = start_date
    artwork.end_date = end_date
    if not artwork.region_ids:
        artwork.region_ids = expected_region_ids

    is_stale = artwork.prompt_version != PROMPT_VERSION
    if is_stale:
        artwork.image_id = None
        artwork.source = None
        artwork.svg_markup = None
        artwork.status = "pending"
        artwork.error = None
        artwork.generated_at = None
        artwork.prompt_version = PROMPT_VERSION
        artwork.region_ids = expected_region_ids
        artwork.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(artwork)
        return artwork

    return artwork


def queue_mood_tracker_artwork_for_period(
    *,
    user_id: UUID,
    period_type: str,
    anchor_date: date,
) -> None:
    start_date, end_date = _period_bounds(period_type, anchor_date)
    period_key = _period_key(period_type, start_date)
    session_local = get_session_local()
    with session_local() as db:
        _ensure_artwork_job(
            db,
            user_id=user_id,
            period_type=period_type,
            period_key=period_key,
            start_date=start_date,
            end_date=end_date,
        )


def process_pending_mood_tracker_artworks_once(*, limit: int = 4) -> None:
    session_local = get_session_local()
    with session_local() as db:
        artworks = list_pending_mood_tracker_artworks(db, limit=limit)
        for artwork in artworks:
            artwork.status = "in_progress"
            artwork.error = None
            artwork.updated_at = datetime.now(timezone.utc)
        db.commit()
        artwork_jobs = [
            {
                "user_id": artwork.user_id,
                "period_type": artwork.period_type,
                "period_key": artwork.period_key,
                "start_date": artwork.start_date,
                "end_date": artwork.end_date,
            }
            for artwork in artworks
        ]

    for artwork in artwork_jobs:
        try:
            generated = generate_mood_artwork(
                period_type=artwork["period_type"],
                period_key=artwork["period_key"],
                start_date=artwork["start_date"],
                end_date=artwork["end_date"],
            )
            with session_local() as db:
                fresh = get_mood_tracker_artwork_for_period(
                    db,
                    period_type=artwork["period_type"],
                    period_key=artwork["period_key"],
                )
                if fresh is None:
                    continue
                fresh.image_id = generated.image_id
                fresh.source = generated.source
                fresh.svg_markup = generated.svg_markup
                fresh.region_ids = generated.region_ids
                fresh.prompt_version = generated.prompt_version
                fresh.status = "completed"
                fresh.error = None
                fresh.generated_at = datetime.now(timezone.utc)
                fresh.updated_at = fresh.generated_at
                db.commit()
        except Exception as exc:
            logger.exception(
                "Mood artwork generation failed for user=%s period=%s key=%s",
                artwork["user_id"],
                artwork["period_type"],
                artwork["period_key"],
            )
            with session_local() as db:
                fresh = get_mood_tracker_artwork_for_period(
                    db,
                    period_type=artwork["period_type"],
                    period_key=artwork["period_key"],
                )
                if fresh is None:
                    continue
                fresh.status = "failed"
                fresh.error = str(exc)[:1000]
                fresh.updated_at = datetime.now(timezone.utc)
                db.commit()


def _generate_artwork_for_current_period(db, artwork) -> None:
    if artwork.status == "completed" and artwork.image_id and artwork.svg_markup:
        return

    artwork.status = "in_progress"
    artwork.error = None
    artwork.updated_at = datetime.now(timezone.utc)
    db.commit()

    try:
        generated = generate_mood_artwork(
            period_type=artwork.period_type,
            period_key=artwork.period_key,
            start_date=artwork.start_date,
            end_date=artwork.end_date,
        )
    except Exception as exc:
        artwork.status = "failed"
        artwork.error = str(exc)[:1000]
        artwork.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(artwork)
        return

    artwork.image_id = generated.image_id
    artwork.source = generated.source
    artwork.svg_markup = generated.svg_markup
    artwork.region_ids = generated.region_ids
    artwork.prompt_version = generated.prompt_version
    artwork.status = "completed"
    artwork.error = None
    artwork.generated_at = datetime.now(timezone.utc)
    artwork.updated_at = artwork.generated_at
    db.commit()
    db.refresh(artwork)


def queue_pre_generation_for_active_users() -> None:
    session_local = get_session_local()
    today = datetime.now(timezone.utc).date()
    with session_local() as db:
        user_ids = list_active_mood_tracker_user_ids(db)

    for user_id in user_ids:
        for period_type in ("weekly", "monthly"):
            if period_type == "weekly":
                anchors = [today - timedelta(days=7), today, today + timedelta(days=7)]
            else:
                first = today.replace(day=1)
                prev_anchor = (first - timedelta(days=1)).replace(day=1)
                next_anchor = (first + timedelta(days=32)).replace(day=1)
                anchors = [prev_anchor, today, next_anchor]
            for anchor in anchors:
                try:
                    queue_mood_tracker_artwork_for_period(
                        user_id=user_id,
                        period_type=period_type,
                        anchor_date=anchor,
                    )
                except Exception:
                    logger.exception(
                        "Failed to queue mood artwork pre-generation for user=%s period=%s anchor=%s",
                        user_id,
                        period_type,
                        anchor.isoformat(),
                    )


def get_mood_tracker_period(
    *,
    period_type: str,
    anchor_date_raw: str | None,
    current_user: UserEmail,
) -> MoodTrackerPeriodResponse:
    normalized_period_type = _normalize_period_type(period_type)
    anchor_date = _parse_anchor_date(anchor_date_raw)
    start_date, end_date = _period_bounds(normalized_period_type, anchor_date)
    period_key = _period_key(normalized_period_type, start_date)
    region_field_name = _region_field_name(normalized_period_type)

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        artwork = _ensure_artwork_job(
            db,
            user_id=current_user.user_id,
            period_type=normalized_period_type,
            period_key=period_key,
            start_date=start_date,
            end_date=end_date,
        )
        _generate_artwork_for_current_period(db, artwork)
        entries = list_mood_entries_for_date_range(
            db,
            user_id=current_user.user_id,
            start_date=start_date,
            end_date=end_date,
        )

        assigned_region_ids = {
            getattr(entry, region_field_name)
            for entry in entries
            if getattr(entry, region_field_name)
        }
        region_ids = list(
            artwork.region_ids
            or _region_ids(normalized_period_type, start_date, end_date)
        )
        did_assign_regions = False
        for entry in entries:
            if getattr(entry, region_field_name):
                continue
            available_region_ids = [
                region_id
                for region_id in region_ids
                if region_id not in assigned_region_ids
            ]
            selected_region_id = _pick_region_for_date(
                period_key=period_key,
                entry_date=entry.entry_date,
                available_region_ids=available_region_ids,
            )
            setattr(entry, region_field_name, selected_region_id)
            entry.updated_at = datetime.now(timezone.utc)
            assigned_region_ids.add(selected_region_id)
            did_assign_regions = True

        if did_assign_regions:
            db.commit()
            entries = list_mood_entries_for_date_range(
                db,
                user_id=current_user.user_id,
                start_date=start_date,
                end_date=end_date,
            )

        return _build_period_response(
            period_type=normalized_period_type,
            anchor_date=anchor_date,
            start_date=start_date,
            end_date=end_date,
            period_key=period_key,
            artwork=artwork,
            entries=entries,
        )


def upsert_mood_tracker_entry(
    payload: UpsertMoodEntryRequest,
    current_user: UserEmail,
) -> MoodTrackerPeriodResponse:
    period_type = _normalize_period_type(payload.period_type)
    color_token = payload.color_token.strip()
    if color_token not in ALLOWED_COLOR_TOKENS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid mood color token",
        )

    mood_label = payload.mood_label.strip() if payload.mood_label else None
    start_date, end_date = _period_bounds(period_type, payload.entry_date)
    period_key = _period_key(period_type, start_date)
    _validate_entry_date(period_type, payload.entry_date, start_date, end_date)

    session_local = get_session_local()
    region_field_name = _region_field_name(period_type)
    with session_local() as db:
        artwork = _ensure_artwork_job(
            db,
            user_id=current_user.user_id,
            period_type=period_type,
            period_key=period_key,
            start_date=start_date,
            end_date=end_date,
        )
        region_ids = list(
            artwork.region_ids or _region_ids(period_type, start_date, end_date)
        )
        if payload.region_id not in region_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="region_id is invalid for the selected period",
            )

        entry = get_mood_entry_for_user_and_date(
            db,
            user_id=current_user.user_id,
            entry_date=payload.entry_date,
        )
        if entry is None:
            entry = create_mood_entry(
                db,
                user_id=current_user.user_id,
                entry_date=payload.entry_date,
                color_token=color_token,
                mood_label=mood_label,
            )
        else:
            entry.color_token = color_token
            entry.mood_label = mood_label

        sibling_entries = list_mood_entries_for_date_range(
            db,
            user_id=current_user.user_id,
            start_date=start_date,
            end_date=end_date,
        )
        for sibling_entry in sibling_entries:
            sibling_region_id = getattr(sibling_entry, region_field_name)
            if sibling_region_id != payload.region_id:
                continue
            if sibling_entry.entry_date == payload.entry_date:
                continue
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That region is already painted for another date in this period",
            )

        setattr(entry, region_field_name, payload.region_id)
        entry.updated_at = datetime.now(timezone.utc)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to save mood entry",
            ) from exc

    return get_mood_tracker_period(
        period_type=period_type,
        anchor_date_raw=start_date.isoformat(),
        current_user=current_user,
    )
