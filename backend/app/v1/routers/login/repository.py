from sqlalchemy import select
from sqlalchemy.orm import Session

from app.v1.models import LoginAttempt, OAuthAccounts, UserDB


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


def get_login_attempt(
    db: Session,
    *,
    username_key: str,
    ip_address: str,
) -> LoginAttempt | None:
    return db.scalar(
        select(LoginAttempt).where(
            LoginAttempt.username_key == username_key,
            LoginAttempt.ip_address == ip_address,
        )
    )
