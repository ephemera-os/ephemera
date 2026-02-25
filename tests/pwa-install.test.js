import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../js/system/pwa-install.js';

const EphemeraPWA = window.EphemeraPWA;

function createInstallPromptEvent(outcome = 'accepted') {
    const prompt = vi.fn(async () => {});
    const event = new Event('beforeinstallprompt', { cancelable: true });

    Object.defineProperty(event, 'prompt', {
        configurable: true,
        value: prompt
    });
    Object.defineProperty(event, 'userChoice', {
        configurable: true,
        value: Promise.resolve({ outcome })
    });

    return { event, prompt };
}

async function flushMicrotasks(iterations = 4) {
    for (let i = 0; i < iterations; i++) {
        await Promise.resolve();
    }
}

describe('EphemeraPWA', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
        vi.clearAllMocks();
        window.matchMedia = originalMatchMedia;
        EphemeraPWA._resetForTests();
    });

    afterEach(() => {
        EphemeraPWA._resetForTests();
        window.matchMedia = originalMatchMedia;
        localStorage.clear();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('shows custom install banner when install prompt is available', async () => {
        await EphemeraPWA.init();
        const { event } = createInstallPromptEvent();

        window.dispatchEvent(event);

        const banner = document.getElementById('pwa-install-banner');
        expect(banner.classList.contains('open')).toBe(true);
        expect(document.getElementById('pwa-install-overlay').classList.contains('open')).toBe(false);
    });

    it('auto-opens install modal on second visit with feature highlights', async () => {
        localStorage.setItem(EphemeraPWA.VISIT_COUNT_KEY, '1');
        await EphemeraPWA.init();
        const { event } = createInstallPromptEvent();

        window.dispatchEvent(event);

        expect(localStorage.getItem(EphemeraPWA.INSTALL_MODAL_SHOWN_KEY)).toBe('1');
        expect(document.getElementById('pwa-install-overlay').classList.contains('open')).toBe(true);
    });

    it('handles accepted install from banner and marks app as installed', async () => {
        await EphemeraPWA.init();
        const { event, prompt } = createInstallPromptEvent('accepted');
        window.dispatchEvent(event);

        document.querySelector('#pwa-install-banner [data-action="install"]').click();
        await flushMicrotasks();

        expect(prompt).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem(EphemeraPWA.INSTALLED_KEY)).toBe('1');
        expect(localStorage.getItem(EphemeraPWA.POST_INSTALL_SPLASH_KEY)).toBe('1');
        expect(window.EphemeraTelemetry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
            category: 'pwa',
            message: 'install accepted from banner'
        }));
        expect(document.getElementById('pwa-install-banner').classList.contains('open')).toBe(false);
    });

    it('handles appinstalled event by persisting install and notifying user', async () => {
        await EphemeraPWA.init();
        const { event } = createInstallPromptEvent();
        window.dispatchEvent(event);

        window.dispatchEvent(new Event('appinstalled'));

        expect(localStorage.getItem(EphemeraPWA.INSTALLED_KEY)).toBe('1');
        expect(localStorage.getItem(EphemeraPWA.POST_INSTALL_SPLASH_KEY)).toBe('1');
        expect(window.EphemeraNotifications.success).toHaveBeenCalledWith('Installed', 'Ephemera is now installed.');
        expect(document.getElementById('pwa-install-banner').classList.contains('open')).toBe(false);
    });

    it('shows post-install splash in standalone mode and removes it after animation', async () => {
        vi.useFakeTimers();
        localStorage.setItem(EphemeraPWA.POST_INSTALL_SPLASH_KEY, '1');
        window.matchMedia = vi.fn((query) => ({
            matches: query === '(display-mode: standalone)'
        }));

        const initPromise = EphemeraPWA.init();
        expect(document.getElementById('pwa-post-install-splash')).toBeTruthy();

        await vi.advanceTimersByTimeAsync(1300);
        await initPromise;

        expect(document.getElementById('pwa-post-install-splash')).toBeNull();
        expect(localStorage.getItem(EphemeraPWA.POST_INSTALL_SPLASH_KEY)).toBeNull();
    });
});
