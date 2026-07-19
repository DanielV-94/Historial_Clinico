import { useEffect, useRef, useCallback } from 'react';
import { useThemeStore } from '@/stores/themeStore';

const POLLING_INTERVAL = 30_000; // 30 seconds

/**
 * ThemeProvider component that:
 * - Polls /api/theme/current every 30s for white-label config
 * - Applies CSS custom properties for primary, secondary, accent colors
 * - Sets font-family from theme config
 * - Handles logo URL from theme
 * - Falls back gracefully if API is unavailable
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { themeConfig, fetchTheme, darkMode } = useThemeStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyThemeToDOM = useCallback(() => {
    const root = document.documentElement;

    // Apply CSS custom properties
    root.style.setProperty('--color-primary', themeConfig.primaryColor);
    root.style.setProperty('--color-secondary', themeConfig.secondaryColor);
    root.style.setProperty('--color-accent', themeConfig.primaryColor);
    root.style.setProperty('--font-family', themeConfig.fontFamily);

    // Apply font-family directly
    root.style.fontFamily = themeConfig.fontFamily;

    // Apply dark mode class
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [themeConfig, darkMode]);

  // Initial fetch on mount
  useEffect(() => {
    fetchTheme();
  }, [fetchTheme]);

  // Set up polling every 30s
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchTheme();
    }, POLLING_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchTheme]);

  // Apply theme to DOM whenever config or dark mode changes
  useEffect(() => {
    applyThemeToDOM();
  }, [applyThemeToDOM]);

  return <>{children}</>;
}
