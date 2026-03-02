from fastapi import APIRouter, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm

from helpers import get_current_user
from limiter import limiter
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
@router.post("/api/password/login", response_model=Token)
@limiter.limit("10/minute")
def login_route(request: Request, form: OAuth2PasswordRequestForm = Depends()):
    return login(form)
