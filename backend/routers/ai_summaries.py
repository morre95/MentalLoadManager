import hashlib
import json
import os
import time as time_module
import logging
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import aliased

from helpers import get_current_user, get_session_local
from models import AISummaries, Tasks, UserDB, UserEmail, UsersHouseholds

DEFAULT_OPENROUTER_MODEL = "openrouter/free"
OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_FALLBACK_MODELS = ["openrouter/free"]

router = APIRouter(
    prefix="/api/ai",
    tags=["ai"],
)
logger = logging.getLogger(__name__)


class GenerateWeeklySummaryRequest(BaseModel):
    household_id: UUID
    week_start: date | None = None


class GenerateWeeklySummaryResponse(BaseModel):
    ai_summary_id: str
    household_id: str
    week_start: date
    model: str
    content: str
    prompt_hash: str


def _normalize_week_start(value: date | None) -> date:
    if value is not None:
        return value
    today = datetime.now(UTC).date()
    return today - timedelta(days=today.weekday())


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
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts).strip()

    return ""


def _to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _parse_retry_after_seconds(response: requests.Response) -> float:
    retry_after = response.headers.get("Retry-After")
    if not retry_after:
        return 1.5
    try:
        return max(float(retry_after), 0.5)
    except ValueError:
        return 1.5


def _load_model_candidates(primary_model: str) -> list[str]:
    fallback_raw = os.getenv("OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS", "")
    fallbacks = [item.strip() for item in fallback_raw.split(",") if item.strip()]
    if not fallbacks:
        fallbacks = DEFAULT_FALLBACK_MODELS

    candidates: list[str] = []
    for model in [primary_model, *fallbacks]:
        if model not in candidates:
            candidates.append(model)
    if "openrouter/free" not in candidates:
        candidates.append("openrouter/free")
    return candidates


@router.post("/weekly-summary", response_model=GenerateWeeklySummaryResponse)
def generate_weekly_summary(
    payload: GenerateWeeklySummaryRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENROUTER_API_KEY is not configured",
        )

    model_name = os.getenv("OPENROUTER_WEEKLY_SUMMARY_MODEL", DEFAULT_OPENROUTER_MODEL)
    model_candidates = _load_model_candidates(model_name)
    week_start = _normalize_week_start(payload.week_start)
    week_end = week_start + timedelta(days=7)
    week_start_dt = datetime.combine(week_start, time.min, tzinfo=UTC)
    week_end_dt = datetime.combine(week_end, time.min, tzinfo=UTC)

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        user = db.scalar(select(UserDB).where(UserDB.username == current_user.username))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )

        membership = db.scalar(
            select(UsersHouseholds).where(
                and_(
                    UsersHouseholds.user_id == user.user_id,
                    UsersHouseholds.household_id == payload.household_id,
                )
            )
        )
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the specified household",
            )

        creator_user = aliased(UserDB)
        assignee_user = aliased(UserDB)
        weekly_tasks = db.execute(
            select(
                Tasks.task_id,
                Tasks.name,
                Tasks.status,
                Tasks.priority,
                Tasks.created_at,
                Tasks.started_at,
                Tasks.complete_date,
                Tasks.due_date,
                Tasks.created_by,
                Tasks.assigns_to,
                creator_user.username.label("created_by_username"),
                assignee_user.username.label("assignee_username"),
            ).where(
                and_(
                    Tasks.household_id == payload.household_id,
                    or_(
                        and_(
                            Tasks.created_at >= week_start_dt,
                            Tasks.created_at < week_end_dt,
                        ),
                        and_(
                            Tasks.started_at >= week_start_dt,
                            Tasks.started_at < week_end_dt,
                        ),
                        and_(
                            Tasks.complete_date >= week_start_dt,
                            Tasks.complete_date < week_end_dt,
                        ),
                        and_(
                            Tasks.due_date >= week_start_dt,
                            Tasks.due_date < week_end_dt,
                        ),
                    ),
                )
            ).outerjoin(creator_user, Tasks.created_by == creator_user.user_id)
            .outerjoin(assignee_user, Tasks.assigns_to == assignee_user.user_id)
        ).all()

        household_assignee_user = aliased(UserDB)
        household_tasks = db.execute(
            select(
                Tasks.status,
                Tasks.priority,
                Tasks.assigns_to,
                household_assignee_user.username.label("assignee_username"),
            )
            .outerjoin(
                household_assignee_user,
                Tasks.assigns_to == household_assignee_user.user_id,
            )
            .where(Tasks.household_id == payload.household_id)
        ).all()

    status_counts: dict[str, int] = {}
    for row in household_tasks:
        status_counts[row.status] = status_counts.get(row.status, 0) + 1

    weekly_created = 0
    weekly_started = 0
    weekly_completed = 0
    weekly_due = 0
    priority_counts: dict[str, int] = {}
    completed_by_user_counts: dict[str, int] = {}
    household_assignee_counts: dict[str, int] = {}
    assigned_by_user_counts: dict[str, int] = {}
    assigned_to_user_counts: dict[str, int] = {}
    serialized_tasks: list[dict[str, str | None]] = []

    for row in weekly_tasks:
        priority_value = row.priority or "unspecified"
        priority_counts[priority_value] = priority_counts.get(priority_value, 0) + 1

        if row.created_at and week_start_dt <= row.created_at < week_end_dt:
            weekly_created += 1
        if row.started_at and week_start_dt <= row.started_at < week_end_dt:
            weekly_started += 1
        if row.complete_date and week_start_dt <= row.complete_date < week_end_dt:
            weekly_completed += 1
            completed_by_label = row.assignee_username or "unassigned"
            completed_by_user_counts[completed_by_label] = (
                completed_by_user_counts.get(completed_by_label, 0) + 1
            )
        if row.due_date and week_start_dt <= row.due_date < week_end_dt:
            weekly_due += 1

        if row.created_at and week_start_dt <= row.created_at < week_end_dt:
            creator_label = row.created_by_username or "unknown_creator"
            assigned_by_user_counts[creator_label] = (
                assigned_by_user_counts.get(creator_label, 0) + 1
            )
            assignee_label = row.assignee_username or "unassigned"
            assigned_to_user_counts[assignee_label] = (
                assigned_to_user_counts.get(assignee_label, 0) + 1
            )

        serialized_tasks.append(
            {
                "task_id": str(row.task_id),
                "name": row.name,
                "status": row.status,
                "priority": row.priority,
                "assigned_by_user_id": str(row.created_by) if row.created_by else None,
                "assigned_by_user": row.created_by_username or "unknown_creator",
                "assigned_to_user_id": str(row.assigns_to) if row.assigns_to else None,
                "assigned_to_user": row.assignee_username or "unassigned",
                "created_at": _to_iso(row.created_at),
                "started_at": _to_iso(row.started_at),
                "complete_date": _to_iso(row.complete_date),
                "due_date": _to_iso(row.due_date),
            }
        )

    for row in household_tasks:
        assignee_label = row.assignee_username or "unassigned"
        household_assignee_counts[assignee_label] = (
            household_assignee_counts.get(assignee_label, 0) + 1
        )

    total_household_tasks = len(household_tasks)
    household_task_percentage_by_assignee = {
        assignee: round((count / total_household_tasks) * 100, 1)
        for assignee, count in household_assignee_counts.items()
    } if total_household_tasks else {}

    prompt_payload = {
        "week_start": week_start.isoformat(),
        "week_end_exclusive": week_end.isoformat(),
        "stats": {
            "total_tasks_in_household": len(household_tasks),
            "tasks_touched_this_week": len(weekly_tasks),
            "weekly_created": weekly_created,
            "weekly_started": weekly_started,
            "weekly_completed": weekly_completed,
            "weekly_due": weekly_due,
            "status_counts_household": status_counts,
            "priority_counts_touched_this_week": priority_counts,
            "tasks_assigned_this_week_by_user": assigned_by_user_counts,
            "tasks_assigned_this_week_to_user": assigned_to_user_counts,
            "completed_this_week_by_user": completed_by_user_counts,
            "household_task_count_by_assignee": household_assignee_counts,
            "household_task_percentage_by_assignee": household_task_percentage_by_assignee,
        },
        "tasks_touched_this_week": serialized_tasks[:40],
    }
    prompt_json = json.dumps(prompt_payload, ensure_ascii=True, sort_keys=True)
    prompt_hash = hashlib.sha256(prompt_json.encode("utf-8")).hexdigest()

    system_prompt = (
        "You are an objective assistant for household task management. "
        "Write a neutral weekly summary. Keep a factual tone. "
        "Do not blame or praise individuals. Do not invent data."
    )
    user_prompt = (
        "Create a concise weekly situation summary for the household based on this JSON data.\n"
        "Requirements:\n"
        "1) Neutral and factual tone.\n"
        "2) Mention key trends in created/started/completed/due tasks.\n"
        "3) Mention backlog/status distribution.\n"
        "4) Mention notable priorities if visible.\n"
        "5) Include who assigned tasks to whom (based on assigned_by_user and assigned_to_user).\n"
        "6) Include which users completed tasks this week.\n"
        "7) Include task percentage distribution by assignee when available.\n"
        "8) Maximum 180 words.\n"
        "9) If there is little/no activity, say so clearly and neutrally.\n\n"
        f"Data:\n{prompt_json}"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    base_body = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }

    ai_response: requests.Response | None = None
    selected_model = model_name
    request_failures: list[str] = []

    for candidate_model in model_candidates:
        selected_model = candidate_model
        for attempt in range(2):
            body = {"model": candidate_model, **base_body}
            try:
                ai_response = requests.post(
                    OPENROUTER_CHAT_COMPLETIONS_URL,
                    headers=headers,
                    json=body,
                    timeout=60,
                )
            except requests.RequestException as exc:
                request_failures.append(f"{candidate_model}: network error ({exc})")
                break

            if ai_response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                request_failures.append(
                    f"{candidate_model}: rate limited (attempt {attempt + 1}/2)"
                )
                if attempt == 0:
                    time_module.sleep(_parse_retry_after_seconds(ai_response))
                    continue
                break

            if ai_response.ok:
                break

            request_failures.append(
                f"{candidate_model}: {ai_response.status_code} {ai_response.text[:120]}"
            )
            break

        if ai_response is not None and ai_response.ok:
            break

    if ai_response is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouter request failed before receiving a response",
        )

    if not ai_response.ok:
        if ai_response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "OpenRouter rate limit reached for configured free models. "
                    f"Tried models: {', '.join(model_candidates)}. "
                    "Set OPENROUTER_WEEKLY_SUMMARY_MODEL to a less busy model, "
                    "or configure OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"OpenRouter request failed with status {ai_response.status_code}. "
                f"Attempts: {' | '.join(request_failures)}"
            ),
        )

    response_json = ai_response.json()
    summary_text = _extract_text_content(response_json)
    if not summary_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouter response did not contain summary text",
        )

    with session_local() as db:
        model_for_db = selected_model[:100] if selected_model else None
        ai_summary = AISummaries(
            household_id=payload.household_id,
            week_start=week_start,
            content=summary_text,
            model=model_for_db,
            prompt_hash=prompt_hash,
        )
        db.add(ai_summary)
        try:
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            logger.exception("Failed to store AI summary: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to store AI summary: {exc}",
            ) from exc
        db.refresh(ai_summary)

    return GenerateWeeklySummaryResponse(
        ai_summary_id=str(ai_summary.ai_summary_id),
        household_id=str(ai_summary.household_id),
        week_start=ai_summary.week_start or week_start,
        model=ai_summary.model or selected_model,
        content=ai_summary.content,
        prompt_hash=ai_summary.prompt_hash or prompt_hash,
    )
