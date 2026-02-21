from sqlalchemy import select
from sqlalchemy.orm import Session

from models import OAuthAccounts, UserDB


def find_user(db: Session, email: str | None, username: str) -> UserDB | None:
    user = None
    if email:
        user = db.scalar(select(UserDB).where(UserDB.email == email))
    if user is None:
        user = db.scalar(select(UserDB).where(UserDB.username == username))
    return user


def get_user_by_username(db: Session, username: str) -> UserDB | None:
    return db.scalar(select(UserDB).where(UserDB.username == username))


def get_google_oauth_account(db: Session, user_id):
    return db.scalar(
        select(OAuthAccounts).where(
            OAuthAccounts.user_id == user_id,
            OAuthAccounts.provider == "google",
        )
    )
