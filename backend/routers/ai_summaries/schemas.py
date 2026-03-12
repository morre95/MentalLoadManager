from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class GenerateWeeklySummaryRequest(BaseModel):
    household_id: UUID
    week_start: date | None = None


class WeeklySummaryReportResponse(BaseModel):
    weekly_report_id: str
    household_id: str
    week_start: date
    week_end: date
    status: Literal["pending", "completed", "failed"]
    model: str
    content: str | None = None
    prompt_hash: str | None = None
    error: str | None = None


class SavedReportItemResponse(BaseModel):
    report_type: Literal["daily", "weekly", "monthly"]
    report_id: str
    household_id: str
    start_date: date
    end_date: date
    granted_at: date | None = None
    status: Literal["pending", "completed", "failed"]
    model: str = ""
    content: str | None = None
    error: str | None = None


class SavedReportsListResponse(BaseModel):
    reports: list[SavedReportItemResponse]
