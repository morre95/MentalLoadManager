from .users import router as users_router
from .login import router as login_router
from .kanban import router as kanban_router
from .calendar import router as calendar_router
from .contact import router as contact_router

all_routers = [
    users_router,
    login_router,
    kanban_router,
    calendar_router,
    contact_router,
]
