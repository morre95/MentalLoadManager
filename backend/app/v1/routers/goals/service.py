from collections import defaultdict
import hashlib
import json
import time as time_module
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import requests
from fastapi import HTTPException, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from config import settings
from helpers import get_session_local
from models import UserEmail

from .repository import (
    count_completed_personal_tasks_in_window,
    create_achievement_unlock,
    create_goal,
    get_achievement_unlock_by_completion_key,
    get_cached_goal_ai_checkin,
    get_goal_for_user,
    list_all_achievement_unlocks_for_user,
    list_available_category_names_for_user_households,
    list_achievement_unlocks_for_user,
    list_goal_history_for_user,
    list_goal_history_rows_for_user,
    list_goals_for_user,
    list_household_completed_tasks_for_achievements,
    list_personal_tasks_for_achievements,
    upsert_goal_history,
    upsert_cached_goal_ai_checkin,
)
from .schemas import (
    AchievementResponse,
    AchievementTimelineResponse,
    AchievementsResponse,
    CreateGoalRequest,
    DeleteGoalResponse,
    GoalAICheckinRequest,
    GoalAICheckinResponse,
    GoalHistoryResponse,
    GoalsBoardAICheckinRequest,
    GoalsBoardAICheckinResponse,
    GoalResponse,
    GoalsResponse,
    UpdateGoalProgressRequest,
)

ALLOWED_TRACKING_STYLES = {"daily", "weekly", "monthly", "total"}
COMPLETED_STATUSES = {"done", "archive"}
PERIOD_MILESTONES_DAYS = [7, 30, 60, 90, 180, 365]
DEFAULT_OPENROUTER_MODEL = "openrouter/free"
OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_TIMEZONE = "UTC"
GOAL_ACHIEVEMENT_COPY = {
    "savings": {
        "title": "Savings Vault",
        "description": "Reach your savings target for {goal_name}",
        "icon": "star",
    },
    "weight": {
        "title": "Finish Line",
        "description": "Move your weight journey forward with {goal_name}",
        "icon": "target",
    },
    "training": {
        "title": "Training Rhythm",
        "description": "Complete your planned sessions for {goal_name}",
        "icon": "flame",
    },
    "tasks": {
        "title": "Task Bloom",
        "description": "Hit your task target for {goal_name}",
        "icon": "check",
    },
    "reading": {
        "title": "Shelf Builder",
        "description": "Make reading progress on {goal_name}",
        "icon": "trophy",
    },
    "meditation": {
        "title": "Calm Current",
        "description": "Keep the meditation practice moving for {goal_name}",
        "icon": "star",
    },
    "revenue": {
        "title": "Launch Window",
        "description": "Reach the revenue target for {goal_name}",
        "icon": "target",
    },
    "hydration": {
        "title": "Hydration Flow",
        "description": "Stay on top of your hydration target for {goal_name}",
        "icon": "check",
    },
    "learning": {
        "title": "Skill Climb",
        "description": "Advance your learning path for {goal_name}",
        "icon": "trophy",
    },
    "streak": {
        "title": "Flame Keeper",
        "description": "Keep the consistency going for {goal_name}",
        "icon": "flame",
    },
}


def _achievement_rarity_for_target(target: int) -> str:
    if target >= 100:
        return "legendary"
    if target >= 25:
        return "epic"
    if target >= 8:
        return "rare"
    return "common"


def _goal_specific_rarity(goal) -> str:
    tracking_style = (goal.tracking_style or "total").strip().lower()
    target_value = int(goal.target_value or 0)
    if tracking_style == "monthly" or target_value >= 50:
        return "epic"
    if tracking_style == "weekly" or target_value >= 10:
        return "rare"
    return "common"


def _to_achievement_timeline_response(unlock) -> AchievementTimelineResponse:
    return AchievementTimelineResponse(
        achievement_unlock_id=str(unlock.achievement_unlock_id),
        achievement_id=unlock.achievement_id,
        title=unlock.title,
        category=unlock.category,
        rarity=unlock.rarity,
        entity_id=unlock.entity_id,
        unlocked_at=unlock.unlocked_at,
    )


def _last_unlocked_label_from_completion_key(completion_key: str | None) -> str | None:
    if not completion_key:
        return None

    last_segment = str(completion_key).rsplit(":", 1)[-1].strip()
    if last_segment.isdigit():
        return last_segment
    return None


def _apply_achievement_unlock_state(
    db,
    *,
    user_id: UUID,
    achievements: list[AchievementResponse],
) -> tuple[list[AchievementResponse], list[Any]]:
    timeline_additions = []
    enriched: list[AchievementResponse] = []
    unlock_rows = list_all_achievement_unlocks_for_user(db, user_id)
    latest_unlock_by_achievement_id: dict[str, Any] = {}

    for row in unlock_rows:
        if row.achievement_id not in latest_unlock_by_achievement_id:
            latest_unlock_by_achievement_id[row.achievement_id] = row

    for achievement in achievements:
        unlock = None
        completion_key = achievement.completion_key
        if completion_key:
            unlock = get_achievement_unlock_by_completion_key(
                db,
                user_id=user_id,
                completion_key=completion_key,
            )

        current_milestone_complete = bool(achievement.current >= achievement.target)
        unlocked_at = unlock.unlocked_at if unlock is not None else None
        latest_unlock = latest_unlock_by_achievement_id.get(achievement.id)

        if current_milestone_complete and completion_key and unlock is None:
            unlock = create_achievement_unlock(
                db,
                user_id=user_id,
                achievement_id=achievement.id,
                title=achievement.title,
                category=achievement.category,
                rarity=achievement.rarity,
                completion_key=completion_key,
                entity_id=achievement.entity_id,
            )
            timeline_additions.append(unlock)
            unlocked_at = unlock.unlocked_at
            latest_unlock = unlock
            latest_unlock_by_achievement_id[achievement.id] = unlock

        enriched.append(
            achievement.model_copy(
                update={
                    "completed": current_milestone_complete,
                    "current_milestone_complete": current_milestone_complete,
                    "has_unlocked_before": latest_unlock is not None,
                    "unlocked_at": unlocked_at,
                    "last_unlocked_at": latest_unlock.unlocked_at if latest_unlock is not None else None,
                    "last_unlocked_label": (
                        _last_unlocked_label_from_completion_key(latest_unlock.completion_key)
                        if latest_unlock is not None
                        else None
                    ),
                }
            )
        )

    return enriched, timeline_additions


class _GoalAICheckinModelPayload(BaseModel):
    status_summary: str
    pace_needed: str
    risk_level: str
    next_step: str
    adjustment_suggestion: str
    evidence: list[str] = Field(default_factory=list)


class _GoalsBoardAICheckinPayload(BaseModel):
    headline: str
    summary: str
    priorities: list[str] = Field(default_factory=list)
    wins: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)


def _to_goal_response(goal) -> GoalResponse:
    progress_data = goal.progress_data or {}
    return GoalResponse(
        goal_id=str(goal.goal_id),
        type=goal.type,
        name=goal.name,
        current_value=goal.current_value,
        target_value=goal.target_value,
        tracking_style=goal.tracking_style,
        progress_data=progress_data,
        created_at=goal.created_at,
        is_recurring=(goal.tracking_style or "total").strip().lower() != "total",
        period_key=progress_data.get("period_key"),
        period_start=_coerce_iso_datetime(progress_data.get("period_start_at")),
        period_end=_coerce_iso_datetime(progress_data.get("period_end_at")),
        current_streak=int(progress_data.get("current_streak") or 0),
        best_streak=int(progress_data.get("best_streak") or 0),
        completed_periods=int(progress_data.get("completed_periods") or 0),
        history=[
            _to_goal_history_response(history_item)
            for history_item in getattr(goal, "_history_rows", [])
        ],
    )


def _resolve_timezone_name(progress_data: dict[str, Any] | None) -> str:
    timezone_name = (progress_data or {}).get("timezone")
    if not isinstance(timezone_name, str) or not timezone_name.strip():
        return DEFAULT_TIMEZONE
    return timezone_name.strip()


def _resolve_timezone(progress_data: dict[str, Any] | None):
    timezone_name = _resolve_timezone_name(progress_data)
    try:
        return timezone_name, ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        return DEFAULT_TIMEZONE, ZoneInfo(DEFAULT_TIMEZONE)


def _coerce_iso_datetime(value):
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _to_goal_history_response(history_item) -> GoalHistoryResponse:
    return GoalHistoryResponse(
        goal_history_id=str(history_item.goal_history_id),
        tracking_style=history_item.tracking_style,
        period_key=history_item.period_key,
        period_started_at=history_item.period_started_at,
        period_ended_at=history_item.period_ended_at,
        current_value=history_item.current_value,
        target_value=history_item.target_value,
        completed=bool(history_item.completed),
        created_at=history_item.created_at,
    )


def _period_bounds_for_goal(goal, now_utc: datetime) -> tuple[str | None, datetime | None, datetime | None]:
    tracking_style = (goal.tracking_style or "total").strip().lower()
    if tracking_style == "total":
        return None, goal.created_at or now_utc, None

    _, zone = _resolve_timezone(goal.progress_data or {})
    now_local = now_utc.astimezone(zone)

    if tracking_style == "daily":
        period_start_local = datetime.combine(now_local.date(), datetime.min.time(), tzinfo=zone)
        period_end_local = period_start_local + timedelta(days=1)
        period_key = period_start_local.date().isoformat()
    elif tracking_style == "weekly":
        period_start_local = datetime.combine(now_local.date(), datetime.min.time(), tzinfo=zone)
        period_start_local = period_start_local - timedelta(days=period_start_local.weekday())
        period_end_local = period_start_local + timedelta(days=7)
        period_key = period_start_local.date().isoformat()
    elif tracking_style == "monthly":
        period_start_local = datetime(
            year=now_local.year,
            month=now_local.month,
            day=1,
            tzinfo=zone,
        )
        if now_local.month == 12:
            period_end_local = datetime(year=now_local.year + 1, month=1, day=1, tzinfo=zone)
        else:
            period_end_local = datetime(year=now_local.year, month=now_local.month + 1, day=1, tzinfo=zone)
        period_key = f"{period_start_local.year:04d}-{period_start_local.month:02d}"
    else:
        return None, goal.created_at or now_utc, None

    return (
        period_key,
        period_start_local.astimezone(timezone.utc),
        period_end_local.astimezone(timezone.utc),
    )


def _update_goal_period_metadata(goal, *, period_key, period_start, period_end, timezone_name: str):
    progress_data = dict(goal.progress_data or {})
    progress_data["timezone"] = timezone_name
    progress_data["period_key"] = period_key
    progress_data["period_start_at"] = period_start.isoformat() if period_start is not None else None
    progress_data["period_end_at"] = period_end.isoformat() if period_end is not None else None
    progress_data["current_streak"] = int(progress_data.get("current_streak") or 0)
    progress_data["best_streak"] = int(progress_data.get("best_streak") or 0)
    progress_data["completed_periods"] = int(progress_data.get("completed_periods") or 0)
    goal.progress_data = progress_data


def _close_goal_period_if_needed(db, goal, user_id: UUID, now_utc: datetime):
    tracking_style = (goal.tracking_style or "total").strip().lower()
    if tracking_style == "total":
        return goal

    progress_data = dict(goal.progress_data or {})
    timezone_name, _ = _resolve_timezone(progress_data)
    next_period_key, next_period_start, next_period_end = _period_bounds_for_goal(goal, now_utc)
    stored_period_key = progress_data.get("period_key")

    if not isinstance(stored_period_key, str) or not stored_period_key:
        _update_goal_period_metadata(
            goal,
            period_key=next_period_key,
            period_start=next_period_start,
            period_end=next_period_end,
            timezone_name=timezone_name,
        )
        goal.updated_at = now_utc
        db.flush()
        return goal

    if stored_period_key == next_period_key:
        _update_goal_period_metadata(
            goal,
            period_key=next_period_key,
            period_start=next_period_start,
            period_end=next_period_end,
            timezone_name=timezone_name,
        )
        return goal

    previous_period_start = _coerce_iso_datetime(progress_data.get("period_start_at"))
    previous_period_end = _coerce_iso_datetime(progress_data.get("period_end_at"))
    completed = int(goal.current_value or 0) >= int(goal.target_value or 0)
    current_streak = int(progress_data.get("current_streak") or 0)
    completed_periods = int(progress_data.get("completed_periods") or 0)
    best_streak = int(progress_data.get("best_streak") or 0)

    upsert_goal_history(
        db,
        goal_id=goal.goal_id,
        user_id=user_id,
        tracking_style=tracking_style,
        period_key=stored_period_key,
        period_started_at=previous_period_start,
        period_ended_at=previous_period_end,
        current_value=int(goal.current_value or 0),
        target_value=int(goal.target_value or 0),
        completed=completed,
        snapshot_data={
            "goal_name": goal.name,
            "goal_type": goal.type,
            "progress_data": {k: v for k, v in progress_data.items() if k != "_history_rows"},
        },
    )

    progress_data["completed_periods"] = completed_periods + (1 if completed else 0)
    progress_data["current_streak"] = current_streak + 1 if completed else 0
    progress_data["best_streak"] = max(best_streak, int(progress_data["current_streak"]))
    progress_data["last_reset_at"] = now_utc.isoformat()
    progress_data["last_period_key"] = stored_period_key
    progress_data["last_period_result"] = {
        "completed": completed,
        "current_value": int(goal.current_value or 0),
        "target_value": int(goal.target_value or 0),
    }

    if goal.type == "training":
        progress_data["training_days"] = [False] * 7

    goal.current_value = 0
    goal.progress_data = progress_data
    _update_goal_period_metadata(
        goal,
        period_key=next_period_key,
        period_start=next_period_start,
        period_end=next_period_end,
        timezone_name=timezone_name,
    )
    goal.updated_at = now_utc
    db.flush()
    return goal


def _sync_derived_goal_progress(db, goal, user_id: UUID):
    now_utc = datetime.now(timezone.utc)
    goal = _close_goal_period_if_needed(db, goal, user_id, now_utc)

    if goal.type != "tasks":
        return goal

    tracking_style = (goal.tracking_style or "daily").strip().lower()
    _, start_at, end_at = _period_bounds_for_goal(goal, now_utc)
    if tracking_style == "total":
        start_at = None
        end_at = None

    completed_today = count_completed_personal_tasks_in_window(
        db,
        user_id,
        start_at=start_at,
        end_at=end_at,
    )

    if goal.current_value != completed_today:
        goal.current_value = completed_today
        goal.updated_at = now_utc
        db.flush()

    return goal


def _normalize_progress_data(
    goal_type: str,
    progress_data: dict[str, Any] | None,
    current_value: int,
) -> tuple[int, dict[str, Any]]:
    normalized_data = dict(progress_data or {})

    if goal_type != "training":
        return current_value, normalized_data

    training_days = normalized_data.get("training_days")
    if training_days is None:
        return current_value, normalized_data

    if not isinstance(training_days, list) or len(training_days) != 7:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="training progress_data.training_days must contain 7 boolean values",
        )

    normalized_days = [bool(day) for day in training_days]
    normalized_data["training_days"] = normalized_days

    week_key = normalized_data.get("week_key")
    if week_key is not None and not isinstance(week_key, str):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="training progress_data.week_key must be a string",
        )

    return sum(normalized_days), normalized_data


def _next_milestone(value: int, milestones: list[int]) -> int:
    for milestone in milestones:
        if value < milestone:
            return milestone
    return max(1, milestones[-1] * 2)


def _to_date(value):
    if value is None:
        return None
    return value.date()


def _window_start(today_date, days: int):
    return today_date - timedelta(days=days - 1)


def _is_equal_split_window(household_rows, user_id: UUID, today_date, days: int) -> bool:
    start_date = _window_start(today_date, days)
    counts_by_household = defaultdict(lambda: defaultdict(int))

    for row in household_rows:
        completed_at = _to_date(row.complete_date)
        if completed_at is None or completed_at < start_date:
            continue
        counts_by_household[row.household_id][row.assigns_to] += 1

    total_tasks = 0
    total_user_tasks = 0
    for user_counts in counts_by_household.values():
        household_total = sum(user_counts.values())
        if household_total == 0:
            continue
        total_tasks += household_total
        total_user_tasks += user_counts.get(user_id, 0)

    minimum_tasks_required = max(6, days // 3)
    if total_tasks < minimum_tasks_required:
        return False

    share = total_user_tasks / total_tasks
    return 0.4 <= share <= 0.6


def _equal_split_progress_days(household_rows, user_id: UUID, today_date) -> int:
    progress_days = 0
    for offset in range(6, -1, -1):
        day = today_date - timedelta(days=offset)
        total_tasks = 0
        user_tasks = 0
        for row in household_rows:
            completed_at = _to_date(row.complete_date)
            if completed_at != day:
                continue
            total_tasks += 1
            if row.assigns_to == user_id:
                user_tasks += 1

        if total_tasks < 2:
            continue
        share = user_tasks / total_tasks
        if 0.35 <= share <= 0.65:
            progress_days += 1

    return progress_days


def _is_perfect_completion_window(personal_rows, today_date, days: int) -> bool:
    start_date = _window_start(today_date, days)
    due_tasks = []
    covered_days = set()

    for row in personal_rows:
        due_date = _to_date(row.due_date)
        if due_date is None or due_date < start_date:
            continue
        due_tasks.append(row)
        covered_days.add(due_date)

    minimum_tasks_required = max(3, days // 4)
    minimum_days_covered = max(3, days // 7)
    if len(due_tasks) < minimum_tasks_required or len(covered_days) < minimum_days_covered:
        return False

    for row in due_tasks:
        if row.status not in COMPLETED_STATUSES:
            return False
    return True


def _perfect_week_progress_days(personal_rows, today_date) -> int:
    tasks_by_due_day = defaultdict(list)
    for row in personal_rows:
        due_date = _to_date(row.due_date)
        if due_date is None:
            continue
        tasks_by_due_day[due_date].append(row)

    progress_days = 0
    for offset in range(6, -1, -1):
        day = today_date - timedelta(days=offset)
        day_tasks = tasks_by_due_day.get(day, [])
        if not day_tasks:
            continue
        if all(task.status in COMPLETED_STATUSES for task in day_tasks):
            progress_days += 1
    return progress_days


def _is_early_bird_window(personal_rows, today_date, days: int) -> bool:
    start_date = _window_start(today_date, days)
    due_tasks = []

    for row in personal_rows:
        due_date = _to_date(row.due_date)
        if due_date is None or due_date < start_date:
            continue
        due_tasks.append(row)

    minimum_tasks_required = max(3, days // 4)
    if len(due_tasks) < minimum_tasks_required:
        return False

    for row in due_tasks:
        if row.status not in COMPLETED_STATUSES:
            return False
        if row.complete_date is None or row.due_date is None:
            return False
        if row.complete_date > row.due_date:
            return False
    return True


def _early_bird_progress_days(personal_rows, today_date) -> int:
    tasks_by_due_day = defaultdict(list)
    for row in personal_rows:
        due_date = _to_date(row.due_date)
        if due_date is None:
            continue
        tasks_by_due_day[due_date].append(row)

    progress_days = 0
    for offset in range(6, -1, -1):
        day = today_date - timedelta(days=offset)
        day_tasks = tasks_by_due_day.get(day, [])
        if not day_tasks:
            continue

        is_early = True
        for task in day_tasks:
            if task.status not in COMPLETED_STATUSES:
                is_early = False
                break
            if task.complete_date is None or task.due_date is None:
                is_early = False
                break
            if task.complete_date > task.due_date:
                is_early = False
                break

        if is_early:
            progress_days += 1

    return progress_days


def _build_equal_split_achievement(household_rows, user_id: UUID, today_date):
    achieved_days = 0
    for days in PERIOD_MILESTONES_DAYS:
        if _is_equal_split_window(household_rows, user_id, today_date, days):
            achieved_days = days
        else:
            break

    if achieved_days == 0:
        return AchievementResponse(
            id="a2",
            title="Equal Split",
            description="Balanced contribution in the last week",
            icon="scale",
            current=_equal_split_progress_days(household_rows, user_id, today_date),
            target=7,
            category="Balance",
            rarity="rare",
            completion_key="a2:7" if _equal_split_progress_days(household_rows, user_id, today_date) >= 7 else None,
        )

    return AchievementResponse(
        id="a2",
        title="Equal Split",
        description=f"Balanced for {achieved_days} days. Next milestone: {_next_milestone(achieved_days, PERIOD_MILESTONES_DAYS)} days.",
        icon="scale",
        current=achieved_days,
        target=_next_milestone(achieved_days, PERIOD_MILESTONES_DAYS),
        category="Balance",
        completed=achieved_days >= _next_milestone(achieved_days, PERIOD_MILESTONES_DAYS),
        rarity=_achievement_rarity_for_target(max(1, achieved_days)),
        completion_key=f"a2:{achieved_days}" if achieved_days > 0 else None,
    )


def _build_perfect_week_achievement(personal_rows, today_date):
    achieved_days = 0
    for days in PERIOD_MILESTONES_DAYS:
        if _is_perfect_completion_window(personal_rows, today_date, days):
            achieved_days = days
        else:
            break

    if achieved_days == 0:
        return AchievementResponse(
            id="a3",
            title="Perfect Week",
            description="Complete all due personal tasks in the week",
            icon="flame",
            current=_perfect_week_progress_days(personal_rows, today_date),
            target=7,
            category="Consistency",
            rarity="rare",
            completion_key="a3:7" if _perfect_week_progress_days(personal_rows, today_date) >= 7 else None,
        )

    return AchievementResponse(
        id="a3",
        title="Perfect Week",
        description=f"Perfect completion for {achieved_days} days. Next milestone: {_next_milestone(achieved_days, PERIOD_MILESTONES_DAYS)} days.",
        icon="flame",
        current=achieved_days,
        target=_next_milestone(achieved_days, PERIOD_MILESTONES_DAYS),
        category="Consistency",
        completed=achieved_days >= _next_milestone(achieved_days, PERIOD_MILESTONES_DAYS),
        rarity=_achievement_rarity_for_target(max(1, achieved_days)),
        completion_key=f"a3:{achieved_days}" if achieved_days > 0 else None,
    )


def _build_early_bird_achievement(personal_rows, today_date):
    achieved_days = 0
    for days in PERIOD_MILESTONES_DAYS:
        if _is_early_bird_window(personal_rows, today_date, days):
            achieved_days = days
        else:
            break

    if achieved_days == 0:
        return AchievementResponse(
            id="a5",
            title="Early Bird",
            description="Finish due tasks before deadline in the week",
            icon="check",
            current=_early_bird_progress_days(personal_rows, today_date),
            target=7,
            category="Consistency",
            rarity="rare",
            completion_key="a5:7" if _early_bird_progress_days(personal_rows, today_date) >= 7 else None,
        )

    return AchievementResponse(
        id="a5",
        title="Early Bird",
        description=f"Early completion for {achieved_days} days. Next milestone: {_next_milestone(achieved_days, PERIOD_MILESTONES_DAYS)} days.",
        icon="check",
        current=achieved_days,
        target=_next_milestone(achieved_days, PERIOD_MILESTONES_DAYS),
        category="Consistency",
        completed=achieved_days >= _next_milestone(achieved_days, PERIOD_MILESTONES_DAYS),
        rarity=_achievement_rarity_for_target(max(1, achieved_days)),
        completion_key=f"a5:{achieved_days}" if achieved_days > 0 else None,
    )


def _attach_goal_history_rows(goals, history_rows) -> None:
    history_by_goal: dict[UUID, list[Any]] = defaultdict(list)
    for row in history_rows:
        history_by_goal[row.goal_id].append(row)

    for goal in goals:
        setattr(goal, "_history_rows", history_by_goal.get(goal.goal_id, []))


def _build_goal_completion_achievement(history_rows) -> AchievementResponse:
    completed_periods = sum(1 for row in history_rows if row.completed)
    return AchievementResponse(
        id="a7",
        title="Goal Closer",
        description="Finish recurring goal periods across all your active routines",
        icon="target",
        current=completed_periods,
        target=_next_milestone(completed_periods, [1, 3, 5, 10, 20, 40]),
        category="Goals",
        completed=completed_periods >= _next_milestone(completed_periods, [1, 3, 5, 10, 20, 40]),
        rarity=_achievement_rarity_for_target(max(1, completed_periods)),
        completion_key=f"a7:{completed_periods}" if completed_periods > 0 else None,
    )


def _build_goal_streak_achievement(goals) -> AchievementResponse:
    best_streak = 0
    best_goal_name = "No streak yet"
    for goal in goals:
        progress_data = goal.progress_data or {}
        streak = int(progress_data.get("best_streak") or 0)
        if streak > best_streak:
            best_streak = streak
            best_goal_name = goal.name

    target = _next_milestone(best_streak, [1, 2, 4, 8, 12, 24])
    return AchievementResponse(
        id="a8",
        title="Streak Keeper",
        description=f"Best recurring streak: {best_goal_name}",
        icon="flame",
        current=best_streak,
        target=target,
        category="Goals",
        completed=best_streak >= target,
        rarity=_achievement_rarity_for_target(max(1, best_streak)),
        completion_key=f"a8:{best_streak}" if best_streak > 0 else None,
    )


def _build_all_goals_current_period_achievement(goals) -> AchievementResponse:
    recurring_goals = [goal for goal in goals if (goal.tracking_style or "total").strip().lower() != "total"]
    completed_now = sum(1 for goal in recurring_goals if int(goal.current_value or 0) >= int(goal.target_value or 0))
    target = max(1, len(recurring_goals))
    return AchievementResponse(
        id="a9",
        title="All Systems Go",
        description="Complete all recurring goals within the current period",
        icon="check",
        current=completed_now,
        target=target,
        category="Goals",
        completed=completed_now >= target,
        rarity=_achievement_rarity_for_target(target),
        completion_key=f"a9:{target}",
    )


def _build_goal_variety_achievement(history_rows, goals) -> AchievementResponse:
    completed_types = {
        str((row.snapshot_data or {}).get("goal_type") or "").strip().lower()
        for row in history_rows
        if row.completed
    }
    for goal in goals:
        if int(goal.current_value or 0) >= int(goal.target_value or 0):
            completed_types.add(str(goal.type or "").strip().lower())

    completed_types.discard("")
    target = _next_milestone(len(completed_types), [1, 3, 5, 7, 9])
    return AchievementResponse(
        id="a10",
        title="Goal Explorer",
        description="Complete different kinds of goals, not just the same routine",
        icon="star",
        current=len(completed_types),
        target=target,
        category="Goals",
        completed=len(completed_types) >= target,
        rarity=_achievement_rarity_for_target(max(1, len(completed_types))),
        completion_key=f"a10:{len(completed_types)}" if len(completed_types) > 0 else None,
    )


def _build_training_master_achievement(history_rows, goals) -> AchievementResponse:
    completed_training_periods = sum(
        1
        for row in history_rows
        if row.completed and (row.snapshot_data or {}).get("goal_type") == "training"
    )
    current_training_completions = sum(
        1
        for goal in goals
        if goal.type == "training" and int(goal.current_value or 0) >= int(goal.target_value or 0)
    )
    current_value = completed_training_periods + current_training_completions
    target = _next_milestone(current_value, [1, 4, 8, 12, 24])
    return AchievementResponse(
        id="a11",
        title="Training Master",
        description="Close out weekly training periods consistently",
        icon="trophy",
        current=current_value,
        target=target,
        category="Goals",
        completed=current_value >= target,
        rarity=_achievement_rarity_for_target(max(1, current_value)),
        completion_key=f"a11:{current_value}" if current_value > 0 else None,
    )


def _build_goal_specific_achievement(goal) -> AchievementResponse:
    copy = GOAL_ACHIEVEMENT_COPY.get(goal.type, {})
    progress_data = goal.progress_data or {}
    is_recurring = (goal.tracking_style or "total").strip().lower() != "total"
    period_key = str(progress_data.get("period_key") or "lifetime")
    current_value = int(goal.current_value or 0)
    target_value = max(1, int(goal.target_value or 1))
    completed = current_value >= target_value
    title = str(copy.get("title") or goal.name or "Goal Progress")
    description_template = str(copy.get("description") or "Make progress on {goal_name}")
    description = description_template.format(goal_name=goal.name)

    if is_recurring:
        description = f"{description}. Current {goal.tracking_style} period."

    return AchievementResponse(
        id=f"goal:{goal.goal_id}",
        title=title,
        description=description,
        icon=str(copy.get("icon") or "target"),
        current=current_value,
        target=target_value,
        category="Goal",
        completed=completed,
        entity_id=str(goal.goal_id),
        rarity=_goal_specific_rarity(goal),
        completion_key=f"goal:{goal.goal_id}:{period_key if is_recurring else target_value}",
    )


def list_my_achievements(current_user: UserEmail) -> AchievementsResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        personal_rows = list_personal_tasks_for_achievements(db, current_user.user_id)
        household_rows = list_household_completed_tasks_for_achievements(
            db, current_user.user_id
        )
        category_name_rows = list_available_category_names_for_user_households(
            db, current_user.user_id
        )
        goals = list_goals_for_user(db, current_user.user_id)
        goals = [_sync_derived_goal_progress(db, goal, current_user.user_id) for goal in goals]
        history_rows = list_goal_history_rows_for_user(db, current_user.user_id)
        db.commit()

        today_date = datetime.now(timezone.utc).date()
        completed_personal_rows = [
            row for row in personal_rows if row.status in COMPLETED_STATUSES
        ]

        completed_by_category = defaultdict(int)
        for row in completed_personal_rows:
            category_name = row.category_name or "Uncategorized"
            completed_by_category[category_name] += 1

        best_category_name = "No category yet"
        best_category_count = 0
        if completed_by_category:
            best_category_name, best_category_count = max(
                completed_by_category.items(), key=lambda item: item[1]
            )

        distinct_completed_categories = set()
        for row in completed_personal_rows:
            category_name = (row.category_name or "Uncategorized").strip() or "Uncategorized"
            distinct_completed_categories.add(category_name.lower())

        available_categories = {
            (row.name or "").strip().lower()
            for row in category_name_rows
            if (row.name or "").strip()
        }
        total_available_categories = max(1, len(available_categories))

        completed_tasks_count = len(completed_personal_rows)
        goal_specific_achievements = [
            _build_goal_specific_achievement(goal)
            for goal in goals
        ]
        has_any_goals = len(goals) > 0
        has_training_goal = any(goal.type == "training" for goal in goals)

        achievements = [
            AchievementResponse(
                id="a1",
                title="Category Champion",
                description=f"Your top category is {best_category_name}",
                icon="trophy",
                current=best_category_count,
                target=_next_milestone(best_category_count, [5, 15, 30, 60, 120, 250]),
                category="Tasks",
                completed=best_category_count >= _next_milestone(best_category_count, [5, 15, 30, 60, 120, 250]),
                rarity=_achievement_rarity_for_target(max(1, best_category_count)),
                completion_key=f"a1:{best_category_count}" if best_category_count > 0 else None,
            ),
            _build_equal_split_achievement(household_rows, current_user.user_id, today_date),
            _build_perfect_week_achievement(personal_rows, today_date),
            AchievementResponse(
                id="a4",
                title="Task Master",
                description="Complete tasks over your full lifetime",
                icon="star",
                current=completed_tasks_count,
                target=_next_milestone(completed_tasks_count, [100, 250, 500, 1000, 2000]),
                category="Tasks",
                completed=completed_tasks_count >= _next_milestone(completed_tasks_count, [100, 250, 500, 1000, 2000]),
                rarity=_achievement_rarity_for_target(max(1, completed_tasks_count)),
                completion_key=f"a4:{completed_tasks_count}" if completed_tasks_count > 0 else None,
            ),
            _build_early_bird_achievement(personal_rows, today_date),
            AchievementResponse(
                id="a6",
                title="Category Explorer",
                description=f"Completed categories: {len(distinct_completed_categories)}/{total_available_categories}",
                icon="target",
                current=len(distinct_completed_categories),
                target=max(total_available_categories, len(distinct_completed_categories)),
                category="Tasks",
                completed=len(distinct_completed_categories) >= max(total_available_categories, len(distinct_completed_categories)),
                rarity=_achievement_rarity_for_target(max(1, len(distinct_completed_categories))),
                completion_key=f"a6:{len(distinct_completed_categories)}" if len(distinct_completed_categories) > 0 else None,
            ),
        ]

        if has_any_goals:
            achievements.extend(goal_specific_achievements)
            achievements.append(_build_goal_completion_achievement(history_rows))
            achievements.append(_build_goal_streak_achievement(goals))
            achievements.append(_build_all_goals_current_period_achievement(goals))
            achievements.append(_build_goal_variety_achievement(history_rows, goals))

        if has_training_goal:
            achievements.append(_build_training_master_achievement(history_rows, goals))

        achievements, _timeline_additions = _apply_achievement_unlock_state(
            db,
            user_id=current_user.user_id,
            achievements=achievements,
        )
        db.commit()
        timeline_rows = list_achievement_unlocks_for_user(db, current_user.user_id)
        timeline = [_to_achievement_timeline_response(item) for item in timeline_rows]

        return AchievementsResponse(
            achievements=achievements,
            timeline=timeline,
        )


def list_my_goals(current_user: UserEmail) -> GoalsResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        goals = list_goals_for_user(db, current_user.user_id)
        goals = [_sync_derived_goal_progress(db, goal, current_user.user_id) for goal in goals]
        history_rows = list_goal_history_for_user(db, current_user.user_id)
        _attach_goal_history_rows(goals, history_rows)
        db.commit()
        return GoalsResponse(goals=[_to_goal_response(goal) for goal in goals])


def create_my_goal(payload: CreateGoalRequest, current_user: UserEmail) -> GoalResponse:
    tracking_style = payload.tracking_style.strip().lower()
    if tracking_style not in ALLOWED_TRACKING_STYLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tracking_style must be one of: daily, weekly, monthly, total",
        )

    goal_type = payload.type.strip().lower()
    name = payload.name.strip()

    if not goal_type or not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Goal type and name are required",
        )

    current_value, progress_data = _normalize_progress_data(
        goal_type,
        payload.progress_data,
        payload.current_value,
    )
    timezone_name, _ = _resolve_timezone(progress_data)
    progress_data["timezone"] = timezone_name

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        goal = create_goal(
            db,
            user_id=current_user.user_id,
            type=goal_type,
            name=name,
            current_value=current_value,
            target_value=payload.target_value,
            tracking_style=tracking_style,
            progress_data=progress_data,
        )
        _close_goal_period_if_needed(db, goal, current_user.user_id, datetime.now(timezone.utc))

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to create goal",
            ) from exc

        db.refresh(goal)
        return _to_goal_response(goal)


def update_my_goal_progress(
    goal_id: UUID,
    payload: UpdateGoalProgressRequest,
    current_user: UserEmail,
) -> GoalResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        goal = get_goal_for_user(db, goal_id, current_user.user_id)
        if goal is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal was not found",
            )

        if goal.type == "tasks":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task goals are updated automatically from completed tasks",
            )

        goal = _close_goal_period_if_needed(db, goal, current_user.user_id, datetime.now(timezone.utc))

        current_value, progress_data = _normalize_progress_data(
            goal.type,
            payload.progress_data if payload.progress_data is not None else goal.progress_data,
            payload.current_value,
        )
        timezone_name, _ = _resolve_timezone(progress_data)
        progress_data["timezone"] = timezone_name
        goal.current_value = current_value
        goal.progress_data = progress_data
        goal.updated_at = datetime.now(timezone.utc)
        _close_goal_period_if_needed(db, goal, current_user.user_id, datetime.now(timezone.utc))

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update goal progress",
            ) from exc

        db.refresh(goal)
        _attach_goal_history_rows([goal], list_goal_history_for_user(db, current_user.user_id))
        return _to_goal_response(goal)


def delete_my_goal(goal_id: UUID, current_user: UserEmail) -> DeleteGoalResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        goal = get_goal_for_user(db, goal_id, current_user.user_id)
        if goal is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal was not found",
            )

        db.delete(goal)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to delete goal",
            ) from exc

        return DeleteGoalResponse(goal_id=str(goal_id), deleted=True)


def _safe_ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def _goal_period_context(goal, now_utc: datetime) -> dict[str, Any]:
    tracking_style = (goal.tracking_style or "total").strip().lower()
    created_at = goal.created_at or now_utc
    progress_data = goal.progress_data or {}
    stored_period_start = _coerce_iso_datetime(progress_data.get("period_start_at"))
    stored_period_end = _coerce_iso_datetime(progress_data.get("period_end_at"))
    stored_period_key = progress_data.get("period_key")

    if tracking_style != "total" and stored_period_start is not None:
        period_start = stored_period_start
        period_end = stored_period_end
    elif tracking_style == "daily":
        period_start = datetime.combine(now_utc.date(), datetime.min.time(), tzinfo=timezone.utc)
        period_end = period_start + timedelta(days=1)
    elif tracking_style == "weekly":
        period_start = datetime.combine(now_utc.date(), datetime.min.time(), tzinfo=timezone.utc)
        period_start = period_start - timedelta(days=period_start.weekday())
        period_end = period_start + timedelta(days=7)
    elif tracking_style == "monthly":
        period_start = datetime.combine(now_utc.date().replace(day=1), datetime.min.time(), tzinfo=timezone.utc)
        if period_start.month == 12:
            period_end = period_start.replace(year=period_start.year + 1, month=1)
        else:
            period_end = period_start.replace(month=period_start.month + 1)
    else:
        period_start = created_at
        period_end = None

    elapsed_days = max(1, (now_utc - period_start).total_seconds() / 86400) if period_end else max(
        1, (now_utc - created_at).total_seconds() / 86400
    )
    total_days = (
        max(1, (period_end - period_start).total_seconds() / 86400)
        if period_end is not None
        else None
    )
    return {
        "tracking_style": tracking_style,
        "period_start": period_start,
        "period_end": period_end,
        "elapsed_days": elapsed_days,
        "total_days": total_days,
        "created_at": created_at,
        "period_key": stored_period_key,
    }


def _goal_checkin_metrics(goal) -> dict[str, Any]:
    now_utc = datetime.now(timezone.utc)
    goal = goal
    progress_data = goal.progress_data or {}
    period = _goal_period_context(goal, now_utc)
    current_value = int(goal.current_value or 0)
    target_value = int(goal.target_value or 0)
    progress_pct = round(_safe_ratio(current_value, max(1, target_value)) * 100, 1)
    remaining = max(0, target_value - current_value)

    expected_progress_pct = (
        round(_safe_ratio(period["elapsed_days"], max(1, period["total_days"])) * 100, 1)
        if period["total_days"] is not None
        else None
    )
    expected_current = (
        round(target_value * _safe_ratio(period["elapsed_days"], max(1, period["total_days"])))
        if period["total_days"] is not None
        else None
    )
    gap_to_pace = (
        current_value - int(expected_current)
        if expected_current is not None
        else None
    )
    average_per_day = round(current_value / max(1.0, period["elapsed_days"]), 2)
    days_left = (
        max(0.0, (period["period_end"] - now_utc).total_seconds() / 86400)
        if period["period_end"] is not None
        else None
    )
    pace_needed_per_day = (
        round(remaining / max(1.0, days_left), 2)
        if days_left is not None and remaining > 0
        else 0.0
    )
    projected_final = (
        round(average_per_day * max(1.0, period["total_days"]))
        if period["total_days"] is not None
        else current_value
    )

    training_days = progress_data.get("training_days")
    completed_days = (
        sum(1 for day in training_days if day)
        if isinstance(training_days, list)
        else None
    )

    risk_level = "low"
    if progress_pct < 40 and expected_progress_pct is not None and progress_pct + 15 < expected_progress_pct:
        risk_level = "high"
    elif gap_to_pace is not None and gap_to_pace < 0:
        risk_level = "medium"

    return {
        "goal_id": str(goal.goal_id),
        "goal_type": goal.type,
        "goal_name": goal.name,
        "tracking_style": period["tracking_style"],
        "current_value": current_value,
        "target_value": target_value,
        "remaining": remaining,
        "progress_pct": progress_pct,
        "expected_progress_pct": expected_progress_pct,
        "expected_current": expected_current,
        "gap_to_pace": gap_to_pace,
        "average_per_day": average_per_day,
        "pace_needed_per_day": pace_needed_per_day,
        "projected_final": projected_final,
        "days_left": round(days_left, 1) if days_left is not None else None,
        "risk_level": risk_level,
        "created_at": period["created_at"].isoformat(),
        "period_start": period["period_start"].isoformat() if period["period_start"] else None,
        "period_end": period["period_end"].isoformat() if period["period_end"] else None,
        "training_days_completed": completed_days,
        "training_days_pattern": training_days if isinstance(training_days, list) else None,
    }


def _goal_checkin_input_hash(payload: dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _load_model_candidates() -> list[str]:
    primary = (
        settings.OPENROUTER_ANALYTICS_INSIGHTS_MODEL
        or settings.OPENROUTER_WEEKLY_SUMMARY_MODEL
        or DEFAULT_OPENROUTER_MODEL
    )
    raw_fallbacks = settings.OPENROUTER_ANALYTICS_INSIGHTS_FALLBACK_MODELS or settings.OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS
    candidates = [primary]
    for item in [part.strip() for part in raw_fallbacks.split(",") if part.strip()]:
        if item not in candidates:
            candidates.append(item)
    if DEFAULT_OPENROUTER_MODEL not in candidates:
        candidates.append(DEFAULT_OPENROUTER_MODEL)
    return candidates


def _extract_text_content(chat_response: dict) -> str:
    choices = chat_response.get("choices", [])
    if not choices:
        return ""
    message = choices[0].get("message", {})
    content = message.get("content", "")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "\n".join(parts).strip()
    return ""


def _extract_json_block(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3 and lines[-1].startswith("```"):
            return "\n".join(lines[1:-1]).strip()
    start = text.find("{")
    end = text.rfind("}")
    return text[start : end + 1] if start != -1 and end != -1 and end > start else text


def _parse_retry_after_seconds(response: requests.Response) -> float:
    retry_after = response.headers.get("Retry-After")
    try:
        return max(float(retry_after), 0.5) if retry_after else 1.5
    except ValueError:
        return 1.5


def _generate_goal_ai_checkin(payload: dict[str, Any]) -> tuple[_GoalAICheckinModelPayload, str | None]:
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENROUTER_API_KEY is not configured",
        )

    system_prompt = (
        "You are a grounded goal coach for a productivity app. "
        "Use only the provided computed goal data. "
        "Do not mention raw JSON keys or implementation details. "
        "Be concise, practical, and specific. "
        "Return valid JSON only."
    )
    user_prompt = (
        "Create a goal check-in from the provided metrics.\n"
        "Requirements:\n"
        "1. Summarize current status in plain language.\n"
        "2. Explain the pace needed.\n"
        "3. Set risk_level to low, medium, or high.\n"
        "4. Give one concrete next step.\n"
        "5. Give one adjustment suggestion if progress is off track.\n"
        "6. Include 2 or 3 evidence bullets using the numbers.\n\n"
        "Return JSON with exactly this shape:\n"
        "{\n"
        '  "status_summary": "string",\n'
        '  "pace_needed": "string",\n'
        '  "risk_level": "low|medium|high",\n'
        '  "next_step": "string",\n'
        '  "adjustment_suggestion": "string",\n'
        '  "evidence": ["string"]\n'
        "}\n\n"
        f"Data:\n{json.dumps(payload, sort_keys=True, ensure_ascii=True)}"
    )

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    response = None
    selected_model = None
    failures: list[str] = []
    for candidate in _load_model_candidates():
        selected_model = candidate
        for attempt in range(2):
            try:
                response = requests.post(
                    OPENROUTER_CHAT_COMPLETIONS_URL,
                    headers=headers,
                    json={
                        "model": candidate,
                        "temperature": 0.2,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    },
                    timeout=60,
                )
            except requests.RequestException as exc:
                failures.append(f"{candidate}: network error ({exc})")
                break
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS and attempt == 0:
                time_module.sleep(_parse_retry_after_seconds(response))
                continue
            if response.ok:
                break
            failures.append(f"{candidate}: {response.status_code} {response.text[:120]}")
            break
        if response is not None and response.ok:
            break

    if response is None or not response.ok:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Goal AI check-in request failed" if not failures else " | ".join(failures),
        )

    raw_text = _extract_text_content(response.json())
    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Goal AI check-in response did not contain text",
        )

    try:
        validated = _GoalAICheckinModelPayload.model_validate(
            json.loads(_extract_json_block(raw_text))
        )
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Goal AI check-in response was not valid JSON: {exc}",
        ) from exc

    return validated, selected_model[:100] if selected_model else None


def _goal_checkin_cache_to_response(cache_item, goal_id: UUID, cached: bool) -> GoalAICheckinResponse:
    content = cache_item.content_json or {}
    generated_at = cache_item.updated_at or cache_item.created_at or datetime.now(timezone.utc)
    return GoalAICheckinResponse(
        goal_id=str(goal_id),
        status_summary=str(content.get("status_summary") or ""),
        pace_needed=str(content.get("pace_needed") or ""),
        risk_level=str(content.get("risk_level") or "low"),
        next_step=str(content.get("next_step") or ""),
        adjustment_suggestion=str(content.get("adjustment_suggestion") or ""),
        evidence=[str(item) for item in content.get("evidence", [])],
        cached=cached,
        model=cache_item.model,
        generated_at=generated_at,
    )


def _generate_goals_board_ai_checkin(payload: dict[str, Any]) -> tuple[_GoalsBoardAICheckinPayload, str | None]:
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENROUTER_API_KEY is not configured",
        )

    system_prompt = (
        "You are summarizing the state of a user's goals board. "
        "Use only the provided computed data. "
        "Do not mention implementation details or raw field names. "
        "Keep it short, practical, and user-facing. "
        "Return valid JSON only."
    )
    user_prompt = (
        "Create a short board-level goals check-in.\n"
        "Requirements:\n"
        "1. Provide one headline.\n"
        "2. Provide a short summary covering the overall board state.\n"
        "3. Give up to 3 priorities.\n"
        "4. Give up to 2 wins.\n"
        "5. Give up to 2 risks.\n\n"
        "Return JSON with exactly this shape:\n"
        "{\n"
        '  "headline": "string",\n'
        '  "summary": "string",\n'
        '  "priorities": ["string"],\n'
        '  "wins": ["string"],\n'
        '  "risks": ["string"]\n'
        "}\n\n"
        f"Data:\n{json.dumps(payload, sort_keys=True, ensure_ascii=True)}"
    )

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    response = None
    selected_model = None
    failures: list[str] = []
    for candidate in _load_model_candidates():
        selected_model = candidate
        for attempt in range(2):
            try:
                response = requests.post(
                    OPENROUTER_CHAT_COMPLETIONS_URL,
                    headers=headers,
                    json={
                        "model": candidate,
                        "temperature": 0.2,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    },
                    timeout=60,
                )
            except requests.RequestException as exc:
                failures.append(f"{candidate}: network error ({exc})")
                break
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS and attempt == 0:
                time_module.sleep(_parse_retry_after_seconds(response))
                continue
            if response.ok:
                break
            failures.append(f"{candidate}: {response.status_code} {response.text[:120]}")
            break
        if response is not None and response.ok:
            break

    if response is None or not response.ok:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Goals board AI check-in request failed" if not failures else " | ".join(failures),
        )

    raw_text = _extract_text_content(response.json())
    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Goals board AI check-in response did not contain text",
        )

    try:
        validated = _GoalsBoardAICheckinPayload.model_validate(
            json.loads(_extract_json_block(raw_text))
        )
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Goals board AI check-in response was not valid JSON: {exc}",
        ) from exc

    return validated, selected_model[:100] if selected_model else None


def get_goals_board_ai_checkin(
    payload: GoalsBoardAICheckinRequest,
    current_user: UserEmail,
) -> GoalsBoardAICheckinResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        goals = list_goals_for_user(db, current_user.user_id)
        goals = [_sync_derived_goal_progress(db, goal, current_user.user_id) for goal in goals]

        metrics = [_goal_checkin_metrics(goal) for goal in goals]
        completed_count = sum(1 for item in metrics if item["remaining"] == 0)
        high_risk_count = sum(1 for item in metrics if item["risk_level"] == "high")
        medium_risk_count = sum(1 for item in metrics if item["risk_level"] == "medium")
        on_track_count = sum(1 for item in metrics if item["risk_level"] == "low" and item["remaining"] > 0)

        input_payload = {
            "totals": {
                "goal_count": len(metrics),
                "completed_count": completed_count,
                "on_track_count": on_track_count,
                "high_risk_count": high_risk_count,
                "medium_risk_count": medium_risk_count,
            },
            "goals": [
                {
                    "name": item["goal_name"],
                    "type": item["goal_type"],
                    "tracking_style": item["tracking_style"],
                    "progress_pct": item["progress_pct"],
                    "remaining": item["remaining"],
                    "risk_level": item["risk_level"],
                    "pace_needed_per_day": item["pace_needed_per_day"],
                    "projected_final": item["projected_final"],
                }
                for item in metrics
            ],
        }

        ai_result, model_name = _generate_goals_board_ai_checkin(input_payload)
        return GoalsBoardAICheckinResponse(
            headline=ai_result.headline,
            summary=ai_result.summary,
            priorities=ai_result.priorities,
            wins=ai_result.wins,
            risks=ai_result.risks,
            model=model_name,
            generated_at=datetime.now(timezone.utc),
        )


def get_goal_ai_checkin(
    goal_id: UUID,
    payload: GoalAICheckinRequest,
    current_user: UserEmail,
) -> GoalAICheckinResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        goal = get_goal_for_user(db, goal_id, current_user.user_id)
        if goal is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal was not found",
            )

        goal = _sync_derived_goal_progress(db, goal, current_user.user_id)
        metrics = _goal_checkin_metrics(goal)
        input_payload = {
            "goal_name": goal.name,
            "goal_type": goal.type,
            "tracking_style": goal.tracking_style,
            "metrics": metrics,
        }
        input_hash = _goal_checkin_input_hash(input_payload)

        if not payload.refresh:
            cached_item = get_cached_goal_ai_checkin(
                db,
                goal_id=goal.goal_id,
                input_hash=input_hash,
            )
            if cached_item is not None:
                return _goal_checkin_cache_to_response(cached_item, goal.goal_id, True)

        ai_result, model_name = _generate_goal_ai_checkin(input_payload)
        cache_item = upsert_cached_goal_ai_checkin(
            db,
            goal_id=goal.goal_id,
            input_hash=input_hash,
            content_json=ai_result.model_dump(),
            model=model_name,
        )
        try:
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store goal AI check-in",
            ) from exc

        db.refresh(cache_item)
        return _goal_checkin_cache_to_response(cache_item, goal.goal_id, False)
