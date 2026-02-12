from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Token(BaseModel):
    access_token: str
    token_type: str


class User(BaseModel):
    username: str


class UserDB(Base):
    __tablename__ = "users"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    households: Mapped[list[UsersHouseholds]] = relationship(
        "UsersHouseholds", back_populates="user", cascade="all, delete-orphan"
    )
    preference: Mapped[Preferences | None] = relationship(
        "Preferences",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    oauth_accounts: Mapped[list[OAuthAccounts]] = relationship(
        "OAuthAccounts", back_populates="user", cascade="all, delete-orphan"
    )
    calendar_connections: Mapped[list[CalendarConnections]] = relationship(
        "CalendarConnections", back_populates="user", cascade="all, delete-orphan"
    )
    assigned_tasks: Mapped[list[Tasks]] = relationship(
        "Tasks", foreign_keys="Tasks.assigns_to", back_populates="assignee"
    )
    created_tasks: Mapped[list[Tasks]] = relationship(
        "Tasks", foreign_keys="Tasks.created_by", back_populates="creator"
    )
    user_tasks: Mapped[list[UserTask]] = relationship(
        "UserTask", back_populates="user", cascade="all, delete-orphan"
    )
    created_invitations: Mapped[list[Invitations]] = relationship(
        "Invitations", back_populates="created_by_user"
    )
    reminders: Mapped[list[Reminders]] = relationship(
        "Reminders", back_populates="user", cascade="all, delete-orphan"
    )


class Households(Base):
    __tablename__ = "households"

    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    users: Mapped[list[UsersHouseholds]] = relationship(
        "UsersHouseholds", back_populates="household", cascade="all, delete-orphan"
    )
    categories: Mapped[list[Categories]] = relationship(
        "Categories", back_populates="household", cascade="all, delete-orphan"
    )
    tasks: Mapped[list[Tasks]] = relationship(
        "Tasks", back_populates="household", cascade="all, delete-orphan"
    )
    invitations: Mapped[list[Invitations]] = relationship(
        "Invitations", back_populates="household", cascade="all, delete-orphan"
    )
    reminders: Mapped[list[Reminders]] = relationship(
        "Reminders", back_populates="household", cascade="all, delete-orphan"
    )
    weekly_reports: Mapped[list[WeeklyReports]] = relationship(
        "WeeklyReports", back_populates="household", cascade="all, delete-orphan"
    )
    monthly_reports: Mapped[list[MonthlyReports]] = relationship(
        "MonthlyReports", back_populates="household", cascade="all, delete-orphan"
    )
    daily_reports: Mapped[list[DailyReports]] = relationship(
        "DailyReports", back_populates="household", cascade="all, delete-orphan"
    )
    ai_summaries: Mapped[list[AISummaries]] = relationship(
        "AISummaries", back_populates="household", cascade="all, delete-orphan"
    )


class UsersHouseholds(Base):
    __tablename__ = "users_households"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        primary_key=True,
    )
    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("households.household_id", ondelete="CASCADE"),
        primary_key=True,
    )

    user: Mapped[UserDB] = relationship("UserDB", back_populates="households")
    household: Mapped[Households] = relationship("Households", back_populates="users")


class Preferences(Base):
    __tablename__ = "preferences"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        primary_key=True,
    )
    weekly_digest_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("FALSE")
    )
    monthly_digest_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("FALSE")
    )
    reminder_minutes_default: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("60")
    )
    timezone: Mapped[str | None] = mapped_column(Text, server_default=text("'UTC'"))

    user: Mapped[UserDB] = relationship("UserDB", back_populates="preference")


class OAuthAccounts(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (UniqueConstraint("provider", "provider_user_id"),)

    oauth_accounts_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    access_token: Mapped[str | None] = mapped_column(Text)
    refresh_token: Mapped[str | None] = mapped_column(Text)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    user: Mapped[UserDB] = relationship("UserDB", back_populates="oauth_accounts")


class CalendarConnections(Base):
    __tablename__ = "calendar_connections"

    calendar_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    calendar_ext_id: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    timezone: Mapped[str | None] = mapped_column(Text, server_default=text("'UTC'"))
    is_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("TRUE")
    )
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    user: Mapped[UserDB] = relationship("UserDB", back_populates="calendar_connections")
    task_links: Mapped[list[TaskCalendarLinks]] = relationship(
        "TaskCalendarLinks", back_populates="connection", cascade="all, delete-orphan"
    )


class Categories(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("household_id", "name", name="uq_categories_household_name"),
    )

    category_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("households.household_id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    household: Mapped[Households] = relationship(
        "Households", back_populates="categories"
    )
    tasks: Mapped[list[Tasks]] = relationship("Tasks", back_populates="category")


class Tasks(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('todo', 'in_progress', 'done', 'on_hold')",
            name="tasks_status_check",
        ),
    )

    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    priority: Mapped[str | None] = mapped_column(String(50))
    category_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("categories.category_id", ondelete="SET NULL"),
        nullable=True,
    )
    complete_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    assigns_to: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("households.household_id", ondelete="CASCADE"),
        nullable=False,
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    category: Mapped[Categories | None] = relationship(
        "Categories", back_populates="tasks"
    )
    assignee: Mapped[UserDB | None] = relationship(
        "UserDB", foreign_keys=[assigns_to], back_populates="assigned_tasks"
    )
    creator: Mapped[UserDB | None] = relationship(
        "UserDB", foreign_keys=[created_by], back_populates="created_tasks"
    )
    household: Mapped[Households] = relationship("Households", back_populates="tasks")
    calendar_links: Mapped[list[TaskCalendarLinks]] = relationship(
        "TaskCalendarLinks", back_populates="task", cascade="all, delete-orphan"
    )
    users: Mapped[list[UserTask]] = relationship(
        "UserTask", back_populates="task", cascade="all, delete-orphan"
    )
    attachments: Mapped[list[TaskAttachment]] = relationship(
        "TaskAttachment", back_populates="task", cascade="all, delete-orphan"
    )


class TaskCalendarLinks(Base):
    __tablename__ = "task_calendar_links"
    __table_args__ = (UniqueConstraint("task_id", "connection_id"),)

    task_link_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.task_id", ondelete="CASCADE"),
        nullable=False,
    )
    connection_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("calendar_connections.calendar_id", ondelete="CASCADE"),
        nullable=False,
    )
    provider_event_id: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    prompt_hash: Mapped[str | None] = mapped_column(Text)
    sync_status: Mapped[str | None] = mapped_column(
        String(50), server_default=text("'NOT_SYNCED'")
    )
    sync_error: Mapped[str | None] = mapped_column(Text)

    task: Mapped[Tasks] = relationship("Tasks", back_populates="calendar_links")
    connection: Mapped[CalendarConnections] = relationship(
        "CalendarConnections", back_populates="task_links"
    )


class UserTask(Base):
    __tablename__ = "user_task"
    __table_args__ = (PrimaryKeyConstraint("user_id", "task_id"),)

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE")
    )
    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE")
    )

    user: Mapped[UserDB] = relationship("UserDB", back_populates="user_tasks")
    task: Mapped[Tasks] = relationship("Tasks", back_populates="users")


class TaskAttachment(Base):
    __tablename__ = "task_attachment"

    task_attachment_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.task_id", ondelete="CASCADE"),
        nullable=False,
    )
    url: Mapped[str | None] = mapped_column(Text)
    file: Mapped[str | None] = mapped_column(Text)
    type: Mapped[str | None] = mapped_column(String(50))

    task: Mapped[Tasks] = relationship("Tasks", back_populates="attachments")


class Invitations(Base):
    __tablename__ = "invitations"

    invitation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("households.household_id", ondelete="CASCADE"),
        nullable=False,
    )
    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )

    household: Mapped[Households] = relationship(
        "Households", back_populates="invitations"
    )
    created_by_user: Mapped[UserDB | None] = relationship(
        "UserDB", back_populates="created_invitations"
    )


class Reminders(Base):
    __tablename__ = "reminders"

    reminder_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("households.household_id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    minutes_before_due: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("60")
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("TRUE")
    )

    household: Mapped[Households] = relationship(
        "Households", back_populates="reminders"
    )
    user: Mapped[UserDB] = relationship("UserDB", back_populates="reminders")


class WeeklyReports(Base):
    __tablename__ = "weekly_reports"

    weekly_report_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("households.household_id", ondelete="CASCADE"),
        nullable=False,
    )
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    week_end: Mapped[date] = mapped_column(Date, nullable=False)
    granted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    stats_json: Mapped[dict | None] = mapped_column(JSONB)
    summary: Mapped[str | None] = mapped_column(Text)

    household: Mapped[Households] = relationship(
        "Households", back_populates="weekly_reports"
    )


class MonthlyReports(Base):
    __tablename__ = "monthly_reports"

    monthly_report_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("households.household_id", ondelete="CASCADE"),
        nullable=False,
    )
    month_start: Mapped[date] = mapped_column(Date, nullable=False)
    month_end: Mapped[date] = mapped_column(Date, nullable=False)
    granted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    stats_json: Mapped[dict | None] = mapped_column(JSONB)
    summary: Mapped[str | None] = mapped_column(Text)

    household: Mapped[Households] = relationship(
        "Households", back_populates="monthly_reports"
    )


class DailyReports(Base):
    __tablename__ = "daily_reports"

    daily_report_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("households.household_id", ondelete="CASCADE"),
        nullable=False,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    granted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    stats_json: Mapped[dict | None] = mapped_column(JSONB)
    summary: Mapped[str | None] = mapped_column(Text)

    household: Mapped[Households] = relationship(
        "Households", back_populates="daily_reports"
    )


class AISummaries(Base):
    __tablename__ = "ai_summaries"

    ai_summary_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("households.household_id", ondelete="CASCADE"),
        nullable=False,
    )
    week_start: Mapped[date | None] = mapped_column(Date)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    model: Mapped[str | None] = mapped_column(String(100))
    prompt_hash: Mapped[str | None] = mapped_column(Text)

    household: Mapped[Households] = relationship(
        "Households", back_populates="ai_summaries"
    )
    
class ContactMessages(Base):
    __tablename__ = "contact_messages"

    contact_message_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
    )

__all__ = [
    "Base",
    "Token",
    "User",
    "UserDB",
    "Households",
    "UsersHouseholds",
    "Preferences",
    "OAuthAccounts",
    "CalendarConnections",
    "Categories",
    "Tasks",
    "TaskCalendarLinks",
    "UserTask",
    "TaskAttachment",
    "Invitations",
    "Reminders",
    "WeeklyReports",
    "MonthlyReports",
    "DailyReports",
    "AISummaries",
    "ContactMessages",
]
