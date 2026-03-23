from __future__ import annotations

import hashlib
import json
import logging
import time as time_module
from datetime import datetime, timezone, timedelta
from typing import Any, Literal
from uuid import UUID

import requests
from fastapi import HTTPException, status
from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy.exc import SQLAlchemyError

from app.v1.config import settings
from app.v1.helpers import get_session_local
from app.v1.models import UserEmail

from .repository import (
    count_done_in_range,
    count_open_tasks,
    count_overdue_tasks,
    fetch_category_completed_by_person_in_range,
    fetch_category_completed_counts_in_range,
    fetch_category_created_counts_in_range,
    fetch_category_rows,
    fetch_completion_rows,
    fetch_load_rows,
    fetch_member_rows,
    fetch_open_assignee_counts,
    fetch_open_tasks_by_category,
    fetch_overdue_tasks_by_category,
    fetch_radar_rows,
    fetch_weekly_rows,
    get_cached_ai_insight,
    get_cached_ai_question,
    get_default_household_for_user,
    get_household_by_id,
    get_user_by_username,
    has_membership,
    upsert_cached_ai_question,
    upsert_cached_ai_insight,
)
from .schemas import (
    AnalyticsAskRequest,
    AnalyticsAskResponse,
    AnalyticsAIInsightsRequest,
    AnalyticsAIInsightsResponse,
    AnalyticsRecommendationItem,
    AnalyticsRiskItem,
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
DEFAULT_OPENROUTER_MODEL = "openrouter/free"
OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"
ANALYTICS_AI_PROMPT_VERSION = "analytics-ai-insights-v1"

logger = logging.getLogger(__name__)


def _coerce_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        parts = [
            part.strip(" -\t")
            for part in value.replace("\r", "\n").split("\n")
            if part.strip(" -\t")
        ]
        return parts if parts else [value.strip()]
    return [str(value).strip()]


class _AnalyticsAIModelPayload(BaseModel):
    summary: str
    risks: list[AnalyticsRiskItem] = Field(default_factory=list)
    recommendations: list[AnalyticsRecommendationItem] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    confidence: Literal["low", "medium", "high"]

    @field_validator("evidence", mode="before")
    @classmethod
    def _coerce_evidence(cls, value: Any) -> list[str]:
        return _coerce_string_list(value)


class _AnalyticsAskModelPayload(BaseModel):
    answer: str
    evidence: list[str] = Field(default_factory=list)
    suggested_followups: list[str] = Field(default_factory=list)

    @field_validator("evidence", "suggested_followups", mode="before")
    @classmethod
    def _coerce_string_list(cls, value: Any) -> list[str]:
        return _coerce_string_list(value)


_INTERNAL_ANALYTICS_TERMS = {
    "top_categories": "top categories",
    "completion_trend": "overall completion trend",
    "completed_current": "completed tasks this period",
    "completed_previous": "completed tasks in the previous period",
    "completed_change": "change in completed tasks",
    "created_current": "tasks created this period",
    "created_previous": "tasks created in the previous period",
    "created_change": "change in created tasks",
    "open_current": "currently open tasks",
    "overdue_current": "currently overdue tasks",
    "category_breakdown": "category comparisons",
    "person_category_completion": "person-by-category completion details",
}


def _normalize_confidence(value: Any) -> Literal["low", "medium", "high"]:
    normalized = str(value or "").strip().lower()
    if normalized in {"low", "medium", "high"}:
        return normalized
    return "low"


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
            status_code=status.HTTP_403_FORBIDDEN,
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


def _load_analytics_context(
    db,
    *,
    household_id: UUID | None,
    timeframe: Literal["7d", "30d", "12w"],
    current_user: UserEmail,
) -> tuple[Any, UUID, AnalyticsSummaryResponse, str, dict[str, Any]]:
    me = _get_db_user(db, current_user)
    hid = household_id or _default_household(db, me.user_id)
    _require_membership(db, me.user_id, hid)

    household = get_household_by_id(db, hid)
    household_name = household.name if household else "Household"

    member_rows = fetch_member_rows(db, hid)

    people: list[str] = []
    labels: dict[str, str] = {}
    user_id_to_username: dict[UUID, str] = {}

    for row in member_rows:
        username = (row.username or "").strip()
        if not username:
            continue

        display = (row.display_name or row.username).strip()
        people.append(username)
        labels[username] = display
        user_id_to_username[row.user_id] = username

    now = datetime.now(timezone.utc)
    days = 7 if timeframe == "7d" else 30 if timeframe == "30d" else 84
    start = now - timedelta(days=days)

    weekly_rows = fetch_weekly_rows(db, hid, start)
    weekly_map: dict[str, dict[str, int]] = {}

    for row in weekly_rows:
        iso = row.wk.isocalendar()
        week_label = f"{iso.year}-W{iso.week:02d}"
        person = user_id_to_username.get(row.assigns_to, "unassigned")
        weekly_map.setdefault(week_label, {})
        weekly_map[week_label][person] = int(row.cnt or 0)

    weekly_data = [
        WeeklyPoint(week=week, values=weekly_map[week])
        for week in sorted(weekly_map.keys())
    ]

    category_rows = fetch_category_rows(db, hid, start)
    category_data = [
        CategoryPoint(name=row.cat, value=int(row.cnt or 0)) for row in category_rows
    ]

    load_rows = fetch_load_rows(db, hid, start, OPEN_STATUSES)
    load_trend_data: list[LoadTrendPoint] = []
    for row in load_rows:
        load_trend_data.append(
            LoadTrendPoint(
                month=row.mo.strftime("%Y-%m"),
                load=min(100, int(row.open_tasks or 0)),
            )
        )

    completion_rows = fetch_completion_rows(
        db,
        hid,
        start,
        COMPLETED_STATUSES,
        OPEN_STATUSES,
    )
    completion_data = [
        CompletionPoint(
            day=row.dy.strftime("%Y-%m-%d"),
            completed=int(row.completed or 0),
            pending=int(row.pending or 0),
        )
        for row in completion_rows
    ]

    radar_rows = fetch_radar_rows(db, hid, start)
    radar_map: dict[str, dict[str, int]] = {}
    for row in radar_rows:
        category = row.cat
        person = user_id_to_username.get(row.assigns_to, "unassigned")
        radar_map.setdefault(category, {})
        radar_map[category][person] = int(row.cnt or 0)

    radar_data = [
        RadarPoint(category=category, values=values)
        for category, values in radar_map.items()
    ]

    start_of_week = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    start_of_week = start_of_week - timedelta(days=start_of_week.weekday())
    start_of_prev_week = start_of_week - timedelta(days=7)

    done_this_week = count_done_in_range(
        db,
        hid,
        COMPLETED_STATUSES,
        start_of_week,
        now,
    )
    done_prev_week = count_done_in_range(
        db,
        hid,
        COMPLETED_STATUSES,
        start_of_prev_week,
        start_of_week,
    )
    open_tasks = count_open_tasks(db, hid, OPEN_STATUSES)
    overdue_tasks = count_overdue_tasks(db, hid, OPEN_STATUSES, now)

    assignee_counts = fetch_open_assignee_counts(db, hid, OPEN_STATUSES)
    open_by_person: dict[str, int] = {}
    for row in assignee_counts:
        username = user_id_to_username.get(row.assigns_to)
        if not username:
            continue
        open_by_person[username] = int(row.cnt or 0)

    load_balance_value = "—"
    if len(open_by_person) >= 2:
        total = sum(open_by_person.values()) or 1
        shares = [count / total for count in open_by_person.values()]
        spread = max(shares) - min(shares)
        score = round((1.0 - spread) * 100)
        load_balance_value = str(max(0, min(100, score)))

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

    summary = AnalyticsSummaryResponse(
        household_id=str(hid),
        people=people,
        labels=labels,
        weeklyData=weekly_data,
        categoryData=category_data,
        loadTrendData=load_trend_data,
        completionData=completion_data,
        radarData=radar_data,
        stats=stats,
    )
    context = {
        "now": now,
        "start": start,
        "previous_start": start - (now - start),
        "labels": labels,
        "user_id_to_username": user_id_to_username,
    }
    return me, hid, summary, household_name, context


def get_analytics_summary(
    household_id: UUID | None,
    timeframe: Literal["7d", "30d", "12w"],
    current_user: UserEmail,
) -> AnalyticsSummaryResponse:
    session_local = get_session_local()

    with session_local() as db:
        _, _, summary, _, _ = _load_analytics_context(
            db,
            household_id=household_id,
            timeframe=timeframe,
            current_user=current_user,
        )
        return summary


def _safe_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    text = str(value).strip()
    if not text or text == "—":
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def _stats_map(summary: AnalyticsSummaryResponse) -> dict[str, int | None]:
    result: dict[str, int | None] = {}
    for item in summary.stats:
        result[item.title] = _safe_int(item.value)
        result[f"{item.title} previous"] = _safe_int(item.previousValue)
    return result


def _workload_by_person(summary: AnalyticsSummaryResponse) -> list[dict[str, Any]]:
    totals: dict[str, int] = {person: 0 for person in summary.people}
    for row in summary.weeklyData:
        for person, count in row.values.items():
            totals[person] = totals.get(person, 0) + int(count or 0)

    total_tasks = sum(totals.values())
    entries = []
    for person, count in totals.items():
        label = summary.labels.get(person, person)
        share_pct = round((count / total_tasks) * 100, 1) if total_tasks else 0.0
        entries.append(
            {
                "person": person,
                "label": label,
                "task_count": count,
                "share_pct": share_pct,
            }
        )
    entries.sort(key=lambda item: item["task_count"], reverse=True)
    return entries


def _completion_trend(
    summary: AnalyticsSummaryResponse,
) -> dict[str, float | int | None]:
    if not summary.completionData:
        return {
            "recent_avg_rate": None,
            "previous_avg_rate": None,
            "data_points": 0,
        }

    rates = []
    for row in summary.completionData:
        completed = int(row.completed or 0)
        pending = int(row.pending or 0)
        total = completed + pending
        rate = round((completed / total) * 100, 1) if total else 0.0
        rates.append(rate)

    midpoint = max(1, len(rates) // 2)
    previous = rates[:midpoint]
    recent = rates[midpoint:]
    if not recent:
        recent = rates

    previous_avg = round(sum(previous) / len(previous), 1) if previous else None
    recent_avg = round(sum(recent) / len(recent), 1) if recent else None
    return {
        "recent_avg_rate": recent_avg,
        "previous_avg_rate": previous_avg,
        "data_points": len(rates),
    }


def _rows_to_count_map(rows: list[Any]) -> dict[str, int]:
    result: dict[str, int] = {}
    for row in rows:
        result[str(row.cat)] = int(row.cnt or 0)
    return result


def _build_category_breakdown(
    db,
    *,
    household_id: UUID,
    now: datetime,
    start: datetime,
    previous_start: datetime,
    user_id_to_username: dict[UUID, str],
    labels: dict[str, str],
) -> list[dict[str, Any]]:
    created_current = _rows_to_count_map(
        fetch_category_created_counts_in_range(db, household_id, start, now)
    )
    created_previous = _rows_to_count_map(
        fetch_category_created_counts_in_range(db, household_id, previous_start, start)
    )
    completed_current = _rows_to_count_map(
        fetch_category_completed_counts_in_range(
            db,
            household_id,
            start,
            now,
            COMPLETED_STATUSES,
        )
    )
    completed_previous = _rows_to_count_map(
        fetch_category_completed_counts_in_range(
            db,
            household_id,
            previous_start,
            start,
            COMPLETED_STATUSES,
        )
    )
    open_current = _rows_to_count_map(
        fetch_open_tasks_by_category(db, household_id, OPEN_STATUSES)
    )
    overdue_current = _rows_to_count_map(
        fetch_overdue_tasks_by_category(db, household_id, now, OPEN_STATUSES)
    )

    completed_by_person_rows = fetch_category_completed_by_person_in_range(
        db,
        household_id,
        start,
        now,
        COMPLETED_STATUSES,
    )
    completed_by_person: dict[str, dict[str, int]] = {}
    for row in completed_by_person_rows:
        username = user_id_to_username.get(row.assigns_to, "unassigned")
        completed_by_person.setdefault(str(row.cat), {})
        completed_by_person[str(row.cat)][username] = int(row.cnt or 0)

    category_names = sorted(
        {
            *created_current.keys(),
            *created_previous.keys(),
            *completed_current.keys(),
            *completed_previous.keys(),
            *open_current.keys(),
            *overdue_current.keys(),
        }
    )

    breakdown: list[dict[str, Any]] = []
    for category_name in category_names:
        by_person = completed_by_person.get(category_name, {})
        people_rows = [
            {
                "person": username,
                "label": labels.get(username, username),
                "completed": count,
            }
            for username, count in sorted(
                by_person.items(),
                key=lambda item: item[1],
                reverse=True,
            )
        ]
        breakdown.append(
            {
                "name": category_name,
                "created_current": created_current.get(category_name, 0),
                "created_previous": created_previous.get(category_name, 0),
                "created_change": created_current.get(category_name, 0)
                - created_previous.get(category_name, 0),
                "completed_current": completed_current.get(category_name, 0),
                "completed_previous": completed_previous.get(category_name, 0),
                "completed_change": completed_current.get(category_name, 0)
                - completed_previous.get(category_name, 0),
                "open_current": open_current.get(category_name, 0),
                "overdue_current": overdue_current.get(category_name, 0),
                "completed_by_person": people_rows,
            }
        )

    breakdown.sort(
        key=lambda item: (
            item["completed_current"],
            item["created_current"],
            item["open_current"],
        ),
        reverse=True,
    )
    return breakdown


def _build_person_category_completion(
    category_breakdown: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    per_person: dict[str, dict[str, Any]] = {}
    for category in category_breakdown:
        for row in category.get("completed_by_person", []):
            person = row["person"]
            person_entry = per_person.setdefault(
                person,
                {
                    "person": person,
                    "label": row["label"],
                    "categories": [],
                    "total_completed_current": 0,
                },
            )
            person_entry["categories"].append(
                {
                    "name": category["name"],
                    "completed_current": row["completed"],
                    "share_of_category_completed_pct": round(
                        (row["completed"] / max(1, category["completed_current"]))
                        * 100,
                        1,
                    )
                    if category["completed_current"] > 0
                    else 0.0,
                }
            )
            person_entry["total_completed_current"] += row["completed"]

    result = list(per_person.values())
    for person_entry in result:
        person_entry["categories"].sort(
            key=lambda item: item["completed_current"],
            reverse=True,
        )
    result.sort(key=lambda item: item["total_completed_current"], reverse=True)
    return result


def _sanitize_end_user_text(value: str) -> str:
    text = str(value or "").strip()
    for raw_term, replacement in _INTERNAL_ANALYTICS_TERMS.items():
        text = text.replace(raw_term, replacement)
    return text


def _sanitize_ask_payload(
    payload: _AnalyticsAskModelPayload,
) -> _AnalyticsAskModelPayload:
    return _AnalyticsAskModelPayload(
        answer=_sanitize_end_user_text(payload.answer),
        evidence=[_sanitize_end_user_text(item) for item in payload.evidence],
        suggested_followups=[
            _sanitize_end_user_text(item) for item in payload.suggested_followups
        ],
    )


def _build_ai_input_payload(
    summary: AnalyticsSummaryResponse,
    *,
    household_name: str,
    timeframe: Literal["7d", "30d", "12w"],
    category_breakdown: list[dict[str, Any]] | None = None,
    person_category_completion: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    stats = _stats_map(summary)
    top_categories = [
        {"name": row.name, "value": row.value}
        for row in sorted(
            summary.categoryData, key=lambda item: item.value, reverse=True
        )[:5]
    ]
    load_trend = [
        {"month": row.month, "load": row.load} for row in summary.loadTrendData[-4:]
    ]
    evidence_points = [
        {
            "day": row.day,
            "completed": row.completed,
            "pending": row.pending,
        }
        for row in summary.completionData[-7:]
    ]

    return {
        "prompt_version": ANALYTICS_AI_PROMPT_VERSION,
        "household_id": summary.household_id,
        "household_name": household_name,
        "timeframe": timeframe,
        "people": [
            {
                "username": person,
                "label": summary.labels.get(person, person),
            }
            for person in summary.people
        ],
        "stats": {
            "done_this_week": stats.get("Done This Week"),
            "done_prev_week": stats.get("Done This Week previous"),
            "open_tasks": stats.get("Open Tasks Remaining"),
            "overdue_tasks": stats.get("Overdue Tasks"),
            "load_balance_score": stats.get("Load Balance Score"),
        },
        "workload_by_person": _workload_by_person(summary),
        "top_categories": top_categories,
        "category_breakdown": category_breakdown or [],
        "person_category_completion": person_category_completion or [],
        "load_trend": load_trend,
        "completion_trend": _completion_trend(summary),
        "recent_completion_points": evidence_points,
    }


def _build_ask_input_payload(
    summary: AnalyticsSummaryResponse,
    *,
    household_name: str,
    timeframe: Literal["7d", "30d", "12w"],
    question: str,
    category_breakdown: list[dict[str, Any]] | None = None,
    person_category_completion: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    payload = _build_ai_input_payload(
        summary,
        household_name=household_name,
        timeframe=timeframe,
        category_breakdown=category_breakdown,
        person_category_completion=person_category_completion,
    )
    payload["question"] = question.strip()
    return payload


def _build_input_hash(payload: dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _parse_model_list(raw_value: str) -> list[str]:
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def _load_model_candidates() -> list[str]:
    primary = (
        settings.OPENROUTER_ANALYTICS_INSIGHTS_MODEL
        or settings.OPENROUTER_WEEKLY_SUMMARY_MODEL
        or DEFAULT_OPENROUTER_MODEL
    )
    fallbacks = _parse_model_list(
        settings.OPENROUTER_ANALYTICS_INSIGHTS_FALLBACK_MODELS
    )
    if not fallbacks:
        fallbacks = _parse_model_list(
            settings.OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS
        )

    candidates: list[str] = []
    for model in [primary, *fallbacks, DEFAULT_OPENROUTER_MODEL]:
        if model and model not in candidates:
            candidates.append(model)
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


def _extract_json_block(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3 and lines[-1].startswith("```"):
            return "\n".join(lines[1:-1]).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return text
    return text[start : end + 1]


def _generate_ai_insights_payload(
    ai_input: dict[str, Any],
) -> tuple[_AnalyticsAIModelPayload, str | None]:
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENROUTER_API_KEY is not configured",
        )

    system_prompt = (
        "You are generating grounded household analytics insights. "
        "Use only the provided data. "
        "Do not infer causes not supported by the evidence. "
        "Keep recommendations specific, practical, and non-judgmental. "
        "Return valid JSON only."
    )
    user_prompt = (
        f"Analyze this household analytics data for timeframe {ai_input['timeframe']}.\n\n"
        "Goals:\n"
        "1. Summarize the most important change.\n"
        "2. Identify up to 3 risks.\n"
        "3. Suggest up to 3 practical actions.\n"
        "4. Include evidence statements tied directly to the numbers.\n"
        "5. Set confidence to low, medium, or high based on data completeness.\n\n"
        "Return JSON with exactly this shape:\n"
        "{\n"
        '  "summary": "string",\n'
        '  "risks": [{"title": "string", "severity": "low|medium|high", "reason": "string"}],\n'
        '  "recommendations": [{"title": "string", "action": "string", "priority": "low|medium|high"}],\n'
        '  "evidence": ["string"],\n'
        '  "confidence": "low|medium|high"\n'
        "}\n\n"
        f"Data:\n{json.dumps(ai_input, sort_keys=True, ensure_ascii=True)}"
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
    request_failures: list[str] = []
    selected_model: str | None = None

    for candidate_model in _load_model_candidates():
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
                    "OpenRouter rate limit reached for configured analytics models. "
                    f"Tried models: {', '.join(_load_model_candidates())}."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"OpenRouter request failed with status {ai_response.status_code}. "
                f"Attempts: {' | '.join(request_failures)}"
            ),
        )

    response_text = _extract_text_content(ai_response.json())
    if not response_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouter response did not contain analytics insight text",
        )

    try:
        parsed_json = json.loads(_extract_json_block(response_text))
        validated = _AnalyticsAIModelPayload.model_validate(parsed_json)
    except (json.JSONDecodeError, ValidationError) as exc:
        logger.exception("Failed to parse analytics AI response")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenRouter response was not valid analytics JSON: {exc}",
        ) from exc

    return validated, selected_model[:100] if selected_model else None


def _generate_ai_ask_payload(
    ask_input: dict[str, Any],
) -> tuple[_AnalyticsAskModelPayload, str | None]:
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENROUTER_API_KEY is not configured",
        )

    system_prompt = (
        "You answer analytics questions for a household productivity dashboard. "
        "Use only the provided analytics data. "
        "If the question is outside analytics scope, say that you can only answer based on analytics data. "
        "Do not invent causes or data. "
        "Never mention raw JSON keys, field names, payload names, or implementation details. "
        "Write for an end user, not a developer. "
        "Return valid JSON only."
    )
    user_prompt = (
        "Answer the analytics question using only the provided data.\n"
        "Requirements:\n"
        "1. Keep the answer concise.\n"
        "2. Include 1 to 3 evidence statements tied directly to the numbers.\n"
        "3. Include up to 3 suggested follow-up questions.\n"
        "4. If the question cannot be answered from the data, say so clearly.\n\n"
        "5. Do not mention internal labels such as field names, JSON properties, arrays, objects, or payload structure.\n"
        "6. When data is missing, explain that in plain language, for example: "
        '"This view shows current category totals, but it does not include category-by-category completion history."\n\n'
        "7. The data includes computed category comparisons for the current period versus the previous period, "
        "including created tasks, completed tasks, open tasks, overdue tasks, and who completed tasks within each category. "
        "Use those comparisons when the user asks what changed, which category moved most, or who completed the most in a category.\n\n"
        "8. If the question asks for rates or percentages, answer with percentages using the provided computed values whenever possible.\n"
        "9. A response is invalid if it contains implementation terms such as completed_current, completed_previous, "
        "completed_change, created_current, created_previous, created_change, top_categories, completion_trend, "
        "category_breakdown, or person_category_completion.\n\n"
        "Return JSON with exactly this shape:\n"
        "{\n"
        '  "answer": "string",\n'
        '  "evidence": ["string"],\n'
        '  "suggested_followups": ["string"]\n'
        "}\n\n"
        f"Data:\n{json.dumps(ask_input, sort_keys=True, ensure_ascii=True)}"
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
        "temperature": 0.1,
    }

    ai_response: requests.Response | None = None
    request_failures: list[str] = []
    selected_model: str | None = None

    for candidate_model in _load_model_candidates():
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
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"OpenRouter request failed with status {ai_response.status_code}. "
                f"Attempts: {' | '.join(request_failures)}"
            ),
        )

    response_text = _extract_text_content(ai_response.json())
    if not response_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouter response did not contain analytics answer text",
        )

    try:
        parsed_json = json.loads(_extract_json_block(response_text))
        validated = _sanitize_ask_payload(
            _AnalyticsAskModelPayload.model_validate(parsed_json)
        )
    except (json.JSONDecodeError, ValidationError) as exc:
        logger.exception("Failed to parse analytics ask response")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenRouter response was not valid analytics ask JSON: {exc}",
        ) from exc

    return validated, selected_model[:100] if selected_model else None


def _cache_to_response(
    cache_item,
    *,
    household_id: UUID,
    timeframe: Literal["7d", "30d", "12w"],
    cached: bool,
) -> AnalyticsAIInsightsResponse:
    content_json = cache_item.content_json or {}
    generated_at = (
        cache_item.updated_at or cache_item.created_at or datetime.now(timezone.utc)
    )
    return AnalyticsAIInsightsResponse(
        household_id=str(household_id),
        timeframe=timeframe,
        generated_at=generated_at,
        summary=str(content_json.get("summary") or ""),
        risks=[
            AnalyticsRiskItem.model_validate(item)
            for item in content_json.get("risks", [])
        ],
        recommendations=[
            AnalyticsRecommendationItem.model_validate(item)
            for item in content_json.get("recommendations", [])
        ],
        evidence=[str(item) for item in content_json.get("evidence", [])],
        confidence=_normalize_confidence(content_json.get("confidence", "low")),
        cached=cached,
        model=cache_item.model,
    )


def get_analytics_ai_insights(
    payload: AnalyticsAIInsightsRequest,
    current_user: UserEmail,
) -> AnalyticsAIInsightsResponse:
    session_local = get_session_local()

    with session_local() as db:
        _, hid, summary, household_name, analytics_context = _load_analytics_context(
            db,
            household_id=payload.household_id,
            timeframe=payload.timeframe,
            current_user=current_user,
        )
        category_breakdown = _build_category_breakdown(
            db,
            household_id=hid,
            now=analytics_context["now"],
            start=analytics_context["start"],
            previous_start=analytics_context["previous_start"],
            user_id_to_username=analytics_context["user_id_to_username"],
            labels=analytics_context["labels"],
        )
        person_category_completion = _build_person_category_completion(
            category_breakdown
        )
        ai_input = _build_ai_input_payload(
            summary,
            household_name=household_name,
            timeframe=payload.timeframe,
            category_breakdown=category_breakdown,
            person_category_completion=person_category_completion,
        )
        input_hash = _build_input_hash(ai_input)

        if not payload.refresh:
            cached_item = get_cached_ai_insight(
                db,
                household_id=hid,
                timeframe=payload.timeframe,
                input_hash=input_hash,
            )
            if cached_item is not None:
                return _cache_to_response(
                    cached_item,
                    household_id=hid,
                    timeframe=payload.timeframe,
                    cached=True,
                )

        ai_result, selected_model = _generate_ai_insights_payload(ai_input)
        cache_item = upsert_cached_ai_insight(
            db,
            household_id=hid,
            timeframe=payload.timeframe,
            input_hash=input_hash,
            content_json=ai_result.model_dump(),
            model=selected_model,
        )
        try:
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            logger.exception("Failed to persist analytics ai insight cache: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store analytics AI insights",
            ) from exc

        db.refresh(cache_item)
        return _cache_to_response(
            cache_item,
            household_id=hid,
            timeframe=payload.timeframe,
            cached=False,
        )


def _question_cache_to_response(
    cache_item,
    *,
    household_id: UUID,
    timeframe: Literal["7d", "30d", "12w"],
    question: str,
    cached: bool,
) -> AnalyticsAskResponse:
    content_json = cache_item.content_json or {}
    generated_at = (
        cache_item.updated_at or cache_item.created_at or datetime.now(timezone.utc)
    )
    return AnalyticsAskResponse(
        household_id=str(household_id),
        timeframe=timeframe,
        question=question,
        answer=str(content_json.get("answer") or ""),
        evidence=[str(item) for item in content_json.get("evidence", [])],
        suggested_followups=[
            str(item) for item in content_json.get("suggested_followups", [])
        ],
        cached=cached,
        model=cache_item.model,
        generated_at=generated_at,
    )


def get_analytics_ask_answer(
    payload: AnalyticsAskRequest,
    current_user: UserEmail,
) -> AnalyticsAskResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Question is required",
        )

    session_local = get_session_local()

    with session_local() as db:
        _, hid, summary, household_name, analytics_context = _load_analytics_context(
            db,
            household_id=payload.household_id,
            timeframe=payload.timeframe,
            current_user=current_user,
        )
        category_breakdown = _build_category_breakdown(
            db,
            household_id=hid,
            now=analytics_context["now"],
            start=analytics_context["start"],
            previous_start=analytics_context["previous_start"],
            user_id_to_username=analytics_context["user_id_to_username"],
            labels=analytics_context["labels"],
        )
        person_category_completion = _build_person_category_completion(
            category_breakdown
        )
        ask_input = _build_ask_input_payload(
            summary,
            household_name=household_name,
            timeframe=payload.timeframe,
            question=question,
            category_breakdown=category_breakdown,
            person_category_completion=person_category_completion,
        )
        input_hash = _build_input_hash(ask_input)

        if not payload.refresh:
            cached_item = get_cached_ai_question(
                db,
                household_id=hid,
                timeframe=payload.timeframe,
                input_hash=input_hash,
            )
            if cached_item is not None:
                return _question_cache_to_response(
                    cached_item,
                    household_id=hid,
                    timeframe=payload.timeframe,
                    question=question,
                    cached=True,
                )

        ai_result, selected_model = _generate_ai_ask_payload(ask_input)
        cache_item = upsert_cached_ai_question(
            db,
            household_id=hid,
            timeframe=payload.timeframe,
            question=question,
            input_hash=input_hash,
            content_json=ai_result.model_dump(),
            model=selected_model,
        )
        try:
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            logger.exception("Failed to persist analytics ai question cache: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store analytics AI answer",
            ) from exc

        db.refresh(cache_item)
        return _question_cache_to_response(
            cache_item,
            household_id=hid,
            timeframe=payload.timeframe,
            question=question,
            cached=False,
        )
