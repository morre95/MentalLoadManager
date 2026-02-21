from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends

from helpers import get_current_user
from models import UserEmail

from .schemas import AnalyticsSummaryResponse
from .service import get_analytics_summary

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary_route(
    household_id: UUID | None = None,
    timeframe: Literal["7d", "30d", "12w"] = "30d",
    current_user: UserEmail = Depends(get_current_user),
):
    return get_analytics_summary(household_id, timeframe, current_user)
