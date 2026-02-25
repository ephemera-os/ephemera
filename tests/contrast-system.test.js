import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PREFERRED_CONTRAST_QUERY = '(prefers-contrast: more)';
const FORCED_COLORS_QUERY = '(forced-colors: active)';

function createMediaQueryList(initialMatches, media) {
    const listeners = new Set();
    const mediaQueryList = {
        matches: initialMatches,
        media,
        addEventListener: vi.fn((event, handler) => {
            if (event === 'change') listeners.add(handler);
        }),
        removeEventListener: vi.fn((event, handler) => {
            if (event === 'change') listeners.delete(handler);
        }),
        addListener: vi.fn((handler) => listeners.add(handler)),
        removeListener: vi.fn((handler) => listeners.delete(handler))
    };

    return {
        mediaQueryList,
        trigger(nextMatches) {
            mediaQueryList.matches = nextMatches;
            listeners.forEach((handler) => handler({ matches: nextMatches }));
        }
    };
}

function installMatchMedia({ prefersContrast = false, forcedColors = false } = {}) {
    const preferred = createMediaQueryList(prefersContrast, PREFERRED_CONTRAST_QUERY);
    const forced = createMediaQueryList(forcedColors, FORCED_COLORS_QUERY);
    window.matchMedia = vi.fn((query) => {
        if (query === PREFERRED_CONTRAST_QUERY) return preferred.mediaQueryList;
        if (query === FORCED_COLORS_QUERY) return forced.mediaQueryList;
        return createMediaQueryList(false, String(query)).mediaQueryList;
    });

    return { preferred, forced };
}

describe('EphemeraContrast', () => {
    let originalMatchMedia;

    beforeEach(() => {
        vi.resetModules();
        originalMatchMedia = window.matchMedia;
        document.documentElement.classList.remove('high-contrast');
        document.documentElement.removeAttribute('data-high-contrast');
        document.body.classList.remove('high-contrast');
        document.body.removeAttribute('data-high-contrast');

        window.EphemeraEvents = { emit: vi.fn() };
        global.EphemeraEvents = window.EphemeraEvents;
    });

    afterEach(() => {
        window.EphemeraContrast?._resetForTests?.();
        window.matchMedia = originalMatchMedia;
        delete global.EphemeraEvents;
    });

    it('applies high-contrast runtime state on initialization from prefers-contrast', async () => {
        installMatchMedia({ prefersContrast: true, forcedColors: false });
        await import('../js/system/contrast.js');

        expect(window.EphemeraContrast.isHighContrast()).toBe(true);
        expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
        expect(document.body.classList.contains('high-contrast')).toBe(true);
        expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true');
        expect(document.body.getAttribute('data-high-contrast')).toBe('true');
    });

    it('applies high-contrast runtime state when forced-colors is active', async () => {
        installMatchMedia({ prefersContrast: false, forcedColors: true });
        await import('../js/system/contrast.js');

        expect(window.EphemeraContrast.isHighContrast()).toBe(true);
        expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
    });

    it('emits contrast:changed when media preference changes', async () => {
        const media = installMatchMedia({ prefersContrast: false, forcedColors: false });
        await import('../js/system/contrast.js');

        media.forced.trigger(true);

        expect(window.EphemeraContrast.isHighContrast()).toBe(true);
        expect(window.EphemeraEvents.emit).toHaveBeenCalledWith('contrast:changed', { highContrast: true });
    });

    it('falls back to non-high-contrast mode when matchMedia is unavailable', async () => {
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: undefined
        });

        await import('../js/system/contrast.js');

        expect(window.EphemeraContrast.isHighContrast()).toBe(false);
        expect(document.documentElement.classList.contains('high-contrast')).toBe(false);
        expect(document.documentElement.getAttribute('data-high-contrast')).toBe('false');
    });
});
