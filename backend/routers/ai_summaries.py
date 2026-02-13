import hashlib
import json
import os
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import SQLAlchemyError

from helpers import get_current_user, get_session_local
from models import AISummaries, Tasks, UserDB, UserEmail, UsersHouseholds

DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free"
OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"

router = APIRouter(
    prefix="/api/ai",
    tags=["ai"],
)


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
                    # UsersHouseholds.user_id == user.user_id,
                    UsersHouseholds.user_id == "a1b2c3d4-1111-1111-1111-111111111111",
                    # UsersHouseholds.household_id == payload.household_id,
                    UsersHouseholds.household_id
                    == "b1b2b3b4-1111-1111-1111-111111111111",
                )
            )
        )
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the specified household",
            )

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
            )
        ).all()

        household_tasks = db.execute(
            select(Tasks.status, Tasks.priority).where(
                Tasks.household_id == payload.household_id
            )
        ).all()

    status_counts: dict[str, int] = {}
    for row in household_tasks:
        status_counts[row.status] = status_counts.get(row.status, 0) + 1

    weekly_created = 0
    weekly_started = 0
    weekly_completed = 0
    weekly_due = 0
    priority_counts: dict[str, int] = {}
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
        if row.due_date and week_start_dt <= row.due_date < week_end_dt:
            weekly_due += 1

        serialized_tasks.append(
            {
                "task_id": str(row.task_id),
                "name": row.name,
                "status": row.status,
                "priority": row.priority,
                "created_at": _to_iso(row.created_at),
                "started_at": _to_iso(row.started_at),
                "complete_date": _to_iso(row.complete_date),
                "due_date": _to_iso(row.due_date),
            }
        )

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
        "5) Maximum 180 words.\n"
        "6) If there is little/no activity, say so clearly and neutrally.\n\n"
        f"Data:\n{prompt_json}"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }

    try:
        ai_response = requests.post(
            OPENROUTER_CHAT_COMPLETIONS_URL,
            headers=headers,
            json=body,
            timeout=60,
        )
        ai_response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenRouter request failed: {exc}",
        ) from exc

    response_json = ai_response.json()
    summary_text = _extract_text_content(response_json)
    if not summary_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouter response did not contain summary text",
        )

    with session_local() as db:
        ai_summary = AISummaries(
            household_id=payload.household_id,
            week_start=week_start,
            content=summary_text,
            model=model_name,
            prompt_hash=prompt_hash,
        )
        db.add(ai_summary)
        try:
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store AI summary",
            ) from exc
        db.refresh(ai_summary)

    return GenerateWeeklySummaryResponse(
        ai_summary_id=str(ai_summary.ai_summary_id),
        household_id=str(ai_summary.household_id),
        week_start=ai_summary.week_start or week_start,
        model=ai_summary.model or model_name,
        content=ai_summary.content,
        prompt_hash=ai_summary.prompt_hash or prompt_hash,
    )
