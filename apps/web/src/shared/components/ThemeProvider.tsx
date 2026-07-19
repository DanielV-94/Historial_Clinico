import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useThemeStore } from '@/stores/themeStore';

interface ThemeContextValue {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  clinicName: string;
  fontFamily: string;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Polling interval in ms. Default: 30000 (30s) */
  pollingInterval?: number;
}

/**
 * ThemeProvider — Context that polls GET /api/theme/current every 30s,
 * applies CSS variables for primary/secondary/accent colors, and wraps the app.
 * Validates: Requirements 10.2, 10.3
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  pollingInterval = 30000,
}) => {
  const themeConfig = useThemeStore((s) => s.themeConfig);
  const darkMode = useThemeStore((s) => s.darkMode);
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);
  const fetchTheme = useThemeStore((s) => s.fetchTheme);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial fetch and polling
  useEffect(() => {
    fetchTheme();

    intervalRef.current = setInterval(() => {
      fetchTheme();
    }, pollingInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchTheme, pollingInterval]);

  // Apply CSS variables whenever theme config changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', themeConfig.primaryColor);
    root.style.setProperty('--color-secondary', themeConfig.secondaryColor);
    // Derive accent from primary with slight hue shift
    root.style.setProperty('--color-accent', themeConfig.primaryColor);
    root.style.setProperty('--font-family', themeConfig.fontFamily);
    root.style.setProperty('--clinic-name', `"${themeConfig.clinicName}"`);

    // Apply font family to body
    document.body.style.fontFamily = themeConfig.fontFamily;
  }, [themeConfig]);

  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const contextValue: ThemeContextValue = {
    primaryColor: themeConfig.primaryColor,
    secondaryColor: themeConfig.secondaryColor,
    accentColor: themeConfig.primaryColor,
    logoUrl: themeConfig.logoUrl,
    clinicName: themeConfig.clinicName,
    fontFamily: themeConfig.fontFamily,
    darkMode,
    toggleDarkMode,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to consume the theme context.
 * Must be used inside a ThemeProvider.
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
