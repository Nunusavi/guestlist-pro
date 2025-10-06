import db from '../../services/database.js';
import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import { info, error as logError } from '../../../utils/logger.js';

/**
 * GET /api/admin/ushers
 * List all ushers (Admin only)
 * 
 * Returns:
 * - All usher accounts (excluding password hashes)
 * - Sorted by full name
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

        // Fetch all ushers (exclude password_hash for security)
        const query = `
      SELECT 
        usher_id,
        username,
        full_name,
        role,
        active,
        created_at,
        last_login
      FROM ushers
      ORDER BY full_name ASC
    `;

        const result = await db.query(query);

        info('Ushers list fetched', {
            username: req.user.username,
            count: result.rows.length
        });

        return res.status(200).json({
            success: true,
            data: {
                ushers: result.rows,
                total: result.rows.length
            }
        });

    } catch (err) {
        logError('Error fetching ushers list', {
            error: err.message,
            stack: err.stack,
            username: req.user?.username
        });

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to fetch ushers list'
        });
    }
}