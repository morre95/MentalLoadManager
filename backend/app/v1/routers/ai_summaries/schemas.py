from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class GenerateWeeklySummaryRequest(BaseModel):
    household_id: UUID
    period_type: Literal["weekly", "monthly"] = "weekly"
    week_start: date | None = None
    year: int | None = None
    month: int | None = None
    model: str | None = None


class WeeklySummaryResponse(BaseModel):
    ai_summary_id: str
    household_id: str
    period_type: Literal["weekly", "monthly"] = "weekly"
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
    household_name: str
    period_type: Literal["weekly", "monthly"] = "weekly"
    week_start: date
    week_end: date
    granted_at: date | None = None
    status: Literal["pending", "completed", "failed"]
    model: str = ""
    content: str | None = None
    error: str | None = None


class SavedSummariesListResponse(BaseModel):
    summaries: list[SavedSummaryItemResponse]


class SummaryDeleteResponse(BaseModel):
    ai_summary_id: str
    deleted: bool


class WeeklySummaryEmailDispatchResponse(BaseModel):
    dispatch_date: date
    first_day_of_week: str
    week_start: date
    week_end: date
    users_targeted: int
    households_targeted: int
    jobs_enqueued: int
    jobs_skipped: int
