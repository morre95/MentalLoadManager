from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.v1.models import (
    AISummaries,
    Households,
    NotificationSettings,
    Tasks,
    UserDB,
    UsersHouseholds,
)


def get_user_by_username(db: Session, username: str) -> UserDB | None:
    return db.scalar(select(UserDB).where(UserDB.username == username))


def has_household_membership(db: Session, user_id: UUID, household_id: UUID) -> bool:
    membership = db.scalar(
        select(UsersHouseholds).where(
            and_(
                UsersHouseholds.user_id == user_id,
                UsersHouseholds.household_id == household_id,
            )
        )
    )
    return membership is not None


def fetch_weekly_tasks(
    db: Session,
    household_id: UUID,
    week_start_dt: datetime,
    week_end_dt: datetime,
):
    creator_user = aliased(UserDB)
    assignee_user = aliased(UserDB)

    return db.execute(
        select(
            Tasks.task_id,
            Tasks.name,
            Tasks.status,
            Tasks.priority,
            Tasks.created_at,
            Tasks.started_at,
            Tasks.complete_date,
            Tasks.due_date,
            Tasks.created_by,
            Tasks.assigns_to,
            creator_user.username.label("created_by_username"),
            assignee_user.username.label("assignee_username"),
        )
        .where(
            and_(
                Tasks.household_id == household_id,
                or_(
                    and_(
                        Tasks.created_at >= week_start_dt,
                        Tasks.created_at < week_end_dt,
                    ),
                    and_(
                        Tasks.started_at >= week_start_dt,
                        Tasks.started_at < week_end_dt,
                    ),
                    and_(
                        Tasks.complete_date >= week_start_dt,
                        Tasks.complete_date < week_end_dt,
                    ),
                    and_(Tasks.due_date >= week_start_dt, Tasks.due_date < week_end_dt),
                ),
            )
        )
        .outerjoin(creator_user, Tasks.created_by == creator_user.user_id)
        .outerjoin(assignee_user, Tasks.assigns_to == assignee_user.user_id)
    ).all()


def fetch_household_tasks(db: Session, household_id: UUID):
    household_assignee_user = aliased(UserDB)
    return db.execute(
        select(
            Tasks.status,
            Tasks.priority,
            Tasks.assigns_to,
            household_assignee_user.username.label("assignee_username"),
        )
        .outerjoin(
            household_assignee_user,
            Tasks.assigns_to == household_assignee_user.user_id,
        )
        .where(Tasks.household_id == household_id)
    ).all()


def create_ai_summary(
    db: Session,
    *,
    household_id: UUID,
    week_start,
    week_end,
    content: str,
    model: str | None,
    prompt_hash: str | None,
    status: str = "pending",
    error: str | None = None,
) -> AISummaries:
    ai_summary = AISummaries(
        household_id=household_id,
        week_start=week_start,
        week_end=week_end,
        content=content,
        model=model,
        status=status,
        error=error,
        prompt_hash=prompt_hash,
    )
    db.add(ai_summary)
    return ai_summary


def get_ai_summary(db: Session, ai_summary_id: UUID) -> AISummaries | None:
    return db.get(AISummaries, ai_summary_id)


def delete_ai_summary(db: Session, ai_summary: AISummaries) -> None:
    db.delete(ai_summary)


def list_ai_summaries_for_user(
    db: Session,
    *,
    user_id: UUID,
    household_id: UUID | None = None,
) -> list[AISummaries]:
    query = (
        select(AISummaries)
        .join(UsersHouseholds, UsersHouseholds.household_id == AISummaries.household_id)
        .where(UsersHouseholds.user_id == user_id)
        .order_by(desc(AISummaries.created_at), desc(AISummaries.week_start))
    )
    if household_id is not None:
        query = query.where(AISummaries.household_id == household_id)
    return list(db.scalars(query).all())


def list_weekly_summary_email_targets(db: Session):
    return db.execute(
        select(
            UserDB.user_id,
            UserDB.username,
            UserDB.email,
            UserDB.display_name,
            UsersHouseholds.household_id,
            Households.name.label("household_name"),
        )
        .join(UsersHouseholds, UsersHouseholds.user_id == UserDB.user_id)
        .join(Households, Households.household_id == UsersHouseholds.household_id)
        .outerjoin(
            NotificationSettings,
            NotificationSettings.user_id == UserDB.user_id,
        )
        .where(
            UserDB.email.is_not(None),
            func.length(func.trim(UserDB.email)) > 0,
            or_(
                NotificationSettings.user_id.is_(None),
                NotificationSettings.weekly_analytics_email.is_(True),
            ),
        )
        .order_by(UserDB.user_id.asc(), UsersHouseholds.household_id.asc())
    ).all()
