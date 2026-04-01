-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Physical Resources, Staff, Skills & Shifts
-- Run once after add_scheduling_tables migration.
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Physical Resources ─────────────────────────────────────────────────────

INSERT INTO resources (name, type, total_count) VALUES
    ('Hair Chairs',    'hair_chair',    4),
    ('Massage Seats',  'massage_chair', 2),
    ('Wash Sink',      'sink',          1),
    ('Spa Rooms',      'spa_room',      3)
ON CONFLICT DO NOTHING;

-- ── 2. Map resource_type onto every service by category ──────────────────────
--
--  hair_chair   → Haircut, Hair Colourings, Make Up, Kids (haircut), Beard
--  massage_chair→ Head Oil Massage
--  sink         → Pedicure, Manicure, Hair Wash & Conditioning, Kids Hair Wash
--  spa_room     → De-Tan, Clean Up, Hair Treatment

UPDATE services SET resource_type = 'hair_chair'
WHERE category_id IN (
    SELECT category_id FROM categories
    WHERE name IN ('Haircut', 'Hair Colourings', 'Make Up', 'Beard')
);

-- Kids: haircut uses chair, wash uses sink — split by service name
UPDATE services SET resource_type = 'hair_chair'
WHERE category_id = (SELECT category_id FROM categories WHERE name = 'Kids')
  AND name = 'Kids Hair Cut (Under 10)';

UPDATE services SET resource_type = 'sink'
WHERE category_id = (SELECT category_id FROM categories WHERE name = 'Kids')
  AND name = 'Kids Hair Wash & Conditioning';

-- Hair Wash within Haircut category uses sink
UPDATE services SET resource_type = 'sink'
WHERE category_id = (SELECT category_id FROM categories WHERE name = 'Haircut')
  AND name = 'Hair Wash And Conditioning';

-- Pedicure and Manicure → sink
UPDATE services SET resource_type = 'sink'
WHERE category_id IN (
    SELECT category_id FROM categories WHERE name IN ('Pedicure', 'Manicure')
);

-- Head Oil Massage → massage chair
UPDATE services SET resource_type = 'massage_chair'
WHERE category_id = (SELECT category_id FROM categories WHERE name = 'Head Oil Massage');

-- De-Tan, Clean Up, Hair Treatment → spa room
UPDATE services SET resource_type = 'spa_room'
WHERE category_id IN (
    SELECT category_id FROM categories
    WHERE name IN ('De-Tan', 'Clean Up', 'Hair Treatment')
);

-- ── 3. Staff Members ──────────────────────────────────────────────────────────

INSERT INTO employees (name, is_active) VALUES
    ('Staff Member 1', TRUE),
    ('Staff Member 2', TRUE),
    ('Staff Member 3', TRUE)
ON CONFLICT DO NOTHING;

-- ── 4. Skills — all 3 staff can perform every enabled service ─────────────────

INSERT INTO employee_skills (employee_id, service_id)
SELECT e.employee_id, s.service_id
FROM employees e
CROSS JOIN services s
WHERE e.name IN ('Staff Member 1', 'Staff Member 2', 'Staff Member 3')
  AND s.is_enabled = TRUE
ON CONFLICT DO NOTHING;

-- ── 5. Shifts — Monday to Saturday, 09:00 – 23:00 ────────────────────────────
-- day_of_week: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

INSERT INTO employee_shifts (employee_id, day_of_week, start_time, end_time)
SELECT e.employee_id, d.day, '09:00'::time, '23:00'::time
FROM employees e
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6)) AS d(day)
WHERE e.name IN ('Staff Member 1', 'Staff Member 2', 'Staff Member 3')
ON CONFLICT DO NOTHING;
