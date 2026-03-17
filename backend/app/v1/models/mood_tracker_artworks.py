from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class MoodTrackerArtworks(Base):
    __tablename__ = "mood_tracker_artworks"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "period_type",
            "period_key",
            name="uq_mood_tracker_artworks_user_period",
        ),
    )

    mood_tracker_artwork_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    period_type: Mapped[str] = mapped_column(String(20), nullable=False)
    period_key: Mapped[str] = mapped_column(String(40), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    image_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'pending'"))
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    svg_markup: Mapped[str | None] = mapped_column(Text, nullable=True)
    region_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    prompt_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
    )

    def __repr__(self) -> str:
        return (
            "MoodTrackerArtwork("
            f"id={self.mood_tracker_artwork_id!r}, user_id={self.user_id!r}, "
            f"period_key={self.period_key!r}, period_type={self.period_type!r})"
        )
