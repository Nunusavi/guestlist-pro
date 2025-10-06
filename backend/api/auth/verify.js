import { info } from '../../utils/logger.js';

/**
 * Verify Token API
 * GET /api/auth/verify
 * 
 * Verifies JWT token and returns user info
 * Requires authentication middleware
 */

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method Not Allowed',
            allowedMethods: ['GET'],
        });
    }

    try {
        // User is already authenticated by middleware
        // req.user is populated by authenticate middleware

        info('Token verified', { username: req.user.username });

        return res.status(200).json({
            success: true,
            message: 'Token is valid',
            data: {
                user: {
                    usherId: req.user.usherId,
                    username: req.user.username,
                    fullName: req.user.fullName,
                    role: req.user.role,
                },
            },
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'An error occurred during verification',
        });
    }
}