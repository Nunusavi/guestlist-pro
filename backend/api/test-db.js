import db from './services/database.js';
import { info, error as logError } from '../utils/logger.js';

/**
 * Test Database Connection
 * GET /api/test-db
 * 
 * Tests all database operations and returns sample data
 * For development/testing only - remove in production
 */

export default async function handler(req, res) {
    try {
        info('Testing database connection');

        const results = {
            success: true,
            timestamp: new Date().toISOString(),
            tests: {},
        };

        // Test 1: Connection
        try {
            await db.initialize();
            await db.testConnection();
            results.tests.connection = {
                status: 'passed',
                message: 'Successfully connected to database',
            };
        } catch (err) {
            results.tests.connection = {
                status: 'failed',
                error: err.message,
            };
            results.success = false;
        }

        // Test 2: Read Guests
        try {
            const guests = await db.getGuests();
            results.tests.readGuests = {
                status: 'passed',
                message: `Retrieved ${guests.length} guests`,
                sample: guests.slice(0, 3).map(g => ({
                    id: g.id,
                    name: `${g.first_name} ${g.last_name}`,
                    email: g.email,
                    status: g.status,
                    ticketType: g.ticket_type,
                })),
                total: guests.length,
                checkedIn: guests.filter(g => g.status === "Checked In").length,
                notCheckedIn: guests.filter(g => g.status === "Not Checked In").length,
            };
        } catch (err) {
            results.tests.readGuests = {
                status: 'failed',
                error: err.message,
            };
            results.success = false;
        }

        // Test 3: Search Guests
        try {
            const searchResults = await db.searchGuests('John');
            results.tests.searchGuests = {
                status: 'passed',
                message: `Search for "John" returned ${searchResults.length} results`,
                results: searchResults.map(g => ({
                    id: g.id,
                    name: `${g.first_name} ${g.last_name}`,
                })),
            };
        } catch (err) {
            results.tests.searchGuests = {
                status: 'failed',
                error: err.message,
            };
            results.success = false;
        }

        // Test 4: Read Ushers
        try {
            const ushers = await db.getUshers();
            results.tests.readUshers = {
                status: 'passed',
                message: `Retrieved ${ushers.length} ushers`,
                sample: ushers.map(u => ({
                    usherId: u.usher_id,
                    username: u.username,
                    fullName: u.full_name,
                    role: u.role,
                    active: u.active,
                })),
                total: ushers.length,
            };
        } catch (err) {
            results.tests.readUshers = {
                status: 'failed',
                error: err.message,
            };
            results.success = false;
        }

        // Test 5: Read Check-In Logs
        try {
            const logs = await db.getCheckInLogs(10);
            results.tests.readLogs = {
                status: 'passed',
                message: `Retrieved ${logs.length} log entries`,
                sample: logs.slice(0, 5).map(l => ({
                    timestamp: l.timestamp,
                    guestName: l.guest_name,
                    action: l.action,
                    usherName: l.usher_name,
                })),
                total: logs.length,
            };
        } catch (err) {
            results.tests.readLogs = {
                status: 'failed',
                error: err.message,
            };
            results.success = false;
        }

        // Test 6: Get Statistics
        try {
            const stats = await db.getStats();
            results.tests.statistics = {
                status: 'passed',
                message: 'Dashboard statistics retrieved',
                stats: stats,
            };
        } catch (err) {
            results.tests.statistics = {
                status: 'failed',
                error: err.message,
            };
            results.success = false;
        }

        // Overall summary
        const passedTests = Object.values(results.tests).filter(t => t.status === 'passed').length;
        const totalTests = Object.keys(results.tests).length;

        results.summary = {
            passed: passedTests,
            failed: totalTests - passedTests,
            total: totalTests,
            allPassed: passedTests === totalTests,
        };

        info('Database tests completed', results.summary);

        return res.status(results.success ? 200 : 500).json(results);

    } catch (err) {
        logError('Test database endpoint error', err);

        return res.status(500).json({
            success: false,
            error: 'Test failed',
            message: err.message,
            timestamp: new Date().toISOString(),
        });
    }
}