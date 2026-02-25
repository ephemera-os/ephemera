import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../js/system/shortcuts.js';

const EphemeraShortcuts = window.EphemeraShortcuts;

describe('EphemeraShortcuts command palette bindings', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="start-menu"></div>';

        window.EphemeraWM = {
            open: vi.fn(),
            close: vi.fn(),
            focusWindow: vi.fn(),
            toggleMaximize: vi.fn(),
            moveToWorkspace: vi.fn()
        };
        window.EphemeraBoot = {
            switchWorkspace: vi.fn(),
            toggleWorkspaceOverview: vi.fn()
        };
        window.EphemeraAIAssistant = {
            toggle: vi.fn()
        };
        window.EphemeraCommandPalette = {
            toggle: vi.fn()
        };

        window.EphemeraState.activeWindowId = null;
        window.EphemeraState.windows = [];
        window.EphemeraState.currentWorkspace = 0;
        window.EphemeraState.workspaces = [[], [], [], []];

        // Used by the existing Meta shortcut.
        globalThis.toggleStartMenu = vi.fn();

        EphemeraShortcuts._resetForTests();
        EphemeraShortcuts.init();
    });

    it('opens actions mode with Ctrl+Shift+P and files mode with Ctrl+P', () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'p',
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true
        }));
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'p',
            ctrlKey: true,
            bubbles: true,
            cancelable: true
        }));

        expect(window.EphemeraCommandPalette.toggle).toHaveBeenCalledWith('actions');
        expect(window.EphemeraCommandPalette.toggle).toHaveBeenCalledWith('files');
    });

    it('does not register duplicate key listeners when init is called repeatedly', () => {
        EphemeraShortcuts.init();

        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'p',
            ctrlKey: true,
            bubbles: true,
            cancelable: true
        }));

        expect(window.EphemeraCommandPalette.toggle).toHaveBeenCalledTimes(1);
    });

    it('switches workspace with Ctrl+1', () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: '1',
            ctrlKey: true,
            bubbles: true,
            cancelable: true
        }));

        expect(window.EphemeraBoot.switchWorkspace).toHaveBeenCalledWith(0);
    });

    it('moves active window with Ctrl+Shift+2', () => {
        window.EphemeraState.activeWindowId = 42;

        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: '2',
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true
        }));

        expect(window.EphemeraWM.moveToWorkspace).toHaveBeenCalledWith(42, 1, { switchTo: true });
    });

    it('opens workspace overview with Meta+Tab', () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Tab',
            metaKey: true,
            bubbles: true,
            cancelable: true
        }));

        expect(window.EphemeraBoot.toggleWorkspaceOverview).toHaveBeenCalled();
    });
});
