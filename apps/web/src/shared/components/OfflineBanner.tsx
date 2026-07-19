import React from 'react';
import { useOfflineStore } from '@/stores/offlineStore';

/**
 * OfflineBanner — Fixed banner at top indicating offline/no-connectivity mode.
 * Shows "Sin conexión" when the app detects it's offline.
 * Validates: Requirements 11.5, 11.6
 */
export const OfflineBanner: React.FC = () => {
  const isOnline = useOfflineStore((state) => state.isOnline);

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium shadow-md"
    >
      <div className="flex items-center justify-center gap-2">
        <svg
          className="h-4 w-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01"
          />
        </svg>
        <span>
          Sin conexión — Los datos se muestran en modo de solo lectura. Las operaciones de escritura no están disponibles.
        </span>
      </div>
    </div>
  );
};
