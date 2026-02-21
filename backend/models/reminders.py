from __future__ import annotations

from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .user_db import UserDB
from .households import Households


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
