import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import Request, Response


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "30")
os.environ.setdefault("BACKEND_URL", "https://api.example.net")
os.environ.setdefault("FRONTEND_URL", "https://app.example.com")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
os.environ.setdefault("FACEBOOK_CLIENT_ID", "test-facebook-client-id")
os.environ.setdefault("FACEBOOK_CLIENT_SECRET", "test-facebook-client-secret")
os.environ.setdefault("INSTAGRAM_CLIENT_ID", "test-instagram-client-id")
os.environ.setdefault("INSTAGRAM_CLIENT_SECRET", "test-instagram-client-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/test_db")
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_MODEL", "test-model")
os.environ.setdefault("OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS", "test-fallback")
os.environ.setdefault("RESEND_API_KEY", "test-resend-key")
os.environ.setdefault("CONTACT_RECIPIENT_EMAIL", "test@example.com")
os.environ.setdefault("SESSION_COOKIE_SAMESITE", "lax")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

from routers.login import service  # noqa: E402


def _request(*, scheme: str, host: str) -> Request:
    return Request(
        {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "scheme": scheme,
            "method": "GET",
            "path": "/api/v1/auth/google/callback",
            "raw_path": b"/api/v1/auth/google/callback",
            "query_string": b"",
            "headers": [(b"host", host.encode("ascii"))],
            "client": ("127.0.0.1", 12345),
            "server": (host, 443 if scheme == "https" else 80),
        }
    )


class AuthCookiePolicyTests(unittest.TestCase):
    def test_cross_origin_https_auth_cookie_uses_none_and_secure(self) -> None:
        response = Response()

        with patch.object(service, "FRONTEND_URL", "https://app.example.com"):
            with patch.object(service, "BACKEND_URL", "https://api.example.net"):
                service.set_auth_cookies(
                    response,
                    request=_request(scheme="https", host="api.example.net"),
                    access_token="access-token",
                    refresh_token="refresh-token",
                )

        set_cookie_headers = response.headers.getlist("set-cookie")
        self.assertEqual(len(set_cookie_headers), 2)
        self.assertTrue(
            all("samesite=none" in header.lower() for header in set_cookie_headers)
        )
        self.assertTrue(all("secure" in header.lower() for header in set_cookie_headers))

    def test_same_origin_http_auth_cookie_keeps_lax_without_secure(self) -> None:
        response = Response()

        with patch.object(service, "FRONTEND_URL", "http://localhost:8000"):
            with patch.object(service, "BACKEND_URL", "http://localhost:8000"):
                service.set_auth_cookies(
                    response,
                    request=_request(scheme="http", host="localhost:8000"),
                    access_token="access-token",
                    refresh_token="refresh-token",
                )

        set_cookie_headers = response.headers.getlist("set-cookie")
        self.assertEqual(len(set_cookie_headers), 2)
        self.assertTrue(
            all("samesite=lax" in header.lower() for header in set_cookie_headers)
        )
        self.assertTrue(
            all("secure" not in header.lower() for header in set_cookie_headers)
        )

    def test_localhost_different_port_keeps_lax_without_secure(self) -> None:
        response = Response()

        with patch.object(service, "FRONTEND_URL", "http://localhost:5173"):
            with patch.object(service, "BACKEND_URL", "http://localhost:8000"):
                service.set_auth_cookies(
                    response,
                    request=_request(scheme="http", host="localhost:8000"),
                    access_token="access-token",
                    refresh_token="refresh-token",
                )

        set_cookie_headers = response.headers.getlist("set-cookie")
        self.assertEqual(len(set_cookie_headers), 2)
        self.assertTrue(
            all("samesite=lax" in header.lower() for header in set_cookie_headers)
        )
        self.assertTrue(
            all("secure" not in header.lower() for header in set_cookie_headers)
        )


if __name__ == "__main__":
    unittest.main()
