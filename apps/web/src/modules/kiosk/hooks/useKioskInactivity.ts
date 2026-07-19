import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

/**
 * useKioskInactivity — Detects inactivity (no touch/input) and triggers
 * cleanup + redirect to welcome screen after 3 minutes.
 * Validates: Requirement 7.5
 */
export function useKioskInactivity(onTimeout: () => void, enabled = true) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  // Keep callback ref current without re-registering events
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (enabled) {
      timerRef.current = setTimeout(() => {
        onTimeoutRef.current();
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const activityEvents = [
      'touchstart',
      'touchmove',
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'input',
    ];

    const handleActivity = () => {
      resetTimer();
    };

    // Start timer on mount
    resetTimer();

    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer]);

  return { resetTimer };
}
