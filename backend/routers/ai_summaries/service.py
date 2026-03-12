import hashlib
import json
import logging
import time as time_module
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

import requests
from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from config import settings
from helpers import get_session_local
from models import UserEmail

from .repository import (
    create_ai_summary,
    create_weekly_report,
    fetch_user_daily_reports,
    fetch_user_monthly_reports,
    fetch_user_weekly_reports,
    fetch_household_tasks,
    fetch_weekly_tasks,
    get_user_by_username,
    get_weekly_report,
    has_household_membership,
)
from .schemas import (
    GenerateWeeklySummaryRequest,
    SavedReportItemResponse,
    SavedReportsListResponse,
    WeeklySummaryReportResponse,
)

DEFAULT_OPENROUTER_MODEL = "openrouter/free"
OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_FALLBACK_MODELS = ["openrouter/free"]

logger = logging.getLogger(__name__)


def _normalize_week_start(value: date | None) -> date:
    if value is not None:
        return value
    today = datetime.now(UTC).date()
    return today - timedelta(days=today.weekday())


def _week_end_exclusive(week_start: date) -> date:
    return week_start + timedelta(days=7)


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


def _report_status_payload(
    *,
    status_value: str,
    model: str | None = None,
    prompt_hash: str | None = None,
    error: str | None = None,
    stats: dict | None = None,
    tasks_touched_this_week: list[dict[str, str | None]] | None = None,
) -> dict:
    payload: dict[str, object] = {"status": status_value}
    if model is not None:
        payload["model"] = model
    if prompt_hash is not None:
        payload["prompt_hash"] = prompt_hash
    if error is not None:
        payload["error"] = error
    if stats is not None:
        payload["stats"] = stats
    if tasks_touched_this_week is not None:
        payload["tasks_touched_this_week"] = tasks_touched_this_week
    return payload


def _to_weekly_report_response(report) -> WeeklySummaryReportResponse:
    meta = report.stats_json or {}
    status_value = meta.get("status", "completed")
    if status_value not in {"pending", "completed", "failed"}:
        status_value = "completed"

    return WeeklySummaryReportResponse(
        weekly_report_id=str(report.weekly_report_id),
        household_id=str(report.household_id),
        week_start=report.week_start,
        week_end=report.week_end,
        status=status_value,
        model=str(meta.get("model") or ""),
        content=report.summary,
        prompt_hash=meta.get("prompt_hash"),
        error=meta.get("error"),
    )


def _coerce_status(meta: dict | None) -> str:
    status_value = (meta or {}).get("status", "completed")
    if status_value not in {"pending", "completed", "failed"}:
        return "completed"
    return status_value


def _to_saved_report_item(report_type: str, report) -> SavedReportItemResponse:
    meta = report.stats_json or {}
    start_date = getattr(report, "date", None) or getattr(report, "week_start", None) or getattr(report, "month_start", None)
    end_date = getattr(report, "date", None) or getattr(report, "week_end", None) or getattr(report, "month_end", None)
    report_id = (
        getattr(report, "daily_report_id", None)
        or getattr(report, "weekly_report_id", None)
        or getattr(report, "monthly_report_id", None)
    )
    granted_at = getattr(report, "granted_at", None)

    return SavedReportItemResponse(
        report_type=report_type,
        report_id=str(report_id),
        household_id=str(report.household_id),
        start_date=start_date,
        end_date=end_date,
        granted_at=granted_at.date() if granted_at else None,
        status=_coerce_status(meta),
        model=str(meta.get("model") or ""),
        content=report.summary,
        error=meta.get("error"),
    )


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

    model_name = settings.OPENROUTER_WEEKLY_SUMMARY_MODEL or DEFAULT_OPENROUTER_MODEL
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

    response_json = ai_response.json()
    summary_text = _extract_text_content(response_json)
    if not summary_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouter response did not contain summary text",
        )

    model_for_db = selected_model[:100] if selected_model else None
    return {
        "week_start": week_start,
        "week_end": week_end,
        "summary_text": summary_text,
        "model": model_for_db,
        "prompt_hash": prompt_hash,
        "stats_json": _report_status_payload(
            status_value="completed",
            model=model_for_db,
            prompt_hash=prompt_hash,
            stats=prompt_payload.get("stats"),
            tasks_touched_this_week=serialized_tasks[:40],
        ),
    }


def _run_weekly_summary_generation_task(
    *,
    weekly_report_id: UUID,
    household_id: UUID,
    week_start: date,
    username: str,
) -> None:
    session_local = _get_session_factory()

    try:
        result = _generate_summary_payload(
            GenerateWeeklySummaryRequest(
                household_id=household_id,
                week_start=week_start,
            ),
            username=username,
        )
    except Exception as exc:
        logger.exception("Weekly summary generation failed for report %s", weekly_report_id)
        with session_local() as db:
            weekly_report = get_weekly_report(db, weekly_report_id)
            if not weekly_report:
                return
            weekly_report.stats_json = _report_status_payload(
                status_value="failed",
                error=str(exc),
            )
            try:
                db.commit()
            except SQLAlchemyError:
                db.rollback()
                logger.exception(
                    "Failed to persist failure state for weekly report %s",
                    weekly_report_id,
                )
        return

    with session_local() as db:
        weekly_report = get_weekly_report(db, weekly_report_id)
        if not weekly_report:
            logger.warning("Weekly report %s not found during completion", weekly_report_id)
            return

        weekly_report.summary = result["summary_text"]
        weekly_report.stats_json = result["stats_json"]

        create_ai_summary(
            db,
            household_id=household_id,
            week_start=result["week_start"],
            content=result["summary_text"],
            model=result["model"],
            prompt_hash=result["prompt_hash"],
        )

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            logger.exception("Failed to store weekly summary result for %s", weekly_report_id)


def queue_weekly_summary_generation(
    payload: GenerateWeeklySummaryRequest,
    current_user: UserEmail,
    background_tasks,
) -> WeeklySummaryReportResponse:
    week_start = _normalize_week_start(payload.week_start)
    week_end = _week_end_exclusive(week_start)
    session_local = _get_session_factory()

    with session_local() as db:
        _validate_membership(
            db,
            username=current_user.username,
            household_id=payload.household_id,
        )

        weekly_report = create_weekly_report(
            db,
            household_id=payload.household_id,
            week_start=week_start,
            week_end=week_end,
            stats_json=_report_status_payload(status_value="pending"),
        )
        try:
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            logger.exception("Failed to queue weekly summary job: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to queue weekly summary job",
            ) from exc
        db.refresh(weekly_report)

    background_tasks.add_task(
        _run_weekly_summary_generation_task,
        weekly_report_id=weekly_report.weekly_report_id,
        household_id=payload.household_id,
        week_start=week_start,
        username=current_user.username,
    )

    return _to_weekly_report_response(weekly_report)


def get_weekly_summary_report(
    weekly_report_id: UUID,
    current_user: UserEmail,
) -> WeeklySummaryReportResponse:
    session_local = _get_session_factory()

    with session_local() as db:
        user = get_user_by_username(db, current_user.username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )

        weekly_report = get_weekly_report(db, weekly_report_id)
        if not weekly_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Weekly summary report not found",
            )

        if not has_household_membership(db, user.user_id, weekly_report.household_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the specified household",
            )

        return _to_weekly_report_response(weekly_report)


def list_saved_reports(
    current_user: UserEmail,
    household_id: UUID | None = None,
) -> SavedReportsListResponse:
    session_local = _get_session_factory()

    with session_local() as db:
        user = get_user_by_username(db, current_user.username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )

        if household_id and not has_household_membership(db, user.user_id, household_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the specified household",
            )

        daily_reports = fetch_user_daily_reports(
            db,
            user_id=user.user_id,
            household_id=household_id,
        )
        weekly_reports = fetch_user_weekly_reports(
            db,
            user_id=user.user_id,
            household_id=household_id,
        )
        monthly_reports = fetch_user_monthly_reports(
            db,
            user_id=user.user_id,
            household_id=household_id,
        )

    reports = [
        *[_to_saved_report_item("daily", report) for report in daily_reports],
        *[_to_saved_report_item("weekly", report) for report in weekly_reports],
        *[_to_saved_report_item("monthly", report) for report in monthly_reports],
    ]
    reports.sort(
        key=lambda report: (
            report.granted_at.isoformat() if report.granted_at else "",
            report.start_date.isoformat(),
        ),
        reverse=True,
    )
    return SavedReportsListResponse(reports=reports)
