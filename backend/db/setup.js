import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database Setup Script
 * Runs schema.sql and seed.sql to initialize the database
 */

async function setupDatabase() {
    console.log('\n🗄️  GuestList Pro Database Setup\n');
    console.log('='.repeat(50));

    if (!process.env.DATABASE_URL) {
        console.error('\n❌ ERROR: DATABASE_URL not found in .env file');
        console.log('\nPlease add your Neon database connection string:');
        console.log('DATABASE_URL=postgresql://user:pass@host/db\n');
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    try {
        // Connect to database
        console.log('\n📡 Connecting to database...');
        await client.connect();
        console.log('✅ Connected successfully\n');

        // Read schema file
        console.log('📋 Reading schema.sql...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

        // Execute schema
        console.log('🏗️  Creating tables...');
        await client.query(schemaSQL);
        console.log('✅ Tables created\n');

        // Read seed file
        console.log('📋 Reading seed.sql...');
        const seedPath = path.join(__dirname, 'seed.sql');
        const seedSQL = fs.readFileSync(seedPath, 'utf8');

        // Execute seed
        console.log('🌱 Inserting seed data...');
        await client.query(seedSQL);
        console.log('✅ Seed data inserted\n');

        // Verify setup
        console.log('🔍 Verifying setup...\n');

        const guestsCount = await client.query('SELECT COUNT(*) FROM guests');
        const ushersCount = await client.query('SELECT COUNT(*) FROM ushers');
        const logsCount = await client.query('SELECT COUNT(*) FROM check_in_log');

        console.log(`✅ Guests: ${guestsCount.rows[0].count} records`);
        console.log(`✅ Ushers: ${ushersCount.rows[0].count} records`);
        console.log(`✅ Logs: ${logsCount.rows[0].count} records`);

        console.log('\n' + '='.repeat(50));
        console.log('🎉 Database setup completed successfully!\n');
        console.log('Test credentials:');
        console.log('  Username: admin');
        console.log('  Password: password123');
        console.log('  (Change password in production!)\n');

    } catch (err) {
        console.error('\n❌ Setup failed:', err.message);
        console.error('\nFull error:', err);
        process.exit(1);

    } finally {
        await client.end();
    }
}

setupDatabase();