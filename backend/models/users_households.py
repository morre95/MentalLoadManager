from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .user_db import UserDB
from .households import Households


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
