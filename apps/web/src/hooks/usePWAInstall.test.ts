import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePWAInstall } from './usePWAInstall';

describe('usePWAInstall', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
  const listeners: Record<string, EventListener> = {};

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation(
      (event: string, handler: EventListenerOrEventListenerObject) => {
        listeners[event] = handler as EventListener;
      }
    );
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('initializes with canInstall=false and installOutcome=null', () => {
    const { result } = renderHook(() => usePWAInstall());

    expect(result.current.canInstall).toBe(false);
    expect(result.current.installOutcome).toBeNull();
  });

  it('registers beforeinstallprompt and appinstalled listeners', () => {
    renderHook(() => usePWAInstall());

    expect(addEventListenerSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function));
  });

  it('sets canInstall=true when beforeinstallprompt fires', () => {
    const { result } = renderHook(() => usePWAInstall());

    act(() => {
      const event = new Event('beforeinstallprompt');
      Object.defineProperty(event, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
      Object.defineProperty(event, 'userChoice', {
        value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
      });
      event.preventDefault = vi.fn();
      listeners['beforeinstallprompt'](event);
    });

    expect(result.current.canInstall).toBe(true);
  });

  it('promptInstall triggers the deferred prompt and tracks outcome', async () => {
    const { result } = renderHook(() => usePWAInstall());

    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const mockUserChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });

    act(() => {
      const event = new Event('beforeinstallprompt');
      Object.defineProperty(event, 'prompt', { value: mockPrompt });
      Object.defineProperty(event, 'userChoice', { value: mockUserChoice });
      event.preventDefault = vi.fn();
      listeners['beforeinstallprompt'](event);
    });

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(mockPrompt).toHaveBeenCalled();
    expect(result.current.installOutcome).toBe('accepted');
    expect(result.current.canInstall).toBe(false);
  });

  it('resets canInstall when appinstalled fires', () => {
    const { result } = renderHook(() => usePWAInstall());

    // First trigger beforeinstallprompt
    act(() => {
      const event = new Event('beforeinstallprompt');
      Object.defineProperty(event, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
      Object.defineProperty(event, 'userChoice', {
        value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
      });
      event.preventDefault = vi.fn();
      listeners['beforeinstallprompt'](event);
    });

    expect(result.current.canInstall).toBe(true);

    // Then fire appinstalled
    act(() => {
      listeners['appinstalled'](new Event('appinstalled'));
    });

    expect(result.current.canInstall).toBe(false);
  });

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => usePWAInstall());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function));
  });
});
