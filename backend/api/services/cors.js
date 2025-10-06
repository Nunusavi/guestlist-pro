import { info, warn } from '../../utils/logger.js';

/**
 * Custom CORS Middleware
 * More control than the cors package
 */

export function corsMiddleware(req, res, next) {
    const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'http://localhost:5173',
        'http://localhost:3000',
    ];

    const origin = req.headers.origin;

    // Check if origin is allowed
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (origin) {
        warn('CORS blocked', { origin, allowed: allowedOrigins });
    }

    // Allowed methods
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    // Allowed headers
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
    );

    // Cache preflight requests for 1 hour
    res.setHeader('Access-Control-Max-Age', '3600');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        info('CORS preflight', { origin, method: req.headers['access-control-request-method'] });
        return res.status(204).end();
    }

    next();
}

export default corsMiddleware;