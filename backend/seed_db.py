from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from helpers import get_session_local, setup_db_and_tables, password_hasher
from models import (
    Categories,
    Households,
    Preferences,
    Tasks,
    UserDB,
    UserTask,
    UsersHouseholds,
)


PASSWORD_HASH = password_hasher.hash("test123")


def as_uuid(value: str) -> UUID:
    return UUID(value)


def seed_users(db: Session) -> dict[str, UserDB]:
    now = datetime.now(timezone.utc)
    users = [
        UserDB(
            user_id=as_uuid("a1b2c3d4-1111-1111-1111-111111111111"),
            username="anna_svensson",
            email="anna.svensson@email.se",
            password=PASSWORD_HASH,
            display_name="Anna Svensson",
            created_at=now - timedelta(days=30),
            last_login=now - timedelta(days=1),
        ),
        UserDB(
            user_id=as_uuid("a1b2c3d4-2222-2222-2222-222222222222"),
            username="erik_johansson",
            email="erik.johansson@email.se",
            password=PASSWORD_HASH,
            display_name="Erik Johansson",
            created_at=now - timedelta(days=25),
            last_login=now - timedelta(hours=2),
        ),
        UserDB(
            user_id=as_uuid("a1b2c3d4-3333-3333-3333-333333333333"),
            username="maria_andersson",
            email="maria.andersson@email.se",
            password=PASSWORD_HASH,
            display_name="Maria Andersson",
            created_at=now - timedelta(days=20),
            last_login=now - timedelta(days=3),
        ),
    ]

    for user in users:
        db.merge(user)
    db.flush()

    result = db.scalars(
        select(UserDB).where(
            UserDB.username.in_(["anna_svensson", "erik_johansson", "maria_andersson"])
        )
    ).all()
    return {user.username: user for user in result}


def seed_households(db: Session) -> dict[str, Households]:
    now = datetime.now(timezone.utc)
    households = [
        Households(
            household_id=as_uuid("b1b2b3b4-1111-1111-1111-111111111111"),
            name="Familjen Svensson-Johansson",
            created_at=now - timedelta(days=30),
        ),
        Households(
            household_id=as_uuid("b1b2b3b4-2222-2222-2222-222222222222"),
            name="Anderssonshuset",
            created_at=now - timedelta(days=20),
        ),
    ]

    for household in households:
        db.merge(household)
    db.flush()

    result = db.scalars(
        select(Households).where(
            Households.household_id.in_(
                [
                    as_uuid("b1b2b3b4-1111-1111-1111-111111111111"),
                    as_uuid("b1b2b3b4-2222-2222-2222-222222222222"),
                ]
            )
        )
    ).all()
    return {str(household.household_id): household for household in result}


def seed_user_households(
    db: Session,
    users: dict[str, UserDB],
    households: dict[str, Households],
) -> None:
    links = [
        UsersHouseholds(
            user_id=users["anna_svensson"].user_id,
            household_id=households[
                "b1b2b3b4-1111-1111-1111-111111111111"
            ].household_id,
        ),
        UsersHouseholds(
            user_id=users["erik_johansson"].user_id,
            household_id=households[
                "b1b2b3b4-1111-1111-1111-111111111111"
            ].household_id,
        ),
        UsersHouseholds(
            user_id=users["maria_andersson"].user_id,
            household_id=households[
                "b1b2b3b4-2222-2222-2222-222222222222"
            ].household_id,
        ),
    ]
    for link in links:
        db.merge(link)


def seed_preferences(db: Session, users: dict[str, UserDB]) -> None:
    prefs = [
        Preferences(
            user_id=users["anna_svensson"].user_id,
            weekly_digest_enabled=True,
            monthly_digest_enabled=True,
            reminder_minutes_default=60,
            timezone="Europe/Stockholm",
        ),
        Preferences(
            user_id=users["erik_johansson"].user_id,
            weekly_digest_enabled=True,
            monthly_digest_enabled=False,
            reminder_minutes_default=30,
            timezone="Europe/Stockholm",
        ),
        Preferences(
            user_id=users["maria_andersson"].user_id,
            weekly_digest_enabled=False,
            monthly_digest_enabled=True,
            reminder_minutes_default=120,
            timezone="Europe/Stockholm",
        ),
    ]
    for pref in prefs:
        db.merge(pref)


def seed_categories(
    db: Session,
    households: dict[str, Households],
) -> dict[str, Categories]:
    categories = [
        Categories(
            category_id=as_uuid("e1e2e3e4-1111-1111-1111-111111111111"),
            household_id=households[
                "b1b2b3b4-1111-1111-1111-111111111111"
            ].household_id,
            name="Hushall",
        ),
        Categories(
            category_id=as_uuid("e1e2e3e4-2222-2222-2222-222222222222"),
            household_id=households[
                "b1b2b3b4-1111-1111-1111-111111111111"
            ].household_id,
            name="Barnrelaterat",
        ),
        Categories(
            category_id=as_uuid("e1e2e3e4-3333-3333-3333-333333333333"),
            household_id=households[
                "b1b2b3b4-2222-2222-2222-222222222222"
            ].household_id,
            name="Ekonomi",
        ),
    ]

    for category in categories:
        db.merge(category)
    db.flush()

    result = db.scalars(
        select(Categories).where(
            Categories.category_id.in_(
                [
                    as_uuid("e1e2e3e4-1111-1111-1111-111111111111"),
                    as_uuid("e1e2e3e4-2222-2222-2222-222222222222"),
                    as_uuid("e1e2e3e4-3333-3333-3333-333333333333"),
                ]
            )
        )
    ).all()
    return {str(category.category_id): category for category in result}


def seed_tasks(
    db: Session,
    users: dict[str, UserDB],
    households: dict[str, Households],
    categories: dict[str, Categories],
) -> dict[str, Tasks]:
    now = datetime.now(timezone.utc)
    tasks = [
        Tasks(
            task_id=as_uuid("f1f2f3f4-1111-1111-1111-111111111111"),
            household_id=households[
                "b1b2b3b4-1111-1111-1111-111111111111"
            ].household_id,
            name="Kopa mat till helgen",
            description="Handla: mjolk, brod, pasta, kyckling, gronsaker",
            status="todo",
            priority="high",
            category_id=categories["e1e2e3e4-1111-1111-1111-111111111111"].category_id,
            due_date=now + timedelta(days=2),
            assigns_to=users["erik_johansson"].user_id,
            created_by=users["anna_svensson"].user_id,
            created_at=now - timedelta(days=1),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-2222-2222-2222-222222222222"),
            household_id=households[
                "b1b2b3b4-1111-1111-1111-111111111111"
            ].household_id,
            name="Hamta pa dagis",
            description="Hamta Liam kl 16:30",
            status="in_progress",
            priority="high",
            category_id=categories["e1e2e3e4-2222-2222-2222-222222222222"].category_id,
            due_date=now + timedelta(hours=6),
            assigns_to=users["anna_svensson"].user_id,
            created_by=users["erik_johansson"].user_id,
            created_at=now - timedelta(hours=12),
            started_at=now - timedelta(hours=4),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-3333-3333-3333-333333333333"),
            household_id=households[
                "b1b2b3b4-2222-2222-2222-222222222222"
            ].household_id,
            name="Betala elrakning",
            description="Forfaller snart",
            status="done",
            priority="medium",
            category_id=categories["e1e2e3e4-3333-3333-3333-333333333333"].category_id,
            due_date=now - timedelta(days=1),
            assigns_to=users["maria_andersson"].user_id,
            created_by=users["maria_andersson"].user_id,
            created_at=now - timedelta(days=3),
            complete_date=now - timedelta(hours=20),
        ),
    ]

    for task in tasks:
        db.merge(task)
    db.flush()

    result = db.scalars(
        select(Tasks).where(
            Tasks.task_id.in_(
                [
                    as_uuid("f1f2f3f4-1111-1111-1111-111111111111"),
                    as_uuid("f1f2f3f4-2222-2222-2222-222222222222"),
                    as_uuid("f1f2f3f4-3333-3333-3333-333333333333"),
                ]
            )
        )
    ).all()
    return {str(task.task_id): task for task in result}


def seed_user_task_links(
    db: Session,
    users: dict[str, UserDB],
    tasks: dict[str, Tasks],
) -> None:
    links = [
        UserTask(
            user_id=users["erik_johansson"].user_id,
            task_id=tasks["f1f2f3f4-1111-1111-1111-111111111111"].task_id,
        ),
        UserTask(
            user_id=users["anna_svensson"].user_id,
            task_id=tasks["f1f2f3f4-2222-2222-2222-222222222222"].task_id,
        ),
    ]
    for link in links:
        db.merge(link)


def main() -> None:
    setup_db_and_tables()
    session_local = get_session_local()

    with session_local() as db:
        users = seed_users(db)
        households = seed_households(db)
        seed_user_households(db, users, households)
        seed_preferences(db, users)
        categories = seed_categories(db, households)
        tasks = seed_tasks(db, users, households, categories)
        seed_user_task_links(db, users, tasks)
        db.commit()

    print("Seed data applied successfully with SQLAlchemy.")


if __name__ == "__main__":
    main()
