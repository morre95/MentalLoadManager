from fastapi import APIRouter, Depends, status

from helpers import get_current_user
from models import UserEmail

from .schemas import RegisterUserRequest, RegisterUserResponse
from .service import register_user

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
)


@router.post(
    "/register",
    response_model=RegisterUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user_route(payload: RegisterUserRequest):
    return register_user(payload)


@router.get("/me", response_model=UserEmail)
def read_users_me(current_user: UserEmail = Depends(get_current_user)):
    return current_user
