from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.orm import Session

from models import Households, Invitations, Tasks, UserDB, UsersHouseholds


def get_user_by_username(db: Session, username: str) -> UserDB | None:
    return db.scalar(select(UserDB).where(UserDB.username == username))


def get_memberships_for_user(db: Session, user_id: UUID):
    return db.scalars(
        select(UsersHouseholds.household_id).where(UsersHouseholds.user_id == user_id)
    ).all()


def list_members_for_households(db: Session, household_ids: Sequence[UUID]):
    return db.execute(
        select(
            UsersHouseholds.household_id,
            UserDB.user_id,
            UserDB.username,
            UserDB.email,
            UserDB.display_name,
            UsersHouseholds.role,
        )
        .join(UsersHouseholds, UsersHouseholds.user_id == UserDB.user_id)
        .where(UsersHouseholds.household_id.in_(household_ids))
        .order_by(UsersHouseholds.household_id, UserDB.username.asc())
    ).all()


def find_membership(db: Session, user_id: UUID, household_id: UUID):
    return db.scalar(
        select(UsersHouseholds).where(
            and_(
                UsersHouseholds.user_id == user_id,
                UsersHouseholds.household_id == household_id,
            )
        )
    )


def find_user_to_add(
    db: Session,
    *,
    user_id: UUID | None,
    username: str | None,
    email: str | None,
):
    query_conditions = []
    if user_id:
        query_conditions.append(UserDB.user_id == user_id)
    if username:
        query_conditions.append(func.lower(UserDB.username) == username.lower())
    if email:
        query_conditions.append(func.lower(UserDB.email) == email.lower())

    return db.scalar(select(UserDB).where(or_(*query_conditions)))


def find_households_for_user(db: Session, user_id: UUID):
    return db.execute(
        select(Households.household_id, Households.name)
        .join(UsersHouseholds, UsersHouseholds.household_id == Households.household_id)
        .where(UsersHouseholds.user_id == user_id)
        .order_by(Households.name.asc())
    ).all()


def list_household_member_rows(db: Session, household_ids: Sequence[UUID]):
    return db.execute(
        select(
            UsersHouseholds.household_id,
            UserDB.user_id,
            UserDB.username,
            UserDB.email,
            UserDB.display_name,
            UsersHouseholds.role,
        )
        .join(UserDB, UsersHouseholds.user_id == UserDB.user_id)
        .where(UsersHouseholds.household_id.in_(household_ids))
        .order_by(UsersHouseholds.household_id, UserDB.username.asc())
    ).all()


def find_invite_by_code(db: Session, code: str):
    return db.scalar(select(Invitations).where(Invitations.code == code))


def count_household_members(db: Session, household_id: UUID) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(UsersHouseholds)
            .where(UsersHouseholds.household_id == household_id)
        )
        or 0
    )


def unassign_user_tasks_in_household(
    db: Session, household_id: UUID, user_id: UUID
) -> None:
    db.execute(
        update(Tasks)
        .where(
            Tasks.household_id == household_id,
            Tasks.assigns_to == user_id,
        )
        .values(assigns_to=None, updated_at=func.now())
    )


def delete_household(db: Session, household_id: UUID) -> None:
    db.execute(delete(Households).where(Households.household_id == household_id))
