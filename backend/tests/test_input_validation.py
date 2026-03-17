from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

from fastapi import HTTPException


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "60")
os.environ.setdefault("BACKEND_URL", "http://localhost:8000")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
os.environ.setdefault("FACEBOOK_CLIENT_ID", "test-facebook-client-id")
os.environ.setdefault("FACEBOOK_CLIENT_SECRET", "test-facebook-client-secret")
os.environ.setdefault("INSTAGRAM_CLIENT_ID", "test-instagram-client-id")
os.environ.setdefault("INSTAGRAM_CLIENT_SECRET", "test-facebook-client-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/test_db")
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_MODEL", "test-model")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS", "test-fallback")

from routers.input_validation import (  # noqa: E402
    CATEGORY_NAME_MAX_LENGTH,
    HOUSEHOLD_NAME_MAX_LENGTH,
    TASK_NAME_MAX_LENGTH,
    sanitize_description,
    validate_required_name,
)


class InputValidationTests(unittest.TestCase):
    def test_required_name_rejects_blank_after_trimming(self) -> None:
        with self.assertRaises(HTTPException) as exc_info:
            validate_required_name(
                "   ",
                field_name="Task name",
                max_length=TASK_NAME_MAX_LENGTH,
            )

        self.assertEqual(exc_info.exception.status_code, 400)
        self.assertEqual(exc_info.exception.detail, "Task name is required")

    def test_required_name_rejects_task_name_longer_than_255_characters(self) -> None:
        with self.assertRaises(HTTPException) as exc_info:
            validate_required_name(
                "x" * (TASK_NAME_MAX_LENGTH + 1),
                field_name="Task name",
                max_length=TASK_NAME_MAX_LENGTH,
            )

        self.assertEqual(exc_info.exception.status_code, 400)
        self.assertEqual(
            exc_info.exception.detail,
            f"Task name must be {TASK_NAME_MAX_LENGTH} characters or fewer",
        )

    def test_required_name_rejects_household_name_above_model_limit(self) -> None:
        with self.assertRaises(HTTPException) as exc_info:
            validate_required_name(
                "x" * (HOUSEHOLD_NAME_MAX_LENGTH + 1),
                field_name="Household name",
                max_length=HOUSEHOLD_NAME_MAX_LENGTH,
            )

        self.assertEqual(exc_info.exception.status_code, 400)
        self.assertEqual(
            exc_info.exception.detail,
            f"Household name must be {HOUSEHOLD_NAME_MAX_LENGTH} characters or fewer",
        )

    def test_required_name_rejects_category_name_above_model_limit(self) -> None:
        with self.assertRaises(HTTPException) as exc_info:
            validate_required_name(
                "x" * (CATEGORY_NAME_MAX_LENGTH + 1),
                field_name="Category name",
                max_length=CATEGORY_NAME_MAX_LENGTH,
            )

        self.assertEqual(exc_info.exception.status_code, 400)
        self.assertEqual(
            exc_info.exception.detail,
            f"Category name must be {CATEGORY_NAME_MAX_LENGTH} characters or fewer",
        )

    def test_sanitize_description_removes_script_and_html_tags(self) -> None:
        sanitized = sanitize_description(
            "  <script>alert('x')</script><p>Hello <strong>world</strong></p>  "
        )

        self.assertEqual(sanitized, "Hello world")


if __name__ == "__main__":
    unittest.main()
