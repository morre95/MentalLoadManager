from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Goals


def list_goals_for_user(db: Session, user_id: UUID) -> list[Goals]:
    return db.scalars(
        select(Goals)
        .where(Goals.user_id == user_id)
        .order_by(Goals.created_at.desc(), Goals.goal_id.desc())
    ).all()


def get_goal_for_user(db: Session, goal_id: UUID, user_id: UUID) -> Goals | None:
    return db.scalar(
        select(Goals).where(
            Goals.goal_id == goal_id,
            Goals.user_id == user_id,
        )
    )


def create_goal(
    db: Session,
    *,
    user_id: UUID,
    type: str,
    name: str,
    current_value: int,
    target_value: int,
    tracking_style: str,
) -> Goals:
    goal = Goals(
        user_id=user_id,
        type=type,
        name=name,
        current_value=current_value,
        target_value=target_value,
        tracking_style=tracking_style,
    )
    db.add(goal)
    return goal
