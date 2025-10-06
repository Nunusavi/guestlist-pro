import db from '../services/database.js';
import { authenticate } from '../middleware/authenticate.js';
import { info, error as logError } from '../../utils/logger.js';

/**
 * POST /api/guests/search
 * Fuzzy search for guests with filters and sorting
 * 
 * Body params:
 * - query: Search string (searches name, email, phone, ID)
 * - status: Filter by status ('Checked In', 'Not Checked In')
 * - ticketType: Filter by ticket type ('VIP', 'General', 'Premium')
 * - sortBy: Sort field (name, checkInTime, ticketType)
 * - sortOrder: Sort direction (asc, desc)
 * 
 * Returns first 100 results (no caching - real-time search)
 */

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method Not Allowed',
            message: 'Only POST requests are allowed'
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

        // Extract and validate search parameters
        const {
            query = '',
            status = null,
            ticketType = null,
            sortBy = 'name',
            sortOrder = 'asc'
        } = req.body;

        // Validate sort parameters
        const validSortFields = {
            'name': 'last_name',
            'checkInTime': 'check_in_time',
            'ticketType': 'ticket_type'
        };

        const validSortOrders = ['asc', 'desc'];

        const sortField = validSortFields[sortBy] || 'last_name';
        const sortDirection = validSortOrders.includes(sortOrder?.toLowerCase())
            ? sortOrder.toUpperCase()
            : 'ASC';

        // Build dynamic WHERE clause
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        // Add search query conditions (fuzzy search across multiple fields)
        if (query && query.trim()) {
            const searchTerm = `%${query.trim()}%`;
            conditions.push(`(
        LOWER(first_name) LIKE LOWER($${paramIndex}) OR
        LOWER(last_name) LIKE LOWER($${paramIndex}) OR
        LOWER(email) LIKE LOWER($${paramIndex}) OR
        LOWER(phone) LIKE LOWER($${paramIndex}) OR
        CAST(id AS TEXT) LIKE $${paramIndex} OR
        LOWER(CONCAT(first_name, ' ', last_name)) LIKE LOWER($${paramIndex})
      )`);
            params.push(searchTerm);
            paramIndex++;
        }

        // Add status filter
        if (status) {
            conditions.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        // Add ticket type filter
        if (ticketType) {
            conditions.push(`ticket_type = $${paramIndex}`);
            params.push(ticketType);
            paramIndex++;
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        // Build and execute search query
        const searchQuery = `
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
      ORDER BY ${sortField} ${sortDirection}, first_name ASC
      LIMIT 100
    `;

        const result = await db.query(searchQuery, params);

        info('Guest search performed', {
            username: req.user.username,
            query: query || 'none',
            resultsFound: result.rows.length,
            filters: { status, ticketType },
            sort: { sortBy, sortOrder }
        });

        return res.status(200).json({
            success: true,
            data: {
                guests: result.rows,
                total: result.rows.length,
                query: query || '',
                filters: {
                    status,
                    ticketType
                },
                sort: {
                    field: sortBy,
                    order: sortOrder
                }
            }
        });

    } catch (err) {
        logError('Error searching guests', {
            error: err.message,
            stack: err.stack,
            body: req.body
        });

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to search guests'
        });
    }
}