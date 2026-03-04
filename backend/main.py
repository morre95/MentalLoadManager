from contextlib import asynccontextmanager
import random
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.sessions import SessionMiddleware
from routers import all_routers
from config import settings
from helpers import setup_db_and_tables
from limiter import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_db_and_tables()
    yield


app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET or settings.JWT_SECRET,
    https_only=settings.SESSION_COOKIE_SECURE,
    same_site=settings.SESSION_COOKIE_SAMESITE,
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
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in all_routers:
    app.include_router(router)


@app.get("/api/hello")
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
        "You reached /api/hello successfully.",
    ]
    return {"message": random.choice(messages)}
