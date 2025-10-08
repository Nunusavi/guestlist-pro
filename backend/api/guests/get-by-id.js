import db from '../services/database.js';
import cache from '../services/cache.js';
import { authenticate } from '../middleware/authenticate.js';
import { info, warn, error as logError } from '../../utils/logger.js';

/**
 * GET /api/guests/:id
 * Fetch single guest by ID with check-in history
 * 
 * Params:
 * - id: Guest ID (integer)
 * 
 * Returns:
 * - Guest details
 * - Check-in history from audit log
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

        // Extract and validate guest ID
        const rawGuestId = req.query.id;
        const guestId = rawGuestId != null ? String(rawGuestId).trim() : '';

        if (!guestId) {
            warn('Invalid guest ID provided', {
                username: req.user.username,
                providedId: req.query.id
            });

            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Valid guest ID is required'
            });
        }

        // Try to get from cache first
        const cacheKey = `guests:id:${guestId}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            info('Guest details served from cache', {
                username: req.user.username,
                guestId,
                cacheKey
            });

            return res.status(200).json({
                success: true,
                data: cached,
                cached: true
            });
        }

        // Fetch guest details
        const guestQuery = `
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
      WHERE id = $1
    `;

        const guestResult = await db.query(guestQuery, [guestId]);

        // Check if guest exists
        if (guestResult.rows.length === 0) {
            warn('Guest not found', {
                username: req.user.username,
                guestId
            });

            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: `Guest with ID ${guestId} not found`
            });
        }

        const guest = guestResult.rows[0];

        // Fetch check-in history from audit log
        const historyQuery = `
      SELECT 
        id,
        timestamp,
        action,
        usher_name,
        plus_ones_count,
        notes,
        confirmation_code
      FROM check_in_log
      WHERE guest_id = $1
      ORDER BY timestamp DESC
      LIMIT 50
    `;

        const historyResult = await db.query(historyQuery, [guestId]);

        // Prepare response data
        const responseData = {
            guest,
            checkInHistory: historyResult.rows,
            historyCount: historyResult.rows.length
        };

        // Cache for 30 seconds
        cache.set(cacheKey, responseData, 30000);

        info('Guest details fetched', {
            username: req.user.username,
            guestId,
            guestName: `${guest.first_name} ${guest.last_name}`,
            status: guest.status,
            historyEntries: historyResult.rows.length
        });

        return res.status(200).json({
            success: true,
            data: responseData
        });

    } catch (err) {
        logError('Error fetching guest details', {
            error: err.message,
            stack: err.stack,
            guestId: req.query.id
        });

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to fetch guest details'
        });
    }
}