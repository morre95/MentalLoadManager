from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID


from sqlalchemy import select
from sqlalchemy.orm import Session

from app.v1.helpers import get_session_local, password_hasher, setup_db_and_tables
from app.v1.models import (
    Categories,
    Goals,
    Households,
    Preferences,
    Tasks,
    UserDB,
    UserTask,
    UsersHouseholds,
)

# Requested by user: same password for all seeded users.
PASSWORD_HASH = password_hasher.hash("password123")


def as_uuid(value: str) -> UUID:
    return UUID(value)


HOUSEHOLD_ID = as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f900001")

USERS = {
    "emma_lindberg": {
        "id": as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f900011"),
        "email": "emma.lindberg@example.com",
        "display_name": "Emma Lindberg",
        "role": "owner",
    },
    "marcus_lindberg": {
        "id": as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f900012"),
        "email": "marcus.lindberg@example.com",
        "display_name": "Marcus Lindberg",
        "role": "admin",
    },
    "lea_lindberg": {
        "id": as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f900013"),
        "email": "lea.lindberg@example.com",
        "display_name": "Lea Lindberg",
        "role": "member",
    },
}

CATEGORY_IDS = {
    "cleaning": as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f900101"),
    "groceries_meals": as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f900102"),
    "school_family": as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f900103"),
    "admin_bills": as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f900104"),
    "health_habits": as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f900105"),
}


def seed_users(db: Session, now: datetime) -> dict[str, UserDB]:
    for idx, (username, data) in enumerate(USERS.items()):
        user = UserDB(
            user_id=data["id"],
            username=username,
            email=data["email"],
            password=PASSWORD_HASH,
            display_name=data["display_name"],
            created_at=now - timedelta(days=120 - (idx * 10)),
            last_login=now - timedelta(hours=2 + idx),
            updated_at=now - timedelta(days=1),
        )
        db.merge(user)

    db.flush()
    rows = db.scalars(
        select(UserDB).where(UserDB.username.in_(list(USERS.keys())))
    ).all()
    return {row.username: row for row in rows}


def seed_household(db: Session, now: datetime) -> Households:
    household = Households(
        household_id=HOUSEHOLD_ID,
        name="Lindberg Family",
        created_at=now - timedelta(days=120),
        updated_at=now - timedelta(days=1),
    )
    db.merge(household)
    db.flush()
    return db.scalar(select(Households).where(Households.household_id == HOUSEHOLD_ID))  # type: ignore[return-value]


def seed_memberships(db: Session, users: dict[str, UserDB]) -> None:
    for username, data in USERS.items():
        db.merge(
            UsersHouseholds(
                user_id=users[username].user_id,
                household_id=HOUSEHOLD_ID,
                role=data["role"],
            )
        )


def seed_preferences(db: Session, users: dict[str, UserDB]) -> None:
    db.merge(
        Preferences(
            user_id=users["emma_lindberg"].user_id,
            weekly_digest_enabled=True,
            monthly_digest_enabled=True,
            reminder_minutes_default=60,
            timezone="Europe/Stockholm",
            date_format="dmy",
            first_day_of_week="monday",
        )
    )
    db.merge(
        Preferences(
            user_id=users["marcus_lindberg"].user_id,
            weekly_digest_enabled=True,
            monthly_digest_enabled=False,
            reminder_minutes_default=45,
            timezone="Europe/Stockholm",
            date_format="ymd",
            first_day_of_week="monday",
        )
    )
    db.merge(
        Preferences(
            user_id=users["lea_lindberg"].user_id,
            weekly_digest_enabled=False,
            monthly_digest_enabled=False,
            reminder_minutes_default=30,
            timezone="Europe/Stockholm",
            date_format="mdy",
            first_day_of_week="sunday",
        )
    )


def seed_categories(db: Session) -> dict[str, Categories]:
    categories = [
        Categories(
            category_id=CATEGORY_IDS["cleaning"],
            household_id=HOUSEHOLD_ID,
            name="Cleaning",
        ),
        Categories(
            category_id=CATEGORY_IDS["groceries_meals"],
            household_id=HOUSEHOLD_ID,
            name="Groceries & Meals",
        ),
        Categories(
            category_id=CATEGORY_IDS["school_family"],
            household_id=HOUSEHOLD_ID,
            name="School & Family",
        ),
        Categories(
            category_id=CATEGORY_IDS["admin_bills"],
            household_id=HOUSEHOLD_ID,
            name="Admin & Bills",
        ),
        Categories(
            category_id=CATEGORY_IDS["health_habits"],
            household_id=HOUSEHOLD_ID,
            name="Health & Habits",
        ),
    ]
    for category in categories:
        db.merge(category)
    db.flush()
    rows = db.scalars(
        select(Categories).where(Categories.household_id == HOUSEHOLD_ID)
    ).all()
    return {row.name: row for row in rows}


def build_task(
    task_id: str,
    *,
    name: str,
    description: str,
    status: str,
    priority: str,
    category_id: UUID,
    due_days_ago: int,
    assignee_id: UUID,
    creator_id: UUID,
    now: datetime,
    started_days_ago: int | None = None,
    completed_days_ago: int | None = None,
) -> Tasks:
    due_date = now - timedelta(days=due_days_ago)
    started_at = (
        None if started_days_ago is None else now - timedelta(days=started_days_ago)
    )
    complete_date = (
        None if completed_days_ago is None else now - timedelta(days=completed_days_ago)
    )
    created_at = due_date - timedelta(days=2)

    return Tasks(
        task_id=as_uuid(task_id),
        household_id=HOUSEHOLD_ID,
        name=name,
        description=description,
        status=status,
        priority=priority,
        category_id=category_id,
        due_date=due_date,
        assigns_to=assignee_id,
        created_by=creator_id,
        created_at=created_at,
        started_at=started_at,
        complete_date=complete_date,
        updated_at=now - timedelta(hours=6),
    )


def seed_tasks(
    db: Session,
    users: dict[str, UserDB],
    categories: dict[str, Categories],
    now: datetime,
) -> list[Tasks]:
    emma = users["emma_lindberg"].user_id
    marcus = users["marcus_lindberg"].user_id
    lea = users["lea_lindberg"].user_id

    tasks = [
        # Last month: realistic completed household chores and family responsibilities.
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901001",
            name="Weekly grocery run",
            description="Buy staples, fruit, school lunch items and coffee.",
            status="done",
            priority="high",
            category_id=categories["Groceries & Meals"].category_id,
            due_days_ago=29,
            assignee_id=marcus,
            creator_id=emma,
            now=now,
            started_days_ago=29,
            completed_days_ago=29,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901002",
            name="Pay electricity bill",
            description="Invoice in Kivra, pay before due date.",
            status="done",
            priority="high",
            category_id=categories["Admin & Bills"].category_id,
            due_days_ago=27,
            assignee_id=emma,
            creator_id=emma,
            now=now,
            started_days_ago=28,
            completed_days_ago=27,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901003",
            name="Tidy bedroom and desk",
            description="Vacuum and organize school materials.",
            status="done",
            priority="medium",
            category_id=categories["Cleaning"].category_id,
            due_days_ago=26,
            assignee_id=lea,
            creator_id=emma,
            now=now,
            started_days_ago=26,
            completed_days_ago=25,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901004",
            name="Prepare meal prep for work week",
            description="Cook 3 dinner bases and prep lunches.",
            status="archive",
            priority="medium",
            category_id=categories["Groceries & Meals"].category_id,
            due_days_ago=24,
            assignee_id=emma,
            creator_id=marcus,
            now=now,
            started_days_ago=25,
            completed_days_ago=24,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901005",
            name="Laundry and fold for all rooms",
            description="Two loads + towels + fold and put away.",
            status="done",
            priority="medium",
            category_id=categories["Cleaning"].category_id,
            due_days_ago=22,
            assignee_id=marcus,
            creator_id=emma,
            now=now,
            started_days_ago=22,
            completed_days_ago=22,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901006",
            name="Math homework session",
            description="45 min focused practice before Thursday test.",
            status="done",
            priority="high",
            category_id=categories["School & Family"].category_id,
            due_days_ago=20,
            assignee_id=lea,
            creator_id=lea,
            now=now,
            started_days_ago=20,
            completed_days_ago=20,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901007",
            name="Family calendar planning",
            description="Plan transport and dinner for next school week.",
            status="done",
            priority="low",
            category_id=categories["School & Family"].category_id,
            due_days_ago=18,
            assignee_id=emma,
            creator_id=marcus,
            now=now,
            started_days_ago=18,
            completed_days_ago=18,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901008",
            name="Take out recycling",
            description="Paper, glass and metal sorting.",
            status="done",
            priority="low",
            category_id=categories["Cleaning"].category_id,
            due_days_ago=17,
            assignee_id=lea,
            creator_id=marcus,
            now=now,
            started_days_ago=17,
            completed_days_ago=17,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901009",
            name="Book dentist appointment for Lea",
            description="Call clinic and confirm next available slot.",
            status="done",
            priority="medium",
            category_id=categories["Admin & Bills"].category_id,
            due_days_ago=15,
            assignee_id=emma,
            creator_id=emma,
            now=now,
            started_days_ago=16,
            completed_days_ago=15,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901010",
            name="30-minute evening walk",
            description="Walk after dinner to hit weekly movement goal.",
            status="done",
            priority="low",
            category_id=categories["Health & Habits"].category_id,
            due_days_ago=14,
            assignee_id=marcus,
            creator_id=marcus,
            now=now,
            started_days_ago=14,
            completed_days_ago=14,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901011",
            name="Kitchen deep clean",
            description="Fridge shelves, counters, and floor.",
            status="done",
            priority="medium",
            category_id=categories["Cleaning"].category_id,
            due_days_ago=12,
            assignee_id=emma,
            creator_id=emma,
            now=now,
            started_days_ago=12,
            completed_days_ago=11,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901012",
            name="Prepare presentation slides",
            description="Social studies group project due Friday.",
            status="done",
            priority="high",
            category_id=categories["School & Family"].category_id,
            due_days_ago=10,
            assignee_id=lea,
            creator_id=lea,
            now=now,
            started_days_ago=11,
            completed_days_ago=10,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901013",
            name="Review monthly spending",
            description="Check subscriptions and adjust next month budget.",
            status="done",
            priority="medium",
            category_id=categories["Admin & Bills"].category_id,
            due_days_ago=8,
            assignee_id=marcus,
            creator_id=emma,
            now=now,
            started_days_ago=9,
            completed_days_ago=8,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901014",
            name="Refill weekly pill organizer",
            description="Prepare vitamins and daily meds for the week.",
            status="done",
            priority="medium",
            category_id=categories["Health & Habits"].category_id,
            due_days_ago=7,
            assignee_id=emma,
            creator_id=marcus,
            now=now,
            started_days_ago=7,
            completed_days_ago=7,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901015",
            name="Vacuum living room and hallway",
            description="Quick clean before weekend guests.",
            status="done",
            priority="low",
            category_id=categories["Cleaning"].category_id,
            due_days_ago=6,
            assignee_id=lea,
            creator_id=emma,
            now=now,
            started_days_ago=6,
            completed_days_ago=6,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901016",
            name="Prepare school gym bag",
            description="Clothes, shoes and water bottle for Tuesday.",
            status="done",
            priority="low",
            category_id=categories["School & Family"].category_id,
            due_days_ago=5,
            assignee_id=lea,
            creator_id=lea,
            now=now,
            started_days_ago=5,
            completed_days_ago=5,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901017",
            name="Buy groceries for week 4",
            description="Refill basics and prep breakfast items.",
            status="done",
            priority="high",
            category_id=categories["Groceries & Meals"].category_id,
            due_days_ago=4,
            assignee_id=marcus,
            creator_id=emma,
            now=now,
            started_days_ago=4,
            completed_days_ago=4,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901018",
            name="Assemble school paperwork",
            description="Sign excursion permission slip and upload copy.",
            status="done",
            priority="medium",
            category_id=categories["School & Family"].category_id,
            due_days_ago=3,
            assignee_id=emma,
            creator_id=lea,
            now=now,
            started_days_ago=3,
            completed_days_ago=2,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901019",
            name="15-minute mobility workout",
            description="Stretch and mobility session after work.",
            status="done",
            priority="low",
            category_id=categories["Health & Habits"].category_id,
            due_days_ago=2,
            assignee_id=marcus,
            creator_id=marcus,
            now=now,
            started_days_ago=2,
            completed_days_ago=2,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901020",
            name="Clean school backpack",
            description="Throw old papers and organize books.",
            status="done",
            priority="low",
            category_id=categories["School & Family"].category_id,
            due_days_ago=1,
            assignee_id=lea,
            creator_id=lea,
            now=now,
            started_days_ago=1,
            completed_days_ago=1,
        ),
        # Current/open tasks.
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901021",
            name="Pay broadband invoice",
            description="Due this week, confirm autopay is active.",
            status="todo",
            priority="high",
            category_id=categories["Admin & Bills"].category_id,
            due_days_ago=-1,
            assignee_id=emma,
            creator_id=emma,
            now=now,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901022",
            name="Cook Wednesday dinner",
            description="Pasta + salad, prep leftovers for lunch.",
            status="in_progress",
            priority="medium",
            category_id=categories["Groceries & Meals"].category_id,
            due_days_ago=-2,
            assignee_id=marcus,
            creator_id=emma,
            now=now,
            started_days_ago=0,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901023",
            name="Practice guitar 30 minutes",
            description="Focus on chord transitions for lesson.",
            status="todo",
            priority="low",
            category_id=categories["Health & Habits"].category_id,
            due_days_ago=-2,
            assignee_id=lea,
            creator_id=lea,
            now=now,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901024",
            name="Bathroom quick clean",
            description="Sink + mirror + floor touch-up.",
            status="on_hold",
            priority="low",
            category_id=categories["Cleaning"].category_id,
            due_days_ago=0,
            assignee_id=marcus,
            creator_id=emma,
            now=now,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901025",
            name="Schedule parent-teacher meeting",
            description="Pick slot before next week.",
            status="todo",
            priority="medium",
            category_id=categories["School & Family"].category_id,
            due_days_ago=-4,
            assignee_id=emma,
            creator_id=marcus,
            now=now,
        ),
        build_task(
            "d7f6a7e2-4df2-4f40-9f26-cfa87f901026",
            name="Morning hydration streak",
            description="Drink water before school/work each morning.",
            status="todo",
            priority="low",
            category_id=categories["Health & Habits"].category_id,
            due_days_ago=-3,
            assignee_id=lea,
            creator_id=emma,
            now=now,
        ),
    ]

    for task in tasks:
        db.merge(task)
    db.flush()
    return tasks


def seed_user_task_links(db: Session, tasks: list[Tasks]) -> None:
    for task in tasks:
        if not task.assigns_to:
            continue
        db.merge(UserTask(user_id=task.assigns_to, task_id=task.task_id))


def seed_goals(db: Session, users: dict[str, UserDB], now: datetime) -> None:
    goals = [
        Goals(
            goal_id=as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f902001"),
            user_id=users["emma_lindberg"].user_id,
            type="savings",
            name="Family emergency fund",
            current_value=4200,
            target_value=10000,
            tracking_style="total",
            created_at=now - timedelta(days=30),
            updated_at=now - timedelta(days=1),
        ),
        Goals(
            goal_id=as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f902002"),
            user_id=users["marcus_lindberg"].user_id,
            type="training",
            name="4 workouts per week",
            current_value=3,
            target_value=4,
            tracking_style="weekly",
            created_at=now - timedelta(days=20),
            updated_at=now - timedelta(days=1),
        ),
        Goals(
            goal_id=as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f902003"),
            user_id=users["lea_lindberg"].user_id,
            type="learning",
            name="Math revision milestones",
            current_value=11,
            target_value=20,
            tracking_style="total",
            created_at=now - timedelta(days=24),
            updated_at=now - timedelta(days=1),
        ),
        Goals(
            goal_id=as_uuid("d7f6a7e2-4df2-4f40-9f26-cfa87f902004"),
            user_id=users["lea_lindberg"].user_id,
            type="hydration",
            name="Drink 8 glasses each day",
            current_value=5,
            target_value=8,
            tracking_style="daily",
            created_at=now - timedelta(days=14),
            updated_at=now - timedelta(days=1),
        ),
    ]
    for goal in goals:
        db.merge(goal)


def main() -> None:
    setup_db_and_tables()
    session_local = get_session_local()
    now = datetime.now(timezone.utc)

    with session_local() as db:
        users = seed_users(db, now)
        seed_household(db, now)
        seed_memberships(db, users)
        seed_preferences(db, users)
        categories = seed_categories(db)
        tasks = seed_tasks(db, users, categories, now)
        seed_user_task_links(db, tasks)
        seed_goals(db, users, now)
        db.commit()

    print("Seed data applied (seed_db2.py).")
    print("Household: Lindberg Family")
    print("Users (all password: password123):")
    print(" - emma_lindberg")
    print(" - marcus_lindberg")
    print(" - lea_lindberg")


if __name__ == "__main__":
    main()
