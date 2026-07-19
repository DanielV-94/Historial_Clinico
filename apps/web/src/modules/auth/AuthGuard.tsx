import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useInactivityTimeout } from './useInactivityTimeout';
import { useTokenRefresh } from './useTokenRefresh';

/**
 * AuthGuard wraps authenticated routes.
 * - Redirects unauthenticated users to /login
 * - Activates inactivity timeout (15 min logout)
 * - Activates automatic token refresh before expiration
 */
export function AuthGuard() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  // Activate session management hooks
  useInactivityTimeout();
  useTokenRefresh();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
