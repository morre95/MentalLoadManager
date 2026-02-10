from .users import router as users_router
from .token import router as token_router

all_routers = [
    users_router,
    token_router,
]
