-- =========================
-- Core tables
-- =========================

CREATE TABLE IF NOT EXISTS users (
  user_id      SERIAL PRIMARY KEY,
  username     VARCHAR NOT NULL UNIQUE,
  password     VARCHAR NOT NULL,
  email        VARCHAR NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  group_id    SERIAL PRIMARY KEY,
  name        VARCHAR NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users_group (
  user_id   INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  group_id  INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS preferences (
  user_id                  INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  weekly_digest_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  monthly_digest_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_minutes_default  INT NOT NULL DEFAULT 30,
  timezone                 TEXT
);

-- =========================
-- OAuth + calendar
-- =========================

CREATE TABLE IF NOT EXISTS oauth_accounts (
  oauth_accounts_id  SERIAL PRIMARY KEY,
  user_id            INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider           VARCHAR NOT NULL,
  provider_user_id   VARCHAR NOT NULL,
  email              VARCHAR,
  access_token       VARCHAR,
  refresh_token      VARCHAR,
  expires_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS calendar_connections (
  connection_id       SERIAL PRIMARY KEY,
  user_id             INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider            VARCHAR NOT NULL,
  provider_calendar_id VARCHAR NOT NULL,
  summary             TEXT,
  timezone            TEXT,
  is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_calendar_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_calendar_links (
  task_link_id       SERIAL PRIMARY KEY,
  task_id            INT NOT NULL,
  connection_id      INT NOT NULL,
  provider_event_id  TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at     TIMESTAMPTZ,
  prompt_hash        TEXT,
  sync_status        VARCHAR,
  sync_error         VARCHAR,
  UNIQUE (connection_id, provider_event_id)
);

-- =========================
-- Tasks
-- =========================

CREATE TABLE IF NOT EXISTS categories (
  category_id  SERIAL PRIMARY KEY,
  name         VARCHAR NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id          SERIAL PRIMARY KEY,
  due_date         TIMESTAMPTZ,
  name             VARCHAR NOT NULL,
  description      TEXT,
  priority         VARCHAR,
  category_id      INT REFERENCES categories(category_id) ON DELETE SET NULL,
  complete_date    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  assignees_to     INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_by       INT REFERENCES users(user_id) ON DELETE SET NULL,
  started_at       TIMESTAMPTZ,
  assignees_group  INT REFERENCES groups(group_id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_task (
  user_id  INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  task_id  INT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, task_id)
);

CREATE TABLE IF NOT EXISTS task_status (
  status_id  SERIAL PRIMARY KEY,
  task_id    INT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  name       VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS task_attachment (
  task_attachment_id  SERIAL PRIMARY KEY,
  task_id             INT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  url                 TEXT,
  file                TEXT,
  type                VARCHAR
);

-- Add the FKs that were deferred above (helps avoid ordering issues)
ALTER TABLE task_calendar_links
  ADD CONSTRAINT fk_task_calendar_links_task
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE;

ALTER TABLE task_calendar_links
  ADD CONSTRAINT fk_task_calendar_links_connection
  FOREIGN KEY (connection_id) REFERENCES calendar_connections(connection_id) ON DELETE CASCADE;

-- =========================
-- Reminders + invitations
-- =========================

CREATE TABLE IF NOT EXISTS reminders (
  reminder_id         SERIAL PRIMARY KEY,
  group_id            INT REFERENCES groups(group_id) ON DELETE CASCADE,
  user_id             INT REFERENCES users(user_id) ON DELETE CASCADE,
  minutes_before_due  INT NOT NULL,
  active              BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS invitations (
  invitation_id  SERIAL PRIMARY KEY,
  group_id       INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  code           INT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ,
  created_by     INT REFERENCES users(user_id) ON DELETE SET NULL
);

-- =========================
-- AI summaries + reports
-- =========================

CREATE TABLE IF NOT EXISTS ai_summaries (
  ai_summary_id  SERIAL PRIMARY KEY,
  group_id       INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  week_start     DATE NOT NULL,
  content        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  model          VARCHAR,
  prompt_hash    TEXT,
  UNIQUE (group_id, week_start)
);

CREATE TABLE IF NOT EXISTS daily_reports (
  daily_report_id  SERIAL PRIMARY KEY,
  group_id         INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  stats_json       JSONB,
  summary          TEXT,
  UNIQUE (group_id, date)
);

CREATE TABLE IF NOT EXISTS weekly_reports (
  weekly_report_id  SERIAL PRIMARY KEY,
  group_id          INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  week_start        DATE NOT NULL,
  week_end          DATE NOT NULL,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  stats_json        JSONB,
  summary           TEXT,
  UNIQUE (group_id, week_start)
);

CREATE TABLE IF NOT EXISTS monthly_reports (
  monthly_report_id  SERIAL PRIMARY KEY,
  group_id           INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  month_start        DATE NOT NULL,
  month_end          DATE NOT NULL,
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  stats_json         JSONB,
  summary            TEXT,
  UNIQUE (group_id, month_start)
);

-- =========================
-- Helpful indexes
-- =========================

CREATE INDEX IF NOT EXISTS idx_tasks_due_date        ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assignees_to    ON tasks(assignees_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assignees_group ON tasks(assignees_group);
CREATE INDEX IF NOT EXISTS idx_task_status_task      ON task_status(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attach_task      ON task_attachment(task_id);
CREATE INDEX IF NOT EXISTS idx_task_cal_links_task   ON task_calendar_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_cal_links_conn   ON task_calendar_links(connection_id);

