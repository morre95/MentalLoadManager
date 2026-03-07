from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from helpers import get_session_local
from models import UserEmail

from .repository import create_goal, get_goal_for_user, list_goals_for_user
from .schemas import (
    CreateGoalRequest,
    DeleteGoalResponse,
    GoalResponse,
    GoalsResponse,
    UpdateGoalProgressRequest,
)

ALLOWED_TRACKING_STYLES = {"daily", "weekly", "total"}


def _to_goal_response(goal) -> GoalResponse:
    return GoalResponse(
        goal_id=str(goal.goal_id),
        type=goal.type,
        name=goal.name,
        current_value=goal.current_value,
        target_value=goal.target_value,
        tracking_style=goal.tracking_style,
        created_at=goal.created_at,
    )


def list_my_goals(current_user: UserEmail) -> GoalsResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        goals = list_goals_for_user(db, current_user.user_id)
        return GoalsResponse(goals=[_to_goal_response(goal) for goal in goals])


def create_my_goal(payload: CreateGoalRequest, current_user: UserEmail) -> GoalResponse:
    tracking_style = payload.tracking_style.strip().lower()
    if tracking_style not in ALLOWED_TRACKING_STYLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tracking_style must be one of: daily, weekly, total",
        )

    goal_type = payload.type.strip().lower()
    name = payload.name.strip()

    if not goal_type or not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Goal type and name are required",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        goal = create_goal(
            db,
            user_id=current_user.user_id,
            type=goal_type,
            name=name,
            current_value=payload.current_value,
            target_value=payload.target_value,
            tracking_style=tracking_style,
        )

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to create goal",
            ) from exc

        db.refresh(goal)
        return _to_goal_response(goal)


def update_my_goal_progress(
    goal_id: UUID,
    payload: UpdateGoalProgressRequest,
    current_user: UserEmail,
) -> GoalResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        goal = get_goal_for_user(db, goal_id, current_user.user_id)
        if goal is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal was not found",
            )

        goal.current_value = payload.current_value
        goal.updated_at = datetime.now(timezone.utc)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update goal progress",
            ) from exc

        db.refresh(goal)
        return _to_goal_response(goal)


def delete_my_goal(goal_id: UUID, current_user: UserEmail) -> DeleteGoalResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        goal = get_goal_for_user(db, goal_id, current_user.user_id)
        if goal is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal was not found",
            )

        db.delete(goal)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to delete goal",
            ) from exc

        return DeleteGoalResponse(goal_id=str(goal_id), deleted=True)
