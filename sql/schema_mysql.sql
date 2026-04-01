-- MySQL Industry-Grade Salon System Database Schema
SET FOREIGN_KEY_CHECKS = 0;

-- Clear existing data
DROP TABLE IF EXISTS appointment_services;
DROP TABLE IF EXISTS billing_services;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS billing_records;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS admin;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS promo_codes;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Admin Table
CREATE TABLE admin (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categories Table
CREATE TABLE categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    gender ENUM('men', 'women') DEFAULT 'men',
    image_url TEXT,
    image_data LONGBLOB,
    image_mime_type VARCHAR(100),
    image_filename VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Services Table
CREATE TABLE services (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    image_data LONGBLOB,
    image_mime_type VARCHAR(100),
    image_filename VARCHAR(255),
    description_what TEXT,
    description_why TEXT,
    description_how TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE
);

-- 4. Customers Table
CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Appointments Table
CREATE TABLE appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    employee_id INT,
    resource_id INT,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INT DEFAULT 30,
    status VARCHAR(50) DEFAULT 'Pending',
    total_cost DECIMAL(10, 2) NOT NULL,
    advance_paid DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    discount_code VARCHAR(50),
    discount_type VARCHAR(20),
    manual_discount_amount DECIMAL(10, 2) DEFAULT 0,
    manual_discount_type VARCHAR(20),
    payment_requested BOOLEAN DEFAULT FALSE,
    admin_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);

-- 6. Appointment Services
CREATE TABLE appointment_services (
    appointment_id INT,
    service_id INT,
    quantity INT DEFAULT 1,
    PRIMARY KEY (appointment_id, service_id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE
);

-- 7. Billing Records
CREATE TABLE billing_records (
    billing_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    customer_name VARCHAR(255),
    contact_number VARCHAR(15),
    email VARCHAR(255),
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    billing_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL
);

-- 8. Billing Services
CREATE TABLE billing_services (
    billing_id INT,
    service_id INT,
    quantity INT DEFAULT 1,
    PRIMARY KEY (billing_id, service_id),
    FOREIGN KEY (billing_id) REFERENCES billing_records(billing_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE
);

-- 9. Invoices
CREATE TABLE invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INT,
    billing_id INT,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL,
    FOREIGN KEY (billing_id) REFERENCES billing_records(billing_id) ON DELETE CASCADE
);

-- 10. Payments
CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT,
    billing_id INT,
    amount DECIMAL(10, 2) NOT NULL,
    gateway VARCHAR(50),
    transaction_id VARCHAR(255),
    status VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    FOREIGN KEY (billing_id) REFERENCES billing_records(billing_id) ON DELETE SET NULL
);

-- 11. Sessions
CREATE TABLE sessions (
    token VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    role VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    expires_at DATETIME NOT NULL
);

-- 12. Promo Codes
CREATE TABLE promo_codes (
    promo_id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type ENUM('fixed', 'percent') NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    max_discount_amount DECIMAL(10, 2),
    valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
    valid_until DATETIME,
    usage_limit INT,
    used_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Service Translations
CREATE TABLE service_translations (
    translation_id INT AUTO_INCREMENT PRIMARY KEY,
    service_id INT NOT NULL,
    lang_code CHAR(2) NOT NULL,
    description_what TEXT,
    description_why TEXT,
    description_how TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY (service_id, lang_code),
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE
);

-- 14. Settings
CREATE TABLE settings (
    `key` VARCHAR(255) PRIMARY KEY,
    `value` TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- SEED DATA --

-- Default Admin
INSERT INTO admin (username, email, mobile_number, password_hash) 
VALUES ('SHAIK SHAHID', 'venuwithu1234@gmail.com', '9640401112', 'a71be400cac069c97be714ffae432fc6:92d1c40ec503e36cd09939e25229322c5e128ec7938c774ba9a0cc892340a3e89fd0e9730dcf4571ccddda571f888a077d9a5e34d837c213b7d661229df80288');

-- Categories
INSERT INTO categories (name) VALUES 
('De-Tan'), ('Clean Up'), ('Hair Treatment'), ('Head Oil Massage'), 
('Hair Colourings'), ('Make Up'), ('Pedicure'), ('Manicure'), 
('Haircut'), ('Kids'), ('Beard');

-- Seeds for services would follow a similar pattern but simplified from the PG VALUES syntax
-- Note: I'll handle the service seeds using individual INSERT statements or a bulk INSERT.
