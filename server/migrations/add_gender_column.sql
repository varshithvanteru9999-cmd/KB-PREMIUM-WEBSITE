-- Idempotent: ensures the gender column exists on categories.
-- Safe to run on every server startup.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS gender VARCHAR(10) DEFAULT 'men';
UPDATE categories SET gender = 'men' WHERE gender IS NULL;
