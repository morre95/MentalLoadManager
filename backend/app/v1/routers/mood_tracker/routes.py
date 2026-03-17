from fastapi import APIRouter, BackgroundTasks, Depends, Query

from app.v1.helpers import get_current_user
from app.v1.models import UserEmail

from .schemas import MoodTrackerPeriodResponse, UpsertMoodEntryRequest
from .service import (
    get_mood_tracker_period,
    process_pending_mood_tracker_artworks_once,
    upsert_mood_tracker_entry,
)

router = APIRouter(prefix="/api/v1/mood-tracker", tags=["mood-tracker"])


@router.get("", response_model=MoodTrackerPeriodResponse)
def get_mood_tracker_period_route(
    background_tasks: BackgroundTasks,
    period_type: str = Query(...),
    anchor_date: str | None = Query(default=None),
    current_user: UserEmail = Depends(get_current_user),
):
    background_tasks.add_task(process_pending_mood_tracker_artworks_once, limit=2)
    return get_mood_tracker_period(
        period_type=period_type,
        anchor_date_raw=anchor_date,
        current_user=current_user,
    )


@router.put("/entries", response_model=MoodTrackerPeriodResponse)
def upsert_mood_tracker_entry_route(
    background_tasks: BackgroundTasks,
    payload: UpsertMoodEntryRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    background_tasks.add_task(process_pending_mood_tracker_artworks_once, limit=2)
    return upsert_mood_tracker_entry(payload, current_user)
