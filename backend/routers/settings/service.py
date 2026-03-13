from datetime import datetime, timezone

from fastapi import HTTPException, status

from helpers import get_session_local
from models import UserEmail

from .repository import (
    count_overdue_tasks_for_user,
    create_notification_settings,
    create_preferences,
    find_notification_settings,
    find_oldest_overdue_task_for_user,
    find_preferences,
)
from .schemas import (
    NotificationSettingsResponse,
    PreferencesResponse,
    TaskReminderSummaryResponse,
    UpdateNotificationSettingsRequest,
    UpdatePreferencesRequest,
)

OPEN_TASK_STATUSES = ("todo", "in_progress", "on_hold")


def get_my_notification_settings(
    current_user: UserEmail,
) -> NotificationSettingsResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        settings = find_notification_settings(db, current_user.user_id)
        if not settings:
            settings = create_notification_settings(
                db,
                user_id=current_user.user_id,
                email_notifications=True,
                task_reminders=True,
                goal_milestones=True,
                household_updates=False,
                weekly_analytics_email=True,
            )
            db.commit()
            db.refresh(settings)

        return NotificationSettingsResponse(
            email_notifications=settings.email_notifications,
            task_reminders=settings.task_reminders,
            goal_milestones=settings.goal_milestones,
            household_updates=settings.household_updates,
            weekly_analytics_email=settings.weekly_analytics_email,
        )


def get_my_task_reminder_summary(
    current_user: UserEmail,
) -> TaskReminderSummaryResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        settings = find_notification_settings(db, current_user.user_id)
        task_reminders_enabled = bool(settings.task_reminders) if settings else True

        if not task_reminders_enabled:
            return TaskReminderSummaryResponse(
                task_reminders_enabled=False,
                should_notify=False,
                overdue_task_count=0,
            )

        now = datetime.now(timezone.utc)
        overdue_task_count = count_overdue_tasks_for_user(
            db,
            user_id=current_user.user_id,
            open_statuses=OPEN_TASK_STATUSES,
            now=now,
        )

        if overdue_task_count <= 0:
            return TaskReminderSummaryResponse(
                task_reminders_enabled=True,
                should_notify=False,
                overdue_task_count=0,
            )

        oldest_overdue_task = find_oldest_overdue_task_for_user(
            db,
            user_id=current_user.user_id,
            open_statuses=OPEN_TASK_STATUSES,
            now=now,
        )

        return TaskReminderSummaryResponse(
            task_reminders_enabled=True,
            should_notify=True,
            overdue_task_count=overdue_task_count,
            oldest_overdue_task_id=(
                str(oldest_overdue_task.task_id) if oldest_overdue_task else None
            ),
            oldest_overdue_task_name=(
                oldest_overdue_task.name if oldest_overdue_task else None
            ),
            oldest_overdue_task_due_date=(
                oldest_overdue_task.due_date if oldest_overdue_task else None
            ),
        )


def update_my_notification_settings(
    payload: UpdateNotificationSettingsRequest,
    current_user: UserEmail,
) -> NotificationSettingsResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        settings = find_notification_settings(db, current_user.user_id)
        if not settings:
            settings = create_notification_settings(
                db,
                user_id=current_user.user_id,
                email_notifications=payload.email_notifications,
                task_reminders=payload.task_reminders,
                goal_milestones=payload.goal_milestones,
                household_updates=payload.household_updates,
                weekly_analytics_email=payload.weekly_analytics_email,
            )
        else:
            settings.email_notifications = payload.email_notifications
            settings.task_reminders = payload.task_reminders
            settings.goal_milestones = payload.goal_milestones
            settings.household_updates = payload.household_updates
            settings.weekly_analytics_email = payload.weekly_analytics_email

        db.commit()
        db.refresh(settings)

        return NotificationSettingsResponse(
            email_notifications=settings.email_notifications,
            task_reminders=settings.task_reminders,
            goal_milestones=settings.goal_milestones,
            household_updates=settings.household_updates,
            weekly_analytics_email=settings.weekly_analytics_email,
        )


def get_my_preferences(current_user: UserEmail) -> PreferencesResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        preferences = find_preferences(db, current_user.user_id)
        if not preferences:
            preferences = create_preferences(
                db,
                user_id=current_user.user_id,
                date_format="mdy",
                first_day_of_week="monday",
            )
            db.commit()
            db.refresh(preferences)

        return PreferencesResponse(
            date_format=preferences.date_format,
            first_day_of_week=preferences.first_day_of_week,
        )


def update_my_preferences(
    payload: UpdatePreferencesRequest,
    current_user: UserEmail,
) -> PreferencesResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        preferences = find_preferences(db, current_user.user_id)
        if not preferences:
            preferences = create_preferences(
                db,
                user_id=current_user.user_id,
                date_format=payload.date_format,
                first_day_of_week=payload.first_day_of_week,
            )
        else:
            preferences.date_format = payload.date_format
            preferences.first_day_of_week = payload.first_day_of_week

        db.commit()
        db.refresh(preferences)

        return PreferencesResponse(
            date_format=preferences.date_format,
            first_day_of_week=preferences.first_day_of_week,
        )
