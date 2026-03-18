from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.v1.helpers import get_session_local
logger = logging.getLogger(__name__)

AI_CACHE_RETENTION_DAYS = 30
AI_CACHE_CLEANUP_INTERVAL_SECONDS = 24 * 60 * 60
AI_CACHE_TABLES = (
    "analytics_ai_insights_cache",
    "analytics_ai_questions_cache",
    "goal_ai_checkins_cache",
)


def run_ai_cache_maintenance_once() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=AI_CACHE_RETENTION_DAYS)
    session_local = get_session_local()

    with session_local() as db:
        try:
            stats_before = _collect_cache_table_stats(db)
            deleted_rows = _delete_expired_cache_rows(db, cutoff=cutoff)
            db.commit()
            stats_after = _collect_cache_table_stats(db)
        except SQLAlchemyError:
            db.rollback()
            logger.exception("AI cache maintenance failed")
            return

    logger.info(
        "AI cache maintenance completed: cutoff=%s deleted=%s stats_before=%s stats_after=%s",
        cutoff.isoformat(),
        deleted_rows,
        stats_before,
        stats_after,
    )


def _delete_expired_cache_rows(db, *, cutoff: datetime) -> dict[str, int]:
    deleted_rows: dict[str, int] = {}

    for table_name in AI_CACHE_TABLES:
        result = db.execute(
            text(f"DELETE FROM {table_name} WHERE created_at < :cutoff"),
            {"cutoff": cutoff},
        )
        deleted_rows[table_name] = result.rowcount or 0

    return deleted_rows


def _collect_cache_table_stats(db) -> dict[str, dict[str, int | None]]:
    stats: dict[str, dict[str, int | None]] = {}

    for table_name in AI_CACHE_TABLES:
        row_count = db.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar_one()
        size_bytes: int | None
        try:
            size_bytes = db.execute(
                text("SELECT pg_total_relation_size(:table_name)"),
                {"table_name": table_name},
            ).scalar_one()
        except SQLAlchemyError:
            size_bytes = None

        stats[table_name] = {
            "row_count": int(row_count or 0),
            "size_bytes": int(size_bytes) if size_bytes is not None else None,
        }

    return stats


async def run_ai_cache_maintenance_loop() -> None:
    while True:
        await asyncio.to_thread(run_ai_cache_maintenance_once)
        await asyncio.sleep(AI_CACHE_CLEANUP_INTERVAL_SECONDS)


async def stop_background_task(task: asyncio.Task[None] | None) -> None:
    if task is None:
        return
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
