from datetime import datetime, timedelta, timezone, date as date_type
from calendar import monthrange

from fastapi import HTTPException, status

from app.v1.helpers import get_session_local
from app.v1.models import UserEmail

from .repository import fetch_calendar_event_rows_range
from .schemas import CalendarEvent, CalendarEventsResponse, CalendarRangeEventsResponse


def _add_months(source: datetime, months: int) -> datetime:
    total_month = (source.month - 1) + months
    year = source.year + total_month // 12
    month = (total_month % 12) + 1
    day = min(source.day, monthrange(year, month)[1])
    return source.replace(year=year, month=month, day=day)


def _calculate_next_due_date(
    due_date: datetime, recurrence_frequency: str, recurrence_interval: int
) -> datetime:
    if recurrence_frequency == "daily":
        return due_date + timedelta(days=recurrence_interval)
    if recurrence_frequency == "weekly":
        return due_date + timedelta(weeks=recurrence_interval)
    return _add_months(due_date, recurrence_interval)


def _build_calendar_events(
    rows, from_date: date_type, to_date: date_type, current_user: UserEmail
):
    events: list[CalendarEvent] = []

    for row in rows:
        if not row.due_date:
            continue

        recurrence_enabled = bool(row.recurrence_enabled and row.recurrence_frequency)
        recurrence_frequency = row.recurrence_frequency
        recurrence_interval = row.recurrence_interval or 1
        recurrence_exceptions = set(row.recurrence_exceptions or [])

        if not recurrence_enabled:
            occurrence_date = row.due_date.date()
            if from_date <= occurrence_date <= to_date:
                events.append(
                    CalendarEvent(
                        id=f"{row.task_id}:{occurrence_date.isoformat()}",
                        task_id=str(row.task_id),
                        date=occurrence_date.isoformat(),
                        title=row.name,
                        household_id=str(row.household_id),
                        household_name=row.household_name,
                        person=getattr(current_user, "username", None),
                        recurrence_enabled=False,
                        recurrence_frequency=None,
                        recurrence_interval=None,
                        is_projected=False,
                    )
                )
            continue

        next_due_date = row.due_date
        while next_due_date.date() <= to_date:
            occurrence_date = next_due_date.date()
            if (
                occurrence_date >= from_date
                and occurrence_date not in recurrence_exceptions
            ):
                events.append(
                    CalendarEvent(
                        id=f"{row.task_id}:{occurrence_date.isoformat()}",
                        task_id=str(row.task_id),
                        date=occurrence_date.isoformat(),
                        title=row.name,
                        household_id=str(row.household_id),
                        household_name=row.household_name,
                        person=getattr(current_user, "username", None),
                        recurrence_enabled=True,
                        recurrence_frequency=recurrence_frequency,
                        recurrence_interval=recurrence_interval,
                        is_projected=occurrence_date != row.due_date.date(),
                    )
                )

            next_due_date = _calculate_next_due_date(
                next_due_date,
                recurrence_frequency,
                recurrence_interval,
            )

    events.sort(key=lambda event: (event.date, event.title.lower(), event.id))
    return events


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
        events=_build_calendar_events(rows, month_start, month_end, current_user),
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
        events=_build_calendar_events(rows, from_date, to_date, current_user),
    )
