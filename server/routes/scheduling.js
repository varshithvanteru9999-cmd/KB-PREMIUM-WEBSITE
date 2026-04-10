'use strict';

/**
 * Scheduling Routes
 * ─────────────────
 * Mounts all employee, resource, shift, skill, and enhanced
 * availability / booking endpoints onto the provided Express app.
 *
 * Usage in server.js:
 *   const mountSchedulingRoutes = require('./routes/scheduling');
 *   mountSchedulingRoutes(app, db, { authenticateToken, isAdmin, loadSettings });
 */

const {
    generateSlots,
    getAvailability,
    assignEmployeeAndResource,
    timeToMins,
    minsToTime,
    slotTimestamp,
} = require('../scheduling');

// ─────────────────────────────────────────────────────────────────────────────

module.exports = function mountSchedulingRoutes(app, db, { authenticateToken, isAdmin, loadSettings, hashPassword, normalizeMobile }) {

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Time Slots (no availability filtering — admin confirms booking)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/availability
     * Query: date (required, YYYY-MM-DD)
     *
     * Returns ALL valid time slots for the given date based on business hours.
     * No capacity/availability filtering — customer picks any slot and admin
     * confirms whether it works. Date must be today or up to max_advance_days ahead.
     */
    app.get('/api/availability', async (req, res) => {
        try {
            const { date } = req.query;

            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
            }

            const settings = await loadSettings();

            // Allow past dates only for admin (e.g. editing existing appointments)
            const isAdmin = req.query.admin === '1';
            if (!isAdmin) {
                const todayStr = new Date().toISOString().slice(0, 10);
                if (date < todayStr) {
                    return res.status(400).json({ error: 'date must be today or in the future' });
                }
            }

            const slots = generateSlots(settings, date);
            res.json({ slots, date });
        } catch (err) {
            console.error('[GET /api/availability]', err.message);
            res.status(500).json({ error: 'Failed to load slots' });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Create Booking
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * POST /api/bookings
     * Body: { customerInfo, appointmentDate, appointmentTime, services, totalCost, advancePaid }
     *
     * Flow:
     *  1. Validate inputs + working-hours grid check.
     *  2. BEGIN transaction + FOR UPDATE lock to prevent race-condition overbooking.
     *  3. Check capacity: existing Pending/Confirmed bookings vs total salon capacity.
     *  4. Upsert customer.
     *  5. Insert appointment with status = 'Pending'. No employee/resource assigned yet.
     *  6. Admin reviews and confirms (POST /api/admin/appointments/:id/confirm).
     */
    app.post('/api/bookings', async (req, res) => {
        const client = await db.connect();
        try {
            const { customerInfo, appointmentDate, appointmentTime, services, totalCost, promoCode } = req.body;
            // advance_paid is always 0 at booking time — customer pays after admin confirms

            // ── Normalize mobile number ───────────────────────────────────────
            if (customerInfo?.mobile_number && normalizeMobile) {
                customerInfo.mobile_number = normalizeMobile(customerInfo.mobile_number);
            }

            // ── Input validation ──────────────────────────────────────────────
            if (!customerInfo?.name || !customerInfo?.mobile_number) {
                return res.status(400).json({ success: false, error: 'invalid_input', message: 'Customer name and mobile are required.' });
            }
            if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
                return res.status(400).json({ success: false, error: 'invalid_input', message: 'Invalid appointment date.' });
            }
            if (!appointmentTime || !/^\d{2}:\d{2}/.test(appointmentTime)) {
                return res.status(400).json({ success: false, error: 'invalid_input', message: 'Invalid appointment time.' });
            }
            if (!Array.isArray(services) || services.length === 0) {
                return res.status(400).json({ success: false, error: 'invalid_input', message: 'At least one service is required.' });
            }

            const settings = await loadSettings();

            // ── Slot validation (relaxed for manual entry) ───────────────────
            const timeKey = appointmentTime.slice(0, 5);
            // We only require it to be a valid HH:MM string, which is checked by the regex above.
            // Strict grid alignment is no longer enforced to support manual entry.

            // ── Load service details ──────────────────────────────────────────
            const svcIds  = services.map(s => parseInt(s.service_id));
            const svcRows = await client.query(
                `SELECT service_id, price, resource_type
                   FROM services WHERE service_id IN ($1) AND is_enabled = TRUE`,
                [svcIds]
            );
            if (svcRows.rows.length !== svcIds.length) {
                return res.status(400).json({ success: false, error: 'invalid_service', message: 'One or more services are invalid or disabled.' });
            }
            const svcMap = Object.fromEntries(svcRows.rows.map(r => [r.service_id, r]));

            // Calculate base cost from services to verify totalCost and prevent tampering
            let baseCost = 0;
            for (const s of services) {
                const svc = svcMap[parseInt(s.service_id)];
                baseCost += parseFloat(svc.price) * (parseInt(s.quantity) || 1);
            }

            // Use slot interval as the per-service duration (duration_minutes removed from services table)
            const slotIntervalMins = parseInt(settings.slot_interval || settings.slot_duration) || 30;
            const totalDuration = svcRows.rows.length * slotIntervalMins;
            const slotStartMins = timeToMins(timeKey);
            const slotEndMins   = slotStartMins + totalDuration;
            const apptStart     = slotTimestamp(appointmentDate, slotStartMins);
            const apptEnd       = slotTimestamp(appointmentDate, slotEndMins);

            // ── BEGIN transaction ─────────────────────────────────────────────
            await client.query('BEGIN');

            // ── Promo Code Validation ─────────────────────────────────────────
            let discountAmount = 0;
            let discountType   = null;
            let finalPromoCode = null;

            if (promoCode && promoCode.trim()) {
                const pr = await client.query(
                    `SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1) AND is_active = TRUE`,
                    [promoCode.trim()]
                );
                if (pr.rows.length > 0) {
                    const p = pr.rows[0];
                    const now = new Date();
                    const isValid = (!p.valid_until || new Date(p.valid_until) >= now) &&
                                    (p.max_uses === null || p.used_count < p.max_uses) &&
                                    (baseCost >= parseFloat(p.min_order_amount || 0));

                    if (isValid) {
                        finalPromoCode = p.code.toUpperCase();
                        discountType   = p.discount_type;
                        if (p.discount_type === 'percent') {
                            discountAmount = Math.round(baseCost * parseFloat(p.discount_value) / 100);
                            if (p.max_discount_cap) discountAmount = Math.min(discountAmount, parseFloat(p.max_discount_cap));
                        } else {
                            discountAmount = parseFloat(p.discount_value);
                        }
                        discountAmount = Math.min(discountAmount, baseCost); // Never exceed base cost

                        // Increment used count
                        await client.query(
                            `UPDATE promo_codes SET used_count = used_count + 1 WHERE promo_id = $1`,
                            [p.promo_id]
                        );
                    }
                }
            }

            // ── Lock overlapping rows to prevent race-condition double-booking ─
            await client.query(
                `SELECT appointment_id FROM appointments
                  WHERE appointment_date = $1
                    AND status NOT IN ('Cancelled', 'No-Show')
                    FOR UPDATE`,
                [appointmentDate]
            );

            // ── Capacity check per service ────────────────────────────────────
            // For each service: count Pending+Confirmed bookings in this window.
            // Reject if any service is already at full capacity.
            for (const svcReq of services) {
                const svc          = svcMap[parseInt(svcReq.service_id)];
                const blockEnd     = slotStartMins + slotIntervalMins;
                const resourceType = svc.resource_type || 'general';

                // Total capacity for this service
                const empCnt = await client.query(
                    `SELECT COUNT(DISTINCT e.employee_id) AS cnt
                       FROM employees e
                       JOIN employee_skills sk ON sk.employee_id = e.employee_id
                                              AND sk.service_id  = $1
                      WHERE e.is_active = TRUE`,
                    [svc.service_id]
                );
                const resCnt = await client.query(
                    `SELECT COALESCE(SUM(total_count), 0) AS cnt
                       FROM resources WHERE type = $1 AND is_active = TRUE`,
                    [resourceType]
                );
                const empCapacity = parseInt(empCnt.rows[0].cnt) || 0;
                const resCapacity = parseInt(resCnt.rows[0].cnt) || 0;
                const capacity    = Math.min(empCapacity, resCapacity);

                // Only enforce capacity when employees AND resources are configured.
                // If neither is set up yet, admin confirms manually — allow all bookings.
                if (capacity > 0) {
                    const usedRes = await client.query(
                        `SELECT COUNT(*) AS cnt
                           FROM appointments a
                           JOIN appointment_services aps ON aps.appointment_id = a.appointment_id
                          WHERE a.appointment_date = $1
                            AND aps.service_id     = $2
                            AND a.status NOT IN ('Cancelled', 'No-Show')
                            AND (a.start_time < $3 AND a.end_time > $4)`,
                        [appointmentDate, svc.service_id,
                         slotTimestamp(appointmentDate, blockEnd), slotTimestamp(appointmentDate, slotStartMins)]
                    );
                    const used = parseInt(usedRes.rows[0].cnt) || 0;

                    if (used >= capacity) {
                        await client.query('ROLLBACK');
                        return res.status(409).json({
                            success: false,
                            error:   'slot_full',
                            message: 'This time slot is fully booked. Please choose another time.',
                        });
                    }
                }
            }

            // ── Upsert customer ───────────────────────────────────────────────
            let customerId;
            let isExistingCustomer = false;
            const custRes = await client.query(
                'SELECT customer_id, password_hash FROM customers WHERE mobile_number = $1',
                [customerInfo.mobile_number]
            );
            if (custRes.rows.length > 0) {
                const existing = custRes.rows[0];
                customerId = existing.customer_id;
                isExistingCustomer = true;
                // Update name/email; set password only if not already set
                if (!existing.password_hash && hashPassword) {
                    await client.query(
                        'UPDATE customers SET name = $1, email = COALESCE($2, email), password_hash = $3 WHERE customer_id = $4',
                        [customerInfo.name, customerInfo.email || null, hashPassword(customerInfo.mobile_number), customerId]
                    );
                } else {
                    await client.query(
                        'UPDATE customers SET name = $1, email = COALESCE($2, email) WHERE customer_id = $3',
                        [customerInfo.name, customerInfo.email || null, customerId]
                    );
                }
            } else {
                // New customer — set password = mobile number hash
                const pwdHash = hashPassword ? hashPassword(customerInfo.mobile_number) : null;
                const newCust = await client.query(
                    'INSERT INTO customers (name, email, mobile_number, password_hash) VALUES ($1, $2, $3, $4)',
                    [customerInfo.name, customerInfo.email || null, customerInfo.mobile_number, pwdHash]
                );
                customerId = newCust.insertId;
            }

            // ── Insert appointment as Pending (no employee/resource yet) ──────
            const apptRes = await client.query(
                `INSERT INTO appointments
                    (customer_id, appointment_date, appointment_time,
                     total_cost, advance_paid, status,
                     duration_minutes, start_time, end_time,
                     discount_code, discount_amount, discount_type)
                 VALUES ($1, $2, $3, $4, $5, 'Pending', $6, $7, $8, $9, $10, $11)`,
                [customerId, appointmentDate, timeKey,
                 baseCost, 0,
                 totalDuration, apptStart, apptEnd,
                 finalPromoCode, discountAmount, discountType]
            );
            const appointmentId = apptRes.insertId;

            for (const svcReq of services) {
                await client.query(
                    'INSERT INTO appointment_services (appointment_id, service_id, quantity) VALUES ($1, $2, $3)',
                    [appointmentId, parseInt(svcReq.service_id), parseInt(svcReq.quantity) || 1]
                );
            }

            // ── Audit log ─────────────────────────────────────────────────────
            await client.query(
                `INSERT INTO appointment_audit_log
                    (appointment_id, changed_by_role, new_status, new_start_time, notes)
                 VALUES ($1, 'customer', 'Pending', $2, $3)`,
                [appointmentId, apptStart, `Customer booking — awaiting admin confirmation. ${finalPromoCode ? `Promo applied: ${finalPromoCode} (₹${discountAmount})` : ''}`]
            );

            await client.query('COMMIT');
            res.json({ success: true, appointmentId, existing_customer: isExistingCustomer, discountApplied: discountAmount });
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            console.error('[POST /api/bookings]', err.message);
            res.status(500).json({ success: false, error: 'server_error', message: 'Booking failed. Please try again.' });
        } finally {
            client.release();
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN — Employee Management
    // ═══════════════════════════════════════════════════════════════════════════

    /** GET /api/admin/employees — list all employees with their skill+shift counts */
    app.get('/api/admin/employees', authenticateToken, isAdmin, async (req, res) => {
        try {
            const result = await db.query(`
                SELECT e.*,
                       COUNT(DISTINCT sk.service_id)  AS skill_count,
                       COUNT(DISTINCT sh.shift_id)    AS shift_count
                  FROM employees e
                  LEFT JOIN employee_skills sk ON sk.employee_id = e.employee_id
                  LEFT JOIN employee_shifts sh ON sh.employee_id = e.employee_id AND sh.is_active = TRUE
                 GROUP BY e.employee_id
                 ORDER BY e.name
            `);
            res.json(result.rows);
        } catch (err) {
            console.error('[GET /api/admin/employees]', err.message);
            res.status(500).json([]);
        }
    });

    /** POST /api/admin/employees — create employee */
    app.post('/api/admin/employees', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { name, mobile, email } = req.body;
            if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

            const result = await db.query(
                'INSERT INTO employees (name, mobile, email) VALUES ($1, $2, $3)',
                [name.trim(), mobile || null, email || null]
            );
            const empRes = await db.query('SELECT * FROM employees WHERE employee_id = ?', [result.insertId]);
            res.status(201).json(empRes.rows[0]);
        } catch (err) {
            console.error('[POST /api/admin/employees]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    /** PATCH /api/admin/employees/:id — update name/mobile/email/is_active */
    app.patch('/api/admin/employees/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, mobile, email, is_active } = req.body;
            await db.query(
                `UPDATE employees
                    SET name      = COALESCE($1, name),
                        mobile    = COALESCE($2, mobile),
                        email     = COALESCE($3, email),
                        is_active = COALESCE($4, is_active)
                  WHERE employee_id = $5`,
                [name || null, mobile || null, email || null,
                 is_active !== undefined ? is_active : null, id]
            );
            res.json({ success: true });
        } catch (err) {
            console.error('[PATCH /api/admin/employees/:id]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN — Employee Skills
    // ═══════════════════════════════════════════════════════════════════════════

    /** GET /api/admin/employees/:id/skills */
    app.get('/api/admin/employees/:id/skills', authenticateToken, isAdmin, async (req, res) => {
        try {
            const result = await db.query(
                `SELECT sk.service_id, s.name AS service_name, c.name AS category_name
                   FROM employee_skills sk
                   JOIN services    s ON s.service_id   = sk.service_id
                   JOIN categories  c ON c.category_id  = s.category_id
                  WHERE sk.employee_id = $1
                  ORDER BY c.name, s.name`,
                [req.params.id]
            );
            res.json(result.rows);
        } catch (err) {
            console.error('[GET /api/admin/employees/:id/skills]', err.message);
            res.status(500).json([]);
        }
    });

    /**
     * PUT /api/admin/employees/:id/skills
     * Body: { service_ids: [1, 2, 3] }
     * Replaces the employee's entire skill set.
     */
    app.put('/api/admin/employees/:id/skills', authenticateToken, isAdmin, async (req, res) => {
        const client = await db.connect();
        try {
            const empId      = parseInt(req.params.id);
            const serviceIds = (req.body.service_ids || []).map(Number).filter(Boolean);

            await client.query('BEGIN');
            await client.query('DELETE FROM employee_skills WHERE employee_id = $1', [empId]);

            for (const svcId of serviceIds) {
                await client.query(
                    'INSERT IGNORE INTO employee_skills (employee_id, service_id) VALUES ($1, $2)',
                    [empId, svcId]
                );
            }
            await client.query('COMMIT');
            res.json({ success: true, assigned: serviceIds.length });
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            console.error('[PUT /api/admin/employees/:id/skills]', err.message);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN — Employee Shifts
    // ═══════════════════════════════════════════════════════════════════════════

    /** GET /api/admin/employees/:id/shifts */
    app.get('/api/admin/employees/:id/shifts', authenticateToken, isAdmin, async (req, res) => {
        try {
            const result = await db.query(
                `SELECT * FROM employee_shifts
                  WHERE employee_id = $1
                  ORDER BY day_of_week, start_time`,
                [req.params.id]
            );
            res.json(result.rows);
        } catch (err) {
            console.error('[GET /api/admin/employees/:id/shifts]', err.message);
            res.status(500).json([]);
        }
    });

    /**
     * POST /api/admin/employees/:id/shifts
     * Body: { day_of_week: 1, start_time: "09:00", end_time: "17:00" }
     */
    app.post('/api/admin/employees/:id/shifts', authenticateToken, isAdmin, async (req, res) => {
        try {
            const empId = parseInt(req.params.id);
            const { day_of_week, start_time, end_time } = req.body;

            if (day_of_week === undefined || !start_time || !end_time) {
                return res.status(400).json({ error: 'day_of_week, start_time, and end_time are required' });
            }
            if (parseInt(day_of_week) < 0 || parseInt(day_of_week) > 6) {
                return res.status(400).json({ error: 'day_of_week must be 0–6' });
            }

            const result = await db.query(
                `INSERT INTO employee_shifts (employee_id, day_of_week, start_time, end_time)
                 VALUES ($1, $2, $3, $4)`,
                [empId, parseInt(day_of_week), start_time, end_time]
            );
            const shiftRes = await db.query('SELECT * FROM employee_shifts WHERE shift_id = ?', [result.insertId]);
            res.status(201).json(shiftRes.rows[0]);
        } catch (err) {
            console.error('[POST /api/admin/employees/:id/shifts]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    /** DELETE /api/admin/employees/:id/shifts/:shiftId */
    app.delete('/api/admin/employees/:id/shifts/:shiftId', authenticateToken, isAdmin, async (req, res) => {
        try {
            await db.query(
                'DELETE FROM employee_shifts WHERE shift_id = $1 AND employee_id = $2',
                [req.params.shiftId, req.params.id]
            );
            res.json({ success: true });
        } catch (err) {
            console.error('[DELETE /api/admin/employees/:id/shifts/:shiftId]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN — Resource Management
    // ═══════════════════════════════════════════════════════════════════════════

    /** GET /api/admin/resources */
    app.get('/api/admin/resources', authenticateToken, isAdmin, async (req, res) => {
        try {
            const result = await db.query('SELECT * FROM resources ORDER BY type, name');
            res.json(result.rows);
        } catch (err) {
            console.error('[GET /api/admin/resources]', err.message);
            res.status(500).json([]);
        }
    });

    /** POST /api/admin/resources — create resource */
    app.post('/api/admin/resources', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { name, type, total_count } = req.body;
            if (!name?.trim() || !type?.trim()) {
                return res.status(400).json({ error: 'name and type are required' });
            }
            const result = await db.query(
                'INSERT INTO resources (name, type, total_count) VALUES ($1, $2, $3)',
                [name.trim(), type.trim(), parseInt(total_count) || 1]
            );
            const resRes = await db.query('SELECT * FROM resources WHERE resource_id = ?', [result.insertId]);
            res.status(201).json(resRes.rows[0]);
        } catch (err) {
            console.error('[POST /api/admin/resources]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    /** PATCH /api/admin/resources/:id */
    app.patch('/api/admin/resources/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { name, type, total_count, is_active } = req.body;
            await db.query(
                `UPDATE resources
                    SET name        = COALESCE($1, name),
                        type        = COALESCE($2, type),
                        total_count = COALESCE($3, total_count),
                        is_active   = COALESCE($4, is_active)
                  WHERE resource_id = $5`,
                [name || null, type || null,
                 total_count !== undefined ? parseInt(total_count) : null,
                 is_active   !== undefined ? is_active : null,
                 req.params.id]
            );
            res.json({ success: true });
        } catch (err) {
            console.error('[PATCH /api/admin/resources/:id]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Customer: check appointment status
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/appointments/my?mobile_number=xxxxxxxxxx
     *
     * Returns all appointments for the given mobile number, newest first.
     * Each appointment includes:
     *   - status  (Pending / Confirmed / Completed / Cancelled / No-Show)
     *   - services booked
     *   - total_cost, advance_paid
     *   - required_advance  — amount the customer must pay after confirmation
     *     (calculated live from settings: fixed amount OR % of total_cost)
     *   - employee_name / resource_name  — populated only after admin confirms
     */
    app.get('/api/appointments/my', async (req, res) => {
        try {
            const { mobile_number } = req.query;
            if (!mobile_number) {
                return res.status(400).json({ error: 'mobile_number is required' });
            }

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
                     c.name   AS customer_name,
                     c.email  AS customer_email,
                     c.mobile_number AS customer_mobile,
                     e.name   AS employee_name,
                     r.name   AS resource_name,
                     COALESCE(
                         (
                            SELECT JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    'service_id',   s.service_id,
                                    'service_name', s.name,
                                    'price',        s.price,
                                    'quantity',     aps.quantity
                                )
                            )
                            FROM appointment_services aps
                            JOIN services s ON s.service_id = aps.service_id
                            WHERE aps.appointment_id = a.appointment_id
                         ),
                         JSON_ARRAY()
                     ) AS services
                 FROM appointments  a
                 JOIN customers     c   ON c.customer_id  = a.customer_id
                 LEFT JOIN employees    e   ON e.employee_id  = a.employee_id
                 LEFT JOIN resources    r   ON r.resource_id  = a.resource_id
                WHERE c.mobile_number = $1
                GROUP BY a.appointment_id, c.name, c.email, c.mobile_number, e.name, r.name
                ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
                [mobile_number]
            );

            const appointments = result.rows.map(appt => {
                const total = parseFloat(appt.total_cost) || 0;
                const required_advance = advType === 'percent'
                    ? parseFloat((total * advValue / 100).toFixed(2))
                    : advValue;
                const balance_advance = Math.max(0, required_advance - parseFloat(appt.advance_paid || 0));

                return {
                    ...appt,
                    required_advance,
                    balance_advance,
                    // Only show payment prompt when Confirmed and advance not yet fully paid
                    show_payment_prompt: appt.status === 'Confirmed' && balance_advance > 0,
                };
            });

            res.json(appointments);
        } catch (err) {
            console.error('[GET /api/appointments/my]', err.message);
            res.status(500).json({ error: 'Failed to load appointments' });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Edit services on an existing appointment
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * PUT /api/appointments/:id/services
     * Replaces the service list on a Pending appointment.
     * Allowed by both customer (no auth) and admin (any status except Cancelled).
     *
     * Body: { services: [{ service_id, quantity }], mobile_number? }
     *   - mobile_number: required for customer to prove ownership.
     *   - Omit mobile_number when called by admin (Authorization header present).
     *
     * Recalculates total_cost, duration_minutes, start_time, end_time.
     */
    app.put('/api/appointments/:id/services', async (req, res) => {
        const client = await db.connect();
        try {
            const { id }                       = req.params;
            const { services: newServices, mobile_number } = req.body;

            if (!Array.isArray(newServices) || newServices.length === 0) {
                return res.status(400).json({ error: 'At least one service is required.' });
            }

            // Determine caller: admin (token present) or customer (mobile required)
            const authHeader = req.headers['authorization'];
            const isAdminCall = !!(authHeader && authHeader.startsWith('Bearer '));

            await client.query('BEGIN');

            // Load appointment
            const apptRes = await client.query(
                `SELECT a.*, c.mobile_number AS customer_mobile
                   FROM appointments a
                   JOIN customers c ON c.customer_id = a.customer_id
                  WHERE a.appointment_id = $1 FOR UPDATE`,
                [id]
            );
            if (!apptRes.rows.length) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Appointment not found.' });
            }
            const appt = apptRes.rows[0];

            if (appt.status === 'Cancelled') {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Cannot edit a cancelled appointment.' });
            }

            // Customer ownership check
            if (!isAdminCall) {
                if (!mobile_number) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'mobile_number is required.' });
                }
                if (appt.customer_mobile !== mobile_number) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({ error: 'Mobile number does not match this appointment.' });
                }
                // Customers can only edit while Pending
                if (appt.status !== 'Pending') {
                    await client.query('ROLLBACK');
                    return res.status(409).json({ error: 'Only Pending appointments can be edited by the customer.' });
                }
            }

            // Load new service details
            const svcIds  = newServices.map(s => parseInt(s.service_id));
            const svcRows = await client.query(
                `SELECT service_id, price
                   FROM services WHERE service_id = ANY($1) AND is_enabled = TRUE`,
                [svcIds]
            );
            if (svcRows.rows.length !== svcIds.length) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'One or more services are invalid or disabled.' });
            }
            const svcMap = Object.fromEntries(svcRows.rows.map(r => [r.service_id, r]));

            // Recalculate totals (slot interval used as duration since duration_minutes removed from services)
            const settings2   = await loadSettings();
            const slotMins2   = parseInt(settings2.slot_interval || settings2.slot_duration) || 30;
            const newDuration = svcRows.rows.length * slotMins2;
            const newCost = newServices.reduce((sum, s) => {
                const svc = svcMap[parseInt(s.service_id)];
                return sum + parseFloat(svc.price) * (parseInt(s.quantity) || 1);
            }, 0);

            // ── Recalculate discount against the new total ──────────────────────
            const oldDiscount  = parseFloat(appt.discount_amount) || 0;
            const oldTotal     = parseFloat(appt.total_cost)      || 0;
            const discountCode = appt.discount_code  || null;
            const discountType = appt.discount_type  || null;
            let   newDiscount  = 0;

            if (discountCode) {
                // Promo code — re-query the live promo rules and recompute
                const promoRes = await client.query(
                    `SELECT discount_type, discount_value, max_discount_cap
                       FROM promo_codes WHERE code = $1 AND is_active = TRUE`,
                    [discountCode]
                );
                if (promoRes.rows.length) {
                    const p = promoRes.rows[0];
                    if (p.discount_type === 'percent') {
                        const raw = newCost * parseFloat(p.discount_value) / 100;
                        newDiscount = p.max_discount_cap
                            ? Math.min(raw, parseFloat(p.max_discount_cap))
                            : raw;
                    } else {
                        // fixed
                        newDiscount = Math.min(parseFloat(p.discount_value), newCost);
                    }
                }
                // If promo no longer active, discount falls to 0 (fair behaviour)
            } else if (oldDiscount > 0 && oldTotal > 0) {
                // Manual discount — preserve the same proportional rate or fixed amount
                if (discountType === 'percent') {
                    const rate  = oldDiscount / oldTotal; // e.g. 0.10 for 10%
                    newDiscount = Math.min(newCost * rate, newCost);
                } else {
                    // fixed manual discount — keep same amount, cap at new total
                    newDiscount = Math.min(oldDiscount, newCost);
                }
            }
            newDiscount = Math.round(newDiscount * 100) / 100; // 2dp

            // Determine the resulting status:
            // Admin edits on an already-Confirmed appointment must NOT reset to Pending.
            // For customer edits, status stays as-is (they can only edit Pending anyway).
            const newStatus = appt.status; // never change status here

            const apptDateStr = String(appt.appointment_date).slice(0, 10); // always 'YYYY-MM-DD' now that DATE is a plain string
            const startMins = timeToMins(appt.appointment_time);
            const newStart  = slotTimestamp(apptDateStr, startMins);
            const newEnd    = slotTimestamp(apptDateStr, startMins + newDuration);

            // Replace services
            await client.query('DELETE FROM appointment_services WHERE appointment_id = $1', [id]);
            for (const s of newServices) {
                await client.query(
                    'INSERT INTO appointment_services (appointment_id, service_id, quantity) VALUES ($1, $2, $3)',
                    [id, parseInt(s.service_id), parseInt(s.quantity) || 1]
                );
            }

            // Update appointment totals + timestamps (status intentionally unchanged)
            await client.query(
                `UPDATE appointments
                    SET duration_minutes = $1,
                        total_cost       = $2,
                        start_time       = $3,
                        end_time         = $4,
                        discount_amount  = $5
                  WHERE appointment_id   = $6`,
                [newDuration, newCost, newStart, newEnd, newDiscount, id]
            );

            await client.query(
                `INSERT INTO appointment_audit_log
                    (appointment_id, changed_by_role, old_status, new_status, notes)
                 VALUES ($1, $2, $3, $4, $5)`,
                [id,
                 isAdminCall ? 'admin' : 'customer',
                 appt.status,
                 newStatus,
                 `Services updated — ${svcIds.join(', ')}; total: ₹${newCost}, discount: ₹${newDiscount}`]
            );

            await client.query('COMMIT');
            res.json({ success: true, newTotal: newCost, newDiscount, newDuration });
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            console.error('[PUT /api/appointments/:id/services]', err.message);
            res.status(500).json({ error: 'Failed to update services.' });
        } finally {
            client.release();
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN — Appointment Management (enhanced)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/admin/appointments
     * Query: status, date, employee_id, service_id (all optional filters)
     * Returns appointments joined with customer, employee, resource, and services.
     */
    app.get('/api/admin/appointments', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { status, date, employee_id, service_id } = req.query;
            const conditions = [];
            const params     = [];
            let   p          = 1;

            if (status)      { conditions.push(`a.status = $${p++}`);             params.push(status); }
            if (date)        { conditions.push(`a.appointment_date = $${p++}`);   params.push(date); }
            if (employee_id) { conditions.push(`a.employee_id = $${p++}`);        params.push(parseInt(employee_id)); }
            if (service_id)  {
                conditions.push(`EXISTS (
                    SELECT 1 FROM appointment_services aps
                     WHERE aps.appointment_id = a.appointment_id AND aps.service_id = $${p++}
                )`);
                params.push(parseInt(service_id));
            }

            const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

            const result = await db.query(`
                SELECT a.*,
                       c.name          AS customer_name,
                       c.mobile_number AS customer_mobile,
                       e.name          AS employee_name,
                       r.name          AS resource_name,
                       r.type          AS resource_type,
                       COALESCE(
                           (
                                SELECT JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                        'service_id',   s.service_id,
                                        'service_name', s.name,
                                        'quantity',     aps.quantity,
                                        'price',        s.price
                                    )
                                )
                                FROM appointment_services aps
                                JOIN services s ON s.service_id = aps.service_id
                                WHERE aps.appointment_id = a.appointment_id
                           ),
                           JSON_ARRAY()
                       ) AS services
                  FROM appointments  a
                  JOIN customers     c   ON c.customer_id  = a.customer_id
                  LEFT JOIN employees    e   ON e.employee_id  = a.employee_id
                  LEFT JOIN resources    r   ON r.resource_id  = a.resource_id
                 ${where}
                 GROUP BY a.appointment_id, c.name, c.mobile_number,
                          e.name, r.name, r.type
                 ORDER BY a.appointment_date DESC, a.appointment_time DESC
            `, params);
            res.json(result.rows);
        } catch (err) {
            console.error('[GET /api/admin/appointments]', err.message);
            res.status(500).json([]);
        }
    });

    /**
     * PATCH /api/admin/appointments/:id
     * Supports: status update, reschedule (date + time), reassign employee/resource.
     * All changes are logged to appointment_audit_log.
     */

    app.delete('/api/admin/appointments/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            await db.query('DELETE FROM appointment_audit_log WHERE appointment_id = $1', [id]);
            await db.query('DELETE FROM appointment_services   WHERE appointment_id = $1', [id]);
            await db.query('DELETE FROM appointments           WHERE appointment_id = $1', [id]);
            res.json({ success: true });
        } catch (err) {
            console.error('[DELETE /api/admin/appointments/:id]', err.message);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.patch('/api/admin/appointments/:id', authenticateToken, isAdmin, async (req, res) => {
        const client = await db.connect();
        try {
            const { id } = req.params;
            const { status, appointment_date, appointment_time, employee_id, resource_id, notes } = req.body;

            await client.query('BEGIN');

            // Load current state for audit
            const current = await client.query(
                'SELECT * FROM appointments WHERE appointment_id = $1 FOR UPDATE',
                [id]
            );
            if (!current.rows.length) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Appointment not found' });
            }
            const appt = current.rows[0];

            // Build update
            const updates = [];
            const vals    = [];
            let   p       = 1;

            if (status)           { updates.push(`status = $${p++}`);              vals.push(status); }
            if (appointment_date) { updates.push(`appointment_date = $${p++}`);    vals.push(appointment_date); }
            let newStartTimestamp = null;
            if (appointment_time) {
                updates.push(`appointment_time = $${p++}`);
                vals.push(appointment_time);
                // Recalculate start_time / end_time on reschedule
                const durationMins = parseInt(appt.duration_minutes) || 30;
                const startMins    = timeToMins(appointment_time);
                const endMins      = startMins + durationMins;
                const dateForTs    = appointment_date || String(appt.appointment_date).slice(0, 10);
                newStartTimestamp  = slotTimestamp(dateForTs, startMins);
                updates.push(`start_time = $${p++}`, `end_time = $${p++}`);
                vals.push(newStartTimestamp, slotTimestamp(dateForTs, endMins));
            }
            if (employee_id !== undefined) { updates.push(`employee_id = $${p++}`); vals.push(employee_id); }
            if (resource_id !== undefined) { updates.push(`resource_id = $${p++}`); vals.push(resource_id); }

            if (updates.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Nothing to update' });
            }

            vals.push(id);
            await client.query(
                `UPDATE appointments SET ${updates.join(', ')} WHERE appointment_id = $${p}`,
                vals
            );

            // Audit log
            await client.query(
                `INSERT INTO appointment_audit_log
                    (appointment_id, changed_by_role, changed_by_id,
                     old_status, new_status,
                     old_start_time, new_start_time,
                     old_employee_id, new_employee_id,
                     old_resource_id, new_resource_id,
                     notes)
                 VALUES ($1, 'admin', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    id,
                    req.user.id,
                    appt.status,                    status          || appt.status,
                    appt.start_time,                newStartTimestamp ?? appt.start_time,
                    appt.employee_id,               employee_id     !== undefined ? employee_id : appt.employee_id,
                    appt.resource_id,               resource_id     !== undefined ? resource_id : appt.resource_id,
                    notes || null,
                ]
            );

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            console.error('[PATCH /api/admin/appointments/:id]', err.message);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    /**
     * POST /api/admin/appointments/:id/confirm
     * Admin confirms a Pending appointment: assigns employee + resource,
     * sets status → 'Confirmed', calculates and stamps required_advance, logs the change.
     * Body: { employee_id, resource_id, notes? }
     *
     * After this, GET /api/appointments/my returns show_payment_prompt: true
     * so the customer knows to pay the advance.
     */
    app.post('/api/admin/appointments/:id/confirm', authenticateToken, isAdmin, async (req, res) => {
        const client = await db.connect();
        try {
            const { id } = req.params;
            const { employee_id, resource_id, notes } = req.body;

            if (!employee_id || !resource_id) {
                return res.status(400).json({ error: 'employee_id and resource_id are required to confirm.' });
            }

            await client.query('BEGIN');

            const current = await client.query(
                `SELECT * FROM appointments WHERE appointment_id = $1 FOR UPDATE`, [id]
            );
            if (!current.rows.length) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Appointment not found' });
            }
            const appt = current.rows[0];
            if (appt.status === 'Confirmed') {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Appointment is already confirmed.' });
            }
            if (appt.status === 'Cancelled') {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Cannot confirm a cancelled appointment.' });
            }

            await client.query(
                `UPDATE appointments
                    SET status      = 'Confirmed',
                        employee_id = $1,
                        resource_id = $2
                  WHERE appointment_id = $3`,
                [employee_id, resource_id, id]
            );

            await client.query(
                `INSERT INTO appointment_audit_log
                    (appointment_id, changed_by_role, changed_by_id,
                     old_status, new_status,
                     new_employee_id, new_resource_id, notes)
                 VALUES ($1, 'admin', $2, $3, 'Confirmed', $4, $5, $6)`,
                [id, req.user.id, appt.status, employee_id, resource_id,
                 notes || 'Admin confirmed and assigned staff + resource']
            );

            // Calculate required advance so the response can inform the frontend
            const settings    = await loadSettings();
            const advType     = settings.advance_type  || 'fixed';
            const advValue    = parseFloat(settings.advance_value || '0');
            const totalCost   = parseFloat(appt.total_cost) || 0;
            const reqAdvance  = advType === 'percent'
                ? parseFloat((totalCost * advValue / 100).toFixed(2))
                : advValue;

            await client.query('COMMIT');
            res.json({ success: true, required_advance: reqAdvance, total_cost: totalCost });
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            console.error('[POST /api/admin/appointments/:id/confirm]', err.message);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    /**
     * GET /api/admin/appointments/:id/audit
     * Full change history for one appointment.
     */
    app.get('/api/admin/appointments/:id/audit', authenticateToken, isAdmin, async (req, res) => {
        try {
            const result = await db.query(
                `SELECT l.*,
                        e.name AS employee_name
                   FROM appointment_audit_log l
                   LEFT JOIN employees e ON e.employee_id = l.new_employee_id
                  WHERE l.appointment_id = $1
                  ORDER BY l.changed_at ASC`,
                [req.params.id]
            );
            res.json(result.rows);
        } catch (err) {
            console.error('[GET /api/admin/appointments/:id/audit]', err.message);
            res.status(500).json([]);
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN — Enhanced Settings (add new scheduling keys)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * PUT /api/admin/settings/scheduling
     * Upserts the new scheduling-specific settings keys:
     *   slot_interval, max_advance_days, walkin_reserve_pct, timezone
     */
    app.put('/api/admin/settings/scheduling', authenticateToken, isAdmin, async (req, res) => {
        try {
            const allowed = ['slot_interval', 'max_advance_days', 'walkin_reserve_pct', 'timezone'];
            const upsert  = (k, v) => db.query(
                "INSERT INTO settings (`key`, `value`) VALUES ($1, $2) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
                [k, String(v)]
            );

            for (const key of allowed) {
                if (req.body[key] !== undefined) {
                    await upsert(key, req.body[key]);
                }
            }
            res.json({ success: true });
        } catch (err) {
            console.error('[PUT /api/admin/settings/scheduling]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN — Service Scheduling Attributes
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * PUT /api/admin/services/:id/scheduling
     * Update resource_type and buffer_minutes for a service.
     */
    app.put('/api/admin/services/:id/scheduling', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { resource_type, buffer_minutes } = req.body;
            await db.query(
                `UPDATE services
                    SET resource_type  = COALESCE($1, resource_type),
                        buffer_minutes = COALESCE($2, buffer_minutes)
                  WHERE service_id = $3`,
                [
                    resource_type  || null,
                    buffer_minutes !== undefined ? parseInt(buffer_minutes) : null,
                    req.params.id,
                ]
            );
            res.json({ success: true });
        } catch (err) {
            console.error('[PUT /api/admin/services/:id/scheduling]', err.message);
            res.status(500).json({ error: err.message });
        }
    });
};
