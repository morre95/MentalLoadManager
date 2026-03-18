from uuid import UUID
from fastapi import Depends, HTTPException, Request, status
import jwt
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timedelta, timezone
from pwdlib import PasswordHash
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import create_engine, func, inspect, or_, select, text
from sqlalchemy.orm import sessionmaker

from app.v1.config import settings

from pwdlib.hashers.argon2 import Argon2Hasher
from app.v1.models import User, UserDB, UserEmail, Base

password_hasher = PasswordHash([Argon2Hasher()])
ACCESS_TOKEN_COOKIE_KEY = "access_token"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/token", auto_error=False)


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
    inspector = inspect(engine)

    try:
        task_columns = {column["name"] for column in inspector.get_columns("tasks")}
    except Exception:
        task_columns = set()

    try:
        goal_columns = {column["name"] for column in inspector.get_columns("goals")}
    except Exception:
        goal_columns = set()

    if "progress_data" not in goal_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE goals ADD COLUMN IF NOT EXISTS progress_data JSON NOT NULL DEFAULT '{}'"
                )
            )

    try:
        ai_summary_columns = {
            column["name"] for column in inspector.get_columns("ai_summaries")
        }
    except Exception:
        ai_summary_columns = set()

    try:
        notification_setting_columns = {
            column["name"] for column in inspector.get_columns("notification_settings")
        }
    except Exception:
        notification_setting_columns = set()

    with engine.begin() as connection:
        if "recurrence_enabled" not in task_columns:
            connection.execute(
                text(
                    "ALTER TABLE tasks "
                    "ADD COLUMN IF NOT EXISTS recurrence_enabled BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
        if "recurrence_frequency" not in task_columns:
            connection.execute(
                text(
                    "ALTER TABLE tasks "
                    "ADD COLUMN IF NOT EXISTS recurrence_frequency VARCHAR(20)"
                )
            )
        if "recurrence_interval" not in task_columns:
            connection.execute(
                text(
                    "ALTER TABLE tasks "
                    "ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER"
                )
            )
        if "recurrence_parent_task_id" not in task_columns:
            connection.execute(
                text(
                    "ALTER TABLE tasks "
                    "ADD COLUMN IF NOT EXISTS recurrence_parent_task_id UUID "
                    "REFERENCES tasks(task_id) ON DELETE SET NULL"
                )
            )
        if "recurrence_exceptions" not in task_columns:
            connection.execute(
                text(
                    "ALTER TABLE tasks "
                    "ADD COLUMN IF NOT EXISTS recurrence_exceptions DATE[]"
                )
            )
        connection.execute(
            text(
                "ALTER TABLE tasks "
                "DROP CONSTRAINT IF EXISTS tasks_recurrence_frequency_check"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE tasks "
                "ADD CONSTRAINT tasks_recurrence_frequency_check "
                "CHECK (recurrence_frequency IS NULL OR recurrence_frequency IN ('daily', 'weekly', 'monthly'))"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE tasks "
                "DROP CONSTRAINT IF EXISTS tasks_recurrence_interval_check"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE tasks "
                "ADD CONSTRAINT tasks_recurrence_interval_check "
                "CHECK (recurrence_interval IS NULL OR recurrence_interval > 0)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent "
                "ON tasks(recurrence_parent_task_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_tasks_household_id "
                "ON tasks(household_id)"
            )
        )
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)")
        )
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS idx_tasks_assigns_to ON tasks(assigns_to)")
        )
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)")
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_tasks_household_status "
                "ON tasks(household_id, status)"
            )
        )
        if "achievement_notifications" not in notification_setting_columns:
            connection.execute(
                text(
                    "ALTER TABLE notification_settings "
                    "ADD COLUMN IF NOT EXISTS achievement_notifications BOOLEAN NOT NULL DEFAULT TRUE"
                )
            )
        if "week_end" not in ai_summary_columns:
            connection.execute(
                text("ALTER TABLE ai_summaries ADD COLUMN IF NOT EXISTS week_end DATE")
            )
        if "status" not in ai_summary_columns:
            connection.execute(
                text(
                    "ALTER TABLE ai_summaries ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'"
                )
            )
        if "error" not in ai_summary_columns:
            connection.execute(
                text("ALTER TABLE ai_summaries ADD COLUMN IF NOT EXISTS error TEXT")
            )
        connection.execute(
            text(
                "UPDATE ai_summaries "
                "SET week_end = week_start + INTERVAL '7 days' "
                "WHERE week_end IS NULL AND week_start IS NOT NULL"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS analytics_ai_insights_cache ("
                "  analytics_ai_insight_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"
                "  household_id UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,"
                "  timeframe VARCHAR(10) NOT NULL,"
                "  input_hash TEXT NOT NULL,"
                "  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,"
                "  model VARCHAR(100),"
                "  created_at TIMESTAMPTZ DEFAULT NOW(),"
                "  updated_at TIMESTAMPTZ DEFAULT NOW()"
                ")"
            )
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_analytics_ai_insights_cache_lookup "
                "ON analytics_ai_insights_cache(household_id, timeframe, input_hash)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_analytics_ai_insights_cache_household_created "
                "ON analytics_ai_insights_cache(household_id, created_at DESC)"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE analytics_ai_insights_cache "
                "ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE analytics_ai_insights_cache "
                "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS analytics_ai_questions_cache ("
                "  analytics_ai_question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"
                "  household_id UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,"
                "  timeframe VARCHAR(10) NOT NULL,"
                "  question TEXT NOT NULL,"
                "  input_hash TEXT NOT NULL,"
                "  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,"
                "  model VARCHAR(100),"
                "  created_at TIMESTAMPTZ DEFAULT NOW(),"
                "  updated_at TIMESTAMPTZ DEFAULT NOW()"
                ")"
            )
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_analytics_ai_questions_cache_lookup "
                "ON analytics_ai_questions_cache(household_id, timeframe, input_hash)"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE analytics_ai_questions_cache "
                "ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE analytics_ai_questions_cache "
                "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS goal_ai_checkins_cache ("
                "  goal_ai_checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"
                "  goal_id UUID NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,"
                "  input_hash TEXT NOT NULL,"
                "  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,"
                "  model VARCHAR(100),"
                "  created_at TIMESTAMPTZ DEFAULT NOW(),"
                "  updated_at TIMESTAMPTZ DEFAULT NOW()"
                ")"
            )
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_goal_ai_checkins_cache_lookup "
                "ON goal_ai_checkins_cache(goal_id, input_hash)"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE goal_ai_checkins_cache "
                "ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE goal_ai_checkins_cache "
                "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS goal_history ("
                "  goal_history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"
                "  goal_id UUID NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,"
                "  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,"
                "  tracking_style VARCHAR(20) NOT NULL,"
                "  period_key VARCHAR(40) NOT NULL,"
                "  period_started_at TIMESTAMPTZ,"
                "  period_ended_at TIMESTAMPTZ,"
                "  current_value INTEGER NOT NULL,"
                "  target_value INTEGER NOT NULL,"
                "  completed BOOLEAN NOT NULL DEFAULT FALSE,"
                "  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,"
                "  created_at TIMESTAMPTZ DEFAULT NOW()"
                ")"
            )
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_goal_history_goal_period "
                "ON goal_history(goal_id, period_key)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_goal_history_user_created "
                "ON goal_history(user_id, created_at DESC)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS achievement_unlocks ("
                "  achievement_unlock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"
                "  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,"
                "  achievement_id VARCHAR(120) NOT NULL,"
                "  title VARCHAR(255) NOT NULL,"
                "  category VARCHAR(80) NOT NULL,"
                "  rarity VARCHAR(20) NOT NULL,"
                "  completion_key VARCHAR(255) NOT NULL,"
                "  entity_id VARCHAR(120),"
                "  unlocked_at TIMESTAMPTZ DEFAULT NOW()"
                ")"
            )
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_achievement_unlock_user_completion "
                "ON achievement_unlocks(user_id, completion_key)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_achievement_unlocks_user_unlocked "
                "ON achievement_unlocks(user_id, unlocked_at DESC)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS mood_tracker_artworks ("
                "  mood_tracker_artwork_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"
                "  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,"
                "  period_type VARCHAR(20) NOT NULL,"
                "  period_key VARCHAR(40) NOT NULL,"
                "  cycle_order INTEGER,"
                "  start_date DATE NOT NULL,"
                "  end_date DATE NOT NULL,"
                "  image_id VARCHAR(80),"
                "  source VARCHAR(20),"
                "  status VARCHAR(20) NOT NULL DEFAULT 'pending',"
                "  error TEXT,"
                "  svg_markup TEXT,"
                "  region_ids JSONB NOT NULL DEFAULT '[]'::jsonb,"
                "  prompt_version VARCHAR(40),"
                "  generated_at TIMESTAMPTZ,"
                "  created_at TIMESTAMPTZ DEFAULT NOW(),"
                "  updated_at TIMESTAMPTZ DEFAULT NOW()"
                ")"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE mood_tracker_artworks ADD COLUMN IF NOT EXISTS cycle_order INTEGER"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE mood_tracker_artworks ADD COLUMN IF NOT EXISTS image_id VARCHAR(80)"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE mood_tracker_artworks ADD COLUMN IF NOT EXISTS source VARCHAR(20)"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE mood_tracker_artworks ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE mood_tracker_artworks ADD COLUMN IF NOT EXISTS error TEXT"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE mood_tracker_artworks ADD COLUMN IF NOT EXISTS svg_markup TEXT"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE mood_tracker_artworks ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ"
            )
        )
        connection.execute(
            text(
                "WITH ranked AS ("
                "  SELECT mood_tracker_artwork_id, "
                "    ROW_NUMBER() OVER ("
                "      PARTITION BY period_type "
                "      ORDER BY created_at ASC, mood_tracker_artwork_id ASC"
                "    ) AS row_num "
                "  FROM mood_tracker_artworks "
                "  WHERE cycle_order IS NULL"
                ") "
                "UPDATE mood_tracker_artworks AS mta "
                "SET cycle_order = ranked.row_num "
                "FROM ranked "
                "WHERE mta.mood_tracker_artwork_id = ranked.mood_tracker_artwork_id"
            )
        )
        connection.execute(
            text(
                "DELETE FROM mood_tracker_artworks "
                "WHERE ctid IN ("
                "  SELECT ctid FROM ("
                "    SELECT ctid, "
                "      ROW_NUMBER() OVER ("
                "        PARTITION BY period_type, period_key "
                "        ORDER BY "
                "          CASE "
                "            WHEN status = 'completed' THEN 0 "
                "            WHEN status = 'in_progress' THEN 1 "
                "            WHEN status = 'pending' THEN 2 "
                "            ELSE 3 "
                "          END, "
                "          generated_at DESC NULLS LAST, "
                "          created_at ASC, "
                "          mood_tracker_artwork_id ASC"
                "      ) AS row_num "
                "    FROM mood_tracker_artworks"
                "  ) ranked "
                "  WHERE row_num > 1"
                ")"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE mood_tracker_artworks "
                "DROP CONSTRAINT IF EXISTS uq_mood_tracker_artworks_user_period"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE mood_tracker_artworks "
                "DROP COLUMN IF EXISTS user_id"
            )
        )
        connection.execute(
            text(
                "DROP INDEX IF EXISTS uq_mood_tracker_artworks_user_period"
            )
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_mood_tracker_artworks_period "
                "ON mood_tracker_artworks(period_type, period_key)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_mood_tracker_artworks_period_created "
                "ON mood_tracker_artworks(period_type, start_date, created_at DESC)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_mood_tracker_artworks_period_cycle_order "
                "ON mood_tracker_artworks(period_type, cycle_order)"
            )
        )


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


def _resolve_request_token(request: Request, bearer_token: str | None) -> str | None:
    if bearer_token:
        return bearer_token
    return request.cookies.get(ACCESS_TOKEN_COOKIE_KEY)


def get_user_id_from_token(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
) -> UUID | None:
    """Return the user_id if a valid token is present, otherwise None."""
    resolved_token = _resolve_request_token(request, token)
    if not resolved_token:
        return None
    try:
        payload = jwt.decode(resolved_token, SECRET_KEY, algorithms=[ALGORITHM])
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


def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
) -> UserEmail:
    resolved_token = _resolve_request_token(request, token)
    if not resolved_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(resolved_token, SECRET_KEY, algorithms=[ALGORITHM])
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
