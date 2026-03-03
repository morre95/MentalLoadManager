from datetime import datetime, timezone, date as date_type
from calendar import monthrange

from fastapi import HTTPException, status

from helpers import get_session_local
from models import UserEmail

from .repository import fetch_calendar_event_rows_range
from .schemas import CalendarEvent, CalendarEventsResponse, CalendarRangeEventsResponse


def list_calendar_events(
    current_user: UserEmail,
    year: int | None,
    month: int | None,
) -> CalendarEventsResponse:
    """
    Month-based endpoint used by the calendar view.
    Internally calls the range query for [month_start..month_end].
    """
    now_utc = datetime.now(timezone.utc)
    target_year = year or now_utc.year
    target_month = month or now_utc.month

    try:
        month_start = date_type(target_year, target_month, 1)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid year/month combination",
        ) from exc

    last_day = monthrange(target_year, target_month)[1]
    month_end = date_type(target_year, target_month, last_day)

    session_local = get_session_local()

    with session_local() as db:
        rows = fetch_calendar_event_rows_range(
            db=db,
            from_date=month_start,
            to_date=month_end,
            my_email=getattr(current_user, "email", None),
            my_username=getattr(current_user, "username", None),
        )

    return CalendarEventsResponse(
        startDate=month_start.isoformat(),
        today=now_utc.date().isoformat(),
        monthLabel=month_start.strftime("%b %Y"),
        events=[
            CalendarEvent(
                id=str(r.task_id),
                date=r.due_date.date().isoformat(),
                title=r.name,
                household_id=str(r.household_id),
                household_name=r.household_name,
                person=getattr(current_user, "username", None),
            )
            for r in rows
        ],
    )


def list_calendar_events_range(
    current_user: UserEmail,
    from_date: date_type,
    to_date: date_type,
) -> CalendarRangeEventsResponse:
    """
    Range endpoint for week views + "Upcoming this week", robust across month boundaries.
    """
    now_utc = datetime.now(timezone.utc)

    if to_date < from_date:
        # Normalize (or raise 400 if you prefer)
        from_date, to_date = to_date, from_date

    session_local = get_session_local()

    with session_local() as db:
        rows = fetch_calendar_event_rows_range(
            db=db,
            from_date=from_date,
            to_date=to_date,
            my_email=getattr(current_user, "email", None),
            my_username=getattr(current_user, "username", None),
        )

    return CalendarRangeEventsResponse(
        fromDate=from_date.isoformat(),
        toDate=to_date.isoformat(),
        today=now_utc.date().isoformat(),
        events=[
            CalendarEvent(
                id=str(r.task_id),
                date=r.due_date.date().isoformat(),
                title=r.name,
                household_id=str(r.household_id),
                household_name=r.household_name,
                person=getattr(current_user, "username", None),
            )
            for r in rows
        ],
    )
