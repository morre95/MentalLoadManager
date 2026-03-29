from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.v1.helpers import get_user_id_from_token
from app.v1.limiter import limiter

from .schemas import SendMessageRequest
from .service import send_message

# /api/v1/contact/send/message
router = APIRouter(
    prefix="/api/v1/contact",
    tags=["contact"],
)


@router.post("/send/message")
@limiter.limit("5/minute")
async def send_message_route(
    request: Request,
    payload: SendMessageRequest,
    user_id: UUID | None = Depends(get_user_id_from_token),
):
    return await send_message(payload, user_id)
