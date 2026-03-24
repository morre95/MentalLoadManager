import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from html import escape
from urllib.parse import urlencode

from fastapi import HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.exc import IntegrityError

from app.v1.config import settings
from app.v1.helpers import get_session_local, password_hasher
from app.v1.models import UserEmail

from .repository import (
    create_email_verification_token,
    create_user,
    delete_active_email_verification_tokens,
    find_email_verification_token_by_code_hash,
    find_email_verification_token_by_token_hash,
    find_existing_user,
    find_user_by_email,
    find_user_by_id,
    find_user_by_username,
)
from .schemas import (
    ChangePasswordRequest,
    RegisterUserRequest,
    RegisterUserResponse,
    ResendVerificationEmailRequest,
    UpdateMeRequest,
    VerificationEmailResponse,
    VerifyEmailCodeRequest,
    VerifyEmailResponse,
)

logger = logging.getLogger(__name__)


def _normalize_email(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    return normalized or None


def _hash_verification_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _create_verification_secret_pair() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    code = f"{secrets.randbelow(1_000_000):06d}"
    return token, code


def _build_backend_verify_url(token: str) -> str:
    backend_url = (settings.BACKEND_URL or "").rstrip("/")
    return f"{backend_url}/api/v1/users/verify-email?{urlencode({'token': token})}"


def _build_frontend_login_url(**params: str) -> str:
    frontend_url = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")
    cleaned = {key: value for key, value in params.items() if value}
    if not cleaned:
        return f"{frontend_url}/login"
    return f"{frontend_url}/login?{urlencode(cleaned)}"


def _build_verification_email_html(
    *,
    username: str,
    verify_link: str,
    verification_code: str,
) -> str:
    safe_name = escape(username)
    safe_link = escape(verify_link, quote=True)
    safe_code = escape(verification_code)
    return (
        f"<h2>Verify your email, {safe_name}</h2>"
        "<p>Use either the button below or the verification code to finish setting up your account.</p>"
        f'<p><a href="{safe_link}" '
        'style="display:inline-block;padding:12px 18px;background:#64786f;color:#ffffff;'
        'text-decoration:none;border-radius:8px;font-weight:600;">Verify email</a></p>'
        f"<p>If you prefer entering a code, use this one-time code:</p><p><strong style=\"font-size:24px;letter-spacing:4px;\">{safe_code}</strong></p>"
        "<p>This verification expires in 24 hours.</p>"
    )


def _send_verification_email(*, email: str, username: str, link: str, code: str) -> None:
    import resend

    api_key = settings.RESEND_API_KEY.strip()
    mail_from = settings.MAIL_FROM.strip()
    if not api_key or not mail_from:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Verification email is not configured",
        )

    resend.api_key = api_key
    params: resend.Emails.SendParams = {
        "from": f"{settings.MAIL_FROM_NAME} <{mail_from}>",
        "to": [email],
        "subject": "Verify your Mental Load Manager email",
        "html": _build_verification_email_html(
            username=username,
            verify_link=link,
            verification_code=code,
        ),
    }

    try:
        resend.Emails.send(params)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to send verification email to %s: %s", email, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Account was created, but the verification email could not be sent",
        ) from exc


def _issue_email_verification_for_user(user, db) -> None:  # noqa: ANN001
    if not user.user_id or not user.email:
        return

    token, code = _create_verification_secret_pair()
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=max(settings.EMAIL_VERIFICATION_EXPIRE_HOURS, 1)
    )
    delete_active_email_verification_tokens(
        db,
        user_id=user.user_id,
        email=user.email,
    )
    create_email_verification_token(
        db,
        user_id=user.user_id,
        email=user.email,
        token_hash=_hash_verification_secret(token),
        code_hash=_hash_verification_secret(code),
        expires_at=expires_at,
    )
    db.flush()
    _send_verification_email(
        email=user.email,
        username=user.display_name or user.username,
        link=_build_backend_verify_url(token),
        code=code,
    )


def _mark_email_verified(token_row, db) -> None:  # noqa: ANN001
    now_utc = datetime.now(timezone.utc)
    user = find_user_by_id(db, token_row.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification token is invalid",
        )
    if not user.email or user.email.lower() != token_row.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token is no longer valid",
        )
    if token_row.expires_at < now_utc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired",
        )

    token_row.consumed_at = now_utc
    user.email_verified_at = now_utc


def register_user(payload: RegisterUserRequest) -> RegisterUserResponse:
    username = payload.username.strip()
    email = _normalize_email(payload.email)
    display_name = payload.display_name.strip() if payload.display_name else None

    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required",
        )
    if not payload.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required",
        )
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email is required",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        existing_user = find_existing_user(db, username, email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already exists",
            )

        new_user = create_user(
            db,
            username=username,
            password_hash=password_hasher.hash(payload.password),
            email=email,
            display_name=display_name,
        )

        try:
            db.flush()
            _issue_email_verification_for_user(new_user, db)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already exists",
            ) from exc

        db.refresh(new_user)

        return RegisterUserResponse(
            user_id=str(new_user.user_id),
            username=new_user.username,
            email=new_user.email,
            display_name=new_user.display_name,
        )


def update_me(payload: UpdateMeRequest, current_user: UserEmail) -> UserEmail:
    email_provided = payload.email is not None
    display_name_provided = payload.display_name is not None

    if not email_provided and not display_name_provided:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        user = find_user_by_username(db, current_user.username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )

        current_email = _normalize_email(user.email)
        email_changed = False

        if email_provided:
            next_email = _normalize_email(payload.email)
            if user.password and not next_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email is required for password login",
                )

            if next_email:
                if "@" not in next_email:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="A valid email is required",
                    )
                duplicate = find_user_by_email(db, next_email)
                if duplicate and duplicate.user_id != user.user_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Email already exists",
                    )

            email_changed = next_email != current_email
            user.email = next_email
            if email_changed:
                user.email_verified_at = None

        if display_name_provided:
            normalized_display_name = (
                payload.display_name.strip() if payload.display_name else ""
            )
            user.display_name = normalized_display_name or None

        try:
            if email_changed and user.email:
                _issue_email_verification_for_user(user, db)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists",
            ) from exc

        db.refresh(user)

        return UserEmail(
            username=user.username,
            email=user.email,
            display_name=user.display_name,
            email_verified=bool(user.email_verified_at),
        )


def resend_verification_email(
    payload: ResendVerificationEmailRequest,
) -> VerificationEmailResponse:
    email = _normalize_email(payload.email)
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email is required",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        user = find_user_by_email(db, email)
        if user and user.email and not user.email_verified_at:
            _issue_email_verification_for_user(user, db)
            db.commit()

    return VerificationEmailResponse(
        message="If that email exists, a verification message has been sent"
    )


def verify_email_code(payload: VerifyEmailCodeRequest) -> VerifyEmailResponse:
    email = _normalize_email(payload.email)
    code = payload.code.strip()
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email is required",
        )
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code is required",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        token_row = find_email_verification_token_by_code_hash(
            db,
            email=email,
            code_hash=_hash_verification_secret(code),
        )
        if token_row is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code is invalid",
            )
        if token_row.consumed_at is not None:
            return VerifyEmailResponse(message="Email already verified")

        _mark_email_verified(token_row, db)
        db.commit()

    return VerifyEmailResponse(message="Email verified successfully")


def verify_email_token(token: str) -> RedirectResponse:
    cleaned_token = token.strip()
    if not cleaned_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token is required",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        token_row = find_email_verification_token_by_token_hash(
            db,
            _hash_verification_secret(cleaned_token),
        )
        if token_row is None:
            return RedirectResponse(
                url=_build_frontend_login_url(verification="invalid")
            )
        if token_row.consumed_at is not None:
            return RedirectResponse(url=_build_frontend_login_url(verified="1"))

        try:
            _mark_email_verified(token_row, db)
            db.commit()
        except HTTPException as exc:
            if exc.detail == "Verification token has expired":
                return RedirectResponse(
                    url=_build_frontend_login_url(verification="expired")
                )
            return RedirectResponse(
                url=_build_frontend_login_url(verification="invalid")
            )

    return RedirectResponse(url=_build_frontend_login_url(verified="1"))


def change_my_password(payload: ChangePasswordRequest, current_user: UserEmail) -> dict:
    current_password = payload.current_password or ""
    new_password = payload.new_password or ""

    if not current_password or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current and new password are required",
        )
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )
    if current_password == new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        user = find_user_by_username(db, current_user.username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        if not user.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password login is not available for this account",
            )
        if not user.password or not password_hasher.verify(current_password, user.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )

        user.password = password_hasher.hash(new_password)
        user.updated_at = datetime.now(timezone.utc)
        db.commit()

    return {"message": "Password updated successfully"}
