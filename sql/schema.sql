-- Industry-Grade Salon System Database Schema

-- Clear existing data
DROP TABLE IF EXISTS appointment_services CASCADE;
DROP TABLE IF EXISTS billing_services CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS billing_records CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS admin CASCADE;

-- 1. Admin Table
CREATE TABLE admin (
    admin_id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categories Table
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Services Table
CREATE TABLE services (
    service_id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(category_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    description_what TEXT,
    description_why TEXT,
    description_how TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Customers Table (Now with Auth)
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Appointments Table
CREATE TABLE appointments (
    appointment_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    total_cost DECIMAL(10, 2) NOT NULL,
    advance_paid DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Appointment Services
CREATE TABLE appointment_services (
    appointment_id INTEGER REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(service_id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY (appointment_id, service_id)
);

-- 7. Billing Records
CREATE TABLE billing_records (
    billing_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    contact_number VARCHAR(15),
    email VARCHAR(255),
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    billing_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Billing Services
CREATE TABLE billing_services (
    billing_id INTEGER REFERENCES billing_records(billing_id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(service_id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY (billing_id, service_id)
);

-- 9. Invoices
CREATE TABLE invoices (
    invoice_id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(customer_id) ON DELETE SET NULL,
    billing_id INTEGER REFERENCES billing_records(billing_id) ON DELETE CASCADE,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Payments
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(appointment_id),
    billing_id INTEGER REFERENCES billing_records(billing_id),
    amount DECIMAL(10, 2) NOT NULL,
    gateway VARCHAR(50),
    transaction_id VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Services (De-Tan)
INSERT INTO services (category_id, name, price, description_what, description_why, description_how) 
SELECT category_id, t.name, t.price, t.what, t.why, t.how FROM categories, (VALUES 
('De-Tan Face', 500.00, 'A treatment to remove dark patches and sun tan from your face.', 'Sunlight makes skin look dark and tired; De-Tan brings back your natural look.', 'By applying a safe cleaning cream that removes the tanned layer from your face.'),
('De-Tan Face & Neck', 800.00, 'Full tan removal for both your face and neck area.', 'It makes sure your neck color and face color look the same and bright.', 'We apply special brightening packs that clean the deep tan from your skin.'),
('Under Arms', 200.00, 'A specialized cleaning for darker skin under your arms.', 'Sweat and friction make this area dark; De-Tan helps to brighten it again.', 'Using gentle scrubs and tan-removal creams made for sensitive skin.'),
('Feet De-Tan', 300.00, 'Removing sun tan and dirt from your feet area.', 'Feet get direct sun and dust which makes them dark and rough.', 'A quick soak followed by a tan-removal pack to make your feet look clean.'),
('Full Arms', 800.00, 'Complete tan removal for your entire arms.', 'Arms are most exposed to the sun and usually have the most tanning.', 'Full application of de-tan cream followed by professional cleaning.'),
('Half Arms', 600.00, 'Tan removal for your arms up to the elbows.', 'Perfect if your hands look darker than your upper arms.', 'Focused de-tan treatment for the exposed parts of your arms.'),
('Half Legs', 500.00, 'Cleaning and tan removal for your legs up to the knees.', 'Removes tanning caused by wearing shorts or sandals in the sun.', 'We use a strong de-tan pack to clear the dark skin from your legs.'),
('Full Legs', 1000.00, 'A full leg treatment to remove all tanning and dullness.', 'Makes your entire legs look bright, clean, and smooth.', 'Applying tan-clearing gel from your thighs down to your feet.'),
('Full Back & Front', 1000.00, 'Tan removal for your entire back and chest area.', 'Ideal after a beach trip or sun exposure to even out your body color.', 'Complete exfoliation and cooling de-tan packs for your torso.'),
('Full Body De-Tan', 5000.00, 'A total body treatment to remove tan from head to toe.', 'Clears years of sun damage and pollution from your entire skin.', 'A luxurious full-body application of de-tan packs and professional wash.')
) AS t(name, price, what, why, how) WHERE categories.name = 'De-Tan';

-- Services (Clean Up)
INSERT INTO services (category_id, name, price, description_what, description_why, description_how) 
SELECT category_id, t.name, t.price, t.what, t.why, t.how FROM categories, (VALUES 
('Face Cleansing', 500.00, 'A quick skin cleaning to remove surface dirt and oil.', 'Daily dust blocks skin pores; cleaning prevents pimples and dullness.', 'Simple cleaning, light scrub, and a fresh face wash.'),
('O3+ Clean Up', 1500.00, 'A premium skin treatment that puts oxygen into your cells.', 'It removes deep dirt and toxins to give you an instant, healthy glow.', 'A multi-step process with professional O3+ creams and an oxygen mask.'),
('Classic Clean Up (Oily Skin)', 800.00, 'Specialized cleaning for people with oily and sticky skin.', 'Excess oil causes acne and blackheads; this treatment controls oil.', 'Using deep-pore cleansers that remove extra oil without drying the skin.'),
('De-Tan Clean Up', 1000.00, 'A mix of tan removal and deep pore cleaning.', 'Best for removing both sun tan and dirt at the same time.', 'Applying a de-tan pack followed by a refreshing skin cleaning.'),
('Signature Clean Up', 1200.00, 'Our best cleaning service for a very fresh and bright look.', 'It makes you look ready for a party or event in a very short time.', 'A luxurious treatment using our best skin-brightening products.')
) AS t(name, price, what, why, how) WHERE categories.name = 'Clean Up';

-- Services (Hair Treatment)
INSERT INTO services (category_id, name, price, description_what, description_why, description_how) 
SELECT category_id, t.name, t.price, t.what, t.why, t.how FROM categories, (VALUES 
('Classic Hair Spa', 1500.00, 'A relaxing scalp massage and hair conditioning treatment.', 'Stress and pollution make hair dry; a spa brings back moisture.', 'Deep conditioning with hair cream and a steam session to help it sink in.'),
('Keratin Refill Hair Spa', 2000.00, 'A protein-rich treatment to repair damaged hair.', 'Hair is made of protein; this refill makes your hair strong and smooth.', 'Infusing liquid keratin into your hair to fix cracks and reduce frizz.'),
('Anti Hair Fall', 2000.00, 'A treatment focused on making your hair roots strong.', 'Stops hair from breaking and falling out by nourishing the scalp.', 'Using specialized serums and massage to improve blood flow to the roots.'),
('Anti Dandruff Hair Spa', 2000.00, 'A scalp-cleaning treatment to remove itchy flakes.', 'Dandruff is caused by fungus or dry scalp; this spa clears it away.', 'Applying anti-fungal gels and thoroughly cleaning your scalp.')
) AS t(name, price, what, why, how) WHERE categories.name = 'Hair Treatment';

-- Services (Head Oil Massage)
INSERT INTO services (category_id, name, price, description_what, description_why, description_how) 
SELECT category_id, t.name, t.price, t.what, t.why, t.how FROM categories, (VALUES 
('Head Oil Massage (Including Wash)', 600.00, 'A relaxing massage with warm oil followed by a hair wash.', 'Relieves stress, improves sleep, and keeps your scalp healthy.', 'Gentle head massage for 15-20 minutes with high-quality oil.'),
('Mint Oil Head Massage (Including Wash)', 800.00, 'A cooling massage using fresh mint oil and a hair wash.', 'The mint gives a very cool and fresh feeling, perfect for hot days.', 'Using cooling mint oil that relaxes your mind and refreshes your scalp.')
) AS t(name, price, what, why, how) WHERE categories.name = 'Head Oil Massage';

-- Services (Hair Colourings)
INSERT INTO services (category_id, name, price, description_what, description_why, description_how) 
SELECT category_id, t.name, t.price, t.what, t.why, t.how FROM categories, (VALUES 
('Root Touchup (Ammonia)', 600.00, 'Covering grey hair at the roots using regular color.', 'Hides grey roots to make your hair look naturally black or colored.', 'Applying color only to the new hair growth near your scalp.'),
('Root Touchup (Ammonia Free)', 800.00, 'Covering grey roots using safe, chemical-free color.', 'Best for sensitive scalps or people who want to avoid harsh chemicals.', 'Using ammonia-free hair color that is gentle but lasts a long time.'),
('Fashion Colour Per Streak', 200.00, 'Coloring a single strip of hair with a bright fashion color.', 'Add a pop of color like blue, red, or purple to look stylish.', 'Bleaching a small section of hair and applying the fashion shade.'),
('Ammonia Free Global', 1200.00, 'Coloring your entire hair with safe, non-chemical color.', 'Changes your whole look while keeping your hair healthy and safe.', 'Applying gentle color to every strand of hair from top to bottom.'),
('Global Fashion Colour', 4000.00, 'Applying a stylish fashion color to your entire head of hair.', 'For a complete transformation into a modern and trendy look.', 'A full process of lightening the hair and applying professional color.')
) AS t(name, price, what, why, how) WHERE categories.name = 'Hair Colourings';

-- Services (Make Up)
INSERT INTO services (category_id, name, price, description_what, description_why, description_how) 
SELECT category_id, t.name, t.price, t.what, t.why, t.how FROM categories, (VALUES 
('Hair Styling', 1999.00, 'Professional styling using heat tools for a perfect look.', 'Makes you look ready for weddings, parties, or special events.', 'Using blow dryers, irons, and sprays to hold your hair in place.'),
('Groom Make Up (Classic)', 8999.00, 'A natural makeup look for grooms on their wedding day.', 'Helps you look fresh and even-toned in photos without look heavy.', 'Applying basic foundation and powder to hide small flaws.'),
('Groom Make Up (HD & Air Brush)', 9999.00, 'The best quality makeup that looks perfect on HD cameras.', 'It is sweat-proof, lasts all day, and looks very natural in real life.', 'Using special high-definition products or a spray-makeup tool.')
) AS t(name, price, what, why, how) WHERE categories.name = 'Make Up';

-- Services (Pedicure)
INSERT INTO services (category_id, name, price, description_what, description_why, description_how) 
SELECT category_id, t.name, t.price, t.what, t.why, t.how FROM categories, (VALUES 
('Foot Massage', 500.00, 'A relaxing 20-minute massage for your tired feet.', 'Helps blood flow and reduces foot pain after a long day.', 'Focused pressure and massage on your feet using soothing oils.'),
('Classic Pedicure (No Leg Massage)', 800.00, 'Basic cleaning and nail shaping for your feet.', 'Keeps your feet clean and prevents ingrown nails or infections.', 'Soaking your feet, cleaning the nails, and removing dead skin.'),
('Exotic Pedicure', 1399.00, 'A luxurious foot spa with skin softening and massage.', 'Makes your feet feel incredibly soft and looking very clean.', 'Using specialized salts, scrubs, and a rich moisturizing mask.'),
('O3+ Pedicure', 1799.00, 'A high-end pedicure using O3+ skin brightening products.', 'Removes deep dirt and tanning from your feet for a bright look.', 'A professional process with O3+ creams and a brightening foot pack.'),
('ICE Cream Pedicure', 2000.00, 'A fun and very moisturizing treatment using ice cream products.', 'The creamy products offer deeper hydration than any other pedicure.', 'Using "ice cream" shaped scrubs and butter-based moisturizing creams.'),
('Kanpeki Manicure', 2200.00, 'A premium Japanese treatment for extreme skin softeness.', 'Best for people with very dry skin who want a luxury experience.', 'Using high-end Japanese Kanpeki products to repair and hydrate feet.')
) AS t(name, price, what, why, how) WHERE categories.name = 'Pedicure';

-- Services (Manicure)
INSERT INTO services (category_id, name, price, description_what, description_why, description_how) 
SELECT category_id, t.name, t.price, t.what, t.why, t.how FROM categories, (VALUES 
('Classic Manicure', 500.00, 'Basic cleaning and grooming for your hands and nails.', 'Keeps your hands looking neat, clean, and professional.', 'Nail cutting, shaping, and basic cleaning with a light massage.'),
('Exotic Manicure', 800.00, 'A softening treatment for your hands with a luxury feel.', 'Perfect for very dry hands that need extra care and moisture.', 'Using aromatic oils and a rich moisturizing mask for the hands.'),
('O3+ Manicure', 1200.00, 'Brightening treatment for your hands using O3+ products.', 'Removes sun tan from your hands and makes them look youthful.', 'Professional O3+ cleaning followed by a brightening serum.'),
('ICE Cream Manicure', 1500.00, 'A deeply moisturizing hand treatment with sweet scents.', 'Makes your hands smell great and feel like silk for days.', 'Using butter-rich creams inspired by ice cream flavors.'),
('Kanpeki Manicure', 1800.00, 'Luxury Japanese treatment for the most beautiful hands.', 'Deeply repairs and rejuvenates the skin on your hands and arms.', 'A high-end process using Japanese Kanpeki skin care products.')
) AS t(name, price, what, why, how) WHERE categories.name = 'Manicure';

-- Services (Haircut)
INSERT INTO services (category_id, name, price, description_what, description_why, description_how) 
SELECT category_id, t.name, t.price, t.what, t.why, t.how FROM categories, (VALUES 
('Hair Cut', 350.00, 'A professional haircut designed specifically for your face shape.', 'A good haircut improves your facial features and makes you look sharp.', 'Using sharp tools and expert sectioning to give you a long-lasting style.'),
('Hair Wash And Conditioning', 200.00, 'A deep hair cleaning and softening treatment using luxury products.', 'Washing removes oil and dirt, while conditioner protects hair from damage.', 'Step-by-step scalp massage with shampoo followed by a hydrating mask.'),
('Hair Setting', 200.00, 'A temporary style setting for your hair for a clean look.', 'Perfect if you have a meeting or a quick event to attend.', 'Using blow dryers and styling gels to keep your hair in place.')
) AS t(name, price, what, why, how) WHERE categories.name = 'Haircut';

-- Services (Kids)
INSERT INTO services (category_id, name, price, description_what, description_why, description_how) 
SELECT category_id, t.name, t.price, t.what, t.why, t.how FROM categories, (VALUES 
('Kids Hair Cut (Under 10)', 250.00, 'A gentle and quick haircut for children.', 'Keeping kids comfortable while giving them a smart and tidy look.', 'Using child-friendly tools and techniques for a safe experience.'),
('Kids Hair Wash & Conditioning', 300.00, 'A soft cleaning for a child''s delicate hair.', 'Cleans the scalp gently without any tears or irritation.', 'Using very mild shampoos made specifically for children.')
) AS t(name, price, what, why, how) WHERE categories.name = 'Kids';

-- Services (Beard)
INSERT INTO services (category_id, name, price, description_what, description_why, description_how) 
SELECT category_id, t.name, t.price, t.what, t.why, t.how FROM categories, (VALUES 
('Beard Colouring', 200.00, 'Covering grey hair in your beard for a younger look.', 'Keeps your beard looking uniform and well-maintained.', 'Applying safe beard color that matches your natural hair shade.'),
('Beard Trimming', 200.00, 'Shaping and cutting your beard for a neat appearance.', 'A well-trimmed beard defines your jawline and looks professional.', 'Professional tools used to give you the perfect beard shape.'),
('Shave', 100.00, 'A clean and smooth face shave using a single blade.', 'Removes all facial hair and dead skin for a very fresh feeling.', 'Using hot towels and rich foam for a comfortable shave.'),
('Mustache Coloring', 130.00, 'Covering grey hair on your mustache precisely.', 'Helps in keeping your facial hair looking young and black.', 'Precision coloring only for the mustache area.')
) AS t(name, price, what, why, how) WHERE categories.name = 'Beard';
