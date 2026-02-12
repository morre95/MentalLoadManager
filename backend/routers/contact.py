from uuid import UUID
from fastapi import APIRouter, Depends, status, HTTPException
from pydantic import BaseModel
import logging
from sqlalchemy.exc import IntegrityError
from sqlalchemy.exc import SQLAlchemyError
from models import ContactMessages
from helpers import get_session_local, get_user_id_from_token


# /api/contact/send/message
router = APIRouter(
    prefix="/api/contact",
    tags=["contact"],
)

logger = logging.getLogger(__name__)


class SendMessageRequest(BaseModel):
    name: str
    email: str
    message: str


@router.post("/send/message")
def send_message(
    payload: SendMessageRequest,
    user_id: UUID | None = Depends(get_user_id_from_token),
):
    name = payload.name.strip()
    email = payload.email.strip()
    message = payload.message.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name is required",
        )
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required",
        )
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message is required",
        )

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        new_contact_message = ContactMessages(
            name=name,
            email=email,
            message=message,
            user_id=user_id,
        )
        db.add(new_contact_message)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Message could not be stored",
            ) from exc
        except SQLAlchemyError as exc:
            db.rollback()
            logger.exception("Failed to store contact message: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Internal server error while saving message: {exc}",
            ) from exc

        db.refresh(new_contact_message)

    return {
        "message": "User data submitted successfully!",
        "user_data": {"username": name, "email": email, "message": message},
    }
