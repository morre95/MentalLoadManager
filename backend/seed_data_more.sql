-- =========================
-- SEED DATA
-- =========================
-- Kör denna fil efter setup_db.sql för att populera databasen med exempeldata

-- =========================
-- 1. USERS
-- =========================

INSERT INTO users (user_id, username, password, email, created_at, last_login) VALUES
  ('a1b2c3d4-1111-1111-1111-111111111111', 'anna_svensson', '$argon2id$v=19$m=65536,t=3,p=4$JOZVm9WlydNoZ+1P93jagw$sY+Fb6cf+KchVUl2xEVb838rxymuGT9QV3SvGGqlAzQ', 'anna.svensson@email.se', NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day'),
  ('a1b2c3d4-2222-2222-2222-222222222222', 'erik_johansson', '$argon2id$v=19$m=65536,t=3,p=4$JOZVm9WlydNoZ+1P93jagw$sY+Fb6cf+KchVUl2xEVb838rxymuGT9QV3SvGGqlAzQ', 'erik.johansson@email.se', NOW() - INTERVAL '25 days', NOW() - INTERVAL '2 hours'),
  ('a1b2c3d4-3333-3333-3333-333333333333', 'maria_andersson', '$argon2id$v=19$m=65536,t=3,p=4$JOZVm9WlydNoZ+1P93jagw$sY+Fb6cf+KchVUl2xEVb838rxymuGT9QV3SvGGqlAzQ', 'maria.andersson@email.se', NOW() - INTERVAL '20 days', NOW() - INTERVAL '3 days'),
  ('a1b2c3d4-4444-4444-4444-444444444444', 'lars_nilsson', '$argon2id$v=19$m=65536,t=3,p=4$JOZVm9WlydNoZ+1P93jagw$sY+Fb6cf+KchVUl2xEVb838rxymuGT9QV3SvGGqlAzQ', 'lars.nilsson@email.se', NOW() - INTERVAL '15 days', NOW() - INTERVAL '5 hours'),
  ('a1b2c3d4-5555-5555-5555-555555555555', 'karin_berg', '$argon2id$v=19$m=65536,t=3,p=4$JOZVm9WlydNoZ+1P93jagw$sY+Fb6cf+KchVUl2xEVb838rxymuGT9QV3SvGGqlAzQ', 'karin.berg@email.se', NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 hour');

-- =========================
-- 2. HOUSEHOLDS
-- =========================

INSERT INTO households (household_id, name, created_at) VALUES
  ('b1b2b3b4-1111-1111-1111-111111111111', 'Familjen Svensson-Johansson', NOW() - INTERVAL '30 days'),
  ('b1b2b3b4-2222-2222-2222-222222222222', 'Anderssonshuset', NOW() - INTERVAL '20 days'),
  ('b1b2b3b4-3333-3333-3333-333333333333', 'Kollektivet Södermalm', NOW() - INTERVAL '15 days');

-- =========================
-- 3. USERS <-> HOUSEHOLDS
-- =========================

INSERT INTO users_households (user_id, household_id) VALUES
  -- Familjen Svensson-Johansson: Anna & Erik
  ('a1b2c3d4-1111-1111-1111-111111111111', 'b1b2b3b4-1111-1111-1111-111111111111'),
  ('a1b2c3d4-2222-2222-2222-222222222222', 'b1b2b3b4-1111-1111-1111-111111111111'),
  
  -- Anderssonshuset: Maria & Lars
  ('a1b2c3d4-3333-3333-3333-333333333333', 'b1b2b3b4-2222-2222-2222-222222222222'),
  ('a1b2c3d4-4444-4444-4444-444444444444', 'b1b2b3b4-2222-2222-2222-222222222222'),
  
  -- Kollektivet: Karin, Erik, Lars (shared)
  ('a1b2c3d4-5555-5555-5555-555555555555', 'b1b2b3b4-3333-3333-3333-333333333333'),
  ('a1b2c3d4-2222-2222-2222-222222222222', 'b1b2b3b4-3333-3333-3333-333333333333'),
  ('a1b2c3d4-4444-4444-4444-444444444444', 'b1b2b3b4-3333-3333-3333-333333333333');

-- =========================
-- 4. PREFERENCES
-- =========================

INSERT INTO preferences (user_id, weekly_digest_enabled, monthly_digest_enabled, reminder_minutes_default, timezone) VALUES
  ('a1b2c3d4-1111-1111-1111-111111111111', TRUE, TRUE, 60, 'Europe/Stockholm'),
  ('a1b2c3d4-2222-2222-2222-222222222222', TRUE, FALSE, 30, 'Europe/Stockholm'),
  ('a1b2c3d4-3333-3333-3333-333333333333', FALSE, TRUE, 120, 'Europe/Stockholm'),
  ('a1b2c3d4-4444-4444-4444-444444444444', TRUE, TRUE, 60, 'Europe/Stockholm'),
  ('a1b2c3d4-5555-5555-5555-555555555555', FALSE, FALSE, 15, 'Europe/Stockholm');

-- =========================
-- 5. OAUTH ACCOUNTS (exempel)
-- =========================

INSERT INTO oauth_accounts (oauth_accounts_id, user_id, provider, provider_user_id, email, access_token, expires_at) VALUES
  ('c1c2c3c4-1111-1111-1111-111111111111', 'a1b2c3d4-1111-1111-1111-111111111111', 'google', '112233445566778899', 'anna.svensson@gmail.com', 'ya29.a0AfH6SMBx...', NOW() + INTERVAL '1 hour'),
  ('c1c2c3c4-2222-2222-2222-222222222222', 'a1b2c3d4-2222-2222-2222-222222222222', 'google', '223344556677889900', 'erik.johansson@gmail.com', 'ya29.a0AfH6SMBy...', NOW() + INTERVAL '1 hour');

-- =========================
-- 6. CALENDAR CONNECTIONS
-- =========================

INSERT INTO calendar_connections (calendar_id, user_id, provider, calendar_ext_id, summary, timezone, is_enabled) VALUES
  ('d1d2d3d4-1111-1111-1111-111111111111', 'a1b2c3d4-1111-1111-1111-111111111111', 'google', 'primary', 'Anna - Primär kalender', 'Europe/Stockholm', TRUE),
  ('d1d2d3d4-2222-2222-2222-222222222222', 'a1b2c3d4-2222-2222-2222-222222222222', 'google', 'primary', 'Erik - Primär kalender', 'Europe/Stockholm', TRUE),
  ('d1d2d3d4-3333-3333-3333-333333333333', 'a1b2c3d4-1111-1111-1111-111111111111', 'google', 'family@group.calendar.google.com', 'Familjekalender', 'Europe/Stockholm', TRUE);

-- =========================
-- 7. CATEGORIES
-- =========================

INSERT INTO categories (category_id, household_id, name) VALUES
  -- Familjen Svensson-Johansson
  ('e1e2e3e4-1111-1111-1111-111111111111', 'b1b2b3b4-1111-1111-1111-111111111111', 'Hushåll'),
  ('e1e2e3e4-2222-2222-2222-222222222222', 'b1b2b3b4-1111-1111-1111-111111111111', 'Barnrelaterat'),
  ('e1e2e3e4-3333-3333-3333-333333333333', 'b1b2b3b4-1111-1111-1111-111111111111', 'Renovering'),
  ('e1e2e3e4-4444-4444-4444-444444444444', 'b1b2b3b4-1111-1111-1111-111111111111', 'Shopping'),
  
  -- Anderssonshuset
  ('e1e2e3e4-5555-5555-5555-555555555555', 'b1b2b3b4-2222-2222-2222-222222222222', 'Städning'),
  ('e1e2e3e4-6666-6666-6666-666666666666', 'b1b2b3b4-2222-2222-2222-222222222222', 'Trädgård'),
  ('e1e2e3e4-7777-7777-7777-777777777777', 'b1b2b3b4-2222-2222-2222-222222222222', 'Ekonomi'),
  
  -- Kollektivet
  ('e1e2e3e4-8888-8888-8888-888888888888', 'b1b2b3b4-3333-3333-3333-333333333333', 'Matlagning'),
  ('e1e2e3e4-9999-9999-9999-999999999999', 'b1b2b3b4-3333-3333-3333-333333333333', 'Städning'),
  ('e1e2e3e4-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1b2b3b4-3333-3333-3333-333333333333', 'Inköp');

-- =========================
-- 8. TASKS
-- =========================

INSERT INTO tasks (task_id, household_id, name, description, status, priority, category_id, due_date, assigns_to, created_by, created_at) VALUES
  -- Familjen Svensson-Johansson - Ongoing & Upcoming
  ('f1f2f3f4-1111-1111-1111-111111111111', 'b1b2b3b4-1111-1111-1111-111111111111', 'Köpa mat till helgen', 'Handla: mjölk, bröd, pasta, kyckling, grönsaker', 'todo', 'high', 'e1e2e3e4-4444-4444-4444-444444444444', NOW() + INTERVAL '2 days', 'a1b2c3d4-2222-2222-2222-222222222222', 'a1b2c3d4-1111-1111-1111-111111111111', NOW() - INTERVAL '1 day'),
  
  ('f1f2f3f4-2222-2222-2222-222222222222', 'b1b2b3b4-1111-1111-1111-111111111111', 'Hämta på dagis', 'Hämta Liam kl 16:30', 'todo', 'high', 'e1e2e3e4-2222-2222-2222-222222222222', NOW() + INTERVAL '6 hours', 'a1b2c3d4-1111-1111-1111-111111111111', 'a1b2c3d4-2222-2222-2222-222222222222', NOW() - INTERVAL '12 hours'),
  
  ('f1f2f3f4-3333-3333-3333-333333333333', 'b1b2b3b4-1111-1111-1111-111111111111', 'Måla om vardagsrummet', 'Väggfärg köpt, behöver maskeringstejp och nya penslar', 'in_progress', 'medium', 'e1e2e3e4-3333-3333-3333-333333333333', NOW() + INTERVAL '1 week', 'a1b2c3d4-2222-2222-2222-222222222222', 'a1b2c3d4-1111-1111-1111-111111111111', NOW() - INTERVAL '5 days'),
  
  ('f1f2f3f4-4444-4444-4444-444444444444', 'b1b2b3b4-1111-1111-1111-111111111111', 'Boka tandläkartid för barnen', NULL, 'todo', 'medium', 'e1e2e3e4-2222-2222-2222-222222222222', NOW() + INTERVAL '3 days', 'a1b2c3d4-1111-1111-1111-111111111111', 'a1b2c3d4-1111-1111-1111-111111111111', NOW() - INTERVAL '2 days'),
  
  -- Completed tasks
  ('f1f2f3f4-5555-5555-5555-555555555555', 'b1b2b3b4-1111-1111-1111-111111111111', 'Tvätta bilen', 'Bilvård invändigt och utvändigt', 'done', 'low', 'e1e2e3e4-1111-1111-1111-111111111111', NOW() - INTERVAL '2 days', 'a1b2c3d4-2222-2222-2222-222222222222', 'a1b2c3d4-2222-2222-2222-222222222222', NOW() - INTERVAL '5 days'),
  
  -- Anderssonshuset
  ('f1f2f3f4-6666-6666-6666-666666666666', 'b1b2b3b4-2222-2222-2222-222222222222', 'Klippa gräsmattan', 'Främre och bakre gården', 'todo', 'high', 'e1e2e3e4-6666-6666-6666-666666666666', NOW() + INTERVAL '1 day', 'a1b2c3d4-4444-4444-4444-444444444444', 'a1b2c3d4-3333-3333-3333-333333333333', NOW() - INTERVAL '1 day'),
  
  ('f1f2f3f4-7777-7777-7777-777777777777', 'b1b2b3b4-2222-2222-2222-222222222222', 'Betala elräkning', 'Förfaller 2024-02-15', 'todo', 'high', 'e1e2e3e4-7777-7777-7777-777777777777', NOW() + INTERVAL '4 days', 'a1b2c3d4-3333-3333-3333-333333333333', 'a1b2c3d4-3333-3333-3333-333333333333', NOW() - INTERVAL '3 days'),
  
  ('f1f2f3f4-8888-8888-8888-888888888888', 'b1b2b3b4-2222-2222-2222-222222222222', 'Dammsuга källaren', NULL, 'done', 'low', 'e1e2e3e4-5555-5555-5555-555555555555', NOW() - INTERVAL '1 day', 'a1b2c3d4-4444-4444-4444-444444444444', 'a1b2c3d4-3333-3333-3333-333333333333', NOW() - INTERVAL '3 days'),
  
  -- Kollektivet
  ('f1f2f3f4-9999-9999-9999-999999999999', 'b1b2b3b4-3333-3333-3333-333333333333', 'Laga middag (Torsdag)', 'Vegetarisk lasagne - 4 portioner', 'in_progress', 'high', 'e1e2e3e4-8888-8888-8888-888888888888', NOW() + INTERVAL '4 hours', 'a1b2c3d4-5555-5555-5555-555555555555', 'a1b2c3d4-5555-5555-5555-555555555555', NOW() - INTERVAL '2 hours'),
  
  ('f1f2f3f4-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1b2b3b4-3333-3333-3333-333333333333', 'Städa gemensamma ytor', 'Kök, vardagsrum, toalett', 'todo', 'medium', 'e1e2e3e4-9999-9999-9999-999999999999', NOW() + INTERVAL '2 days', 'a1b2c3d4-2222-2222-2222-222222222222', 'a1b2c3d4-4444-4444-4444-444444444444', NOW() - INTERVAL '1 day'),
  
  ('f1f2f3f4-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b1b2b3b4-3333-3333-3333-333333333333', 'Handla toalettpapper och diskmedel', NULL, 'todo', 'medium', 'e1e2e3e4-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NOW() + INTERVAL '3 days', 'a1b2c3d4-4444-4444-4444-444444444444', 'a1b2c3d4-2222-2222-2222-222222222222', NOW()),
  
  ('f1f2f3f4-cccc-cccc-cccc-cccccccccccc', 'b1b2b3b4-3333-3333-3333-333333333333', 'Laga diskmaskin', 'Ringer tekniker', 'on_hold', 'high', 'e1e2e3e4-9999-9999-9999-999999999999', NOW() + INTERVAL '5 days', 'a1b2c3d4-5555-5555-5555-555555555555', 'a1b2c3d4-5555-5555-5555-555555555555', NOW() - INTERVAL '2 days');

-- =========================
-- 9. TASK CALENDAR LINKS
-- =========================

INSERT INTO task_calendar_links (task_link_id, task_id, connection_id, provider_event_id, sync_status, last_synced_at) VALUES
  ('a1a2a3a4-1111-1111-1111-111111111111', 'f1f2f3f4-2222-2222-2222-222222222222', 'd1d2d3d4-1111-1111-1111-111111111111', 'evt_123abc', 'SYNCED', NOW() - INTERVAL '1 hour'),
  ('a1a2a3a4-2222-2222-2222-222222222222', 'f1f2f3f4-3333-3333-3333-333333333333', 'd1d2d3d4-3333-3333-3333-333333333333', 'evt_456def', 'SYNCED', NOW() - INTERVAL '4 days'),
  ('a1a2a3a4-3333-3333-3333-333333333333', 'f1f2f3f4-4444-4444-4444-444444444444', 'd1d2d3d4-1111-1111-1111-111111111111', NULL, 'NOT_SYNCED', NULL);

-- =========================
-- 10. USER_TASK (extra assignments)
-- =========================

INSERT INTO user_task (user_id, task_id) VALUES
  ('a1b2c3d4-2222-2222-2222-222222222222', 'f1f2f3f4-1111-1111-1111-111111111111'),
  ('a1b2c3d4-1111-1111-1111-111111111111', 'f1f2f3f4-2222-2222-2222-222222222222'),
  ('a1b2c3d4-2222-2222-2222-222222222222', 'f1f2f3f4-3333-3333-3333-333333333333'),
  ('a1b2c3d4-4444-4444-4444-444444444444', 'f1f2f3f4-6666-6666-6666-666666666666'),
  ('a1b2c3d4-5555-5555-5555-555555555555', 'f1f2f3f4-9999-9999-9999-999999999999');

-- =========================
-- 11. TASK ATTACHMENTS
-- =========================

INSERT INTO task_attachment (task_attachment_id, task_id, url, type) VALUES
  ('b1b2b3b4-1111-1111-1111-111111111111', 'f1f2f3f4-3333-3333-3333-333333333333', 'https://example.com/paint-color-sample.jpg', 'image'),
  ('b1b2b3b4-2222-2222-2222-222222222222', 'f1f2f3f4-3333-3333-3333-333333333333', 'https://example.com/room-measurements.pdf', 'document'),
  ('b1b2b3b4-3333-3333-3333-333333333333', 'f1f2f3f4-7777-7777-7777-777777777777', 'https://example.com/electricity-bill.pdf', 'document');

-- =========================
-- 12. INVITATIONS
-- =========================

INSERT INTO invitations (invitation_id, household_id, code, expires_at, created_by) VALUES
  ('c1c2c3c4-1111-1111-1111-111111111111', 'b1b2b3b4-1111-1111-1111-111111111111', 'FAMILY2024ABC', NOW() + INTERVAL '7 days', 'a1b2c3d4-1111-1111-1111-111111111111'),
  ('c1c2c3c4-2222-2222-2222-222222222222', 'b1b2b3b4-2222-2222-2222-222222222222', 'ANDERSSON2024XYZ', NOW() + INTERVAL '14 days', 'a1b2c3d4-3333-3333-3333-333333333333'),
  ('c1c2c3c4-3333-3333-3333-333333333333', 'b1b2b3b4-3333-3333-3333-333333333333', 'KOLLEKTIV2024QRS', NOW() + INTERVAL '30 days', 'a1b2c3d4-5555-5555-5555-555555555555');

-- =========================
-- 13. REMINDERS
-- =========================

INSERT INTO reminders (reminder_id, household_id, user_id, minutes_before_due, active) VALUES
  ('d1d2d3d4-1111-1111-1111-111111111111', 'b1b2b3b4-1111-1111-1111-111111111111', 'a1b2c3d4-1111-1111-1111-111111111111', 60, TRUE),
  ('d1d2d3d4-2222-2222-2222-222222222222', 'b1b2b3b4-1111-1111-1111-111111111111', 'a1b2c3d4-2222-2222-2222-222222222222', 30, TRUE),
  ('d1d2d3d4-3333-3333-3333-333333333333', 'b1b2b3b4-2222-2222-2222-222222222222', 'a1b2c3d4-3333-3333-3333-333333333333', 120, TRUE),
  ('d1d2d3d4-4444-4444-4444-444444444444', 'b1b2b3b4-3333-3333-3333-333333333333', 'a1b2c3d4-5555-5555-5555-555555555555', 15, TRUE);

-- =========================
-- 14. DAILY REPORTS
-- =========================

INSERT INTO daily_reports (daily_report_id, household_id, date, stats_json, summary) VALUES
  ('e1e2e3e4-1111-1111-1111-111111111111', 'b1b2b3b4-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '1 day', 
   '{"tasks_completed": 2, "tasks_created": 1, "active_users": 2}'::jsonb,
   'Bra dag! 2 uppgifter slutförda.'),
  
  ('e1e2e3e4-2222-2222-2222-222222222222', 'b1b2b3b4-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '1 day',
   '{"tasks_completed": 1, "tasks_created": 2, "active_users": 2}'::jsonb,
   'Städning genomförd, två nya uppgifter tillagda.');

-- =========================
-- 15. WEEKLY REPORTS
-- =========================

INSERT INTO weekly_reports (weekly_report_id, household_id, week_start, week_end, stats_json, summary) VALUES
  ('f1f2f3f4-1111-1111-1111-111111111111', 'b1b2b3b4-1111-1111-1111-111111111111', 
   CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE,
   '{"tasks_completed": 8, "tasks_created": 5, "completion_rate": 0.73, "most_active_user": "Anna"}'::jsonb,
   'Produktiv vecka med 73% slutförandegrad. Anna mest aktiv med 4 slutförda uppgifter.'),
  
  ('f1f2f3f4-2222-2222-2222-222222222222', 'b1b2b3b4-3333-3333-3333-333333333333',
   CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE,
   '{"tasks_completed": 6, "tasks_created": 7, "completion_rate": 0.60, "most_active_user": "Karin"}'::jsonb,
   'Bra vecka i kollektivet. Matlagning och städning flöt på bra.');

-- =========================
-- 16. MONTHLY REPORTS
-- =========================

INSERT INTO monthly_reports (monthly_report_id, household_id, month_start, month_end, stats_json, summary) VALUES
  ('a9a8a7a6-1111-1111-1111-111111111111', 'b1b2b3b4-1111-1111-1111-111111111111',
   DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'), 
   DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day',
   '{"tasks_completed": 32, "tasks_created": 38, "completion_rate": 0.84, "categories_used": 4, "avg_completion_days": 2.5}'::jsonb,
   'Stark månad med 84% slutförandegrad. Renoveringsprojektet går framåt.');

-- =========================
-- 17. AI SUMMARIES
-- =========================

INSERT INTO ai_summaries (ai_summary_id, household_id, week_start, content, model, prompt_hash) VALUES
  ('b9b8b7b6-1111-1111-1111-111111111111', 'b1b2b3b4-1111-1111-1111-111111111111',
   CURRENT_DATE - INTERVAL '7 days',
   'Denna vecka har familjen Svensson-Johansson gjort stora framsteg på renoveringen av vardagsrummet. Erik har målat två väggar och Anna har hanterat barnrelaterade sysslor effektivt. Hämtningar på dagis har fungerat smidigt enligt schema. Shopping-uppgiften för helgen är prioriterad.',
   'gpt-4',
   'hash_abc123'),
  
  ('b9b8b7b6-2222-2222-2222-222222222222', 'b1b2b3b4-3333-3333-3333-333333333333',
   CURRENT_DATE - INTERVAL '7 days',
   'Kollektivet på Södermalm har haft en fungerande vecka med rotationsschemat för matlagning. Karin lagade vegetarisk lasagne som uppskattades av alla. Städningen av gemensamma ytor är schemalagd och diskmaskinens reparation är bokad för nästa vecka.',
   'gpt-4',
   'hash_xyz789');


-- =========================
-- EXTRA: MORE TASKS FOR AI WEEKLY SUMMARY TESTING
-- =========================
-- Målet: skapa mer variation i "touched this week" (created/started/completed/due)
-- så att /api/ai/weekly-summary får mer att jobba med.
-- Alla datum är relativa (NOW()) så seed fungerar oavsett när du kör den.

-- 8.A Uppdatera några befintliga tasks så started_at/complete_date blir ifyllda
UPDATE tasks
SET started_at = NOW() - INTERVAL '4 days',
    updated_at = NOW() - INTERVAL '4 days'
WHERE task_id = 'f1f2f3f4-3333-3333-3333-333333333333'; -- Måla om vardagsrummet

UPDATE tasks
SET complete_date = NOW() - INTERVAL '2 days',
    updated_at = NOW() - INTERVAL '2 days'
WHERE task_id = 'f1f2f3f4-5555-5555-5555-555555555555'; -- Tvätta bilen

UPDATE tasks
SET started_at = NOW() - INTERVAL '10 hours',
    updated_at = NOW() - INTERVAL '10 hours'
WHERE task_id = 'f1f2f3f4-9999-9999-9999-999999999999'; -- Laga middag (Torsdag)

UPDATE tasks
SET complete_date = NOW() - INTERVAL '20 hours',
    updated_at = NOW() - INTERVAL '20 hours'
WHERE task_id = 'f1f2f3f4-8888-8888-8888-888888888888'; -- Dammsuga källaren

-- 8.B Nya tasks (3 hushåll, blandade status/prioritet, spridda över flera veckor)
INSERT INTO tasks (
  task_id, household_id, name, description, status, priority, category_id,
  due_date, assigns_to, created_by, created_at, started_at, complete_date, updated_at
) VALUES
  -- =========================
  -- Familjen Svensson-Johansson (household b1b2...1111)
  -- =========================

  -- Skapad denna vecka + due denna vecka
  ('f2f2f2f2-1111-1111-1111-111111111111', 'b1b2b3b4-1111-1111-1111-111111111111',
   'Beställa vinteroverall', 'Kolla storlek och beställ innan helgen.', 'todo', 'medium',
   'e1e2e3e4-2222-2222-2222-222222222222',
   NOW() + INTERVAL '3 days', 'a1b2c3d4-1111-1111-1111-111111111111', 'a1b2c3d4-1111-1111-1111-111111111111',
   NOW() - INTERVAL '2 days', NULL, NULL, NOW() - INTERVAL '2 days'),

  -- Skapad förra veckan men startad denna vecka (räknas som weekly_started)
  ('f2f2f2f2-1111-1111-1111-222222222222', 'b1b2b3b4-1111-1111-1111-111111111111',
   'Rensa förrådet', 'Sortera: släng/skänk/spara. Börja med hylla 1-2.', 'in_progress', 'high',
   'e1e2e3e4-1111-1111-1111-111111111111',
   NOW() + INTERVAL '6 days', 'a1b2c3d4-2222-2222-2222-222222222222', 'a1b2c3d4-2222-2222-2222-222222222222',
   NOW() - INTERVAL '9 days', NOW() - INTERVAL '3 days', NULL, NOW() - INTERVAL '3 days'),

  -- Skapad äldre men slutförd denna vecka (weekly_completed)
  ('f2f2f2f2-1111-1111-1111-333333333333', 'b1b2b3b4-1111-1111-1111-111111111111',
   'Fixa trasig kökslåda', 'Skruva åt gångjärn + byt skruv om behövs.', 'done', 'low',
   'e1e2e3e4-1111-1111-1111-111111111111',
   NOW() - INTERVAL '12 days', 'a1b2c3d4-2222-2222-2222-222222222222', 'a1b2c3d4-1111-1111-1111-111111111111',
   NOW() - INTERVAL '18 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

  -- Förfallodatum inom denna vecka men on_hold (weekly_due + backlog)
  ('f2f2f2f2-1111-1111-1111-444444444444', 'b1b2b3b4-1111-1111-1111-111111111111',
   'Ring försäkringsbolaget', 'Fråga om hemförsäkring och barnförsäkring.', 'on_hold', 'high',
   'e1e2e3e4-1111-1111-1111-111111111111',
   NOW() + INTERVAL '1 day', 'a1b2c3d4-1111-1111-1111-111111111111', 'a1b2c3d4-2222-2222-2222-222222222222',
   NOW() - INTERVAL '14 days', NULL, NULL, NOW() - INTERVAL '7 days'),

  -- =========================
  -- Anderssonshuset (household b1b2...2222)
  -- =========================

  -- Skapad denna vecka + done denna vecka
  ('f2f2f2f2-2222-2222-2222-111111111111', 'b1b2b3b4-2222-2222-2222-222222222222',
   'Boka sotare', 'Kontroll av skorsten innan mars.', 'done', 'medium',
   'e1e2e3e4-7777-7777-7777-777777777777',
   NOW() + INTERVAL '10 days', 'a1b2c3d4-3333-3333-3333-333333333333', 'a1b2c3d4-3333-3333-3333-333333333333',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

  -- Skapad äldre + due denna vecka (weekly_due)
  ('f2f2f2f2-2222-2222-2222-222222222222', 'b1b2b3b4-2222-2222-2222-222222222222',
   'Rensa hängrännor', 'Lövsäsong: kontrollera båda sidorna av huset.', 'todo', 'high',
   'e1e2e3e4-6666-6666-6666-666666666666',
   NOW() + INTERVAL '2 days', 'a1b2c3d4-4444-4444-4444-444444444444', 'a1b2c3d4-4444-4444-4444-444444444444',
   NOW() - INTERVAL '21 days', NULL, NULL, NOW() - INTERVAL '21 days'),

  -- Startad denna vecka men inte klar
  ('f2f2f2f2-2222-2222-2222-333333333333', 'b1b2b3b4-2222-2222-2222-222222222222',
   'Budgetgenomgång', 'Gå igenom utgifter och sätt sparmål.', 'in_progress', 'medium',
   'e1e2e3e4-7777-7777-7777-777777777777',
   NOW() + INTERVAL '5 days', 'a1b2c3d4-3333-3333-3333-333333333333', 'a1b2c3d4-3333-3333-3333-333333333333',
   NOW() - INTERVAL '6 days', NOW() - INTERVAL '1 day', NULL, NOW() - INTERVAL '1 day'),

  -- Overdue (due förra veckan) för att skapa backlog-signal
  ('f2f2f2f2-2222-2222-2222-444444444444', 'b1b2b3b4-2222-2222-2222-222222222222',
   'Byta glödlampor i hallen', '3 st spotlights.', 'todo', 'low',
   'e1e2e3e4-5555-5555-5555-555555555555',
   NOW() - INTERVAL '3 days', 'a1b2c3d4-4444-4444-4444-444444444444', 'a1b2c3d4-4444-4444-4444-444444444444',
   NOW() - INTERVAL '11 days', NULL, NULL, NOW() - INTERVAL '11 days'),

  -- =========================
  -- Kollektivet Södermalm (household b1b2...3333)
  -- =========================

  -- Skapad denna vecka (weekly_created)
  ('f2f2f2f2-3333-3333-3333-111111111111', 'b1b2b3b4-3333-3333-3333-333333333333',
   'Planera matsedel (nästa vecka)', 'Förslag + inköpslista. Ta hänsyn till allergier.', 'todo', 'medium',
   'e1e2e3e4-8888-8888-8888-888888888888',
   NOW() + INTERVAL '6 days', 'a1b2c3d4-5555-5555-5555-555555555555', 'a1b2c3d4-5555-5555-5555-555555555555',
   NOW() - INTERVAL '1 day', NULL, NULL, NOW() - INTERVAL '1 day'),

  -- Startad denna vecka
  ('f2f2f2f2-3333-3333-3333-222222222222', 'b1b2b3b4-3333-3333-3333-333333333333',
   'Fixa cykelpump', 'Kontrollera ventil + köpa adapter om behövs.', 'in_progress', 'low',
   'e1e2e3e4-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   NOW() + INTERVAL '4 days', 'a1b2c3d4-2222-2222-2222-222222222222', 'a1b2c3d4-2222-2222-2222-222222222222',
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '2 days', NULL, NOW() - INTERVAL '2 days'),

  -- Slutförd denna vecka men skapad tidigare
  ('f2f2f2f2-3333-3333-3333-333333333333', 'b1b2b3b4-3333-3333-3333-333333333333',
   'Köpa diskborstar', '2 st + svamp.', 'done', 'low',
   'e1e2e3e4-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   NOW() - INTERVAL '9 days', 'a1b2c3d4-4444-4444-4444-444444444444', 'a1b2c3d4-4444-4444-4444-444444444444',
   NOW() - INTERVAL '16 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

  -- On hold men due denna vecka
  ('f2f2f2f2-3333-3333-3333-444444444444', 'b1b2b3b4-3333-3333-3333-333333333333',
   'Förnya internetavtal', 'Jämför pris och bindningstid.', 'on_hold', 'medium',
   'e1e2e3e4-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   NOW() + INTERVAL '2 days', 'a1b2c3d4-5555-5555-5555-555555555555', 'a1b2c3d4-4444-4444-4444-444444444444',
   NOW() - INTERVAL '25 days', NULL, NULL, NOW() - INTERVAL '25 days');

-- Tips: Om du vill tvinga en viss vecka i testet:
-- POST /api/ai/weekly-summary  { "household_id": "...", "week_start": "YYYY-MM-DD" }


-- =========================
-- FÄRDIGT!
-- =========================
-- Seed-data har lagts till för alla tabeller.
-- Du kan nu testa dina queries och API-endpoints.
