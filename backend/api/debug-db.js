import pg from 'pg';
import { info, error as logError } from '../utils/logger.js';

const { Client } = pg;

/**
 * Debug Database Configuration
 * GET /api/debug-db
 * 
 * Shows detailed information about database connection
 * Remove in production!
 */

export default async function handler(req, res) {
    const debug = {
        timestamp: new Date().toISOString(),
        envVariables: {},
        connectionTests: {},
        tables: {},
    };

    try {
        // Check environment variable
        debug.envVariables.DATABASE_URL = {
            exists: !!process.env.DATABASE_URL,
            length: process.env.DATABASE_URL?.length || 0,
            isNeonUrl: process.env.DATABASE_URL?.includes('neon.tech') || false,
            hasSsl: process.env.DATABASE_URL?.includes('sslmode=require') || false,
            preview: process.env.DATABASE_URL ?
                `${process.env.DATABASE_URL.substring(0, 30)}...` : 'MISSING',
        };

        // Test 1: Basic connection
        let client;
        try {
            client = new Client({
                connectionString: process.env.DATABASE_URL,
                ssl: {
                    rejectUnauthorized: false,
                },
            });

            await client.connect();

            debug.connectionTests.connect = {
                status: 'success',
                message: 'Successfully connected to database',
            };

            // Get database info
            const dbInfo = await client.query(`
        SELECT 
          current_database() as database,
          current_user as user,
          version() as version
      `);

            debug.connectionTests.info = {
                status: 'success',
                database: dbInfo.rows[0].database,
                user: dbInfo.rows[0].user,
                version: dbInfo.rows[0].version.split(' ')[0] + ' ' + dbInfo.rows[0].version.split(' ')[1],
            };

        } catch (err) {
            debug.connectionTests.connect = {
                status: 'failed',
                error: err.message,
                code: err.code,
            };

            return res.json(debug);
        }

        // Test 2: Check if tables exist
        try {
            const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

            debug.tables.list = tablesResult.rows.map(r => r.table_name);
            debug.tables.count = tablesResult.rows.length;

            if (debug.tables.count === 0) {
                debug.tables.warning = 'No tables found. Run: npm run db:setup';
            }

            // Check required tables
            const requiredTables = ['guests', 'ushers', 'check_in_log'];
            debug.tables.required = {};

            for (const tableName of requiredTables) {
                const exists = debug.tables.list.includes(tableName);

                if (exists) {
                    // Get row count
                    const countResult = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
                    const count = parseInt(countResult.rows[0].count);

                    debug.tables.required[tableName] = {
                        exists: true,
                        rows: count,
                        status: count > 0 ? 'populated' : 'empty',
                    };
                } else {
                    debug.tables.required[tableName] = {
                        exists: false,
                        status: 'missing',
                    };
                }
            }

        } catch (err) {
            debug.tables.error = err.message;
        }

        // Test 3: Check indexes
        try {
            const indexResult = await client.query(`
        SELECT 
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `);

            debug.indexes = {
                count: indexResult.rows.length,
                list: indexResult.rows.map(r => ({
                    table: r.tablename,
                    name: r.indexname,
                })),
            };

        } catch (err) {
            debug.indexes = { error: err.message };
        }

        // Summary and recommendations
        const allTablesExist = ['guests', 'ushers', 'check_in_log'].every(
            t => debug.tables.required[t]?.exists
        );

        debug.summary = {
            connectionWorking: debug.connectionTests.connect?.status === 'success',
            tablesSetup: allTablesExist,
            ready: debug.connectionTests.connect?.status === 'success' && allTablesExist,
            recommendations: [],
        };

        if (!debug.envVariables.DATABASE_URL.exists) {
            debug.summary.recommendations.push('Add DATABASE_URL to .env file');
        }

        if (!allTablesExist) {
            debug.summary.recommendations.push('Run database setup: npm run db:setup');
        }

        if (allTablesExist) {
            const emptyTables = Object.entries(debug.tables.required)
                .filter(([_, info]) => info.status === 'empty')
                .map(([name, _]) => name);

            if (emptyTables.length > 0) {
                debug.summary.recommendations.push(
                    `Tables are empty: ${emptyTables.join(', ')}. Run: npm run db:setup`
                );
            }
        }

        if (debug.summary.ready) {
            debug.summary.recommendations.push('✅ Database is ready! Test with: /api/test-db');
        }

        await client.end();

        return res.json(debug);

    } catch (err) {
        logError('Debug database endpoint error', err);
        return res.status(500).json({
            success: false,
            error: err.message,
            stack: err.stack,
        });
    }
}