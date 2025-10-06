import pg from 'pg';
import { info, warn, error as logError } from '../../utils/logger.js';

const { Pool } = pg;

/**
 * PostgreSQL Database Service
 * Handles all database operations with connection pooling
 */

class DatabaseService {
    constructor() {
        this.pool = null;
        this.initialized = false;
    }

    /**
     * Initialize database connection pool
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            info('Initializing database connection');

            if (!process.env.DATABASE_URL) {
                throw new Error('DATABASE_URL environment variable is not set');
            }

            // Create connection pool
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: {
                    rejectUnauthorized: false, // Required for Neon
                },
                max: 20, // Maximum number of clients in pool
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000,
            });

            // Test connection
            await this.testConnection();

            // Handle pool errors
            this.pool.on('error', (err) => {
                logError('Unexpected database error', err);
            });

            this.initialized = true;
            info('Database connection pool initialized');

        } catch (err) {
            logError('Failed to initialize database', err);
            throw new Error(`Database initialization failed: ${err.message}`);
        }
    }

    /**
     * Test database connection
     */
    async testConnection() {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW() as current_time, version() as version');
            client.release();

            info('Database connection successful', {
                time: result.rows[0].current_time,
                version: result.rows[0].version.split(' ')[0],
            });

            return true;
        } catch (err) {
            logError('Database connection test failed', err);
            throw new Error('Cannot connect to database. Check DATABASE_URL.');
        }
    }

    /**
     * Execute a query
     * @param {string} text - SQL query
     * @param {Array} params - Query parameters
     * @returns {object} Query result
     */
    async query(text, params = []) {
        await this.initialize();

        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;

            info('Query executed', {
                duration: `${duration}ms`,
                rows: result.rowCount,
            });

            return result;
        } catch (err) {
            logError('Query execution failed', { query: text, error: err.message });
            throw err;
        }
    }

    /**
     * Get all guests
     * @returns {Array} Array of guest objects
     */
    async getGuests() {
        const result = await this.query(`
      SELECT * FROM guests 
      ORDER BY last_name, first_name
    `);

        info(`Retrieved ${result.rows.length} guests`);
        return result.rows;
    }

    /**
     * Get guest by ID
     * @param {string} id - Guest ID
     * @returns {object|null} Guest object or null
     */
    async getGuestById(id) {
        const result = await this.query(
            'SELECT * FROM guests WHERE id = $1',
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Search guests
     * @param {string} searchTerm - Search term
     * @param {object} filters - Additional filters
     * @returns {Array} Matching guests
     */
    async searchGuests(searchTerm = '', filters = {}) {
        let query = `
      SELECT * FROM guests 
      WHERE (
        LOWER(first_name) LIKE LOWER($1) OR
        LOWER(last_name) LIKE LOWER($1) OR
        LOWER(email) LIKE LOWER($1) OR
        LOWER(phone) LIKE LOWER($1) OR
        LOWER(id) LIKE LOWER($1)
      )
    `;

        const params = [`%${searchTerm}%`];
        let paramIndex = 2;

        // Add status filter
        if (filters.status) {
            query += ` AND status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }

        // Add ticket type filter
        if (filters.ticketType) {
            query += ` AND ticket_type = $${paramIndex}`;
            params.push(filters.ticketType);
            paramIndex++;
        }

        query += ' ORDER BY last_name, first_name LIMIT 100';

        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Update guest
     * @param {string} id - Guest ID
     * @param {object} data - Updated guest data
     * @returns {object} Updated guest
     */
    async updateGuest(id, data) {
        const result = await this.query(`
      UPDATE guests SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        ticket_type = COALESCE($5, ticket_type),
        plus_ones_allowed = COALESCE($6, plus_ones_allowed),
        confirmation_code = COALESCE($7, confirmation_code),
        check_in_time = COALESCE($8, check_in_time),
        plus_ones_checked_in = COALESCE($9, plus_ones_checked_in),
        status = COALESCE($10, status),
        notes = COALESCE($11, notes),
        checked_in_by = COALESCE($12, checked_in_by),
        last_modified = NOW()
      WHERE id = $13
      RETURNING *
    `, [
            data.firstName,
            data.lastName,
            data.email,
            data.phone,
            data.ticketType,
            data.plusOnesAllowed,
            data.confirmationCode,
            data.checkInTime,
            data.plusOnesCheckedIn,
            data.status,
            data.notes,
            data.checkedInBy,
            id,
        ]);

        info(`Updated guest ${id}`);
        return result.rows[0];
    }

    /**
     * Get all ushers
     * @returns {Array} Array of usher objects
     */
    async getUshers() {
        const result = await this.query(`
      SELECT usher_id, username, full_name, role, active, created_at, last_login
      FROM ushers
      ORDER BY full_name
    `);

        info(`Retrieved ${result.rows.length} ushers`);
        return result.rows;
    }

    /**
     * Get usher by username
     * @param {string} username - Username
     * @returns {object|null} Usher object with password hash
     */
    async getUsherByUsername(username) {
        const result = await this.query(
            'SELECT * FROM ushers WHERE username = $1 AND active = true',
            [username]
        );

        return result.rows[0] || null;
    }

    /**
     * Update usher last login
     * @param {string} usherId - Usher ID
     */
    async updateUsherLastLogin(usherId) {
        await this.query(
            'UPDATE ushers SET last_login = NOW() WHERE usher_id = $1',
            [usherId]
        );
    }

    /**
     * Add check-in log entry
     * @param {object} logData - Log entry data
     * @returns {object} Created log entry
     */
    async addCheckInLog(logData) {
        const result = await this.query(`
      INSERT INTO check_in_log (
        guest_id, guest_name, action, usher_name, 
        plus_ones_count, notes, confirmation_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
            logData.guestId,
            logData.guestName,
            logData.action,
            logData.usherName,
            logData.plusOnesCount || 0,
            logData.notes || '',
            logData.confirmationCode || '',
        ]);

        info('Added check-in log entry', {
            guestId: logData.guestId,
            action: logData.action
        });

        return result.rows[0];
    }

    /**
     * Get check-in logs
     * @param {number} limit - Maximum number of logs
     * @param {object} filters - Optional filters
     * @returns {Array} Log entries
     */
    async getCheckInLogs(limit = 100, filters = {}) {
        let query = 'SELECT * FROM check_in_log WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        // Filter by guest ID
        if (filters.guestId) {
            query += ` AND guest_id = $${paramIndex}`;
            params.push(filters.guestId);
            paramIndex++;
        }

        // Filter by action
        if (filters.action) {
            query += ` AND action = $${paramIndex}`;
            params.push(filters.action);
            paramIndex++;
        }

        query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Get dashboard statistics
     * @returns {object} Statistics object
     */
    async getStats() {
        const result = await this.query(`
      SELECT 
        COUNT(*) as total_guests,
        COUNT(*) FILTER (WHERE status = 'Checked In') as checked_in,
        COUNT(*) FILTER (WHERE status = 'Not Checked In') as not_checked_in,
        COALESCE(SUM(plus_ones_checked_in), 0) as total_plus_ones,
        COUNT(DISTINCT ticket_type) as ticket_types,
        COUNT(*) FILTER (WHERE check_in_time >= NOW() - INTERVAL '1 hour') as checked_in_last_hour
      FROM guests
    `);

        const stats = result.rows[0];

        // Convert BigInt to Number for JSON serialization
        Object.keys(stats).forEach(key => {
            if (typeof stats[key] === 'bigint') {
                stats[key] = Number(stats[key]);
            }
        });

        info('Retrieved dashboard stats', stats);
        return stats;
    }

    /**
     * Execute transaction
     * @param {Function} callback - Transaction callback
     * @returns {*} Result from callback
     */
    async transaction(callback) {
        await this.initialize();

        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');

            info('Transaction committed successfully');
            return result;

        } catch (err) {
            await client.query('ROLLBACK');
            logError('Transaction rolled back', err);
            throw err;

        } finally {
            client.release();
        }
    }

    /**
     * Close database connection pool
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.initialized = false;
            info('Database connection pool closed');
        }
    }
}

// Export singleton instance
const db = new DatabaseService();
export default db;