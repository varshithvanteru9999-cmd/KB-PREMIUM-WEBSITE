CREATE TABLE IF NOT EXISTS settings (
    key   VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES ('advance_type',   'fixed')     ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('advance_value',  '1')         ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('working_start',  '09:00')     ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('working_end',    '23:00')     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
INSERT INTO settings (key, value) VALUES ('slot_duration',  '30')        ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('working_days',   '1,2,3,4,5,6') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('max_concurrent', '1')         ON CONFLICT (key) DO NOTHING;
