import db from '../../services/database.js';
import authService from '../../services/auth.js';
import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import { info, warn, error as logError } from '../../../utils/logger.js';

/**
 * PUT /api/admin/ushers/:id
 * Update usher details (Admin only)
 * 
 * URL params:
 * - id: Usher ID (e.g., U1, U2)
 * 
 * Body params (all optional):
 * - fullName: Full name
 * - role: Role ('Usher' or 'Admin')
 * - active: Active status (true/false)
 * - password: New password (min 8 characters)
 * 
 * Returns: Updated usher (without password hash)
 */

export default async function handler(req, res) {
    // Only allow PUT requests
    if (req.method !== 'PUT') {
        return res.status(405).json({
            success: false,
            error: 'Method Not Allowed',
            message: 'Only PUT requests are allowed'
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

        // Extract update fields from request body
        const { fullName, role, active, password } = req.body;

        // Check if usher exists
        const checkQuery = `
      SELECT usher_id, username, full_name, role, active
      FROM ushers
      WHERE usher_id = $1
    `;

        const checkResult = await db.query(checkQuery, [usherId]);

        if (checkResult.rows.length === 0) {
            warn('Usher update failed: Usher not found', {
                username: req.user.username,
                usherId
            });

            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: `Usher with ID "${usherId}" not found`
            });
        }

        const currentUsher = checkResult.rows[0];

        // Prevent admin from deactivating themselves
        if (active === false && currentUsher.usher_id === req.user.usherId) {
            warn('Usher update failed: Cannot deactivate yourself', {
                username: req.user.username,
                usherId
            });

            return res.status(400).json({
                success: false,
                error: 'Invalid Operation',
                message: 'You cannot deactivate your own account'
            });
        }

        // Validation
        const errors = {};

        if (fullName !== undefined && fullName.trim() === '') {
            errors.fullName = 'Full name cannot be empty';
        }

        if (role !== undefined && !['Usher', 'Admin'].includes(role)) {
            errors.role = 'Role must be either "Usher" or "Admin"';
        }

        if (active !== undefined && typeof active !== 'boolean') {
            errors.active = 'Active must be true or false';
        }

        if (password !== undefined && password.length < 8) {
            errors.password = 'Password must be at least 8 characters';
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Invalid input data',
                details: errors
            });
        }

        // Build dynamic UPDATE query
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (fullName !== undefined) {
            updates.push(`full_name = $${paramIndex}`);
            params.push(fullName.trim());
            paramIndex++;
        }

        if (role !== undefined) {
            updates.push(`role = $${paramIndex}`);
            params.push(role);
            paramIndex++;
        }

        if (active !== undefined) {
            updates.push(`active = $${paramIndex}`);
            params.push(active);
            paramIndex++;
        }

        if (password !== undefined) {
            const passwordHash = await authService.hashPassword(password);
            updates.push(`password_hash = $${paramIndex}`);
            params.push(passwordHash);
            paramIndex++;
        }

        // If no updates provided, return error
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'No update fields provided',
                details: { fields: 'At least one field (fullName, role, active, password) is required' }
            });
        }

        // Add usher ID as last parameter
        params.push(usherId);

        // Execute update
        const updateQuery = `
      UPDATE ushers
      SET ${updates.join(', ')}
      WHERE usher_id = $${paramIndex}
      RETURNING 
        usher_id,
        username,
        full_name,
        role,
        active,
        created_at,
        last_login
    `;

        const updateResult = await db.query(updateQuery, params);
        const updatedUsher = updateResult.rows[0];

        info('Usher updated', {
            adminUsername: req.user.username,
            usherId,
            updates: {
                fullName: fullName !== undefined,
                role: role !== undefined,
                active: active !== undefined,
                password: password !== undefined
            }
        });

        return res.status(200).json({
            success: true,
            message: `Usher "${currentUsher.username}" updated successfully`,
            data: {
                usher: updatedUsher
            }
        });

    } catch (err) {
        logError('Error updating usher', {
            error: err.message,
            stack: err.stack,
            body: req.body,
            usherId: req.query.id,
            username: req.user?.username
        });

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to update usher'
        });
    }
}