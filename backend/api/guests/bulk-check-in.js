import db from '../services/database.js';
import cache from '../services/cache.js';
import { authenticate } from '../middleware/authenticate.js';
import { info, warn, error as logError } from '../../utils/logger.js';

/**
 * POST /api/guests/bulk-check-in
 * Check in multiple guests at once (atomic operation)
 * 
 * Body params:
 * - guests: Array of { guestId, plusOnes, notes } (max 50 guests)
 * 
 * Returns:
 * - checkedIn: Successfully checked in guests
 * - failed: Failed check-ins with reasons
 */

const MAX_BULK_SIZE = 50;

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
        const { guests } = req.body;

        // Validation
        if (!guests || !Array.isArray(guests)) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'guests array is required',
                details: { field: 'guests' }
            });
        }

        if (guests.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'guests array cannot be empty',
                details: { field: 'guests' }
            });
        }

        if (guests.length > MAX_BULK_SIZE) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: `Cannot check in more than ${MAX_BULK_SIZE} guests at once`,
                details: {
                    requested: guests.length,
                    maximum: MAX_BULK_SIZE
                }
            });
        }

        // Validate each guest entry
        for (let i = 0; i < guests.length; i++) {
            const guest = guests[i];
            const trimmedGuestId = guest?.guestId != null ? String(guest.guestId).trim() : '';

            if (!trimmedGuestId) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: `Guest at index ${i} is missing guestId`,
                    details: { index: i }
                });
            }

            if (guest.plusOnes !== undefined) {
                const parsedPlusOnes = Number.parseInt(guest.plusOnes, 10);
                if (Number.isNaN(parsedPlusOnes) || parsedPlusOnes < 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Validation Error',
                        message: `Guest at index ${i} has invalid plusOnes value`,
                        details: { index: i, value: guest.plusOnes }
                    });
                }
            }
        }

        const timestamp = new Date().toISOString();
        const checkedIn = [];
        const failed = [];

        // Use transaction for atomicity (all or nothing)
        const client = await db.pool.connect();

        try {
            await client.query('BEGIN');

            // Process each guest
            for (const guestRequest of guests) {
                const guestId = guestRequest?.guestId != null ? String(guestRequest.guestId).trim() : '';
                const parsedPlusOnes = Number.parseInt(guestRequest.plusOnes, 10);
                const plusOnesInt = Number.isNaN(parsedPlusOnes) ? 0 : parsedPlusOnes;
                const notes = guestRequest.notes || '';

                if (!guestId) {
                    failed.push({
                        guestId,
                        reason: 'Guest ID missing',
                        error: 'INVALID_GUEST_ID'
                    });
                    continue;
                }

                try {
                    // Fetch guest details with row lock to prevent concurrent modifications
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
              checked_in_by
            FROM guests
            WHERE id = $1
            FOR UPDATE
          `;

                    const guestResult = await client.query(guestQuery, [guestId]);

                    // Check if guest exists
                    if (guestResult.rows.length === 0) {
                        failed.push({
                            guestId,
                            reason: 'Guest not found',
                            error: 'NOT_FOUND'
                        });
                        continue;
                    }

                    const guest = guestResult.rows[0];

                    // Check if already checked in
                    if (guest.status === 'Checked In') {
                        failed.push({
                            guestId,
                            guestName: `${guest.first_name} ${guest.last_name}`,
                            reason: 'Already checked in',
                            error: 'ALREADY_CHECKED_IN',
                            details: {
                                checkInTime: guest.check_in_time,
                                confirmationCode: guest.confirmation_code
                            }
                        });
                        continue;
                    }

                    // Validate plus ones
                    if (plusOnesInt > guest.plus_ones_allowed) {
                        failed.push({
                            guestId,
                            guestName: `${guest.first_name} ${guest.last_name}`,
                            reason: `Requested ${plusOnesInt} plus ones but only ${guest.plus_ones_allowed} allowed`,
                            error: 'PLUS_ONES_EXCEEDED',
                            details: {
                                requested: plusOnesInt,
                                allowed: guest.plus_ones_allowed
                            }
                        });
                        continue;
                    }

                    // Generate confirmation code
                    const confirmationCode = `${req.user.username}-${guest.first_name}${guest.last_name}-${Date.now()}`.toUpperCase();

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
                        timestamp,
                        confirmationCode,
                        plusOnesInt,
                        req.user.fullName || req.user.username,
                        notes,
                        guestId
                    ]);

                    // Add to check-in log
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
          `;

                    await client.query(logQuery, [
                        timestamp,
                        guestId,
                        `${guest.first_name} ${guest.last_name}`,
                        'Bulk Check In',
                        req.user.fullName || req.user.username,
                        plusOnesInt,
                        notes,
                        confirmationCode
                    ]);

                    // Add to success list
                    checkedIn.push({
                        guestId,
                        guestName: `${guest.first_name} ${guest.last_name}`,
                        confirmationCode,
                        plusOnes: plusOnesInt,
                        ticketType: guest.ticket_type
                    });

                } catch (err) {
                    // Handle individual guest errors
                    failed.push({
                        guestId,
                        reason: err.message,
                        error: 'PROCESSING_ERROR'
                    });
                }
            }

            // If any guest failed, rollback entire transaction (all or nothing)
            if (failed.length > 0) {
                await client.query('ROLLBACK');

                warn('Bulk check-in failed - rolled back', {
                    username: req.user.username,
                    totalRequested: guests.length,
                    failedCount: failed.length,
                    failed
                });

                return res.status(400).json({
                    success: false,
                    error: 'Bulk Check-In Failed',
                    message: `${failed.length} guest(s) could not be checked in. Transaction rolled back.`,
                    data: {
                        checkedIn: [],
                        failed,
                        totalRequested: guests.length
                    }
                });
            }

            // All successful - commit transaction
            await client.query('COMMIT');

            // Invalidate all guest-related caches
            cache.clearPattern('guests:*');

            info('Bulk check-in completed successfully', {
                username: req.user.username,
                totalCheckedIn: checkedIn.length,
                guestIds: checkedIn.map(g => g.guestId)
            });

            return res.status(200).json({
                success: true,
                message: `Successfully checked in ${checkedIn.length} guest(s)`,
                data: {
                    checkedIn,
                    failed: [],
                    totalRequested: guests.length,
                    totalSuccessful: checkedIn.length
                }
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        logError('Error in bulk check-in', {
            error: err.message,
            stack: err.stack,
            body: req.body,
            username: req.user?.username
        });

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to process bulk check-in'
        });
    }
}