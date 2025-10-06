import db from '../services/database.js';
import { authenticate, requireAdmin } from '../middleware/authenticate.js';
import { info, warn, error as logError } from '../../utils/logger.js';

/**
 * GET /api/admin/audit-log
 * Fetch check-in audit trail with filters (Admin only)
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 200)
 * - guestId: Filter by guest ID
 * - action: Filter by action (Check In, Undo Check In, Bulk Check In)
 * - usherName: Filter by usher name
 * - startDate: Filter by start date (ISO format)
 * - endDate: Filter by end date (ISO format)
 * 
 * Sorted by timestamp DESC (newest first)
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
        // Apply authentication and admin check
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err) return reject(err);
                requireAdmin(req, res, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        // Extract and validate query parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
        const guestId = req.query.guestId ? parseInt(req.query.guestId) : null;
        const action = req.query.action || null;
        const usherName = req.query.usherName || null;
        const startDate = req.query.startDate || null;
        const endDate = req.query.endDate || null;

        // Validate date formats if provided
        if (startDate && isNaN(Date.parse(startDate))) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Invalid startDate format. Use ISO format (YYYY-MM-DD)',
                details: { field: 'startDate' }
            });
        }

        if (endDate && isNaN(Date.parse(endDate))) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Invalid endDate format. Use ISO format (YYYY-MM-DD)',
                details: { field: 'endDate' }
            });
        }

        // Build WHERE clause dynamically
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (guestId) {
            conditions.push(`guest_id = $${paramIndex}`);
            params.push(guestId);
            paramIndex++;
        }

        if (action) {
            conditions.push(`action = $${paramIndex}`);
            params.push(action);
            paramIndex++;
        }

        if (usherName) {
            conditions.push(`LOWER(usher_name) LIKE LOWER($${paramIndex})`);
            params.push(`%${usherName}%`);
            paramIndex++;
        }

        if (startDate) {
            conditions.push(`timestamp >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            // Add one day to include the entire end date
            const endDateTime = new Date(endDate);
            endDateTime.setDate(endDateTime.getDate() + 1);
            conditions.push(`timestamp < $${paramIndex}`);
            params.push(endDateTime.toISOString());
            paramIndex++;
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) as total FROM check_in_log ${whereClause}`;
        const countResult = await db.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        // Calculate pagination
        const offset = (page - 1) * limit;
        const totalPages = Math.ceil(total / limit);
        const hasMore = page < totalPages;

        // Fetch audit logs
        const logsQuery = `
      SELECT 
        id,
        timestamp,
        guest_id,
        guest_name,
        action,
        usher_name,
        plus_ones_count,
        notes,
        confirmation_code
      FROM check_in_log
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        const logsResult = await db.query(logsQuery, [...params, limit, offset]);

        // Prepare response data
        const responseData = {
            logs: logsResult.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasMore,
                showing: logsResult.rows.length
            },
            filters: {
                guestId,
                action,
                usherName,
                startDate,
                endDate
            }
        };

        info('Audit log fetched', {
            username: req.user.username,
            count: logsResult.rows.length,
            page,
            total,
            filters: { guestId, action, usherName, startDate, endDate }
        });

        return res.status(200).json({
            success: true,
            data: responseData
        });

    } catch (err) {
        logError('Error fetching audit log', {
            error: err.message,
            stack: err.stack,
            query: req.query,
            username: req.user?.username
        });

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to fetch audit log'
        });
    }
}