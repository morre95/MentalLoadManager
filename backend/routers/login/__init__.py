from fastapi import APIRouter

from .routes_local import router as local_router
from .routes_oauth import router as oauth_router

router = APIRouter(tags=["login"])
router.include_router(local_router)
router.include_router(oauth_router)

__all__ = ["router"]
