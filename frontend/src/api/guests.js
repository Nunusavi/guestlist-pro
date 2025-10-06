import apiClient from './client';

/**
 * Guest Management API Methods
 * Handles all guest-related API calls
 */

/**
 * Get paginated list of guests with optional filters
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.limit - Items per page (default: 50)
 * @param {string} params.status - Filter by status: 'checked-in' | 'not-checked-in'
 * @param {string} params.ticketType - Filter by ticket type: 'VIP' | 'General'
 * @returns {Promise<{guests: Array, pagination: Object}>}
 */
export const getGuests = async (params = {}) => {
    try {
        const {
            page = 1,
            limit = 50,
            status = '',
            ticketType = ''
        } = params;

        const queryParams = new URLSearchParams();
        queryParams.append('page', page);
        queryParams.append('limit', limit);
        if (status) queryParams.append('status', status);
        if (ticketType) queryParams.append('ticketType', ticketType);

        const response = await apiClient.get(`/api/guests?${queryParams.toString()}`);

        return response.data;
    } catch (error) {
        console.error('[Get Guests Error]', error);
        throw error;
    }
};

/**
 * Search guests by name, email, phone, or confirmation code
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of matching guests
 */
export const searchGuests = async (query) => {
    try {
        if (!query || !query.trim()) {
            return [];
        }

        const response = await apiClient.post('/api/guests/search', {
            query: query.trim()
        });

        return response.data.guests || [];
    } catch (error) {
        console.error('[Search Guests Error]', error);
        throw error;
    }
};

/**
 * Get single guest by ID with check-in history
 * @param {number} guestId - Guest ID
 * @returns {Promise<Object>} Guest object with history
 */
export const getGuestById = async (guestId) => {
    try {
        const response = await apiClient.get(`/api/guests/${guestId}`);
        return response.data.guest;
    } catch (error) {
        console.error('[Get Guest By ID Error]', error);
        throw error;
    }
};

/**
 * Check in a guest
 * @param {Object} data - Check-in data
 * @param {number} data.guestId - Guest ID
 * @param {number} data.plusOnes - Number of plus-ones (0 to max allowed)
 * @param {string} data.notes - Optional notes
 * @returns {Promise<Object>} Updated guest with confirmation code
 */
export const checkInGuest = async (data) => {
    try {
        const { guestId, plusOnes = 0, notes = '' } = data;

        if (!guestId) {
            throw new Error('Guest ID is required');
        }

        const response = await apiClient.post('/api/guests/check-in', {
            guestId,
            plusOnes,
            notes
        });

        return response.data.guest;
    } catch (error) {
        console.error('[Check-In Guest Error]', error);

        // Handle specific error cases
        if (error.response?.status === 400) {
            if (error.response.data.error?.includes('already checked in')) {
                throw new Error('This guest is already checked in');
            }
            if (error.response.data.error?.includes('plus-ones')) {
                throw new Error('Plus-ones count exceeds allowed limit');
            }
        }

        throw error;
    }
};

/**
 * Undo a guest check-in (within 30 seconds)
 * @param {number} guestId - Guest ID
 * @returns {Promise<Object>} Updated guest
 */
export const undoCheckIn = async (guestId) => {
    try {
        if (!guestId) {
            throw new Error('Guest ID is required');
        }

        const response = await apiClient.post('/api/guests/undo-check-in', {
            guestId
        });

        return response.data.guest;
    } catch (error) {
        console.error('[Undo Check-In Error]', error);

        if (error.response?.status === 400) {
            if (error.response.data.error?.includes('30 seconds')) {
                throw new Error('Undo window expired. Check-in was more than 30 seconds ago.');
            }
            if (error.response.data.error?.includes('not checked in')) {
                throw new Error('This guest is not checked in');
            }
        }

        throw error;
    }
};

/**
 * Bulk check-in multiple guests (max 50)
 * @param {Object} data - Bulk check-in data
 * @param {Array<{guestId: number, plusOnes: number, notes: string}>} data.guests
 * @returns {Promise<Object>} Result with success/failure counts
 */
export const bulkCheckIn = async (data) => {
    try {
        const { guests } = data;

        if (!guests || !Array.isArray(guests) || guests.length === 0) {
            throw new Error('Guests array is required');
        }

        if (guests.length > 50) {
            throw new Error('Maximum 50 guests can be checked in at once');
        }

        const response = await apiClient.post('/api/guests/bulk-check-in', {
            guests
        });

        return response.data;
    } catch (error) {
        console.error('[Bulk Check-In Error]', error);
        throw error;
    }
};

/**
 * Get guest statistics (for quick stats display)
 * @returns {Promise<Object>} Stats object
 */
export const getGuestStats = async () => {
    try {
        // This will use the admin stats endpoint but filter for guest-relevant data
        const response = await apiClient.get('/api/admin/stats');

        return {
            total: response.data.totalGuests,
            checkedIn: response.data.checkedInCount,
            percentage: response.data.checkInPercentage,
            plusOnesTotal: response.data.plusOnesAllowed || 0,
            plusOnesCheckedIn: response.data.plusOnesCheckedIn || 0
        };
    } catch (error) {
        console.error('[Get Guest Stats Error]', error);
        throw error;
    }
};