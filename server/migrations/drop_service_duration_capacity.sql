ALTER TABLE services
    DROP COLUMN IF EXISTS duration_minutes,
    DROP COLUMN IF EXISTS max_concurrent;
