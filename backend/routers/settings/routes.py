from fastapi import APIRouter, Depends

from helpers import get_current_user
from models import UserEmail

from .schemas import (
    NotificationSettingsResponse,
    PreferencesResponse,
    TaskReminderSummaryResponse,
    UpdateNotificationSettingsRequest,
    UpdatePreferencesRequest,
)
from .service import (
    get_my_notification_settings,
    get_my_task_reminder_summary,
    get_my_preferences,
    update_my_notification_settings,
    update_my_preferences,
)

router = APIRouter(
    prefix="/api/settings",
    tags=["settings"],
)


@router.get("/notification-settings", response_model=NotificationSettingsResponse)
def read_my_notification_settings(current_user: UserEmail = Depends(get_current_user)):
    return get_my_notification_settings(current_user)


@router.patch("/notification-settings", response_model=NotificationSettingsResponse)
def update_users_me_notification_settings(
    payload: UpdateNotificationSettingsRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_my_notification_settings(payload, current_user)


@router.get(
    "/notification-settings/task-reminders/overdue-summary",
    response_model=TaskReminderSummaryResponse,
)
def read_my_task_reminder_summary(
    current_user: UserEmail = Depends(get_current_user),
):
    return get_my_task_reminder_summary(current_user)


@router.get("/preferences", response_model=PreferencesResponse)
def read_my_preferences(current_user: UserEmail = Depends(get_current_user)):
    return get_my_preferences(current_user)


@router.patch("/preferences", response_model=PreferencesResponse)
def update_users_me_preferences(
    payload: UpdatePreferencesRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_my_preferences(payload, current_user)
