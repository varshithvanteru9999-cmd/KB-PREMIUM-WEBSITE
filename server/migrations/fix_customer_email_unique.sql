-- Drop unique constraint on customers.email
-- Customers are identified by mobile_number; email is optional and non-unique.
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_email_key;
