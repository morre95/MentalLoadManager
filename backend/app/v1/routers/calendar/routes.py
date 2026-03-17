from datetime import date

from fastapi import APIRouter, Depends, Query

from helpers import get_current_user
from models import UserEmail

from .schemas import CalendarEventsResponse, CalendarRangeEventsResponse
from .service import list_calendar_events, list_calendar_events_range

router = APIRouter(prefix="/api/v1/calendar", tags=["calendar"])


@router.get("/events", response_model=CalendarEventsResponse)
def list_calendar_events_route(
    current_user: UserEmail = Depends(get_current_user),
    year: int | None = Query(default=None, ge=1900, le=9999),
    month: int | None = Query(default=None, ge=1, le=12),
):
    return list_calendar_events(current_user, year, month)


@router.get("/events/range", response_model=CalendarRangeEventsResponse)
def list_calendar_events_range_route(
    current_user: UserEmail = Depends(get_current_user),
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
):
    return list_calendar_events_range(current_user, from_date, to_date)
