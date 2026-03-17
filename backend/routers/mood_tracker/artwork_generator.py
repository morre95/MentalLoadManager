from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import hashlib
import logging
from math import cos, pi, sin
import re
import random
import time as time_module
import xml.etree.ElementTree as ET

import requests

from config import settings

SVG_NAMESPACE = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NAMESPACE)

WEEKLY_VARIANTS = ("orbit", "petals", "stones")
MONTHLY_VARIANTS = ("tiles", "lanterns", "blooms")
WEEKLY_THEME_IDS = ("weekly-bloom", "weekly-butterfly", "weekly-cactus", "weekly-seaside")
MONTHLY_THEME_IDS = ("monthly-garden", "monthly-lanterns")
WEEKLY_SUBJECTS = (
    "a flower bouquet with seven distinct petals or blooms",
    "a butterfly with seven meaningful wing segments and markings",
    "a cactus in a pot with seven meaningful sections",
    "a seaside scene with seven shells or beach objects",
    "a fruit bowl with seven distinct fruits or slices",
    "a kite mobile with seven hanging pieces",
    "a bookshelf vignette with seven books or objects",
)
MONTHLY_SUBJECTS = (
    "a lantern festival scene with one lantern per day",
    "a flower garden with one bloom per day",
    "a cozy shelf display with one object per day",
    "a window box garden with one bloom or leaf cluster per day",
    "a fruit crate collection with one fruit tile per day",
)
DEFAULT_OPENROUTER_MODEL = "openrouter/free"
OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"
ALLOWED_SVG_TAGS = {
    "svg",
    "defs",
    "g",
    "rect",
    "circle",
    "ellipse",
    "path",
    "line",
    "polyline",
    "polygon",
    "linearGradient",
    "radialGradient",
    "stop",
}
ALLOWED_EVENT_ATTR_PREFIXES = ("on",)
PROMPT_VERSION = "mood-artwork-ai-v2"

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GeneratedMoodArtwork:
    image_id: str
    source: str
    svg_markup: str
    region_ids: list[str]
    prompt_version: str | None = PROMPT_VERSION


def _seed_for_period(period_key: str, period_type: str) -> int:
    digest = hashlib.sha256(f"{period_type}:{period_key}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], byteorder="big", signed=False)


def _period_key_for_date(period_type: str, current_date: date) -> str:
    if period_type == "weekly":
        iso_year, iso_week, _ = current_date.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    return f"{current_date.year}-{current_date.month:02d}"


def _select_variant(period_type: str, start_date: date, period_key: str, seed: int) -> str:
    variants = WEEKLY_VARIANTS if period_type == "weekly" else MONTHLY_VARIANTS
    variant_index = seed % len(variants)

    if period_type == "weekly":
        previous_key = _period_key_for_date(period_type, start_date - date.resolution * 7)
        previous_seed = _seed_for_period(previous_key, period_type)
        previous_index = previous_seed % len(variants)
        if previous_index == variant_index:
            variant_index = (variant_index + 1) % len(variants)

    return variants[variant_index]


def _select_subject(period_type: str, seed: int) -> str:
    subjects = WEEKLY_SUBJECTS if period_type == "weekly" else MONTHLY_SUBJECTS
    return subjects[seed % len(subjects)]


def _svg_root(view_box: str) -> ET.Element:
    return ET.Element(
        f"{{{SVG_NAMESPACE}}}svg",
        {
            "viewBox": view_box,
            "fill": "none",
            "role": "img",
            "aria-label": "Mood artwork",
        },
    )


def _append(parent: ET.Element, tag: str, **attributes: str) -> ET.Element:
    return ET.SubElement(parent, f"{{{SVG_NAMESPACE}}}{tag}", attributes)


def _region_attrs(region_id: str) -> dict[str, str]:
    return {
        "id": region_id,
        "data-region-id": region_id,
        "fill": "var(--mood-region-fill, rgba(148, 163, 184, 0.28))",
        "stroke": "var(--mood-region-stroke, rgba(71, 85, 105, 0.55))",
        "stroke-width": "2.5",
        "vector-effect": "non-scaling-stroke",
        "style": "transition: fill 160ms ease, stroke 160ms ease, stroke-width 160ms ease;",
    }


def _serialize_svg(root: ET.Element) -> str:
    return ET.tostring(root, encoding="unicode")


def _parse_model_list(raw_value: str) -> list[str]:
    return [item.strip() for item in str(raw_value or "").split(",") if item.strip()]


def _load_model_candidates() -> list[str]:
    primary = (
        settings.OPENROUTER_MOOD_ARTWORK_MODEL
        or settings.OPENROUTER_WEEKLY_SUMMARY_MODEL
        or DEFAULT_OPENROUTER_MODEL
    )
    fallbacks = _parse_model_list(settings.OPENROUTER_MOOD_ARTWORK_FALLBACK_MODELS)
    if not fallbacks:
        fallbacks = _parse_model_list(settings.OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS)

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
            if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "\n".join(parts).strip()

    return ""


def _extract_svg_block(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3 and lines[-1].startswith("```"):
            text = "\n".join(lines[1:-1]).strip()

    match = re.search(r"<svg\b[\s\S]*?</svg>", text, re.IGNORECASE)
    return match.group(0).strip() if match else text


def _parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_retry_after_seconds(response: requests.Response) -> float:
    retry_after = response.headers.get("Retry-After")
    try:
        return max(float(retry_after), 0.5) if retry_after else 1.5
    except ValueError:
        return 1.5


def _generate_weekly_orbit(region_ids: list[str], rng: random.Random) -> ET.Element:
    root = _svg_root("0 0 320 320")
    _append(root, "rect", x="8", y="8", width="304", height="304", rx="28", fill="#edf7f4")
    _append(root, "circle", cx="160", cy="160", r="90", fill="#f9efe7")
    _append(root, "circle", cx="160", cy="160", r="24", fill="#f4d6c7")
    _append(root, "path", d="M60 98 Q160 28 260 98", stroke="#94b8ab", **{"stroke-width": "4", "stroke-linecap": "round"})

    base_radius = 104
    for index, region_id in enumerate(region_ids):
        angle = ((2 * pi) / len(region_ids)) * index - pi / 2
        cx = 160 + cos(angle) * base_radius
        cy = 160 + sin(angle) * base_radius
        rx = 26 + rng.randint(-3, 4)
        ry = 20 + rng.randint(-3, 4)
        attrs = _region_attrs(region_id)
        attrs.update(
            {
                "cx": f"{cx:.2f}",
                "cy": f"{cy:.2f}",
                "rx": str(rx),
                "ry": str(ry),
                "transform": f"rotate({rng.randint(-24, 24)} {cx:.2f} {cy:.2f})",
            }
        )
        _append(root, "ellipse", **attrs)

    return root


def _generate_weekly_petals(region_ids: list[str], rng: random.Random) -> ET.Element:
    root = _svg_root("0 0 320 320")
    _append(root, "rect", x="8", y="8", width="304", height="304", rx="28", fill="#eef2ff")
    _append(root, "circle", cx="160", cy="160", r="34", fill="#f6eadf", stroke="#b58a74", **{"stroke-width": "3"})
    _append(root, "path", d="M160 194 Q160 246 160 284", stroke="#88a98d", **{"stroke-width": "6", "stroke-linecap": "round"})

    for index, region_id in enumerate(region_ids):
        angle = (360 / len(region_ids)) * index
        attrs = _region_attrs(region_id)
        attrs.update(
            {
                "cx": "160",
                "cy": "92",
                "rx": str(28 + rng.randint(-2, 3)),
                "ry": str(56 + rng.randint(-4, 4)),
                "transform": f"rotate({angle} 160 160)",
            }
        )
        _append(root, "ellipse", **attrs)

    return root


def _generate_weekly_stones(region_ids: list[str], rng: random.Random) -> ET.Element:
    root = _svg_root("0 0 320 320")
    _append(root, "rect", x="8", y="8", width="304", height="304", rx="28", fill="#eaf5fb")
    _append(root, "path", d="M28 236 Q108 190 174 220 T292 208 L292 286 L28 286 Z", fill="#f2e4d7")

    centers = [
        (74, 210), (118, 164), (160, 224), (202, 156), (244, 214), (116, 92), (208, 88)
    ]
    for region_id, (cx, cy) in zip(region_ids, centers, strict=False):
        attrs = _region_attrs(region_id)
        attrs.update(
            {
                "cx": str(cx),
                "cy": str(cy),
                "rx": str(26 + rng.randint(-4, 4)),
                "ry": str(18 + rng.randint(-3, 3)),
                "transform": f"rotate({rng.randint(-26, 26)} {cx} {cy})",
            }
        )
        _append(root, "ellipse", **attrs)

    return root


def _generate_monthly_tiles(region_ids: list[str], rng: random.Random) -> ET.Element:
    root = _svg_root("0 0 360 320")
    _append(root, "rect", x="8", y="8", width="344", height="304", rx="24", fill="#f8efe3")
    columns = 6 if len(region_ids) > 30 else 5
    tile_width = 50
    tile_height = 42
    horizontal_gap = 10
    vertical_gap = 12
    start_x = 18
    start_y = 18

    for index, region_id in enumerate(region_ids):
        column = index % columns
        row = index // columns
        x = start_x + column * (tile_width + horizontal_gap)
        y = start_y + row * (tile_height + vertical_gap) + (column % 2) * 6
        rotate = ((index % 4) - 1.5) * 2.2
        attrs = _region_attrs(region_id)
        attrs.update(
            {
                "x": str(x),
                "y": str(y),
                "width": str(tile_width),
                "height": str(tile_height),
                "rx": str(10 + rng.randint(-1, 1)),
                "transform": f"rotate({rotate:.2f} {x + tile_width / 2:.2f} {y + tile_height / 2:.2f})",
            }
        )
        _append(root, "rect", **attrs)

    return root


def _generate_monthly_lanterns(region_ids: list[str], rng: random.Random) -> ET.Element:
    root = _svg_root("0 0 360 320")
    _append(root, "rect", x="8", y="8", width="344", height="304", rx="24", fill="#f3f0eb")
    _append(root, "path", d="M24 42 H336", stroke="#51606b", **{"stroke-width": "4", "stroke-linecap": "round"})
    columns = 6 if len(region_ids) > 30 else 5
    start_x = 36
    spacing_x = 54
    start_y = 54
    spacing_y = 48

    for index, region_id in enumerate(region_ids):
        column = index % columns
        row = index // columns
        x = start_x + column * spacing_x
        y = start_y + row * spacing_y
        drop_y = y - 18 - ((index + column) % 3) * 5
        _append(root, "path", d=f"M{x} 42 L{x} {drop_y}", stroke="#6c7a83", **{"stroke-width": "2"})

        attrs = _region_attrs(region_id)
        attrs.update(
            {
                "x": str(x - 15),
                "y": str(y - 6),
                "width": "30",
                "height": "36",
                "rx": str(10 + rng.randint(-1, 2)),
            }
        )
        _append(root, "rect", **attrs)
        _append(root, "path", d=f"M{x - 8} {y + 10} H{x + 8} M{x - 8} {y + 20} H{x + 8}", stroke="#fffaf6", **{"stroke-width": "2", "stroke-linecap": "round"})

    return root


def _generate_monthly_blooms(region_ids: list[str], rng: random.Random) -> ET.Element:
    root = _svg_root("0 0 360 320")
    _append(root, "rect", x="8", y="8", width="344", height="304", rx="24", fill="#edf7f4")
    _append(root, "path", d="M12 260 Q90 228 170 246 T348 238 L348 310 L12 310 Z", fill="#dbe7d8")
    columns = 6 if len(region_ids) > 30 else 5
    start_x = 34
    spacing_x = 56
    start_y = 72
    spacing_y = 46

    for index, region_id in enumerate(region_ids):
        column = index % columns
        row = index // columns
        x = start_x + column * spacing_x
        y = start_y + row * spacing_y + (column % 2) * 10
        _append(root, "path", d=f"M{x} {y + 16} Q{x} {y + 34}, {x} {y + 52}", stroke="#7da48a", **{"stroke-width": "3", "stroke-linecap": "round"})
        _append(root, "ellipse", cx=str(x - 7), cy=str(y + 32), rx="7", ry="4", fill="#8db596", transform=f"rotate(-28 {x - 7} {y + 32})")
        _append(root, "ellipse", cx=str(x + 7), cy=str(y + 26), rx="7", ry="4", fill="#8db596", transform=f"rotate(28 {x + 7} {y + 26})")

        attrs = _region_attrs(region_id)
        attrs.update(
            {
                "cx": str(x),
                "cy": str(y),
                "r": str(14 + rng.randint(-1, 2)),
            }
        )
        _append(root, "circle", **attrs)

    return root


def _generate_ai_mood_artwork(
    *,
    period_type: str,
    period_key: str,
    start_date: date,
    end_date: date,
    region_ids: list[str],
) -> GeneratedMoodArtwork:
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    view_box = "0 0 320 320" if period_type == "weekly" else "0 0 360 320"
    region_count = len(region_ids)
    seed = _seed_for_period(period_key, period_type)
    subject = _select_subject(period_type, seed)
    system_prompt = (
        "You generate compact, valid SVG artwork for a mood tracker. "
        "Return only raw SVG markup. "
        "The SVG must be valid XML and safe. "
        "Do not include markdown fences, explanations, scripts, stylesheets, text nodes, images, foreignObject, or external references. "
        "Every fillable mood region must use exactly the required data-region-id values and must be one of these SVG shapes only: rect, circle, ellipse, or path."
    )
    user_prompt = (
        f"Create a fresh {period_type} mood tracker illustration for period {period_key}.\n"
        f"Canvas viewBox: {view_box}\n"
        f"Exact region count: {region_count}\n"
        f"Exact ordered region ids: {', '.join(region_ids)}\n"
        "Requirements:\n"
        "- Use the exact region ids once each, in the exact order listed.\n"
        "- Put each fillable region directly on the SVG element using data-region-id and id.\n"
        "- Each fillable region must have a visible border and should fit fully inside the canvas.\n"
        "- Make the overall illustration visually distinct and decorative for this specific period.\n"
        "- The result must read as a recognizable illustration, not an abstract chart or placeholder geometry.\n"
        "- Avoid dot grids, bubble charts, constellations, confetti, simple rows of circles, and generic abstract layouts.\n"
        "- For weekly artwork, design one coherent subject or small scene with seven meaningful fillable parts.\n"
        "- For monthly artwork, design a coherent collection or field of meaningful objects.\n"
        f"- Required subject direction for this period: {subject}.\n"
        "- Keep enough spacing so each region is clickable.\n"
        "- Use a soft household-app aesthetic.\n"
        "- Non-interactive decorative shapes are allowed.\n"
        "- No CSS classes. Inline SVG attributes only.\n"
        "- The root must be a single <svg> element with the requested viewBox.\n"
        f"Period dates: {start_date.isoformat()} to {end_date.isoformat()}\n"
    )

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    response = None
    failures: list[str] = []
    selected_model = None

    for candidate_model in _load_model_candidates():
        selected_model = candidate_model
        for attempt in range(2):
            try:
                response = requests.post(
                    OPENROUTER_CHAT_COMPLETIONS_URL,
                    headers=headers,
                    json={
                        "model": candidate_model,
                        "temperature": 0.9,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    },
                    timeout=60,
                )
            except requests.RequestException as exc:
                failures.append(f"{candidate_model}: network error ({exc})")
                break

            if response.status_code == 429 and attempt == 0:
                failures.append(f"{candidate_model}: rate limited")
                time_module.sleep(_parse_retry_after_seconds(response))
                continue

            if response.ok:
                break

            failures.append(f"{candidate_model}: {response.status_code} {response.text[:120]}")
            break

        if response is not None and response.ok:
            break

    if response is None or not response.ok:
        raise ValueError("AI mood artwork request failed" if not failures else " | ".join(failures))

    raw_text = _extract_text_content(response.json())
    if not raw_text:
        raise ValueError("AI mood artwork response did not contain text")

    svg_markup = _extract_svg_block(raw_text)
    validate_generated_svg(svg_markup, region_ids, period_type=period_type)
    return GeneratedMoodArtwork(
        image_id=f"{period_type}-ai-{period_key}",
        source="ai",
        svg_markup=svg_markup,
        region_ids=region_ids,
        prompt_version=PROMPT_VERSION,
    )


def validate_generated_svg(svg_markup: str, region_ids: list[str], *, period_type: str | None = None) -> None:
    try:
        root = ET.fromstring(svg_markup)
    except ET.ParseError as exc:
        raise ValueError("Generated SVG is not valid XML") from exc

    discovered_region_ids: list[str] = []
    region_elements: list[ET.Element] = []
    root_tag_name = root.tag.split("}", 1)[-1]
    if root_tag_name != "svg":
        raise ValueError("Generated SVG root element must be svg")
    if not root.attrib.get("viewBox"):
        raise ValueError("Generated SVG must include a viewBox")

    for element in root.iter():
        tag_name = element.tag.split("}", 1)[-1]
        if tag_name not in ALLOWED_SVG_TAGS:
            raise ValueError(f"Generated SVG contains disallowed tag: {tag_name}")
        for attr_name in element.attrib:
            lowered_name = attr_name.lower()
            if any(lowered_name.startswith(prefix) for prefix in ALLOWED_EVENT_ATTR_PREFIXES):
                raise ValueError("Generated SVG contains disallowed event handlers")
            if lowered_name in {"href", "xlink:href"}:
                raise ValueError("Generated SVG contains disallowed external references")
        region_id = element.attrib.get("data-region-id")
        if region_id:
            discovered_region_ids.append(region_id)
            region_elements.append(element)

    if discovered_region_ids != region_ids:
        raise ValueError("Generated SVG region ids do not match the expected period layout")

    if period_type == "weekly":
        tiny_circle_like_count = 0
        for element in region_elements:
            tag_name = element.tag.split("}", 1)[-1]
            if tag_name == "circle":
                radius = _parse_float(element.attrib.get("r"))
                if radius is not None and radius < 20:
                    tiny_circle_like_count += 1
            elif tag_name == "ellipse":
                rx = _parse_float(element.attrib.get("rx"))
                ry = _parse_float(element.attrib.get("ry"))
                if rx is not None and ry is not None and rx < 22 and ry < 22:
                    tiny_circle_like_count += 1

        if tiny_circle_like_count >= max(4, len(region_ids) - 1):
            raise ValueError("Generated weekly SVG is too abstract; most fillable regions are tiny dots")


def generate_procedural_mood_artwork(
    *,
    period_type: str,
    period_key: str,
    start_date: date,
    end_date: date,
) -> GeneratedMoodArtwork:
    region_count = (end_date - start_date).days + 1
    prefix = "week" if period_type == "weekly" else "month"
    region_ids = [f"{prefix}-region-{index + 1}" for index in range(region_count)]
    seed = _seed_for_period(period_key, period_type)
    theme_ids = WEEKLY_THEME_IDS if period_type == "weekly" else MONTHLY_THEME_IDS
    variant = theme_ids[seed % len(theme_ids)]

    return GeneratedMoodArtwork(
        image_id=variant,
        source="procedural",
        svg_markup="",
        region_ids=region_ids,
    )


def generate_mood_artwork(
    *,
    period_type: str,
    period_key: str,
    start_date: date,
    end_date: date,
) -> GeneratedMoodArtwork:
    region_count = (end_date - start_date).days + 1
    prefix = "week" if period_type == "weekly" else "month"
    region_ids = [f"{prefix}-region-{index + 1}" for index in range(region_count)]

    try:
        return _generate_ai_mood_artwork(
            period_type=period_type,
            period_key=period_key,
            start_date=start_date,
            end_date=end_date,
            region_ids=region_ids,
        )
    except Exception as exc:
        logger.warning("Falling back to procedural mood artwork for %s %s: %s", period_type, period_key, exc)
        return generate_procedural_mood_artwork(
            period_type=period_type,
            period_key=period_key,
            start_date=start_date,
            end_date=end_date,
        )
