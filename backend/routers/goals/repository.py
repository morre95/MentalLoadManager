from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from models import AchievementUnlock, Categories, GoalAICheckinsCache, GoalHistory, Goals, Tasks, UsersHouseholds


def list_goals_for_user(db: Session, user_id: UUID) -> list[Goals]:
    return db.scalars(
        select(Goals)
        .where(Goals.user_id == user_id)
        .order_by(Goals.created_at.desc(), Goals.goal_id.desc())
    ).all()


def get_goal_for_user(db: Session, goal_id: UUID, user_id: UUID) -> Goals | None:
    return db.scalar(
        select(Goals).where(
            Goals.goal_id == goal_id,
            Goals.user_id == user_id,
        )
    )


def create_goal(
    db: Session,
    *,
    user_id: UUID,
    type: str,
    name: str,
    current_value: int,
    target_value: int,
    tracking_style: str,
    progress_data: dict | None = None,
) -> Goals:
    goal = Goals(
        user_id=user_id,
        type=type,
        name=name,
        current_value=current_value,
        target_value=target_value,
        tracking_style=tracking_style,
        progress_data=progress_data or {},
    )
    db.add(goal)
    return goal


def upsert_goal_history(
    db: Session,
    *,
    goal_id: UUID,
    user_id: UUID,
    tracking_style: str,
    period_key: str,
    period_started_at: datetime | None,
    period_ended_at: datetime | None,
    current_value: int,
    target_value: int,
    completed: bool,
    snapshot_data: dict | None = None,
) -> GoalHistory:
    history = db.scalar(
        select(GoalHistory).where(
            GoalHistory.goal_id == goal_id,
            GoalHistory.period_key == period_key,
        )
    )
    if history is None:
        history = GoalHistory(
            goal_id=goal_id,
            user_id=user_id,
            tracking_style=tracking_style,
            period_key=period_key,
        )
        db.add(history)

    history.period_started_at = period_started_at
    history.period_ended_at = period_ended_at
    history.current_value = current_value
    history.target_value = target_value
    history.completed = completed
    history.snapshot_data = snapshot_data or {}
    return history


def list_goal_history_for_user(
    db: Session,
    user_id: UUID,
    *,
    limit_per_goal: int = 4,
) -> list[GoalHistory]:
    rows = db.scalars(
        select(GoalHistory)
        .where(GoalHistory.user_id == user_id)
        .order_by(GoalHistory.created_at.desc(), GoalHistory.goal_history_id.desc())
    ).all()

    counts_by_goal: dict[UUID, int] = {}
    limited_rows: list[GoalHistory] = []
    for row in rows:
        count = counts_by_goal.get(row.goal_id, 0)
        if count >= limit_per_goal:
            continue
        counts_by_goal[row.goal_id] = count + 1
        limited_rows.append(row)

    return limited_rows


def list_goal_history_rows_for_user(db: Session, user_id: UUID) -> list[GoalHistory]:
    return db.scalars(
        select(GoalHistory)
        .where(GoalHistory.user_id == user_id)
        .order_by(GoalHistory.created_at.desc(), GoalHistory.goal_history_id.desc())
    ).all()


def get_achievement_unlock_by_completion_key(
    db: Session,
    *,
    user_id: UUID,
    completion_key: str,
) -> AchievementUnlock | None:
    return db.scalar(
        select(AchievementUnlock).where(
            AchievementUnlock.user_id == user_id,
            AchievementUnlock.completion_key == completion_key,
        )
    )


def create_achievement_unlock(
    db: Session,
    *,
    user_id: UUID,
    achievement_id: str,
    title: str,
    category: str,
    rarity: str,
    completion_key: str,
    entity_id: str | None = None,
) -> AchievementUnlock:
    unlock = AchievementUnlock(
        user_id=user_id,
        achievement_id=achievement_id,
        title=title,
        category=category,
        rarity=rarity,
        completion_key=completion_key,
        entity_id=entity_id,
    )
    db.add(unlock)
    return unlock


def list_achievement_unlocks_for_user(
    db: Session,
    user_id: UUID,
    *,
    limit: int = 20,
) -> list[AchievementUnlock]:
    return db.scalars(
        select(AchievementUnlock)
        .where(AchievementUnlock.user_id == user_id)
        .order_by(AchievementUnlock.unlocked_at.desc(), AchievementUnlock.achievement_unlock_id.desc())
        .limit(limit)
    ).all()


def list_personal_tasks_for_achievements(db: Session, user_id: UUID):
    return db.execute(
        select(
            Tasks.task_id,
            Tasks.household_id,
            Tasks.status,
            Tasks.due_date,
            Tasks.complete_date,
            Tasks.assigns_to,
            Tasks.created_by,
            Categories.name.label("category_name"),
        )
        .join(
            UsersHouseholds,
            and_(
                UsersHouseholds.household_id == Tasks.household_id,
                UsersHouseholds.user_id == user_id,
            ),
        )
        .outerjoin(Categories, Categories.category_id == Tasks.category_id)
        .where(
            or_(
                Tasks.assigns_to == user_id,
                and_(Tasks.assigns_to.is_(None), Tasks.created_by == user_id),
            )
        )
    ).all()


def list_household_completed_tasks_for_achievements(db: Session, user_id: UUID):
    return db.execute(
        select(
            Tasks.household_id,
            Tasks.assigns_to,
            Tasks.complete_date,
            Tasks.status,
        )
        .join(
            UsersHouseholds,
            and_(
                UsersHouseholds.household_id == Tasks.household_id,
                UsersHouseholds.user_id == user_id,
            ),
        )
        .where(
            Tasks.assigns_to.is_not(None),
            Tasks.complete_date.is_not(None),
            Tasks.status.in_(("done", "archive")),
        )
    ).all()


def list_available_category_names_for_user_households(db: Session, user_id: UUID):
    return db.execute(
        select(Categories.name)
        .join(
            UsersHouseholds,
            and_(
                UsersHouseholds.household_id == Categories.household_id,
                UsersHouseholds.user_id == user_id,
            ),
        )
    ).all()


def count_completed_personal_tasks_in_window(
    db: Session,
    user_id: UUID,
    *,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
) -> int:
    conditions = [
        Tasks.assigns_to == user_id,
        Tasks.complete_date.is_not(None),
        Tasks.status == "done",
    ]

    if start_at is not None:
        conditions.append(Tasks.complete_date >= start_at)

    if end_at is not None:
        conditions.append(Tasks.complete_date < end_at)

    return (
        db.scalar(
            select(func.count(Tasks.task_id))
            .join(
                UsersHouseholds,
                and_(
                    UsersHouseholds.household_id == Tasks.household_id,
                    UsersHouseholds.user_id == user_id,
                ),
            )
            .where(*conditions)
        )
        or 0
    )


def get_cached_goal_ai_checkin(
    db: Session,
    *,
    goal_id: UUID,
    input_hash: str,
) -> GoalAICheckinsCache | None:
    return db.scalar(
        select(GoalAICheckinsCache).where(
            GoalAICheckinsCache.goal_id == goal_id,
            GoalAICheckinsCache.input_hash == input_hash,
        )
    )


def upsert_cached_goal_ai_checkin(
    db: Session,
    *,
    goal_id: UUID,
    input_hash: str,
    content_json: dict,
    model: str | None,
) -> GoalAICheckinsCache:
    cache_item = get_cached_goal_ai_checkin(
        db,
        goal_id=goal_id,
        input_hash=input_hash,
    )
    if cache_item is None:
        cache_item = GoalAICheckinsCache(
            goal_id=goal_id,
            input_hash=input_hash,
        )
        db.add(cache_item)

    cache_item.content_json = content_json
    cache_item.model = model
    cache_item.updated_at = datetime.now(timezone.utc)
    return cache_item
