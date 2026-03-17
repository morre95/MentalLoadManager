import asyncio
from contextlib import asynccontextmanager
import random
from typing import Literal, cast
from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.sessions import SessionMiddleware
from app.v1.cache_maintenance import run_ai_cache_maintenance_loop, stop_background_task
from app.v1.routers import all_routers
from app.v1.config import settings
from app.v1.helpers import setup_db_and_tables
from app.v1.limiter import limiter


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_db_and_tables()
    cache_cleanup_task = asyncio.create_task(run_ai_cache_maintenance_loop())
    try:
        yield
    finally:
        await stop_background_task(cache_cleanup_task)


app = FastAPI(lifespan=lifespan, debug=True)
app.state.limiter = limiter


def _rate_limit_handler(request: Request, exc: Exception) -> Response:
    if isinstance(exc, RateLimitExceeded):
        return _rate_limit_exceeded_handler(request, exc)
    raise exc


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
app.add_middleware(SlowAPIMiddleware)

same_site_raw = settings.SESSION_COOKIE_SAMESITE.strip().lower()
if same_site_raw not in {"lax", "strict", "none"}:
    same_site_raw = "lax"
same_site = cast(Literal["lax", "strict", "none"], same_site_raw)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET or settings.JWT_SECRET,
    https_only=settings.SESSION_COOKIE_SECURE,
    same_site=same_site,
    max_age=settings.SESSION_COOKIE_MAX_AGE_SECONDS,
)

raw_origins = settings.CORS_ALLOW_ORIGINS

allowed_origins = [
    origin.strip() for origin in raw_origins.split(",") if origin.strip()
]
if not allowed_origins:
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:4173",
        "https://frontend-production-73b3.up.railway.app",
        "https://mentalloadmanager-production.up.railway.app",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

for router in all_routers:
    app.include_router(router)


@app.get("/api/v1/hello")
def read_root():
    messages = [
        "Hello from FastAPI backend!",
        "Welcome back! Everything is running smoothly.",
        "Hi there! Your API is alive and ready.",
        "Nice to see you. Keep going!",
        "Ping received. Response delivered.",
        "System check complete. All good.",
        "Today is a great day to ship code.",
        "Request accepted. Sending positive vibes.",
        "Backend says hello from the server side.",
        "You reached /api/v1/hello successfully.",
    ]
    return {"message": random.choice(messages)}
