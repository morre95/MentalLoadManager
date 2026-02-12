from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import all_routers


load_dotenv()


app = FastAPI()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: runs before the application starts
    print("Starting up...")
    from db_setup import main
    main()
    # Load ML models, connect to database, etc.
    yield
    # Shutdown: runs when application is stopping
    print("Shutting down...")
    # Close connections, cleanup resources, etc.


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

