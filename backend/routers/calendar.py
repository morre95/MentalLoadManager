from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import extract, select

from helpers import get_current_user, get_session_local
from models import Tasks, User, UserDB

router = APIRouter(
    prefix="/api/calendar",
    tags=["calendar"],
)


class CalendarEvent(BaseModel):
    id: str
    date: str
    title: str
    person: str | None = None


class CalendarEventsResponse(BaseModel):
    startDate: str
    today: str
    monthLabel: str
    events: list[CalendarEvent]


@router.get("/events", response_model=CalendarEventsResponse)
def list_calendar_events(
    _: User = Depends(get_current_user),
    year: int | None = Query(default=None, ge=1900, le=9999),
    month: int | None = Query(default=None, ge=1, le=12),
):
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
        rows = db.execute(
            select(
                Tasks.task_id,
                Tasks.due_date,
                Tasks.name,
                UserDB.username.label("person"),
            )
            .outerjoin(UserDB, Tasks.assigns_to == UserDB.user_id)
            .where(Tasks.due_date.is_not(None))
            .where(extract("year", Tasks.due_date) == target_year)
            .where(extract("month", Tasks.due_date) == target_month)
            .order_by(Tasks.due_date.asc())
        ).all()

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
