from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Goals(Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint(
            "tracking_style IN ('daily', 'weekly', 'total')",
            name="goals_tracking_style_check",
        ),
        CheckConstraint(
            "current_value >= 0",
            name="goals_current_value_non_negative_check",
        ),
        CheckConstraint(
            "target_value > 0",
            name="goals_target_value_positive_check",
        ),
    )

    goal_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    current_value: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
    )
    target_value: Mapped[int] = mapped_column(Integer, nullable=False)
    tracking_style: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
    )

    def __repr__(self) -> str:
        return f"Goal(id={self.goal_id!r}, user_id={self.user_id!r}, name={self.name!r})"
