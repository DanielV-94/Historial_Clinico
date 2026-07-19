import { useEffect, useState, useCallback } from 'react';

interface ConflictError {
  visible: boolean;
  message: string;
  data: unknown;
}

interface DiskSpaceError {
  visible: boolean;
  message: string;
}

/**
 * Hook that listens for global API error events dispatched by the api client.
 * - 'api:conflict-error' (409) → shows a modal with conflict info
 * - 'api:disk-space-error' (507) → shows a persistent banner about disk space
 */
export function useGlobalErrorHandler() {
  const [conflictError, setConflictError] = useState<ConflictError>({
    visible: false,
    message: '',
    data: null,
  });

  const [diskSpaceError, setDiskSpaceError] = useState<DiskSpaceError>({
    visible: false,
    message: '',
  });

  const dismissConflict = useCallback(() => {
    setConflictError({ visible: false, message: '', data: null });
  }, []);

  const dismissDiskSpace = useCallback(() => {
    setDiskSpaceError({ visible: false, message: '' });
  }, []);

  useEffect(() => {
    const handleConflict = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;
      const message =
        typeof data === 'object' && data?.message
          ? data.message
          : 'Se detectó un conflicto con los datos actuales. Recarga la página e intenta de nuevo.';
      setConflictError({ visible: true, message, data });
    };

    const handleDiskSpace = (event: Event) => {
      const customEvent = event as CustomEvent;
      const message =
        typeof customEvent.detail === 'string'
          ? customEvent.detail
          : 'Espacio en disco insuficiente. Contacte al administrador.';
      setDiskSpaceError({ visible: true, message });
    };

    window.addEventListener('api:conflict-error', handleConflict);
    window.addEventListener('api:disk-space-error', handleDiskSpace);

    return () => {
      window.removeEventListener('api:conflict-error', handleConflict);
      window.removeEventListener('api:disk-space-error', handleDiskSpace);
    };
  }, []);

  return {
    conflictError,
    diskSpaceError,
    dismissConflict,
    dismissDiskSpace,
  };
}
