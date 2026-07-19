import { create } from 'zustand';

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  clinicName: string;
  fontFamily: string;
}

interface ThemeState {
  themeConfig: ThemeConfig;
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
  fetchTheme: () => Promise<void>;
  setThemeConfig: (config: ThemeConfig) => void;
}

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#3b82f6',
  secondaryColor: '#1e40af',
  logoUrl: null,
  clinicName: 'Clínica',
  fontFamily: 'Inter, system-ui, sans-serif',
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeConfig: DEFAULT_THEME,
  darkMode: localStorage.getItem('darkMode') === 'true',

  toggleDarkMode: () => {
    const newValue = !get().darkMode;
    localStorage.setItem('darkMode', String(newValue));
    if (newValue) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ darkMode: newValue });
  },

  setDarkMode: (value) => {
    localStorage.setItem('darkMode', String(value));
    if (value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ darkMode: value });
  },

  fetchTheme: async () => {
    try {
      const response = await fetch('/api/theme/current');
      if (response.ok) {
        const config = await response.json();
        set({ themeConfig: config });
      }
    } catch {
      // Keep default theme on error
    }
  },

  setThemeConfig: (config) =>
    set({ themeConfig: config }),
}));
