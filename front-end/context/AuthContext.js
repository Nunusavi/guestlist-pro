import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

const STORAGE_KEYS = {
    user: 'guestlist_user',
    token: 'guestlist_token',
    refreshToken: 'guestlist_refresh_token',
};

const AuthContext = createContext();

function normalizeUser(userData) {
    if (!userData) {
        return null;
    }

    return {
        ...userData,
        role: typeof userData.role === 'string' ? userData.role.toLowerCase() : userData.role,
    };
}

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true); // To check initial auth state
    const router = useRouter();

    useEffect(() => {
        const storedToken = localStorage.getItem(STORAGE_KEYS.token);
        const storedUser = localStorage.getItem(STORAGE_KEYS.user);

        if (storedToken) {
            setToken(storedToken);
        }

        if (storedUser && storedUser !== 'undefined') {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(normalizeUser(parsedUser));
            } catch (error) {
                console.warn('Failed to parse stored user:', error);
                localStorage.removeItem(STORAGE_KEYS.user);
            }
        }

        setLoading(false);
    }, []);

    const login = useCallback((userData, authToken, refreshToken) => {
        const normalizedUser = normalizeUser(userData);

        setUser(normalizedUser);
        setToken(authToken);
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(normalizedUser));
        localStorage.setItem(STORAGE_KEYS.token, authToken);

        if (refreshToken) {
            localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
        }

        // Redirect based on role
        const role = normalizedUser?.role;
        if (role === 'admin') {
            router.replace('/admin');
        } else if (role === 'usher') {
            router.replace('/usher');
        } else {
            router.replace('/login');
        }
    }, [router]);

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem(STORAGE_KEYS.user);
        localStorage.removeItem(STORAGE_KEYS.token);
        localStorage.removeItem(STORAGE_KEYS.refreshToken);
        router.replace('/login');
    }, [router]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleForcedLogout = () => {
            logout();
        };

        window.addEventListener('guestlist:auth-forced-logout', handleForcedLogout);
        return () => {
            window.removeEventListener('guestlist:auth-forced-logout', handleForcedLogout);
        };
    }, [logout]);

    const value = {
        user,
        token,
        isAuthenticated: !!token,
        loading,
        login,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}