import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';
import { useThemeStore } from '@/stores/themeStore';

describe('useTheme', () => {
  beforeEach(() => {
    useThemeStore.setState({
      themeConfig: {
        primaryColor: '#3b82f6',
        secondaryColor: '#1e40af',
        logoUrl: null,
        clinicName: 'Clínica',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      darkMode: false,
    });
    localStorage.clear();
  });

  it('returns current theme config', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.themeConfig).toEqual({
      primaryColor: '#3b82f6',
      secondaryColor: '#1e40af',
      logoUrl: null,
      clinicName: 'Clínica',
      fontFamily: 'Inter, system-ui, sans-serif',
    });
  });

  it('returns isDark as false by default', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);
  });

  it('returns primary, secondary and accent colors', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.primaryColor).toBe('#3b82f6');
    expect(result.current.secondaryColor).toBe('#1e40af');
    expect(result.current.accentColor).toBe('#3b82f6');
  });

  it('returns fontFamily', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.fontFamily).toBe('Inter, system-ui, sans-serif');
  });

  it('returns logoUrl and clinicName', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.logoUrl).toBeNull();
    expect(result.current.clinicName).toBe('Clínica');
  });

  it('toggleDarkMode switches between light and dark', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.isDark).toBe(false);

    act(() => {
      result.current.toggleDarkMode();
    });

    expect(result.current.isDark).toBe(true);

    act(() => {
      result.current.toggleDarkMode();
    });

    expect(result.current.isDark).toBe(false);
  });

  it('toggleDarkMode persists preference in localStorage', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleDarkMode();
    });

    expect(localStorage.getItem('darkMode')).toBe('true');

    act(() => {
      result.current.toggleDarkMode();
    });

    expect(localStorage.getItem('darkMode')).toBe('false');
  });

  it('reflects updated theme config', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      useThemeStore.getState().setThemeConfig({
        primaryColor: '#ff0000',
        secondaryColor: '#00ff00',
        logoUrl: 'https://example.com/logo.png',
        clinicName: 'New Clinic',
        fontFamily: 'Roboto, sans-serif',
      });
    });

    expect(result.current.primaryColor).toBe('#ff0000');
    expect(result.current.secondaryColor).toBe('#00ff00');
    expect(result.current.logoUrl).toBe('https://example.com/logo.png');
    expect(result.current.clinicName).toBe('New Clinic');
    expect(result.current.fontFamily).toBe('Roboto, sans-serif');
  });
});
