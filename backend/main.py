from dotenv import load_dotenv
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import all_routers
load_dotenv()

app = FastAPI()

raw_origins = os.getenv("CORS_ALLOW_ORIGINS", "")
allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:4173",
        "https://frontend-production-73b3.up.railway.app",
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
    return {"message": "Hello from Fastapi backend"}

