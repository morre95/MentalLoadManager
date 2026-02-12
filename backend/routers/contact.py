from fastapi import APIRouter, status, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from models import ContactMessages
from helpers import get_session_local


# /api/contact/send/message
router = APIRouter(
    prefix="/api/contact",
    tags=["contact"],
)

class SendMessageRequest(BaseModel):
    name: str
    email: str
    message: str

@router.post("/send/message")
async def send_message(payload: SendMessageRequest):
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
        )
        db.add(new_contact_message)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already exists",
            ) from exc
        
        db.refresh(new_contact_message)


    return {"message": "User data submitted successfully!",
                "user_data": {"username": name, "email": email, "message": message}}
