from fastapi import APIRouter, Depends
from ..models import User
from ..helpers import get_current_user

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
)


@router.get("/me", response_model=User)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
