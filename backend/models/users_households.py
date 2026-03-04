from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user_db import UserDB
    from .households import Households


class UsersHouseholds(Base):
    __tablename__ = "users_households"
    __table_args__ = (
        CheckConstraint(
            "role IN ('owner', 'admin', 'member')",
            name="users_households_role_check",
        ),
        Index(
            "uq_users_households_single_owner",
            "household_id",
            unique=True,
            postgresql_where=text("role = 'owner'"),
        ),
    )

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
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'member'"),
    )

    user: Mapped[UserDB] = relationship("UserDB", back_populates="households")
    household: Mapped[Households] = relationship("Households", back_populates="users")

    def __repr__(self) -> str:
        return f"UsersHouseholds(user_id={self.user_id!r}, household_id={self.household_id!r}, role={self.role!r})"
