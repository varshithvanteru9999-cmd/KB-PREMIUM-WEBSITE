-- Add password_hash to customers (if not already present)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
