import React, { createContext, useContext, useState, useEffect } from 'react';
import * as authApi from '../api/auth';

/**
 * Authentication Context
 * Provides auth state and methods throughout the application
 */

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Verify token on mount
   * Checks if user has valid session
   */
  useEffect(() => {
    const verifySession = async () => {
      // Check if token exists in localStorage
      if (!authApi.isAuthenticated()) {
        setLoading(false);
        return;
      }

      try {
        // Verify token with backend
        const { valid, user: verifiedUser } = await authApi.verifyToken();
        
        if (valid && verifiedUser) {
          setUser(verifiedUser);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('[Session Verification Error]', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []);

  /**
   * Login user
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{success: boolean, user: Object|null}>} Success status and user
   */
  const login = async (username, password) => {
    setError(null);
    setLoading(true);

    try {
      const { user: loggedInUser, token } = await authApi.login(username, password);
      
      console.log('[AuthContext] Login successful:', loggedInUser);
      
      setUser(loggedInUser);
      setLoading(false);
      
      return { success: true, user: loggedInUser };
    } catch (err) {
      console.error('[Login Failed]', err);
      setError(err.message || 'Invalid username or password');
      setLoading(false);
      return { success: false, user: null };
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    setLoading(true);
    
    try {
      await authApi.logout();
    } catch (err) {
      console.error('[Logout Error]', err);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  /**
   * Check if user is admin
   * @returns {boolean}
   */
  const isAdmin = () => {
    return user?.role === 'Admin';
  };

  /**
   * Check if user is usher
   * @returns {boolean}
   */
  const isUsher = () => {
    return user?.role === 'Usher';
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: isAdmin(),
    isUsher: isUsher(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to use auth context
 * @returns {Object} Auth context value
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */
export const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-6">You do not have permission to access this page.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return children;
};