from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .households import Households


class AnalyticsAIInsightsCache(Base):
    __tablename__ = "analytics_ai_insights_cache"

    analytics_ai_insight_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("households.household_id", ondelete="CASCADE"),
        nullable=False,
    )
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False)
    input_hash: Mapped[str] = mapped_column(Text, nullable=False)
    content_json: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    model: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        server_onupdate=text("NOW()"),
    )

    household: Mapped[Households] = relationship(
        "Households",
        back_populates="analytics_ai_insights",
    )

    def __repr__(self) -> str:
        return (
            "AnalyticsAIInsightsCache("
            f"id={self.analytics_ai_insight_id!r}, household_id={self.household_id!r}, "
            f"timeframe={self.timeframe!r}, model={self.model!r})"
        )
