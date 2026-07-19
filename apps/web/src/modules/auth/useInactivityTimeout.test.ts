import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInactivityTimeout } from './useInactivityTimeout';
import { useAuthStore } from '@/stores/authStore';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('useInactivityTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: '1', username: 'doctor1', role: 'doctor', fullName: 'Dr. Test' },
      token: 'test-token',
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('logs out after 15 minutes of inactivity', () => {
    renderHook(() => useInactivityTimeout());

    // Advance time by 15 minutes
    act(() => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      state: { message: 'Su sesión expiró por inactividad' },
      replace: true,
    });
  });

  it('resets timer on user activity', () => {
    renderHook(() => useInactivityTimeout());

    // Advance 10 minutes
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });

    // User performs activity
    act(() => {
      document.dispatchEvent(new Event('mousedown'));
    });

    // Advance another 10 minutes (total 20 from start, but only 10 from last activity)
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });

    // Should still be authenticated since timer was reset
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
  });

  it('does not set timer when not authenticated', () => {
    useAuthStore.setState({ isAuthenticated: false, token: null, user: null });
    renderHook(() => useInactivityTimeout());

    act(() => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });

    // navigate should not have been called
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
