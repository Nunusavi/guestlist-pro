import db from '../../services/database.js';
import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import { info, warn, error as logError } from '../../../utils/logger.js';

/**
 * DELETE /api/admin/ushers/:id
 * Deactivate usher account (Admin only)
 * 
 * URL params:
 * - id: Usher ID (e.g., U1, U2)
 * 
 * Notes:
 * - Sets active = false (soft delete)
 * - Cannot delete yourself
 * - Cannot delete last admin
 * 
 * Returns: Success message
 */

export default async function handler(req, res) {
    // Only allow DELETE requests
    if (req.method !== 'DELETE') {
        return res.status(405).json({
            success: false,
            error: 'Method Not Allowed',
            message: 'Only DELETE requests are allowed'
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

        // Extract usher ID from URL params
        const usherId = req.query.id;

        if (!usherId) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Usher ID is required',
                details: { field: 'id' }
            });
        }

        // Check if usher exists
        const checkQuery = `
      SELECT usher_id, username, full_name, role, active
      FROM ushers
      WHERE usher_id = $1
    `;

        const checkResult = await db.query(checkQuery, [usherId]);

        if (checkResult.rows.length === 0) {
            warn('Usher delete failed: Usher not found', {
                username: req.user.username,
                usherId
            });

            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: `Usher with ID "${usherId}" not found`
            });
        }

        const targetUsher = checkResult.rows[0];

        // Prevent admin from deleting themselves
        if (targetUsher.usher_id === req.user.usherId) {
            warn('Usher delete failed: Cannot delete yourself', {
                username: req.user.username,
                usherId
            });

            return res.status(400).json({
                success: false,
                error: 'Invalid Operation',
                message: 'You cannot delete your own account'
            });
        }

        // If deleting an admin, check if they're the last admin
        if (targetUsher.role === 'Admin') {
            const adminCountQuery = `
        SELECT COUNT(*) as count
        FROM ushers
        WHERE role = 'Admin' AND active = true
      `;

            const adminCountResult = await db.query(adminCountQuery);
            const activeAdminCount = parseInt(adminCountResult.rows[0].count);

            if (activeAdminCount <= 1) {
                warn('Usher delete failed: Cannot delete last admin', {
                    username: req.user.username,
                    usherId,
                    targetUsername: targetUsher.username
                });

                return res.status(400).json({
                    success: false,
                    error: 'Invalid Operation',
                    message: 'Cannot delete the last active admin account',
                    details: {
                        reason: 'At least one admin account must remain active'
                    }
                });
            }
        }

        // Deactivate usher (soft delete)
        const deleteQuery = `
      UPDATE ushers
      SET active = false
      WHERE usher_id = $1
      RETURNING usher_id, username, full_name
    `;

        const deleteResult = await db.query(deleteQuery, [usherId]);
        const deletedUsher = deleteResult.rows[0];

        info('Usher deactivated', {
            adminUsername: req.user.username,
            deactivatedUsher: {
                usherId: deletedUsher.usher_id,
                username: deletedUsher.username,
                fullName: deletedUsher.full_name
            }
        });

        return res.status(200).json({
            success: true,
            message: `Usher "${deletedUsher.username}" has been deactivated`,
            data: {
                usherId: deletedUsher.usher_id,
                username: deletedUsher.username,
                fullName: deletedUsher.full_name
            }
        });

    } catch (err) {
        logError('Error deleting usher', {
            error: err.message,
            stack: err.stack,
            usherId: req.query.id,
            username: req.user?.username
        });

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to delete usher'
        });
    }
}