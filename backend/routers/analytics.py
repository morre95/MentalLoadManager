# backend/routers/analytics.py
# TODO: Change so that you can decide what Household to query for (if user has multiple); for now we just pick the first one they belong to.
# TODO: Change dynamic keys to "series" list if you want stricter typing; but this is easier for frontend mapping.

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy import case
from typing import Literal

from helpers import get_current_user, get_session_local
from models import (
    UserDB,
    UsersHouseholds,
    Tasks,
    Categories,
    UserEmail,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# ============================================================
# Response Models
# ============================================================


class StatItem(BaseModel):
    title: str
    value: str
    change: str
    trend: str
    icon: str


class WeeklyPoint(BaseModel):
    week: str
    values: dict[str, int]


class CategoryPoint(BaseModel):
    name: str
    value: int


class LoadTrendPoint(BaseModel):
    month: str
    load: int


class CompletionPoint(BaseModel):
    day: str
    completed: int
    pending: int


class RadarPoint(BaseModel):
    category: str
    values: dict[str, int]


class AnalyticsSummaryResponse(BaseModel):
    household_id: str
    people: list[str]
    labels: dict[str, str]
    weeklyData: list[WeeklyPoint]
    categoryData: list[CategoryPoint]
    loadTrendData: list[LoadTrendPoint]
    completionData: list[CompletionPoint]
    radarData: list[RadarPoint]

    stats: list[StatItem]


# ============================================================
# Helpers
# ============================================================


def _get_db_user(db, current_user: UserEmail) -> UserDB:
    user = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return user


def _require_membership(db, user_id: UUID, household_id: UUID) -> None:
    membership = db.scalar(
        select(UsersHouseholds).where(
            and_(
                UsersHouseholds.user_id == user_id,
                UsersHouseholds.household_id == household_id,
            )
        )
    )
    if not membership:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this household",
        )


def _default_household(db, user_id: UUID) -> UUID:
    uh = db.scalar(select(UsersHouseholds).where(UsersHouseholds.user_id == user_id))
    if not uh:
        raise HTTPException(
            status_code=404,
            detail="User is not in a household yet",
        )
    return uh.household_id


# ============================================================
# Main Endpoint
# ============================================================


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    household_id: UUID | None = None,
    timeframe: Literal["7d", "30d", "12w"] = "30d",
    current_user: UserEmail = Depends(get_current_user),
):
    """
    Returns real analytics data for the household dashboard.
    """

    session_local = get_session_local()

    with session_local() as db:
        me = _get_db_user(db, current_user)

        hid = household_id or _default_household(db, me.user_id)
        _require_membership(db, me.user_id, hid)

        # ------------------------------------------------------------
        # Household Members (labels for charts)
        # ------------------------------------------------------------
        # ------------------------------------------------------------
        # Household Members
        #   - 'people' must be usernames (stable keys for recharts dataKey)
        #   - 'labels' provides display_name for UI
        # ------------------------------------------------------------
        member_rows = db.execute(
            select(UserDB.user_id, UserDB.username, UserDB.display_name)
            .join(UsersHouseholds, UsersHouseholds.user_id == UserDB.user_id)
            .where(UsersHouseholds.household_id == hid)
            .order_by(UserDB.username.asc())
        ).all()

        people: list[str] = []  # usernames
        labels: dict[str, str] = {}  # username -> display label
        user_id_to_username: dict[UUID, str] = {}

        for r in member_rows:
            username = (r.username or "").strip()
            if not username:
                continue

            display = (r.display_name or r.username).strip()

            people.append(username)
            labels[username] = display
            user_id_to_username[r.user_id] = username

        # ------------------------------------------------------------
        # Time windows
        # ------------------------------------------------------------
        now = datetime.now(timezone.utc)
        # Global timeframe
        days = (
            7 if timeframe == "7d" else 30 if timeframe == "30d" else 84
        )  # 12w ≈ 84 days
        start = now - timedelta(days=days)

        # ============================================================
        # 1. Weekly Task Distribution per Person
        # ============================================================

        week_bucket = func.date_trunc("week", Tasks.created_at)

        weekly_rows = db.execute(
            select(
                week_bucket.label("wk"),
                Tasks.assigns_to,
                func.count().label("cnt"),
            )
            .where(
                Tasks.household_id == hid,
                Tasks.created_at >= start,
            )
            .group_by("wk", Tasks.assigns_to)
            .order_by("wk")
        ).all()

        weekly_map: dict[str, dict[str, int]] = {}

        for r in weekly_rows:
            wk_dt = r.wk
            iso = wk_dt.isocalendar()
            week_label = f"{iso.year}-W{iso.week:02d}"

            person = user_id_to_username.get(r.assigns_to, "unassigned")
            weekly_map.setdefault(week_label, {})
            weekly_map[week_label][person] = int(r.cnt or 0)

        weeklyData = [
            WeeklyPoint(week=w, values=weekly_map[w]) for w in sorted(weekly_map.keys())
        ]

        # ============================================================
        # 2. Category Breakdown (real join)
        # ============================================================

        category_rows = db.execute(
            select(
                func.coalesce(Categories.name, "Uncategorized").label("cat"),
                func.count().label("cnt"),
            )
            .select_from(Tasks)
            .outerjoin(Categories, Tasks.category_id == Categories.category_id)
            .where(
                Tasks.household_id == hid,
                Tasks.created_at >= start,
            )
            .group_by("cat")
            .order_by(func.count().desc())
        ).all()

        categoryData = [
            CategoryPoint(name=r.cat, value=int(r.cnt or 0)) for r in category_rows
        ]

        # ============================================================
        # 3. Load Trend (monthly open tasks)
        # ============================================================

        month_bucket = func.date_trunc("month", Tasks.created_at)

        load_rows = db.execute(
            select(
                month_bucket.label("mo"),
                func.sum(case((Tasks.status != "done", 1), else_=0)).label(
                    "open_tasks"
                ),
            )
            .where(
                Tasks.household_id == hid,
                Tasks.created_at >= start,
            )
            .group_by("mo")
            .order_by("mo")
        ).all()

        loadTrendData = []

        for r in load_rows:
            month_label = r.mo.strftime("%Y-%m")
            loadTrendData.append(
                LoadTrendPoint(
                    month=month_label,
                    load=min(100, int(r.open_tasks or 0)),
                )
            )

        # ============================================================
        # 4. Completion Rate (last 7 days)
        # ============================================================

        day_bucket = func.date_trunc("day", Tasks.created_at)

        completion_rows = db.execute(
            select(
                day_bucket.label("dy"),
                func.sum(case((Tasks.status == "done", 1), else_=0)).label("completed"),
                func.sum(case((Tasks.status != "done", 1), else_=0)).label("pending"),
            )
            .where(
                Tasks.household_id == hid,
                Tasks.created_at >= start,
            )
            .group_by("dy")
            .order_by("dy")
        ).all()

        completionData = [
            CompletionPoint(
                day=r.dy.strftime("%Y-%m-%d"),
                completed=int(r.completed or 0),
                pending=int(r.pending or 0),
            )
            for r in completion_rows
        ]

        # ============================================================
        # 5. Radar Data (category responsibility per person)
        # ============================================================

        radar_rows = db.execute(
            select(
                func.coalesce(Categories.name, "Uncategorized").label("cat"),
                Tasks.assigns_to,
                func.count().label("cnt"),
            )
            .select_from(Tasks)
            .outerjoin(Categories, Tasks.category_id == Categories.category_id)
            .where(
                Tasks.household_id == hid,
                Tasks.created_at >= start,
            )
            .group_by("cat", Tasks.assigns_to)
        ).all()

        radar_map: dict[str, dict[str, int]] = {}
        for r in radar_rows:
            cat = r.cat
            person = user_id_to_username.get(r.assigns_to, "unassigned")
            radar_map.setdefault(cat, {})
            radar_map[cat][person] = int(r.cnt or 0)
        radarData = [
            RadarPoint(category=cat, values=vals) for cat, vals in radar_map.items()
        ]

        # ============================================================
        # 6. Stats Cards
        #   Done This Week
        #   Open Tasks Remaining
        #   Overdue Tasks
        #   Load Balance Score (based on open tasks by assignee)
        # ============================================================

        # start of week (Mon) in UTC
        start_of_week = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        start_of_week = start_of_week - timedelta(days=start_of_week.weekday())

        done_this_week = (
            db.scalar(
                select(func.count())
                .select_from(Tasks)
                .where(
                    Tasks.household_id == hid,
                    Tasks.status == "done",
                    Tasks.complete_date.is_not(None),
                    Tasks.complete_date >= start_of_week,
                )
            )
            or 0
        )

        open_tasks = (
            db.scalar(
                select(func.count())
                .select_from(Tasks)
                .where(
                    Tasks.household_id == hid,
                    Tasks.status != "done",
                )
            )
            or 0
        )

        overdue_tasks = (
            db.scalar(
                select(func.count())
                .select_from(Tasks)
                .where(
                    Tasks.household_id == hid,
                    Tasks.status != "done",
                    Tasks.due_date.is_not(None),
                    Tasks.due_date < now,
                )
            )
            or 0
        )

        # Load balance based on OPEN tasks by assignee (ignores unassigned)
        assignee_counts = db.execute(
            select(
                Tasks.assigns_to,
                func.count().label("cnt"),
            )
            .where(
                Tasks.household_id == hid,
                Tasks.status != "done",
                Tasks.assigns_to.is_not(None),
            )
            .group_by(Tasks.assigns_to)
        ).all()

        # Convert to username -> count
        open_by_person: dict[str, int] = {}
        for r in assignee_counts:
            uname = user_id_to_username.get(r.assigns_to)
            if not uname:
                continue
            open_by_person[uname] = int(r.cnt or 0)

        # If 2+ people: score = 100 - (max_share - min_share)*100
        # If <2 people with tasks: score is "—"
        load_balance_value = "—"
        if len(open_by_person) >= 2:
            total = sum(open_by_person.values()) or 1
            shares = [c / total for c in open_by_person.values()]
            spread = max(shares) - min(shares)
            score = round((1.0 - spread) * 100)
            score = max(0, min(100, score))
            load_balance_value = f"{score}"

        stats = [
            StatItem(
                title="Done This Week",
                value=str(done_this_week),
                change="",
                trend="up",
                icon="CheckCircle2",
            ),
            StatItem(
                title="Open Tasks Remaining",
                value=str(open_tasks),
                change="",
                trend="info",
                icon="TrendingUp",
            ),
            StatItem(
                title="Overdue Tasks",
                value=str(overdue_tasks),
                change="",
                trend="down",
                icon="TrendingDown",
            ),
            StatItem(
                title="Load Balance Score",
                value=load_balance_value,
                change="",
                trend="info",
                icon="Users",
            ),
        ]

        # ============================================================
        # Response
        # ============================================================

        return AnalyticsSummaryResponse(
            household_id=str(hid),
            people=people,
            labels=labels,
            weeklyData=weeklyData,
            categoryData=categoryData,
            loadTrendData=loadTrendData,
            completionData=completionData,
            radarData=radarData,
            stats=stats,
        )
