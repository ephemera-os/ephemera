import { beforeEach, describe, expect, it, vi } from 'vitest';

let appDefs = {};

function createLifecycleStub() {
    return {
        addListener(target, type, handler, options) {
            target.addEventListener(type, handler, options);
            return handler;
        },
        addInterval(id) { return id; },
        addTimeout(id) { return id; },
        addSubscription(unsub) { return unsub; },
        destroy() {}
    };
}

function pointerEvent(type, { pointerId = 1, pointerType = 'touch', clientX = 0, clientY = 0 } = {}) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'pointerId', { value: pointerId, configurable: true });
    Object.defineProperty(event, 'pointerType', { value: pointerType, configurable: true });
    Object.defineProperty(event, 'clientX', { value: clientX, configurable: true });
    Object.defineProperty(event, 'clientY', { value: clientY, configurable: true });
    return event;
}

async function flushAsync(iterations = 5) {
    for (let i = 0; i < iterations; i++) {
        await Promise.resolve();
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

function normalizePath(path) {
    return String(path || '')
        .replace(/\/{2,}/g, '/')
        .replace(/\/$/, '') || '/';
}

function getParentDir(path) {
    const normalized = normalizePath(path);
    if (normalized === '/') return '/';
    const idx = normalized.lastIndexOf('/');
    return idx <= 0 ? '/' : normalized.slice(0, idx);
}

describe('Mobile App Variants', () => {
    beforeEach(async () => {
        vi.resetModules();
        appDefs = {};
        document.body.innerHTML = '';

        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 });

        window.EphemeraApps = {
            register: vi.fn(app => {
                appDefs[app.id] = app;
                return app;
            }),
            getAll: vi.fn(() => []),
            createManifestTemplate: vi.fn(() => ({})),
            createCodeTemplate: vi.fn(() => '')
        };
        global.EphemeraApps = window.EphemeraApps;

        window.EphemeraState = {
            shellMode: 'mobile',
            user: { name: 'Test User', homeDir: '/home/user' },
            settings: { proxyEnabled: true, proxyUrl: '' }
        };
        global.EphemeraState = window.EphemeraState;

        window.EphemeraFS = {
            homeDir: '/home/user',
            normalizePath,
            getParentDir,
            getBasename: path => normalizePath(path).split('/').pop(),
            readdir: vi.fn(async () => []),
            stat: vi.fn(async () => null),
            readFile: vi.fn(async () => ''),
            writeFile: vi.fn(async () => {}),
            mkdir: vi.fn(async () => {}),
            delete: vi.fn(async () => true),
            copy: vi.fn(async () => {}),
            move: vi.fn(async () => {}),
            getIcon: vi.fn(() => '<svg></svg>'),
            getMimeType: vi.fn(() => 'text/plain')
        };
        global.EphemeraFS = window.EphemeraFS;

        window.EphemeraStorage = {
            get: vi.fn(async () => null),
            put: vi.fn(async () => {}),
            delete: vi.fn(async () => {})
        };
        global.EphemeraStorage = window.EphemeraStorage;

        window.EphemeraDialog = {
            confirm: vi.fn(async () => true),
            prompt: vi.fn(async () => 'untitled.txt')
        };
        global.EphemeraDialog = window.EphemeraDialog;

        window.EphemeraWM = {
            open: vi.fn(),
            close: vi.fn(),
            getWindow: vi.fn(() => ({ id: 1, options: {} })),
            setDirty: vi.fn(),
            promptUnsavedChanges: vi.fn(async () => 'discard')
        };
        global.EphemeraWM = window.EphemeraWM;

        window.EphemeraNotifications = {
            success: vi.fn(),
            error: vi.fn(),
            warning: vi.fn(),
            info: vi.fn()
        };
        global.EphemeraNotifications = window.EphemeraNotifications;

        window.EphemeraSanitize = {
            escapeHtml: vi.fn(v => String(v)),
            escapeAttr: vi.fn(v => String(v))
        };
        global.EphemeraSanitize = window.EphemeraSanitize;

        window.EphemeraNetwork = {
            get: vi.fn(async () => ''),
            isProxyEnabled: vi.fn(() => true),
            formatCORSMessage: vi.fn(() => 'CORS blocked')
        };
        global.EphemeraNetwork = window.EphemeraNetwork;

        window.EphemeraClipboard = {
            copyFile: vi.fn(),
            cutFile: vi.fn()
        };
        global.EphemeraClipboard = window.EphemeraClipboard;

        window.createAppLifecycle = createLifecycleStub;
        global.createAppLifecycle = createLifecycleStub;

        await import('../js/apps/files.js');
        await import('../js/apps/notepad.js');
        await import('../js/apps/terminal.js');
    });

    it('renders Files app with mobile FAB and mobile class', () => {
        const view = appDefs.files.content('11');
        expect(view.html).toContain('file-app mobile-variant');
        expect(view.html).toContain('id="file-fab-new-11"');
    });

    it('supports swipe-to-delete in Files mobile variant', async () => {
        window.EphemeraFS.readdir
            .mockResolvedValueOnce([{ name: 'report.txt', path: '/home/user/report.txt', type: 'file', size: 128 }])
            .mockResolvedValue([]);
        window.EphemeraWM.getWindow.mockReturnValue({ id: 12, options: {} });

        const view = appDefs.files.content('12');
        document.body.innerHTML = `<div class="window-content">${view.html}</div>`;
        view.init();
        await flushAsync();

        const fileItem = document.querySelector('.file-item');
        expect(fileItem).toBeTruthy();

        fileItem.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 240, clientY: 120 }));
        fileItem.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 140, clientY: 122 }));
        fileItem.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 140, clientY: 122 }));
        await flushAsync();

        expect(window.EphemeraDialog.confirm).toHaveBeenCalled();
        expect(window.EphemeraFS.delete).toHaveBeenCalledWith('/home/user/report.txt');
    });

    it('renders Notepad in mobile mode with floating toolbar layout', () => {
        const view = appDefs.notepad.content('21', {});
        expect(view.html).toContain('notepad-container notepad-mobile');
        expect(view.html).toContain('id="notepad-toolbar-21"');
    });

    it('provides Terminal on-screen keys and applies shortcuts', async () => {
        const view = appDefs.terminal.content('31');
        document.body.innerHTML = `<div class="window-content">${view.html}</div>`;
        await view.init();

        const input = document.getElementById('terminal-input-31');
        const content = document.getElementById('terminal-content-31');
        const slashKey = document.querySelector('#terminal-mobile-keys-31 [data-key="/"]');
        const ctrlKey = document.querySelector('#terminal-mobile-keys-31 [data-key="Ctrl"]');
        const lKey = document.querySelector('#terminal-mobile-keys-31 [data-key="L"]');

        expect(slashKey).toBeTruthy();
        slashKey.click();
        expect(input.value).toBe('/');

        ctrlKey.click();
        lKey.click();
        expect(content.innerHTML).toBe('');
    });
});
