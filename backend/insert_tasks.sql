
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
  CASE WHEN i % 3 = 0 THEN 'todo'
       WHEN i % 2 = 0 THEN 'in_progress'
       ELSE 'done' END,
  CASE WHEN i % 3 = 0 THEN 'high'
       WHEN i % 2 = 0 THEN 'medium'
       ELSE 'low' END,
  i,
  '1a8f5d9d-8691-454c-a818-a3b4f533a7e7', -- user_id -> assigns_to
  '1a8f5d9d-8691-454c-a818-a3b4f533a7e7', -- user_id -> created_by
  '42f7ab97-1623-4eb9-b115-21332e655e2d' -- household_id
FROM generate_series(1,30) AS s(i);

-- NOTE: Slumpar ut status och prioritet
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
  -- Slumpmässig status
  (ARRAY['todo', 'in_progress', 'done'])[floor(random() * 3 + 1)],
  -- Slumpmässig prioritet
  (ARRAY['low', 'medium', 'high'])[floor(random() * 3 + 1)],
  i,
  '1a8f5d9d-8691-454c-a818-a3b4f533a7e7', -- user_id -> assigns_to
  '1a8f5d9d-8691-454c-a818-a3b4f533a7e7', -- user_id -> created_by
  '42f7ab97-1623-4eb9-b115-21332e655e2d' -- household_id
FROM generate_series(1,30) AS s(i);


-- NOTE: Samma som ovan fast enklare och som hämtar ut det första household_id
-- Om man inte vill hämta det första household_id vyt då ut raden:
-- (SELECT household_id FROM users_households WHERE user_id = val.uid LIMIT 1) till det id du vill anända
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
  'Auto generated Task with random status and priority',
  (ARRAY['todo', 'in_progress', 'done'])[floor(random() * 3 + 1)],
  (ARRAY['low', 'medium', 'high'])[floor(random() * 3 + 1)],
  i,
  val.uid,
  val.uid,
  (
    SELECT household_id 
    FROM users_households 
    WHERE user_id = val.uid 
    LIMIT 1
  )
FROM generate_series(1,30) AS s(i)
CROSS JOIN (SELECT '1a8f5d9d-8691-454c-a818-a3b4f533a7e7'::uuid AS uid) AS val;


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
  'Auto generated Task with random assignment',
  (ARRAY['todo', 'in_progress', 'done'])[floor(random() * 3 + 1)],
  (ARRAY['low', 'medium', 'high'])[floor(random() * 3 + 1)],
  i,
  -- Här hämtar vi en slumpmässig användare från samma hushåll där ca 20% blir NULL
  CASE WHEN random() > 0.2 THEN (
    SELECT user_id 
    FROM users_households 
    WHERE household_id = val.hid 
    ORDER BY random() 
    LIMIT 1
  ) ELSE NULL END,
  val.uid, -- Skapad av din specifika användare
  val.hid  -- Hushållet hämtas från variabeln nedan
FROM generate_series(1,30) AS s(i)
CROSS JOIN (
  SELECT 
    '4fb5097a-d4ae-43c8-ada2-169d98cd58ee'::uuid AS uid,
    (SELECT household_id FROM users_households WHERE user_id = '4fb5097a-d4ae-43c8-ada2-169d98cd58ee' ORDER BY random() LIMIT 1) AS hid
) AS val;

