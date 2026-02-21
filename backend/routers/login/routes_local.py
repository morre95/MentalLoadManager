from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from helpers import get_current_user
from models import User

from .schemas import Token

from .service import create_calendar_event, get_google_tokens, login

router = APIRouter(tags=["login"])


@router.get("/api/test/calendar")
def test_calendar(user: User = Depends(get_current_user)):
    access_token, _ = get_google_tokens(user.username)
    create_calendar_event(access_token=access_token, username=user.username)
    return {"success": True}


@router.post("/api/token")
@router.post("/api/passwrod/login", response_model=Token)
def login_route(form: OAuth2PasswordRequestForm = Depends()):
    return login(form)
