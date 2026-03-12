from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class StatItem(BaseModel):
    title: str
    value: str
    previousValue: Optional[str] = None
    change: str
    trend: str
    icon: str
    description: Optional[str] = None


class WeeklyPoint(BaseModel):
    week: str
    values: dict[str, int]


class CategoryPoint(BaseModel):
    name: str
    value: int


class LoadTrendPoint(BaseModel):
    month: str
    load: int


class CompletionPoint(BaseModel):
    day: str
    completed: int
    pending: int


class RadarPoint(BaseModel):
    category: str
    values: dict[str, int]


class AnalyticsSummaryResponse(BaseModel):
    household_id: str
    people: list[str]
    labels: dict[str, str]
    weeklyData: list[WeeklyPoint]
    categoryData: list[CategoryPoint]
    loadTrendData: list[LoadTrendPoint]
    completionData: list[CompletionPoint]
    radarData: list[RadarPoint]
    stats: list[StatItem]


class AnalyticsAIInsightsRequest(BaseModel):
    household_id: UUID | None = None
    timeframe: Literal["7d", "30d", "12w"] = "30d"
    refresh: bool = False


class AnalyticsRiskItem(BaseModel):
    title: str
    severity: Literal["low", "medium", "high"]
    reason: str


class AnalyticsRecommendationItem(BaseModel):
    title: str
    action: str
    priority: Literal["low", "medium", "high"]


class AnalyticsAIInsightsResponse(BaseModel):
    household_id: str
    timeframe: Literal["7d", "30d", "12w"]
    generated_at: datetime
    summary: str
    risks: list[AnalyticsRiskItem] = Field(default_factory=list)
    recommendations: list[AnalyticsRecommendationItem] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    confidence: Literal["low", "medium", "high"]
    cached: bool = False
    model: str | None = None
