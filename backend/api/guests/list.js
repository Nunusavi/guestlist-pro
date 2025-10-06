import db from '../services/database.js';
import cache from '../services/cache.js';
import { authenticate } from '../middleware/authenticate.js';
import { info, error as logError } from '../../utils/logger.js';

/**
 * GET /api/guests
 * Fetch paginated list of guests with optional filters
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * - status: Filter by status ('Checked In', 'Not Checked In')
 * - ticketType: Filter by ticket type ('VIP', 'General', 'Premium')
 */

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method Not Allowed',
            message: 'Only GET requests are allowed'
        });
    }

    try {
        // Apply authentication middleware
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Extract and validate query parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const status = req.query.status || null;
        const ticketType = req.query.ticketType || null;

        // Create cache key based on parameters
        const cacheKey = `guests:list:page${page}:limit${limit}:status${status}:ticket${ticketType}`;

        // Try to get from cache first
        const cached = cache.get(cacheKey);
        if (cached) {
            info('Guest list served from cache', {
                username: req.user.username,
                page,
                limit,
                cacheKey
            });

            return res.status(200).json({
                success: true,
                data: cached,
                cached: true
            });
        }

        // Build WHERE clause for filters
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (status) {
            conditions.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        if (ticketType) {
            conditions.push(`ticket_type = $${paramIndex}`);
            params.push(ticketType);
            paramIndex++;
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) as total FROM guests ${whereClause}`;
        const countResult = await db.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        // Calculate pagination
        const offset = (page - 1) * limit;
        const totalPages = Math.ceil(total / limit);
        const hasMore = page < totalPages;

        // Fetch guests with pagination
        const guestsQuery = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        phone,
        ticket_type,
        plus_ones_allowed,
        confirmation_code,
        check_in_time,
        plus_ones_checked_in,
        status,
        notes,
        checked_in_by,
        created_at,
        last_modified
      FROM guests
      ${whereClause}
      ORDER BY last_name ASC, first_name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        const guestsResult = await db.query(guestsQuery, [...params, limit, offset]);

        // Prepare response data
        const responseData = {
            guests: guestsResult.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasMore,
                showing: guestsResult.rows.length
            }
        };

        // Cache the results for 30 seconds
        cache.set(cacheKey, responseData, 30000);

        info('Guest list fetched', {
            username: req.user.username,
            count: guestsResult.rows.length,
            page,
            total,
            filters: { status, ticketType }
        });

        return res.status(200).json({
            success: true,
            data: responseData
        });

    } catch (err) {
        logError('Error fetching guest list', {
            error: err.message,
            stack: err.stack,
            query: req.query
        });

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to fetch guest list'
        });
    }
}