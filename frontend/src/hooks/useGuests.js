import { useState, useEffect, useCallback } from 'react';
import * as guestsApi from '../api/guests';

/**
 * Custom hook for managing guest data
 * Provides guest list, search, check-in functionality
 */
export function useGuests() {
    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
    });

    /**
     * Fetch guests with optional filters
     */
    const fetchGuests = useCallback(async (params = {}) => {
        setLoading(true);
        setError(null);

        try {
            const data = await guestsApi.getGuests(params);
            setGuests(data.guests || []);
            setPagination(data.pagination || pagination);
        } catch (err) {
            console.error('[Fetch Guests Error]', err);
            setError(err.message || 'Failed to load guests');
            setGuests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Search guests
     */
    const searchGuests = useCallback(async (query) => {
        if (!query || !query.trim()) {
            // If empty query, fetch all guests
            fetchGuests();
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const results = await guestsApi.searchGuests(query);
            setGuests(results);
            // Reset pagination for search results
            setPagination({
                page: 1,
                limit: results.length,
                total: results.length,
                totalPages: 1
            });
        } catch (err) {
            console.error('[Search Guests Error]', err);
            setError(err.message || 'Search failed');
            setGuests([]);
        } finally {
            setLoading(false);
        }
    }, [fetchGuests]);

    /**
     * Check in a guest
     */
    const checkIn = useCallback(async (guestId, plusOnes = 0, notes = '') => {
        setError(null);

        try {
            const updatedGuest = await guestsApi.checkInGuest({
                guestId,
                plusOnes,
                notes
            });

            // Update guest in local state
            setGuests(prev =>
                prev.map(g => g.id === guestId ? updatedGuest : g)
            );

            return { success: true, guest: updatedGuest };
        } catch (err) {
            console.error('[Check-In Error]', err);
            setError(err.message || 'Check-in failed');
            return { success: false, error: err.message };
        }
    }, []);

    /**
     * Undo check-in
     */
    const undoCheckIn = useCallback(async (guestId) => {
        setError(null);

        try {
            const updatedGuest = await guestsApi.undoCheckIn(guestId);

            // Update guest in local state
            setGuests(prev =>
                prev.map(g => g.id === guestId ? updatedGuest : g)
            );

            return { success: true, guest: updatedGuest };
        } catch (err) {
            console.error('[Undo Check-In Error]', err);
            setError(err.message || 'Undo failed');
            return { success: false, error: err.message };
        }
    }, []);

    /**
     * Bulk check-in
     */
    const bulkCheckIn = useCallback(async (guestsData) => {
        setError(null);

        try {
            const result = await guestsApi.bulkCheckIn({ guests: guestsData });

            // Refresh guest list after bulk operation
            await fetchGuests();

            return { success: true, result };
        } catch (err) {
            console.error('[Bulk Check-In Error]', err);
            setError(err.message || 'Bulk check-in failed');
            return { success: false, error: err.message };
        }
    }, [fetchGuests]);

    /**
     * Get guest by ID
     */
    const getGuestById = useCallback(async (guestId) => {
        try {
            const guest = await guestsApi.getGuestById(guestId);
            return { success: true, guest };
        } catch (err) {
            console.error('[Get Guest Error]', err);
            return { success: false, error: err.message };
        }
    }, []);

    return {
        guests,
        loading,
        error,
        pagination,
        fetchGuests,
        searchGuests,
        checkIn,
        undoCheckIn,
        bulkCheckIn,
        getGuestById,
        setError // Allow manual error clearing
    };
}

/**
 * Custom hook for guest statistics
 */
export function useGuestStats() {
    const [stats, setStats] = useState({
        total: 0,
        checkedIn: 0,
        percentage: 0,
        plusOnesTotal: 0,
        plusOnesCheckedIn: 0
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await guestsApi.getGuestStats();
            setStats(data);
        } catch (err) {
            console.error('[Fetch Stats Error]', err);
            setError(err.message || 'Failed to load statistics');
        } finally {
            setLoading(false);
        }
    }, []);

    // Auto-fetch on mount
    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return {
        stats,
        loading,
        error,
        refetch: fetchStats
    };
}