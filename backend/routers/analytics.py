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
        member_rows = db.execute(
            select(UserDB.user_id, UserDB.username, UserDB.display_name)
            .join(UsersHouseholds, UsersHouseholds.user_id == UserDB.user_id)
            .where(UsersHouseholds.household_id == hid)
            .order_by(UserDB.username.asc())
        ).all()

        people: list[str] = []
        user_labels: dict[UUID, str] = {}

        for r in member_rows:
            label = (r.display_name or r.username).strip()
            people.append(label)
            user_labels[r.user_id] = label

        # ------------------------------------------------------------
        # Time windows
        # ------------------------------------------------------------
        now = datetime.now(timezone.utc)
        start_6_weeks = now - timedelta(weeks=6)
        start_6_months = now - timedelta(days=31 * 6)
        start_7_days = now - timedelta(days=7)

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
                Tasks.created_at >= start_6_weeks,
            )
            .group_by("wk", Tasks.assigns_to)
            .order_by("wk")
        ).all()

        weekly_map: dict[str, dict[str, int]] = {}

        for r in weekly_rows:
            wk_dt = r.wk
            iso = wk_dt.isocalendar()
            week_label = f"{iso.year}-W{iso.week:02d}"

            person = user_labels.get(r.assigns_to, "Unassigned")
            weekly_map.setdefault(week_label, {})
            weekly_map[week_label][person] = int(r.cnt or 0)

        weeklyData = [WeeklyPoint(week=w, values=v) for w, v in weekly_map.items()]

        # ============================================================
        # 2. Category Breakdown (real join)
        # ============================================================

        category_rows = db.execute(
            select(
                Categories.name,
                func.count().label("cnt"),
            )
            .join(Tasks, Tasks.category_id == Categories.category_id)
            .where(
                Tasks.household_id == hid,
                Tasks.created_at >= start_6_weeks,
            )
            .group_by(Categories.name)
            .order_by(func.count().desc())
        ).all()

        categoryData = [
            CategoryPoint(name=r.name, value=int(r.cnt or 0)) for r in category_rows
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
                Tasks.created_at >= start_6_months,
            )
            .group_by("mo")
            .order_by("mo")
        ).all()

        loadTrendData = []

        for r in load_rows:
            month_label = r.mo.strftime("%b")
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
                func.sum(case((Tasks.status == "done", 1), else_=0)).label(
                    "completed"
                ),
                func.sum(case((Tasks.status != "done", 1), else_=0)).label(
                    "pending"
                ),
            )
            .where(
                Tasks.household_id == hid,
                Tasks.created_at >= start_7_days,
            )
            .group_by("dy")
            .order_by("dy")
        ).all()

        completionData = [
            CompletionPoint(
                day=r.dy.strftime("%a"),
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
                Categories.name,
                Tasks.assigns_to,
                func.count().label("cnt"),
            )
            .join(Tasks, Tasks.category_id == Categories.category_id)
            .where(
                Tasks.household_id == hid,
                Tasks.created_at >= start_6_weeks,
            )
            .group_by(Categories.name, Tasks.assigns_to)
        ).all()

        radar_map: dict[str, dict[str, int]] = {}

        for r in radar_rows:
            cat = r.name
            person = user_labels.get(r.assigns_to, "Unassigned")

            radar_map.setdefault(cat, {})
            radar_map[cat][person] = int(r.cnt or 0)

        radarData = [
            RadarPoint(category=cat, values=vals) for cat, vals in radar_map.items()
        ]

        # ============================================================
        # 6. Stats Cards (real values)
        # ============================================================

        total_completed = (
            db.scalar(
                select(func.count())
                .select_from(Tasks)
                .where(
                    Tasks.household_id == hid,
                    Tasks.status == "done",
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

        stats = [
            StatItem(
                title="Total Tasks Completed",
                value=str(total_completed),
                change="+0%",
                trend="up",
                icon="CheckCircle2",
            ),
            StatItem(
                title="Open Tasks Remaining",
                value=str(open_tasks),
                change="+0%",
                trend="down",
                icon="TrendingDown",
            ),
            StatItem(
                title="Household Members",
                value=str(len(people)),
                change="+0%",
                trend="up",
                icon="Users",
            ),
        ]

        # ============================================================
        # Response
        # ============================================================

        return AnalyticsSummaryResponse(
            household_id=str(hid),
            people=people,
            weeklyData=weeklyData,
            categoryData=categoryData,
            loadTrendData=loadTrendData,
            completionData=completionData,
            radarData=radarData,
            stats=stats,
        )
