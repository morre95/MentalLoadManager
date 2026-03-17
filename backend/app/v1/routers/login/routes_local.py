from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.v1.helpers import get_current_user
from app.v1.limiter import limiter
from app.v1.models import User

from .schemas import RefreshTokenRequest, Token

from .service import (
    clear_auth_cookies,
    create_calendar_event,
    get_google_tokens,
    login,
    refresh_password_session,
    set_auth_cookies,
)

router = APIRouter(tags=["login"])


@router.get("/api/v1/test/calendar")
def test_calendar(user: User = Depends(get_current_user)):
    access_token, _ = get_google_tokens(user.username)
    create_calendar_event(access_token=access_token, username=user.username)
    return {"success": True}


@router.post("/api/v1/token")
@router.post("/api/v1/password/login", response_model=Token)
@limiter.limit("10/minute")
def login_route(
    request: Request,
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
):
    token = login(form, request)
    set_auth_cookies(
        response,
        access_token=token.access_token,
        refresh_token=token.refresh_token,
    )
    return token


@router.post("/api/v1/token/refresh", response_model=Token)
@router.post("/api/v1/password/refresh", response_model=Token)
@limiter.limit("30/minute")
def refresh_route(
    request: Request,
    response: Response,
    payload: RefreshTokenRequest | None = None,
):
    token = refresh_password_session(payload, request)
    set_auth_cookies(
        response,
        access_token=token.access_token,
        refresh_token=token.refresh_token,
    )
    return token


@router.post("/api/v1/password/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_route(response: Response):
    clear_auth_cookies(response)
