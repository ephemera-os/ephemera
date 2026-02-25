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

async function mountTerminal(windowId = '90') {
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

describe('Terminal AI command suggestions and explanations', () => {
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
            settings: { proxyEnabled: true, proxyUrl: '' },
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

        window.EphemeraDialog = {
            confirm: vi.fn(async () => true),
            prompt: vi.fn(async () => '')
        };
        global.EphemeraDialog = window.EphemeraDialog;

        window.EphemeraWM = {
            open: vi.fn(),
            close: vi.fn(),
            setDirty: vi.fn()
        };
        global.EphemeraWM = window.EphemeraWM;

        window.EphemeraNotifications = {
            success: vi.fn(),
            error: vi.fn(),
            warning: vi.fn(),
            info: vi.fn()
        };
        global.EphemeraNotifications = window.EphemeraNotifications;

        window.EphemeraAI = {
            isConfigured: vi.fn(async () => true),
            suggestTerminalCommand: vi.fn(async () => 'ls /home/user/Documents'),
            explainTerminalExecution: vi.fn(async () => 'It printed the text argument to stdout.'),
            diagnoseTerminalError: vi.fn(async () => 'Unknown command. Try `help` to list available commands.')
        };
        global.EphemeraAI = window.EphemeraAI;

        window.createAppLifecycle = createLifecycleStub;
        global.createAppLifecycle = createLifecycleStub;

        await import('../js/apps/terminal.js');
        expect(terminalDef).toBeTruthy();
    });

    it('suggests an Ephemera command for natural language input', async () => {
        const { input, content } = await mountTerminal();
        await runTerminalCommand(input, 'find all JS files larger than 1MB');

        expect(window.EphemeraAI.suggestTerminalCommand).toHaveBeenCalledTimes(1);
        expect(window.EphemeraAI.suggestTerminalCommand).toHaveBeenCalledWith(
            'find all JS files larger than 1MB',
            expect.objectContaining({ cwd: '/home/user', homeDir: '/home/user' })
        );
        expect(input.value).toBe('ls /home/user/Documents');
        expect(content.textContent).toContain('AI suggestion: ls /home/user/Documents');
    });

    it('explains the last successful command via !! explain', async () => {
        const { input, content } = await mountTerminal();

        await runTerminalCommand(input, 'echo hello world');
        await runTerminalCommand(input, '!! explain');

        expect(window.EphemeraAI.explainTerminalExecution).toHaveBeenCalledTimes(1);
        expect(window.EphemeraAI.explainTerminalExecution).toHaveBeenCalledWith(
            expect.objectContaining({
                rawCommand: 'echo hello world',
                command: 'echo',
                success: true
            })
        );
        expect(content.textContent).toContain('It printed the text argument to stdout.');
    });

    it('offers and returns AI diagnosis for failed commands via !! explain', async () => {
        const { input, content } = await mountTerminal();

        await runTerminalCommand(input, 'nosuchcommand');
        expect(content.textContent).toContain('Tip: run "!! explain" for AI diagnosis');

        await runTerminalCommand(input, '!! explain');

        expect(window.EphemeraAI.diagnoseTerminalError).toHaveBeenCalledTimes(1);
        expect(window.EphemeraAI.diagnoseTerminalError).toHaveBeenCalledWith(
            expect.objectContaining({
                rawCommand: 'nosuchcommand',
                command: 'nosuchcommand',
                success: false,
                error: expect.stringContaining('Command not found')
            })
        );
        expect(content.textContent).toContain('Unknown command. Try `help` to list available commands.');
    });
});
