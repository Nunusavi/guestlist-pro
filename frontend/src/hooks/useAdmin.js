import { useState, useEffect, useCallback } from 'react';
import * as adminApi from '../api/admin';

/**
 * Custom hook for admin dashboard statistics
 */
export function useAdminStats(autoRefresh = false, refreshInterval = 10000) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await adminApi.getAdminStats();
            setStats(data);
        } catch (err) {
            console.error('[Fetch Admin Stats Error]', err);
            setError(err.message || 'Failed to load statistics');
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Auto-refresh
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchStats();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchStats]);

    return {
        stats,
        loading,
        error,
        refetch: fetchStats
    };
}

/**
 * Custom hook for audit log
 */
export function useAuditLog() {
    const [auditLog, setAuditLog] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
    });

    const fetchAuditLog = useCallback(async (params = {}) => {
        setLoading(true);
        setError(null);

        try {
            const data = await adminApi.getAuditLog(params);
            setAuditLog(data.logs || []);
            setPagination(data.pagination || pagination);
        } catch (err) {
            console.error('[Fetch Audit Log Error]', err);
            setError(err.message || 'Failed to load audit log');
            setAuditLog([]);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        auditLog,
        loading,
        error,
        pagination,
        fetchAuditLog
    };
}

/**
 * Custom hook for user management
 */
export function useUserManagement() {
    const [ushers, setUshers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchUshers = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await adminApi.getUshers();
            setUshers(data);
        } catch (err) {
            console.error('[Fetch Ushers Error]', err);
            setError(err.message || 'Failed to load users');
            setUshers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const createUsher = useCallback(async (data) => {
        setError(null);

        try {
            const newUsher = await adminApi.createUsher(data);
            setUshers(prev => [...prev, newUsher]);
            return { success: true, usher: newUsher };
        } catch (err) {
            console.error('[Create Usher Error]', err);
            setError(err.message || 'Failed to create user');
            return { success: false, error: err.message };
        }
    }, []);

    const updateUsher = useCallback(async (usherId, data) => {
        setError(null);

        try {
            const updatedUsher = await adminApi.updateUsher(usherId, data);
            setUshers(prev => prev.map(u => u.id === usherId ? updatedUsher : u));
            return { success: true, usher: updatedUsher };
        } catch (err) {
            console.error('[Update Usher Error]', err);
            setError(err.message || 'Failed to update user');
            return { success: false, error: err.message };
        }
    }, []);

    const deleteUsher = useCallback(async (usherId) => {
        setError(null);

        try {
            await adminApi.deleteUsher(usherId);
            setUshers(prev => prev.filter(u => u.id !== usherId));
            return { success: true };
        } catch (err) {
            console.error('[Delete Usher Error]', err);
            setError(err.message || 'Failed to delete user');
            return { success: false, error: err.message };
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchUshers();
    }, [fetchUshers]);

    return {
        ushers,
        loading,
        error,
        fetchUshers,
        createUsher,
        updateUsher,
        deleteUsher
    };
}

/**
 * Custom hook for exporting data
 */
export function useExport() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const exportGuests = useCallback(async (filters = {}) => {
        setLoading(true);
        setError(null);

        try {
            const blob = await adminApi.exportGuests(filters);

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `guests-export-${timestamp}.csv`;

            // Download the file
            adminApi.downloadCSV(blob, filename);

            return { success: true };
        } catch (err) {
            console.error('[Export Error]', err);
            setError(err.message || 'Export failed');
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        exportGuests
    };
}