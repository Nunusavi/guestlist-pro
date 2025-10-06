import axios from 'axios';

/**
 * API Client Configuration
 * Centralized Axios instance with interceptors for authentication and error handling
 */

// Create axios instance with base configuration
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 second timeout
});

/**
 * Request Interceptor
 * Automatically adds JWT token to all requests
 */
apiClient.interceptors.request.use(
    (config) => {
        // Get token from localStorage
        const token = localStorage.getItem('auth_token');

        // Add token to Authorization header if it exists
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Log request in development
        if (import.meta.env.DEV) {
            console.log(`[API Request] ${config.method.toUpperCase()} ${config.url}`, {
                params: config.params,
                data: config.data,
            });
        }

        return config;
    },
    (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
    }
);

/**
 * Response Interceptor
 * Handles errors globally and manages token expiration
 */
apiClient.interceptors.response.use(
    (response) => {
        // Log response in development
        if (import.meta.env.DEV) {
            console.log(`[API Response] ${response.config.method.toUpperCase()} ${response.config.url}`, {
                status: response.status,
                data: response.data,
            });
        }

        return response;
    },
    (error) => {
        // Handle network errors
        if (!error.response) {
            console.error('[Network Error]', error);
            return Promise.reject({
                message: 'Network error. Please check your connection.',
                type: 'network',
                originalError: error,
            });
        }

        const { status, data } = error.response;

        // Handle 401 Unauthorized - Token expired or invalid
        if (status === 401) {
            console.warn('[Auth Error] Unauthorized - clearing session');

            // Clear auth data
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');

            // Redirect to login (only if not already on login page)
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }

            return Promise.reject({
                message: 'Your session has expired. Please login again.',
                type: 'auth',
                status: 401,
            });
        }

        // Handle 403 Forbidden - Insufficient permissions
        if (status === 403) {
            return Promise.reject({
                message: data.error || 'You do not have permission to perform this action.',
                type: 'forbidden',
                status: 403,
            });
        }

        // Handle 404 Not Found
        if (status === 404) {
            return Promise.reject({
                message: data.error || 'Resource not found.',
                type: 'not_found',
                status: 404,
            });
        }

        // Handle 429 Too Many Requests
        if (status === 429) {
            return Promise.reject({
                message: 'Too many requests. Please slow down.',
                type: 'rate_limit',
                status: 429,
            });
        }

        // Handle 500 Server Error
        if (status >= 500) {
            return Promise.reject({
                message: 'Server error. Please try again later.',
                type: 'server_error',
                status,
            });
        }

        // Handle other errors
        return Promise.reject({
            message: data.error || 'An error occurred. Please try again.',
            type: 'api_error',
            status,
            data,
        });
    }
);

/**
 * Helper function to handle API errors consistently
 * @param {Error} error - Error object from API call
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (error) => {
    if (error.message) {
        return error.message;
    }

    if (error.response?.data?.error) {
        return error.response.data.error;
    }

    return 'An unexpected error occurred. Please try again.';
};

/**
 * Helper function to check if error is auth-related
 * @param {Error} error - Error object
 * @returns {boolean}
 */
export const isAuthError = (error) => {
    return error.type === 'auth' || error.status === 401;
};

export default apiClient;