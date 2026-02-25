import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventsMock, stateMock } from './setup.js';

// Minimal EphemeraApps mock
window.EphemeraApps = {
    LAZY_LOADABLE_APPS: {},
    isLoaded: vi.fn(() => true),
    lazyLoad: vi.fn(async () => true),
    get: vi.fn((appId) => {
        if (appId === 'unknown') return null;
        return {
            id: appId,
            name: appId.charAt(0).toUpperCase() + appId.slice(1),
            icon: '<svg></svg>',
            width: 600,
            height: 400,
            content: () => ({ html: '<div>App content</div>' })
        };
    })
};

// Minimal EphemeraDialog mock
window.EphemeraDialog = {
    show: vi.fn(async () => 'cancel')
};

// EphemeraSounds mock
window.EphemeraSounds = {
    windowOpen: vi.fn(),
    windowClose: vi.fn()
};

// EphemeraSanitize mock (may already exist from setup)
if (!window.EphemeraSanitize) {
    window.EphemeraSanitize = {
        escapeHtml: vi.fn(s => String(s)),
        escapeAttr: vi.fn(s => String(s)),
        sanitizeHtml: vi.fn(s => String(s))
    };
}

// Import WM after mocks are set up
import '../js/system/window-manager.js';

const EphemeraWM = window.EphemeraWM;

function resetState() {
    stateMock.windows = [];
    stateMock.activeWindowId = null;
    stateMock.windowIdCounter = 1;
    stateMock.currentWorkspace = 0;
    stateMock.workspaces = [[], [], [], []];
    delete stateMock.shellMode;
    document.body.classList.remove('mobile-shell-mode');
    document.body.classList.remove('app-active');
    EphemeraWM._dirtyWindows.clear();
    EphemeraWM._modalBackdrops.clear();
    EphemeraWM._modalParents.clear();
    EphemeraWM._blockedParents.clear();
    EphemeraWM._dragState = null;
    EphemeraWM._resizeState = null;
    EphemeraWM._globalHandlersAttached = false;
    EphemeraWM.snapPreviewEl = null;
}

// Patch EphemeraState reference used by WM (it uses global EphemeraState not window.)
// WM reads EphemeraState directly, so point global to our mock
if (typeof globalThis.EphemeraState === 'undefined') {
    globalThis.EphemeraState = stateMock;
}

describe('EphemeraWM', () => {
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = `
            <div id="windows-container"></div>
            <div id="taskbar-apps"></div>
        `;
        resetState();
        eventsMock._reset();
        vi.clearAllMocks();
        delete window.EphemeraBoot;
    });

    // --- Dirty state tracking ---

    describe('setDirty / isDirty', () => {
        it('should mark a window as dirty', () => {
            EphemeraWM.setDirty(1, true);
            expect(EphemeraWM.isDirty(1)).toBe(true);
        });

        it('should clear dirty state', () => {
            EphemeraWM.setDirty(1, true);
            EphemeraWM.setDirty(1, false);
            expect(EphemeraWM.isDirty(1)).toBe(false);
        });

        it('should return false for non-dirty windows', () => {
            expect(EphemeraWM.isDirty(999)).toBe(false);
        });
    });

    // --- Window open ---

    describe('open', () => {
        it('should create a window and return windowId', () => {
            const id = EphemeraWM.open('editor');
            expect(id).toBe(1);
            expect(EphemeraState.windows.length).toBe(1);
        });

        it('should add window element to DOM', () => {
            EphemeraWM.open('editor');
            const windowEl = document.getElementById('window-1');
            expect(windowEl).not.toBeNull();
            expect(windowEl.classList.contains('window')).toBe(true);
        });

        it('should return null for unknown app', () => {
            const id = EphemeraWM.open('unknown');
            expect(id).toBeNull();
        });

        it('should emit window:opened event', () => {
            EphemeraWM.open('editor');
            expect(eventsMock.emit).toHaveBeenCalledWith('window:opened', { windowId: 1, appId: 'editor' });
        });

        it('should play window open sound', () => {
            EphemeraWM.open('editor');
            expect(EphemeraSounds.windowOpen).toHaveBeenCalled();
        });

        it('should add taskbar entry', () => {
            EphemeraWM.open('editor');
            const taskbarApp = document.querySelector('.taskbar-app');
            expect(taskbarApp).not.toBeNull();
            expect(taskbarApp.dataset.windowId).toBe('1');
        });

        it('should make window element focusable and focused on open', () => {
            EphemeraWM.open('editor');
            const windowEl = document.getElementById('window-1');
            expect(windowEl.getAttribute('tabindex')).toBe('-1');
            expect(document.activeElement).toBe(windowEl);
        });

        it('should set window dimensions from app defaults', () => {
            EphemeraWM.open('editor');
            const windowEl = document.getElementById('window-1');
            expect(windowEl.style.width).toBe('600px');
            // height = app height + headerHeight
            expect(windowEl.style.height).toBe('440px');
        });

        it('should use custom dimensions from options', () => {
            EphemeraWM.open('editor', { width: 800, height: 500, x: 200, y: 100 });
            const windowEl = document.getElementById('window-1');
            expect(windowEl.style.width).toBe('800px');
            expect(windowEl.style.left).toBe('200px');
            expect(windowEl.style.top).toBe('100px');
        });

        it('should add window to current workspace', () => {
            EphemeraWM.open('editor');
            expect(EphemeraState.workspaces[0]).toContain(1);
        });

        it('should increment window ID counter', () => {
            EphemeraWM.open('editor');
            EphemeraWM.open('terminal');
            expect(EphemeraState.windows.length).toBe(2);
            expect(EphemeraState.windows[0].id).toBe(1);
            expect(EphemeraState.windows[1].id).toBe(2);
        });

        it('should open fullscreen windows without taskbar entries in mobile shell mode', () => {
            stateMock.shellMode = 'mobile';
            document.body.classList.add('mobile-shell-mode');

            EphemeraWM.open('editor');
            const windowEl = document.getElementById('window-1');

            expect(windowEl.classList.contains('mobile-fullscreen')).toBe(true);
            expect(windowEl.classList.contains('maximized')).toBe(true);
            expect(document.querySelector('.taskbar-app')).toBeNull();
        });
    });

    // --- Window close ---

    describe('close', () => {
        it('should remove window from state and DOM', async () => {
            EphemeraWM.open('editor');
            expect(EphemeraState.windows.length).toBe(1);

            await EphemeraWM.close(1);
            expect(EphemeraState.windows.length).toBe(0);
            expect(document.getElementById('window-1')).toBeNull();
        });

        it('should emit window:closed event', async () => {
            EphemeraWM.open('editor');
            vi.clearAllMocks();

            await EphemeraWM.close(1);
            expect(eventsMock.emit).toHaveBeenCalledWith('window:closed', { windowId: 1, appId: 'editor' });
        });

        it('should remove window from workspace', async () => {
            EphemeraWM.open('editor');
            expect(EphemeraState.workspaces[0]).toContain(1);

            await EphemeraWM.close(1);
            expect(EphemeraState.workspaces[0]).not.toContain(1);
        });

        it('should remove taskbar entry', async () => {
            EphemeraWM.open('editor');
            expect(document.querySelector('.taskbar-app')).not.toBeNull();

            await EphemeraWM.close(1);
            expect(document.querySelector('.taskbar-app[data-window-id="1"]')).toBeNull();
        });

        it('should play window close sound', async () => {
            EphemeraWM.open('editor');
            vi.clearAllMocks();

            await EphemeraWM.close(1);
            expect(EphemeraSounds.windowClose).toHaveBeenCalled();
        });

        it('should do nothing for nonexistent window', async () => {
            await EphemeraWM.close(999);
            // Should not throw
        });

        it('should clear dirty state on close', async () => {
            EphemeraWM.open('editor');
            EphemeraWM.setDirty(1, true);

            // Mock dialog to return 'discard' so close proceeds
            window.EphemeraDialog.show.mockResolvedValueOnce('discard');

            await EphemeraWM.close(1);
            expect(EphemeraWM.isDirty(1)).toBe(false);
        });

        it('should focus previous window when closing active window', async () => {
            EphemeraWM.open('editor');
            EphemeraWM.open('terminal');
            expect(EphemeraState.activeWindowId).toBe(2);

            await EphemeraWM.close(2);
            expect(EphemeraState.activeWindowId).toBe(1);
            expect(document.activeElement).toBe(document.getElementById('window-1'));
        });

        it('should clear activeWindowId when closing last window', async () => {
            EphemeraWM.open('editor');
            expect(EphemeraState.activeWindowId).toBe(1);

            await EphemeraWM.close(1);
            expect(EphemeraState.activeWindowId).toBeNull();
        });
    });

    // --- Minimize ---

    describe('minimize', () => {
        it('should add minimized class to window', () => {
            EphemeraWM.open('editor');
            EphemeraWM.minimize(1);
            const windowEl = document.getElementById('window-1');
            expect(windowEl.classList.contains('minimized')).toBe(true);
        });

        it('should emit window:minimized event', () => {
            EphemeraWM.open('editor');
            vi.clearAllMocks();

            EphemeraWM.minimize(1);
            expect(eventsMock.emit).toHaveBeenCalledWith('window:minimized', { windowId: 1 });
        });
    });

    // --- Maximize ---

    describe('toggleMaximize', () => {
        it('should toggle maximized class', () => {
            EphemeraWM.open('editor');
            const windowEl = document.getElementById('window-1');

            EphemeraWM.toggleMaximize(1);
            expect(windowEl.classList.contains('maximized')).toBe(true);

            EphemeraWM.toggleMaximize(1);
            expect(windowEl.classList.contains('maximized')).toBe(false);
        });

        it('should remove snap classes when maximizing', () => {
            EphemeraWM.open('editor');
            const windowEl = document.getElementById('window-1');
            windowEl.classList.add('snapped-left');

            EphemeraWM.toggleMaximize(1);
            expect(windowEl.classList.contains('snapped-left')).toBe(false);
        });

        it('should emit window:maximized event', () => {
            EphemeraWM.open('editor');
            vi.clearAllMocks();

            EphemeraWM.toggleMaximize(1);
            expect(eventsMock.emit).toHaveBeenCalledWith('window:maximized', { windowId: 1 });
        });
    });

    // --- Focus ---

    describe('focusWindow', () => {
        it('should set activeWindowId', () => {
            EphemeraWM.open('editor');
            EphemeraWM.open('terminal');
            EphemeraWM.focusWindow(1);
            expect(EphemeraState.activeWindowId).toBe(1);
        });

        it('should unminimize a minimized window', () => {
            EphemeraWM.open('editor');
            EphemeraWM.minimize(1);
            const windowEl = document.getElementById('window-1');
            expect(windowEl.classList.contains('minimized')).toBe(true);

            EphemeraWM.focusWindow(1);
            expect(windowEl.classList.contains('minimized')).toBe(false);
        });

        it('should emit window:focused event', () => {
            EphemeraWM.open('editor');
            vi.clearAllMocks();

            EphemeraWM.focusWindow(1);
            expect(eventsMock.emit).toHaveBeenCalledWith('window:focused', { windowId: 1 });
        });

        it('should focus window element when focusing window', () => {
            EphemeraWM.open('editor');
            EphemeraWM.open('terminal');

            EphemeraWM.focusWindow(1);
            expect(document.activeElement).toBe(document.getElementById('window-1'));
        });

        it('should reorder windows for z-index', () => {
            EphemeraWM.open('editor');     // id=1
            EphemeraWM.open('terminal');   // id=2

            EphemeraWM.focusWindow(1);
            // Window 1 should now be last in the array (highest z)
            const lastWin = EphemeraState.windows[EphemeraState.windows.length - 1];
            expect(lastWin.id).toBe(1);
        });
    });

    // --- Snap ---

    describe('snapWindow', () => {
        it('should add snap class to window', () => {
            EphemeraWM.open('editor');
            EphemeraWM.snapWindow(1, 'left');
            const windowEl = document.getElementById('window-1');
            expect(windowEl.classList.contains('snapped-left')).toBe(true);
        });

        it('should remove previous snap classes', () => {
            EphemeraWM.open('editor');
            EphemeraWM.snapWindow(1, 'left');
            EphemeraWM.snapWindow(1, 'right');
            const windowEl = document.getElementById('window-1');
            expect(windowEl.classList.contains('snapped-left')).toBe(false);
            expect(windowEl.classList.contains('snapped-right')).toBe(true);
        });

        it('should emit window:snapped event', () => {
            EphemeraWM.open('editor');
            vi.clearAllMocks();

            EphemeraWM.snapWindow(1, 'tl');
            expect(eventsMock.emit).toHaveBeenCalledWith('window:snapped', { windowId: 1, side: 'tl' });
        });

        it('should handle all snap positions', () => {
            const positions = ['left', 'right', 'tl', 'tr', 'bl', 'br'];
            EphemeraWM.open('editor');
            const windowEl = document.getElementById('window-1');

            for (const pos of positions) {
                EphemeraWM.snapWindow(1, pos);
                expect(windowEl.classList.contains(`snapped-${pos}`)).toBe(true);
            }
        });
    });

    describe('workspace helpers', () => {
        it('should resolve a window workspace index', () => {
            EphemeraWM.open('editor');
            expect(EphemeraWM.getWindowWorkspace(1)).toBe(0);
            expect(EphemeraWM.getWindowWorkspace(999)).toBe(-1);
        });

        it('should move a window to another workspace and emit event', () => {
            EphemeraWM.open('editor');
            vi.clearAllMocks();

            const moved = EphemeraWM.moveToWorkspace(1, 2);

            expect(moved).toBe(true);
            expect(EphemeraState.workspaces[0]).not.toContain(1);
            expect(EphemeraState.workspaces[2]).toContain(1);
            expect(eventsMock.emit).toHaveBeenCalledWith('window:moved-workspace', {
                windowId: 1,
                fromWorkspace: 0,
                toWorkspace: 2
            });
        });

        it('should hide and deactivate active window when moved away from current workspace', () => {
            EphemeraWM.open('editor');
            const windowEl = document.getElementById('window-1');
            EphemeraState.activeWindowId = 1;

            const moved = EphemeraWM.moveToWorkspace(1, 3);

            expect(moved).toBe(true);
            expect(windowEl.style.display).toBe('none');
            expect(EphemeraState.activeWindowId).toBeNull();
        });

        it('should reveal window when moved into current workspace', () => {
            EphemeraWM.open('editor');
            const windowEl = document.getElementById('window-1');
            EphemeraState.currentWorkspace = 1;
            windowEl.style.display = 'none';

            const moved = EphemeraWM.moveToWorkspace(1, 1, { focus: false });

            expect(moved).toBe(true);
            expect(EphemeraState.workspaces[0]).not.toContain(1);
            expect(EphemeraState.workspaces[1]).toContain(1);
            expect(windowEl.style.display).toBe('flex');
        });

        it('should switch workspace when move option requests it', () => {
            window.EphemeraBoot = { switchWorkspace: vi.fn() };
            EphemeraWM.open('editor');

            const moved = EphemeraWM.moveToWorkspace(1, 2, { switchTo: true });

            expect(moved).toBe(true);
            expect(window.EphemeraBoot.switchWorkspace).toHaveBeenCalledWith(2);
        });
    });

    // --- Lookup helpers ---

    describe('getWindow / getWindowsByApp', () => {
        it('should return window by id', () => {
            EphemeraWM.open('editor');
            const win = EphemeraWM.getWindow(1);
            expect(win).toBeDefined();
            expect(win.appId).toBe('editor');
        });

        it('should return undefined for nonexistent id', () => {
            expect(EphemeraWM.getWindow(999)).toBeUndefined();
        });

        it('should return windows by app id', () => {
            EphemeraWM.open('editor');
            EphemeraWM.open('editor');
            EphemeraWM.open('terminal');

            const editors = EphemeraWM.getWindowsByApp('editor');
            expect(editors.length).toBe(2);
        });
    });

    // --- Unsaved changes / confirm close ---

    describe('confirmClose', () => {
        it('should return true if window is not dirty', async () => {
            EphemeraWM.open('editor');
            const result = await EphemeraWM.confirmClose(1);
            expect(result).toBe(true);
        });

        it('should show dialog for dirty window', async () => {
            EphemeraWM.open('editor');
            EphemeraWM.setDirty(1, true);
            window.EphemeraDialog.show.mockResolvedValueOnce('discard');

            const result = await EphemeraWM.confirmClose(1);
            expect(result).toBe(true);
            expect(window.EphemeraDialog.show).toHaveBeenCalled();
        });

        it('should return false when user cancels', async () => {
            EphemeraWM.open('editor');
            EphemeraWM.setDirty(1, true);
            window.EphemeraDialog.show.mockResolvedValueOnce('cancel');

            const result = await EphemeraWM.confirmClose(1);
            expect(result).toBe(false);
        });
    });

    // --- Cascade / Tile ---

    describe('cascadeAll', () => {
        it('should reposition all windows in cascade', () => {
            EphemeraWM.open('editor');
            EphemeraWM.open('terminal');
            EphemeraWM.cascadeAll();

            const win1 = document.getElementById('window-1');
            const win2 = document.getElementById('window-2');
            expect(win1.style.left).toBe('80px');
            expect(win2.style.left).toBe('110px');
        });

        it('should remove maximize/snap classes', () => {
            EphemeraWM.open('editor');
            const windowEl = document.getElementById('window-1');
            windowEl.classList.add('maximized', 'snapped-left');

            EphemeraWM.cascadeAll();
            expect(windowEl.classList.contains('maximized')).toBe(false);
            expect(windowEl.classList.contains('snapped-left')).toBe(false);
        });
    });

    // --- Destroy ---

    describe('destroy', () => {
        it('should close all windows and clean up', () => {
            EphemeraWM.open('editor');
            EphemeraWM.open('terminal');
            EphemeraWM.setDirty(1, true);

            // Mock confirmClose to allow close for dirty windows
            window.EphemeraDialog.show.mockResolvedValue('discard');

            EphemeraWM.destroy();
            // Dirty set should be cleared even if close is async
            expect(EphemeraWM._dirtyWindows.size).toBe(0);
        });
    });
});
