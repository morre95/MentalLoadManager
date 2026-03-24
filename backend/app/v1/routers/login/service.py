import base64
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal, cast
from urllib.parse import urlencode
from uuid import UUID, uuid4

import jwt
import requests
from fastapi import HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy import select

from app.v1.helpers import (
    ALGORITHM,
    SECRET_KEY,
    authenticate_user,
    create_access_token,
    get_session_local,
)
from app.v1.models import LoginAttempt, PasswordRefreshToken, Token, UserDB

from .repository import (
    find_user,
    get_login_attempt,
    get_oauth_account,
    get_oauth_account_by_provider_user_id,
    get_user_by_username,
)
from .schemas import RefreshTokenRequest
from app.v1.config import settings

ACCESS_TOKEN_EXPIRE_MINUTES = settings.JWT_EXPIRE_MINUTES or 30  # 1440 min = 24h
REFRESH_TOKEN_EXPIRE_DAYS = 30
LOGIN_FAILURE_LIMIT = 5
CAPTCHA_THRESHOLD = 3
LOCKOUT_WINDOW_MINUTES = 15

logger = logging.getLogger(__name__)

FRONTEND_URL = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")
BACKEND_URL = (settings.BACKEND_URL or "").rstrip("/")
ACCESS_TOKEN_COOKIE_KEY = "access_token"
REFRESH_TOKEN_COOKIE_KEY = "refresh_token"
AUTH_COOKIE_SECURE = settings.SESSION_COOKIE_SECURE
AUTH_COOKIE_SAMESITE = (settings.SESSION_COOKIE_SAMESITE or "lax").strip().lower()
if AUTH_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    AUTH_COOKIE_SAMESITE = "lax"
AUTH_COOKIE_SAMESITE_VALUE = cast(
    Literal["lax", "strict", "none"], AUTH_COOKIE_SAMESITE
)
ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS = int(ACCESS_TOKEN_EXPIRE_MINUTES * 60)
REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS = int(REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60)
REDIRECT_URIS_BY_PROVIDER = {
    "google": (settings.GOOGLE_REDIRECT_URI or "").rstrip("/"),
}

SETTINGS_VALUES_BY_NAME = {
    "GOOGLE_CLIENT_ID": settings.GOOGLE_CLIENT_ID,
    "GOOGLE_CLIENT_SECRET": settings.GOOGLE_CLIENT_SECRET,
    "FACEBOOK_CLIENT_ID": settings.FACEBOOK_CLIENT_ID,
    "FACEBOOK_CLIENT_SECRET": settings.FACEBOOK_CLIENT_SECRET,
    "INSTAGRAM_CLIENT_ID": settings.INSTAGRAM_CLIENT_ID,
    "INSTAGRAM_CLIENT_SECRET": settings.INSTAGRAM_CLIENT_SECRET,
}


def _oauth_state_session_key(provider: str) -> str:
    return f"oauth_state_nonce:{provider}"


def _oauth_pkce_verifier_session_key(provider: str) -> str:
    return f"oauth_pkce_verifier:{provider}"


def _create_pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("utf-8")).digest())
        .rstrip(b"=")
        .decode("ascii")
    )
    return verifier, challenge


def create_oauth_state(request: Request, provider: str) -> str:
    nonce = secrets.token_urlsafe(16)
    request.session[_oauth_state_session_key(provider)] = nonce
    payload = {
        "provider": provider,
        "nonce": nonce,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_oauth_state(request: Request, state: str, expected_provider: str) -> None:
    try:
        payload = jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("provider") != expected_provider:
            raise ValueError("Provider mismatch")
        state_nonce = payload.get("nonce")
        expected_nonce = request.session.pop(
            _oauth_state_session_key(expected_provider), None
        )
        if (
            not isinstance(state_nonce, str)
            or not isinstance(expected_nonce, str)
            or not secrets.compare_digest(state_nonce, expected_nonce)
        ):
            raise ValueError("State nonce mismatch")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state",
        ) from exc


def oauth_redirect_uri(request: Request, provider: str) -> str:
    provider_redirect_uri = REDIRECT_URIS_BY_PROVIDER.get(provider, "")
    if provider_redirect_uri:
        return provider_redirect_uri

    if BACKEND_URL:
        return f"{BACKEND_URL}/api/v1/auth/{provider}/callback"

    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")
    if forwarded_proto and forwarded_host:
        proto = forwarded_proto.split(",")[0].strip()
        host = forwarded_host.split(",")[0].strip()
        return f"{proto}://{host}/api/v1/auth/{provider}/callback"

    return str(request.url_for(f"callback_{provider}"))


def issue_login_redirect(username: str, request: Request) -> RedirectResponse:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    try:
        with session_local() as db:
            user = get_user_by_username(db, username)
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Could not issue login token for user",
                )

            token_subject = str(user.user_id)
            access_token = create_access_token(
                subject=token_subject,
                expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
            )
            _, raw_refresh_token = _issue_password_refresh_token(
                db,
                user_id=user.user_id,
                family_id=uuid4(),
                request=request,
            )
            db.commit()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to issue refresh token: {exc}",
        ) from exc

    response = RedirectResponse(url=f"{FRONTEND_URL}/dashboard")
    set_auth_cookies(
        response,
        access_token=access_token,
        refresh_token=raw_refresh_token,
    )
    return response


def _issue_login_error_redirect(
    *,
    error: str,
    provider: str,
) -> RedirectResponse:
    return RedirectResponse(
        url=f"{FRONTEND_URL}/login?{urlencode({'authError': error, 'provider': provider})}"
    )


def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    refresh_token: str | None,
) -> None:
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_KEY,
        value=access_token,
        max_age=ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE_VALUE,
        path="/",
    )

    if refresh_token:
        response.set_cookie(
            key=REFRESH_TOKEN_COOKIE_KEY,
            value=refresh_token,
            max_age=REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS,
            httponly=True,
            secure=AUTH_COOKIE_SECURE,
            samesite=AUTH_COOKIE_SAMESITE_VALUE,
            path="/",
        )
    else:
        response.delete_cookie(
            key=REFRESH_TOKEN_COOKIE_KEY,
            httponly=True,
            secure=AUTH_COOKIE_SECURE,
            samesite=AUTH_COOKIE_SAMESITE_VALUE,
            path="/",
        )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE_KEY,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE_VALUE,
        path="/",
    )
    response.delete_cookie(
        key=REFRESH_TOKEN_COOKIE_KEY,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE_VALUE,
        path="/",
    )


def require_env(name: str) -> str:
    value = SETTINGS_VALUES_BY_NAME.get(name)
    if not value:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Missing environment variable: {name}",
        )
    return value


def _refresh_token_hash(token_value: str) -> str:
    digest = hashlib.sha256()
    digest.update(SECRET_KEY.encode("utf-8"))
    digest.update(b":")
    digest.update(token_value.encode("utf-8"))
    return digest.hexdigest()


def _build_refresh_token_value(token_id: UUID) -> str:
    return f"{token_id}.{secrets.token_urlsafe(64)}"


def _parse_refresh_token_id(refresh_token: str) -> UUID | None:
    try:
        token_id_raw = str(refresh_token).split(".", 1)[0]
        return UUID(token_id_raw)
    except (TypeError, ValueError):
        return None


def _resolve_client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        ip = forwarded_for.split(",")[0].strip()
        if ip:
            return ip[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return None


def _normalize_login_identifier(username: str) -> str:
    return username.strip().lower()[:255]


def _login_failure_headers(
    *,
    captcha_required: bool,
    locked_until: datetime | None = None,
) -> dict[str, str]:
    headers = {}
    if captcha_required:
        headers["X-Captcha-Required"] = "true"
    if locked_until is not None:
        retry_after_seconds = max(
            1,
            int((locked_until - datetime.now(timezone.utc)).total_seconds()),
        )
        headers["Retry-After"] = str(retry_after_seconds)
    return headers


def _raise_invalid_credentials(
    *,
    captcha_required: bool = False,
    locked_until: datetime | None = None,
) -> None:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers=_login_failure_headers(
            captcha_required=captcha_required,
            locked_until=locked_until,
        ),
    )


def _get_or_create_login_attempt(
    db,
    *,
    username_key: str,
    ip_address: str,
) -> LoginAttempt:
    attempt = get_login_attempt(
        db,
        username_key=username_key,
        ip_address=ip_address,
    )
    if attempt is None:
        attempt = LoginAttempt(
            username_key=username_key,
            ip_address=ip_address,
            failed_attempts=0,
            captcha_required=False,
        )
        db.add(attempt)
    return attempt


def _ensure_login_not_locked(db, *, username_key: str, ip_address: str) -> None:
    attempt = get_login_attempt(
        db,
        username_key=username_key,
        ip_address=ip_address,
    )
    now_utc = datetime.now(timezone.utc)
    if attempt is None:
        return
    if attempt.locked_until is None:
        return
    if attempt.locked_until <= now_utc:
        attempt.failed_attempts = 0
        attempt.captcha_required = False
        attempt.first_failed_at = None
        attempt.last_failed_at = None
        attempt.locked_until = None
        attempt.updated_at = now_utc
        db.commit()
        return
    _raise_invalid_credentials(
        captcha_required=attempt.captcha_required,
        locked_until=attempt.locked_until,
    )


def _record_failed_login_attempt(
    db, *, username_key: str, ip_address: str
) -> LoginAttempt:
    now_utc = datetime.now(timezone.utc)
    attempt = _get_or_create_login_attempt(
        db,
        username_key=username_key,
        ip_address=ip_address,
    )
    if attempt.locked_until is not None and attempt.locked_until <= now_utc:
        attempt.failed_attempts = 0
        attempt.locked_until = None
        attempt.first_failed_at = None
    if attempt.failed_attempts is None:
        attempt.failed_attempts = 0
    if attempt.captcha_required is None:
        attempt.captcha_required = False
    if attempt.first_failed_at is None:
        attempt.first_failed_at = now_utc
    attempt.failed_attempts += 1
    attempt.last_failed_at = now_utc
    attempt.updated_at = now_utc
    attempt.captcha_required = attempt.failed_attempts >= CAPTCHA_THRESHOLD
    if attempt.failed_attempts >= LOGIN_FAILURE_LIMIT:
        attempt.locked_until = now_utc + timedelta(minutes=LOCKOUT_WINDOW_MINUTES)
    db.commit()
    return attempt


def _reset_failed_login_attempts(db, *, username_key: str, ip_address: str) -> None:
    attempt = get_login_attempt(
        db,
        username_key=username_key,
        ip_address=ip_address,
    )
    if attempt is None:
        return
    now_utc = datetime.now(timezone.utc)
    attempt.failed_attempts = 0
    attempt.captcha_required = False
    attempt.first_failed_at = None
    attempt.last_failed_at = None
    attempt.locked_until = None
    attempt.updated_at = now_utc


def _issue_password_refresh_token(
    db,
    *,
    user_id: UUID,
    family_id: UUID,
    request: Request,
) -> tuple[PasswordRefreshToken, str]:
    token_id = uuid4()
    raw_refresh_token = _build_refresh_token_value(token_id)
    token_hash = _refresh_token_hash(raw_refresh_token)

    record = PasswordRefreshToken(
        token_id=token_id,
        user_id=user_id,
        family_id=family_id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        created_ip=_resolve_client_ip(request),
        created_user_agent=(request.headers.get("user-agent") or "")[:512] or None,
    )
    db.add(record)
    return record, raw_refresh_token


def _revoke_refresh_token_family(db, *, user_id: UUID, family_id: UUID) -> None:
    rows = db.scalars(
        select(PasswordRefreshToken).where(
            PasswordRefreshToken.user_id == user_id,
            PasswordRefreshToken.family_id == family_id,
            PasswordRefreshToken.revoked_at.is_(None),
        )
    ).all()
    now_utc = datetime.now(timezone.utc)
    for row in rows:
        row.revoked_at = now_utc


def _resolve_oauth_user(
    *,
    provider: str,
    provider_user_id: str,
    email: str | None,
    email_verified: bool,
    display_name: str | None,
) -> str:
    from models import OAuthAccounts, UserDB

    normalized_email = email.strip().lower() if email else None
    username = normalized_email or f"{provider}:{provider_user_id}"
    now_utc = datetime.now(timezone.utc)

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        oauth_account = get_oauth_account_by_provider_user_id(
            db,
            provider=provider,
            provider_user_id=provider_user_id,
        )
        user = oauth_account.user if oauth_account is not None else None

        if user is None and normalized_email and email_verified:
            user = find_user(db=db, email=normalized_email, username=username)

        if user is None:
            if not normalized_email:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Provider did not return a usable email address",
                )
            if not email_verified:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Provider email must be verified before it can be linked",
                )
            user = UserDB(
                username=username,
                email=normalized_email,
                display_name=display_name,
                last_login=now_utc,
                email_verified_at=now_utc,
            )
            db.add(user)
            db.flush()
        else:
            user.last_login = now_utc
            if display_name and not user.display_name:
                user.display_name = display_name
            if normalized_email and not user.email:
                user.email = normalized_email
            if normalized_email and user.email and user.email.lower() != normalized_email:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This provider email belongs to a different account",
                )
            if email_verified and user.email:
                user.email_verified_at = now_utc

        try:
            if oauth_account is None:
                oauth_account = OAuthAccounts(
                    user_id=user.user_id,
                    provider=provider,
                    provider_user_id=provider_user_id,
                    email=normalized_email,
                )
                db.add(oauth_account)
            else:
                oauth_account.email = normalized_email
                oauth_account.updated_at = now_utc
            db.commit()
        except IntegrityError:
            db.rollback()
            user = find_user(db=db, email=normalized_email, username=username)
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to upsert OAuth user",
                )

        db.refresh(user)
        return user.username


def save_oauth_tokens(
    *,
    provider: str,
    username: str,
    access_token: str,
    refresh_token: str | None,
    provider_user_id: str | None = None,
    email: str | None = None,
    expires_at: datetime | None = None,
) -> None:
    from models import OAuthAccounts

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        user = get_user_by_username(db, username)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        oauth_account = get_oauth_account(db, provider=provider, user_id=user.user_id)
        if oauth_account is None:
            if not provider_user_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"{provider.title()} OAuth account not found",
                )
            oauth_account = OAuthAccounts(
                user_id=user.user_id,
                provider=provider,
                provider_user_id=provider_user_id,
                email=email,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at,
            )
            db.add(oauth_account)
        else:
            oauth_account.access_token = access_token
            if refresh_token:
                oauth_account.refresh_token = refresh_token
            if email:
                oauth_account.email = email.strip().lower()
            if provider_user_id:
                oauth_account.provider_user_id = provider_user_id
            if expires_at:
                oauth_account.expires_at = expires_at
            oauth_account.updated_at = datetime.now(timezone.utc)

        db.commit()


def get_google_tokens(username: str) -> tuple[str, str]:
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        user = get_user_by_username(db, username)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        oauth_account = get_oauth_account(db, provider="google", user_id=user.user_id)
        if oauth_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Google OAuth account not found",
            )

        if not oauth_account.access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google access token missing",
            )

        if not oauth_account.refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google refresh token missing",
            )

        return oauth_account.access_token, oauth_account.refresh_token


def refresh_google_token(refresh_token: str):
    client_id = require_env("GOOGLE_CLIENT_ID")
    client_secret = require_env("GOOGLE_CLIENT_SECRET")

    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }

    response = requests.post(token_url, data=data, timeout=15)
    if not response.ok:
        raise HTTPException(status_code=401, detail="Could not refresh Google token")

    new_tokens = response.json()
    return new_tokens.get("access_token")


def create_calendar_event(access_token, username):
    url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    headers = {"Authorization": f"Bearer {access_token}"}

    event_data = {
        "summary": "Möte med Gemini",
        "description": "Diskussion om Google APIer",
        "start": {"dateTime": "2026-02-15T10:00:00Z"},
        "end": {"dateTime": "2026-02-15T11:00:00Z"},
    }

    response = requests.post(url, json=event_data, headers=headers)

    if not response.ok and response.status_code == status.HTTP_401_UNAUTHORIZED:
        access_token, refresh_token = get_google_tokens(username=username)
        new_access_token = refresh_google_token(refresh_token)
        save_oauth_tokens(
            provider="google",
            username=username,
            access_token=new_access_token,
            refresh_token=refresh_token,
        )
        return None

    return response.json()


def login(form: OAuth2PasswordRequestForm, request: Request) -> Token:
    username_key = _normalize_login_identifier(form.username)
    ip_address = _resolve_client_ip(request) or "unknown"

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    try:
        with session_local() as db:
            _ensure_login_not_locked(
                db,
                username_key=username_key,
                ip_address=ip_address,
            )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("Login lockout query failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login lockout query failed: {exc}",
        ) from exc

    try:
        user = authenticate_user(form.username, form.password)
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Login query failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login query failed: {exc}",
        ) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected login failure: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected login failure: {exc}",
        ) from exc

    if not user:
        try:
            with session_local() as db:
                attempt = _record_failed_login_attempt(
                    db,
                    username_key=username_key,
                    ip_address=ip_address,
                )
        except SQLAlchemyError as exc:
            logger.exception("Failed to record login attempt: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to record login attempt: {exc}",
            ) from exc

        _raise_invalid_credentials(
            captcha_required=attempt.captcha_required,
            locked_until=attempt.locked_until,
        )

    if not user.user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not issue session for user",
        )

    token_subject = str(user.user_id)
    access_token = create_access_token(
        subject=token_subject,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    try:
        with session_local() as db:
            _reset_failed_login_attempts(
                db,
                username_key=username_key,
                ip_address=ip_address,
            )
            _, raw_refresh_token = _issue_password_refresh_token(
                db,
                user_id=user.user_id,
                family_id=uuid4(),
                request=request,
            )
            db.commit()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to issue refresh token: {exc}",
        ) from exc

    return Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=raw_refresh_token,
    )


def refresh_password_session(
    payload: RefreshTokenRequest | None,
    request: Request,
) -> Token:
    incoming_refresh_token = (payload.refresh_token if payload else "") or ""
    incoming_refresh_token = incoming_refresh_token.strip()
    if not incoming_refresh_token:
        incoming_refresh_token = (
            request.cookies.get(REFRESH_TOKEN_COOKIE_KEY) or ""
        ).strip()

    if not incoming_refresh_token:
        logger.warning(
            "refresh_password_session: missing refresh token in request payload"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refresh token is required",
        )

    token_id = _parse_refresh_token_id(incoming_refresh_token)
    if token_id is None:
        logger.warning(
            "refresh_password_session: invalid refresh token format (unable to parse token id)"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        logger.exception(
            "refresh_password_session: failed to get DB session factory for token_id=%s",
            token_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    now_utc = datetime.now(timezone.utc)
    incoming_hash = _refresh_token_hash(incoming_refresh_token)

    try:
        with session_local() as db:
            token_row = db.scalar(
                select(PasswordRefreshToken).where(
                    PasswordRefreshToken.token_id == token_id
                )
            )
            if token_row is None:
                logger.warning(
                    "refresh_password_session: token row not found for token_id=%s",
                    token_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token",
                )

            if not secrets.compare_digest(token_row.token_hash, incoming_hash):
                logger.warning(
                    "refresh_password_session: token hash mismatch for token_id=%s user_id=%s",
                    token_id,
                    token_row.user_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token",
                )

            if token_row.revoked_at is not None:
                # Reuse detection: if a rotated token is replayed, revoke the whole family.
                if token_row.replaced_by_token_id is not None:
                    _revoke_refresh_token_family(
                        db,
                        user_id=token_row.user_id,
                        family_id=token_row.family_id,
                    )
                    db.commit()
                    logger.warning(
                        "refresh_password_session: revoked replayed token and family token_id=%s user_id=%s family_id=%s replaced_by_token_id=%s",
                        token_id,
                        token_row.user_id,
                        token_row.family_id,
                        token_row.replaced_by_token_id,
                    )
                else:
                    logger.warning(
                        "refresh_password_session: token already revoked token_id=%s user_id=%s family_id=%s",
                        token_id,
                        token_row.user_id,
                        token_row.family_id,
                    )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Refresh token is no longer valid",
                )

            if token_row.expires_at <= now_utc:
                token_row.revoked_at = now_utc
                db.commit()
                logger.warning(
                    "refresh_password_session: expired token used token_id=%s user_id=%s family_id=%s expires_at=%s",
                    token_id,
                    token_row.user_id,
                    token_row.family_id,
                    token_row.expires_at,
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Refresh token has expired",
                )

            user = db.scalar(select(UserDB).where(UserDB.user_id == token_row.user_id))
            if user is None:
                token_row.revoked_at = now_utc
                db.commit()
                logger.warning(
                    "refresh_password_session: token user not found token_id=%s user_id=%s family_id=%s",
                    token_id,
                    token_row.user_id,
                    token_row.family_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found",
                )

            new_row, new_refresh_token = _issue_password_refresh_token(
                db,
                user_id=user.user_id,
                family_id=token_row.family_id,
                request=request,
            )
            # Ensure the replacement token row exists before setting FK on token_row.
            db.flush()

            token_row.revoked_at = now_utc
            token_row.last_used_at = now_utc
            token_row.replaced_by_token_id = new_row.token_id

            access_token = create_access_token(
                subject=str(user.user_id),
                expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
            )
            db.commit()
    except SQLAlchemyError as exc:
        logger.exception(
            "refresh_password_session: SQL operation failed for token_id=%s",
            token_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Refresh token operation failed: {exc}",
        ) from exc

    return Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=new_refresh_token,
    )


def login_google(request: Request):
    client_id = require_env("GOOGLE_CLIENT_ID")
    state = create_oauth_state(request, "google")
    code_verifier, code_challenge = _create_pkce_pair()
    request.session[_oauth_pkce_verifier_session_key("google")] = code_verifier
    params = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": oauth_redirect_uri(request, "google"),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
    )
    return RedirectResponse(
        url=f"https://accounts.google.com/o/oauth2/v2/auth?{params}"
    )


def callback_google(request: Request, code: str = Query(...), state: str = Query(...)):
    decode_oauth_state(request, state, "google")
    client_id = require_env("GOOGLE_CLIENT_ID")
    client_secret = require_env("GOOGLE_CLIENT_SECRET")
    code_verifier = request.session.pop(
        _oauth_pkce_verifier_session_key("google"), None
    )
    if not code_verifier:
        raise HTTPException(status_code=400, detail="Google PKCE verifier missing")

    token_res = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": oauth_redirect_uri(request, "google"),
            "code_verifier": code_verifier,
        },
        timeout=15,
    )
    if not token_res.ok:
        raise HTTPException(status_code=400, detail="Google token exchange failed")

    tokens = token_res.json()
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Google access token missing")

    user_res = requests.get(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    if not user_res.ok:
        raise HTTPException(status_code=400, detail="Google user info fetch failed")
    user_data = user_res.json()
    provider_user_id = user_data.get("sub")
    if not provider_user_id:
        raise HTTPException(status_code=400, detail="Google subject id missing")
    try:
        username = _resolve_oauth_user(
            provider="google",
            provider_user_id=provider_user_id,
            email=user_data.get("email"),
            email_verified=bool(user_data.get("email_verified")),
            display_name=user_data.get("name"),
        )
    except HTTPException as exc:
        return _issue_login_error_redirect(
            error=str(exc.detail),
            provider="google",
        )
    expires_in = tokens.get("expires_in")
    expires_at = None
    if isinstance(expires_in, int):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    save_oauth_tokens(
        provider="google",
        username=username,
        access_token=access_token,
        refresh_token=refresh_token,
        provider_user_id=provider_user_id,
        email=user_data.get("email"),
        expires_at=expires_at,
    )

    return issue_login_redirect(username, request)


def login_facebook(request: Request):
    client_id = require_env("FACEBOOK_CLIENT_ID")
    state = create_oauth_state(request, "facebook")
    params = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": oauth_redirect_uri(request, "facebook"),
            "state": state,
            "scope": "email,public_profile",
            "response_type": "code",
        }
    )
    return RedirectResponse(url=f"https://www.facebook.com/dialog/oauth?{params}")


def callback_facebook(
    request: Request, code: str = Query(...), state: str = Query(...)
):
    decode_oauth_state(request, state, "facebook")
    client_id = require_env("FACEBOOK_CLIENT_ID")
    client_secret = require_env("FACEBOOK_CLIENT_SECRET")

    token_res = requests.get(
        "https://graph.facebook.com/oauth/access_token",
        params={
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": oauth_redirect_uri(request, "facebook"),
            "code": code,
        },
        timeout=15,
    )
    if not token_res.ok:
        raise HTTPException(status_code=400, detail="Facebook token exchange failed")
    access_token = token_res.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Facebook access token missing")

    user_res = requests.get(
        "https://graph.facebook.com/me",
        params={"fields": "id,name,email,verified", "access_token": access_token},
        timeout=15,
    )
    if not user_res.ok:
        raise HTTPException(status_code=400, detail="Facebook user info fetch failed")
    user_data = user_res.json()
    provider_user_id = str(user_data.get("id") or "").strip()
    if not provider_user_id:
        raise HTTPException(status_code=400, detail="Facebook user id missing")
    try:
        username = _resolve_oauth_user(
            provider="facebook",
            provider_user_id=provider_user_id,
            email=user_data.get("email"),
            email_verified=bool(user_data.get("verified")),
            display_name=user_data.get("name"),
        )
    except HTTPException as exc:
        return _issue_login_error_redirect(
            error=str(exc.detail),
            provider="facebook",
        )
    save_oauth_tokens(
        provider="facebook",
        username=username,
        access_token=access_token,
        refresh_token=None,
        provider_user_id=provider_user_id,
        email=user_data.get("email"),
    )
    return issue_login_redirect(username, request)


def login_instagram(request: Request):
    client_id = require_env("INSTAGRAM_CLIENT_ID")
    state = create_oauth_state(request, "instagram")
    params = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": oauth_redirect_uri(request, "instagram"),
            "scope": "user_profile",
            "response_type": "code",
            "state": state,
        }
    )
    return RedirectResponse(url=f"https://api.instagram.com/oauth/authorize?{params}")


def callback_instagram(
    request: Request, code: str = Query(...), state: str = Query(...)
):
    decode_oauth_state(request, state, "instagram")
    client_id = require_env("INSTAGRAM_CLIENT_ID")
    client_secret = require_env("INSTAGRAM_CLIENT_SECRET")

    token_res = requests.post(
        "https://api.instagram.com/oauth/access_token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "authorization_code",
            "redirect_uri": oauth_redirect_uri(request, "instagram"),
            "code": code,
        },
        timeout=15,
    )
    if not token_res.ok:
        raise HTTPException(status_code=400, detail="Instagram token exchange failed")
    provider_access_token = token_res.json().get("access_token")
    if not provider_access_token:
        raise HTTPException(status_code=400, detail="Instagram access token missing")

    user_res = requests.get(
        "https://graph.instagram.com/me",
        params={"fields": "id,username", "access_token": provider_access_token},
        timeout=15,
    )
    if not user_res.ok:
        raise HTTPException(status_code=400, detail="Instagram user info fetch failed")
    user_data = user_res.json()
    username = (
        f"instagram:{user_data.get('username') or user_data.get('id', 'unknown')}"
    )
    return issue_login_redirect(username, request)
