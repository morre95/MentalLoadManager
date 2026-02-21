from uuid import UUID

from fastapi import APIRouter, Depends

from helpers import get_user_id_from_token

from .schemas import SendMessageRequest
from .service import send_message

# /api/contact/send/message
router = APIRouter(
    prefix="/api/contact",
    tags=["contact"],
)


@router.post("/send/message")
def send_message_route(
    payload: SendMessageRequest,
    user_id: UUID | None = Depends(get_user_id_from_token),
):
    return send_message(payload, user_id)
