-- =========================
-- Core: users + groups
-- =========================

CREATE TABLE IF NOT EXISTS users (
  user_id        SERIAL PRIMARY KEY,
  username       VARCHAR(100) NOT NULL,
  password       VARCHAR(255),                 -- nullable om du kör OAuth-only
  email          VARCHAR(255) UNIQUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  last_login     TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  group_id       SERIAL PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many: users <-> groups
CREATE TABLE IF NOT EXISTS users_group (
  user_id        INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  group_id       INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

-- Preferences per user (1:1)
CREATE TABLE IF NOT EXISTS preferences (
  user_id                INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  weekly_digest_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  monthly_digest_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_minutes_default INT NOT NULL DEFAULT 60,
  timezone               TEXT DEFAULT 'UTC'
);

-- =========================
-- OAuth + Calendar sync
-- =========================

CREATE TABLE IF NOT EXISTS oauth_accounts (
  oauth_accounts_id SERIAL PRIMARY KEY,
  user_id           INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS calendar_connections (
  calendar_id    SERIAL PRIMARY KEY,
  user_id        INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider       VARCHAR(50) NOT NULL,          -- 'google'
  calendar_ext_id TEXT NOT NULL,                -- t.ex. 'primary' eller google calendarId
  summary        TEXT,
  timezone       TEXT DEFAULT 'UTC',
  is_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table: tasks <-> calendar_connections (M:N)
CREATE TABLE IF NOT EXISTS task_calendar_links (
  task_link_id      SERIAL PRIMARY KEY,
  task_id           INT NOT NULL,
  connection_id     INT NOT NULL REFERENCES calendar_connections(calendar_id) ON DELETE CASCADE,
  provider_event_id TEXT,                       -- Google event id
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at    TIMESTAMPTZ,
  prompt_hash       TEXT,
  sync_status       VARCHAR(50) DEFAULT 'NOT_SYNCED',
  sync_error        TEXT,
  UNIQUE (task_id, connection_id)
);

-- =========================
-- Tasks + related entities
-- =========================

CREATE TABLE IF NOT EXISTS kategori (
  category_id   SERIAL PRIMARY KEY,
  group_id      INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id        SERIAL PRIMARY KEY,
  due_date       TIMESTAMPTZ,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  priority       VARCHAR(50),
  status         VARCHAR(50) NOT NULL CHECK (status IN ('todo', 'inprogress', 'dune', 'on_hold')),
  category_id    INT REFERENCES kategori(category_id) ON DELETE SET NULL,
  complete_date  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  assigns_to     INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_by     INT REFERENCES users(user_id) ON DELETE SET NULL,
  started_at     TIMESTAMPTZ,
  assigns_group  INT REFERENCES groups(group_id) ON DELETE CASCADE,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- FK from task_calendar_links.task_id -> tasks.task_id
ALTER TABLE task_calendar_links
  ADD CONSTRAINT fk_task_calendar_links_task
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE;

-- Optional: users <-> tasks (assignment/history) junction (om du vill behålla den)
CREATE TABLE IF NOT EXISTS user_task (
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  task_id INT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, task_id)
);

-- Status history / states for tasks
CREATE TABLE IF NOT EXISTS task_status (
  status_id  SERIAL PRIMARY KEY,
  task_id    INT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  name       VARCHAR(50) NOT NULL               -- TODO/DOING/DONE etc.
);

-- Attachments
CREATE TABLE IF NOT EXISTS task_attachment (
  task_attachment_id SERIAL PRIMARY KEY,
  task_id            INT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  url                TEXT,
  file               TEXT,
  type               VARCHAR(50)
);

-- Invitations to groups
CREATE TABLE IF NOT EXISTS invitations (
  invitation_id SERIAL PRIMARY KEY,
  group_id       INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  code           VARCHAR(100) NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ,
  created_by     INT REFERENCES users(user_id) ON DELETE SET NULL
);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  reminder_id       SERIAL PRIMARY KEY,
  group_id          INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_id           INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  minutes_before_due INT NOT NULL DEFAULT 60,
  active            BOOLEAN NOT NULL DEFAULT TRUE
);

-- =========================
-- Reports + AI summaries
-- =========================

CREATE TABLE IF NOT EXISTS weekly_reports (
  weekly_report_id SERIAL PRIMARY KEY,
  group_id         INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  week_start       DATE NOT NULL,
  week_end         DATE NOT NULL,
  granted_at       TIMESTAMPTZ DEFAULT NOW(),
  stats_json       JSONB,
  summary          TEXT
);

CREATE TABLE IF NOT EXISTS monthly_reports (
  monthly_report_id SERIAL PRIMARY KEY,
  group_id          INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  month_start       DATE NOT NULL,
  month_end         DATE NOT NULL,
  granted_at        TIMESTAMPTZ DEFAULT NOW(),
  stats_json        JSONB,
  summary           TEXT
);

CREATE TABLE IF NOT EXISTS daily_reports (
  daily_report_id SERIAL PRIMARY KEY,
  group_id        INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  granted_at      TIMESTAMPTZ DEFAULT NOW(),
  stats_json      JSONB,
  summary         TEXT
);

CREATE TABLE IF NOT EXISTS ai_summaries (
  ai_summarier_id SERIAL PRIMARY KEY,
  group_id        INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  week_start      DATE,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  model           VARCHAR(100),
  prompt_hash     TEXT
);

-- =========================
-- Helpful indexes
-- =========================

CREATE INDEX IF NOT EXISTS idx_tasks_group_due ON tasks(assigns_group, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigns_to);
CREATE INDEX IF NOT EXISTS idx_task_status_task ON task_status(task_id);
CREATE INDEX IF NOT EXISTS idx_links_connection ON task_calendar_links(connection_id);
