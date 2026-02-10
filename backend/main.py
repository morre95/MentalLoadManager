from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import all_routers

app = FastAPI()

load_dotenv()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in all_routers:
    app.include_router(router)


@app.get("/api/hello")
def read_root():
    return {"message": "Hello from Fastapi backend"}

import os
print("JWT_SECRET exists?", bool(os.getenv("JWT_SECRET")))
print("DATABASE_URL exists?", bool(os.getenv("DATABASE_URL")))
print("FRONTEND_URL:", os.getenv("FRONTEND_URL"))