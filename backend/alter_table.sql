ALTER TABLE tasks
DROP CONSTRAINT tasks_status_check;

ALTER TABLE tasks
ADD CONSTRAINT tasks_status_check
CHECK (status IN ('todo', 'in_progress', 'done', 'on_hold', 'archive'));

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure usernames remain unique (case-insensitive).
-- If this fails, first resolve duplicate usernames:
-- SELECT LOWER(username), COUNT(*) FROM users GROUP BY LOWER(username) HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users (LOWER(username));

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

CREATE INDEX IF NOT EXISTS idx_password_refresh_tokens_user_id ON password_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_refresh_tokens_family_id ON password_refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_password_refresh_tokens_expires_at ON password_refresh_tokens(expires_at);


ALTER TABLE categories
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS goals (
  goal_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  current_value   INTEGER NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  target_value    INTEGER NOT NULL CHECK (target_value > 0),
  tracking_style  VARCHAR(20) NOT NULL CHECK (tracking_style IN ('daily', 'weekly', 'monthly', 'total')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);

ALTER TABLE goals
DROP CONSTRAINT IF EXISTS goals_tracking_style_check;

ALTER TABLE goals
DROP CONSTRAINT IF EXISTS goals_tracking_style_valid;

ALTER TABLE goals
ADD CONSTRAINT goals_tracking_style_check
CHECK (tracking_style IN ('daily', 'weekly', 'monthly', 'total'));


ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS date_format TEXT NOT NULL DEFAULT 'mdy';

ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS first_day_of_week TEXT NOT NULL DEFAULT 'monday';

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

CREATE INDEX IF NOT EXISTS idx_mood_entries_user_date ON mood_entries(user_id, entry_date);


ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
