
WITH target AS (
  SELECT u.user_id, uh.household_id
  FROM users u
  JOIN LATERAL (
    SELECT uh.household_id
    FROM users_households uh
    JOIN households h ON h.household_id = uh.household_id
    WHERE uh.user_id = u.user_id
    ORDER BY h.created_at ASC
    LIMIT 1
  ) uh ON true
  WHERE u.user_id = '4fb5097a-d4ae-43c8-ada2-169d98cd58ee'
),
picked_category AS (
  SELECT
    t.user_id,
    t.household_id,
    (
      SELECT c.category_id
      FROM categories c
      WHERE c.household_id = t.household_id
      LIMIT 1
    ) AS category_id
  FROM target t
)
INSERT INTO tasks (
  task_id, household_id, name, description, status, priority,
  category_id, due_date, assigns_to, created_by, created_at
)
SELECT
  gen_random_uuid(),
  pc.household_id,
  CONCAT('Auto-task #', gs.i),
  CONCAT('Generated seed task ', gs.i, ' for user ', pc.user_id),
  'todo',
  CASE
    WHEN gs.i <= 5 THEN 'high'
    WHEN gs.i <= 14 THEN 'medium'
    ELSE 'low'
  END,
  pc.category_id,
  NOW() + (gs.i * INTERVAL '1 day'),
  pc.user_id,
  pc.user_id,
  NOW()
FROM picked_category pc
CROSS JOIN generate_series(1, 20) AS gs(i);











-- NOTE: Gammal kod. Kör den ovan istället
INSERT INTO tasks (
  due_date,
  name,
  description,
  status,
  priority,
  "order",
  assigns_to,
  created_by,
  household_id
)
SELECT
  NOW() + (i || ' days')::interval,
  'Task ' || i,
  'Auto generated task',
  'todo',
  CASE WHEN i % 3 = 0 THEN 'high'
       WHEN i % 2 = 0 THEN 'medium'
       ELSE 'low' END,
  i,
  'caf2c1d0-893a-4d23-9779-7183fd782a4c', -- user_id -> assigns_to
  'caf2c1d0-893a-4d23-9779-7183fd782a4c', -- user_id -> created_by
  '648a6fbe-d0ea-4e3f-b6fd-0e1d90b5e65a' -- household_id
FROM generate_series(1,30) AS s(i);

