import { beforeEach, describe, expect, it, vi } from 'vitest';

function createCanvasContextMock() {
    return {
        clearRect: vi.fn(),
        createRadialGradient: vi.fn(() => ({
            addColorStop: vi.fn()
        })),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        closePath: vi.fn(),
        fillText: vi.fn()
    };
}

describe('EphemeraBoot reduced motion wallpaper handling', () => {
    beforeEach(async () => {
        vi.resetModules();
        document.body.innerHTML = `
            <main id="desktop"></main>
            <canvas id="wallpaper-canvas"></canvas>
            <button class="wallpaper-option" data-wallpaper="matrix"></button>
            <button class="wallpaper-option" data-wallpaper="particles"></button>
        `;

        const canvas = document.getElementById('wallpaper-canvas');
        canvas.getContext = vi.fn(() => createCanvasContextMock());

        window.EphemeraState = {
            currentWorkspace: 0,
            workspaces: [[]],
            workspaceWallpapers: ['solid'],
            wallpaper: 'solid',
            save: vi.fn(),
            shellMode: 'desktop'
        };
        global.EphemeraState = window.EphemeraState;

        window.EphemeraEvents = {
            on: vi.fn(() => () => {}),
            emit: vi.fn()
        };
        global.EphemeraEvents = window.EphemeraEvents;

        global.requestAnimationFrame = vi.fn(() => 1);
        global.cancelAnimationFrame = vi.fn();
        window.requestAnimationFrame = global.requestAnimationFrame;
        window.cancelAnimationFrame = global.cancelAnimationFrame;

        await import('../js/core/boot.js');
    });

    it('keeps desktop category icons UTF-safe (no mojibake literals)', () => {
        const categories = window.EphemeraBoot.APP_CATEGORIES;
        expect(categories.system.icon).toBe('\u2699\uFE0F');
        expect(categories.productivity.icon).toBe('\uD83D\uDCCB');
        expect(categories.utility.icon).toBe('\uD83D\uDD27');
        expect(categories.development.icon).toBe('\uD83D\uDCBB');
        expect(categories.media.icon).toBe('\uD83C\uDFAC');
        expect(categories.creative.icon).toBe('\uD83C\uDFA8');
        expect(categories.internet.icon).toBe('\uD83C\uDF10');
        expect(categories.games.icon).toBe('\uD83C\uDFAE');
        expect(categories.user.icon).toBe('\uD83D\uDCF1');
    });

    it('renders animated wallpaper as static fallback when reduced motion is enabled', () => {
        window.EphemeraMotion = { isReducedMotion: vi.fn(() => true) };
        global.EphemeraMotion = window.EphemeraMotion;

        window.EphemeraBoot.setWallpaperForCurrentWorkspace('matrix', {
            persist: false,
            syncSelection: true
        });

        const desktop = document.getElementById('desktop');
        const canvas = document.getElementById('wallpaper-canvas');

        expect(window.EphemeraState.wallpaper).toBe('matrix');
        expect(desktop.style.backgroundColor).toContain('10, 10, 15');
        expect(canvas.style.display).toBe('none');
        expect(global.requestAnimationFrame).not.toHaveBeenCalled();
    });

    it('starts particle animation when reduced motion is disabled', () => {
        window.EphemeraMotion = { isReducedMotion: vi.fn(() => false) };
        global.EphemeraMotion = window.EphemeraMotion;

        window.EphemeraBoot.setWallpaperForCurrentWorkspace('particles', {
            persist: false,
            syncSelection: true
        });

        const canvas = document.getElementById('wallpaper-canvas');
        expect(window.EphemeraState.wallpaper).toBe('particles');
        expect(canvas.style.display).toBe('block');
        expect(global.requestAnimationFrame).toHaveBeenCalled();
    });
});
