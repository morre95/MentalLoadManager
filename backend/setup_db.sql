-- =========================
-- Core: users + households
-- =========================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       VARCHAR(100) NOT NULL,
  password       VARCHAR(255),                 -- nullable om du kör OAuth-only
  email          VARCHAR(255) UNIQUE,
  display_name   VARCHAR(100),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  last_login     TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS households (
  household_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(200) NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many: users <-> households
CREATE TABLE IF NOT EXISTS users_households (
  user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  household_id       UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  role           VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  PRIMARY KEY (user_id, household_id)
);

-- ALTER TABLE users_households ALTER COLUMN role SET DEFAULT 'member'

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_households_single_owner
ON users_households (household_id)
WHERE role = 'owner';

-- Preferences per user (1:1)
CREATE TABLE IF NOT EXISTS preferences (
  user_id                UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  weekly_digest_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  monthly_digest_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_minutes_default INT NOT NULL DEFAULT 60,
  timezone               TEXT DEFAULT 'UTC',
  date_format            TEXT NOT NULL DEFAULT 'mdy',
  first_day_of_week      TEXT NOT NULL DEFAULT 'monday'
);



-- =========================
-- OAuth + Calendar sync
-- =========================

CREATE TABLE IF NOT EXISTS oauth_accounts (
  oauth_accounts_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider          VARCHAR(50) NOT NULL,       -- 'google', 'facebook'
  provider_user_id  VARCHAR(255) NOT NULL,
  email             VARCHAR(255),
  access_token      TEXT,
  refresh_token     TEXT,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS password_refresh_tokens (
  token_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  family_id             UUID NOT NULL,
  token_hash            VARCHAR(64) NOT NULL UNIQUE,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  last_used_at          TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  replaced_by_token_id  UUID REFERENCES password_refresh_tokens(token_id) ON DELETE SET NULL,
  created_ip            VARCHAR(64),
  created_user_agent    VARCHAR(512)
);


CREATE TABLE IF NOT EXISTS calendar_connections (
  calendar_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider       VARCHAR(50) NOT NULL,          -- 'google'
  calendar_ext_id TEXT NOT NULL,                -- t.ex. 'primary' eller google calendarId
  summary        TEXT,
  timezone       TEXT DEFAULT 'UTC',
  is_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- Tasks + related entities
-- =========================

CREATE TABLE IF NOT EXISTS categories (
  category_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (household_id, name)
);

-- ALTER TABLE categories
  -- ADD CONSTRAINT uq_categories_household_name UNIQUE (household_id, name);
--



CREATE TABLE IF NOT EXISTS tasks (
  task_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  due_date       TIMESTAMPTZ,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  status         VARCHAR(50) NOT NULL CHECK (status IN ('todo', 'in_progress', 'done', 'on_hold', 'archive')),
  priority       VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  recurrence_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_frequency VARCHAR(20) CHECK (recurrence_frequency IN ('daily', 'weekly', 'monthly')),
  recurrence_interval INTEGER CHECK (recurrence_interval IS NULL OR recurrence_interval > 0),
  recurrence_parent_task_id UUID REFERENCES tasks(task_id) ON DELETE SET NULL,
  recurrence_exceptions DATE[],
  "order"        INTEGER,
  category_id    UUID REFERENCES categories(category_id) ON DELETE SET NULL,
  complete_date  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  assigns_to     UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
  started_at     TIMESTAMPTZ,
  household_id UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
  goal_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  current_value   INTEGER NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  target_value    INTEGER NOT NULL CHECK (target_value > 0),
  tracking_style  VARCHAR(20) NOT NULL CHECK (tracking_style IN ('daily', 'weekly', 'monthly', 'total')),
  progress_data   JSON NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_household_id ON tasks(household_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigns_to ON tasks(assigns_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_household_status ON tasks(household_id, status);

-- Junction table: tasks <-> calendar_connections (M:N)
CREATE TABLE IF NOT EXISTS task_calendar_links (
  task_link_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  connection_id     UUID NOT NULL REFERENCES calendar_connections(calendar_id) ON DELETE CASCADE,
  provider_event_id TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at    TIMESTAMPTZ,
  prompt_hash       TEXT,
  sync_status       VARCHAR(50) DEFAULT 'NOT_SYNCED',
  sync_error        TEXT,
  UNIQUE (task_id, connection_id)
);

-- Optional: users <-> tasks (assignment/history) junction (om du vill behålla den)
CREATE TABLE IF NOT EXISTS user_task (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, task_id)
);

-- Attachments
CREATE TABLE IF NOT EXISTS task_attachment (
  task_attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id            UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  url                TEXT,
  file               TEXT,
  type               VARCHAR(50)
);

-- Invitations to households
CREATE TABLE IF NOT EXISTS invitations (
  invitation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id       UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  code           VARCHAR(100) NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ,
  created_by     UUID REFERENCES users(user_id) ON DELETE SET NULL
);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  reminder_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  minutes_before_due INT NOT NULL DEFAULT 60,
  active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS mood_entries (
  mood_entry_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  entry_date         DATE NOT NULL,
  color_token        VARCHAR(50) NOT NULL CHECK (char_length(color_token) > 0),
  mood_label         VARCHAR(50),
  weekly_region_id   VARCHAR(50),
  monthly_region_id  VARCHAR(50),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_mood_entries_user_date UNIQUE (user_id, entry_date)
);

-- =========================
-- Reports + AI summaries
-- =========================

CREATE TABLE IF NOT EXISTS weekly_reports (
  weekly_report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  week_start       DATE NOT NULL,
  week_end         DATE NOT NULL,
  granted_at       TIMESTAMPTZ DEFAULT NOW(),
  stats_json       JSONB,
  summary          TEXT
);

CREATE TABLE IF NOT EXISTS monthly_reports (
  monthly_report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  month_start       DATE NOT NULL,
  month_end         DATE NOT NULL,
  granted_at        TIMESTAMPTZ DEFAULT NOW(),
  stats_json        JSONB,
  summary           TEXT
);

CREATE TABLE IF NOT EXISTS daily_reports (
  daily_report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  granted_at      TIMESTAMPTZ DEFAULT NOW(),
  stats_json      JSONB,
  summary         TEXT
);

CREATE TABLE IF NOT EXISTS ai_summaries (
  ai_summary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  week_start      DATE,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  model           VARCHAR(100),
  prompt_hash     TEXT
);

CREATE TABLE IF NOT EXISTS analytics_ai_insights_cache (
  analytics_ai_insight_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  timeframe VARCHAR(10) NOT NULL,
  input_hash TEXT NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  model VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_ai_questions_cache (
  analytics_ai_question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  timeframe VARCHAR(10) NOT NULL,
  question TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  model VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goal_ai_checkins_cache (
  goal_ai_checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
  input_hash TEXT NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  model VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goal_history (
  goal_history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  tracking_style VARCHAR(20) NOT NULL,
  period_key VARCHAR(40) NOT NULL,
  period_started_at TIMESTAMPTZ,
  period_ended_at TIMESTAMPTZ,
  current_value INTEGER NOT NULL,
  target_value INTEGER NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS achievement_unlocks (
  achievement_unlock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  achievement_id VARCHAR(120) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(80) NOT NULL,
  rarity VARCHAR(20) NOT NULL,
  completion_key VARCHAR(255) NOT NULL,
  entity_id VARCHAR(120),
  unlocked_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS contact_messages (
  contact_message_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  name                VARCHAR(200) NOT NULL,
  email               VARCHAR(320) NOT NULL,
  message             TEXT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- Helpful indexes
-- =========================

CREATE INDEX IF NOT EXISTS idx_tasks_group_due ON tasks(household_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigns_to);
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent ON tasks(recurrence_parent_task_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_date ON mood_entries(user_id, entry_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_links_connection ON task_calendar_links(connection_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_password_refresh_tokens_user_id ON password_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_refresh_tokens_family_id ON password_refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_password_refresh_tokens_expires_at ON password_refresh_tokens(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_analytics_ai_insights_cache_lookup
ON analytics_ai_insights_cache(household_id, timeframe, input_hash);
CREATE INDEX IF NOT EXISTS idx_analytics_ai_insights_cache_household_created
ON analytics_ai_insights_cache(household_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_analytics_ai_questions_cache_lookup
ON analytics_ai_questions_cache(household_id, timeframe, input_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_goal_ai_checkins_cache_lookup
ON goal_ai_checkins_cache(goal_id, input_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_goal_history_goal_period
ON goal_history(goal_id, period_key);
CREATE INDEX IF NOT EXISTS idx_goal_history_user_created
ON goal_history(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_achievement_unlock_user_completion
ON achievement_unlocks(user_id, completion_key);
CREATE INDEX IF NOT EXISTS idx_achievement_unlocks_user_unlocked
ON achievement_unlocks(user_id, unlocked_at DESC);
