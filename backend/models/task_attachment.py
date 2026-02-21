from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .tasks import Tasks


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
