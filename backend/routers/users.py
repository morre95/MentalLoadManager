from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from helpers import get_current_user, get_session_local, password_hasher
from models import User, UserDB

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
)


class RegisterUserRequest(BaseModel):
    username: str
    password: str
    email: str | None = None


class RegisterUserResponse(BaseModel):
    user_id: str
    username: str
    email: str | None = None


@router.post("/register", response_model=RegisterUserResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: RegisterUserRequest):
    username = payload.username.strip()
    email = payload.email.strip() if payload.email else None
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
        duplicate_conditions = [UserDB.username == username]
        if email:
            duplicate_conditions.append(UserDB.email == email)

        existing_user = db.scalar(select(UserDB).where(or_(*duplicate_conditions)))
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already exists",
            )

        new_user = UserDB(
            username=username,
            password=password_hasher.hash(payload.password),
            email=email,
        )
        db.add(new_user)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already exists",
            ) from exc

        db.refresh(new_user)
        response = RegisterUserResponse(
            user_id=str(new_user.user_id),
            username=new_user.username,
            email=new_user.email,
        )

    return response


@router.get("/me", response_model=User)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
