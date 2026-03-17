from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class GenerateWeeklySummaryRequest(BaseModel):
    household_id: UUID
    week_start: date | None = None


class WeeklySummaryResponse(BaseModel):
    ai_summary_id: str
    household_id: str
    week_start: date
    week_end: date
    status: Literal["pending", "completed", "failed"]
    model: str
    content: str | None = None
    prompt_hash: str | None = None
    error: str | None = None


class SavedSummaryItemResponse(BaseModel):
    ai_summary_id: str
    household_id: str
    week_start: date
    week_end: date
    granted_at: date | None = None
    status: Literal["pending", "completed", "failed"]
    model: str = ""
    content: str | None = None
    error: str | None = None


class SavedSummariesListResponse(BaseModel):
    summaries: list[SavedSummaryItemResponse]
