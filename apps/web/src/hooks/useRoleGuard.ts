import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';

type UserRole = 'doctor' | 'assistant' | 'admin' | 'kiosk';

interface RoutePermission {
  path: string;
  label: string;
  icon: string;
  roles: UserRole[];
}

/**
 * RBAC route permissions matrix.
 * Each route specifies which roles can access it.
 *
 * - Doctor: dashboard, patients (full CRUD), AI summary
 * - Assistant: dashboard (assistant view), patients (read-only), prescriptions
 * - Admin: everything including settings
 * - Kiosk: only kiosk routes (handled separately, not in main nav)
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: '📊',
    roles: ['doctor', 'assistant', 'admin'],
  },
  {
    path: '/patients',
    label: 'Pacientes',
    icon: '👥',
    roles: ['doctor', 'assistant', 'admin'],
  },
  {
    path: '/prescriptions',
    label: 'Prescripciones',
    icon: '📋',
    roles: ['assistant', 'admin'],
  },
  {
    path: '/settings',
    label: 'Configuración',
    icon: '⚙️',
    roles: ['admin'],
  },
];

/**
 * Hook that provides role-based access information.
 * Returns which navigation items should be visible and
 * whether the user can access a given path.
 */
export function useRoleGuard() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;

  const allowedNavItems = useMemo(() => {
    if (!role) return [];
    return ROUTE_PERMISSIONS.filter((item) => item.roles.includes(role));
  }, [role]);

  /**
   * Check if the current user can access a given path.
   */
  const canAccess = (path: string): boolean => {
    if (!role) return false;

    // Admin can access everything
    if (role === 'admin') return true;

    // Kiosk can only access kiosk routes
    if (role === 'kiosk') return path.startsWith('/kiosk');

    // Find matching route permission
    const permission = ROUTE_PERMISSIONS.find((item) =>
      path.startsWith(item.path)
    );

    // If no permission found, deny by default (fail-closed)
    if (!permission) return false;

    return permission.roles.includes(role);
  };

  /**
   * Check if the current user has write access to patients.
   * Assistants have read-only access; doctors and admin have full access.
   */
  const canWritePatients = (): boolean => {
    return role === 'doctor' || role === 'admin';
  };

  return {
    role,
    allowedNavItems,
    canAccess,
    canWritePatients,
  };
}
