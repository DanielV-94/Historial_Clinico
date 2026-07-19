import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  role: 'doctor' | 'assistant' | 'admin' | 'kiosk';
  fullName: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  refreshToken: (token: string) => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: (user, token) =>
    set({ user, token, isAuthenticated: true }),

  logout: () =>
    set({ user: null, token: null, isAuthenticated: false }),

  refreshToken: (token) =>
    set({ token }),

  setUser: (user) =>
    set({ user }),
}));
