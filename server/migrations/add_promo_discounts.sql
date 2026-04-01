-- Promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
    promo_id          SERIAL PRIMARY KEY,
    code              VARCHAR(50)  UNIQUE NOT NULL,
    description       TEXT,
    discount_type     VARCHAR(10)  NOT NULL CHECK (discount_type IN ('percent','fixed')),
    discount_value    DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
    min_order_amount  DECIMAL(10,2) DEFAULT 0,
    max_discount_cap  DECIMAL(10,2) DEFAULT NULL,   -- cap for % discounts
    max_uses          INTEGER       DEFAULT NULL,    -- NULL = unlimited
    used_count        INTEGER       DEFAULT 0,
    valid_until       DATE          DEFAULT NULL,    -- NULL = never expires
    is_active         BOOLEAN       DEFAULT TRUE,
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- Discount columns on appointments
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS discount_code   VARCHAR(50)   DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_type   VARCHAR(20)   DEFAULT NULL;
