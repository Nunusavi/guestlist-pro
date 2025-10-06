import db from '../../services/database.js';
import authService from '../../services/auth.js';
import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import { info, warn, error as logError } from '../../../utils/logger.js';

/**
 * POST /api/admin/ushers
 * Create new usher account (Admin only)
 * 
 * Body params:
 * - username: Unique username (required, alphanumeric + underscore)
 * - password: Password (required, min 8 characters)
 * - fullName: Full name (required)
 * - role: Role (required, 'Usher' or 'Admin')
 * 
 * Returns: Created usher (without password hash)
 */

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

        // Extract and validate request body
        const { username, password, fullName, role } = req.body;

        // Validation
        const errors = {};

        if (!username || username.trim() === '') {
            errors.username = 'Username is required';
        } else if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
            errors.username = 'Username must be 3-30 characters (alphanumeric and underscore only)';
        }

        if (!password || password.length < 8) {
            errors.password = 'Password must be at least 8 characters';
        }

        if (!fullName || fullName.trim() === '') {
            errors.fullName = 'Full name is required';
        }

        if (!role || !['Usher', 'Admin'].includes(role)) {
            errors.role = 'Role must be either "Usher" or "Admin"';
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Invalid input data',
                details: errors
            });
        }

        // Check if username already exists
        const checkQuery = `
      SELECT usher_id 
      FROM ushers 
      WHERE LOWER(username) = LOWER($1)
    `;

        const checkResult = await db.query(checkQuery, [username]);

        if (checkResult.rows.length > 0) {
            warn('Usher creation failed: Username already exists', {
                username: req.user.username,
                attemptedUsername: username
            });

            return res.status(409).json({
                success: false,
                error: 'Conflict',
                message: `Username "${username}" is already taken`,
                details: { field: 'username' }
            });
        }

        // Hash password
        const passwordHash = await authService.hashPassword(password);

        // Generate next usher ID
        const maxIdQuery = `
      SELECT COALESCE(MAX(CAST(SUBSTRING(usher_id FROM 2) AS INTEGER)), 0) as max_num
      FROM ushers
      WHERE usher_id ~ '^U[0-9]+$'
    `;

        const maxIdResult = await db.query(maxIdQuery);
        const nextNum = parseInt(maxIdResult.rows[0].max_num) + 1;
        const usherId = `U${nextNum}`;

        // Insert new usher
        const insertQuery = `
      INSERT INTO ushers (
        usher_id,
        username,
        password_hash,
        full_name,
        role,
        active,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, true, NOW())
      RETURNING 
        usher_id,
        username,
        full_name,
        role,
        active,
        created_at
    `;

        const insertResult = await db.query(insertQuery, [
            usherId,
            username.trim(),
            passwordHash,
            fullName.trim(),
            role
        ]);

        const newUsher = insertResult.rows[0];

        info('New usher created', {
            adminUsername: req.user.username,
            newUsher: {
                usherId: newUsher.usher_id,
                username: newUsher.username,
                fullName: newUsher.full_name,
                role: newUsher.role
            }
        });

        return res.status(201).json({
            success: true,
            message: `Usher "${username}" created successfully`,
            data: {
                usher: newUsher
            }
        });

    } catch (err) {
        logError('Error creating usher', {
            error: err.message,
            stack: err.stack,
            body: req.body,
            username: req.user?.username
        });

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to create usher'
        });
    }
}