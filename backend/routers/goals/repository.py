from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from models import Categories, Goals, Tasks, UsersHouseholds


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


def list_personal_tasks_for_achievements(db: Session, user_id: UUID):
    return db.execute(
        select(
            Tasks.task_id,
            Tasks.household_id,
            Tasks.status,
            Tasks.due_date,
            Tasks.complete_date,
            Tasks.assigns_to,
            Tasks.created_by,
            Categories.name.label("category_name"),
        )
        .join(
            UsersHouseholds,
            and_(
                UsersHouseholds.household_id == Tasks.household_id,
                UsersHouseholds.user_id == user_id,
            ),
        )
        .outerjoin(Categories, Categories.category_id == Tasks.category_id)
        .where(
            or_(
                Tasks.assigns_to == user_id,
                and_(Tasks.assigns_to.is_(None), Tasks.created_by == user_id),
            )
        )
    ).all()


def list_household_completed_tasks_for_achievements(db: Session, user_id: UUID):
    return db.execute(
        select(
            Tasks.household_id,
            Tasks.assigns_to,
            Tasks.complete_date,
            Tasks.status,
        )
        .join(
            UsersHouseholds,
            and_(
                UsersHouseholds.household_id == Tasks.household_id,
                UsersHouseholds.user_id == user_id,
            ),
        )
        .where(
            Tasks.assigns_to.is_not(None),
            Tasks.complete_date.is_not(None),
            Tasks.status.in_(("done", "archive")),
        )
    ).all()


def list_available_category_names_for_user_households(db: Session, user_id: UUID):
    return db.execute(
        select(Categories.name)
        .join(
            UsersHouseholds,
            and_(
                UsersHouseholds.household_id == Categories.household_id,
                UsersHouseholds.user_id == user_id,
            ),
        )
    ).all()
