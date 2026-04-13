'use strict';

/**
 * Salon Scheduling Engine
 * ───────────────────────
 * Single-responsibility module for all slot-generation and availability logic.
 *
 * Design principles enforced here:
 *  - Slots are ALWAYS generated dynamically — never stored.
 *  - Every booking reserves BOTH a staff member AND a physical resource.
 *  - Overlap detection uses the standard half-open interval rule:
 *      [a_start, a_end) overlaps [b_start, b_end)  iff  a_start < b_end AND b_start < a_end
 *  - assignEmployeeAndResource() must be called inside an open DB transaction
 *    so that the FOR UPDATE row-lock prevents race-condition double-bookings.
 */

// ─── Time Utilities ───────────────────────────────────────────────────────────

/** "HH:MM" (or pg TIME string "HH:MM:SS") → integer minutes since midnight */
function timeToMins(t) {
    const s = String(t).slice(0, 5);
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
}

/** Integer minutes since midnight → "HH:MM" */
function minsToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Build a full ISO-8601 timestamp string from a date string and minutes offset.
 * e.g. slotTimestamp("2025-07-01", 570) → "2025-07-01T09:30:00"
 */
function slotTimestamp(dateStr, mins) {
    return `${dateStr}T${minsToTime(mins)}:00`;
}

// ─── Overlap Detection ────────────────────────────────────────────────────────

/**
 * Returns true when two half-open time intervals overlap.
 * Half-open means the end minute is NOT included, so back-to-back slots
 * (e.g. 09:00–09:30 and 09:30–10:00) do NOT conflict.
 */
function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}

// ─── Slot Generation ──────────────────────────────────────────────────────────

/**
 * Generate all candidate slot start-times for a given date.
 *
 * Uses `slot_interval` (falls back to `slot_duration`) from settings.
 * Returns an empty array when the date falls on a non-working day.
 *
 * @param {object} settings  - Plain key→value object from the settings table.
 * @param {string} dateStr   - "YYYY-MM-DD"
 * @returns {string[]}         Array of "HH:MM" strings.
 */
function generateSlots(settings, dateStr) {
    const dayOfWeek   = new Date(dateStr + 'T00:00:00').getDay(); // 0 = Sunday
    const workingDays = (settings.working_days || '0,1,2,3,4,5,6').split(',').map(Number);
    if (!workingDays.includes(dayOfWeek)) return [];

    const [sh, sm] = (settings.working_start || '09:00').split(':').map(Number);
    const [eh, em] = (settings.working_end   || '21:00').split(':').map(Number);

    // slot_interval is the booking grid step; slot_duration is the legacy alias
    const interval = parseInt(settings.slot_interval || settings.slot_duration || '30');

    const slots = [];
    let cur       = sh * 60 + sm;
    const endMins = eh * 60 + em;

    while (cur <= endMins) {
        slots.push(minsToTime(cur));
        cur += interval;
    }
    return slots;
}

// ─── Availability Query ───────────────────────────────────────────────────────

/**
 * Return available and booked slots for a service on a given date.
 *
 * Algorithm (admin-confirm flow):
 *  Appointments are created as Pending (no employee/resource assigned).
 *  Admin manually confirms and assigns staff + resource.
 *
 *  Availability = how many Pending/Confirmed bookings already exist for this
 *  service in the overlapping window vs the total salon capacity for that service.
 *
 *  total_capacity = min(
 *      count of active employees who have the skill,
 *      count of active resources of the required type
 *  )
 *
 *  Slot is available when:  existing_bookings_in_window < total_capacity
 *
 * Walk-in reserve: if walkin_reserve_pct > 0, that % of capacity is held back.
 *
 * @param {object} db         pg Pool / Client
 * @param {number} serviceId
 * @param {string} dateStr    "YYYY-MM-DD"
 * @param {object} settings   Plain key→value from settings table
 * @returns {Promise<{available: string[], booked: string[], duration: number, buffer: number, capacity: number}>}
 */
async function getAvailability(db, serviceId, dateStr, settings) {
    // ── Load service ──────────────────────────────────────────────────────────
    const svcRes = await db.query(
        `SELECT service_id, duration_minutes, buffer_minutes, resource_type
           FROM services
          WHERE service_id = $1 AND is_enabled = TRUE`,
        [serviceId]
    );
    if (!svcRes.rows.length) throw Object.assign(new Error('Service not found'), { code: 'SERVICE_NOT_FOUND' });

    const svc          = svcRes.rows[0];
    const duration     = parseInt(svc.duration_minutes) || 30;
    const buffer       = parseInt(svc.buffer_minutes)   || 0;
    const totalBlock   = duration + buffer;
    const resourceType = svc.resource_type || 'general';

    // ── Total salon capacity for this service ─────────────────────────────────
    const empCountRes = await db.query(
        `SELECT COUNT(DISTINCT e.employee_id) AS cnt
           FROM employees e
           JOIN employee_skills sk ON sk.employee_id = e.employee_id
                                  AND sk.service_id  = $1
          WHERE e.is_active = TRUE`,
        [serviceId]
    );
    const employeeCount = parseInt(empCountRes.rows[0].cnt) || 0;

    const resCountRes = await db.query(
        `SELECT COALESCE(SUM(total_count), 0) AS cnt
           FROM resources
          WHERE type = $1 AND is_active = TRUE`,
        [resourceType]
    );
    const resourceCount = parseInt(resCountRes.rows[0].cnt) || 0;

    // Walk-in reserve
    const walkinPct   = parseFloat(settings.walkin_reserve_pct || '0') / 100;
    const rawCapacity = Math.min(employeeCount, resourceCount);
    const reserved    = walkinPct > 0 ? Math.floor(rawCapacity * walkinPct) : 0;
    const capacity    = Math.max(0, rawCapacity - reserved);

    // ── Business hours ────────────────────────────────────────────────────────
    const [eh, em]       = (settings.working_end || '21:00').split(':').map(Number);
    const workingEndMins = eh * 60 + em;

    // ── Generate candidate grid ───────────────────────────────────────────────
    const candidateSlots = generateSlots(settings, dateStr);
    if (candidateSlots.length === 0) return { available: [], booked: [], duration, buffer, capacity };

    // ── All existing bookings for this service on this date ───────────────────
    // Includes both Pending (awaiting admin confirmation) and Confirmed.
    const existingRes = await db.query(
        `SELECT a.appointment_time,
                TIME_TO_SEC(a.start_time) / 60 AS start_mins,
                TIME_TO_SEC(a.end_time) / 60 AS end_mins
           FROM appointments a
           JOIN appointment_services aps ON aps.appointment_id = a.appointment_id
          WHERE a.appointment_date = $1
            AND aps.service_id     = $2
            AND a.status NOT IN ('Cancelled', 'No-Show')`,
        [dateStr, serviceId]
    );
    const existing = existingRes.rows.map(r => ({
        start: r.start_mins !== null
            ? parseFloat(r.start_mins)
            : timeToMins(r.appointment_time),
        end: r.end_mins !== null
            ? parseFloat(r.end_mins)
            : timeToMins(r.appointment_time) + totalBlock,
    }));

    // ── Evaluate each candidate slot ──────────────────────────────────────────
    const available = [];
    const booked    = [];

    for (const slot of candidateSlots) {
        const slotStart = timeToMins(slot);
        const slotEnd   = slotStart + totalBlock;

        if (slotEnd > workingEndMins) { booked.push(slot); continue; }

        const usedCount = existing.filter(e => overlaps(slotStart, slotEnd, e.start, e.end)).length;

        if (usedCount < capacity) {
            available.push(slot);
        } else {
            booked.push(slot);
        }
    }

    return { available, booked, duration, buffer, totalBlock, capacity };
}

// ─── Auto-Assign Employee & Resource ─────────────────────────────────────────

/**
 * Within an OPEN database transaction, find the first free employee and
 * resource for the requested slot and return their IDs.
 *
 * Uses FOR UPDATE on overlapping appointments to acquire row-level locks,
 * preventing concurrent requests from double-booking the same slot.
 *
 * Throws with code 'NO_EMPLOYEE_AVAILABLE' or 'NO_RESOURCE_AVAILABLE' if
 * the slot is no longer free by the time we reach this point.
 *
 * @param {object} client      pg Client (already inside BEGIN)
 * @param {number} serviceId
 * @param {string} dateStr     "YYYY-MM-DD"
 * @param {number} slotStartMins
 * @param {number} slotEndMins   (includes buffer)
 * @returns {Promise<{employeeId: number, resourceId: number}>}
 */
async function assignEmployeeAndResource(client, serviceId, dateStr, slotStartMins, slotEndMins) {
    const dayOfWeek  = new Date(dateStr + 'T00:00:00').getDay();
    const startTime  = minsToTime(slotStartMins);  // "HH:MM"
    const endTime    = minsToTime(slotEndMins);    // "HH:MM"

    // ── Service resource type ─────────────────────────────────────────────────
    const svcRes = await client.query(
        'SELECT resource_type, duration_minutes FROM services WHERE service_id = $1',
        [serviceId]
    );
    if (!svcRes.rows.length) throw Object.assign(new Error('Service not found'), { code: 'SERVICE_NOT_FOUND' });
    const resourceType  = svcRes.rows[0].resource_type || 'general';
    const duration      = parseInt(svcRes.rows[0].duration_minutes) || 30;
    const serviceEndTime = minsToTime(slotStartMins + duration); // shift boundary

    // ── Lock all overlapping appointments on this date ────────────────────────
    // This prevents two concurrent transactions from reading the same "free" slot.
    await client.query(
        `SELECT appointment_id
           FROM appointments
          WHERE appointment_date = $1
            AND status NOT IN ('Cancelled', 'No-Show')
            AND start_time IS NOT NULL
            FOR UPDATE`,
        [dateStr]
    );

    // ── Pick first available employee ─────────────────────────────────────────
    const empRes = await client.query(
        `SELECT e.employee_id
           FROM employees e
           JOIN employee_skills  sk ON sk.employee_id = e.employee_id
                                   AND sk.service_id  = ?
           JOIN employee_shifts  es ON es.employee_id  = e.employee_id
                                   AND es.day_of_week  = ?
                                   AND es.is_active    = TRUE
                                   AND es.start_time  <= ?
                                   AND es.end_time    >= ?
          WHERE e.is_active = TRUE
            AND e.employee_id NOT IN (
                  SELECT a.employee_id
                    FROM appointments a
                   WHERE a.appointment_date = ?
                     AND a.status NOT IN ('Cancelled', 'No-Show')
                     AND a.employee_id IS NOT NULL
                     AND a.start_time < ?
                     AND a.end_time   > ?
            )
          LIMIT 1`,
        [serviceId, dayOfWeek, startTime, serviceEndTime, dateStr, slotTimestamp(dateStr, slotEndMins), slotTimestamp(dateStr, slotStartMins)]
    );

    if (!empRes.rows.length) {
        throw Object.assign(new Error('No employee available for this slot'), { code: 'NO_EMPLOYEE_AVAILABLE' });
    }
    const employeeId = empRes.rows[0].employee_id;

    // ── Pick first available resource ─────────────────────────────────────────
    const resRes = await client.query(
        `SELECT r.resource_id
           FROM resources r
          WHERE r.type      = ?
            AND r.is_active = TRUE
            AND r.resource_id NOT IN (
                  SELECT a.resource_id
                    FROM appointments a
                   WHERE a.appointment_date = ?
                     AND a.status NOT IN ('Cancelled', 'No-Show')
                     AND a.resource_id IS NOT NULL
                     AND a.start_time < ?
                     AND a.end_time   > ?
            )
          LIMIT 1`,
        [resourceType, dateStr, slotTimestamp(dateStr, slotEndMins), slotTimestamp(dateStr, slotStartMins)]
    );

    if (!resRes.rows.length) {
        throw Object.assign(new Error('No resource available for this slot'), { code: 'NO_RESOURCE_AVAILABLE' });
    }
    const resourceId = resRes.rows[0].resource_id;

    return { employeeId, resourceId };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    // Core primitives
    timeToMins,
    minsToTime,
    slotTimestamp,
    overlaps,
    // Scheduling
    generateSlots,
    getAvailability,
    assignEmployeeAndResource,
};
