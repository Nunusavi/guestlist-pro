import authService from '../services/auth.js';
import { info, warn } from '../../utils/logger.js';

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */

export function authenticate(req, res, next) {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authService.extractToken(authHeader);

        if (!token) {
            warn('Authentication failed: No token provided');
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'No authentication token provided',
            });
        }

        // Verify token
        const decoded = authService.verifyToken(token);

        if (!decoded) {
            warn('Authentication failed: Invalid token');
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Invalid or expired token',
            });
        }

        // Attach user to request
        req.user = {
            usherId: decoded.usherId,
            username: decoded.username,
            fullName: decoded.fullName,
            role: decoded.role,
        };

        info('User authenticated', {
            username: req.user.username,
            role: req.user.role
        });

        next();

    } catch (err) {
        warn('Authentication error', err);
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Authentication failed',
        });
    }
}

/**
 * Require Admin Role Middleware
 * Must be used after authenticate middleware
 */
export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Authentication required',
        });
    }

    if (req.user.role !== 'Admin') {
        warn('Admin access denied', {
            username: req.user.username,
            role: req.user.role
        });

        return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'Admin access required',
        });
    }

    info('Admin access granted', { username: req.user.username });
    next();
}

/**
 * Optional Authentication Middleware
 * Attaches user if token is valid, but doesn't require it
 */
export function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authService.extractToken(authHeader);

        if (token) {
            const decoded = authService.verifyToken(token);

            if (decoded) {
                req.user = {
                    usherId: decoded.usherId,
                    username: decoded.username,
                    fullName: decoded.fullName,
                    role: decoded.role,
                };
            }
        }

        next();

    } catch (err) {
        // Continue without authentication
        next();
    }
}

export default authenticate;