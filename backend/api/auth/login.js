import db from '../services/database.js';
import authService from '../services/auth.js';
import { info, warn, error as logError } from '../../utils/logger.js';

/**
 * Login API
 * POST /api/auth/login
 * 
 * Authenticates user and returns JWT token
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
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            warn('Login attempt with missing credentials');
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Username and password are required',
            });
        }

        // Get usher from database
        const usher = await db.getUsherByUsername(username);

        if (!usher) {
            warn('Login attempt for non-existent user', { username });

            // Don't reveal if user exists or not
            return res.status(401).json({
                success: false,
                error: 'Authentication Failed',
                message: 'Invalid username or password',
            });
        }

        // Check if account is active
        if (!usher.active) {
            warn('Login attempt for inactive account', { username });
            return res.status(401).json({
                success: false,
                error: 'Account Inactive',
                message: 'Your account has been deactivated',
            });
        }

        // Verify password
        const isValidPassword = await authService.verifyPassword(
            password,
            usher.password_hash
        );

        if (!isValidPassword) {
            warn('Login attempt with incorrect password', { username });
            return res.status(401).json({
                success: false,
                error: 'Authentication Failed',
                message: 'Invalid username or password',
            });
        }

        // Update last login time
        await db.updateUsherLastLogin(usher.usher_id);

        // Generate JWT token
        const tokenPayload = {
            usherId: usher.usher_id,
            username: usher.username,
            fullName: usher.full_name,
            role: usher.role,
        };

        const token = authService.generateToken(tokenPayload);
        const refreshToken = authService.generateRefreshToken(tokenPayload);

        info('User logged in successfully', {
            username,
            role: usher.role
        });

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                refreshToken,
                user: {
                    usherId: usher.usher_id,
                    username: usher.username,
                    fullName: usher.full_name,
                    role: usher.role,
                },
            },
        });

    } catch (err) {
        logError('Login error', err);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'An error occurred during login',
        });
    }
}