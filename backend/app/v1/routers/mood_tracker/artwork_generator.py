from __future__ import annotations

from dataclasses import dataclass
from datetime import date


WEEKLY_THEME_IDS = (
    "weekly-bloom",
    "weekly-butterfly",
    "weekly-cactus",
    "weekly-seaside",
)
MONTHLY_THEME_IDS = ("monthly-garden", "monthly-lanterns")


@dataclass(frozen=True)
class GeneratedMoodArtwork:
    image_id: str
    source: str
    svg_markup: str
    region_ids: list[str]
    prompt_version: str | None = None


def _period_region_ids(period_type: str, start_date: date, end_date: date) -> list[str]:
    region_count = (end_date - start_date).days + 1
    prefix = "week" if period_type == "weekly" else "month"
    return [f"{prefix}-region-{index + 1}" for index in range(region_count)]


def _cycle_theme_id(period_type: str, start_date: date) -> str:
    theme_ids = WEEKLY_THEME_IDS if period_type == "weekly" else MONTHLY_THEME_IDS
    if period_type == "weekly":
        epoch_monday = date(1970, 1, 5)
        elapsed_periods = (start_date - epoch_monday).days // 7
    else:
        elapsed_periods = (start_date.year * 12) + (start_date.month - 1)
    return theme_ids[elapsed_periods % len(theme_ids)]


def generate_procedural_mood_artwork(
    *,
    period_type: str,
    period_key: str,
    start_date: date,
    end_date: date,
) -> GeneratedMoodArtwork:
    return GeneratedMoodArtwork(
        image_id=_cycle_theme_id(period_type, start_date),
        source="procedural",
        svg_markup="",
        region_ids=_period_region_ids(period_type, start_date, end_date),
    )
