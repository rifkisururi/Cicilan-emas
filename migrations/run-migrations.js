const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function runMigrations() {
    console.log('🚀 Starting database migrations...\n');

    try {
        // Get all SQL files in migrations directory
        const migrationFiles = fs.readdirSync(__dirname)
            .filter(file => file.endsWith('.sql'))
            .sort();

        for (const file of migrationFiles) {
            console.log(`📄 Running migration: ${file}`);
            const filePath = path.join(__dirname, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            await pool.query(sql);
            console.log(`✅ Successfully executed: ${file}\n`);
        }

        console.log('🎉 All migrations completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrations();
