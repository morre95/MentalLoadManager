from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from models import (
    AnalyticsAIInsightsCache,
    Categories,
    Households,
    Tasks,
    UserDB,
    UsersHouseholds,
)


def get_user_by_username(db: Session, username: str) -> UserDB | None:
    return db.scalar(select(UserDB).where(UserDB.username == username))


def get_default_household_for_user(db: Session, user_id: UUID):
    return db.scalar(select(UsersHouseholds).where(UsersHouseholds.user_id == user_id))


def get_household_by_id(db: Session, household_id: UUID) -> Households | None:
    return db.get(Households, household_id)


def has_membership(db: Session, user_id: UUID, household_id: UUID) -> bool:
    membership = db.scalar(
        select(UsersHouseholds).where(
            and_(
                UsersHouseholds.user_id == user_id,
                UsersHouseholds.household_id == household_id,
            )
        )
    )
    return bool(membership)


def fetch_member_rows(db: Session, household_id: UUID):
    return db.execute(
        select(UserDB.user_id, UserDB.username, UserDB.display_name)
        .join(UsersHouseholds, UsersHouseholds.user_id == UserDB.user_id)
        .where(UsersHouseholds.household_id == household_id)
        .order_by(UserDB.username.asc())
    ).all()


def fetch_weekly_rows(db: Session, household_id: UUID, start: datetime):
    week_bucket = func.date_trunc("week", Tasks.created_at)
    return db.execute(
        select(
            week_bucket.label("wk"),
            Tasks.assigns_to,
            func.count().label("cnt"),
        )
        .where(
            Tasks.household_id == household_id,
            Tasks.created_at >= start,
        )
        .group_by("wk", Tasks.assigns_to)
        .order_by("wk")
    ).all()


def fetch_category_rows(db: Session, household_id: UUID, start: datetime):
    return db.execute(
        select(
            func.coalesce(Categories.name, "Uncategorized").label("cat"),
            func.count().label("cnt"),
        )
        .select_from(Tasks)
        .outerjoin(Categories, Tasks.category_id == Categories.category_id)
        .where(
            Tasks.household_id == household_id,
            Tasks.created_at >= start,
        )
        .group_by("cat")
        .order_by(func.count().desc())
    ).all()


def fetch_load_rows(
    db: Session,
    household_id: UUID,
    start: datetime,
    open_statuses: tuple[str, ...],
):
    month_bucket = func.date_trunc("month", Tasks.created_at)
    return db.execute(
        select(
            month_bucket.label("mo"),
            func.sum(
                case(
                    (Tasks.status.in_(open_statuses), 1),
                    else_=0,
                )
            ).label("open_tasks"),
        )
        .where(
            Tasks.household_id == household_id,
            Tasks.created_at >= start,
        )
        .group_by("mo")
        .order_by("mo")
    ).all()


def fetch_completion_rows(
    db: Session,
    household_id: UUID,
    start: datetime,
    completed_statuses: tuple[str, ...],
    open_statuses: tuple[str, ...],
):
    day_bucket = func.date_trunc("day", Tasks.created_at)
    return db.execute(
        select(
            day_bucket.label("dy"),
            func.sum(case((Tasks.status.in_(completed_statuses), 1), else_=0)).label(
                "completed"
            ),
            func.sum(case((Tasks.status.in_(open_statuses), 1), else_=0)).label(
                "pending"
            ),
        )
        .where(
            Tasks.household_id == household_id,
            Tasks.created_at >= start,
        )
        .group_by("dy")
        .order_by("dy")
    ).all()


def fetch_radar_rows(db: Session, household_id: UUID, start: datetime):
    return db.execute(
        select(
            func.coalesce(Categories.name, "Uncategorized").label("cat"),
            Tasks.assigns_to,
            func.count().label("cnt"),
        )
        .select_from(Tasks)
        .outerjoin(Categories, Tasks.category_id == Categories.category_id)
        .where(
            Tasks.household_id == household_id,
            Tasks.created_at >= start,
        )
        .group_by("cat", Tasks.assigns_to)
    ).all()


def count_done_this_week(
    db: Session,
    household_id: UUID,
    completed_statuses: tuple[str, ...],
    start_of_week: datetime,
) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Tasks)
            .where(
                Tasks.household_id == household_id,
                Tasks.status.in_(completed_statuses),
                Tasks.complete_date.is_not(None),
                Tasks.complete_date >= start_of_week,
            )
        )
        or 0
    )


def count_open_tasks(
    db: Session,
    household_id: UUID,
    open_statuses: tuple[str, ...],
) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Tasks)
            .where(
                Tasks.household_id == household_id,
                Tasks.status.in_(open_statuses),
            )
        )
        or 0
    )


def count_overdue_tasks(
    db: Session,
    household_id: UUID,
    open_statuses: tuple[str, ...],
    now: datetime,
) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Tasks)
            .where(
                Tasks.household_id == household_id,
                Tasks.status.in_(open_statuses),
                Tasks.due_date.is_not(None),
                Tasks.due_date < now,
            )
        )
        or 0
    )


def fetch_open_assignee_counts(
    db: Session,
    household_id: UUID,
    open_statuses: tuple[str, ...],
):
    return db.execute(
        select(
            Tasks.assigns_to,
            func.count().label("cnt"),
        )
        .where(
            Tasks.household_id == household_id,
            Tasks.status.in_(open_statuses),
            Tasks.assigns_to.is_not(None),
        )
        .group_by(Tasks.assigns_to)
    ).all()
    
def count_done_in_range(
    db: Session,
    household_id: UUID,
    completed_statuses: tuple[str, ...],
    start: datetime,
    end: datetime,
) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Tasks)
            .where(
                Tasks.household_id == household_id,
                Tasks.status.in_(completed_statuses),
                Tasks.complete_date.is_not(None),
                Tasks.complete_date >= start,
                Tasks.complete_date < end,
            )
        )
        or 0
    )


def get_cached_ai_insight(
    db: Session,
    *,
    household_id: UUID,
    timeframe: str,
    input_hash: str,
) -> AnalyticsAIInsightsCache | None:
    return db.scalar(
        select(AnalyticsAIInsightsCache).where(
            AnalyticsAIInsightsCache.household_id == household_id,
            AnalyticsAIInsightsCache.timeframe == timeframe,
            AnalyticsAIInsightsCache.input_hash == input_hash,
        )
    )


def upsert_cached_ai_insight(
    db: Session,
    *,
    household_id: UUID,
    timeframe: str,
    input_hash: str,
    content_json: dict,
    model: str | None,
) -> AnalyticsAIInsightsCache:
    cache_item = get_cached_ai_insight(
        db,
        household_id=household_id,
        timeframe=timeframe,
        input_hash=input_hash,
    )
    if cache_item is None:
        cache_item = AnalyticsAIInsightsCache(
            household_id=household_id,
            timeframe=timeframe,
            input_hash=input_hash,
        )
        db.add(cache_item)

    cache_item.content_json = content_json
    cache_item.model = model
    cache_item.updated_at = datetime.now(timezone.utc)
    return cache_item
