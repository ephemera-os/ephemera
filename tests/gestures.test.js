import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { stateMock } from './setup.js';

if (typeof globalThis.EphemeraState === 'undefined') {
    globalThis.EphemeraState = stateMock;
}

window.EphemeraBoot = {
    switchWorkspace: vi.fn((nextWorkspace) => {
        stateMock.currentWorkspace = nextWorkspace;
    })
};
globalThis.EphemeraBoot = window.EphemeraBoot;

import '../js/system/gestures.js';

const EphemeraGestures = window.EphemeraGestures;

function setViewport(width, height = 800) {
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: width
    });
    Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        writable: true,
        value: height
    });
}

function pointerEvent(type, { pointerId, pointerType = 'touch', clientX, clientY }) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'pointerId', { value: pointerId, configurable: true });
    Object.defineProperty(event, 'pointerType', { value: pointerType, configurable: true });
    Object.defineProperty(event, 'clientX', { value: clientX, configurable: true });
    Object.defineProperty(event, 'clientY', { value: clientY, configurable: true });
    return event;
}

function createWindow({ id = 1, left = 80, top = 60, width = 400, height = 300 } = {}) {
    const win = document.createElement('div');
    win.className = 'window';
    win.id = `window-${id}`;
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
    win.style.width = `${width}px`;
    win.style.height = `${height}px`;
    win.innerHTML = `
        <div class="window-header"></div>
        <div class="window-content"></div>
    `;
    document.getElementById('windows-container').appendChild(win);
    return win;
}

describe('EphemeraGestures', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        setViewport(900, 760);
        document.body.innerHTML = `
            <main id="desktop"></main>
            <button id="start-btn" aria-expanded="false"></button>
            <div id="start-menu"></div>
            <div id="context-menu" style="display:none;position:fixed;">
                <button class="context-item"></button>
            </div>
            <div id="windows-container"></div>
        `;
        stateMock.shellMode = 'desktop';
        stateMock.currentWorkspace = 0;
        stateMock.workspaces = [[], [], [], []];
        window.EphemeraBoot.switchWorkspace.mockClear();
    });

    afterEach(() => {
        EphemeraGestures.destroy();
        vi.useRealTimers();
    });

    it('opens desktop context menu on long-press for touch input', () => {
        EphemeraGestures.init();
        const desktop = document.getElementById('desktop');

        desktop.dispatchEvent(pointerEvent('pointerdown', {
            pointerId: 1,
            clientX: 140,
            clientY: 160
        }));
        vi.advanceTimersByTime(600);

        const menu = document.getElementById('context-menu');
        expect(menu.style.display).toBe('block');
        expect(menu.style.left).toBe('140px');
    });

    it('switches workspace on left-edge swipe', () => {
        EphemeraGestures.init();

        document.dispatchEvent(pointerEvent('pointerdown', {
            pointerId: 2,
            clientX: 6,
            clientY: 180
        }));
        document.dispatchEvent(pointerEvent('pointermove', {
            pointerId: 2,
            clientX: 120,
            clientY: 180
        }));

        expect(window.EphemeraBoot.switchWorkspace).toHaveBeenCalledWith(1);
    });

    it('opens app drawer on right-edge swipe', () => {
        EphemeraGestures.init();
        const startX = window.innerWidth - 4;

        document.dispatchEvent(pointerEvent('pointerdown', {
            pointerId: 3,
            clientX: startX,
            clientY: 220
        }));
        document.dispatchEvent(pointerEvent('pointermove', {
            pointerId: 3,
            clientX: startX - 120,
            clientY: 222
        }));

        expect(document.getElementById('start-menu').classList.contains('open')).toBe(true);
        expect(document.getElementById('start-btn').getAttribute('aria-expanded')).toBe('true');
    });

    it('resizes windows with pinch gesture', () => {
        const win = createWindow();
        const header = win.querySelector('.window-header');
        EphemeraGestures.init();

        header.dispatchEvent(pointerEvent('pointerdown', {
            pointerId: 10,
            clientX: 120,
            clientY: 100
        }));
        header.dispatchEvent(pointerEvent('pointerdown', {
            pointerId: 11,
            clientX: 220,
            clientY: 100
        }));
        header.dispatchEvent(pointerEvent('pointermove', {
            pointerId: 11,
            clientX: 300,
            clientY: 100
        }));

        expect(parseFloat(win.style.width)).toBeGreaterThan(400);
        expect(parseFloat(win.style.height)).toBeGreaterThan(300);
    });

    it('moves windows with two-finger drag gesture', () => {
        const win = createWindow({ left: 90, top: 70 });
        const header = win.querySelector('.window-header');
        EphemeraGestures.init();

        header.dispatchEvent(pointerEvent('pointerdown', {
            pointerId: 20,
            clientX: 120,
            clientY: 100
        }));
        header.dispatchEvent(pointerEvent('pointerdown', {
            pointerId: 21,
            clientX: 220,
            clientY: 100
        }));
        header.dispatchEvent(pointerEvent('pointermove', {
            pointerId: 20,
            clientX: 180,
            clientY: 140
        }));
        header.dispatchEvent(pointerEvent('pointermove', {
            pointerId: 21,
            clientX: 280,
            clientY: 140
        }));

        expect(parseFloat(win.style.left)).toBeGreaterThan(90);
        expect(parseFloat(win.style.top)).toBeGreaterThan(70);
    });
});
