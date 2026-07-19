import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

type UserRole = 'doctor' | 'assistant' | 'admin' | 'kiosk';

interface RoleGuardProps {
  allowed: UserRole[];
  children: React.ReactNode;
}

/**
 * RoleGuard — Protects routes by checking the user's role.
 * If the user's role is not in the allowed list, redirect to dashboard.
 * Implements fail-closed: if role is unknown or missing, redirect.
 */
export function RoleGuard({ allowed, children }: RoleGuardProps) {
  const role = useAuthStore((state) => state.user?.role);

  // Fail-closed: no role → redirect to dashboard
  if (!role || !allowed.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
