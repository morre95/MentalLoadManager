from datetime import date
from uuid import UUID

from pydantic import BaseModel


class GenerateWeeklySummaryRequest(BaseModel):
    household_id: UUID
    week_start: date | None = None


class GenerateWeeklySummaryResponse(BaseModel):
    ai_summary_id: str
    household_id: str
    week_start: date
    model: str
    content: str
    prompt_hash: str
