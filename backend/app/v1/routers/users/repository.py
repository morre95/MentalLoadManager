from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from models import UserDB


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
) -> UserDB:
    user = UserDB(
        username=username,
        password=password_hash,
        email=email,
        display_name=display_name,
    )
    db.add(user)
    return user


def find_user_by_username(db: Session, username: str) -> UserDB | None:
    return db.scalar(
        select(UserDB).where(func.lower(UserDB.username) == username.lower())
    )


def find_user_by_email(db: Session, email: str) -> UserDB | None:
    return db.scalar(select(UserDB).where(func.lower(UserDB.email) == email.lower()))
