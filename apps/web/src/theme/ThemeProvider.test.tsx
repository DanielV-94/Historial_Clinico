import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { ThemeProvider } from './ThemeProvider';
import { useThemeStore } from '@/stores/themeStore';

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset store state
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
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          primaryColor: '#ff0000',
          secondaryColor: '#00ff00',
          logoUrl: 'https://example.com/logo.png',
          clinicName: 'Test Clinic',
          fontFamily: 'Roboto, sans-serif',
        }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches theme on mount', async () => {
    await act(async () => {
      render(
        <ThemeProvider>
          <div>child</div>
        </ThemeProvider>,
      );
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/theme/current');
  });

  it('polls theme every 30 seconds', async () => {
    await act(async () => {
      render(
        <ThemeProvider>
          <div>child</div>
        </ThemeProvider>,
      );
    });

    // Initial fetch
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance 30s
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Advance another 30s
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('applies CSS custom properties for colors', async () => {
    await act(async () => {
      render(
        <ThemeProvider>
          <div>child</div>
        </ThemeProvider>,
      );
    });

    // After fetch resolves, the store updates and CSS vars are applied
    await act(async () => {
      await Promise.resolve();
    });

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary')).toBe('#ff0000');
    expect(root.style.getPropertyValue('--color-secondary')).toBe('#00ff00');
  });

  it('applies font-family from theme config', async () => {
    await act(async () => {
      render(
        <ThemeProvider>
          <div>child</div>
        </ThemeProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--font-family')).toBe(
      'Roboto, sans-serif',
    );
    expect(root.style.fontFamily).toBe('Roboto, sans-serif');
  });

  it('applies dark mode class when darkMode is true', async () => {
    useThemeStore.setState({ darkMode: true });

    await act(async () => {
      render(
        <ThemeProvider>
          <div>child</div>
        </ThemeProvider>,
      );
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark mode class when darkMode is false', async () => {
    document.documentElement.classList.add('dark');
    useThemeStore.setState({ darkMode: false });

    await act(async () => {
      render(
        <ThemeProvider>
          <div>child</div>
        </ThemeProvider>,
      );
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('falls back gracefully if API is unavailable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(
        <ThemeProvider>
          <div>child</div>
        </ThemeProvider>,
      );
    });

    // Should still render children without error
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary')).toBe('#3b82f6');
  });

  it('renders children correctly', async () => {
    const { getByText } = await act(async () =>
      render(
        <ThemeProvider>
          <div>Test Content</div>
        </ThemeProvider>,
      ),
    );

    expect(getByText('Test Content')).toBeDefined();
  });
});
