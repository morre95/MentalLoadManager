import hashlib
import json
import logging
import secrets
import time as time_module
from datetime import UTC, date, datetime, time, timedelta
from html import escape
from importlib import import_module
from typing import Any, Literal, cast
from uuid import UUID

import requests
from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from app.v1.config import settings
from app.v1.email_queue import (
    EMAIL_JOB_MAX_ATTEMPTS,
    EMAIL_JOB_STATUS_PENDING,
    EMAIL_JOB_TYPE_WEEKLY_SUMMARY_HOUSEHOLD,
    build_weekly_summary_household_idempotency_key,
    enqueue_email_jobs,
)
from app.v1.helpers import get_session_local
from app.v1.models import UserEmail

from .repository import (
    create_ai_summary,
    delete_ai_summary,
    fetch_household_tasks,
    fetch_weekly_tasks,
    get_ai_summary,
    get_user_by_username,
    has_household_membership,
    list_ai_summaries_for_user,
    list_weekly_summary_email_targets,
)
from .schemas import (
    GenerateWeeklySummaryRequest,
    SavedSummariesListResponse,
    SummaryDeleteResponse,
    SavedSummaryItemResponse,
    WeeklySummaryEmailDispatchResponse,
    WeeklySummaryResponse,
)

DEFAULT_OPENROUTER_MODEL = "openrouter/free"
OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_FALLBACK_MODELS = ["openrouter/free"]
FRONTEND_SUMMARIES_URL = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/summarys"
WEEKDAY_NAMES = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]

logger = logging.getLogger(__name__)
SummaryStatus = Literal["pending", "completed", "failed"]


def _normalize_week_start(value: date | None) -> date:
    if value is not None:
        return value
    today = datetime.now(UTC).date()
    return today - timedelta(days=today.weekday())


def _week_end_exclusive(week_start: date) -> date:
    return week_start + timedelta(days=7)


def _display_week_end(week_end_exclusive: date) -> date:
    return week_end_exclusive - timedelta(days=1)


def _to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


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


def _parse_retry_after_seconds(response: requests.Response) -> float:
    retry_after = response.headers.get("Retry-After")
    if not retry_after:
        return 1.5
    try:
        return max(float(retry_after), 0.5)
    except ValueError:
        return 1.5


def _load_model_candidates(primary_model: str) -> list[str]:
    candidates: list[str] = []
    for model in [primary_model, *DEFAULT_FALLBACK_MODELS]:
        if model not in candidates:
            candidates.append(model)
    if "openrouter/free" not in candidates:
        candidates.append("openrouter/free")
    return candidates


def _get_session_factory():
    try:
        return get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


def _validate_membership(db, *, username: str, household_id: UUID):
    user = get_user_by_username(db, username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    if not has_household_membership(db, user.user_id, household_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of the specified household",
        )

    return user


def _coerce_status(status_value: str | None) -> SummaryStatus:
    if status_value in {"pending", "completed", "failed"}:
        return cast(SummaryStatus, status_value)
    return "pending"


def _resolve_week_end(ai_summary) -> date:
    if ai_summary.week_end is not None:
        return ai_summary.week_end
    if ai_summary.week_start is not None:
        return _week_end_exclusive(ai_summary.week_start)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="AI summary is missing week range information",
    )


def _to_weekly_summary_response(ai_summary) -> WeeklySummaryResponse:
    return WeeklySummaryResponse(
        ai_summary_id=str(ai_summary.ai_summary_id),
        household_id=str(ai_summary.household_id),
        week_start=ai_summary.week_start,
        week_end=_resolve_week_end(ai_summary),
        status=_coerce_status(ai_summary.status),
        model=ai_summary.model or "",
        content=ai_summary.content or None,
        prompt_hash=ai_summary.prompt_hash,
        error=ai_summary.error,
    )


def _to_saved_summary_item(ai_summary) -> SavedSummaryItemResponse:
    created_at = ai_summary.created_at.date() if ai_summary.created_at else None
    return SavedSummaryItemResponse(
        ai_summary_id=str(ai_summary.ai_summary_id),
        household_id=str(ai_summary.household_id),
        household_name=(
            ai_summary.household.name
            if getattr(ai_summary, "household", None) and ai_summary.household.name
            else "Unnamed household"
        ),
        week_start=ai_summary.week_start,
        week_end=_resolve_week_end(ai_summary),
        granted_at=created_at,
        status=_coerce_status(ai_summary.status),
        model=ai_summary.model or "",
        content=ai_summary.content or None,
        error=ai_summary.error,
    )


def _validate_cron_secret(provided_secret: str | None) -> None:
    configured_secret = settings.WEEKLY_SUMMARY_CRON_SECRET.strip()

    if not configured_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Weekly summary cron secret is not configured",
        )

    if not provided_secret or not secrets.compare_digest(
        configured_secret, provided_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )


def _build_weekly_summary_email_html(
    *,
    recipient_name: str,
    household_name: str,
    week_start: date,
    week_end: date,
    summary_text: str,
) -> str:
    escaped_recipient_name = escape(recipient_name)
    escaped_household_name = escape(household_name)
    escaped_summary_text = escape(summary_text).replace("\n", "<br />")
    escaped_summary_url = escape(FRONTEND_SUMMARIES_URL)

    return (
        f"<h2>Your weekly AI summary for {escaped_household_name}</h2>"
        f"<p>Hi {escaped_recipient_name},</p>"
        "<p>Here is your household summary for the previous week.</p>"
        f"<p><strong>Period:</strong> {week_start.isoformat()} to {week_end.isoformat()}</p>"
        f"<p>{escaped_summary_text}</p>"
        f'<p><a href="{escaped_summary_url}">Open Mental Load summaries</a></p>'
    )


def send_weekly_summary_email(
    *,
    recipient_email: str,
    recipient_name: str,
    household_name: str,
    week_start: date,
    week_end_exclusive: date,
    summary_text: str,
) -> None:
    resend = cast(Any, import_module("resend"))

    api_key = settings.RESEND_API_KEY.strip()
    mail_from = settings.MAIL_FROM.strip()

    if not api_key or not mail_from:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Weekly summary email is not configured",
        )

    resend.api_key = api_key

    display_week_end = _display_week_end(week_end_exclusive)
    params: dict[str, Any] = {
        "from": f"{settings.MAIL_FROM_NAME} <{mail_from}>",
        "to": [recipient_email],
        "subject": (
            f"Weekly AI Summary: {household_name} "
            f"({week_start.isoformat()} to {display_week_end.isoformat()})"
        ),
        "html": _build_weekly_summary_email_html(
            recipient_name=recipient_name,
            household_name=household_name,
            week_start=week_start,
            week_end=display_week_end,
            summary_text=summary_text,
        ),
    }

    resend.Emails.send(params)


def _generate_summary_payload(
    payload: GenerateWeeklySummaryRequest,
    *,
    username: str,
) -> dict:
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENROUTER_API_KEY is not configured",
        )

    week_start = _normalize_week_start(payload.week_start)
    week_end = _week_end_exclusive(week_start)
    week_start_dt = datetime.combine(week_start, time.min, tzinfo=UTC)
    week_end_dt = datetime.combine(week_end, time.min, tzinfo=UTC)

    session_local = _get_session_factory()
    with session_local() as db:
        _validate_membership(
            db,
            username=username,
            household_id=payload.household_id,
        )
        weekly_tasks = fetch_weekly_tasks(
            db,
            payload.household_id,
            week_start_dt,
            week_end_dt,
        )
        household_tasks = fetch_household_tasks(db, payload.household_id)

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
            creator_label = row.created_by_username or "unknown_creator"
            assigned_by_user_counts[creator_label] = (
                assigned_by_user_counts.get(creator_label, 0) + 1
            )
            assignee_label = row.assignee_username or "unassigned"
            assigned_to_user_counts[assignee_label] = (
                assigned_to_user_counts.get(assignee_label, 0) + 1
            )

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
    household_task_percentage_by_assignee = (
        {
            assignee: round((count / total_household_tasks) * 100, 1)
            for assignee, count in household_assignee_counts.items()
        }
        if total_household_tasks
        else {}
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

    requested_model = str(payload.model or "").strip()
    model_name = (
        requested_model
        or settings.OPENROUTER_WEEKLY_SUMMARY_MODEL
        or DEFAULT_OPENROUTER_MODEL
    )
    model_candidates = _load_model_candidates(model_name)
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

    summary_text = _extract_text_content(ai_response.json())
    if not summary_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouter response did not contain summary text",
        )

    return {
        "week_start": week_start,
        "week_end": week_end,
        "summary_text": summary_text,
        "model": selected_model[:100] if selected_model else None,
        "prompt_hash": prompt_hash,
    }


def _run_weekly_summary_generation_task(
    *,
    ai_summary_id: UUID,
    household_id: UUID,
    week_start: date,
    model: str | None,
    username: str,
) -> None:
    session_local = _get_session_factory()

    try:
        result = _generate_summary_payload(
            GenerateWeeklySummaryRequest(
                household_id=household_id,
                week_start=week_start,
                model=model,
            ),
            username=username,
        )
    except Exception as exc:
        logger.exception(
            "Weekly summary generation failed for ai_summary %s", ai_summary_id
        )
        with session_local() as db:
            ai_summary = get_ai_summary(db, ai_summary_id)
            if not ai_summary:
                return
            ai_summary.status = "failed"
            ai_summary.error = str(exc)
            try:
                db.commit()
            except SQLAlchemyError:
                db.rollback()
                logger.exception(
                    "Failed to persist ai_summary failure state for %s", ai_summary_id
                )
        return

    with session_local() as db:
        ai_summary = get_ai_summary(db, ai_summary_id)
        if not ai_summary:
            logger.warning("ai_summary %s not found during completion", ai_summary_id)
            return

        ai_summary.week_end = result["week_end"]
        ai_summary.content = result["summary_text"]
        ai_summary.model = result["model"]
        ai_summary.prompt_hash = result["prompt_hash"]
        ai_summary.status = "completed"
        ai_summary.error = None
        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            logger.exception("Failed to store ai_summary result for %s", ai_summary_id)


def queue_weekly_summary_generation(
    payload: GenerateWeeklySummaryRequest,
    current_user: UserEmail,
    background_tasks,
) -> WeeklySummaryResponse:
    week_start = _normalize_week_start(payload.week_start)
    week_end = _week_end_exclusive(week_start)
    requested_model = str(payload.model or "").strip() or None
    session_local = _get_session_factory()

    with session_local() as db:
        _validate_membership(
            db,
            username=current_user.username,
            household_id=payload.household_id,
        )
        ai_summary = create_ai_summary(
            db,
            household_id=payload.household_id,
            week_start=week_start,
            week_end=week_end,
            content="",
            model=requested_model,
            prompt_hash=None,
            status="pending",
            error=None,
        )
        try:
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            logger.exception("Failed to queue ai_summary job: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to queue weekly summary job",
            ) from exc
        db.refresh(ai_summary)

    background_tasks.add_task(
        _run_weekly_summary_generation_task,
        ai_summary_id=ai_summary.ai_summary_id,
        household_id=payload.household_id,
        week_start=week_start,
        model=requested_model,
        username=current_user.username,
    )

    return _to_weekly_summary_response(ai_summary)


def regenerate_weekly_summary(
    ai_summary_id: UUID,
    current_user: UserEmail,
    background_tasks,
) -> WeeklySummaryResponse:
    session_local = _get_session_factory()

    with session_local() as db:
        user = get_user_by_username(db, current_user.username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )

        existing_summary = get_ai_summary(db, ai_summary_id)
        if not existing_summary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI summary not found",
            )

        if not has_household_membership(db, user.user_id, existing_summary.household_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the specified household",
            )

        week_start = _normalize_week_start(existing_summary.week_start)
        week_end = _week_end_exclusive(week_start)
        requested_model = str(existing_summary.model or "").strip() or None
        ai_summary = create_ai_summary(
            db,
            household_id=existing_summary.household_id,
            week_start=week_start,
            week_end=week_end,
            content="",
            model=requested_model,
            prompt_hash=None,
            status="pending",
            error=None,
        )
        try:
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            logger.exception("Failed to queue ai_summary regeneration job: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to queue weekly summary job",
            ) from exc
        db.refresh(ai_summary)

    background_tasks.add_task(
        _run_weekly_summary_generation_task,
        ai_summary_id=ai_summary.ai_summary_id,
        household_id=ai_summary.household_id,
        week_start=week_start,
        model=requested_model,
        username=current_user.username,
    )

    return _to_weekly_summary_response(ai_summary)


def delete_summary(
    ai_summary_id: UUID,
    current_user: UserEmail,
) -> SummaryDeleteResponse:
    session_local = _get_session_factory()

    with session_local() as db:
        user = get_user_by_username(db, current_user.username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )

        ai_summary = get_ai_summary(db, ai_summary_id)
        if not ai_summary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI summary not found",
            )

        if not has_household_membership(db, user.user_id, ai_summary.household_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the specified household",
            )

        delete_ai_summary(db, ai_summary)
        try:
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            logger.exception("Failed to delete ai_summary %s: %s", ai_summary_id, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete weekly summary",
            ) from exc

    return SummaryDeleteResponse(ai_summary_id=str(ai_summary_id), deleted=True)


def dispatch_weekly_summary_emails(
    *,
    cron_secret: str | None,
    dispatch_date: date | None = None,
) -> WeeklySummaryEmailDispatchResponse:
    _validate_cron_secret(cron_secret)

    current_date = dispatch_date or datetime.now(UTC).date()
    first_day_of_week = WEEKDAY_NAMES[current_date.weekday()]
    week_start = current_date - timedelta(days=7)
    week_end = _week_end_exclusive(week_start)

    session_local = _get_session_factory()
    with session_local() as db:
        targets = list_weekly_summary_email_targets(db)

    users_targeted = len({row.user_id for row in targets})
    households_targeted = len({row.household_id for row in targets})
    household_jobs: dict[UUID, dict[str, object]] = {}

    for row in targets:
        recipient_name = (
            row.display_name.strip()
            if isinstance(row.display_name, str) and row.display_name.strip()
            else row.username
        )
        job = household_jobs.get(row.household_id)
        if not job:
            job = {
                "job_type": EMAIL_JOB_TYPE_WEEKLY_SUMMARY_HOUSEHOLD,
                "status": EMAIL_JOB_STATUS_PENDING,
                "idempotency_key": build_weekly_summary_household_idempotency_key(
                    household_id=str(row.household_id),
                    week_start_iso=week_start.isoformat(),
                ),
                "payload": {
                    "household_id": str(row.household_id),
                    "household_name": row.household_name,
                    "username": row.username,
                    "week_start": week_start.isoformat(),
                    "recipients": [],
                },
                "max_attempts": EMAIL_JOB_MAX_ATTEMPTS,
                "run_after": datetime.now(UTC),
            }
            household_jobs[row.household_id] = job

        payload = cast(dict[str, object], job["payload"])
        recipients = cast(list[dict[str, str]], payload["recipients"])
        recipients.append(
            {
                "user_id": str(row.user_id),
                "email": row.email.strip(),
                "recipient_name": recipient_name,
            }
        )

    with session_local() as db:
        jobs_enqueued = enqueue_email_jobs(db, list(household_jobs.values()))
        db.commit()

    jobs_skipped = max(len(household_jobs) - jobs_enqueued, 0)

    return WeeklySummaryEmailDispatchResponse(
        dispatch_date=current_date,
        first_day_of_week=first_day_of_week,
        week_start=week_start,
        week_end=week_end,
        users_targeted=users_targeted,
        households_targeted=households_targeted,
        jobs_enqueued=jobs_enqueued,
        jobs_skipped=jobs_skipped,
    )


def get_weekly_summary(
    ai_summary_id: UUID,
    current_user: UserEmail,
) -> WeeklySummaryResponse:
    session_local = _get_session_factory()

    with session_local() as db:
        user = get_user_by_username(db, current_user.username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        ai_summary = get_ai_summary(db, ai_summary_id)
        if not ai_summary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI summary not found",
            )
        if not has_household_membership(db, user.user_id, ai_summary.household_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the specified household",
            )
        return _to_weekly_summary_response(ai_summary)


def list_summaries(
    current_user: UserEmail,
    household_id: UUID | None = None,
) -> SavedSummariesListResponse:
    session_local = _get_session_factory()

    with session_local() as db:
        user = get_user_by_username(db, current_user.username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        if household_id and not has_household_membership(
            db, user.user_id, household_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the specified household",
            )

        summaries = list_ai_summaries_for_user(
            db,
            user_id=user.user_id,
            household_id=household_id,
        )

    return SavedSummariesListResponse(
        summaries=[_to_saved_summary_item(summary) for summary in summaries]
    )
