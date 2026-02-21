from __future__ import annotations

from typing import TYPE_CHECKING

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .calendar_connections import CalendarConnections
    from .invitations import Invitations
    from .oauth_accounts import OAuthAccounts
    from .preferences import Preferences
    from .reminders import Reminders
    from .tasks import Tasks
    from .user_task import UserTask
    from .users_households import UsersHouseholds


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
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
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
