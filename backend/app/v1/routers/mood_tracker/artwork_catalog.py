from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MoodTrackerArtworkDefinition:
    image_id: str
    period_type: str
    day_count: int
    cycle_order: int
    region_ids: list[str]
    source: str = "static"
    svg_markup: str | None = None


def _build_region_ids(period_type: str, day_count: int) -> list[str]:
    prefix = "week" if period_type == "weekly" else "month"
    return [f"{prefix}-region-{index + 1}" for index in range(day_count)]


def _catalog_entries() -> list[MoodTrackerArtworkDefinition]:
    weekly_day_count = 7
    monthly_day_counts = (28, 29, 30, 31)

    entries = [
        MoodTrackerArtworkDefinition(
            image_id="weekly-bloom",
            period_type="weekly",
            day_count=weekly_day_count,
            cycle_order=0,
            region_ids=_build_region_ids("weekly", weekly_day_count),
        ),
        MoodTrackerArtworkDefinition(
            image_id="weekly-butterfly",
            period_type="weekly",
            day_count=weekly_day_count,
            cycle_order=1,
            region_ids=_build_region_ids("weekly", weekly_day_count),
        ),
        MoodTrackerArtworkDefinition(
            image_id="weekly-cactus",
            period_type="weekly",
            day_count=weekly_day_count,
            cycle_order=2,
            region_ids=_build_region_ids("weekly", weekly_day_count),
        ),
        MoodTrackerArtworkDefinition(
            image_id="weekly-seaside",
            period_type="weekly",
            day_count=weekly_day_count,
            cycle_order=3,
            region_ids=_build_region_ids("weekly", weekly_day_count),
        ),
    ]

    monthly_image_ids = (
        "monthly-mosaic",
        "monthly-garden",
        "monthly-lanterns",
    )
    for day_count in monthly_day_counts:
        region_ids = _build_region_ids("monthly", day_count)
        for cycle_order, image_id in enumerate(monthly_image_ids):
            entries.append(
                MoodTrackerArtworkDefinition(
                    image_id=image_id,
                    period_type="monthly",
                    day_count=day_count,
                    cycle_order=cycle_order,
                    region_ids=region_ids,
                )
            )

    return entries


MOOD_TRACKER_ARTWORK_CATALOG = _catalog_entries()


def list_mood_tracker_artworks(period_type: str, day_count: int) -> list[MoodTrackerArtworkDefinition]:
    return [
        artwork
        for artwork in MOOD_TRACKER_ARTWORK_CATALOG
        if artwork.period_type == period_type and artwork.day_count == day_count
    ]


def get_mood_tracker_artwork(
    *,
    period_type: str,
    day_count: int,
    cycle_slot: int,
) -> MoodTrackerArtworkDefinition | None:
    artworks = list_mood_tracker_artworks(period_type, day_count)
    if not artworks:
        return None

    return artworks[cycle_slot % len(artworks)]
