from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from models import UserDB


def find_existing_user(db: Session, username: str, email: str | None) -> UserDB | None:
    duplicate_conditions = [UserDB.username == username]
    if email:
        duplicate_conditions.append(UserDB.email == email)

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
