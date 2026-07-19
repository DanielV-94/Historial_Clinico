import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOfflineWriteGuard } from './useOfflineWriteGuard';
import { useOfflineStore } from '@/stores/offlineStore';

describe('useOfflineWriteGuard', () => {
  beforeEach(() => {
    // Reset to online state before each test
    useOfflineStore.setState({ isOnline: true });
  });

  it('allows write operations when online', () => {
    const { result } = renderHook(() => useOfflineWriteGuard());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.guardWrite('Guardar paciente')).toBe(true);
  });

  it('blocks write operations when offline', () => {
    useOfflineStore.setState({ isOnline: false });
    const { result } = renderHook(() => useOfflineWriteGuard());

    expect(result.current.isOnline).toBe(false);
    expect(result.current.guardWrite('Guardar paciente')).toBe(false);
  });

  it('dispatches custom event when write is blocked offline', () => {
    useOfflineStore.setState({ isOnline: false });
    const { result } = renderHook(() => useOfflineWriteGuard());

    const eventHandler = vi.fn();
    window.addEventListener('offline-write-blocked', eventHandler);

    result.current.guardWrite('Crear nota');

    expect(eventHandler).toHaveBeenCalledTimes(1);
    const detail = (eventHandler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.operationName).toBe('Crear nota');
    expect(detail.message).toContain('Crear nota');
    expect(detail.message).toContain('sin conexión');

    window.removeEventListener('offline-write-blocked', eventHandler);
  });

  it('provides generic message when no operation name given', () => {
    useOfflineStore.setState({ isOnline: false });
    const { result } = renderHook(() => useOfflineWriteGuard());

    const eventHandler = vi.fn();
    window.addEventListener('offline-write-blocked', eventHandler);

    result.current.guardWrite();

    const detail = (eventHandler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.message).toContain('operaciones de escritura');

    window.removeEventListener('offline-write-blocked', eventHandler);
  });
});
