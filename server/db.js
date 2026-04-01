const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true, // Returns DATE, DATETIME, and TIMESTAMP as strings
    multipleStatements: true // Required for running multi-statement migrations
});

// Helper to create the database if it doesn't exist
const ensureDatabase = async () => {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT) || 3306,
        });
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
        await connection.end();
        console.log(`[DB] Database "${process.env.DB_NAME}" ensured.`);
    } catch (err) {
        console.error('[DB] Error ensuring database:', err.message);
    }
};

// Auto-ensure database on load (lazy-init style or just calling it)
ensureDatabase();

module.exports = {
    /**
     * Compatibility wrapper for pg-style queries.
     * Maps [rows] to { rows }.
     */
    query: async (sql, params) => {
        let newParams = [];
        let formattedSql = sql;
        let wasReplaced = false;
        if (params && params.length > 0) {
            formattedSql = sql.replace(/\$(\d+)/g, (match, p1) => {
                wasReplaced = true;
                const idx = parseInt(p1, 10) - 1;
                newParams.push(params[idx]);
                return '?';
            });
            if (!wasReplaced) newParams = params;
        } else {
            newParams = params;
            formattedSql = sql.replace(/\$\d+/g, '?');
        }
        try {
            const [rows] = await pool.query(formattedSql, newParams);
            if (rows && rows.constructor.name === 'ResultSetHeader') {
                return { rows: [], insertId: rows.insertId, affectedRows: rows.affectedRows };
            }
            return { rows: Array.isArray(rows) ? rows : [rows] };
        } catch (err) {
            console.error('[DB] Query Error:', err.message, '\\nSQL:', formattedSql);
            throw err;
        }
    },
    connect: async () => {
        const client = await pool.getConnection();
        const originalQuery = client.query.bind(client);
        client.query = async (sql, params) => {
            let newParams = [];
            let formattedSql = sql;
            let wasReplaced = false;
            if (params && params.length > 0) {
                formattedSql = sql.replace(/\$(\d+)/g, (match, p1) => {
                    wasReplaced = true;
                    const idx = parseInt(p1, 10) - 1;
                    newParams.push(params[idx]);
                    return '?';
                });
                if (!wasReplaced) newParams = params;
            } else {
                newParams = params;
                formattedSql = sql.replace(/\$\d+/g, '?');
            }
            try {
                const [rows] = await originalQuery(formattedSql, newParams);
                if (rows && rows.constructor.name === 'ResultSetHeader') {
                    return { rows: [], insertId: rows.insertId, affectedRows: rows.affectedRows };
                }
                return { rows: Array.isArray(rows) ? rows : [rows] };
            } catch (err) {
                console.error('[DB Tx] Query Error:', err.message, '\\nSQL:', formattedSql);
                throw err;
            }
        };
        return client;
    },
    pool
};
