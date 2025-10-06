import apiClient from './client';

/**
 * Authentication API Methods
 * Handles all authentication-related API calls
 */

/**
 * Login user and get JWT token
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Promise<{user: Object, token: string}>}
 */
export const login = async (username, password) => {
    try {
        console.log('[API Auth] Attempting login for:', username);

        const response = await apiClient.post('/api/auth/login', {
            username,
            password,
        });

        console.log('[API Auth] Login response:', response.data);

        // FIX: Extract from response.data.data
        const { token, user } = response.data.data || {};

        if (!token || !user) {
            return { success: false, user: null };
        }

        // Store token and user data in localStorage
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));

        console.log('[API Auth] Login successful, user role:', user.role);

        return { success: true, token, user };
    } catch (error) {
        console.error('[Login Error]', error);

        // Better error messages
        if (error.response?.status === 401) {
            throw new Error('Invalid username or password');
        } else if (error.response?.status === 429) {
            throw new Error('Too many login attempts. Please try again later.');
        } else if (!error.response) {
            throw new Error('Cannot connect to server. Please check your connection.');
        }

        throw error;
    }
};

/**
 * Verify if current token is valid
 * @returns {Promise<{valid: boolean, user: Object}>}
 */
export const verifyToken = async () => {
    try {
        const response = await apiClient.get('/api/auth/verify');

        const { user } = response.data;

        // Update user data in localStorage
        if (user) {
            localStorage.setItem('auth_user', JSON.stringify(user));
        }

        return { valid: true, user };
    } catch (error) {
        console.error('[Token Verification Error]', error);

        // Clear invalid token
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');

        return { valid: false, user: null };
    }
};

/**
 * Logout user and invalidate token
 * @returns {Promise<void>}
 */
export const logout = async () => {
    try {
        // Call logout endpoint to invalidate token on server
        await apiClient.post('/api/auth/logout');
    } catch (error) {
        console.error('[Logout Error]', error);
        // Continue with local cleanup even if server call fails
    } finally {
        // Always clear local storage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    }
};

/**
 * Get current user from localStorage
 * @returns {Object|null} User object or null if not logged in
 */
export const getCurrentUser = () => {
    try {
        const userJson = localStorage.getItem('auth_user');
        return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
        console.error('[Get Current User Error]', error);
        return null;
    }
};

/**
 * Get current token from localStorage
 * @returns {string|null} JWT token or null if not logged in
 */
export const getToken = () => {
    return localStorage.getItem('auth_token');
};

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export const isAuthenticated = () => {
    const token = getToken();
    const user = getCurrentUser();
    return !!(token && user);
};

/**
 * Check if current user is admin
 * @returns {boolean}
 */
export const isAdmin = () => {
    const user = getCurrentUser();
    return user?.role === 'Admin';
};

/**
 * Check if current user is usher
 * @returns {boolean}
 */
export const isUsher = () => {
    const user = getCurrentUser();
    return user?.role === 'Usher';
};