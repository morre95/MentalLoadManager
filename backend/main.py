from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import all_routers

app = FastAPI()

load_dotenv()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://frontend-production-73b3.up.railway.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def run_db_setup():
    print("Running db_setup.py...")

    import db_setup
    db_setup.main()

for router in all_routers:
    app.include_router(router)


@app.get("/api/hello")
def read_root():
    return {"message": "Hello from Fastapi backend"}
