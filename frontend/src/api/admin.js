import apiClient from './client';

/**
 * Admin API Methods
 * Admin-only endpoints for dashboard, audit, user management, and exports
 */

/**
 * Get admin dashboard statistics
 * @returns {Promise<Object>} Dashboard statistics
 */
export const getAdminStats = async () => {
    try {
        const response = await apiClient.get('/api/admin/stats');
        return response.data;
    } catch (error) {
        console.error('[Get Admin Stats Error]', error);
        throw error;
    }
};

/**
 * Get audit log with filters
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @param {number} params.guestId - Filter by guest ID
 * @param {string} params.action - Filter by action type
 * @param {number} params.usherId - Filter by usher ID
 * @param {string} params.startDate - Filter by start date
 * @param {string} params.endDate - Filter by end date
 * @returns {Promise<Object>} Audit log with pagination
 */
export const getAuditLog = async (params = {}) => {
    try {
        const queryParams = new URLSearchParams();

        Object.keys(params).forEach(key => {
            if (params[key]) {
                queryParams.append(key, params[key]);
            }
        });

        const response = await apiClient.get(`/api/admin/audit-log?${queryParams.toString()}`);
        return response.data;
    } catch (error) {
        console.error('[Get Audit Log Error]', error);
        throw error;
    }
};

/**
 * Export guests to CSV
 * @param {Object} filters - Export filters
 * @param {string} filters.status - Filter by status
 * @param {string} filters.ticketType - Filter by ticket type
 * @param {string} filters.startDate - Filter by check-in start date
 * @param {string} filters.endDate - Filter by check-in end date
 * @returns {Promise<Blob>} CSV file as blob
 */
export const exportGuests = async (filters = {}) => {
    try {
        const response = await apiClient.post('/api/admin/export', filters, {
            responseType: 'blob'
        });

        return response.data;
    } catch (error) {
        console.error('[Export Guests Error]', error);
        throw error;
    }
};

/**
 * Get all ushers
 * @returns {Promise<Array>} List of ushers
 */
export const getUshers = async () => {
    try {
        const response = await apiClient.get('/api/admin/ushers');
        return response.data.ushers || [];
    } catch (error) {
        console.error('[Get Ushers Error]', error);
        throw error;
    }
};

/**
 * Create new usher
 * @param {Object} data - Usher data
 * @param {string} data.username - Username
 * @param {string} data.password - Password
 * @param {string} data.fullName - Full name
 * @param {string} data.role - Role (Usher or Admin)
 * @returns {Promise<Object>} Created usher
 */
export const createUsher = async (data) => {
    try {
        const response = await apiClient.post('/api/admin/ushers', data);
        return response.data.usher;
    } catch (error) {
        console.error('[Create Usher Error]', error);

        if (error.response?.status === 409) {
            throw new Error('Username already exists');
        }

        throw error;
    }
};

/**
 * Update usher
 * @param {number} usherId - Usher ID
 * @param {Object} data - Update data
 * @param {string} data.fullName - Full name
 * @param {string} data.password - New password (optional)
 * @param {string} data.role - Role
 * @returns {Promise<Object>} Updated usher
 */
export const updateUsher = async (usherId, data) => {
    try {
        const response = await apiClient.put(`/api/admin/ushers/${usherId}`, data);
        return response.data.usher;
    } catch (error) {
        console.error('[Update Usher Error]', error);
        throw error;
    }
};

/**
 * Delete/deactivate usher
 * @param {number} usherId - Usher ID
 * @returns {Promise<Object>} Success message
 */
export const deleteUsher = async (usherId) => {
    try {
        const response = await apiClient.delete(`/api/admin/ushers/${usherId}`);
        return response.data;
    } catch (error) {
        console.error('[Delete Usher Error]', error);

        if (error.response?.status === 403) {
            if (error.response.data.error?.includes('yourself')) {
                throw new Error('You cannot delete yourself');
            }
            if (error.response.data.error?.includes('last admin')) {
                throw new Error('Cannot delete the last admin user');
            }
        }

        throw error;
    }
};

/**
 * Download exported CSV
 * @param {Blob} blob - CSV blob
 * @param {string} filename - File name
 */
export const downloadCSV = (blob, filename = 'guests-export.csv') => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};