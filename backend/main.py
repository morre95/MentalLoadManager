from dotenv import load_dotenv
import os
import random
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import all_routers

load_dotenv()

app = FastAPI()

raw_origins = os.getenv("CORS_ALLOW_ORIGINS", "")
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
