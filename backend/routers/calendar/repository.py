from sqlalchemy import extract, select
from sqlalchemy.orm import Session

from models import Tasks, UserDB


def fetch_calendar_event_rows(db: Session, target_year: int, target_month: int):
    return db.execute(
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
