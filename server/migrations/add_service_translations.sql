-- Migration: Trilingual service descriptions
-- Run once against the KB Beauty PostgreSQL database

-- Step 1: Add base English description columns to services table (if not already present)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS description_what TEXT,
  ADD COLUMN IF NOT EXISTS description_why  TEXT,
  ADD COLUMN IF NOT EXISTS description_how  TEXT;

-- Step 2: Translations table — one row per (service, language)
-- Falls back to services.description_* when a translation row is absent
CREATE TABLE IF NOT EXISTS service_translations (
  service_id       INTEGER     NOT NULL REFERENCES services(service_id) ON DELETE CASCADE,
  lang_code        VARCHAR(5)  NOT NULL CHECK (lang_code IN ('en', 'te', 'hi')),
  description_what TEXT,
  description_why  TEXT,
  description_how  TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service_id, lang_code)
);

-- Index for fast per-language lookups
CREATE INDEX IF NOT EXISTS idx_service_translations_lang ON service_translations(lang_code);
