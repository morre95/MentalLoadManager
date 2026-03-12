from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query

from helpers import get_current_user
from models import UserEmail

from .schemas import (
    GenerateWeeklySummaryRequest,
    SavedReportsListResponse,
    WeeklySummaryReportResponse,
)
from .service import (
    get_weekly_summary_report,
    list_saved_reports,
    queue_weekly_summary_generation,
)

router = APIRouter(
    prefix="/api/ai",
    tags=["ai"],
)


@router.post("/weekly-summary", response_model=WeeklySummaryReportResponse)
def generate_weekly_summary_route(
    background_tasks: BackgroundTasks,
    payload: GenerateWeeklySummaryRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return queue_weekly_summary_generation(payload, current_user, background_tasks)


@router.get("/weekly-summary/{weekly_report_id}", response_model=WeeklySummaryReportResponse)
def get_weekly_summary_report_route(
    weekly_report_id: UUID,
    current_user: UserEmail = Depends(get_current_user),
):
    return get_weekly_summary_report(weekly_report_id, current_user)


@router.get("/reports", response_model=SavedReportsListResponse)
def list_saved_reports_route(
    household_id: UUID | None = Query(default=None),
    current_user: UserEmail = Depends(get_current_user),
):
    return list_saved_reports(current_user, household_id)
