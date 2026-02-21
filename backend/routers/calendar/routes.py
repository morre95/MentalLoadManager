from fastapi import APIRouter, Depends, Query

from helpers import get_current_user
from models import User

from .schemas import CalendarEventsResponse
from .service import list_calendar_events

router = APIRouter(
    prefix="/api/calendar",
    tags=["calendar"],
)


@router.get("/events", response_model=CalendarEventsResponse)
def list_calendar_events_route(
    _: User = Depends(get_current_user),
    year: int | None = Query(default=None, ge=1900, le=9999),
    month: int | None = Query(default=None, ge=1, le=12),
):
    return list_calendar_events(year, month)
