from typing import Literal

from pydantic import BaseModel


class NotificationSettingsResponse(BaseModel):
    email_notifications: bool
    task_reminders: bool
    goal_milestones: bool
    household_updates: bool
    weekly_analytics_email: bool


class UpdateNotificationSettingsRequest(BaseModel):
    email_notifications: bool
    task_reminders: bool
    goal_milestones: bool
    household_updates: bool
    weekly_analytics_email: bool


class PreferencesResponse(BaseModel):
    date_format: Literal["mdy", "dmy", "ymd"]
    first_day_of_week: Literal["sunday", "monday", "saturday"]


class UpdatePreferencesRequest(BaseModel):
    date_format: Literal["mdy", "dmy", "ymd"]
    first_day_of_week: Literal["sunday", "monday", "saturday"]
