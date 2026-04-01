/**
 * Seed existing filesystem images into the PostgreSQL database.
 * Run once: node server/migrations/seed_images_from_files.js
 *
 * Maps each category name to its existing image file in public/images/.
 * Services start without images — admin can upload per service via the dashboard.
 */
'use strict';

const path = require('path');
const fs   = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const db = require('../db');

const IMAGES_DIR = path.join(__dirname, '../../public/images');

// category name  →  filename in public/images/
const CATEGORY_IMAGE_MAP = {
    'De-Tan':          'de tan.png',
    'Clean Up':        'claen up.png',
    'Hair Treatment':  'Hair Treatment.png',
    'Head Oil Massage':'Head Oil massage.png',
    'Hair Colourings': 'Hair colouring.png',
    'Make Up':         'Make Up.png',
    'Pedicure':        'pedicure.png',
    'Manicure':        'Manicure.png',
    'Haircut':         'Haircut.png',
    'Kids':            'Kids.png',
    'Beard':           'Beard.png',
};

// Gallery / portfolio images for the homepage scrolling strip
const GALLERY_FILES = [
    { filename: '1.jpeg',        caption: 'Our Work', sort_order: 1 },
    { filename: '2.jpeg',        caption: 'Our Work', sort_order: 2 },
    { filename: '4.jpeg',        caption: 'Our Work', sort_order: 3 },
    { filename: '5.jpeg',        caption: 'Our Work', sort_order: 4 },
    { filename: '6.jpeg',        caption: 'Our Work', sort_order: 5 },
    { filename: '7.jpeg',        caption: 'Our Work', sort_order: 6 },
    { filename: '8.jpeg',        caption: 'Our Work', sort_order: 7 },
    { filename: '9.jpeg',        caption: 'Our Work', sort_order: 8 },
    { filename: '10.jpeg',       caption: 'Our Work', sort_order: 9 },
    { filename: 'tattoo_cat.jpg',caption: 'Tattoo Art', sort_order: 10 },
];

function mimeForFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    const map = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
    return map[ext] || 'application/octet-stream';
}

async function run() {
    const client = db;
    try {
        // Migration already applied in MySQL schema

        const cats = await client.query('SELECT category_id, name FROM categories ORDER BY category_id');

        let seeded = 0;
        for (const cat of cats.rows) {
            const filename = CATEGORY_IMAGE_MAP[cat.name];
            if (!filename) {
                console.log(`[seed] No image mapped for category: "${cat.name}" — skipping`);
                continue;
            }
            const filePath = path.join(IMAGES_DIR, filename);
            if (!fs.existsSync(filePath)) {
                console.warn(`[seed] File not found: ${filePath} — skipping`);
                continue;
            }
            const imageData = fs.readFileSync(filePath);
            const mime      = mimeForFile(filename);
            await client.query(
                `UPDATE categories
                    SET image_data = $1, image_mime_type = $2, image_filename = $3
                  WHERE category_id = $4`,
                [imageData, mime, filename, cat.category_id]
            );
            console.log(`[seed] ✓ ${cat.name} → ${filename} (${(imageData.length / 1024).toFixed(1)} KB)`);
            seeded++;
        }
        console.log(`\n[seed] Done. ${seeded} category images seeded into DB.`);

        // ── Gallery images ──────────────────────────────────────────────────────
        console.log('\n[seed] Seeding gallery images…');

        // Only seed if gallery is empty
        const existing = await client.query('SELECT COUNT(*) FROM gallery_images');
        if (parseInt(existing.rows[0].count) > 0) {
            console.log('[seed] Gallery already has images — skipping gallery seed.');
        } else {
            let galSeeded = 0;
            for (const g of GALLERY_FILES) {
                const filePath = path.join(IMAGES_DIR, g.filename);
                if (!fs.existsSync(filePath)) {
                    console.warn(`[seed] Gallery file not found: ${filePath} — skipping`);
                    continue;
                }
                const imageData = fs.readFileSync(filePath);
                const mime      = mimeForFile(g.filename);
                await client.query(
                    `INSERT INTO gallery_images (image_data, image_mime_type, image_filename, caption, sort_order)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [imageData, mime, g.filename, g.caption, g.sort_order]
                );
                console.log(`[seed] ✓ gallery/${g.filename} (${(imageData.length / 1024).toFixed(1)} KB)`);
                galSeeded++;
            }
            console.log(`[seed] Done. ${galSeeded} gallery images seeded.`);
        }
    } finally {
        await db.pool.end();
    }
}

run().catch(err => { console.error('[seed] ERROR:', err.message); process.exit(1); });
