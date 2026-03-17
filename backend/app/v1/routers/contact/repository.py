from uuid import UUID

from sqlalchemy.orm import Session

from models import ContactMessages


def save_contact_message(
    db: Session,
    *,
    name: str,
    email: str,
    message: str,
    user_id: UUID | None,
) -> ContactMessages:
    new_contact_message = ContactMessages(
        name=name,
        email=email,
        message=message,
        user_id=user_id,
    )
    db.add(new_contact_message)
    return new_contact_message
