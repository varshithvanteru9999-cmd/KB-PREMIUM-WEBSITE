const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const multer = require('multer');
const db = require('./db');
const { sendInvoiceEmail, sendSlotConfirmationEmail, sendDenialEmail, transporter } = require('./email');

// Multer: store uploads in memory (we persist to PostgreSQL BYTEA)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max
    fileFilter(req, file, cb) {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    }
});

// Run migrations and seed translations on startup
// Skip original PG migrations — schema handled via sql/schema_mysql.sql

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Required for PayU form POST callbacks
// CSS and JS: always fresh — no browser or SW caching
app.use((req, res, next) => {
    if (req.path.match(/\.(css|js)$/)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});
app.use(express.static(path.join(__dirname, '../public')));
// --- SECURITY HEADERS --- //
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self' https:; style-src 'self' https: 'unsafe-inline'; script-src 'self' https: 'unsafe-inline' 'unsafe-eval';");
    next();
});

// Simple Rate Limiter for Login
const LOGIN_ATTEMPTS = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 mins
const MAX_ATTEMPTS = 5;

const rateLimiter = (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const attempts = LOGIN_ATTEMPTS.get(ip) || [];
    const validAttempts = attempts.filter(t => now - t < RATE_LIMIT_WINDOW);

    if (validAttempts.length >= MAX_ATTEMPTS) {
        return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    }

    LOGIN_ATTEMPTS.set(ip, [...validAttempts, now]);
    next();
};

// DB-backed sessions (survives server restarts)
const SESSIONS = {
    async set(token, { user, expires }) {
        await db.query(
            `INSERT INTO sessions (token, user_id, role, name, expires_at)
             VALUES ($1, $2, $3, $4, FROM_UNIXTIME($5 / 1000.0))
             ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)`,
            [token, user.id, user.role, user.name, expires]
        );
    },
    async get(token) {
        const r = await db.query(
            `SELECT user_id, role, name, expires_at FROM sessions WHERE token = $1`,
            [token]
        );
        if (!r.rows.length) return null;
        const row = r.rows[0];
        return { user: { id: row.user_id, role: row.role, name: row.name }, expires: new Date(row.expires_at).getTime() };
    },
    async delete(token) {
        await db.query('DELETE FROM sessions WHERE token = $1', [token]);
    }
};

// --- HELPERS --- //

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function normalizeMobile(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);   // 0XXXXXXXXXX → XXXXXXXXXX
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);  // 91XXXXXXXXXX → XXXXXXXXXX
    return digits;
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedValue) {
    const [salt, hash] = storedValue.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}

// --- MIDDLEWARE --- //

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    try {
        const session = await SESSIONS.get(token);
        if (!session || session.expires < Date.now()) {
            console.warn('[authenticateToken] session_invalid_or_expired', { token: token.substring(0, 8), session_exists: !!session });
            if (session) await SESSIONS.delete(token);
            return res.sendStatus(403);
        }
        console.log('[authenticateToken] success', { id: session.user.id, role: session.user.role, name: session.user.name });
        req.user = session.user;
        next();
    } catch (err) {
        console.error('[authenticateToken] error', err.message);
        res.sendStatus(500);
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
};

// --- API ROUTES --- //

app.post('/api/auth/login', rateLimiter, async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // Check Admin
        const adminRes = await db.query(
            'SELECT * FROM admin WHERE email = $1 OR mobile_number = $1',
            [identifier]
        );

        if (adminRes.rows.length > 0) {
            const admin = adminRes.rows[0];
            if (verifyPassword(password, admin.password_hash)) {
                const token = generateToken();
                await SESSIONS.set(token, {
                    user: { id: admin.admin_id, role: 'admin', name: admin.username },
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000
                });
                return res.json({ success: true, token, role: 'admin', user: { name: admin.username, role: 'admin' } });
            }
        }

        // Check Customer
        const customerRes = await db.query(
            'SELECT * FROM customers WHERE email = $1 OR mobile_number = $1',
            [identifier]
        );

        if (customerRes.rows.length > 0) {
            const customer = customerRes.rows[0];
            if (customer.password_hash && verifyPassword(password, customer.password_hash)) {
                const token = generateToken();
                console.log('[Login:Customer] creating_session', { id: customer.customer_id, name: customer.name });
                await SESSIONS.set(token, {
                    user: { id: customer.customer_id, role: 'customer', name: customer.name },
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000
                });
                return res.json({ success: true, token, role: 'customer', user: { name: customer.name, email: customer.email, mobile: customer.mobile_number, role: 'customer' } });
            }
        }

        res.status(401).json({ success: false, error: 'Invalid credentials' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// ── Customer: get own profile + appointments (token auth) ─────────────────────
app.get('/api/customer/me', authenticateToken, async (req, res) => {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'Forbidden' });
    try {
        const cust = await db.query('SELECT customer_id, name, email, mobile_number, created_at FROM customers WHERE customer_id = $1', [req.user.id]);
        if (!cust.rows.length) {
            console.warn('[GET /api/customer/me] customer_not_found (stale session)', { id: req.user.id });
            return res.status(401).json({ error: 'Session invalid or account moved' });
        }
        console.log('[GET /api/customer/me] success', { id: cust.rows[0].customer_id, name: cust.rows[0].name });
        res.json(cust.rows[0]);
    } catch (err) {
        console.error('[GET /api/customer/me] error', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Customer: apply promo code to an appointment before payment
app.post('/api/customer/appointments/:id/apply-promo', authenticateToken, async (req, res) => {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        const { code, discount_amount } = req.body;
        if (!code || !discount_amount) return res.status(400).json({ error: 'Missing fields' });

        // Verify code is still valid
        const pr = await db.query(
            `SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1) AND is_active = TRUE`, [code]
        );
        if (!pr.rows.length) return res.status(400).json({ error: 'Invalid promo code' });
        const p = pr.rows[0];
        if (p.valid_until && new Date(p.valid_until) < new Date())
            return res.status(400).json({ error: 'Promo code expired' });
        if (p.max_uses !== null && p.used_count >= p.max_uses)
            return res.status(400).json({ error: 'Usage limit reached' });

        // Only apply if appointment belongs to this customer
        await db.query(
            `UPDATE appointments SET discount_amount=$1, discount_code=UPPER($2), discount_type=$3
             WHERE appointment_id=$4 AND customer_id=$5`,
            [parseFloat(discount_amount), code, p.discount_type, id, req.user.id]
        );
        await db.query(
            `UPDATE promo_codes SET used_count = used_count + 1 WHERE UPPER(code) = UPPER($1)`, [code]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/customer/appointments', authenticateToken, async (req, res) => {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'Forbidden' });
    try {
        const settings = await loadSettings();
        const advType  = settings.advance_type  || 'fixed';
        const advValue = parseFloat(settings.advance_value || '0');

        const result = await db.query(
            `SELECT
                     a.appointment_id,
                     a.appointment_date,
                     a.appointment_time,
                     a.status,
                     a.total_cost,
                     a.advance_paid,
                     a.duration_minutes,
                     a.created_at,
                     COALESCE(a.discount_amount, 0)        AS discount_amount,
                     a.discount_code,
                     a.discount_type,
                     COALESCE(a.manual_discount_amount, 0) AS manual_discount_amount,
                     a.manual_discount_type,
                     COALESCE(a.payment_requested, 0)      AS payment_requested,
                     c.name   AS customer_name,
                     c.email  AS customer_email,
                     c.mobile_number AS customer_mobile,
                     e.name   AS employee_name,
                     r.name   AS resource_name,
                     (
                        SELECT COALESCE(
                            JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    'service_id',   s.service_id,
                                    'service_name', s.name,
                                    'price',        s.price,
                                    'quantity',     aps.quantity
                                )
                            ),
                            JSON_ARRAY()
                        )
                        FROM appointment_services aps
                        JOIN services s ON s.service_id = aps.service_id
                        WHERE aps.appointment_id = a.appointment_id
                    ) AS services
               FROM appointments a
               JOIN customers c                   ON c.customer_id = a.customer_id
               LEFT JOIN employees e              ON e.employee_id = a.employee_id
               LEFT JOIN resources r              ON r.resource_id = a.resource_id
              WHERE a.customer_id = $1
              ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
            [req.user.id]
        );

        const appointments = result.rows.map(appt => {
            try {
                // Ensure services is always an array
                if (typeof appt.services === 'string') {
                    try { appt.services = JSON.parse(appt.services); } catch (e) { appt.services = []; }
                }
                if (!Array.isArray(appt.services)) appt.services = [];

                const total       = parseFloat(appt.total_cost             || 0);
                const disc        = parseFloat(appt.discount_amount        || 0);
                const manualDisc  = parseFloat(appt.manual_discount_amount || 0);
                const paid        = parseFloat(appt.advance_paid           || 0);
                const netTotal         = Math.max(0, total - disc - manualDisc);
                
                const required_advance = advType === 'percent'
                    ? parseFloat((netTotal * advValue / 100).toFixed(2))
                    : advValue;
                    
                const balance_advance = Math.max(0, required_advance - paid);
                const balance_due     = Math.max(0, netTotal - paid);
                
                const hasGateway = !!(process.env.PAYU_KEY && process.env.PAYU_SALT);
                
                return {
                    ...appt,
                    required_advance,
                    balance_advance,
                    balance_due,
                    show_payment_prompt:  hasGateway && appt.status === 'Confirmed' && balance_advance > 0,
                    show_balance_payment: hasGateway && appt.status === 'Confirmed' && appt.payment_requested && balance_due > 0,
                };
            } catch (mappingErr) {
                console.error(`[GET /api/customer/appointments] Mapping error for Appt #${appt.appointment_id}:`, mappingErr.message);
                return { ...appt, services: [], error: 'Failed to process details' };
            }
        });
        console.log('[GET /api/customer/appointments] success', { count: appointments.length, customer_id: req.user.id });
        res.json(appointments);
    } catch (err) {
        console.error('[GET /api/customer/appointments] error', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/categories', async (req, res) => {
    try {
        const { gender } = req.query;
        const validGenders = ['men', 'women', 'tattoos'];
        let query = `SELECT category_id, name, gender, image_url, created_at,
                            CASE WHEN image_data IS NOT NULL THEN TRUE ELSE FALSE END AS has_image
                       FROM categories`;
        const params = [];
        if (gender && validGenders.includes(gender)) {
            query += ' WHERE gender = $1';
            params.push(gender);
        }
        query += ` ORDER BY 
            CASE WHEN gender = 'women' THEN
                CASE UPPER(name)
                    WHEN 'THREADING' THEN 1
                    WHEN 'WAXING' THEN 2
                    WHEN 'BEAUTY SERVICES' THEN 3
                    WHEN 'HAIR COLOURING' THEN 4
                    WHEN 'HAIR COLOURINGS' THEN 4
                    WHEN 'HAIR TREATMENT' THEN 5
                    WHEN 'HAIR TREATMENTS' THEN 5
                    WHEN 'HAIR SPA' THEN 6
                    WHEN 'MANICURE & PEDICURE' THEN 7
                    WHEN 'MANICURE&PEDICURE' THEN 7
                    WHEN 'BRIDAL MAKEUP' THEN 8
                    ELSE 20
                END
            ELSE
                CASE UPPER(name)
                    WHEN 'HAIRCUT' THEN 1
                    WHEN 'BEARD' THEN 2
                    WHEN 'KIDS' THEN 3
                    WHEN 'BEAUTY' THEN 4
                    WHEN 'MASSAGES' THEN 5
                    WHEN 'HEAD OIL MASSAGE' THEN 6
                    WHEN 'HAIR COLOURINGS' THEN 7
                    WHEN 'HAIR COLOURING' THEN 7
                    WHEN 'HAIR TREATMENT' THEN 8
                    WHEN 'HAIR TREATMENTS' THEN 8
                    WHEN 'PEDICURE' THEN 9
                    WHEN 'MANICURE' THEN 10
                    WHEN 'MAKEUP' THEN 11
                    WHEN 'MAKE UP' THEN 11
                    ELSE 20
                END
            END, category_id`;
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[/api/categories]', err.message);
        res.status(500).json([]);
    }
});

// Accepts optional ?lang=en|te|hi — returns translated descriptions with English fallback
app.get('/api/services', async (req, res) => {
    try {
        const { categoryId, lang } = req.query;
        const safeLang = ['en', 'te', 'hi'].includes(lang) ? lang : 'en';

        let query, params;

        if (safeLang === 'en') {
            // English: just return base service columns
            query = `
                SELECT s.*, c.name AS category_name, c.gender
                FROM services s
                JOIN categories c ON s.category_id = c.category_id
                WHERE s.is_enabled = true
            `;
            params = [];
            if (categoryId) {
                query += ' AND s.category_id = $1';
                params.push(categoryId);
            }
        } else {
            // Non-English: LEFT JOIN translations, fall back to base English columns
            query = `
                SELECT
                    s.*,
                    c.name AS category_name, c.gender,
                    COALESCE(t.description_what, s.description_what) AS description_what,
                    COALESCE(t.description_why,  s.description_why)  AS description_why,
                    COALESCE(t.description_how,  s.description_how)  AS description_how
                FROM services s
                JOIN categories c ON s.category_id = c.category_id
                LEFT JOIN service_translations t
                    ON t.service_id = s.service_id AND t.lang_code = $1
                WHERE s.is_enabled = true
            `;
            params = [safeLang];
            if (categoryId) {
                query += ' AND s.category_id = $2';
                params.push(categoryId);
            }
        }

        query += ` ORDER BY 
            CASE WHEN c.gender = 'women' THEN
                CASE UPPER(c.name)
                    WHEN 'THREADING' THEN 1
                    WHEN 'WAXING' THEN 2
                    WHEN 'BEAUTY SERVICES' THEN 3
                    WHEN 'HAIR COLOURING' THEN 4
                    WHEN 'HAIR COLOURINGS' THEN 4
                    WHEN 'HAIR TREATMENT' THEN 5
                    WHEN 'HAIR TREATMENTS' THEN 5
                    WHEN 'HAIR SPA' THEN 6
                    WHEN 'MANICURE & PEDICURE' THEN 7
                    WHEN 'MANICURE&PEDICURE' THEN 7
                    WHEN 'BRIDAL MAKEUP' THEN 8
                    ELSE 20
                END
            ELSE
                CASE UPPER(c.name)
                    WHEN 'HAIRCUT' THEN 1
                    WHEN 'BEARD' THEN 2
                    WHEN 'KIDS' THEN 3
                    WHEN 'BEAUTY' THEN 4
                    WHEN 'MASSAGES' THEN 5
                    WHEN 'HEAD OIL MASSAGE' THEN 6
                    WHEN 'HAIR COLOURINGS' THEN 7
                    WHEN 'HAIR COLOURING' THEN 7
                    WHEN 'HAIR TREATMENT' THEN 8
                    WHEN 'HAIR TREATMENTS' THEN 8
                    WHEN 'PEDICURE' THEN 9
                    WHEN 'MANICURE' THEN 10
                    WHEN 'MAKEUP' THEN 11
                    WHEN 'MAKE UP' THEN 11
                    ELSE 20
                END
            END, CASE WHEN s.name = 'Hair Cut' THEN 0 ELSE 1 END, s.service_id`;
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[/api/services]', err.message);
        res.status(500).json([]);
    }
});

// Helper: load all settings as a key→value object
async function loadSettings() {
    const r = await db.query('SELECT `key`, `value` FROM settings');
    const s = {};
    r.rows.forEach(row => { s[row.key] = row.value; });
    return s;
}

// Helper: generate all time slots for a date given settings
function generateSlots(settings, dateStr) {
    const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun
    const workingDays = (settings.working_days || '1,2,3,4,5,6').split(',').map(Number);
    if (!workingDays.includes(dayOfWeek)) return [];

    const [sh, sm] = (settings.working_start || '09:00').split(':').map(Number);
    const [eh, em] = (settings.working_end   || '23:00').split(':').map(Number);
    const duration = parseInt(settings.slot_duration || '30');

    const slots = [];
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + duration <= end) {
        const hh = String(Math.floor(cur / 60)).padStart(2, '0');
        const mm = String(cur % 60).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
        cur += duration;
    }
    return slots;
}

// Helper: convert HH:MM string to minutes from midnight
function timeToMins(hhmm) {
    const parts = String(hhmm).slice(0, 5).split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

// /api/availability and /api/bookings are handled by routes/scheduling.js (mounted below)

app.get('/api/admin/services', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT s.*, c.name as category_name, c.gender,
                   COUNT(bs.service_id) AS billing_count
            FROM services s
            JOIN categories c ON s.category_id = c.category_id
            LEFT JOIN billing_services bs ON bs.service_id = s.service_id
            GROUP BY s.service_id, c.category_id, c.name, c.gender
            ORDER BY c.gender, c.category_id, s.service_id
        `);
        res.json(result.rows.map(r => ({ ...r, billing_count: parseInt(r.billing_count) || 0 })));
    } catch (err) {
        console.error('[GET /api/admin/services]', err.message);
        res.status(500).json([]);
    }
});

app.post('/api/admin/services', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { category_id, name, price, is_enabled } = req.body;
        await db.query(
            'INSERT INTO services (category_id, name, price, is_enabled) VALUES ($1, $2, $3, $4)',
            [category_id, name, price, is_enabled !== false]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[POST /api/admin/services]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/admin/services/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { price, is_enabled } = req.body;
        const updates = [];
        const values = [];
        let p = 1;
        if (price !== undefined) { updates.push(`price = $${p++}`); values.push(price); }
        if (is_enabled !== undefined) { updates.push(`is_enabled = $${p++}`); values.push(is_enabled); }
        if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
        values.push(id);
        await db.query(`UPDATE services SET ${updates.join(', ')} WHERE service_id = $${p}`, values);
        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/admin/services/:id]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/admin/services/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const check = await db.query(
            'SELECT COUNT(*) FROM billing_services WHERE service_id = $1', [id]
        );
        if (parseInt(check.rows[0].count) > 0) {
            return res.status(409).json({ success: false, error: 'Cannot delete: this service has billing records.' });
        }
        await db.query('DELETE FROM services WHERE service_id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/admin/services/:id]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET all translations for a service (admin use)
app.get('/api/admin/services/:id/translations', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM service_translations WHERE service_id = $1',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[GET /api/admin/services/:id/translations]', err.message);
        res.status(500).json([]);
    }
});

// UPSERT translations for a service + language
app.put('/api/admin/services/:id/translations', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { lang_code, description_what, description_why, description_how } = req.body;
        if (!['en', 'te', 'hi'].includes(lang_code)) {
            return res.status(400).json({ error: 'Invalid lang_code. Use en, te, or hi.' });
        }
        await db.query(`
            INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON DUPLICATE KEY UPDATE
                description_what = $3,
                description_why  = $4,
                description_how  = $5,
                updated_at       = NOW()
        `, [id, lang_code, description_what, description_why, description_how]);
        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/admin/services/:id/translations]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Image Storage API ────────────────────────────────────────────────────────

// Public: serve a category image
app.get('/api/images/category/:id', async (req, res) => {
    try {
        const r = await db.query(
            'SELECT image_data, image_mime_type, image_filename FROM categories WHERE category_id = $1',
            [req.params.id]
        );
        if (!r.rows.length || !r.rows[0].image_data) return res.status(404).end();
        const { image_data, image_mime_type, image_filename } = r.rows[0];
        res.set('Content-Type', image_mime_type || 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');
        res.set('Content-Disposition', `inline; filename="${image_filename || 'image'}"`);
        res.send(image_data);
    } catch (err) {
        console.error('[GET /api/images/category/:id]', err.message);
        res.status(500).end();
    }
});

// Public: serve a service image
app.get('/api/images/service/:id', async (req, res) => {
    try {
        const r = await db.query(
            'SELECT image_data, image_mime_type, image_filename FROM services WHERE service_id = $1',
            [req.params.id]
        );
        if (!r.rows.length || !r.rows[0].image_data) return res.status(404).end();
        const { image_data, image_mime_type, image_filename } = r.rows[0];
        res.set('Content-Type', image_mime_type || 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');
        res.set('Content-Disposition', `inline; filename="${image_filename || 'image'}"`);
        res.send(image_data);
    } catch (err) {
        console.error('[GET /api/images/service/:id]', err.message);
        res.status(500).end();
    }
});

// Admin: upload / replace a category image
app.post('/api/admin/categories/:id/image', authenticateToken, isAdmin,
    upload.single('image'),
    async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });
        try {
            await db.query(
                `UPDATE categories
                    SET image_data = $1, image_mime_type = $2, image_filename = $3
                  WHERE category_id = $4`,
                [req.file.buffer, req.file.mimetype, req.file.originalname, req.params.id]
            );
            res.json({ success: true });
        } catch (err) {
            console.error('[POST /api/admin/categories/:id/image]', err.message);
            res.status(500).json({ error: err.message });
        }
    }
);

// Admin: delete a category image
app.delete('/api/admin/categories/:id/image', authenticateToken, isAdmin, async (req, res) => {
    try {
        await db.query(
            `UPDATE categories SET image_data = NULL, image_mime_type = NULL, image_filename = NULL WHERE category_id = $1`,
            [req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/admin/categories/:id/image]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Admin: upload / replace a service image
app.post('/api/admin/services/:id/image', authenticateToken, isAdmin,
    upload.single('image'),
    async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });
        try {
            await db.query(
                `UPDATE services
                    SET image_data = $1, image_mime_type = $2, image_filename = $3
                  WHERE service_id = $4`,
                [req.file.buffer, req.file.mimetype, req.file.originalname, req.params.id]
            );
            res.json({ success: true });
        } catch (err) {
            console.error('[POST /api/admin/services/:id/image]', err.message);
            res.status(500).json({ error: err.message });
        }
    }
);

// Admin: delete a service image
app.delete('/api/admin/services/:id/image', authenticateToken, isAdmin, async (req, res) => {
    try {
        await db.query(
            `UPDATE services SET image_data = NULL, image_mime_type = NULL, image_filename = NULL WHERE service_id = $1`,
            [req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/admin/services/:id/image]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Admin: create a new category
app.post('/api/admin/categories', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { name, gender } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
        const validGenders = ['men', 'women', 'tattoos'];
        const safeGender = validGenders.includes(gender) ? gender : 'men';
        const r = await db.query(
            `INSERT INTO categories (name, gender) VALUES ($1, $2)`,
            [name.trim(), safeGender]
        );
        res.json({ success: true, category_id: r.insertId });
    } catch (err) {
        console.error('[POST /api/admin/categories]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Admin: delete a category (blocked if it has services)
app.delete('/api/admin/categories/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const svcCheck = await db.query('SELECT COUNT(*) FROM services WHERE category_id = $1', [id]);
        const count = parseInt(svcCheck.rows[0].count);
        if (count > 0)
            return res.status(400).json({ error: `Cannot delete: this category has ${count} service${count > 1 ? 's' : ''} linked to it. Delete or reassign them first.` });
        await db.query('DELETE FROM categories WHERE category_id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/admin/categories/:id]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Admin: rename a category label
app.put('/api/admin/categories/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
        await db.query('UPDATE categories SET name = $1 WHERE category_id = $2', [name.trim(), req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/admin/categories/:id]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Admin: get all categories (for image management panel)
app.get('/api/admin/categories', authenticateToken, isAdmin, async (req, res) => {
    try {
        const r = await db.query(
            `SELECT category_id, name, gender,
                    CASE WHEN image_data IS NOT NULL THEN TRUE ELSE FALSE END AS has_image,
                    image_filename
               FROM categories ORDER BY gender, category_id`
        );
        res.json(r.rows);
    } catch (err) {
        console.error('[GET /api/admin/categories]', err.message);
        res.status(500).json([]);
    }
});

// ─── Gallery Images API ───────────────────────────────────────────────────────

// Public: list active gallery images (metadata only, no binary)
app.get('/api/gallery', async (req, res) => {
    try {
        const r = await db.query(
            `SELECT image_id, image_filename, caption, sort_order
               FROM gallery_images
              WHERE is_active = TRUE
              ORDER BY sort_order ASC, image_id ASC`
        );
        res.json(r.rows);
    } catch (err) {
        console.error('[GET /api/gallery]', err.message);
        res.status(500).json([]);
    }
});

// Public: serve a gallery image binary
app.get('/api/gallery/:id/image', async (req, res) => {
    try {
        const r = await db.query(
            'SELECT image_data, image_mime_type, image_filename FROM gallery_images WHERE image_id = $1 AND is_active = TRUE',
            [req.params.id]
        );
        if (!r.rows.length || !r.rows[0].image_data) return res.status(404).end();
        const { image_data, image_mime_type, image_filename } = r.rows[0];
        res.set('Content-Type', image_mime_type || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        res.set('Content-Disposition', `inline; filename="${image_filename || 'gallery'}"`);
        res.send(image_data);
    } catch (err) {
        console.error('[GET /api/gallery/:id/image]', err.message);
        res.status(500).end();
    }
});

// Admin: list all gallery images (including inactive)
app.get('/api/admin/gallery', authenticateToken, isAdmin, async (req, res) => {
    try {
        const r = await db.query(
            `SELECT image_id, image_filename, caption, sort_order, is_active, created_at
               FROM gallery_images ORDER BY sort_order ASC, image_id ASC`
        );
        res.json(r.rows);
    } catch (err) {
        console.error('[GET /api/admin/gallery]', err.message);
        res.status(500).json([]);
    }
});

// Admin: upload a new gallery image
app.post('/api/admin/gallery', authenticateToken, isAdmin,
    upload.single('image'),
    async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });
        try {
            const caption    = req.body.caption    || '';
            const sort_order = parseInt(req.body.sort_order) || 0;
            const r = await db.query(
                `INSERT INTO gallery_images (image_data, image_mime_type, image_filename, caption, sort_order)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.file.buffer, req.file.mimetype, req.file.originalname, caption, sort_order]
            );
            res.json({ success: true, image_id: r.insertId });
        } catch (err) {
            console.error('[POST /api/admin/gallery]', err.message);
            res.status(500).json({ error: err.message });
        }
    }
);

// Admin: update gallery image metadata (caption, sort_order, is_active)
app.put('/api/admin/gallery/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { caption, sort_order, is_active } = req.body;
        await db.query(
            `UPDATE gallery_images
                SET caption = COALESCE($1, caption),
                    sort_order = COALESCE($2, sort_order),
                    is_active = COALESCE($3, is_active)
              WHERE image_id = $4`,
            [caption, sort_order !== undefined ? parseInt(sort_order) : undefined, is_active, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/admin/gallery/:id]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Admin: replace gallery image binary
app.post('/api/admin/gallery/:id/replace', authenticateToken, isAdmin,
    upload.single('image'),
    async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });
        try {
            await db.query(
                `UPDATE gallery_images SET image_data=$1, image_mime_type=$2, image_filename=$3 WHERE image_id=$4`,
                [req.file.buffer, req.file.mimetype, req.file.originalname, req.params.id]
            );
            res.json({ success: true });
        } catch (err) {
            console.error('[POST /api/admin/gallery/:id/replace]', err.message);
            res.status(500).json({ error: err.message });
        }
    }
);

// Admin: delete a gallery image permanently
app.delete('/api/admin/gallery/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM gallery_images WHERE image_id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/admin/gallery/:id]', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { from, to } = req.query;
        let whereClause = '';
        let params = [];

        if (from && to) {
            whereClause = ' AND appointment_date BETWEEN ? AND ?';
            params = [from, to];
        } else if (from) {
            whereClause = ' AND appointment_date >= ?';
            params = [from];
        } else if (to) {
            whereClause = ' AND appointment_date <= ?';
            params = [to];
        }

        const activeBookings  = await db.query('SELECT COUNT(*) AS count FROM appointments WHERE status IN ("Pending", "Confirmed")' + whereClause, params);
        const globalBookings  = await db.query('SELECT COUNT(*) AS count FROM appointments WHERE 1=1' + whereClause, params);
        const totalRevenue    = await db.query('SELECT SUM(total_cost) AS sum FROM appointments WHERE status = "Completed"' + whereClause, params);
        const activeCustomers  = await db.query('SELECT COUNT(DISTINCT customer_id) AS count FROM appointments WHERE status = "Confirmed"' + whereClause, params);
        
        let globalCustomers;
        if (whereClause) {
            globalCustomers = await db.query('SELECT COUNT(DISTINCT customer_id) AS count FROM appointments WHERE 1=1' + whereClause, params);
        } else {
            globalCustomers = await db.query('SELECT COUNT(*) AS count FROM customers');
        }
        
        res.json({
            activeBookings:  parseInt(activeBookings.rows[0]?.count  || 0),
            globalBookings:  parseInt(globalBookings.rows[0]?.count  || 0),
            totalRevenue:    parseFloat(totalRevenue.rows[0]?.sum    || 0),
            activeCustomers: parseInt(activeCustomers.rows[0]?.count || 0),
            globalCustomers: parseInt(globalCustomers.rows[0]?.count || 0)
        });
    } catch (err) {
        console.error('[GET /api/admin/stats]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/appointments handled by routes/scheduling.js (richer query with employee/resource joins)

app.put('/api/admin/appointments/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    // Fetch old status to detect change
    const oldRes = await db.query('SELECT status FROM appointments WHERE appointment_id = $1', [id]);
    const oldStatus = oldRes.rows[0]?.status;

    await db.query('UPDATE appointments SET status = $1 WHERE appointment_id = $2', [status, id]);

    // If transitioned to Confirmed — send slot confirmation email
    if (status === 'Confirmed' && oldStatus !== 'Confirmed') {
        try {
            const apptQuery = await db.query(`
                SELECT a.appointment_id, a.appointment_date, a.appointment_time, 
                       c.name AS customer_name, c.email AS customer_email,
                       (
                           SELECT JSON_ARRAYAGG(JSON_OBJECT('service_name', s.name, 'quantity', aps.quantity))
                           FROM appointment_services aps
                           JOIN services s ON s.service_id = aps.service_id
                           WHERE aps.appointment_id = a.appointment_id
                       ) AS services
                FROM appointments a
                JOIN customers c ON c.customer_id = a.customer_id
                WHERE a.appointment_id = $1
            `, [id]);

            if (apptQuery.rows.length && apptQuery.rows[0].customer_email) {
                const fa = apptQuery.rows[0];
                const baseUrl = `${req.protocol}://${req.get('host')}`;
                sendSlotConfirmationEmail(fa.customer_email, {
                    customerName:    fa.customer_name,
                    appointmentDate: fa.appointment_date,
                    appointmentTime: fa.appointment_time,
                    services:        fa.services || [],
                    baseUrl
                }).catch(e => console.error('[Email] Slot confirm failed:', e.message));
            }
        } catch (e) {
            console.error('[Email] Load for confirm failed:', e.message);
        }
    }

    res.json({ success: true });
});

// Quick confirm / deny for pending appointments
app.post('/api/admin/appointments/:id/confirm', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(
            `UPDATE appointments SET status = 'Confirmed', admin_note = NULL WHERE appointment_id = $1`,
            [id]
        );
        await db.query(
            `INSERT INTO appointment_audit_log (appointment_id, changed_by_role, old_status, new_status, notes)
             VALUES ($1, 'admin', 'Pending', 'Confirmed', 'Admin confirmed appointment')`,
            [id]
        );

        // ── Send slot confirmation email immediately (OTP-style theme) ──
        try {
            const apptQuery = await db.query(`
                SELECT a.appointment_id, a.appointment_date, a.appointment_time, 
                       c.name AS customer_name, c.email AS customer_email,
                       (
                           SELECT JSON_ARRAYAGG(JSON_OBJECT('service_name', s.name, 'quantity', aps.quantity))
                           FROM appointment_services aps
                           JOIN services s ON s.service_id = aps.service_id
                           WHERE aps.appointment_id = a.appointment_id
                       ) AS services
                FROM appointments a
                JOIN customers c ON c.customer_id = a.customer_id
                WHERE a.appointment_id = $1
            `, [id]);

            if (apptQuery.rows.length && apptQuery.rows[0].customer_email) {
                const fa = apptQuery.rows[0];
                const baseUrl = `${req.protocol}://${req.get('host')}`;
                sendSlotConfirmationEmail(fa.customer_email, {
                    customerName:    fa.customer_name,
                    appointmentDate: fa.appointment_date,
                    appointmentTime: fa.appointment_time,
                    services:        fa.services || [],
                    baseUrl
                }).catch(e => console.error('[Email] Slot confirm failed:', e.message));
            }
        } catch (emailErr) {
            console.error('[Email] Load appt for confirm failed:', emailErr.message);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[POST /confirm]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/admin/appointments/:id/deny', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const note = reason?.trim() || 'Slot not available';
        await db.query(
            `UPDATE appointments SET status = 'Cancelled', admin_note = $1 WHERE appointment_id = $2`,
            [note, id]
        );
        await db.query(
            `INSERT INTO appointment_audit_log (appointment_id, changed_by_role, old_status, new_status, notes)
             VALUES ($1, 'admin', 'Pending', 'Cancelled', $2)`,
            [id, 'Admin denied: ' + note]
        );

        // Send Denial Email
        try {
            const apptRes = await db.query(
                `SELECT a.appointment_date, a.appointment_time, c.name, c.email
                   FROM appointments a JOIN customers c ON c.customer_id = a.customer_id
                  WHERE a.appointment_id = $1`, [id]
            );
            if (apptRes.rows.length && apptRes.rows[0].email) {
                const fa = apptRes.rows[0];
                sendDenialEmail(fa.email, {
                    customerName:    fa.name,
                    appointmentDate: fa.appointment_date,
                    appointmentTime: fa.appointment_time,
                    reason:          note
                }).catch(e => console.error('[Email] Denial failed:', e.message));
            }
        } catch (e) { console.error('[Email] Load appt for deny failed:', e.message); }

        res.json({ success: true });
    } catch (err) {
        console.error('[POST /deny]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/// ── Admin: request online payment from customer (with optional manual discount) ──────
app.post('/api/admin/appointments/:id/request-payment', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { manual_discount_amount = 0, manual_discount_type = null } = req.body;
        const manualDisc = Math.max(0, parseFloat(manual_discount_amount) || 0);

        await db.query(
            `UPDATE appointments
                SET payment_requested        = TRUE,
                    manual_discount_amount   = $1,
                    manual_discount_type     = COALESCE($2, manual_discount_type)
              WHERE appointment_id = $3`,
            [manualDisc, manual_discount_type || null, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[POST /request-payment]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/// ── Admin: manually collect payment & complete appointment ────────────────────
app.post('/api/admin/appointments/:id/collect-payment', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, method = 'Cash', manual_discount_amount = 0, manual_discount_type = null } = req.body;
        const paid = parseFloat(amount);
        if (isNaN(paid) || paid <= 0) return res.status(400).json({ error: 'Invalid amount' });
        const manualDisc = Math.max(0, parseFloat(manual_discount_amount) || 0);

        const r = await db.query(
            `UPDATE appointments
                SET advance_paid             = COALESCE(advance_paid, 0) + $1,
                    manual_discount_amount   = $2,
                    manual_discount_type     = COALESCE($3, manual_discount_type),
                    status = CASE
                        WHEN (COALESCE(advance_paid, 0) + $1) >= (total_cost - COALESCE(discount_amount,0) - $2)
                        THEN 'Completed'
                        ELSE status
                    END,
                    payment_requested = FALSE
              WHERE appointment_id = $4`,
            [paid, manualDisc, manual_discount_type || null, id]
        );
        const apptRes = await db.query('SELECT status, advance_paid, total_cost, discount_amount, manual_discount_amount FROM appointments WHERE appointment_id = $1', [id]);
        if (!apptRes.rows.length) return res.status(404).json({ error: 'Not found' });
        const appt = apptRes.rows[0];

        const promoNote  = parseFloat(appt.discount_amount || 0) > 0 ? ` | Promo discount: ₹${appt.discount_amount}` : '';
        const manualNote = manualDisc > 0 ? ` | Manual discount: ₹${manualDisc}` : '';
        await db.query(
            `INSERT INTO appointment_audit_log (appointment_id, changed_by_role, old_status, new_status, notes)
             VALUES ($1, 'admin', $2, $3, $4)`,
            [id, appt.status === 'Completed' ? 'Confirmed' : appt.status, appt.status,
             `Payment collected via ${method}: ₹${paid}${promoNote}${manualNote}`]
        );
        res.json({ success: true, new_status: appt.status });

        // ── Send invoice email to customer after every payment collection ──
        try {
            const fullAppt = await db.query(`
                SELECT a.appointment_id, a.appointment_date, a.appointment_time,
                       a.total_cost, a.advance_paid, a.status,
                       a.discount_amount, a.discount_code,
                       COALESCE(a.manual_discount_amount,0) AS manual_discount_amount, a.manual_discount_type,
                       c.name AS customer_name, c.email AS customer_email,
                       c.mobile_number AS customer_mobile,
                       COALESCE(
                           (
                                SELECT JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                        'service_name', s.name,
                                        'price', s.price,
                                        'quantity', aps.quantity
                                    )
                                )
                                FROM appointment_services aps
                                JOIN services s ON s.service_id = aps.service_id
                                WHERE aps.appointment_id = a.appointment_id
                           ),
                           JSON_ARRAY()
                       ) AS services
                  FROM appointments a
                  JOIN customers c ON c.customer_id = a.customer_id
                 WHERE a.appointment_id = $1
                 GROUP BY a.appointment_id, c.name, c.email, c.mobile_number
            `, [id]);

            if (fullAppt.rows.length && fullAppt.rows[0].customer_email) {
                const fa = fullAppt.rows[0];
                const baseUrl = `${req.protocol}://${req.get('host')}`;
                sendInvoiceEmail(fa.customer_email, {
                    appointmentId:        fa.appointment_id,
                    customerName:         fa.customer_name,
                    customerEmail:        fa.customer_email,
                    customerMobile:       fa.customer_mobile || '',
                    appointmentDate:      fa.appointment_date instanceof Date
                        ? fa.appointment_date.toISOString().slice(0, 10)
                        : String(fa.appointment_date).slice(0, 10),
                    appointmentTime:      fa.appointment_time,
                    services:             fa.services,
                    totalCost:            parseFloat(fa.total_cost || 0),
                    advancePaid:          parseFloat(fa.advance_paid || 0),
                    discountAmount:       parseFloat(fa.discount_amount || 0),
                    discountCode:         fa.discount_code || null,
                    manualDiscountAmount: parseFloat(fa.manual_discount_amount || 0),
                    manualDiscountType:   fa.manual_discount_type || null,
                    status:               appt.status,
                    baseUrl,
                }).catch(err => console.error('[Email] Collect-payment invoice failed:', err.message));
            }
        } catch (emailErr) {
            console.error('[Email] Could not load appointment for email:', emailErr.message);
        }

    } catch (err) {
        console.error('[POST /collect-payment]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin: download invoice PDF for any appointment
app.get('/api/admin/appointments/:id/invoice', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const apptRes = await db.query(`
            SELECT a.appointment_id, a.appointment_date, a.appointment_time,
                   a.total_cost, a.advance_paid, a.status,
                   a.discount_amount, a.discount_code,
                   COALESCE(a.manual_discount_amount,0) AS manual_discount_amount, a.manual_discount_type,
                   c.name AS customer_name, c.email AS customer_email,
                   c.mobile_number AS customer_mobile,
                   (
                       SELECT COALESCE(
                           JSON_ARRAYAGG(
                               JSON_OBJECT(
                                   'service_name', s.name,
                                   'price', s.price,
                                   'quantity', aps.quantity
                               )
                           ),
                           JSON_ARRAY()
                       )
                       FROM appointment_services aps
                       JOIN services s ON s.service_id = aps.service_id
                       WHERE aps.appointment_id = a.appointment_id
                   ) AS services
              FROM appointments a
              JOIN customers c ON c.customer_id = a.customer_id
             WHERE a.appointment_id = $1
        `, [id]);

        if (!apptRes.rows.length) return res.status(404).json({ error: 'Appointment not found' });
        const fa = apptRes.rows[0];

        const year      = fa.appointment_date instanceof Date
            ? fa.appointment_date.getFullYear()
            : String(fa.appointment_date).slice(0, 4);
        const invoiceNo = `KB-${year}-${id}`;

        const pdfBuffer = await buildInvoicePdf({
            appointmentId:        fa.appointment_id,
            customerName:         fa.customer_name,
            customerEmail:        fa.customer_email || '',
            customerMobile:       fa.customer_mobile || '',
            appointmentDate:      fa.appointment_date instanceof Date
                ? fa.appointment_date.toISOString().slice(0, 10)
                : String(fa.appointment_date).slice(0, 10),
            appointmentTime:      fa.appointment_time,
            services:             fa.services,
            totalCost:            parseFloat(fa.total_cost || 0),
            advancePaid:          parseFloat(fa.advance_paid || 0),
            discountAmount:       parseFloat(fa.discount_amount || 0),
            discountCode:         fa.discount_code || null,
            manualDiscountAmount: parseFloat(fa.manual_discount_amount || 0),
            manualDiscountType:   fa.manual_discount_type || null,
            status:               fa.status || 'Confirmed',
        }, invoiceNo);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="KB_Invoice_${invoiceNo}.pdf"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('[GET /invoice]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Promo Codes ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Validate a promo code (public — used by booking & dashboard)
app.post('/api/promo-codes/validate', async (req, res) => {
    try {
        const { code, order_amount = 0 } = req.body;
        if (!code) return res.json({ valid: false, error: 'Please enter a promo code.' });

        const r = await db.query(
            `SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1) AND is_active = TRUE`,
            [code.trim()]
        );
        if (!r.rows.length) return res.json({ valid: false, error: 'Invalid promo code.' });

        const p = r.rows[0];
        if (p.valid_until && new Date(p.valid_until) < new Date()) {
            return res.json({ valid: false, error: 'This promo code has expired.' });
        }
        if (p.max_uses !== null && p.used_count >= p.max_uses) {
            return res.json({ valid: false, error: 'This promo code has reached its usage limit.' });
        }
        const orderAmt = parseFloat(order_amount) || 0;
        if (orderAmt > 0 && orderAmt < parseFloat(p.min_order_amount || 0)) {
            return res.json({ valid: false, error: `Minimum order amount ₹${p.min_order_amount} required.` });
        }

        let discount = 0;
        if (p.discount_type === 'percent') {
            discount = Math.round(orderAmt * parseFloat(p.discount_value) / 100);
            if (p.max_discount_cap) discount = Math.min(discount, parseFloat(p.max_discount_cap));
        } else {
            discount = parseFloat(p.discount_value);
        }
        discount = Math.min(discount, orderAmt); // never exceed order amount

        res.json({
            valid:          true,
            promo_id:       p.promo_id,
            code:           p.code.toUpperCase(),
            discount_type:  p.discount_type,
            discount_value: p.discount_value,
            discount_amount: discount,
            description:    p.description,
        });
    } catch (err) {
        console.error('[POST /promo-codes/validate]', err.message);
        res.status(500).json({ valid: false, error: 'Server error.' });
    }
});

// Admin CRUD for promo codes
app.get('/api/admin/promo-codes', authenticateToken, isAdmin, async (req, res) => {
    try {
        const r = await db.query(`SELECT * FROM promo_codes ORDER BY created_at DESC`);
        res.json(r.rows);
    } catch (err) {
        console.error('[GET /admin/promo-codes]', err.message);
        res.status(500).json({ error: 'Failed to load promo codes: ' + err.message });
    }
});

app.post('/api/admin/promo-codes', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { code, description, discount_type, discount_value, min_order_amount = 0,
                max_discount_cap = null, max_uses = null, valid_until = null } = req.body;
        if (!code || !discount_type || !discount_value)
            return res.status(400).json({ success: false, error: 'Code, type and value are required.' });

        await db.query(
            `INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order_amount, max_discount_cap, max_uses, valid_until)
             VALUES (UPPER($1), $2, $3, $4, $5, $6, $7, $8)`,
            [code.trim(), description || null, discount_type, parseFloat(discount_value),
             parseFloat(min_order_amount) || 0, max_discount_cap ? parseFloat(max_discount_cap) : null,
             max_uses ? parseInt(max_uses) : null, valid_until || null]
        );
        res.json({ success: true });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ success: false, error: 'Promo code already exists.' });
        console.error('[POST /admin/promo-codes]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/admin/promo-codes/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { description, discount_type, discount_value, min_order_amount = 0,
                max_discount_cap = null, max_uses = null, valid_until = null, is_active = true } = req.body;
        await db.query(
            `UPDATE promo_codes SET description=$1, discount_type=$2, discount_value=$3,
             min_order_amount=$4, max_discount_cap=$5, max_uses=$6, valid_until=$7, is_active=$8
             WHERE promo_id=$9`,
            [description || null, discount_type, parseFloat(discount_value),
             parseFloat(min_order_amount) || 0, max_discount_cap ? parseFloat(max_discount_cap) : null,
             max_uses ? parseInt(max_uses) : null, valid_until || null, is_active, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /admin/promo-codes]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.patch('/api/admin/promo-codes/:id/toggle', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        await db.query(`UPDATE promo_codes SET is_active=$1 WHERE promo_id=$2`, [is_active, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('[PATCH /admin/promo-codes/toggle]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/admin/promo-codes/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await db.query(`DELETE FROM promo_codes WHERE promo_id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/admin/customers', authenticateToken, isAdmin, async (req, res) => {
    const result = await db.query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json(result.rows);
});

// Customer search (for admin appointment creation)
app.get('/api/admin/customers/search', authenticateToken, isAdmin, async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q) return res.json([]);
        const result = await db.query(
            `SELECT customer_id, name, email, mobile_number
               FROM customers
              WHERE name LIKE $1 OR mobile_number LIKE $1
              ORDER BY name LIMIT 10`,
            [`%${q}%`]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[GET /api/admin/customers/search]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Admin creates appointment on behalf of customer
app.post('/api/admin/appointments/create', authenticateToken, isAdmin, async (req, res) => {
    const client = await db.connect();
    try {
        const { customerInfo, appointmentDate, appointmentTime, services, totalCost,
                status = 'Confirmed', adminNote = '' } = req.body;

        if (!customerInfo?.name || !customerInfo?.mobile_number)
            return res.status(400).json({ success: false, error: 'Customer name and mobile are required.' });
        if (!appointmentDate || !appointmentTime)
            return res.status(400).json({ success: false, error: 'Date and time are required.' });
        if (!Array.isArray(services) || !services.length)
            return res.status(400).json({ success: false, error: 'At least one service is required.' });
        await client.query('BEGIN');

        // Upsert customer
        let customerId;
        const existing = await client.query(
            'SELECT customer_id, password_hash FROM customers WHERE mobile_number = $1',
            [customerInfo.mobile_number]
        );
        if (existing.rows && existing.rows.length > 0) {
            customerId = existing.rows[0].customer_id;
            await client.query(
                'UPDATE customers SET name=$1, email=COALESCE($2,email) WHERE customer_id=$3',
                [customerInfo.name, customerInfo.email || null, customerId]
            );
            // Set password if not yet set
            if (!existing.rows[0].password_hash) {
                await client.query(
                    'UPDATE customers SET password_hash=$1 WHERE customer_id=$2',
                    [hashPassword(customerInfo.mobile_number), customerId]
                );
            }
        } else {
            const newCust = await client.query(
                'INSERT INTO customers (name, email, mobile_number, password_hash) VALUES ($1,$2,$3,$4)',
                [customerInfo.name, customerInfo.email || null, customerInfo.mobile_number,
                 hashPassword(customerInfo.mobile_number)]
            );
            customerId = newCust.insertId;
        }

        // Insert appointment (admin-created → skip capacity check, set status directly)
        const timeKey = appointmentTime.slice(0, 5);
        const apptRes = await client.query(
            `INSERT INTO appointments
                (customer_id, appointment_date, appointment_time, total_cost, advance_paid, status)
             VALUES ($1,$2,$3,$4,0,$5)`,
            [customerId, appointmentDate, timeKey, parseFloat(totalCost) || 0, status]
        );
        const appointmentId = apptRes.insertId;

        for (const svc of services) {
            await client.query(
                'INSERT INTO appointment_services (appointment_id, service_id, quantity) VALUES ($1,$2,$3)',
                [appointmentId, parseInt(svc.service_id), parseInt(svc.quantity) || 1]
            );
        }

        // Save admin note if provided
        if (adminNote) {
            await client.query(
                'UPDATE appointments SET admin_note=$1 WHERE appointment_id=$2',
                [adminNote, appointmentId]
            );
        }

        // Audit log
        await client.query(
            `INSERT INTO appointment_audit_log (appointment_id, changed_by_role, new_status, notes)
             VALUES ($1, 'admin', $2, 'Appointment created by admin')`,
            [appointmentId, status]
        );

        await client.query('COMMIT');

        // Send Confirmation Email for Admin-Created Booking
        if (customerInfo.email) {
            try {
                // Fetch full details for email
                const fullAppt = await client.query(`
                    SELECT a.appointment_date, a.appointment_time, c.name, c.email,
                           (SELECT JSON_ARRAYAGG(JSON_OBJECT('service_name', s.name, 'quantity', aps.quantity))
                              FROM appointment_services aps JOIN services s ON s.service_id = aps.service_id
                             WHERE aps.appointment_id = a.appointment_id) AS services
                      FROM appointments a JOIN customers c ON c.customer_id = a.customer_id
                     WHERE a.appointment_id = $1`, [appointmentId]);
                
                if (fullAppt.rows.length) {
                    const fa = fullAppt.rows[0];
                    const baseUrl = `${req.protocol}://${req.get('host')}`;
                    sendSlotConfirmationEmail(fa.email, {
                        customerName:    fa.name,
                        appointmentDate: fa.appointment_date,
                        appointmentTime: fa.appointment_time,
                        services:        fa.services || [],
                        baseUrl
                    }).catch(e => console.error('[Email] Admin-create notify failed:', e.message));
                }
            } catch (e) { console.error('[Email] Admin-create load failed:', e.message); }
        }

        res.json({ success: true, appointmentId, customerId });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[POST /api/admin/appointments/create]', err.message);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

// GET single customer + their appointments
app.get('/api/admin/customers/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const cust = await db.query('SELECT * FROM customers WHERE customer_id = $1', [id]);
        if (!cust.rows.length) return res.status(404).json({ error: 'Not found' });
        const appts = await db.query(
            `SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.total_cost, a.advance_paid, a.status,
                    COALESCE(
                        (
                            SELECT JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    'service_name', s.name,
                                    'price', s.price,
                                    'quantity', aps.quantity
                                )
                            )
                            FROM appointment_services aps
                            JOIN services s ON s.service_id = aps.service_id
                            WHERE aps.appointment_id = a.appointment_id
                        ),
                        JSON_ARRAY()
                    ) AS services
               FROM appointments a
              WHERE a.customer_id = $1
              ORDER BY a.appointment_date DESC`,
            [id]
        );
        res.json({ ...cust.rows[0], appointments: appts.rows });
    } catch (err) {
        console.error('[GET /api/admin/customers/:id]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PATCH — update customer name / email / mobile
app.patch('/api/admin/customers/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, mobile_number } = req.body;
        const norm = mobile_number ? normalizeMobile(mobile_number) : null;
        if (norm) {
            const clash = await db.query(
                'SELECT customer_id FROM customers WHERE mobile_number = $1 AND customer_id != $2',
                [norm, id]
            );
            if (clash.rows.length) return res.status(409).json({ success: false, error: 'Mobile number already used by another customer.' });
        }
        if (norm) {
            // Mobile changed — also reset password to new mobile number
            await db.query(
                `UPDATE customers SET
                   name          = COALESCE($1, name),
                   email         = COALESCE($2, email),
                   mobile_number = $3,
                   password_hash = $4
                 WHERE customer_id = $5`,
                [name || null, email || null, norm, hashPassword(norm), id]
            );
        } else {
            await db.query(
                `UPDATE customers SET
                   name  = COALESCE($1, name),
                   email = COALESCE($2, email)
                 WHERE customer_id = $3`,
                [name || null, email || null, id]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[PATCH /api/admin/customers/:id]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE customer (cascades via appointments)
app.delete('/api/admin/customers/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Remove appointments first
        const appts = await db.query('SELECT appointment_id FROM appointments WHERE customer_id = $1', [id]);
        for (const a of appts.rows) {
            await db.query('DELETE FROM appointment_audit_log WHERE appointment_id = $1', [a.appointment_id]);
            await db.query('DELETE FROM appointment_services WHERE appointment_id = $1', [a.appointment_id]);
        }
        await db.query('DELETE FROM appointments WHERE customer_id = $1', [id]);
        await db.query('DELETE FROM customers WHERE customer_id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/admin/customers/:id]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PayU payment initiation — hash generated server-side (salt never sent to browser)
app.post('/api/payments/initiate', async (req, res) => {
    try {
        const { txnid, amount, productinfo, firstname, email, phone } = req.body;
        if (!txnid || !amount || !productinfo || !firstname) {
            return res.status(400).json({ error: 'Missing required payment fields' });
        }

        const key  = process.env.PAYU_KEY;
        const salt = process.env.PAYU_SALT;
        const url  = process.env.PAYU_URL;

        if (!key || !salt || !url) {
            return res.status(400).json({ error: 'Online payment is currently disabled. Please pay at the salon.' });
        }

        // PayU hash: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
        const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email || ''}|||||||||||${salt}`;
        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.json({
            payuUrl: url,
            params: {
                key,
                txnid,
                amount,
                productinfo,
                firstname,
                email: email || '',
                phone: phone || '',
                surl: `${baseUrl}/payment-success.html`,
                furl: `${baseUrl}/payment-failure.html`,
                hash
            }
        });
    } catch (err) {
        console.error('[PayU initiate]', err.message);
        res.status(500).json({ error: 'Payment initiation failed' });
    }
});

// Public: get all booking-relevant settings
app.get('/api/settings', async (req, res) => {
    try {
        const s = await loadSettings();
        res.json({
            gateway_available: !!(process.env.PAYU_KEY && process.env.PAYU_SALT),
            advance_type:      s.advance_type   || 'fixed',
            advance_value:     parseFloat(s.advance_value  || 1),
            working_start:     s.working_start  || '09:00',
            working_end:       s.working_end    || '21:00',
            slot_duration:     parseInt(s.slot_duration  || 30),
            working_days:      (s.working_days  || '0,1,2,3,4,5,6').split(',').map(Number),
            max_concurrent:    parseInt(s.max_concurrent || 1),
            cgst_rate:         parseFloat(s.cgst_rate || 0),
            sgst_rate:         parseFloat(s.sgst_rate || 0),
            social_instagram:  s.social_instagram  || '',
            social_facebook:   s.social_facebook   || '',
            social_youtube:    s.social_youtube    || '',
            social_twitter:    s.social_twitter    || '',
            social_tiktok:     s.social_tiktok     || '',
            maps_url:          s.maps_url          || '',
            proprietor_name:   s.proprietor_name   || 'SHAIK SHAHID',
            service_mobile:    s.service_mobile    || '+91 96404 01112',
            service_whatsapp:  s.service_whatsapp  || '919640401112'
        });
    } catch (err) {
        res.json({ advance_type: 'fixed', advance_value: 1, working_start: '09:00', working_end: '21:00', slot_duration: 30, working_days: [0,1,2,3,4,5,6], max_concurrent: 1, cgst_rate: 0, sgst_rate: 0 });
    }
});

// Admin: update all settings
app.put('/api/admin/settings', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { advance_type, advance_value, working_start, working_end, slot_duration, working_days, max_concurrent, cgst_rate, sgst_rate,
                social_instagram, social_facebook, social_youtube, social_twitter, social_whatsapp, social_tiktok, maps_url } = req.body;

        const upsert = (k, v) => db.query(
            "INSERT INTO settings (`key`,`value`) VALUES ($1,$2) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)",
            [k, String(v)]
        );

        if (advance_type !== undefined) {
            if (!['fixed','percent'].includes(advance_type)) return res.status(400).json({ error: 'Invalid advance_type' });
            await upsert('advance_type', advance_type);
        }
        if (advance_value !== undefined) await upsert('advance_value', parseFloat(advance_value));
        if (working_start !== undefined) await upsert('working_start', working_start);
        if (working_end   !== undefined) await upsert('working_end',   working_end);
        if (slot_duration !== undefined) await upsert('slot_duration', parseInt(slot_duration));
        if (working_days  !== undefined) await upsert('working_days',  Array.isArray(working_days) ? working_days.join(',') : working_days);
        if (max_concurrent !== undefined) await upsert('max_concurrent', parseInt(max_concurrent));
        if (cgst_rate  !== undefined) await upsert('cgst_rate',  parseFloat(cgst_rate)  || 0);
        if (sgst_rate  !== undefined) await upsert('sgst_rate',  parseFloat(sgst_rate)  || 0);
        if (social_instagram !== undefined) await upsert('social_instagram', social_instagram);
        if (social_facebook  !== undefined) await upsert('social_facebook',  social_facebook);
        if (social_youtube   !== undefined) await upsert('social_youtube',   social_youtube);
        if (social_twitter   !== undefined) await upsert('social_twitter',   social_twitter);
        if (social_whatsapp  !== undefined) await upsert('social_whatsapp',  social_whatsapp);
        if (social_tiktok    !== undefined) await upsert('social_tiktok',    social_tiktok);
        if (maps_url         !== undefined) await upsert('maps_url',         maps_url);

        const proprietor_name   = req.body.proprietor_name;
        const service_mobile    = req.body.service_mobile;
        const service_whatsapp  = req.body.service_whatsapp;

        if (proprietor_name   !== undefined) await upsert('proprietor_name', proprietor_name);
        if (service_mobile    !== undefined) await upsert('service_mobile',  service_mobile);
        if (service_whatsapp  !== undefined) await upsert('service_whatsapp', service_whatsapp);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Scheduling System Routes ─────────────────────────────────────────────────
// Handles: /api/availability, /api/bookings (enhanced),
//          /api/admin/employees, /api/admin/resources,
//          /api/admin/appointments (with filters + audit log),
//          /api/admin/settings/scheduling, /api/admin/services/:id/scheduling
const mountSchedulingRoutes = require('./routes/scheduling');
mountSchedulingRoutes(app, db, { authenticateToken, isAdmin, loadSettings, hashPassword, normalizeMobile });
// Email transporters now imported from ./email
const { buildInvoicePdf } = require('./email');

// ── In-memory OTP store (TTL 10 min) ─────────────────────────────────────────
const otpStore = new Map();
function cleanOtps() { for (const [k, v] of otpStore) if (v.exp < Date.now()) otpStore.delete(k); }

// GET /api/customers/check-mobile?mobile=XXXXXXXXXX
app.get('/api/customers/check-mobile', async (req, res) => {
    try {
        const mobile = normalizeMobile(req.query.mobile || '');
        if (mobile.length < 10) return res.json({ exists: false });
        const r = await db.query(
            'SELECT name, email FROM customers WHERE mobile_number = $1', [mobile]
        );
        if (!r.rows.length) return res.json({ exists: false });
        const { name, email } = r.rows[0];
        const masked = email ? email.replace(/^(.{2})(.*)(@.+)$/, (_, a, b, c) => a + '*'.repeat(Math.max(2, b.length)) + c) : null;
        res.json({ exists: true, name, email_masked: masked, has_email: !!email });
    } catch (err) {
        console.error('[check-mobile]', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/send-otp  — body: { mobile, email, name }
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        cleanOtps();
        const { mobile, email, name } = req.body;
        if (!mobile || !email) return res.status(400).json({ error: 'Mobile and email are required' });
        const norm = normalizeMobile(mobile);
        const otp  = String(Math.floor(100000 + Math.random() * 900000));
        const key  = `${norm}:${email.trim().toLowerCase()}`;
        otpStore.set(key, { otp, exp: Date.now() + 10 * 60 * 1000, name });

        await transporter.sendMail({
            from: `"KB Beauty Salons" <${process.env.SMTP_USER}>`,
            to: email.trim(),
            subject: 'Your OTP — KB Beauty Salons',
            html: `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:auto;background:#0e0a02;border:1px solid rgba(212,175,55,0.3);border-radius:16px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#2a1f00,#7a5c10,#d4af37);padding:24px 32px;">
                <h2 style="margin:0;color:#1a1000;font-size:1.4rem;letter-spacing:1px;">KB BEAUTY SALONS</h2>
                <p style="margin:4px 0 0;color:#3a2800;font-size:0.82rem;">Booking Verification</p>
              </div>
              <div style="padding:32px;">
                <p style="color:#e8d5a0;margin:0 0 8px;">Hi ${name || 'there'},</p>
                <p style="color:#9a7840;font-size:0.9rem;margin:0 0 24px;">Use this OTP to verify your email and complete your booking:</p>
                <div style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.25);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
                  <div style="font-size:2.2rem;font-weight:900;letter-spacing:12px;color:#fcf6ba;font-family:monospace;">${otp}</div>
                  <div style="color:#9a7840;font-size:0.75rem;margin-top:8px;">Valid for 10 minutes</div>
                </div>
                <p style="color:#6a5030;font-size:0.78rem;margin:0;">If you didn't request this, please ignore this email. Do not share this OTP with anyone.</p>
              </div>
              <div style="padding:16px 32px;border-top:1px solid rgba(212,175,55,0.1);text-align:center;">
                <p style="color:#6a5030;font-size:0.72rem;margin:0;">© KB Beauty Salons &amp; Tattoos · kbbeauty.shop</p>
              </div>
            </div>`
        });
        res.json({ success: true });
    } catch (err) {
        console.error('[send-otp]', err.message);
        res.status(500).json({ error: 'Failed to send OTP. Check your email address.' });
    }
});

// POST /api/auth/verify-otp  — body: { mobile, email, otp }
app.post('/api/auth/verify-otp', (req, res) => {
    cleanOtps();
    const { mobile, email, otp } = req.body;
    const norm = normalizeMobile(mobile || '');
    const key  = `${norm}:${(email || '').trim().toLowerCase()}`;
    const stored = otpStore.get(key);
    if (!stored)                          return res.json({ valid: false, reason: 'expired' });
    if (stored.exp < Date.now())          { otpStore.delete(key); return res.json({ valid: false, reason: 'expired' }); }
    if (stored.otp !== String(otp).trim()) return res.json({ valid: false, reason: 'wrong' });
    otpStore.delete(key);   // one-time use
    res.json({ valid: true });
});

// PayU callback routes (PayU POSTs to these)
app.post('/payment-success.html', async (req, res) => {
    const { txnid, amount, status } = req.body;
    const qs = new URLSearchParams({ txnid: txnid || '', amount: amount || '', status: status || '' }).toString();

    // Update advance_paid + send invoice email — txnid format: KB{appointmentId}_{timestamp}
    if (txnid && status !== 'failure') {
        try {
            const match = txnid.match(/^KB(\d+)_/);
            if (match) {
                const appointmentId = parseInt(match[1]);

                // ── Update advance_paid; auto-complete if fully paid ───────
                const paidAmount = parseFloat(amount || 0);
                if (paidAmount > 0) {
                    await db.query(
                        `UPDATE appointments
                            SET advance_paid       = COALESCE(advance_paid, 0) + $1,
                                payment_requested  = FALSE,
                                status = CASE
                                    WHEN (COALESCE(advance_paid, 0) + $1) >= (total_cost - COALESCE(discount_amount,0) - COALESCE(manual_discount_amount,0))
                                    THEN 'Completed'
                                    ELSE status
                                END
                          WHERE appointment_id = $2`,
                        [paidAmount, appointmentId]
                    );
                    console.log(`[Payment] Appointment #${appointmentId} advance_paid += ${paidAmount}`);
                }

                const apptRes = await db.query(
                    `SELECT a.appointment_id, a.appointment_date, a.appointment_time,
                            a.total_cost, a.advance_paid, a.status,
                            a.discount_amount, a.discount_code,
                            COALESCE(a.manual_discount_amount,0) AS manual_discount_amount, a.manual_discount_type,
                            c.name AS customer_name, c.email AS customer_email,
                            c.mobile_number AS customer_mobile,
                            (
                                SELECT COALESCE(
                                    JSON_ARRAYAGG(
                                        JSON_OBJECT(
                                            'service_name', s.name,
                                            'price', s.price,
                                            'quantity', aps.quantity
                                        )
                                    ),
                                    JSON_ARRAY()
                                )
                                FROM appointment_services aps
                                JOIN services s ON s.service_id = aps.service_id
                                WHERE aps.appointment_id = a.appointment_id
                            ) AS services
                       FROM appointments a
                       JOIN customers c ON c.customer_id = a.customer_id
                      WHERE a.appointment_id = $1`,
                    [appointmentId]
                );
                if (apptRes.rows.length && apptRes.rows[0].customer_email) {
                    const appt    = apptRes.rows[0];
                    const baseUrl = `${req.protocol}://${req.get('host')}`;
                    sendInvoiceEmail(appt.customer_email, {
                        appointmentId:   appt.appointment_id,
                        customerName:    appt.customer_name,
                        customerEmail:   appt.customer_email,
                        customerMobile:  appt.customer_mobile || '',
                        appointmentDate: appt.appointment_date instanceof Date
                            ? appt.appointment_date.toISOString().slice(0, 10)
                            : String(appt.appointment_date).slice(0, 10),
                        appointmentTime: appt.appointment_time,
                        services:        appt.services,
                        totalCost:       parseFloat(appt.total_cost || 0),
                        advancePaid:     parseFloat(appt.advance_paid || 0),
                        discountAmount:       parseFloat(appt.discount_amount        || 0),
                        discountCode:         appt.discount_code  || null,
                        manualDiscountAmount: parseFloat(appt.manual_discount_amount || 0),
                        manualDiscountType:   appt.manual_discount_type || null,
                        status:          appt.status || 'Confirmed',
                        txnid,
                        baseUrl,
                    }).catch(err => console.error('[Email] Invoice send failed:', err.message));
                }
            }
        } catch (err) {
            console.error('[Email] Failed to load booking for invoice:', err.message);
        }
    }

    res.redirect(`/payment-success.html?${qs}`);
});
app.post('/payment-failure.html', (req, res) => {
    const { txnid, error_Message } = req.body;
    const qs = new URLSearchParams({ txnid: txnid || '', msg: error_Message || '' }).toString();
    res.redirect(`/payment-failure.html?${qs}`);
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../public/admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
