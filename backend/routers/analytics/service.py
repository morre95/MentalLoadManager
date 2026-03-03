from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import HTTPException, status

from helpers import get_session_local
from models import UserEmail

from .repository import (
    count_done_this_week,
    count_open_tasks,
    count_overdue_tasks,
    fetch_category_rows,
    fetch_completion_rows,
    fetch_load_rows,
    fetch_member_rows,
    fetch_open_assignee_counts,
    fetch_radar_rows,
    fetch_weekly_rows,
    get_default_household_for_user,
    get_user_by_username,
    has_membership,
    count_done_in_range,
)
from .schemas import (
    AnalyticsSummaryResponse,
    CategoryPoint,
    CompletionPoint,
    LoadTrendPoint,
    RadarPoint,
    StatItem,
    WeeklyPoint,
)

OPEN_STATUSES = ("todo", "in_progress")
COMPLETED_STATUSES = ("done", "archive")


def _get_db_user(db, current_user: UserEmail):
    user = get_user_by_username(db, current_user.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return user


def _require_membership(db, user_id: UUID, household_id: UUID) -> None:
    if not has_membership(db, user_id, household_id):
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this household",
        )


def _default_household(db, user_id: UUID) -> UUID:
    uh = get_default_household_for_user(db, user_id)
    if not uh:
        raise HTTPException(
            status_code=404,
            detail="User is not in a household yet",
        )
    return uh.household_id


def get_analytics_summary(
    household_id: UUID | None,
    timeframe: Literal["7d", "30d", "12w"],
    current_user: UserEmail,
) -> AnalyticsSummaryResponse:
    session_local = get_session_local()

    with session_local() as db:
        me = _get_db_user(db, current_user)

        hid = household_id or _default_household(db, me.user_id)
        _require_membership(db, me.user_id, hid)

        member_rows = fetch_member_rows(db, hid)

        people: list[str] = []
        labels: dict[str, str] = {}
        user_id_to_username: dict[UUID, str] = {}

        for r in member_rows:
            username = (r.username or "").strip()
            if not username:
                continue

            display = (r.display_name or r.username).strip()

            people.append(username)
            labels[username] = display
            user_id_to_username[r.user_id] = username

        now = datetime.now(timezone.utc)
        days = 7 if timeframe == "7d" else 30 if timeframe == "30d" else 84
        start = now - timedelta(days=days)

        weekly_rows = fetch_weekly_rows(db, hid, start)
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

        category_rows = fetch_category_rows(db, hid, start)
        categoryData = [
            CategoryPoint(name=r.cat, value=int(r.cnt or 0)) for r in category_rows
        ]

        load_rows = fetch_load_rows(db, hid, start, OPEN_STATUSES)
        loadTrendData: list[LoadTrendPoint] = []
        for r in load_rows:
            month_label = r.mo.strftime("%Y-%m")
            loadTrendData.append(
                LoadTrendPoint(
                    month=month_label,
                    load=min(100, int(r.open_tasks or 0)),
                )
            )

        completion_rows = fetch_completion_rows(
            db,
            hid,
            start,
            COMPLETED_STATUSES,
            OPEN_STATUSES,
        )
        completionData = [
            CompletionPoint(
                day=r.dy.strftime("%Y-%m-%d"),
                completed=int(r.completed or 0),
                pending=int(r.pending or 0),
            )
            for r in completion_rows
        ]

        radar_rows = fetch_radar_rows(db, hid, start)
        radar_map: dict[str, dict[str, int]] = {}
        for r in radar_rows:
            cat = r.cat
            person = user_id_to_username.get(r.assigns_to, "unassigned")
            radar_map.setdefault(cat, {})
            radar_map[cat][person] = int(r.cnt or 0)

        radarData = [
            RadarPoint(category=cat, values=vals) for cat, vals in radar_map.items()
        ]

        start_of_week = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        start_of_week = start_of_week - timedelta(days=start_of_week.weekday())

        # Previous week range
        start_of_prev_week = start_of_week - timedelta(days=7)
        
        
        done_this_week = count_done_in_range(
            db, hid, COMPLETED_STATUSES, start_of_week, now
        )
        
        done_prev_week = count_done_in_range(
            db, hid, COMPLETED_STATUSES, start_of_prev_week, start_of_week
        )
        open_tasks = count_open_tasks(db, hid, OPEN_STATUSES)
        overdue_tasks = count_overdue_tasks(db, hid, OPEN_STATUSES, now)

        assignee_counts = fetch_open_assignee_counts(db, hid, OPEN_STATUSES)
        open_by_person: dict[str, int] = {}
        for r in assignee_counts:
            uname = user_id_to_username.get(r.assigns_to)
            if not uname:
                continue
            open_by_person[uname] = int(r.cnt or 0)

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
                previousValue=str(done_prev_week),
                change="",
                trend="up",
                icon="CheckCircle2",
                description="Tasks completed since last week.",
            ),
            StatItem(
                title="Open Tasks Remaining",
                value=str(open_tasks),
                previousValue=None,
                change="",
                trend="info",
                icon="TrendingUp",
                description="Tasks currently in todo or in_progress.",
            ),
            StatItem(
                title="Overdue Tasks",
                value=str(overdue_tasks),
                previousValue=None,
                change="",
                trend="down",
                icon="TrendingDown",
                description="Open tasks with a due date before now.",
            ),
            StatItem(
                title="Load Balance Score",
                value=load_balance_value,
                previousValue=None,
                change="",
                trend="info",
                icon="Users",
                description="How evenly open tasks are distributed across members.",
            ),
        ]

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
