import db from '../services/database.js';
import cache from '../services/cache.js';
import { authenticate } from '../middleware/authenticate.js';
import { info, warn, error as logError } from '../../utils/logger.js';

/**
 * POST /api/guests/undo-check-in
 * Undo a guest check-in within 30 seconds
 * 
 * Body params:
 * - guestId: Guest ID (required)
 * - reason: Optional reason for undo
 * 
 * Returns:
 * - Updated guest object (reverted to Not Checked In)
 */

const UNDO_TIME_WINDOW = 30000; // 30 seconds in milliseconds

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
        const { guestId, reason = '' } = req.body;

        const trimmedGuestId = guestId != null ? String(guestId).trim() : '';

        // Validation
        if (!trimmedGuestId) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Guest ID is required',
                details: { field: 'guestId' }
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

        const guestResult = await db.query(guestQuery, [trimmedGuestId]);

        // Check if guest exists
        if (guestResult.rows.length === 0) {
            warn('Undo check-in failed: Guest not found', {
                username: req.user.username,
                guestId: trimmedGuestId
            });

            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: `Guest with ID ${trimmedGuestId} not found`
            });
        }

        const guest = guestResult.rows[0];

        // Check if guest is checked in
        if (guest.status !== 'Checked In') {
            warn('Undo check-in failed: Guest not checked in', {
                username: req.user.username,
                guestId: trimmedGuestId,
                guestName: `${guest.first_name} ${guest.last_name}`,
                currentStatus: guest.status
            });

            return res.status(400).json({
                success: false,
                error: 'Not Checked In',
                message: `${guest.first_name} ${guest.last_name} is not checked in`,
                details: {
                    currentStatus: guest.status
                }
            });
        }

        // Validate time window (must be within 30 seconds of check-in)
        if (!guest.check_in_time) {
            warn('Undo check-in failed: No check-in time recorded', {
                username: req.user.username,
                guestId: trimmedGuestId
            });

            return res.status(400).json({
                success: false,
                error: 'Invalid Check-In',
                message: 'Guest has no valid check-in time'
            });
        }

        const checkInTime = new Date(guest.check_in_time).getTime();
        const now = Date.now();
        const timeSinceCheckIn = now - checkInTime;

        if (timeSinceCheckIn > UNDO_TIME_WINDOW) {
            const secondsElapsed = Math.floor(timeSinceCheckIn / 1000);

            warn('Undo check-in failed: Time window expired', {
                username: req.user.username,
                guestId: trimmedGuestId,
                guestName: `${guest.first_name} ${guest.last_name}`,
                secondsElapsed,
                allowedSeconds: UNDO_TIME_WINDOW / 1000
            });

            return res.status(400).json({
                success: false,
                error: 'Time Window Expired',
                message: `Cannot undo check-in after 30 seconds. ${secondsElapsed} seconds have elapsed.`,
                details: {
                    checkInTime: guest.check_in_time,
                    secondsElapsed,
                    maxAllowedSeconds: 30
                }
            });
        }

        const timestamp = new Date().toISOString();
        const previousConfirmationCode = guest.confirmation_code;
        const previousPlusOnes = guest.plus_ones_checked_in;

        // Update guest record - use transaction for atomicity
        const client = await db.pool.connect();

        try {
            await client.query('BEGIN');

            // Reset guest check-in status
            const updateQuery = `
        UPDATE guests
        SET 
          status = 'Not Checked In',
          check_in_time = NULL,
          confirmation_code = NULL,
          plus_ones_checked_in = 0,
          checked_in_by = NULL,
          last_modified = $1
        WHERE id = $2
        RETURNING *
      `;

            const updateResult = await client.query(updateQuery, [
                timestamp,
                trimmedGuestId
            ]);

            const updatedGuest = updateResult.rows[0];

            // Add undo entry to check-in log
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

            const undoNotes = reason
                ? `Undo: ${reason}. Previous confirmation: ${previousConfirmationCode}`
                : `Undo check-in. Previous confirmation: ${previousConfirmationCode}`;

            await client.query(logQuery, [
                timestamp,
                trimmedGuestId,
                `${guest.first_name} ${guest.last_name}`,
                'Undo Check In',
                req.user.fullName || req.user.username,
                previousPlusOnes,
                undoNotes,
                previousConfirmationCode
            ]);

            await client.query('COMMIT');

            // Invalidate all guest-related caches
            cache.clearPattern('guests:*');

            info('Check-in undone successfully', {
                username: req.user.username,
                guestId: trimmedGuestId,
                guestName: `${guest.first_name} ${guest.last_name}`,
                previousConfirmationCode,
                previousPlusOnes,
                timeSinceCheckIn: Math.floor(timeSinceCheckIn / 1000),
                reason
            });

            return res.status(200).json({
                success: true,
                message: `Check-in for ${guest.first_name} ${guest.last_name} has been undone`,
                data: {
                    guest: updatedGuest,
                    previousCheckIn: {
                        confirmationCode: previousConfirmationCode,
                        checkInTime: guest.check_in_time,
                        plusOnes: previousPlusOnes,
                        checkedInBy: guest.checked_in_by
                    }
                }
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        logError('Error undoing check-in', {
            error: err.message,
            stack: err.stack,
            body: req.body,
            username: req.user?.username
        });

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to undo check-in'
        });
    }
}