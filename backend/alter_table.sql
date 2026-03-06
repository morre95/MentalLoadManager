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
