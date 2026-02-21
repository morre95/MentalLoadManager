from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user_db import UserDB


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
