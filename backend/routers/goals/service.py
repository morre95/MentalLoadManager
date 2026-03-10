from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from helpers import get_session_local
from models import UserEmail

from .repository import (
    create_goal,
    get_goal_for_user,
    list_available_category_names_for_user_households,
    list_goals_for_user,
    list_household_completed_tasks_for_achievements,
    list_personal_tasks_for_achievements,
)
from .schemas import (
    AchievementResponse,
    AchievementsResponse,
    CreateGoalRequest,
    DeleteGoalResponse,
    GoalResponse,
    GoalsResponse,
    UpdateGoalProgressRequest,
)

ALLOWED_TRACKING_STYLES = {"daily", "weekly", "total"}
COMPLETED_STATUSES = {"done", "archive"}
PERIOD_MILESTONES_DAYS = [7, 30, 60, 90, 180, 365]


def _to_goal_response(goal) -> GoalResponse:
    return GoalResponse(
        goal_id=str(goal.goal_id),
        type=goal.type,
        name=goal.name,
        current_value=goal.current_value,
        target_value=goal.target_value,
        tracking_style=goal.tracking_style,
        progress_data=goal.progress_data or {},
        created_at=goal.created_at,
    )


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
        )

    return AchievementResponse(
        id="a2",
        title="Equal Split",
        description=f"Balanced for {achieved_days} days. Next milestone: {_next_milestone(achieved_days, PERIOD_MILESTONES_DAYS)} days.",
        icon="scale",
        current=achieved_days,
        target=_next_milestone(achieved_days, PERIOD_MILESTONES_DAYS),
        category="Balance",
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
        )

    return AchievementResponse(
        id="a3",
        title="Perfect Week",
        description=f"Perfect completion for {achieved_days} days. Next milestone: {_next_milestone(achieved_days, PERIOD_MILESTONES_DAYS)} days.",
        icon="flame",
        current=achieved_days,
        target=_next_milestone(achieved_days, PERIOD_MILESTONES_DAYS),
        category="Consistency",
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
        )

    return AchievementResponse(
        id="a5",
        title="Early Bird",
        description=f"Early completion for {achieved_days} days. Next milestone: {_next_milestone(achieved_days, PERIOD_MILESTONES_DAYS)} days.",
        icon="check",
        current=achieved_days,
        target=_next_milestone(achieved_days, PERIOD_MILESTONES_DAYS),
        category="Consistency",
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

    achievements = [
        AchievementResponse(
            id="a1",
            title="Category Champion",
            description=f"Your top category is {best_category_name}",
            icon="trophy",
            current=best_category_count,
            target=_next_milestone(best_category_count, [5, 15, 30, 60, 120, 250]),
            category="Tasks",
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
        ),
    ]

    return AchievementsResponse(achievements=achievements)


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
        return GoalsResponse(goals=[_to_goal_response(goal) for goal in goals])


def create_my_goal(payload: CreateGoalRequest, current_user: UserEmail) -> GoalResponse:
    tracking_style = payload.tracking_style.strip().lower()
    if tracking_style not in ALLOWED_TRACKING_STYLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tracking_style must be one of: daily, weekly, total",
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

        current_value, progress_data = _normalize_progress_data(
            goal.type,
            payload.progress_data if payload.progress_data is not None else goal.progress_data,
            payload.current_value,
        )
        goal.current_value = current_value
        goal.progress_data = progress_data
        goal.updated_at = datetime.now(timezone.utc)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update goal progress",
            ) from exc

        db.refresh(goal)
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
