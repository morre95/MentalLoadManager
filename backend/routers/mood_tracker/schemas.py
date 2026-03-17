from datetime import date
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


PeriodType = Literal["weekly", "monthly"]


class MoodTrackerDayResponse(BaseModel):
    date: date
    color_token: str
    mood_label: str | None = None
    region_id: str


class MoodTrackerDateStatusResponse(BaseModel):
    date: date
    is_painted: bool
    is_future: bool
    color_token: str | None = None
    mood_label: str | None = None


class MoodTrackerPeriodResponse(BaseModel):
    period_type: PeriodType
    period_key: str
    period_label: str
    anchor_date: date
    start_date: date
    end_date: date
    image_id: str | None = None
    artwork_source: str | None = None
    artwork_status: Literal["pending", "in_progress", "completed", "failed"] = "pending"
    artwork_error: str | None = None
    artwork_generated_at: datetime | None = None
    svg_markup: str | None = None
    region_ids: list[str]
    painted_days: list[MoodTrackerDayResponse]
    dates: list[MoodTrackerDateStatusResponse]


class UpsertMoodEntryRequest(BaseModel):
    period_type: PeriodType
    entry_date: date
    color_token: str = Field(min_length=1, max_length=50)
    mood_label: str | None = Field(default=None, max_length=50)
    region_id: str = Field(min_length=1, max_length=50)
