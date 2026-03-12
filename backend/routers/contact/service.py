import logging
from html import escape
from typing import cast
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import NameEmail, SecretStr
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from config import settings
from helpers import get_session_local

from .repository import save_contact_message
from .schemas import SendMessageRequest

logger = logging.getLogger(__name__)


def _validate_payload(payload: SendMessageRequest) -> tuple[str, str, str]:
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

    if "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email is required",
        )

    return name, email, message


def _build_contact_email_body(
    *, name: str, email: str, message: str, user_id: UUID | None
) -> str:
    escaped_message = escape(message).replace("\n", "<br />")
    escaped_name = escape(name)
    escaped_email = escape(email)
    escaped_user_id = escape(str(user_id)) if user_id else "Anonymous"

    return (
        "<h2>New contact form message</h2>"
        f"<p><strong>Name:</strong> {escaped_name}</p>"
        f"<p><strong>Email:</strong> {escaped_email}</p>"
        f"<p><strong>User ID:</strong> {escaped_user_id}</p>"
        f"<p><strong>Message:</strong><br />{escaped_message}</p>"
    )


async def _send_contact_email(
    *, name: str, email: str, message: str, user_id: UUID | None
) -> None:
    mail_server = settings.MAIL_SERVER.strip()
    mail_from = settings.MAIL_FROM.strip()
    recipient = settings.CONTACT_RECIPIENT_EMAIL.strip()

    if not mail_server or not mail_from or not recipient:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Contact email is not configured",
        )

    try:
        from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
    except ImportError as exc:
        logger.exception("fastapi-mail is not available")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email service is unavailable",
        ) from exc

    connection_config = ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=cast(SecretStr, settings.MAIL_PASSWORD),
        MAIL_FROM=mail_from,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=mail_server,
        MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
        MAIL_STARTTLS=settings.MAIL_STARTTLS,
        MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
        USE_CREDENTIALS=settings.MAIL_USE_CREDENTIALS,
        VALIDATE_CERTS=settings.MAIL_VALIDATE_CERTS,
    )
    message_schema = MessageSchema(
        subject=f"New contact form message from {name}",
        recipients=[NameEmail(name="Mental Load Manager", email=recipient)],
        body=_build_contact_email_body(
            name=name,
            email=email,
            message=message,
            user_id=user_id,
        ),
        subtype=MessageType.html,
        reply_to=[NameEmail(name=name, email=email)],
    )

    try:
        fast_mail = FastMail(connection_config)
        await fast_mail.send_message(message_schema)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to send contact email: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Message was saved, but the email could not be sent",
        ) from exc


async def send_message(payload: SendMessageRequest, user_id: UUID | None):
    name, email, message = _validate_payload(payload)

    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        new_contact_message = save_contact_message(
            db,
            name=name,
            email=email,
            message=message,
            user_id=user_id,
        )

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

    await _send_contact_email(
        name=name,
        email=email,
        message=message,
        user_id=user_id,
    )

    return {
        "message": "Message sent successfully",
        "user_data": {"username": name, "email": email, "message": message},
    }
