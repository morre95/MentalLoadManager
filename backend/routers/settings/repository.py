from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from models import NotificationSettings, Preferences, Tasks, UsersHouseholds


def find_notification_settings(
    db: Session, user_id: UUID
) -> NotificationSettings | None:
    return db.scalar(
        select(NotificationSettings).where(NotificationSettings.user_id == user_id)
    )


def create_notification_settings(
    db: Session,
    *,
    user_id: UUID,
    email_notifications: bool,
    task_reminders: bool,
    goal_milestones: bool,
    household_updates: bool,
    weekly_analytics_email: bool,
) -> NotificationSettings:
    settings = NotificationSettings(
        user_id=user_id,
        email_notifications=email_notifications,
        task_reminders=task_reminders,
        goal_milestones=goal_milestones,
        household_updates=household_updates,
        weekly_analytics_email=weekly_analytics_email,
    )
    db.add(settings)
    return settings


def find_preferences(db: Session, user_id: UUID) -> Preferences | None:
    return db.scalar(select(Preferences).where(Preferences.user_id == user_id))


def create_preferences(
    db: Session,
    *,
    user_id: UUID,
    date_format: str,
    first_day_of_week: str,
) -> Preferences:
    preferences = Preferences(
        user_id=user_id,
        date_format=date_format,
        first_day_of_week=first_day_of_week,
    )
    db.add(preferences)
    return preferences


def count_overdue_tasks_for_user(
    db: Session,
    *,
    user_id: UUID,
    open_statuses: tuple[str, ...],
    now,
) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Tasks)
            .join(
                UsersHouseholds,
                and_(
                    UsersHouseholds.household_id == Tasks.household_id,
                    UsersHouseholds.user_id == user_id,
                ),
            )
            .where(
                Tasks.status.in_(open_statuses),
                Tasks.due_date.is_not(None),
                Tasks.due_date < now,
            )
        )
        or 0
    )


def find_oldest_overdue_task_for_user(
    db: Session,
    *,
    user_id: UUID,
    open_statuses: tuple[str, ...],
    now,
):
    return db.execute(
        select(
            Tasks.task_id,
            Tasks.name,
            Tasks.due_date,
        )
        .join(
            UsersHouseholds,
            and_(
                UsersHouseholds.household_id == Tasks.household_id,
                UsersHouseholds.user_id == user_id,
            ),
        )
        .where(
            Tasks.status.in_(open_statuses),
            Tasks.due_date.is_not(None),
            Tasks.due_date < now,
        )
        .order_by(Tasks.due_date.asc(), Tasks.created_at.asc())
        .limit(1)
    ).first()
