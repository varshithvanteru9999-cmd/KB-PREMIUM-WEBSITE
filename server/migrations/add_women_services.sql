-- Migration: Add gender column to categories and insert women's services
-- Based on ANIQ WOMENS MENU PDF

-- Step 1: Add gender column to categories (default 'men' for existing data)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS gender VARCHAR(10) DEFAULT 'men';

-- Step 2: Ensure all existing categories are marked as men
UPDATE categories SET gender = 'men' WHERE gender IS NULL;

-- Step 3: Insert Women's Categories
INSERT INTO categories (name, gender) VALUES
('Beauty Services',       'women'),
('Hair Colouring',        'women'),
('Hair Spa',              'women'),
('Hair Treatments',       'women'),
('Waxing',                'women'),
('Threading',             'women'),
('Manicure & Pedicure',   'women'),
('Bridal Makeup',         'women');

-- Step 4: Insert Women's Services

-- Beauty Services (Facials, Scrubs, Tan, Clean Up)
INSERT INTO services (category_id, name, price)
SELECT c.category_id, t.name, t.price
FROM categories c, (VALUES
    ('Clean Up',            399.00),
    ('Tan',                 249.00),
    ('D-Tan',               449.00),
    ('Scrub',               249.00),
    ('Scrub (Golden)',      349.00),
    ('Scrub (Whitening)',   449.00),
    ('Basic Facial',        599.00),
    ('Fruit Facial',        999.00),
    ('Gold Facial',        1499.00),
    ('Diamond Facial',     1749.00),
    ('Silver Facial',      1749.00),
    ('Bridal Facial',      1999.00),
    ('Facial (Pigment)',   2499.00),
    ('Facial (Whitening)', 2499.00),
    ('Hydra Facial',       2999.00),
    ('Hydra Pro++',        3499.00),
    ('O3+ Facial',         4499.00),
    ('Shanaz (G/S)',       4499.00)
) AS t(name, price)
WHERE c.name = 'Beauty Services' AND c.gender = 'women';

-- Hair Colouring (Women)
INSERT INTO services (category_id, name, price)
SELECT c.category_id, t.name, t.price
FROM categories c, (VALUES
    ('Hena (Roots)',       349.00),
    ('Hena (Full)',        549.00),
    ('Natural (Black)',    499.00),
    ('Natural (B/Full)',   699.00),
    ('Matrix (Roots)',     699.00),
    ('Matrix (Full)',     1299.00),
    ('Loreal (Roots)',     799.00),
    ('Loreal (Full)',     1499.00),
    ('Burgundy',          1499.00),
    ('Global',            1999.00),
    ('Highlighting',       450.00)
) AS t(name, price)
WHERE c.name = 'Hair Colouring' AND c.gender = 'women';

-- Hair Spa (Women)
INSERT INTO services (category_id, name, price)
SELECT c.category_id, t.name, t.price
FROM categories c, (VALUES
    ('Hair Spa',   999.00),
    ('Matrix',    1499.00),
    ('Loreal',    1999.00)
) AS t(name, price)
WHERE c.name = 'Hair Spa' AND c.gender = 'women';

-- Hair Treatments (Women)
INSERT INTO services (category_id, name, price)
SELECT c.category_id, t.name, t.price
FROM categories c, (VALUES
    ('Dandruff Clean',  1499.00),
    ('Hairfall',        1499.00),
    ('Smoothing',       4999.00),
    ('Keratin',         3999.00),
    ('Botox',           3999.00),
    ('Nano Plasting',   4999.00)
) AS t(name, price)
WHERE c.name = 'Hair Treatments' AND c.gender = 'women';

-- Waxing (Women)
INSERT INTO services (category_id, name, price)
SELECT c.category_id, t.name, t.price
FROM categories c, (VALUES
    ('Chin',          39.00),
    ('Upper Lip',     69.00),
    ('Full Face',    199.00),
    ('Hands (Half)', 299.00),
    ('Hands (Full)', 499.00),
    ('Legs (Half)',  399.00),
    ('Legs (Full)',  599.00),
    ('Under Arms',   149.00),
    ('Neck (Back)',  199.00),
    ('Full Body',   1999.00)
) AS t(name, price)
WHERE c.name = 'Waxing' AND c.gender = 'women';

-- Threading (Women)
INSERT INTO services (category_id, name, price)
SELECT c.category_id, t.name, t.price
FROM categories c, (VALUES
    ('Chin',       19.00),
    ('Upper Lip',  29.00),
    ('Eyebrows',   59.00),
    ('Full Face', 119.00)
) AS t(name, price)
WHERE c.name = 'Threading' AND c.gender = 'women';

-- Manicure & Pedicure (Women)
INSERT INTO services (category_id, name, price)
SELECT c.category_id, t.name, t.price
FROM categories c, (VALUES
    ('Basic Pedicure',    399.00),
    ('Basic Manicure',    299.00),
    ('Crystal Pedicure',  549.00),
    ('Crystal Manicure',  449.00),
    ('Advance Pedicure',  799.00),
    ('Advance Manicure',  799.00)
) AS t(name, price)
WHERE c.name = 'Manicure & Pedicure' AND c.gender = 'women';

-- Bridal Makeup (Women)
INSERT INTO services (category_id, name, price)
SELECT c.category_id, t.name, t.price
FROM categories c, (VALUES
    ('Touch Up',   2999.00),
    ('In-Door',    4999.00),
    ('Out-Door',   5999.00)
) AS t(name, price)
WHERE c.name = 'Bridal Makeup' AND c.gender = 'women';
