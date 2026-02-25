import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function installMatchMedia(initialReduced = false) {
    const listeners = new Set();
    const mediaQueryList = {
        matches: initialReduced,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: vi.fn((event, handler) => {
            if (event === 'change') listeners.add(handler);
        }),
        removeEventListener: vi.fn((event, handler) => {
            if (event === 'change') listeners.delete(handler);
        }),
        addListener: vi.fn((handler) => listeners.add(handler)),
        removeListener: vi.fn((handler) => listeners.delete(handler))
    };

    window.matchMedia = vi.fn(() => mediaQueryList);

    return {
        mediaQueryList,
        trigger(nextReduced) {
            mediaQueryList.matches = nextReduced;
            listeners.forEach((handler) => handler({ matches: nextReduced }));
        }
    };
}

describe('EphemeraMotion', () => {
    let originalMatchMedia;

    beforeEach(() => {
        vi.resetModules();
        originalMatchMedia = window.matchMedia;
        document.documentElement.classList.remove('reduced-motion');
        document.documentElement.removeAttribute('data-reduced-motion');
        document.body.classList.remove('reduced-motion');
        document.body.removeAttribute('data-reduced-motion');

        window.EphemeraEvents = { emit: vi.fn() };
        global.EphemeraEvents = window.EphemeraEvents;
    });

    afterEach(() => {
        window.EphemeraMotion?._resetForTests?.();
        window.matchMedia = originalMatchMedia;
        delete global.EphemeraEvents;
    });

    it('applies reduced-motion runtime state on initialization', async () => {
        installMatchMedia(true);
        await import('../js/system/motion.js');

        expect(window.EphemeraMotion.isReducedMotion()).toBe(true);
        expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
        expect(document.body.classList.contains('reduced-motion')).toBe(true);
        expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
        expect(document.body.getAttribute('data-reduced-motion')).toBe('true');
    });

    it('emits motion:changed and updates state when preference changes', async () => {
        const media = installMatchMedia(false);
        await import('../js/system/motion.js');

        media.trigger(true);

        expect(window.EphemeraMotion.isReducedMotion()).toBe(true);
        expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
        expect(window.EphemeraEvents.emit).toHaveBeenCalledWith('motion:changed', { reduced: true });
    });

    it('falls back to non-reduced mode when matchMedia is unavailable', async () => {
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: undefined
        });

        await import('../js/system/motion.js');

        expect(window.EphemeraMotion.isReducedMotion()).toBe(false);
        expect(document.documentElement.classList.contains('reduced-motion')).toBe(false);
        expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('false');
    });
});
