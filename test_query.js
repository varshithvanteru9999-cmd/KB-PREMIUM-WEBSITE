const db = require('./server/db');

async function test() {
    try {
        const id = 2; // Varshith. V
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
            [id]
        );
        console.log('SUCCESS: ', JSON.stringify(result.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error('ERROR: ', e);
        process.exit(1);
    }
}

test();
