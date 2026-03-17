import os
import unittest

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "30")
os.environ.setdefault("BACKEND_URL", "http://localhost:8000")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
os.environ.setdefault("FACEBOOK_CLIENT_ID", "test-facebook-client-id")
os.environ.setdefault("FACEBOOK_CLIENT_SECRET", "test-facebook-client-secret")
os.environ.setdefault("INSTAGRAM_CLIENT_ID", "test-instagram-client-id")
os.environ.setdefault("INSTAGRAM_CLIENT_SECRET", "test-instagram-client-secret")
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_MODEL", "test-model")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS", "test-fallback")
os.environ.setdefault("RESEND_API_KEY", "test-resend-key")
os.environ.setdefault("CONTACT_RECIPIENT_EMAIL", "test@example.com")
os.environ["CORS_ALLOW_ORIGINS"] = "https://allowed.example"

from fastapi.testclient import TestClient

from main import app


class CorsPolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_preflight_allows_configured_origin_with_explicit_methods_and_headers(self) -> None:
        response = self.client.options(
            "/api/v1/hello",
            headers={
                "Origin": "https://allowed.example",
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "Authorization, Content-Type",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            "https://allowed.example",
        )
        self.assertEqual(
            response.headers.get("access-control-allow-methods"),
            "GET, POST, PUT, DELETE, PATCH",
        )
        self.assertEqual(
            response.headers.get("access-control-allow-headers"),
            "Accept, Accept-Language, Authorization, Content-Language, Content-Type",
        )

    def test_preflight_blocks_unauthorized_origin(self) -> None:
        response = self.client.options(
            "/api/v1/hello",
            headers={
                "Origin": "https://blocked.example",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIsNone(response.headers.get("access-control-allow-origin"))


if __name__ == "__main__":
    unittest.main()
