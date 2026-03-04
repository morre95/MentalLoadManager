from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .households import Households


class AISummaries(Base):
    __tablename__ = "ai_summaries"

    ai_summary_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("households.household_id", ondelete="CASCADE"),
        nullable=False,
    )
    week_start: Mapped[date | None] = mapped_column(Date)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    model: Mapped[str | None] = mapped_column(String(100))
    prompt_hash: Mapped[str | None] = mapped_column(Text)

    household: Mapped[Households] = relationship(
        "Households", back_populates="ai_summaries"
    )

    def __repr__(self) -> str:
        return f"AISummary(id={self.ai_summary_id!r}, household_id={self.household_id!r}, week_start={self.week_start!r}, model={self.model!r})"
