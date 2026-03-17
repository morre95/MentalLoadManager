from uuid import UUID

from fastapi import APIRouter, Depends

from helpers import get_current_user
from models import UserEmail

from .schemas import (
    AchievementsResponse,
    CreateGoalRequest,
    DeleteGoalResponse,
    GoalAICheckinRequest,
    GoalAICheckinResponse,
    GoalsBoardAICheckinRequest,
    GoalsBoardAICheckinResponse,
    GoalResponse,
    GoalsResponse,
    UpdateGoalProgressRequest,
)
from .service import (
    create_my_goal,
    delete_my_goal,
    get_goal_ai_checkin,
    get_goals_board_ai_checkin,
    list_my_achievements,
    list_my_goals,
    update_my_goal_progress,
)

router = APIRouter(prefix="/api/v1/goals", tags=["goals"])


@router.get("", response_model=GoalsResponse)
def list_my_goals_route(current_user: UserEmail = Depends(get_current_user)):
    return list_my_goals(current_user)


@router.get("/achievements", response_model=AchievementsResponse)
def list_my_achievements_route(current_user: UserEmail = Depends(get_current_user)):
    return list_my_achievements(current_user)


@router.post("", response_model=GoalResponse, status_code=201)
def create_my_goal_route(
    payload: CreateGoalRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return create_my_goal(payload, current_user)


@router.patch("/{goal_id}/progress", response_model=GoalResponse)
def update_goal_progress_route(
    goal_id: UUID,
    payload: UpdateGoalProgressRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_my_goal_progress(goal_id, payload, current_user)


@router.post("/ai-checkin", response_model=GoalsBoardAICheckinResponse)
def get_goals_board_ai_checkin_route(
    payload: GoalsBoardAICheckinRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return get_goals_board_ai_checkin(payload, current_user)


@router.post("/{goal_id}/ai-checkin", response_model=GoalAICheckinResponse)
def get_goal_ai_checkin_route(
    goal_id: UUID,
    payload: GoalAICheckinRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return get_goal_ai_checkin(goal_id, payload, current_user)


@router.delete("/{goal_id}", response_model=DeleteGoalResponse)
def delete_goal_route(
    goal_id: UUID,
    current_user: UserEmail = Depends(get_current_user),
):
    return delete_my_goal(goal_id, current_user)
