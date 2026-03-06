from fastapi import HTTPException, status

from helpers import get_session_local
from models import UserEmail

from .repository import create_notification_settings, find_notification_settings
from .schemas import NotificationSettingsResponse, UpdateNotificationSettingsRequest


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
