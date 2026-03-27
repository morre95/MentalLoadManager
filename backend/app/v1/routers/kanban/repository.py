from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.v1.models import Categories, Tasks, UserDB, UsersHouseholds


def get_user_by_username(db: Session, username: str):
    return db.scalar(select(UserDB).where(UserDB.username == username))


def find_membership(db: Session, user_id: UUID, household_id: UUID):
    return db.scalar(
        select(UsersHouseholds).where(
            and_(
                UsersHouseholds.user_id == user_id,
                UsersHouseholds.household_id == household_id,
            )
        )
    )


def get_task_by_id(db: Session, task_id: UUID):
    return db.scalar(select(Tasks).where(Tasks.task_id == task_id))


def get_generated_recurring_child(db: Session, recurrence_parent_task_id: UUID):
    return db.scalar(
        select(Tasks).where(
            Tasks.recurrence_parent_task_id == recurrence_parent_task_id
        )
    )


def list_generated_recurring_children(db: Session, recurrence_parent_task_id: UUID):
    return (
        db.execute(
            select(Tasks).where(
                Tasks.recurrence_parent_task_id == recurrence_parent_task_id
            )
        )
        .scalars()
        .all()
    )


def get_assignee_by_id(db: Session, user_id: UUID):
    return db.scalar(select(UserDB).where(UserDB.user_id == user_id))


def get_category_by_id(db: Session, category_id: UUID):
    return db.scalar(select(Categories).where(Categories.category_id == category_id))


def get_category_by_name(db: Session, household_id: UUID, category_name: str):
    return db.scalar(
        select(Categories).where(
            and_(
                Categories.household_id == household_id,
                func.lower(Categories.name) == category_name.lower(),
            )
        )
    )


def get_category_by_household_and_id(
    db: Session, household_id: UUID, category_id: UUID
):
    return db.scalar(
        select(Categories).where(
            and_(
                Categories.household_id == household_id,
                Categories.category_id == category_id,
            )
        )
    )


def list_categories_for_household(db: Session, household_id: UUID):
    return db.execute(
        select(Categories.category_id, Categories.name)
        .where(Categories.household_id == household_id)
        .order_by(func.lower(Categories.name).asc())
    ).all()


def list_tasks_for_member(
    db: Session,
    user_id: UUID,
    household_id: UUID | None,
    *,
    limit: int,
    offset: int,
):
    priority_sort = case(
        (Tasks.priority == "high", 0),
        (Tasks.priority == "medium", 1),
        (Tasks.priority == "low", 2),
        else_=3,
    )

    query = (
        select(
            Tasks.task_id,
            Tasks.household_id,
            Tasks.name,
            Tasks.description,
            Tasks.status,
            Tasks.priority,
            Tasks.due_date,
            Tasks.recurrence_enabled,
            Tasks.recurrence_frequency,
            Tasks.recurrence_interval,
            Tasks.recurrence_end_date,
            Tasks.assigns_to.label("assignee_user_id"),
            func.coalesce(UserDB.display_name, UserDB.username).label("assignee_name"),
            Categories.name.label("category_name"),
        )
        .join(
            UsersHouseholds,
            and_(
                UsersHouseholds.household_id == Tasks.household_id,
                UsersHouseholds.user_id == user_id,
            ),
        )
        .outerjoin(UserDB, Tasks.assigns_to == UserDB.user_id)
        .outerjoin(Categories, Tasks.category_id == Categories.category_id)
        .order_by(
            case((Tasks.order.is_(None), 1), else_=0),
            Tasks.order.asc().nulls_last(),
            priority_sort,
            Tasks.due_date.asc().nulls_last(),
            Tasks.created_at.desc(),
        )
    )
    if household_id:
        query = query.where(Tasks.household_id == household_id)

    query = query.limit(limit).offset(offset)

    return db.execute(query).all()


def count_tasks_for_member(
    db: Session, user_id: UUID, household_id: UUID | None
) -> int:
    query = (
        select(func.count())
        .select_from(Tasks)
        .join(
            UsersHouseholds,
            and_(
                UsersHouseholds.household_id == Tasks.household_id,
                UsersHouseholds.user_id == user_id,
            ),
        )
    )
    if household_id:
        query = query.where(Tasks.household_id == household_id)

    return int(db.scalar(query) or 0)


def list_assignees_for_household(db: Session, household_id: UUID):
    return db.execute(
        select(
            UserDB.user_id,
            UserDB.username,
            UserDB.display_name,
        )
        .join(UsersHouseholds, UsersHouseholds.user_id == UserDB.user_id)
        .where(UsersHouseholds.household_id == household_id)
        .order_by(UserDB.username.asc())
    ).all()


def list_reorder_tasks(
    db: Session, user_id: UUID, ordered_ids: list[UUID], target_status: str
):
    return (
        db.execute(
            select(Tasks)
            .join(
                UsersHouseholds,
                and_(
                    UsersHouseholds.household_id == Tasks.household_id,
                    UsersHouseholds.user_id == user_id,
                ),
            )
            .where(
                Tasks.task_id.in_(ordered_ids),
                Tasks.status == target_status,
            )
        )
        .scalars()
        .all()
    )
