-- Migration: Per-service concurrent booking capacity
ALTER TABLE services ADD COLUMN IF NOT EXISTS max_concurrent INTEGER NOT NULL DEFAULT 1;
