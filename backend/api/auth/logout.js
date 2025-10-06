import { info } from '../../utils/logger.js';

/**
 * Logout API
 * POST /api/auth/logout
 * 
 * Logs out user (client-side token removal)
 * Requires authentication middleware
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method Not Allowed',
            allowedMethods: ['POST'],
        });
    }

    try {
        // Log the logout
        info('User logged out', {
            username: req.user?.username || 'unknown'
        });

        // Note: With JWT, we don't maintain server-side sessions
        // The client must remove the token from storage
        // For token blacklisting, we would add the token to a blacklist here

        return res.status(200).json({
            success: true,
            message: 'Logout successful',
            data: {
                instruction: 'Remove token from client storage',
            },
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'An error occurred during logout',
        });
    }
}