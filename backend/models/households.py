from __future__ import annotations

from typing import TYPE_CHECKING
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


if TYPE_CHECKING:
    from .users_households import UsersHouseholds
    from .invitations import Invitations
    from .categories import Categories
    from .reminders import Reminders
    from .tasks import Tasks
    from .ai_summaries import AISummaries
    from .daily_reports import DailyReports
    from .weekly_reports import WeeklyReports
    from .monthly_reports import MonthlyReports


class Households(Base):
    __tablename__ = "households"

    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    users: Mapped[list[UsersHouseholds]] = relationship(
        "UsersHouseholds", back_populates="household", cascade="all, delete-orphan"
    )
    categories: Mapped[list[Categories]] = relationship(
        "Categories", back_populates="household", cascade="all, delete-orphan"
    )
    tasks: Mapped[list[Tasks]] = relationship(
        "Tasks", back_populates="household", cascade="all, delete-orphan"
    )
    invitations: Mapped[list[Invitations]] = relationship(
        "Invitations", back_populates="household", cascade="all, delete-orphan"
    )
    reminders: Mapped[list[Reminders]] = relationship(
        "Reminders", back_populates="household", cascade="all, delete-orphan"
    )
    weekly_reports: Mapped[list[WeeklyReports]] = relationship(
        "WeeklyReports", back_populates="household", cascade="all, delete-orphan"
    )
    monthly_reports: Mapped[list[MonthlyReports]] = relationship(
        "MonthlyReports", back_populates="household", cascade="all, delete-orphan"
    )
    daily_reports: Mapped[list[DailyReports]] = relationship(
        "DailyReports", back_populates="household", cascade="all, delete-orphan"
    )
    ai_summaries: Mapped[list[AISummaries]] = relationship(
        "AISummaries", back_populates="household", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"Household(id={self.household_id!r}, name={self.name!r})"
