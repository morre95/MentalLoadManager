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


class GoalsResponse(BaseModel):
    goals: list[GoalResponse]


class AchievementResponse(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    current: int
    target: int
    category: str


class AchievementsResponse(BaseModel):
    achievements: list[AchievementResponse]


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
