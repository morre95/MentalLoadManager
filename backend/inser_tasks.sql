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

