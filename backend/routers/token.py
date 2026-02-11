import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import jwt
import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from models import Token, UserDB
from helpers import (
    ALGORITHM,
    SECRET_KEY,
    authenticate_user,
    create_access_token,
    get_session_local,
)

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "30"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
BACKEND_URL = os.getenv("BACKEND_URL", "").rstrip("/")

router = APIRouter()


def create_oauth_state(provider: str) -> str:
    payload = {
        "provider": provider,
        "nonce": secrets.token_urlsafe(16),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_oauth_state(state: str, expected_provider: str) -> None:
    try:
        payload = jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("provider") != expected_provider:
            raise ValueError("Provider mismatch")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state",
        ) from exc


def oauth_redirect_uri(request: Request, provider: str) -> str:
    provider_redirect_uri = os.getenv(f"{provider.upper()}_REDIRECT_URI", "").rstrip(
        "/"
    )
    if provider_redirect_uri:
        return provider_redirect_uri

    if BACKEND_URL:
        return f"{BACKEND_URL}/api/auth/{provider}/callback"

    # Prefer proxy headers when the app runs behind a reverse proxy.
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")
    if forwarded_proto and forwarded_host:
        proto = forwarded_proto.split(",")[0].strip()
        host = forwarded_host.split(",")[0].strip()
        return f"{proto}://{host}/api/auth/{provider}/callback"

    return str(request.url_for(f"callback_{provider}"))


def issue_login_redirect(username: str) -> RedirectResponse:
    access_token = create_access_token(
        subject=username,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return RedirectResponse(
        url=f"{FRONTEND_URL}/login#access_token={access_token}&token_type=bearer"
    )


def upsert_google_user(user_data: dict) -> str:
    email = user_data.get("email")
    provider_sub = user_data.get("sub")
    username = email or f"google:{provider_sub or 'unknown'}"
    now_utc = datetime.now(timezone.utc)

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        user = None
        if email:
            user = db.scalar(select(UserDB).where(UserDB.email == email))
        if user is None:
            user = db.scalar(select(UserDB).where(UserDB.username == username))

        if user is None:
            user = UserDB(
                username=username,
                email=email,
                last_login=now_utc,
            )
            db.add(user)
        else:
            user.last_login = now_utc
            if email and not user.email:
                user.email = email

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            # Handle race conditions on unique email.
            if email:
                user = db.scalar(select(UserDB).where(UserDB.email == email))
            if user is None:
                user = db.scalar(select(UserDB).where(UserDB.username == username))
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to upsert Google user",
                )

        db.refresh(user)
        return user.username


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Missing environment variable: {name}",
        )
    return value


@router.post("/api/token", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form.username, form.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    access_token = create_access_token(
        subject=user.username,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/api/auth/google/login")
def login_google(request: Request):
    client_id = require_env("GOOGLE_CLIENT_ID")
    state = create_oauth_state("google")
    params = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": oauth_redirect_uri(request, "google"),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
    )
    return RedirectResponse(
        url=f"https://accounts.google.com/o/oauth2/v2/auth?{params}"
    )


@router.get("/api/auth/google/callback")
def callback_google(request: Request, code: str = Query(...), state: str = Query(...)):
    decode_oauth_state(state, "google")
    client_id = require_env("GOOGLE_CLIENT_ID")
    client_secret = require_env("GOOGLE_CLIENT_SECRET")

    token_res = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": oauth_redirect_uri(request, "google"),
        },
        timeout=15,
    )
    if not token_res.ok:
        raise HTTPException(status_code=400, detail="Google token exchange failed")
    access_token = token_res.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Google access token missing")

    user_res = requests.get(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    if not user_res.ok:
        raise HTTPException(status_code=400, detail="Google user info fetch failed")
    user_data = user_res.json()
    username = upsert_google_user(user_data)
    return issue_login_redirect(username)


@router.get("/api/auth/facebook/login")
def login_facebook(request: Request):
    client_id = require_env("FACEBOOK_CLIENT_ID")
    state = create_oauth_state("facebook")
    params = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": oauth_redirect_uri(request, "facebook"),
            "state": state,
            "scope": "email,public_profile",
            "response_type": "code",
        }
    )
    return RedirectResponse(url=f"https://www.facebook.com/dialog/oauth?{params}")


@router.get("/api/auth/facebook/callback")
def callback_facebook(
    request: Request, code: str = Query(...), state: str = Query(...)
):
    decode_oauth_state(state, "facebook")
    client_id = require_env("FACEBOOK_CLIENT_ID")
    client_secret = require_env("FACEBOOK_CLIENT_SECRET")

    token_res = requests.get(
        "https://graph.facebook.com/oauth/access_token",
        params={
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": oauth_redirect_uri(request, "facebook"),
            "code": code,
        },
        timeout=15,
    )
    if not token_res.ok:
        raise HTTPException(status_code=400, detail="Facebook token exchange failed")
    access_token = token_res.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Facebook access token missing")

    user_res = requests.get(
        "https://graph.facebook.com/me",
        params={"fields": "id,name,email", "access_token": access_token},
        timeout=15,
    )
    if not user_res.ok:
        raise HTTPException(status_code=400, detail="Facebook user info fetch failed")
    user_data = user_res.json()
    username = user_data.get("email") or f"facebook:{user_data.get('id', 'unknown')}"
    return issue_login_redirect(username)


@router.get("/api/auth/instagram/login")
def login_instagram(request: Request):
    client_id = require_env("INSTAGRAM_CLIENT_ID")
    state = create_oauth_state("instagram")
    params = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": oauth_redirect_uri(request, "instagram"),
            "scope": "user_profile",
            "response_type": "code",
            "state": state,
        }
    )
    return RedirectResponse(url=f"https://api.instagram.com/oauth/authorize?{params}")


@router.get("/api/auth/instagram/callback")
def callback_instagram(
    request: Request, code: str = Query(...), state: str = Query(...)
):
    decode_oauth_state(state, "instagram")
    client_id = require_env("INSTAGRAM_CLIENT_ID")
    client_secret = require_env("INSTAGRAM_CLIENT_SECRET")

    token_res = requests.post(
        "https://api.instagram.com/oauth/access_token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "authorization_code",
            "redirect_uri": oauth_redirect_uri(request, "instagram"),
            "code": code,
        },
        timeout=15,
    )
    if not token_res.ok:
        raise HTTPException(status_code=400, detail="Instagram token exchange failed")
    provider_access_token = token_res.json().get("access_token")
    if not provider_access_token:
        raise HTTPException(status_code=400, detail="Instagram access token missing")

    user_res = requests.get(
        "https://graph.instagram.com/me",
        params={"fields": "id,username", "access_token": provider_access_token},
        timeout=15,
    )
    if not user_res.ok:
        raise HTTPException(status_code=400, detail="Instagram user info fetch failed")
    user_data = user_res.json()
    username = (
        f"instagram:{user_data.get('username') or user_data.get('id', 'unknown')}"
    )
    return issue_login_redirect(username)
