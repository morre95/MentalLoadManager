from .users import router as users_router
from .token import router as token_router
from .kamban import router as kamban_router
from .calendar import router as calendar_router

all_routers = [
    users_router,
    token_router,
    kamban_router,
    calendar_router,
]
