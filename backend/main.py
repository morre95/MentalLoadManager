from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import all_routers
from db_setup import main

load_dotenv()


app = FastAPI()

@app.on_event("startup")
async def startup_event():
    main()



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

