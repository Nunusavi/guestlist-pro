const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Enhanced fetcher that automatically includes the auth token
async function fetcher(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;

    // Get token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('guestlist_token') : null;

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
    };

    let response;
    try {
        response = await fetch(url, config);
    } catch (error) {
        throw new Error("Network error, please try again.");
    }

    let data;
    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (!response.ok) {
        if (response.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('guestlist_user');
            localStorage.removeItem('guestlist_token');
            localStorage.removeItem('guestlist_refresh_token');

            window.dispatchEvent(new CustomEvent('guestlist:auth-forced-logout', {
                detail: {
                    reason: data?.message || 'Unauthorized',
                },
            }));
        }

        const error = new Error(data?.message || 'An error occurred.');
        error.status = response.status;
        error.body = data;
        throw error;
    }

    // Your backend might wrap responses in a 'data' object.
    // This handles both cases: { "data": ... } and { ... }
    return data.data || data;
}

// --- Auth Endpoints ---
export const apiLogin = async (username, password) => {
    const response = await fetcher('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
    return response;
};

// --- Guest Management Endpoints (NEW) ---
export const apiSearchGuests = async (searchTerm) => {
    return fetcher('/api/guests/search', {
        method: 'POST',
        body: JSON.stringify({ query: searchTerm }),
    });
};
export const apiGetGuests = async (params = {}) => {
    // params can include { page = 1, limit = 20, status = '', ticketType = '' }
    const query = new URLSearchParams(params).toString();
    return fetcher(`/api/guests?${query}`);
};

export const apiCheckInGuest = async (guestId, plusOnes, notes = '') => {
    const rawId = guestId != null ? String(guestId).trim() : '';

    if (!rawId) {
        throw new Error('A valid guest ID is required to check-in a guest.');
    }

    const plusOnesInt = Number.parseInt(plusOnes, 10);
    const normalizedPlusOnes = Number.isNaN(plusOnesInt) || plusOnesInt < 0 ? 0 : plusOnesInt;

    return fetcher('/api/guests/check-in', {
        method: 'POST',
        body: JSON.stringify({ guestId: rawId, plusOnes: normalizedPlusOnes, notes }),
    });
};

export const apiUndoCheckIn = async (confirmationCode) => {
    return fetcher('/api/guests/undo-check-in', {
        method: 'POST',
        body: JSON.stringify({ confirmationCode }),
    });
};
export const apiGetStats = async () => {
    return fetcher('/api/admin/stats');
};

export const apiGetUshers = async () => {
    return fetcher('/api/admin/ushers');
};

export const apiCreateUsher = async (userData) => {
    return fetcher('/api/admin/ushers', {
        method: 'POST',
        body: JSON.stringify(userData),
    });
};

export const apiUpdateUsher = async (userId, userData) => {
    return fetcher(`/api/admin/ushers/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
    });
};

export const apiDeactivateUsher = async (userId) => {
    return fetcher(`/api/admin/ushers/${userId}`, {
        method: 'DELETE',
    });
};