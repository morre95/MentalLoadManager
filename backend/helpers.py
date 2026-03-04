from uuid import UUID
from fastapi import Depends, HTTPException, status
import jwt
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timedelta, timezone
from pwdlib import PasswordHash
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import create_engine, func, or_, select
from sqlalchemy.orm import sessionmaker

from config import settings

from pwdlib.hashers.argon2 import Argon2Hasher
from models import User, UserDB, UserEmail, Base

password_hasher = PasswordHash([Argon2Hasher()])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")


SECRET_KEY = settings.JWT_SECRET
ALGORITHM = "HS256"

SessionLocal: sessionmaker | None = None


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql://") and "+psycopg" not in database_url:
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql+psycopg2://"):
        return database_url.replace(
            "postgresql+psycopg2://", "postgresql+psycopg://", 1
        )
    return database_url


database_url = normalize_database_url(settings.DATABASE_URL)
engine = create_engine(database_url, pool_pre_ping=True)


def setup_db_and_tables() -> None:
    Base.metadata.create_all(bind=engine)


def get_session_local() -> sessionmaker:
    global SessionLocal
    if SessionLocal is None:
        SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return SessionLocal


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hasher.verify(plain_password, hashed_password)


def authenticate_user(username: str, password: str) -> User | None:
    identifier = username.strip()
    if not identifier:
        return None
    normalized = identifier.lower()

    session_local = get_session_local()

    with session_local() as db:
        candidates = db.scalars(
            select(UserDB).where(
                or_(
                    func.lower(UserDB.username) == normalized,
                    func.lower(UserDB.email) == normalized,
                )
            )
        ).all()

        for user in candidates:
            if not user.password:
                continue
            if verify_password(password, user.password):
                user.last_login = datetime.now(timezone.utc)
                db.commit()
                return User(username=user.username, user_id=user.user_id)

        return None


def create_access_token(subject: str, expires_delta: timedelta) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _resolve_user_from_token_subject(db, subject: str | None) -> UserDB | None:
    if not subject:
        return None

    # JWT subject must be the immutable user_id.
    try:
        subject_uuid = UUID(str(subject))
    except (TypeError, ValueError):
        return None

    return db.scalar(select(UserDB).where(UserDB.user_id == subject_uuid))


def get_user_id_from_token(
    token: str | None = Depends(
        OAuth2PasswordBearer(tokenUrl="/api/token", auto_error=False)
    ),
) -> UUID | None:
    """Return the user_id if a valid token is present, otherwise None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        subject = payload.get("sub")
        if not subject:
            return None
    except (InvalidTokenError, ValueError):
        return None

    try:
        session_local = get_session_local()
    except RuntimeError:
        return None

    with session_local() as db:
        user = _resolve_user_from_token_subject(db, subject)
        return user.user_id if user else None


def get_current_user(token: str = Depends(oauth2_scheme)) -> UserEmail:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        subject = payload.get("sub")
        if not subject:
            raise ValueError("Missing subject")
    except (InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        session_local = get_session_local()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    with session_local() as db:
        user = _resolve_user_from_token_subject(db, subject)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return UserEmail(
            username=user.username,
            user_id=user.user_id,
            email=user.email,
            display_name=user.display_name,
        )
