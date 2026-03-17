from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class MoodEntries(Base):
    __tablename__ = "mood_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "entry_date", name="uq_mood_entries_user_date"),
        CheckConstraint(
            "char_length(color_token) > 0",
            name="mood_entries_color_token_non_empty_check",
        ),
    )

    mood_entry_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    color_token: Mapped[str] = mapped_column(String(50), nullable=False)
    mood_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    weekly_region_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    monthly_region_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
    )

    def __repr__(self) -> str:
        return f"MoodEntry(id={self.mood_entry_id!r}, user_id={self.user_id!r}, entry_date={self.entry_date!r})"
