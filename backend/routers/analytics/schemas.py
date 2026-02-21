from pydantic import BaseModel


class StatItem(BaseModel):
    title: str
    value: str
    change: str
    trend: str
    icon: str


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
