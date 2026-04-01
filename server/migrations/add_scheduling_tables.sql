-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Full Resource-Based Scheduling System
-- Adds employees, resources, skills, shifts, audit log
-- and upgrades appointments + services with scheduling columns.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Employees ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
    employee_id  SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    mobile       VARCHAR(15),
    email        VARCHAR(255),
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. Physical Resources (chairs, beds, stations) ───────────────────────────
-- Each row represents ONE physical unit (or a pool if total_count > 1).
-- type must match the resource_type column on services.
CREATE TABLE IF NOT EXISTS resources (
    resource_id  SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    type         VARCHAR(50)  NOT NULL,   -- e.g. hair_chair | facial_bed | massage_chair | pedicure_seat | general
    total_count  INTEGER      NOT NULL DEFAULT 1 CHECK (total_count >= 1),
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ── 3. Employee Skills (which services each employee can perform) ─────────────
CREATE TABLE IF NOT EXISTS employee_skills (
    employee_id  INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    service_id   INTEGER NOT NULL REFERENCES services(service_id)   ON DELETE CASCADE,
    PRIMARY KEY (employee_id, service_id)
);

-- ── 4. Employee Shifts (working schedule per weekday) ────────────────────────
-- day_of_week: 0 = Sunday … 6 = Saturday (matches JS getDay())
CREATE TABLE IF NOT EXISTS employee_shifts (
    shift_id     SERIAL  PRIMARY KEY,
    employee_id  INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time   TIME    NOT NULL,
    end_time     TIME    NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT shift_times_valid CHECK (end_time > start_time)
);

-- ── 5. Appointment Audit Log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointment_audit_log (
    log_id          SERIAL   PRIMARY KEY,
    appointment_id  INTEGER  NOT NULL REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    changed_by_role VARCHAR(20),           -- 'admin' | 'customer' | 'system'
    changed_by_id   INTEGER,
    old_status      VARCHAR(50),
    new_status      VARCHAR(50),
    old_start_time  TIMESTAMP,
    new_start_time  TIMESTAMP,
    old_employee_id INTEGER,
    new_employee_id INTEGER,
    old_resource_id INTEGER,
    new_resource_id INTEGER,
    notes           TEXT,
    changed_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 6. Extend services table ─────────────────────────────────────────────────
-- resource_type: must match resources.type for the availability engine
ALTER TABLE services
    ADD COLUMN IF NOT EXISTS resource_type    VARCHAR(50)  NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS buffer_minutes   INTEGER      NOT NULL DEFAULT 0;

-- ── 7. Extend appointments table ─────────────────────────────────────────────
-- start_time / end_time store the FULL blocked window (duration + buffer).
-- employee_id and resource_id record the assigned staff and physical resource.
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS employee_id  INTEGER REFERENCES employees(employee_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resource_id  INTEGER REFERENCES resources(resource_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS start_time   TIMESTAMP,
    ADD COLUMN IF NOT EXISTS end_time     TIMESTAMP;

-- Back-fill start_time/end_time from existing date+time columns where possible
UPDATE appointments
SET
    start_time = (appointment_date::text || ' ' || appointment_time::text)::timestamp,
    end_time   = (appointment_date::text || ' ' || appointment_time::text)::timestamp
                  + (COALESCE(duration_minutes, 30) || ' minutes')::interval
WHERE start_time IS NULL AND appointment_date IS NOT NULL AND appointment_time IS NOT NULL;

-- ── 8. Performance indexes ────────────────────────────────────────────────────
-- Overlap detection: date + status filter used on every availability check
CREATE INDEX IF NOT EXISTS idx_appt_date_status
    ON appointments(appointment_date, status);

-- Employee-based overlap scan
CREATE INDEX IF NOT EXISTS idx_appt_employee_time
    ON appointments(employee_id, start_time, end_time)
    WHERE status NOT IN ('Cancelled', 'No-Show');

-- Resource-based overlap scan
CREATE INDEX IF NOT EXISTS idx_appt_resource_time
    ON appointments(resource_id, start_time, end_time)
    WHERE status NOT IN ('Cancelled', 'No-Show');

-- Skill lookups
CREATE INDEX IF NOT EXISTS idx_employee_skills_service
    ON employee_skills(service_id);

-- Shift lookups by weekday
CREATE INDEX IF NOT EXISTS idx_employee_shifts_day
    ON employee_shifts(employee_id, day_of_week) WHERE is_active = TRUE;

-- ── 9. New settings keys ──────────────────────────────────────────────────────
INSERT INTO settings (key, value) VALUES ('slot_interval',      '15')            ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('max_advance_days',   '30')            ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('walkin_reserve_pct', '0')             ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('timezone',           'Asia/Kolkata')  ON CONFLICT (key) DO NOTHING;
