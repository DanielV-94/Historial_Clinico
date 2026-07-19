import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes';
import { ThemeProvider } from '@/theme';
import { useOfflineStore } from '@/stores/offlineStore';
import { useAuthStore } from '@/stores/authStore';
import { GlobalErrorModals } from '@/components/GlobalErrorModals';
import { sseClient } from '@/services/sse';

export function App() {
  const { isOnline } = useOfflineStore();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Connect/disconnect SSE based on auth state and role
  useEffect(() => {
    if (isAuthenticated && user?.role === 'assistant') {
      sseClient.connect();

      // Show toast-style notification on new prescription
      const handleNewPrescription = (data: unknown) => {
        const prescription = data as { id?: string; content?: string };
        // Dispatch custom event for toast notification
        window.dispatchEvent(
          new CustomEvent('notification:prescription', { detail: prescription })
        );
      };

      sseClient.on('new-prescription', handleNewPrescription);

      return () => {
        sseClient.off('new-prescription', handleNewPrescription);
        sseClient.disconnect();
      };
    } else {
      sseClient.disconnect();
    }
  }, [isAuthenticated, user?.role]);

  return (
    <ThemeProvider>
      {/* Global error modals for 409 conflict and 507 disk space */}
      <GlobalErrorModals />

      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2 text-sm font-medium">
          Sin conexión — Las funciones de escritura no están disponibles
        </div>
      )}

      {/* Prescription notification toast (for assistants) */}
      <PrescriptionToast />

      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

/**
 * PrescriptionToast — Listens for new prescription events and shows a temporary toast.
 * Only visible for assistant users when connected via SSE.
 */
function PrescriptionToast() {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user?.role !== 'assistant') return;

    let toastTimeout: ReturnType<typeof setTimeout> | null = null;
    let toastElement: HTMLDivElement | null = null;

    const handleNotification = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail as { content?: string } | undefined;

      // Remove existing toast
      if (toastElement) {
        toastElement.remove();
        toastElement = null;
      }
      if (toastTimeout) {
        clearTimeout(toastTimeout);
      }

      // Create toast element
      toastElement = document.createElement('div');
      toastElement.className =
        'fixed bottom-4 right-4 z-[80] bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm animate-pulse';
      toastElement.setAttribute('role', 'status');
      toastElement.setAttribute('aria-live', 'polite');
      toastElement.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-lg">📋</span>
          <div>
            <p class="text-sm font-medium">Nueva prescripción recibida</p>
            <p class="text-xs opacity-90">${data?.content ? data.content.slice(0, 50) + '...' : 'Revisa tu bandeja de prescripciones'}</p>
          </div>
        </div>
      `;

      document.body.appendChild(toastElement);

      // Auto-dismiss after 5 seconds
      toastTimeout = setTimeout(() => {
        if (toastElement) {
          toastElement.remove();
          toastElement = null;
        }
      }, 5000);
    };

    window.addEventListener('notification:prescription', handleNotification);

    return () => {
      window.removeEventListener('notification:prescription', handleNotification);
      if (toastElement) {
        toastElement.remove();
      }
      if (toastTimeout) {
        clearTimeout(toastTimeout);
      }
    };
  }, [user?.role]);

  return null;
}
