-- Industry-grade image storage: add binary image columns to categories and services
-- Uses BYTEA for in-database storage (no external filesystem dependency)

ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS image_data     BYTEA,
    ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS image_filename  VARCHAR(255);

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS image_data     BYTEA,
    ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS image_filename  VARCHAR(255);

-- Gallery images table (for the scrolling portfolio strip on the homepage)
CREATE TABLE IF NOT EXISTS gallery_images (
    image_id      SERIAL PRIMARY KEY,
    image_data    BYTEA        NOT NULL,
    image_mime_type VARCHAR(50) NOT NULL,
    image_filename  VARCHAR(255),
    caption       TEXT,
    sort_order    INTEGER DEFAULT 0,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
