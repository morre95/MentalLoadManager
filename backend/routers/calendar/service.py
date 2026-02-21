from datetime import datetime, timezone

from fastapi import HTTPException, status

from helpers import get_session_local

from .repository import fetch_calendar_event_rows
from .schemas import CalendarEvent, CalendarEventsResponse


def list_calendar_events(year: int | None, month: int | None) -> CalendarEventsResponse:
    now_utc = datetime.now(timezone.utc)
    target_year = year or now_utc.year
    target_month = month or now_utc.month

    try:
        month_start = datetime(target_year, target_month, 1, tzinfo=timezone.utc).date()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid year/month combination",
        ) from exc

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        rows = fetch_calendar_event_rows(db, target_year, target_month)

    return CalendarEventsResponse(
        startDate=month_start.isoformat(),
        today=now_utc.date().isoformat(),
        monthLabel=month_start.strftime("%b %Y"),
        events=[
            CalendarEvent(
                id=str(row.task_id),
                date=row.due_date.date().isoformat(),
                title=row.name,
                person=row.person,
            )
            for row in rows
        ],
    )
