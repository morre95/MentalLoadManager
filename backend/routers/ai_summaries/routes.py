from fastapi import APIRouter, Depends

from helpers import get_current_user
from models import UserEmail

from .schemas import GenerateWeeklySummaryRequest, GenerateWeeklySummaryResponse
from .service import generate_weekly_summary

router = APIRouter(
    prefix="/api/ai",
    tags=["ai"],
)


@router.post("/weekly-summary", response_model=GenerateWeeklySummaryResponse)
def generate_weekly_summary_route(
    payload: GenerateWeeklySummaryRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return generate_weekly_summary(payload, current_user)
