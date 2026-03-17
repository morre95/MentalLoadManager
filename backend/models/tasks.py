from __future__ import annotations

from typing import TYPE_CHECKING
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .categories import Categories
    from .households import Households
    from .task_attachment import TaskAttachment
    from .task_calendar_links import TaskCalendarLinks
    from .user_db import UserDB
    from .user_task import UserTask


class Tasks(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('todo', 'in_progress', 'done', 'on_hold', 'archive')",
            name="tasks_status_check",
        ),
        Index("idx_tasks_household_id", "household_id"),
        Index("idx_tasks_status", "status"),
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
    recurrence_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("FALSE")
    )
    recurrence_frequency: Mapped[str | None] = mapped_column(String(20))
    recurrence_interval: Mapped[int | None] = mapped_column(Integer)
    recurrence_parent_task_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.task_id", ondelete="SET NULL"),
        nullable=True,
    )
    recurrence_exceptions: Mapped[list[date] | None] = mapped_column(
        ARRAY(Date),
        nullable=True,
    )
    order: Mapped[int | None] = mapped_column(Integer)
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

    def __repr__(self) -> str:
        return f"Task(id={self.task_id!r}, name={self.name!r})"
