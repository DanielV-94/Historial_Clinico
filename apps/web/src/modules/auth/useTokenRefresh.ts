import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';

/**
 * Decodes a JWT token payload without external dependencies.
 * Returns the parsed payload or null if decoding fails.
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

const REFRESH_BUFFER_MS = 60 * 1000; // Refresh 1 minute before expiration

/**
 * Custom hook that automatically refreshes the access token before it expires.
 * Decodes the JWT to determine expiration and sets a timer to refresh 1 minute before.
 * On refresh failure, logs out the user.
 */
export function useTokenRefresh() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performRefresh = useCallback(async () => {
    try {
      const response = await api.post<{ accessToken: string; user?: unknown }>(
        '/auth/refresh',
        undefined,
        { skipAuth: true }
      );
      if (response.accessToken) {
        useAuthStore.getState().refreshToken(response.accessToken);
      }
    } catch {
      // Refresh failed, logout the user
      logout();
      navigate('/login', {
        state: { message: 'Su sesión expiró. Por favor inicie sesión de nuevo.' },
        replace: true,
      });
    }
  }, [logout, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return;

    const expiresAt = payload.exp * 1000; // Convert to ms
    const now = Date.now();
    const timeUntilRefresh = expiresAt - now - REFRESH_BUFFER_MS;

    // If token is already expired or about to expire, refresh immediately
    if (timeUntilRefresh <= 0) {
      performRefresh();
      return;
    }

    // Set timer to refresh before expiration
    timerRef.current = setTimeout(performRefresh, timeUntilRefresh);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isAuthenticated, token, performRefresh]);
}
