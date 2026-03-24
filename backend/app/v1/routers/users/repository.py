from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.v1.models import EmailVerificationToken, UserDB


def find_existing_user(db: Session, username: str, email: str | None) -> UserDB | None:
    duplicate_conditions = [func.lower(UserDB.username) == username.lower()]
    if email:
        duplicate_conditions.append(func.lower(UserDB.email) == email.lower())

    return db.scalar(select(UserDB).where(or_(*duplicate_conditions)))


def create_user(
    db: Session,
    *,
    username: str,
    password_hash: str,
    email: str | None,
    display_name: str | None,
    email_verified_at=None,  # noqa: ANN001
) -> UserDB:
    user = UserDB(
        username=username,
        password=password_hash,
        email=email,
        display_name=display_name,
        email_verified_at=email_verified_at,
    )
    db.add(user)
    return user


def find_user_by_username(db: Session, username: str) -> UserDB | None:
    return db.scalar(
        select(UserDB).where(func.lower(UserDB.username) == username.lower())
    )


def find_user_by_email(db: Session, email: str) -> UserDB | None:
    return db.scalar(select(UserDB).where(func.lower(UserDB.email) == email.lower()))


def find_user_by_id(db: Session, user_id: UUID) -> UserDB | None:
    return db.scalar(select(UserDB).where(UserDB.user_id == user_id))


def delete_active_email_verification_tokens(
    db: Session,
    *,
    user_id: UUID,
    email: str,
) -> None:
    db.execute(
        delete(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user_id,
            func.lower(EmailVerificationToken.email) == email.lower(),
            EmailVerificationToken.consumed_at.is_(None),
        )
    )


def create_email_verification_token(
    db: Session,
    *,
    user_id: UUID,
    email: str,
    token_hash: str,
    code_hash: str,
    expires_at,
) -> EmailVerificationToken:  # noqa: ANN001
    row = EmailVerificationToken(
        user_id=user_id,
        email=email,
        token_hash=token_hash,
        code_hash=code_hash,
        expires_at=expires_at,
    )
    db.add(row)
    return row


def find_email_verification_token_by_token_hash(
    db: Session,
    token_hash: str,
) -> EmailVerificationToken | None:
    return db.scalar(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash
        )
    )


def find_email_verification_token_by_code_hash(
    db: Session,
    *,
    email: str,
    code_hash: str,
) -> EmailVerificationToken | None:
    return db.scalar(
        select(EmailVerificationToken).where(
            func.lower(EmailVerificationToken.email) == email.lower(),
            EmailVerificationToken.code_hash == code_hash,
        )
    )
