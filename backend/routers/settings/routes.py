from fastapi import APIRouter, Depends

from helpers import get_current_user
from models import UserEmail

from .schemas import NotificationSettingsResponse, UpdateNotificationSettingsRequest
from .service import get_my_notification_settings, update_my_notification_settings

router = APIRouter(
    prefix="/api/users/me",
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
