import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

/**
 * Update Usher Passwords with Proper Hashes
 * Run this to hash the passwords in the database
 */

async function updatePasswords() {
    console.log('\n🔐 Updating Usher Passwords\n');
    console.log('='.repeat(50));

    if (!process.env.DATABASE_URL) {
        console.error('\n❌ ERROR: DATABASE_URL not found in .env file\n');
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        // Default password for all ushers: "password123"
        const defaultPassword = 'password123';
        const saltRounds = 10;

        console.log(`Hashing password: "${defaultPassword}"\n`);
        const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

        // Update all ushers
        const ushers = [
            { id: 'U001', username: 'admin' },
            { id: 'U002', username: 'usher1' },
            { id: 'U003', username: 'usher2' },
        ];

        for (const usher of ushers) {
            await client.query(
                'UPDATE ushers SET password_hash = $1 WHERE usher_id = $2',
                [passwordHash, usher.id]
            );
            console.log(`✅ Updated password for ${usher.username} (${usher.id})`);
        }

        console.log('\n' + '='.repeat(50));
        console.log('🎉 All passwords updated successfully!\n');
        console.log('Login credentials:');
        console.log('  Username: admin (or usher1, usher2)');
        console.log('  Password: password123\n');
        console.log('⚠️  Remember to change these in production!\n');

    } catch (err) {
        console.error('\n❌ Update failed:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

updatePasswords();
