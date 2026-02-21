from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, PrimaryKeyConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user_db import UserDB
    from .tasks import Tasks


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
