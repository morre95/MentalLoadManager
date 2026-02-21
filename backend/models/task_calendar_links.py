from __future__ import annotations

from typing import TYPE_CHECKING
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .tasks import Tasks
    from .calendar_connections import CalendarConnections


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
