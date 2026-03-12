from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, aliased

from models import (
    AISummaries,
    DailyReports,
    MonthlyReports,
    Tasks,
    UserDB,
    UsersHouseholds,
    WeeklyReports,
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
        ).where(
            and_(
                Tasks.household_id == household_id,
                or_(
                    and_(Tasks.created_at >= week_start_dt, Tasks.created_at < week_end_dt),
                    and_(Tasks.started_at >= week_start_dt, Tasks.started_at < week_end_dt),
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
    content: str,
    model: str | None,
    prompt_hash: str,
) -> AISummaries:
    ai_summary = AISummaries(
        household_id=household_id,
        week_start=week_start,
        content=content,
        model=model,
        prompt_hash=prompt_hash,
    )
    db.add(ai_summary)
    return ai_summary


def create_weekly_report(
    db: Session,
    *,
    household_id: UUID,
    week_start,
    week_end,
    stats_json: dict | None,
    summary: str | None = None,
) -> WeeklyReports:
    weekly_report = WeeklyReports(
        household_id=household_id,
        week_start=week_start,
        week_end=week_end,
        stats_json=stats_json,
        summary=summary,
    )
    db.add(weekly_report)
    return weekly_report


def get_weekly_report(db: Session, weekly_report_id: UUID) -> WeeklyReports | None:
    return db.get(WeeklyReports, weekly_report_id)


def fetch_user_weekly_reports(
    db: Session,
    *,
    user_id: UUID,
    household_id: UUID | None = None,
):
    query = (
        select(WeeklyReports)
        .join(UsersHouseholds, UsersHouseholds.household_id == WeeklyReports.household_id)
        .where(UsersHouseholds.user_id == user_id)
    )
    if household_id is not None:
        query = query.where(WeeklyReports.household_id == household_id)
    return db.scalars(query).all()


def fetch_user_monthly_reports(
    db: Session,
    *,
    user_id: UUID,
    household_id: UUID | None = None,
):
    query = (
        select(MonthlyReports)
        .join(UsersHouseholds, UsersHouseholds.household_id == MonthlyReports.household_id)
        .where(UsersHouseholds.user_id == user_id)
    )
    if household_id is not None:
        query = query.where(MonthlyReports.household_id == household_id)
    return db.scalars(query).all()


def fetch_user_daily_reports(
    db: Session,
    *,
    user_id: UUID,
    household_id: UUID | None = None,
):
    query = (
        select(DailyReports)
        .join(UsersHouseholds, UsersHouseholds.household_id == DailyReports.household_id)
        .where(UsersHouseholds.user_id == user_id)
    )
    if household_id is not None:
        query = query.where(DailyReports.household_id == household_id)
    return db.scalars(query).all()
