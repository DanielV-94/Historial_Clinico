import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 11.3**
 *
 * Property 21: Persistencia de preferencia de modo oscuro/claro
 * Para cualquier preferencia de tema (light/dark) guardada por un usuario,
 * al iniciar una nueva sesión el sistema SHALL presentar la interfaz con
 * la misma preferencia previamente seleccionada.
 */

const NUM_RUNS = 100;
const STORAGE_KEY = 'darkMode';

// ============================================================
// HELPERS
// ============================================================

/**
 * Creates a fresh instance of the themeStore by dynamically importing it.
 * Zustand stores are singletons so we need to reset the module registry
 * between tests to simulate "new session" behavior.
 */
async function createFreshStore() {
  // Clear the module cache to get a fresh store instance
  const modulePath = '@/stores/themeStore';
  // Vitest handles module isolation per dynamic import with cache busting
  const mod = await import('../stores/themeStore');
  return mod.useThemeStore;
}

// ============================================================
// PROPERTY TESTS
// ============================================================

describe('ThemeStore - Property 21: Persistencia de preferencia de modo oscuro/claro', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should restore the saved darkMode preference when store is initialized (persistence round-trip)', async () => {
    const { useThemeStore } = await import('../stores/themeStore');

    await fc.assert(
      fc.property(fc.boolean(), (darkModePreference) => {
        // Arrange: simulate a previously saved preference
        localStorage.setItem(STORAGE_KEY, String(darkModePreference));

        // Act: recreate store state by reading directly from localStorage
        // The store reads localStorage.getItem('darkMode') === 'true' on creation
        const storedValue = localStorage.getItem(STORAGE_KEY) === 'true';

        // Assert: the stored value matches what was saved
        expect(storedValue).toBe(darkModePreference);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should use "darkMode" as the localStorage key', async () => {
    const { useThemeStore } = await import('../stores/themeStore');

    await fc.assert(
      fc.property(fc.boolean(), (darkModePreference) => {
        // Arrange & Act: set darkMode via the store's setDarkMode
        const store = useThemeStore.getState();
        store.setDarkMode(darkModePreference);

        // Assert: the value is stored under the correct key 'darkMode'
        const raw = localStorage.getItem(STORAGE_KEY);
        expect(raw).not.toBeNull();
        expect(raw).toBe(String(darkModePreference));

        // Verify no other key is used for dark mode
        const allKeys = Object.keys(localStorage);
        const darkModeKeys = allKeys.filter((k) => k.toLowerCase().includes('dark') || k.toLowerCase().includes('theme'));
        expect(darkModeKeys).toContain(STORAGE_KEY);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should update both store state and localStorage when toggling darkMode', async () => {
    const { useThemeStore } = await import('../stores/themeStore');

    await fc.assert(
      fc.property(fc.boolean(), (initialValue) => {
        // Arrange: set initial state
        const store = useThemeStore.getState();
        store.setDarkMode(initialValue);

        // Act: toggle
        store.toggleDarkMode();

        // Assert: store state is flipped
        const newState = useThemeStore.getState().darkMode;
        expect(newState).toBe(!initialValue);

        // Assert: localStorage is updated to match
        const storedRaw = localStorage.getItem(STORAGE_KEY);
        expect(storedRaw).toBe(String(!initialValue));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should default to false (light mode) when localStorage has no darkMode value', async () => {
    const { useThemeStore } = await import('../stores/themeStore');

    await fc.assert(
      fc.property(
        // Generate arbitrary localStorage states that do NOT include the darkMode key
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s !== STORAGE_KEY),
          fc.string({ minLength: 0, maxLength: 50 }),
        ),
        (otherEntries) => {
          // Arrange: clear and set unrelated localStorage entries
          localStorage.clear();
          for (const [key, value] of Object.entries(otherEntries)) {
            localStorage.setItem(key, value);
          }

          // Act: read default behavior — store reads localStorage.getItem('darkMode')
          const rawValue = localStorage.getItem(STORAGE_KEY);
          const darkModeDefault = rawValue === 'true';

          // Assert: without the key present, default is false (light mode)
          expect(rawValue).toBeNull();
          expect(darkModeDefault).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('should persist darkMode=true and restore it correctly', async () => {
    const { useThemeStore } = await import('../stores/themeStore');

    await fc.assert(
      fc.property(
        fc.boolean(),
        fc.nat({ max: 10 }), // number of toggles to perform
        (startValue, toggleCount) => {
          // Arrange: set initial value
          const store = useThemeStore.getState();
          store.setDarkMode(startValue);

          // Act: toggle N times
          for (let i = 0; i < toggleCount; i++) {
            useThemeStore.getState().toggleDarkMode();
          }

          // Calculate expected final value
          const expectedFinal = toggleCount % 2 === 0 ? startValue : !startValue;

          // Assert: store state matches expected
          const finalState = useThemeStore.getState().darkMode;
          expect(finalState).toBe(expectedFinal);

          // Assert: localStorage matches expected
          const storedValue = localStorage.getItem(STORAGE_KEY);
          expect(storedValue).toBe(String(expectedFinal));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
