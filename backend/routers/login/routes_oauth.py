from fastapi import APIRouter, Query, Request

from . import service

router = APIRouter(tags=["login"])


@router.get("/api/auth/google/login")
def login_google_route(request: Request):
    return service.login_google(request)


@router.get("/api/auth/google/callback")
def callback_google(request: Request, code: str = Query(...), state: str = Query(...)):
    return service.callback_google(request, code, state)


@router.get("/api/auth/facebook/login")
def login_facebook_route(request: Request):
    return service.login_facebook(request)


@router.get("/api/auth/facebook/callback")
def callback_facebook(
    request: Request, code: str = Query(...), state: str = Query(...)
):
    return service.callback_facebook(request, code, state)


@router.get("/api/auth/instagram/login")
def login_instagram_route(request: Request):
    return service.login_instagram(request)


@router.get("/api/auth/instagram/callback")
def callback_instagram(
    request: Request, code: str = Query(...), state: str = Query(...)
):
    return service.callback_instagram(request, code, state)
