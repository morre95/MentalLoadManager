from datetime import datetime
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


class TaskReminderSummaryResponse(BaseModel):
    task_reminders_enabled: bool
    should_notify: bool
    overdue_task_count: int
    oldest_overdue_task_id: str | None = None
    oldest_overdue_task_name: str | None = None
    oldest_overdue_task_due_date: datetime | None = None


class PreferencesResponse(BaseModel):
    date_format: Literal["mdy", "dmy", "ymd"]
    first_day_of_week: Literal["sunday", "monday", "saturday"]


class UpdatePreferencesRequest(BaseModel):
    date_format: Literal["mdy", "dmy", "ymd"]
    first_day_of_week: Literal["sunday", "monday", "saturday"]
