-- Separate manual (admin) discount from promo code discount on appointments
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS manual_discount_amount DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS manual_discount_type   VARCHAR(20)   DEFAULT NULL;
