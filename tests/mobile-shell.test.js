import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { stateMock, eventsMock } from './setup.js';

window.EphemeraApps = {
    getAll: vi.fn(() => [])
};

window.EphemeraWM = {
    open: vi.fn(() => 1),
    close: vi.fn(async () => {})
};

if (typeof globalThis.EphemeraState === 'undefined') {
    globalThis.EphemeraState = stateMock;
}

import '../js/system/mobile-shell.js';

const EphemeraMobileShell = window.EphemeraMobileShell;

function resetMobileState() {
    stateMock.windows = [];
    stateMock.activeWindowId = null;
    stateMock.shellMode = 'mobile';
    document.body.classList.remove('mobile-shell-mode', 'app-active');
}

function pointerEvent(type, x, y) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clientX', { value: x });
    Object.defineProperty(event, 'clientY', { value: y });
    return event;
}

describe('EphemeraMobileShell', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="windows-container"></div>';
        resetMobileState();
        eventsMock._reset();
        vi.clearAllMocks();
    });

    afterEach(() => {
        EphemeraMobileShell.destroy();
        vi.useRealTimers();
    });

    it('should initialize and render only visible apps', () => {
        window.EphemeraApps.getAll.mockReturnValue([
            { id: 'calculator', name: 'Calculator', category: 'utility', icon: '<svg></svg>' },
            { id: 'hidden-app', name: 'Hidden', category: 'hidden', icon: '<svg></svg>' },
            { id: 'notepad', name: 'Notepad', category: 'productivity', icon: '<svg></svg>' }
        ]);

        EphemeraMobileShell.init();

        expect(document.body.classList.contains('mobile-shell-mode')).toBe(true);
        expect(document.querySelectorAll('.mobile-app-button').length).toBe(2);
    });

    it('should open apps in mobile fullscreen mode from launcher', () => {
        window.EphemeraApps.getAll.mockReturnValue([
            { id: 'calculator', name: 'Calculator', category: 'utility', icon: '<svg></svg>' }
        ]);

        EphemeraMobileShell.init();
        document.querySelector('.mobile-app-button').click();

        expect(window.EphemeraWM.open).toHaveBeenCalledWith('calculator', { mobileFullscreen: true });
    });

    it('should close the active window when pressing back', async () => {
        window.EphemeraApps.getAll.mockReturnValue([]);
        stateMock.windows = [{ id: 11 }, { id: 12 }];
        stateMock.activeWindowId = 12;

        window.EphemeraWM.close.mockImplementation(async (windowId) => {
            stateMock.windows = stateMock.windows.filter(win => win.id !== windowId);
            stateMock.activeWindowId = stateMock.windows[stateMock.windows.length - 1]?.id ?? null;
        });

        EphemeraMobileShell.init();
        document.getElementById('mobile-nav-back').click();
        await Promise.resolve();

        expect(window.EphemeraWM.close).toHaveBeenCalledWith(12);
    });

    it('should close all windows when going home', async () => {
        window.EphemeraApps.getAll.mockReturnValue([]);
        stateMock.windows = [{ id: 21 }, { id: 22 }];
        stateMock.activeWindowId = 22;

        window.EphemeraWM.close.mockImplementation(async (windowId) => {
            stateMock.windows = stateMock.windows.filter(win => win.id !== windowId);
            stateMock.activeWindowId = stateMock.windows[stateMock.windows.length - 1]?.id ?? null;
        });

        EphemeraMobileShell.init();
        await EphemeraMobileShell.goHome();

        expect(window.EphemeraWM.close).toHaveBeenCalledTimes(2);
        expect(window.EphemeraWM.close).toHaveBeenNthCalledWith(1, 22);
        expect(window.EphemeraWM.close).toHaveBeenNthCalledWith(2, 21);
    });

    it('should close the active window via left-edge back gesture', async () => {
        window.EphemeraApps.getAll.mockReturnValue([]);
        stateMock.windows = [{ id: 31 }];
        stateMock.activeWindowId = 31;

        window.EphemeraWM.close.mockImplementation(async (windowId) => {
            stateMock.windows = stateMock.windows.filter(win => win.id !== windowId);
            stateMock.activeWindowId = null;
        });

        EphemeraMobileShell.init();

        document.dispatchEvent(pointerEvent('pointerdown', 12, 200));
        document.dispatchEvent(pointerEvent('pointerup', 100, 204));
        await Promise.resolve();

        expect(window.EphemeraWM.close).toHaveBeenCalledWith(31);
    });
});
