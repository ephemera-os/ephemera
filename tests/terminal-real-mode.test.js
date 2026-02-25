import { beforeEach, describe, expect, it, vi } from 'vitest';

let terminalDef = null;

function createLifecycleStub() {
    return {
        addListener(target, type, handler, options) {
            target.addEventListener(type, handler, options);
            return handler;
        },
        addSubscription(unsub) {
            return unsub;
        },
        destroy() {}
    };
}

async function flushAsync(iterations = 6) {
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

async function mountTerminal(windowId = '95') {
    const view = terminalDef.content(windowId);
    document.body.innerHTML = `<div class="window-content">${view.html}</div>`;
    await view.init();
    const input = document.getElementById(`terminal-input-${windowId}`);
    const content = document.getElementById(`terminal-content-${windowId}`);
    return { input, content };
}

async function runTerminalCommand(input, command) {
    input.value = command;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flushAsync();
}

describe('Terminal real backend mode', () => {
    beforeEach(async () => {
        vi.resetModules();
        terminalDef = null;
        document.body.innerHTML = '';

        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 });

        window.EphemeraApps = {
            register: vi.fn(app => {
                if (app.id === 'terminal') terminalDef = app;
                return app;
            }),
            getAll: vi.fn(() => []),
            createManifestTemplate: vi.fn(() => ({})),
            createCodeTemplate: vi.fn(() => '')
        };
        global.EphemeraApps = window.EphemeraApps;

        window.EphemeraState = {
            shellMode: 'desktop',
            user: { name: 'Test User', homeDir: '/home/user' },
            settings: {
                proxyEnabled: true,
                proxyUrl: '',
                terminalBackendEnabled: true,
                terminalBackendUrl: 'ws://localhost:8787/terminal'
            },
            updateSetting: vi.fn((key, value) => { window.EphemeraState.settings[key] = value; })
        };
        global.EphemeraState = window.EphemeraState;

        window.EphemeraFS = {
            homeDir: '/home/user',
            normalizePath,
            getParentDir: path => {
                const normalized = normalizePath(path);
                const idx = normalized.lastIndexOf('/');
                return idx <= 0 ? '/' : normalized.slice(0, idx);
            },
            getBasename: path => normalizePath(path).split('/').pop(),
            getExtension: path => {
                const name = normalizePath(path).split('/').pop();
                const idx = name.lastIndexOf('.');
                return idx === -1 ? '' : name.slice(idx + 1);
            },
            readdir: vi.fn(async () => []),
            stat: vi.fn(async () => null),
            readFile: vi.fn(async () => ''),
            writeFile: vi.fn(async () => {}),
            mkdir: vi.fn(async () => {}),
            delete: vi.fn(async () => true),
            copy: vi.fn(async () => {}),
            move: vi.fn(async () => {})
        };
        global.EphemeraFS = window.EphemeraFS;

        window.EphemeraStorage = {
            get: vi.fn(async () => null),
            put: vi.fn(async () => {}),
            delete: vi.fn(async () => {})
        };
        global.EphemeraStorage = window.EphemeraStorage;

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

        window.EphemeraAI = {
            isConfigured: vi.fn(async () => false),
            suggestTerminalCommand: vi.fn(async () => ''),
            explainTerminalExecution: vi.fn(async () => ''),
            diagnoseTerminalError: vi.fn(async () => '')
        };
        global.EphemeraAI = window.EphemeraAI;

        window.createAppLifecycle = createLifecycleStub;
        global.createAppLifecycle = createLifecycleStub;

        await import('../js/apps/terminal.js');
        expect(terminalDef).toBeTruthy();
    });

    it('forwards commands to remote backend when connected', async () => {
        const handlers = {};
        const backendClient = {
            connect: vi.fn(async () => ({ ok: true })),
            send: vi.fn(() => ({ ok: true })),
            close: vi.fn(),
            on: vi.fn((event, handler) => {
                handlers[event] = handler;
                return () => { delete handlers[event]; };
            }),
            isConnected: vi.fn(() => true),
            getUrl: vi.fn(() => 'ws://localhost:8787/terminal')
        };

        window.EphemeraTerminalBackend = {
            isConfigured: vi.fn(() => true),
            getConfig: vi.fn(() => ({ enabled: true, url: 'ws://localhost:8787/terminal' })),
            createClient: vi.fn(() => backendClient),
            testConnection: vi.fn(async () => ({ ok: true }))
        };
        global.EphemeraTerminalBackend = window.EphemeraTerminalBackend;

        const { input, content } = await mountTerminal();
        await flushAsync();

        expect(backendClient.connect).toHaveBeenCalledTimes(1);
        expect(content.textContent).toContain('Connected to real terminal backend');

        await runTerminalCommand(input, 'echo remote-mode');
        expect(backendClient.send).toHaveBeenCalledWith('echo remote-mode\n');
    });

    it('falls back to local simulation when backend connection fails', async () => {
        const backendClient = {
            connect: vi.fn(async () => ({ ok: false, error: 'offline' })),
            send: vi.fn(() => ({ ok: true })),
            close: vi.fn(),
            on: vi.fn(() => () => {}),
            isConnected: vi.fn(() => false),
            getUrl: vi.fn(() => 'ws://localhost:8787/terminal')
        };

        window.EphemeraTerminalBackend = {
            isConfigured: vi.fn(() => true),
            getConfig: vi.fn(() => ({ enabled: true, url: 'ws://localhost:8787/terminal' })),
            createClient: vi.fn(() => backendClient),
            testConnection: vi.fn(async () => ({ ok: true }))
        };
        global.EphemeraTerminalBackend = window.EphemeraTerminalBackend;

        const { input, content } = await mountTerminal('96');
        await flushAsync();

        expect(content.textContent.toLowerCase()).toContain('using local simulation');

        await runTerminalCommand(input, 'echo local-fallback');
        expect(backendClient.send).not.toHaveBeenCalled();
        expect(content.textContent).toContain('local-fallback');
    });
});
