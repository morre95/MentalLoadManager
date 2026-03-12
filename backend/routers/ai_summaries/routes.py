from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query

from helpers import get_current_user
from models import UserEmail

from .schemas import (
    GenerateWeeklySummaryRequest,
    SavedSummariesListResponse,
    WeeklySummaryResponse,
)
from .service import (
    get_weekly_summary,
    list_summaries,
    queue_weekly_summary_generation,
)

router = APIRouter(
    prefix="/api/ai",
    tags=["ai"],
)


@router.post("/weekly-summary", response_model=WeeklySummaryResponse)
def generate_weekly_summary_route(
    background_tasks: BackgroundTasks,
    payload: GenerateWeeklySummaryRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return queue_weekly_summary_generation(payload, current_user, background_tasks)


@router.get("/weekly-summary/{ai_summary_id}", response_model=WeeklySummaryResponse)
def get_weekly_summary_route(
    ai_summary_id: UUID,
    current_user: UserEmail = Depends(get_current_user),
):
    return get_weekly_summary(ai_summary_id, current_user)


@router.get("/summaries", response_model=SavedSummariesListResponse)
def list_summaries_route(
    household_id: UUID | None = Query(default=None),
    current_user: UserEmail = Depends(get_current_user),
):
    return list_summaries(current_user, household_id)
