import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto'; // Added import
import { info, warn, error as logError } from '../../utils/logger.js';

/**
 * Authentication Service
 * Handles password hashing, JWT generation, and verification
 */
class AuthService {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET;
        this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
        this.saltRounds = 10;

        if (!this.jwtSecret) {
            if (process.env.NODE_ENV !== 'production') {
                warn('JWT_SECRET missing. Using ephemeral development secret (DO NOT USE IN PRODUCTION).');
                this.jwtSecret = crypto.randomBytes(48).toString('hex');
            } else {
                throw new Error('JWT_SECRET is required in production');
            }
        } else if (this.jwtSecret.length < 32) {
            if (process.env.NODE_ENV !== 'production') {
                warn('JWT_SECRET too short (<32). Deriving stronger ephemeral secret for development.');
                this.jwtSecret = crypto
                    .createHash('sha256')
                    .update(this.jwtSecret + Date.now().toString())
                    .digest('hex');
            } else {
                throw new Error('JWT_SECRET must be at least 32 characters long');
            }
        }
    }

    /**
     * Hash a password
     * @param {string} password - Plain text password
     * @returns {Promise<string>} Hashed password
     */
    async hashPassword(password) {
        try {
            const hash = await bcrypt.hash(password, this.saltRounds);
            info('Password hashed successfully');
            return hash;
        } catch (err) {
            logError('Password hashing failed', err);
            throw new Error('Failed to hash password');
        }
    }

    /**
     * Verify a password against a hash
     * @param {string} password - Plain text password
     * @param {string} hash - Hashed password
     * @returns {Promise<boolean>} True if password matches
     */
    async verifyPassword(password, hash) {
        try {
            const isValid = await bcrypt.compare(password, hash);

            if (isValid) {
                info('Password verification successful');
            } else {
                warn('Password verification failed');
            }

            return isValid;
        } catch (err) {
            logError('Password verification error', err);
            return false;
        }
    }

    /**
     * Generate JWT token
     * @param {object} payload - Token payload (user data)
     * @returns {string} JWT token
     */
    generateToken(payload) {
        try {
            const token = jwt.sign(payload, this.jwtSecret, {
                expiresIn: this.jwtExpiry,
                issuer: 'guestlist-pro',
            });

            info('JWT token generated', {
                userId: payload.usherId,
                role: payload.role
            });

            return token;
        } catch (err) {
            logError('Token generation failed', err);
            throw new Error('Failed to generate token');
        }
    }

    /**
     * Verify JWT token
     * @param {string} token - JWT token
     * @returns {object|null} Decoded payload or null
     */
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret, {
                issuer: 'guestlist-pro',
            });

            info('JWT token verified', { userId: decoded.usherId });
            return decoded;
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                warn('Token expired', { expiredAt: err.expiredAt });
            } else if (err.name === 'JsonWebTokenError') {
                warn('Invalid token', { message: err.message });
            } else {
                logError('Token verification error', err);
            }

            return null;
        }
    }

    /**
     * Decode token without verification (for debugging)
     * @param {string} token - JWT token
     * @returns {object|null} Decoded payload or null
     */
    decodeToken(token) {
        try {
            return jwt.decode(token);
        } catch (err) {
            logError('Token decoding failed', err);
            return null;
        }
    }

    /**
     * Generate refresh token (longer expiry)
     * @param {object} payload - Token payload
     * @returns {string} Refresh token
     */
    generateRefreshToken(payload) {
        try {
            const token = jwt.sign(payload, this.jwtSecret, {
                expiresIn: '7d',
                issuer: 'guestlist-pro-refresh',
            });

            info('Refresh token generated', { userId: payload.usherId });
            return token;
        } catch (err) {
            logError('Refresh token generation failed', err);
            throw new Error('Failed to generate refresh token');
        }
    }

    /**
     * Extract token from Authorization header
     * @param {string} authHeader - Authorization header value
     * @returns {string|null} Token or null
     */
    extractToken(authHeader) {
        if (!authHeader) return null;
        const parts = authHeader.split(' ');
        return (parts.length === 2 && parts[0] === 'Bearer') ? parts[1] : authHeader;
    }
}

const authService = new AuthService();
export default authService;