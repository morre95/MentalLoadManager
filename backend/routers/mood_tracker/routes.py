from fastapi import APIRouter, Depends, Query

from helpers import get_current_user
from models import UserEmail

from .schemas import MoodTrackerPeriodResponse, UpsertMoodEntryRequest
from .service import get_mood_tracker_period, upsert_mood_tracker_entry

router = APIRouter(prefix="/api/mood-tracker", tags=["mood-tracker"])


@router.get("", response_model=MoodTrackerPeriodResponse)
def get_mood_tracker_period_route(
    period_type: str = Query(...),
    anchor_date: str | None = Query(default=None),
    current_user: UserEmail = Depends(get_current_user),
):
    return get_mood_tracker_period(
        period_type=period_type,
        anchor_date_raw=anchor_date,
        current_user=current_user,
    )


@router.put("/entries", response_model=MoodTrackerPeriodResponse)
def upsert_mood_tracker_entry_route(
    payload: UpsertMoodEntryRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return upsert_mood_tracker_entry(payload, current_user)
