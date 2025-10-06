import db from '../services/database.js';
import cache from '../services/cache.js';
import { authenticate } from '../middleware/authenticate.js';
import { info, warn, error as logError } from '../../utils/logger.js';

/**
 * POST /api/guests/check-in
 * Check in a guest with plus ones
 * 
 * Body params:
 * - guestId: Guest ID (required)
 * - plusOnes: Number of plus ones (default: 0)
 * - notes: Optional check-in notes
 * 
 * Returns:
 * - Updated guest object
 * - Generated confirmation code
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

        // Extract and validate request body
        const { guestId, plusOnes = 0, notes = '' } = req.body;

        // Validation
        if (!guestId) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Guest ID is required',
                details: { field: 'guestId' }
            });
        }

        const guestIdInt = parseInt(guestId);
        const plusOnesInt = parseInt(plusOnes) || 0;

        if (isNaN(guestIdInt)) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Invalid guest ID',
                details: { field: 'guestId' }
            });
        }

        if (plusOnesInt < 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Plus ones cannot be negative',
                details: { field: 'plusOnes' }
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
        checked_in_by
      FROM guests
      WHERE id = $1
    `;

        const guestResult = await db.query(guestQuery, [guestIdInt]);

        // Check if guest exists
        if (guestResult.rows.length === 0) {
            warn('Check-in failed: Guest not found', {
                username: req.user.username,
                guestId: guestIdInt
            });

            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: `Guest with ID ${guestIdInt} not found`
            });
        }

        const guest = guestResult.rows[0];

        // Check if guest is already checked in
        if (guest.status === 'Checked In') {
            warn('Check-in failed: Guest already checked in', {
                username: req.user.username,
                guestId: guestIdInt,
                guestName: `${guest.first_name} ${guest.last_name}`,
                previousCheckIn: guest.check_in_time
            });

            return res.status(400).json({
                success: false,
                error: 'Already Checked In',
                message: `${guest.first_name} ${guest.last_name} is already checked in`,
                details: {
                    checkInTime: guest.check_in_time,
                    checkedInBy: guest.checked_in_by,
                    confirmationCode: guest.confirmation_code
                }
            });
        }

        // Validate plus ones don't exceed allowed
        if (plusOnesInt > guest.plus_ones_allowed) {
            warn('Check-in failed: Too many plus ones', {
                username: req.user.username,
                guestId: guestIdInt,
                requested: plusOnesInt,
                allowed: guest.plus_ones_allowed
            });

            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: `Guest is only allowed ${guest.plus_ones_allowed} plus ones, but ${plusOnesInt} were requested`,
                details: {
                    requested: plusOnesInt,
                    allowed: guest.plus_ones_allowed
                }
            });
        }

        // Generate confirmation code: {username}-{firstName}{lastName}-{timestamp}
        const timestamp = Date.now();
        const confirmationCode = `${req.user.username}-${guest.first_name}${guest.last_name}-${timestamp}`.toUpperCase();
        const checkInTime = new Date().toISOString();

        // Update guest record - use transaction for atomicity
        const client = await db.pool.connect();

        try {
            await client.query('BEGIN');

            // Update guest
            const updateQuery = `
        UPDATE guests
        SET 
          status = 'Checked In',
          check_in_time = $1,
          confirmation_code = $2,
          plus_ones_checked_in = $3,
          checked_in_by = $4,
          notes = CASE 
            WHEN $5 != '' THEN $5
            ELSE notes
          END,
          last_modified = $1
        WHERE id = $6
        RETURNING *
      `;

            const updateResult = await client.query(updateQuery, [
                checkInTime,
                confirmationCode,
                plusOnesInt,
                req.user.fullName || req.user.username,
                notes,
                guestIdInt
            ]);

            const updatedGuest = updateResult.rows[0];

            // Add entry to check-in log
            const logQuery = `
        INSERT INTO check_in_log (
          timestamp,
          guest_id,
          guest_name,
          action,
          usher_name,
          plus_ones_count,
          notes,
          confirmation_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;

            await client.query(logQuery, [
                checkInTime,
                guestIdInt,
                `${guest.first_name} ${guest.last_name}`,
                'Check In',
                req.user.fullName || req.user.username,
                plusOnesInt,
                notes,
                confirmationCode
            ]);

            await client.query('COMMIT');

            // Invalidate all guest-related caches
            cache.clearPattern('guests:*');

            info('Guest checked in successfully', {
                username: req.user.username,
                guestId: guestIdInt,
                guestName: `${guest.first_name} ${guest.last_name}`,
                plusOnes: plusOnesInt,
                confirmationCode,
                ticketType: guest.ticket_type
            });

            return res.status(200).json({
                success: true,
                message: `${guest.first_name} ${guest.last_name} checked in successfully`,
                data: {
                    guest: updatedGuest,
                    confirmationCode,
                    checkInTime,
                    plusOnesCheckedIn: plusOnesInt
                }
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        logError('Error checking in guest', {
            error: err.message,
            stack: err.stack,
            body: req.body,
            username: req.user?.username
        });

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to check in guest'
        });
    }
}