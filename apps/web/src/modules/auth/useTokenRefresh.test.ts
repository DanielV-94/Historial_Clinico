import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTokenRefresh } from './useTokenRefresh';
import { useAuthStore } from '@/stores/authStore';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock the api module
vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from '@/services/api';

/**
 * Helper to create a fake JWT with a specific expiration time.
 */
function createFakeJwt(expiresInSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = btoa(JSON.stringify({ sub: '1', exp }));
  return `${header}.${payload}.fake-signature`;
}

describe('useTokenRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets timer to refresh token 1 minute before expiration', () => {
    const token = createFakeJwt(300); // Expires in 5 minutes
    useAuthStore.setState({
      user: { id: '1', username: 'doctor1', role: 'doctor', fullName: 'Dr. Test' },
      token,
      isAuthenticated: true,
    });

    vi.mocked(api.post).mockResolvedValue({ accessToken: 'new-token' });

    renderHook(() => useTokenRefresh());

    // Should not have refreshed yet
    expect(api.post).not.toHaveBeenCalled();

    // Advance to 1 minute before expiration (4 min = 240s)
    act(() => {
      vi.advanceTimersByTime(240 * 1000);
    });

    expect(api.post).toHaveBeenCalledWith('/auth/refresh', undefined, { skipAuth: true });
  });

  it('refreshes immediately if token is about to expire', () => {
    const token = createFakeJwt(30); // Expires in 30 seconds (less than 1 min buffer)
    useAuthStore.setState({
      user: { id: '1', username: 'doctor1', role: 'doctor', fullName: 'Dr. Test' },
      token,
      isAuthenticated: true,
    });

    vi.mocked(api.post).mockResolvedValue({ accessToken: 'new-token' });

    renderHook(() => useTokenRefresh());

    // Should refresh immediately since timeUntilRefresh <= 0
    expect(api.post).toHaveBeenCalled();
  });

  it('does not set timer when not authenticated', () => {
    useAuthStore.setState({ isAuthenticated: false, token: null, user: null });
    renderHook(() => useTokenRefresh());

    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(api.post).not.toHaveBeenCalled();
  });

  it('logs out on refresh failure', async () => {
    const token = createFakeJwt(30); // About to expire
    useAuthStore.setState({
      user: { id: '1', username: 'doctor1', role: 'doctor', fullName: 'Dr. Test' },
      token,
      isAuthenticated: true,
    });

    vi.mocked(api.post).mockRejectedValueOnce({ status: 401, message: 'Invalid refresh token' });

    renderHook(() => useTokenRefresh());

    // Wait for the async refresh to complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      state: { message: 'Su sesión expiró. Por favor inicie sesión de nuevo.' },
      replace: true,
    });
  });
});
