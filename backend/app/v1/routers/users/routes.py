from fastapi import APIRouter, Depends, Request, status

from app.v1.helpers import get_current_user
from app.v1.limiter import limiter
from app.v1.models import UserEmail

from .schemas import (
    ChangePasswordRequest,
    RegisterUserRequest,
    RegisterUserResponse,
    UpdateMeRequest,
)
from .service import change_my_password, register_user, update_me

router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"],
)


@router.post(
    "/register",
    response_model=RegisterUserResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/minute")
def register_user_route(request: Request, payload: RegisterUserRequest):
    return register_user(payload)


@router.get("/me", response_model=UserEmail)
def read_users_me(current_user: UserEmail = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserEmail)
def update_users_me(
    payload: UpdateMeRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return update_me(payload, current_user)


@router.patch("/me/password")
def change_users_me_password(
    payload: ChangePasswordRequest,
    current_user: UserEmail = Depends(get_current_user),
):
    return change_my_password(payload, current_user)
