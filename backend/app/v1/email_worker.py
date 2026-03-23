from __future__ import annotations

import asyncio
import logging
import socket
from contextlib import suppress
from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError

from app.v1.email_queue import (
    EMAIL_JOB_STATUS_FAILED,
    EMAIL_JOB_TYPE_WEEKLY_SUMMARY_HOUSEHOLD,
    claim_pending_email_jobs,
    mark_email_job_sent,
    recover_stale_processing_email_jobs,
    reschedule_email_job,
)
from app.v1.helpers import get_session_local
from app.v1.models import EmailJobs
from app.v1.routers.ai_summaries.schemas import GenerateWeeklySummaryRequest
from app.v1.routers.ai_summaries.service import (
    _generate_summary_payload,
    _send_weekly_summary_email,
)

logger = logging.getLogger(__name__)

EMAIL_QUEUE_BATCH_SIZE = 10
EMAIL_QUEUE_POLL_INTERVAL_SECONDS = 15


def _worker_id() -> str:
    return socket.gethostname()[:100]


def _parse_week_start(value: object) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise ValueError("Invalid week_start in email job payload")


def _normalize_recipient_payload(payload: dict) -> list[dict[str, str]]:
    recipients = payload.get("recipients")
    if not isinstance(recipients, list):
        raise ValueError("Email job recipients payload is invalid")

    normalized: list[dict[str, str]] = []
    for recipient in recipients:
        if not isinstance(recipient, dict):
            raise ValueError("Email job recipient entry is invalid")
        user_id = str(recipient.get("user_id") or "").strip()
        recipient_email = str(recipient.get("email") or "").strip()
        recipient_name = str(recipient.get("recipient_name") or "").strip()
        if not user_id or not recipient_email or not recipient_name:
            raise ValueError("Email job recipient entry is incomplete")
        normalized.append(
            {
                "user_id": user_id,
                "email": recipient_email,
                "recipient_name": recipient_name,
            }
        )
    return normalized


def _process_weekly_summary_household_job(job: EmailJobs) -> tuple[bool, dict | None, str | None]:
    payload = job.payload or {}
    household_id = payload.get("household_id")
    household_name = str(payload.get("household_name") or "").strip()
    username = str(payload.get("username") or "").strip()
    week_start = _parse_week_start(payload.get("week_start"))
    recipients = _normalize_recipient_payload(payload)

    if not household_id or not household_name or not username:
        raise ValueError("Weekly summary household job payload is incomplete")

    summary_payload = _generate_summary_payload(
        GenerateWeeklySummaryRequest(
            household_id=UUID(str(household_id)),
            week_start=week_start,
        ),
        username=username,
    )

    remaining_recipients: list[dict[str, str]] = []
    send_errors: list[str] = []

    for recipient in recipients:
        try:
            _send_weekly_summary_email(
                recipient_email=recipient["email"],
                recipient_name=recipient["recipient_name"],
                household_name=household_name,
                week_start=week_start,
                week_end_exclusive=summary_payload["week_end"],
                summary_text=str(summary_payload["summary_text"]),
            )
        except Exception as exc:
            logger.exception(
                "Weekly summary email send failed for user %s in household %s",
                recipient["user_id"],
                household_id,
            )
            remaining_recipients.append(recipient)
            send_errors.append(
                f"{recipient['email']}: {str(exc)[:200]}"
            )

    if remaining_recipients:
        next_payload = {
            **payload,
            "recipients": remaining_recipients,
        }
        return False, next_payload, "; ".join(send_errors) or "Email send failed"

    return True, None, None


def process_email_job(job: EmailJobs) -> tuple[bool, dict | None, str | None]:
    if job.job_type == EMAIL_JOB_TYPE_WEEKLY_SUMMARY_HOUSEHOLD:
        return _process_weekly_summary_household_job(job)
    raise ValueError(f"Unsupported email job type: {job.job_type}")


def run_email_queue_once(*, worker_id: str | None = None) -> None:
    session_local = get_session_local()
    current_worker_id = (worker_id or _worker_id())[:100]
    now = datetime.now(UTC)

    with session_local() as db:
        try:
            recovered = recover_stale_processing_email_jobs(db, now=now)
            jobs = claim_pending_email_jobs(
                db,
                worker_id=current_worker_id,
                limit=EMAIL_QUEUE_BATCH_SIZE,
                now=now,
            )
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            logger.exception("Email queue claim failed")
            return

    if recovered:
        logger.info("Recovered %s stale email jobs", recovered)

    for claimed_job in jobs:
        with session_local() as db:
            job = db.get(EmailJobs, claimed_job.email_job_id)
            if not job or job.status == EMAIL_JOB_STATUS_FAILED:
                continue

            try:
                succeeded, next_payload, last_error = process_email_job(job)
                if succeeded:
                    mark_email_job_sent(job)
                else:
                    reschedule_email_job(
                        job,
                        last_error=last_error or "Email job failed",
                        payload=next_payload,
                    )
                db.commit()
            except Exception as exc:
                db.rollback()
                logger.exception("Email job processing failed for job %s", claimed_job.email_job_id)
                with session_local() as retry_db:
                    retry_job = retry_db.get(EmailJobs, claimed_job.email_job_id)
                    if not retry_job:
                        continue
                    reschedule_email_job(
                        retry_job,
                        last_error=str(exc),
                    )
                    retry_db.commit()


async def run_email_queue_loop() -> None:
    while True:
        await asyncio.to_thread(run_email_queue_once)
        await asyncio.sleep(EMAIL_QUEUE_POLL_INTERVAL_SECONDS)


async def stop_worker_task(task: asyncio.Task[None] | None) -> None:
    if task is None:
        return
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
