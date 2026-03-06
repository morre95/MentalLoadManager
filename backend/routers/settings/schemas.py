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
