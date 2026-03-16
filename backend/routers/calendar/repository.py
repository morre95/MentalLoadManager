from datetime import datetime, time, timezone, date as date_type

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from models import Tasks, UsersHouseholds, Households, UserDB

DONE_STATUSES = ("done", "completed", "complete")


def fetch_calendar_event_rows_range(
    db: Session,
    from_date: date_type,
    to_date: date_type,
    my_email: str | None,
    my_username: str | None,
):
    """
    Returns due-dated tasks within [from_date, to_date] (inclusive),
    filtered to:
      - tasks assigned to me
      - tasks in households I belong to
      - status not completed
    """
    if my_email:
        user_match = UserDB.email == my_email
    elif my_username:
        user_match = UserDB.username == my_username
    else:
        return []

    # Inclusive day range (UTC)
    start_dt = datetime.combine(from_date, time.min).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(to_date, time.max).replace(tzinfo=timezone.utc)

    q = (
        select(
            Tasks.task_id,
            Tasks.due_date,
            Tasks.name,
            Tasks.household_id,
            Households.name.label("household_name"),
            Tasks.recurrence_enabled,
            Tasks.recurrence_frequency,
            Tasks.recurrence_interval,
        )
        .select_from(Tasks)
        .join(Households, Households.household_id == Tasks.household_id)
        .join(UsersHouseholds, UsersHouseholds.household_id == Tasks.household_id)
        .join(UserDB, user_match)  # bind "me" from email/username
        .where(UsersHouseholds.user_id == UserDB.user_id)  # my households
        .where(Tasks.assigns_to == UserDB.user_id)  # only my tasks
        .where(Tasks.due_date.is_not(None))
        .where(Tasks.due_date >= start_dt)
        .where(Tasks.due_date <= end_dt)
        .where(~func.lower(Tasks.status).in_(DONE_STATUSES))  # hide completed
        .order_by(Tasks.due_date.asc())
    )

    return db.execute(q).all()
