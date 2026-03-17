from __future__ import annotations

import re

from fastapi import HTTPException, status

TASK_NAME_MAX_LENGTH = 255
TASK_DESCRIPTION_MAX_LENGTH = 2000
HOUSEHOLD_NAME_MAX_LENGTH = 200
CATEGORY_NAME_MAX_LENGTH = 100

_SCRIPT_TAG_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL)
_STYLE_TAG_RE = re.compile(r"<style\b[^>]*>.*?</style>", re.IGNORECASE | re.DOTALL)
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def validate_required_name(value: str, *, field_name: str, max_length: int) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} is required",
        )
    if len(normalized) > max_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be {max_length} characters or fewer",
        )
    return normalized


def validate_optional_name(
    value: str | None,
    *,
    field_name: str,
    max_length: int,
) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    if len(normalized) > max_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be {max_length} characters or fewer",
        )
    return normalized


def sanitize_description(
    value: str | None,
    *,
    field_name: str = "Description",
    max_length: int = TASK_DESCRIPTION_MAX_LENGTH,
) -> str | None:
    if value is None:
        return None

    normalized = str(value).strip()
    if not normalized:
        return None
    if len(normalized) > max_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be {max_length} characters or fewer",
        )

    sanitized = _SCRIPT_TAG_RE.sub("", normalized)
    sanitized = _STYLE_TAG_RE.sub("", sanitized)
    sanitized = _HTML_TAG_RE.sub("", sanitized).strip()
    return sanitized or None
