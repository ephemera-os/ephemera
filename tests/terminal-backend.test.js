import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    static instances = [];

    constructor(url) {
        this.url = url;
        this.readyState = FakeWebSocket.CONNECTING;
        this.sent = [];
        this.onopen = null;
        this.onclose = null;
        this.onerror = null;
        this.onmessage = null;
        FakeWebSocket.instances.push(this);
    }

    send(data) {
        if (this.readyState !== FakeWebSocket.OPEN) {
            throw new Error('Socket not open');
        }
        this.sent.push(data);
    }

    close(code = 1000, reason = '') {
        this.readyState = FakeWebSocket.CLOSING;
        this.readyState = FakeWebSocket.CLOSED;
        if (typeof this.onclose === 'function') {
            this.onclose({ code, reason });
        }
    }

    _open() {
        this.readyState = FakeWebSocket.OPEN;
        if (typeof this.onopen === 'function') {
            this.onopen({});
        }
    }

    _error() {
        if (typeof this.onerror === 'function') {
            this.onerror(new Event('error'));
        }
    }

    _message(data) {
        if (typeof this.onmessage === 'function') {
            this.onmessage({ data });
        }
    }
}

describe('EphemeraTerminalBackend', () => {
    let originalWebSocket;

    beforeEach(async () => {
        vi.resetModules();
        FakeWebSocket.instances = [];

        originalWebSocket = window.WebSocket;
        window.WebSocket = FakeWebSocket;
        global.WebSocket = FakeWebSocket;

        window.EphemeraState = window.EphemeraState || { settings: {}, updateSetting: vi.fn() };
        window.EphemeraState.settings.terminalBackendEnabled = true;
        window.EphemeraState.settings.terminalBackendUrl = 'ws://localhost:8787/terminal';

        await import('../js/system/terminal-backend.js');
    });

    afterEach(() => {
        window.WebSocket = originalWebSocket;
        global.WebSocket = originalWebSocket;
    });

    it('validates ws/wss backend URLs', () => {
        expect(window.EphemeraTerminalBackend.validateUrl('ws://localhost:8787/terminal').valid).toBe(true);
        expect(window.EphemeraTerminalBackend.validateUrl('wss://terminal.example.com/ws').valid).toBe(true);
        expect(window.EphemeraTerminalBackend.validateUrl('https://example.com').valid).toBe(false);
    });

    it('tests backend connectivity', async () => {
        const pending = window.EphemeraTerminalBackend.testConnection('ws://localhost:8787/terminal', 1000);
        const ws = FakeWebSocket.instances[0];
        expect(ws.url).toBe('ws://localhost:8787/terminal');

        ws._open();

        const result = await pending;
        expect(result.ok).toBe(true);
    });

    it('creates a client, connects, sends data, and parses inbound JSON', async () => {
        const backend = window.EphemeraTerminalBackend;
        const client = backend.createClient();

        const messages = [];
        client.on('message', (payload) => messages.push(payload));

        const connectPromise = client.connect(1000);
        const ws = FakeWebSocket.instances[0];
        ws._open();

        const connectResult = await connectPromise;
        expect(connectResult.ok).toBe(true);
        expect(client.isConnected()).toBe(true);

        expect(client.send('pwd\n').ok).toBe(true);
        expect(ws.sent).toEqual(['pwd\n']);

        ws._message('plain-output');
        ws._message(JSON.stringify({ type: 'stdout', data: 'json-output' }));

        expect(messages).toEqual([
            'plain-output',
            { type: 'stdout', data: 'json-output' }
        ]);
    });
});
