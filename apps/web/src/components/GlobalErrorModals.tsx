import { useGlobalErrorHandler } from '@/hooks/useGlobalErrorHandler';

/**
 * GlobalErrorModals — Renders conflict modal and disk space banner
 * based on global API error events (409 conflict, 507 disk space).
 */
export function GlobalErrorModals() {
  const { conflictError, diskSpaceError, dismissConflict, dismissDiskSpace } =
    useGlobalErrorHandler();

  return (
    <>
      {/* Disk Space Banner (507) — persistent banner at top */}
      {diskSpaceError.visible && (
        <div
          role="alert"
          className="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white text-center py-3 px-4 flex items-center justify-center gap-3"
        >
          <span className="text-lg">⚠️</span>
          <span className="text-sm font-medium">{diskSpaceError.message}</span>
          <button
            onClick={dismissDiskSpace}
            className="ml-4 px-2 py-1 text-xs bg-red-800 hover:bg-red-900 rounded transition-colors"
            aria-label="Cerrar alerta de espacio en disco"
          >
            ✕
          </button>
        </div>
      )}

      {/* Conflict Modal (409) — centered modal overlay */}
      {conflictError.visible && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="conflict-modal-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <h2
                id="conflict-modal-title"
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                Conflicto de datos
              </h2>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              {conflictError.message}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={dismissConflict}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Entendido
              </button>
              <button
                onClick={() => {
                  dismissConflict();
                  window.location.reload();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
