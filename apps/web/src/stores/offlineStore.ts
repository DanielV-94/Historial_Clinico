import { create } from 'zustand';

interface OfflineState {
  isOnline: boolean;
  setOnline: () => void;
  setOffline: () => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  setOnline: () => set({ isOnline: true }),

  setOffline: () => set({ isOnline: false }),
}));

// Initialize listeners for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineStore.getState().setOnline();
  });
  window.addEventListener('offline', () => {
    useOfflineStore.getState().setOffline();
  });
}
