from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.v1.helpers import get_session_local, password_hasher
from app.v1.models import UserEmail

from .repository import (
    create_user,
    find_existing_user,
    find_user_by_email,
    find_user_by_username,
)
from .schemas import (
    ChangePasswordRequest,
    RegisterUserRequest,
    RegisterUserResponse,
    UpdateMeRequest,
)


def register_user(payload: RegisterUserRequest) -> RegisterUserResponse:
    username = payload.username.strip()
    email = payload.email.strip() if payload.email else None
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

        if email_provided:
            normalized_email = payload.email.strip() if payload.email else ""
            next_email = normalized_email or None

            if next_email:
                duplicate = find_user_by_email(db, next_email)
                if duplicate and duplicate.user_id != user.user_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Email already exists",
                    )

            user.email = next_email

        if display_name_provided:
            normalized_display_name = (
                payload.display_name.strip() if payload.display_name else ""
            )
            user.display_name = normalized_display_name or None

        try:
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
        )


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
        if not password_hasher.verify(current_password, user.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )

        user.password = password_hasher.hash(new_password)
        user.updated_at = datetime.now(timezone.utc)
        db.commit()

    return {"message": "Password updated successfully"}
