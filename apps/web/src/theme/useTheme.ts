import { useThemeStore } from '@/stores/themeStore';

/**
 * Hook that provides theme state and controls:
 * - Current theme config
 * - isDark boolean
 * - toggleDarkMode function
 * - Primary/secondary/accent colors
 * - Logo URL and clinic name
 */
export function useTheme() {
  const { themeConfig, darkMode, toggleDarkMode } = useThemeStore();

  return {
    /** Full theme configuration object */
    themeConfig,
    /** Whether dark mode is active */
    isDark: darkMode,
    /** Toggle between light and dark mode (persists in localStorage) */
    toggleDarkMode,
    /** Primary brand color (hex) */
    primaryColor: themeConfig.primaryColor,
    /** Secondary brand color (hex) */
    secondaryColor: themeConfig.secondaryColor,
    /** Accent color (defaults to primary) */
    accentColor: themeConfig.primaryColor,
    /** Font family string */
    fontFamily: themeConfig.fontFamily,
    /** Logo URL or null */
    logoUrl: themeConfig.logoUrl,
    /** Clinic name */
    clinicName: themeConfig.clinicName,
  };
}
