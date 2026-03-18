from __future__ import annotations

from uuid import UUID

from sqlalchemy import Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class MoodTrackerArtworks(Base):
    __tablename__ = "mood_tracker_artworks"
    __table_args__ = (
        UniqueConstraint(
            "period_type",
            "day_count",
            "cycle_order",
            name="uq_mood_tracker_artworks_type_day_count_cycle_order",
        ),
    )

    mood_tracker_artwork_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    period_type: Mapped[str] = mapped_column(String(20), nullable=False)
    day_count: Mapped[int] = mapped_column(Integer, nullable=False)
    cycle_order: Mapped[int] = mapped_column(Integer, nullable=False)
    image_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source: Mapped[str | None] = mapped_column(String(20), nullable=True)
    svg_markup: Mapped[str | None] = mapped_column(Text, nullable=True)
    region_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))

    def __repr__(self) -> str:
        return (
            "MoodTrackerArtwork("
            f"id={self.mood_tracker_artwork_id!r}, "
            f"period_type={self.period_type!r}, day_count={self.day_count!r}, cycle_order={self.cycle_order!r})"
        )
