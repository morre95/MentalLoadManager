from datetime import date
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Query, Request

from app.v1.helpers import get_current_user
from app.v1.limiter import limiter
from app.v1.models import UserEmail

from .schemas import (
    GenerateWeeklySummaryRequest,
    SavedSummariesListResponse,
    SummaryDeleteResponse,
    WeeklySummaryEmailDispatchResponse,
    WeeklySummaryResponse,
)
from .service import (
    delete_summary,
    dispatch_weekly_summary_emails,
    get_weekly_summary,
    list_summaries,
    queue_weekly_summary_generation,
    regenerate_weekly_summary,
)

router = APIRouter(
    prefix="/api/v1/ai",
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


@router.post("/summaries/{ai_summary_id}/regenerate", response_model=WeeklySummaryResponse)
def regenerate_summary_route(
    ai_summary_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: UserEmail = Depends(get_current_user),
):
    return regenerate_weekly_summary(ai_summary_id, current_user, background_tasks)


@router.delete("/summaries/{ai_summary_id}", response_model=SummaryDeleteResponse)
def delete_summary_route(
    ai_summary_id: UUID,
    current_user: UserEmail = Depends(get_current_user),
):
    return delete_summary(ai_summary_id, current_user)


@router.post(
    "/weekly-summary/email-dispatch",
    response_model=WeeklySummaryEmailDispatchResponse,
)
@limiter.limit("10/minute")
def dispatch_weekly_summary_email_route(
    request: Request,
    dispatch_date: date | None = Query(default=None),
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    del request
    return dispatch_weekly_summary_emails(
        cron_secret=x_cron_secret,
        dispatch_date=dispatch_date,
    )
