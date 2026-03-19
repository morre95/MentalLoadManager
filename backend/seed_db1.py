from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID


from sqlalchemy import select
from sqlalchemy.orm import Session

from app.v1.helpers import get_session_local, setup_db_and_tables, password_hasher
from app.v1.models import (
    Categories,
    Households,
    Preferences,
    Tasks,
    UserDB,
    UserTask,
    UsersHouseholds,
)

# All users should have password "password123"
PASSWORD_HASH = password_hasher.hash("password123")


def as_uuid(value: str) -> UUID:
    return UUID(value)


HOUSEHOLD_ID = as_uuid("b1b2b3b4-1111-1111-1111-111111111111")


def seed_users(db: Session) -> dict[str, UserDB]:
    now = datetime.now(timezone.utc)

    users = [
        UserDB(
            user_id=as_uuid("a1b2c3d4-1111-1111-1111-111111111111"),
            username="rebecka",
            email="rebecka.larsson@email.se",
            password=PASSWORD_HASH,
            display_name="Rebecka Larsson",
            created_at=now - timedelta(days=60),
            last_login=now - timedelta(hours=6),
        ),
        UserDB(
            user_id=as_uuid("a1b2c3d4-2222-2222-2222-222222222222"),
            username="alex",
            email="alex.nguyen@email.se",
            password=PASSWORD_HASH,
            display_name="Alex Nguyen",
            created_at=now - timedelta(days=55),
            last_login=now - timedelta(hours=2),
        ),
        UserDB(
            user_id=as_uuid("a1b2c3d4-3333-3333-3333-333333333333"),
            username="sofia",
            email="sofia.karlsson@email.se",
            password=PASSWORD_HASH,
            display_name="Sofia Karlsson",
            created_at=now - timedelta(days=50),
            last_login=now - timedelta(days=1),
        ),
        UserDB(
            user_id=as_uuid("a1b2c3d4-4444-4444-4444-444444444444"),
            username="mattias",
            email="mattias.berg@email.se",
            password=PASSWORD_HASH,
            display_name="Mattias Berg",
            created_at=now - timedelta(days=45),
            last_login=now - timedelta(days=4),
        ),
        UserDB(
            user_id=as_uuid("a1b2c3d4-5555-5555-5555-555555555555"),
            username="lina",
            email="lina.sjoberg@email.se",
            password=PASSWORD_HASH,
            display_name="Lina Sjöberg",
            created_at=now - timedelta(days=40),
            last_login=now - timedelta(days=2),
        ),
        UserDB(
            user_id=as_uuid("a1b2c3d4-6666-6666-6666-666666666666"),
            username="noah",
            email="noah.hedlund@email.se",
            password=PASSWORD_HASH,
            display_name="Noah Hedlund",
            created_at=now - timedelta(days=35),
            last_login=now - timedelta(hours=10),
        ),
    ]

    for user in users:
        db.merge(user)
    db.flush()

    result = db.scalars(
        select(UserDB).where(
            UserDB.username.in_(["rebecka", "alex", "sofia", "mattias", "lina", "noah"])
        )
    ).all()
    return {u.username: u for u in result}


def seed_household(db: Session) -> Households:
    now = datetime.now(timezone.utc)
    household = Households(
        household_id=HOUSEHOLD_ID,
        name="Larsson–Nguyen Household",
        created_at=now - timedelta(days=60),
        updated_at=now - timedelta(days=1),
    )
    db.merge(household)
    db.flush()

    return db.scalar(select(Households).where(Households.household_id == HOUSEHOLD_ID))  # type: ignore[return-value]


def seed_user_households(db: Session, users: dict[str, UserDB]) -> None:
    links = [
        UsersHouseholds(
            user_id=users["rebecka"].user_id, household_id=HOUSEHOLD_ID, role="owner"
        ),
        UsersHouseholds(
            user_id=users["alex"].user_id, household_id=HOUSEHOLD_ID, role="admin"
        ),
        UsersHouseholds(
            user_id=users["sofia"].user_id, household_id=HOUSEHOLD_ID, role="admin"
        ),
        UsersHouseholds(
            user_id=users["mattias"].user_id, household_id=HOUSEHOLD_ID, role="member"
        ),
        UsersHouseholds(
            user_id=users["lina"].user_id, household_id=HOUSEHOLD_ID, role="member"
        ),
        UsersHouseholds(
            user_id=users["noah"].user_id, household_id=HOUSEHOLD_ID, role="member"
        ),
    ]
    for link in links:
        db.merge(link)


def seed_preferences(db: Session, users: dict[str, UserDB]) -> None:
    prefs = [
        Preferences(
            user_id=users["rebecka"].user_id,
            weekly_digest_enabled=True,
            monthly_digest_enabled=True,
            reminder_minutes_default=60,
            timezone="Europe/Stockholm",
            date_format="dmy",
            first_day_of_week="monday",
        ),
        Preferences(
            user_id=users["alex"].user_id,
            weekly_digest_enabled=True,
            monthly_digest_enabled=False,
            reminder_minutes_default=30,
            timezone="Europe/Stockholm",
            date_format="ymd",
            first_day_of_week="monday",
        ),
        Preferences(
            user_id=users["sofia"].user_id,
            weekly_digest_enabled=True,
            monthly_digest_enabled=False,
            reminder_minutes_default=60,
            timezone="Europe/Stockholm",
            date_format="dmy",
            first_day_of_week="monday",
        ),
        Preferences(
            user_id=users["mattias"].user_id,
            weekly_digest_enabled=False,
            monthly_digest_enabled=False,
            reminder_minutes_default=30,
            timezone="Europe/Stockholm",
            date_format="mdy",
            first_day_of_week="sunday",
        ),
        Preferences(
            user_id=users["lina"].user_id,
            weekly_digest_enabled=False,
            monthly_digest_enabled=True,
            reminder_minutes_default=120,
            timezone="Europe/Stockholm",
            date_format="dmy",
            first_day_of_week="monday",
        ),
        Preferences(
            user_id=users["noah"].user_id,
            weekly_digest_enabled=False,
            monthly_digest_enabled=False,
            reminder_minutes_default=45,
            timezone="Europe/Stockholm",
            date_format="mdy",
            first_day_of_week="saturday",
        ),
    ]
    for pref in prefs:
        db.merge(pref)


def seed_categories(db: Session) -> dict[str, Categories]:
    categories = [
        Categories(
            category_id=as_uuid("e1e2e3e4-1111-1111-1111-111111111111"),
            household_id=HOUSEHOLD_ID,
            name="Home & Cleaning",
        ),
        Categories(
            category_id=as_uuid("e1e2e3e4-2222-2222-2222-222222222222"),
            household_id=HOUSEHOLD_ID,
            name="Groceries & Meals",
        ),
        Categories(
            category_id=as_uuid("e1e2e3e4-3333-3333-3333-333333333333"),
            household_id=HOUSEHOLD_ID,
            name="Kids & School",
        ),
        Categories(
            category_id=as_uuid("e1e2e3e4-4444-4444-4444-444444444444"),
            household_id=HOUSEHOLD_ID,
            name="Admin & Bills",
        ),
        Categories(
            category_id=as_uuid("e1e2e3e4-5555-5555-5555-555555555555"),
            household_id=HOUSEHOLD_ID,
            name="Maintenance & Repairs",
        ),
    ]

    for c in categories:
        db.merge(c)
    db.flush()

    result = db.scalars(
        select(Categories).where(Categories.household_id == HOUSEHOLD_ID)
    ).all()
    return {str(c.category_id): c for c in result}


def seed_tasks(
    db: Session, users: dict[str, UserDB], categories: dict[str, Categories]
) -> dict[str, Tasks]:
    now = datetime.now(timezone.utc)

    def cat(cid: str) -> UUID:
        return categories[cid].category_id

    HOME = "e1e2e3e4-1111-1111-1111-111111111111"
    GROC = "e1e2e3e4-2222-2222-2222-222222222222"
    KIDS = "e1e2e3e4-3333-3333-3333-333333333333"
    ADMIN = "e1e2e3e4-4444-4444-4444-444444444444"
    MAINT = "e1e2e3e4-5555-5555-5555-555555555555"

    tasks = [
        # Admin & Bills
        Tasks(
            task_id=as_uuid("f1f2f3f4-1111-1111-1111-111111111111"),
            household_id=HOUSEHOLD_ID,
            name="Pay electricity bill",
            description="Due end of month. Check portal and confirm amount.",
            status="todo",
            priority="high",
            category_id=cat(ADMIN),
            due_date=now + timedelta(days=2),
            assigns_to=users["rebecka"].user_id,
            created_by=users["rebecka"].user_id,
            created_at=now - timedelta(days=6),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-2222-2222-2222-222222222222"),
            household_id=HOUSEHOLD_ID,
            name="Plan March budget",
            description="Update the budget and set a savings goal for the month.",
            status="in_progress",
            priority="medium",
            category_id=cat(ADMIN),
            due_date=now + timedelta(days=7),
            assigns_to=users["sofia"].user_id,
            created_by=users["rebecka"].user_id,
            created_at=now - timedelta(days=3),
            started_at=now - timedelta(days=2),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-3333-3333-3333-333333333333"),
            household_id=HOUSEHOLD_ID,
            name="Renew home insurance",
            description="Compare quotes and renew for 12 months.",
            status="done",
            priority="medium",
            category_id=cat(ADMIN),
            due_date=now - timedelta(days=9),
            assigns_to=users["alex"].user_id,
            created_by=users["alex"].user_id,
            created_at=now - timedelta(days=20),
            started_at=now - timedelta(days=19),
            complete_date=now - timedelta(days=8),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-3434-3434-3434-343434343434"),
            household_id=HOUSEHOLD_ID,
            name="Call internet provider",
            description="Ask about upgrade options and renegotiate pricing.",
            status="on_hold",
            priority="medium",
            category_id=cat(ADMIN),
            due_date=now + timedelta(days=3),
            assigns_to=users["rebecka"].user_id,
            created_by=users["alex"].user_id,
            created_at=now - timedelta(days=15),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-3535-3535-3535-353535353535"),
            household_id=HOUSEHOLD_ID,
            name="Backup family photos",
            description="Upload January photos to cloud storage and label albums.",
            status="archive",
            priority="low",
            category_id=cat(ADMIN),
            due_date=now - timedelta(days=18),
            assigns_to=users["noah"].user_id,
            created_by=users["noah"].user_id,
            created_at=now - timedelta(days=25),
            started_at=now - timedelta(days=23),
            complete_date=now - timedelta(days=17),
        ),
        # Groceries & Meals
        Tasks(
            task_id=as_uuid("f1f2f3f4-4444-4444-4444-444444444444"),
            household_id=HOUSEHOLD_ID,
            name="Weekly grocery run",
            description="Milk, eggs, fruit, pasta, chicken, lunch snacks.",
            status="todo",
            priority="medium",
            category_id=cat(GROC),
            due_date=now + timedelta(days=1),
            assigns_to=users["mattias"].user_id,
            created_by=users["lina"].user_id,
            created_at=now - timedelta(days=5),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-5555-5555-5555-555555555555"),
            household_id=HOUSEHOLD_ID,
            name="Meal prep (3 lunches)",
            description="Rice + roasted veggies + protein for 3 lunchboxes.",
            status="done",
            priority="low",
            category_id=cat(GROC),
            due_date=now - timedelta(days=1),
            assigns_to=users["lina"].user_id,
            created_by=users["lina"].user_id,
            created_at=now - timedelta(days=4),
            started_at=now - timedelta(days=2),
            complete_date=now - timedelta(days=1),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-6666-6666-6666-666666666666"),
            household_id=HOUSEHOLD_ID,
            name="Plan weekend dinner",
            description="Pick menu and buy specialty ingredients.",
            status="on_hold",
            priority="low",
            category_id=cat(GROC),
            due_date=now + timedelta(days=3),
            assigns_to=users["noah"].user_id,
            created_by=users["alex"].user_id,
            created_at=now - timedelta(days=10),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-6767-6767-6767-676767676767"),
            household_id=HOUSEHOLD_ID,
            name="Restock pantry staples",
            description="Olive oil, oats, rice, canned tomatoes, coffee.",
            status="todo",
            priority="low",
            category_id=cat(GROC),
            due_date=now + timedelta(days=9),
            assigns_to=users["lina"].user_id,
            created_by=users["rebecka"].user_id,
            created_at=now - timedelta(days=6),
        ),
        # Home & Cleaning
        Tasks(
            task_id=as_uuid("f1f2f3f4-7777-7777-7777-777777777777"),
            household_id=HOUSEHOLD_ID,
            name="Deep clean bathroom",
            description="Scrub tiles, descale shower, wipe cabinets, mop floor.",
            status="in_progress",
            priority="medium",
            category_id=cat(HOME),
            due_date=now + timedelta(days=4),
            assigns_to=users["rebecka"].user_id,
            created_by=users["sofia"].user_id,
            created_at=now - timedelta(days=2),
            started_at=now - timedelta(days=1),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-8888-8888-8888-888888888888"),
            household_id=HOUSEHOLD_ID,
            name="Wash bedding",
            description="Wash sheets and change linens.",
            status="done",
            priority="low",
            category_id=cat(HOME),
            due_date=now - timedelta(days=12),
            assigns_to=users["mattias"].user_id,
            created_by=users["mattias"].user_id,
            created_at=now - timedelta(days=13),
            started_at=now - timedelta(days=12),
            complete_date=now - timedelta(days=11),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-9999-9999-9999-999999999999"),
            household_id=HOUSEHOLD_ID,
            name="Declutter hallway",
            description="Sort shoes/jackets and donate unused items.",
            status="todo",
            priority="low",
            category_id=cat(HOME),
            due_date=now + timedelta(days=10),
            assigns_to=users["alex"].user_id,
            created_by=users["rebecka"].user_id,
            created_at=now - timedelta(days=1),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-0909-0909-0909-090909090909"),
            household_id=HOUSEHOLD_ID,
            name="Clean fridge",
            description="Throw old items, wipe shelves, restock.",
            status="done",
            priority="low",
            category_id=cat(HOME),
            due_date=now - timedelta(days=6),
            assigns_to=users["sofia"].user_id,
            created_by=users["sofia"].user_id,
            created_at=now - timedelta(days=8),
            started_at=now - timedelta(days=7),
            complete_date=now - timedelta(days=6),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-1010-1010-1010-101010101010"),
            household_id=HOUSEHOLD_ID,
            name="Take out recycling",
            description="Paper, plastic, glass. Replace bags.",
            status="todo",
            priority="low",
            category_id=cat(HOME),
            due_date=now + timedelta(hours=12),
            assigns_to=users["noah"].user_id,
            created_by=users["sofia"].user_id,
            created_at=now - timedelta(days=2),
        ),
        # Maintenance & Repairs
        Tasks(
            task_id=as_uuid("f1f2f3f4-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            household_id=HOUSEHOLD_ID,
            name="Fix kitchen cabinet hinge",
            description="Tighten screws; replace hinge if needed.",
            status="in_progress",
            priority="medium",
            category_id=cat(MAINT),
            due_date=now + timedelta(days=6),
            assigns_to=users["mattias"].user_id,
            created_by=users["alex"].user_id,
            created_at=now - timedelta(days=9),
            started_at=now - timedelta(days=2),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            household_id=HOUSEHOLD_ID,
            name="Replace hallway light bulb",
            description="Bulb flickering; replace with LED.",
            status="archive",
            priority="low",
            category_id=cat(MAINT),
            due_date=now - timedelta(days=35),
            assigns_to=users["alex"].user_id,
            created_by=users["alex"].user_id,
            created_at=now - timedelta(days=40),
            started_at=now - timedelta(days=39),
            complete_date=now - timedelta(days=34),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-cccc-cccc-cccc-cccccccccccc"),
            household_id=HOUSEHOLD_ID,
            name="Schedule boiler service",
            description="Call provider and book annual check.",
            status="todo",
            priority="high",
            category_id=cat(MAINT),
            due_date=now + timedelta(days=14),
            assigns_to=users["rebecka"].user_id,
            created_by=users["rebecka"].user_id,
            created_at=now - timedelta(days=1),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-d1d1-d1d1-d1d1-d1d1d1d1d1d1"),
            household_id=HOUSEHOLD_ID,
            name="Check smoke detector batteries",
            description="Test alarm and replace batteries if needed.",
            status="todo",
            priority="medium",
            category_id=cat(MAINT),
            due_date=now + timedelta(days=5),
            assigns_to=users["alex"].user_id,
            created_by=users["rebecka"].user_id,
            created_at=now - timedelta(days=4),
        ),
        # Kids & School (optional but realistic dataset)
        Tasks(
            task_id=as_uuid("f1f2f3f4-dddd-dddd-dddd-dddddddddddd"),
            household_id=HOUSEHOLD_ID,
            name="Buy school supplies",
            description="Notebook, pens, glue stick, folders.",
            status="todo",
            priority="low",
            category_id=cat(KIDS),
            due_date=now + timedelta(days=8),
            assigns_to=users["noah"].user_id,
            created_by=users["lina"].user_id,
            created_at=now - timedelta(days=2),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-eeee-eeee-eeee-eeeeeeeeeeee"),
            household_id=HOUSEHOLD_ID,
            name="Sign permission slip",
            description="Send signed permission slip via email.",
            status="done",
            priority="high",
            category_id=cat(KIDS),
            due_date=now - timedelta(days=4),
            assigns_to=users["rebecka"].user_id,
            created_by=users["rebecka"].user_id,
            created_at=now - timedelta(days=6),
            started_at=now - timedelta(days=5),
            complete_date=now - timedelta(days=4),
        ),
        Tasks(
            task_id=as_uuid("f1f2f3f4-1212-1212-1212-121212121212"),
            household_id=HOUSEHOLD_ID,
            name="Parent-teacher meeting prep",
            description="Collect questions and review recent notes.",
            status="todo",
            priority="medium",
            category_id=cat(KIDS),
            due_date=now + timedelta(days=5),
            assigns_to=users["sofia"].user_id,
            created_by=users["sofia"].user_id,
            created_at=now - timedelta(days=7),
        ),
    ]

    for task in tasks:
        db.merge(task)

    db.flush()

    result = db.scalars(select(Tasks).where(Tasks.household_id == HOUSEHOLD_ID)).all()
    return {str(t.task_id): t for t in result}


def seed_user_task_links(
    db: Session, users: dict[str, UserDB], tasks: dict[str, Tasks]
) -> None:
    # Link a few tasks to multiple users for realism
    by_name = {t.name: t for t in tasks.values()}

    links = [
        UserTask(
            user_id=users["alex"].user_id, task_id=by_name["Plan March budget"].task_id
        ),
        UserTask(
            user_id=users["rebecka"].user_id,
            task_id=by_name["Fix kitchen cabinet hinge"].task_id,
        ),
        UserTask(
            user_id=users["sofia"].user_id,
            task_id=by_name["Weekly grocery run"].task_id,
        ),
        UserTask(
            user_id=users["lina"].user_id,
            task_id=by_name["Pay electricity bill"].task_id,
        ),
    ]
    for link in links:
        db.merge(link)


def main() -> None:
    setup_db_and_tables()
    session_local = get_session_local()

    with session_local() as db:
        users = seed_users(db)
        seed_household(db)
        seed_user_households(db, users)
        seed_preferences(db, users)
        categories = seed_categories(db)
        tasks = seed_tasks(db, users, categories)
        seed_user_task_links(db, users, tasks)
        db.commit()

    print("Seed data applied successfully with SQLAlchemy.")


if __name__ == "__main__":
    main()
