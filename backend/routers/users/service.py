from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from helpers import get_session_local, password_hasher

from .repository import create_user, find_existing_user
from .schemas import RegisterUserRequest, RegisterUserResponse


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
