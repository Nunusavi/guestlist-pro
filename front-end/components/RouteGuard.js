import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function RouteGuard({ children, requiredRole }) {
    const { isAuthenticated, user, loading } = useAuth();
    const router = useRouter();
    const normalizedRole = user?.role?.toLowerCase();
    const guardRole = requiredRole?.toLowerCase();

    useEffect(() => {
        if (loading) {
            return; // Wait until loading is false
        }

        if (!isAuthenticated || !user) {
            router.replace('/login');
            return;
        }

        // Role-based protection
        if (guardRole && normalizedRole !== guardRole) {
            if (normalizedRole === 'admin') {
                router.replace('/admin');
                return;
            }

            if (normalizedRole === 'usher') {
                router.replace('/usher');
                return;
            }

            router.replace('/login');
        }
    }, [isAuthenticated, user, loading, router, guardRole, normalizedRole]);

    // While checking auth, show a loading screen
    if (loading || !isAuthenticated || !user || (guardRole && normalizedRole !== guardRole)) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-slate-500" />
            </div>
        );
    }

    // If authenticated and authorized, render the page
    return children;
}