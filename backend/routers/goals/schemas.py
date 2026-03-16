from typing import Any
from datetime import datetime

from pydantic import BaseModel, Field


class GoalResponse(BaseModel):
    goal_id: str
    type: str
    name: str
    current_value: int
    target_value: int
    tracking_style: str
    progress_data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None
    is_recurring: bool = False
    period_key: str | None = None
    period_start: datetime | None = None
    period_end: datetime | None = None
    current_streak: int = 0
    best_streak: int = 0
    completed_periods: int = 0
    history: list["GoalHistoryResponse"] = Field(default_factory=list)


class GoalsResponse(BaseModel):
    goals: list[GoalResponse]


class GoalHistoryResponse(BaseModel):
    goal_history_id: str
    tracking_style: str
    period_key: str
    period_started_at: datetime | None
    period_ended_at: datetime | None
    current_value: int
    target_value: int
    completed: bool
    created_at: datetime | None


class AchievementResponse(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    current: int
    target: int
    category: str
    completed: bool = False
    entity_id: str | None = None
    completion_key: str | None = None
    unlocked_at: datetime | None = None
    rarity: str = "common"


class AchievementsResponse(BaseModel):
    achievements: list[AchievementResponse]
    timeline: list["AchievementTimelineResponse"] = Field(default_factory=list)


class AchievementTimelineResponse(BaseModel):
    achievement_unlock_id: str
    achievement_id: str
    title: str
    category: str
    rarity: str
    entity_id: str | None = None
    unlocked_at: datetime | None = None


class CreateGoalRequest(BaseModel):
    type: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    target_value: int = Field(gt=0)
    tracking_style: str
    current_value: int = Field(default=0, ge=0)
    progress_data: dict[str, Any] = Field(default_factory=dict)


class UpdateGoalProgressRequest(BaseModel):
    current_value: int = Field(ge=0)
    progress_data: dict[str, Any] | None = None


class DeleteGoalResponse(BaseModel):
    goal_id: str
    deleted: bool


class GoalAICheckinRequest(BaseModel):
    refresh: bool = False


class GoalAICheckinResponse(BaseModel):
    goal_id: str
    status_summary: str
    pace_needed: str
    risk_level: str
    next_step: str
    adjustment_suggestion: str
    evidence: list[str] = Field(default_factory=list)
    cached: bool = False
    model: str | None = None
    generated_at: datetime


class GoalsBoardAICheckinRequest(BaseModel):
    refresh: bool = False


class GoalsBoardAICheckinResponse(BaseModel):
    headline: str
    summary: str
    priorities: list[str] = Field(default_factory=list)
    wins: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    model: str | None = None
    generated_at: datetime


GoalResponse.model_rebuild()
AchievementsResponse.model_rebuild()
