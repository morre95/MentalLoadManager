from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID
from datetime import datetime


from sqlalchemy import ForeignKey, String, UniqueConstraint, text, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .tasks import Tasks
    from .households import Households


class Categories(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("household_id", "name", name="uq_categories_household_name"),
    )

    category_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    household_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("households.household_id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    household: Mapped[Households] = relationship(
        "Households", back_populates="categories"
    )
    tasks: Mapped[list[Tasks]] = relationship("Tasks", back_populates="category")

    def __repr__(self) -> str:
        return f"Category(id={self.category_id!r}, name={self.name!r}, household_id={self.household_id!r})"
