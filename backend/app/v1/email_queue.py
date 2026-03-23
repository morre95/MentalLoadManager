from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.v1.models import EmailJobs

EMAIL_JOB_TYPE_WEEKLY_SUMMARY_HOUSEHOLD = "weekly_summary_household"
EMAIL_JOB_STATUS_PENDING = "pending"
EMAIL_JOB_STATUS_PROCESSING = "processing"
EMAIL_JOB_STATUS_SENT = "sent"
EMAIL_JOB_STATUS_FAILED = "failed"
EMAIL_JOB_MAX_ATTEMPTS = 5
STALE_EMAIL_JOB_LOCK_SECONDS = 15 * 60


def build_weekly_summary_household_idempotency_key(
    *,
    household_id: str,
    week_start_iso: str,
) -> str:
    return f"{EMAIL_JOB_TYPE_WEEKLY_SUMMARY_HOUSEHOLD}:{household_id}:{week_start_iso}"


def enqueue_email_jobs(db: Session, jobs: list[dict[str, Any]]) -> int:
    if not jobs:
        return 0

    result = db.execute(
        pg_insert(EmailJobs)
        .values(jobs)
        .on_conflict_do_nothing(index_elements=[EmailJobs.idempotency_key])
    )
    return int(result.rowcount or 0)


def recover_stale_processing_email_jobs(
    db: Session,
    *,
    now: datetime | None = None,
) -> int:
    current_time = now or datetime.now(UTC)
    stale_before = current_time - timedelta(seconds=STALE_EMAIL_JOB_LOCK_SECONDS)

    jobs = list(
        db.scalars(
            select(EmailJobs).where(
                EmailJobs.status == EMAIL_JOB_STATUS_PROCESSING,
                EmailJobs.locked_at.is_not(None),
                EmailJobs.locked_at < stale_before,
            )
        ).all()
    )

    for job in jobs:
        job.status = EMAIL_JOB_STATUS_PENDING
        job.locked_at = None
        job.locked_by = None
        job.updated_at = current_time

    return len(jobs)


def _pending_email_jobs_query(*, now: datetime, limit: int) -> Select[tuple[EmailJobs]]:
    return (
        select(EmailJobs)
        .where(
            EmailJobs.status == EMAIL_JOB_STATUS_PENDING,
            EmailJobs.run_after <= now,
            EmailJobs.attempt_count < EmailJobs.max_attempts,
        )
        .order_by(EmailJobs.run_after.asc(), EmailJobs.created_at.asc())
        .limit(limit)
        .with_for_update(skip_locked=True)
    )


def claim_pending_email_jobs(
    db: Session,
    *,
    worker_id: str,
    limit: int,
    now: datetime | None = None,
) -> list[EmailJobs]:
    current_time = now or datetime.now(UTC)
    jobs = list(db.scalars(_pending_email_jobs_query(now=current_time, limit=limit)).all())

    for job in jobs:
        job.status = EMAIL_JOB_STATUS_PROCESSING
        job.locked_at = current_time
        job.locked_by = worker_id
        job.updated_at = current_time

    return jobs


def mark_email_job_sent(
    job: EmailJobs,
    *,
    now: datetime | None = None,
) -> None:
    current_time = now or datetime.now(UTC)
    job.status = EMAIL_JOB_STATUS_SENT
    job.locked_at = None
    job.locked_by = None
    job.last_error = None
    job.updated_at = current_time


def reschedule_email_job(
    job: EmailJobs,
    *,
    last_error: str,
    payload: dict[str, Any] | None = None,
    now: datetime | None = None,
) -> None:
    current_time = now or datetime.now(UTC)
    next_attempt_count = int(job.attempt_count or 0) + 1

    job.attempt_count = next_attempt_count
    job.last_error = last_error[:4000]
    job.locked_at = None
    job.locked_by = None
    job.updated_at = current_time
    if payload is not None:
        job.payload = payload

    if next_attempt_count >= int(job.max_attempts or EMAIL_JOB_MAX_ATTEMPTS):
        job.status = EMAIL_JOB_STATUS_FAILED
        return

    delay_minutes = min(5 * (2 ** (next_attempt_count - 1)), 6 * 60)
    job.status = EMAIL_JOB_STATUS_PENDING
    job.run_after = current_time + timedelta(minutes=delay_minutes)
