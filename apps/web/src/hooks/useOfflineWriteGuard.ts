import { useCallback } from 'react';
import { useOfflineStore } from '@/stores/offlineStore';

/**
 * useOfflineWriteGuard — Blocks write operations when offline.
 * Returns a guard function that checks connectivity before executing
 * a write operation. If offline, shows an informative message and
 * returns false.
 *
 * Validates: Requirements 11.5, 11.6
 */
export function useOfflineWriteGuard() {
  const isOnline = useOfflineStore((state) => state.isOnline);

  /**
   * Guard function for write operations.
   * Call before any POST/PUT/PATCH/DELETE action.
   *
   * @param operationName - Human-readable operation name for the message
   * @returns true if the operation can proceed, false if blocked (offline)
   */
  const guardWrite = useCallback(
    (operationName?: string): boolean => {
      if (!isOnline) {
        const message = operationName
          ? `No se puede realizar "${operationName}" sin conexión a internet. Por favor, reconéctese e intente nuevamente.`
          : 'No se pueden realizar operaciones de escritura sin conexión a internet. Por favor, reconéctese e intente nuevamente.';

        // Use a non-blocking notification approach
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('offline-write-blocked', {
              detail: { message, operationName },
            })
          );
        }
        return false;
      }
      return true;
    },
    [isOnline]
  );

  return {
    /** Whether the app is currently online */
    isOnline,
    /** Guard function — returns false and emits event if offline */
    guardWrite,
  };
}
