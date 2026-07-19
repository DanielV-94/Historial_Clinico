import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

/**
 * Custom hook that tracks user activity and logs out after 15 minutes of inactivity.
 * Redirects to /login with a session expired message.
 */
export function useInactivityTimeout() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInactivityLogout = useCallback(() => {
    logout();
    navigate('/login', {
      state: { message: 'Su sesión expiró por inactividad' },
      replace: true,
    });
  }, [logout, navigate]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(handleInactivityLogout, INACTIVITY_TIMEOUT_MS);
  }, [handleInactivityLogout]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Start the timer
    resetTimer();

    // Add event listeners for user activity
    const handleActivity = () => {
      resetTimer();
    };

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handleActivity);
      }
    };
  }, [isAuthenticated, resetTimer]);
}
