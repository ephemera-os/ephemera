describe('EphemeraEmbed API bridge', () => {
    const originalParentDescriptor = Object.getOwnPropertyDescriptor(window, 'parent');
    const listeners = {};
    const parentMock = { postMessage: vi.fn() };

    const flush = async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    };

    beforeAll(async () => {
        history.replaceState({}, '', '/?embed=1&apps=files,terminal');

        Object.defineProperty(window, 'parent', {
            configurable: true,
            value: parentMock
        });

        window.Ephemera = { version: '2.0.0' };
        window.EphemeraState = {
            activeWindowId: null,
            currentWorkspace: 0,
            workspaces: [[], [], [], []],
            windows: []
        };
        window.EphemeraApps = {
            configureEmbed: vi.fn(),
            getAll: vi.fn(() => [
                { id: 'files', name: 'Files', category: 'system' },
                { id: 'terminal', name: 'Terminal', category: 'development' }
            ])
        };
        window.EphemeraFS = {
            writeFile: vi.fn(async () => {}),
            readFile: vi.fn(async () => 'hello world'),
            readdir: vi.fn(async () => [])
        };
        window.EphemeraWM = {
            open: vi.fn(() => 77),
            close: vi.fn(async () => {})
        };
        window.EphemeraBoot = {
            switchWorkspace: vi.fn()
        };
        window.EphemeraEvents = {
            on: vi.fn((event, callback) => {
                listeners[event] = callback;
                return () => { delete listeners[event]; };
            }),
            emit: vi.fn()
        };

        await import('../js/system/embed-api.js');
    });

    afterAll(() => {
        document.documentElement.classList.remove('embed-mode');
        delete document.documentElement.dataset.embedMode;
        if (originalParentDescriptor) {
            Object.defineProperty(window, 'parent', originalParentDescriptor);
        }
        history.replaceState({}, '', '/');
    });

    beforeEach(() => {
        parentMock.postMessage.mockClear();
        window.EphemeraFS.writeFile.mockClear();
    });

    it('enables embed mode and configures app allowlist', () => {
        expect(window.EphemeraEmbed).toBeTruthy();
        expect(window.EphemeraEmbed.enabled).toBe(true);
        expect(window.EphemeraEmbed.allowedApps).toEqual(['files', 'terminal']);
        expect(window.EphemeraApps.configureEmbed).toHaveBeenCalledWith({
            enabled: true,
            allowedApps: ['files', 'terminal']
        });
    });

    it('responds to ping requests from parent', async () => {
        window.dispatchEvent(new MessageEvent('message', {
            source: parentMock,
            origin: 'https://host.example',
            data: { ephemera: true, cmd: 'ping', requestId: 'req-1' }
        }));
        await flush();

        const response = parentMock.postMessage.mock.calls
            .map((call) => call[0])
            .find((message) => message.type === 'response' && message.requestId === 'req-1');

        expect(response).toBeTruthy();
        expect(response.ok).toBe(true);
        expect(response.result.pong).toBe(true);
    });

    it('executes writeFile command requests', async () => {
        window.dispatchEvent(new MessageEvent('message', {
            source: parentMock,
            origin: 'https://host.example',
            data: {
                ephemera: true,
                cmd: 'writeFile',
                requestId: 'req-2',
                path: '/home/user/main.js',
                content: 'console.log("hi")'
            }
        }));
        await flush();

        expect(window.EphemeraFS.writeFile).toHaveBeenCalledWith(
            '/home/user/main.js',
            'console.log("hi")',
            {}
        );

        const response = parentMock.postMessage.mock.calls
            .map((call) => call[0])
            .find((message) => message.type === 'response' && message.requestId === 'req-2');

        expect(response).toBeTruthy();
        expect(response.ok).toBe(true);
        expect(response.result.path).toBe('/home/user/main.js');
    });

    it('emits ready event payload to parent after desktop ready', async () => {
        if (listeners['desktop:ready']) {
            listeners['desktop:ready']();
        }
        await flush();

        const readyEvent = parentMock.postMessage.mock.calls
            .map((call) => call[0])
            .find((message) => message.type === 'ready');

        expect(readyEvent).toBeTruthy();
        expect(readyEvent.allowedApps).toEqual(['files', 'terminal']);
        expect(Array.isArray(readyEvent.capabilities)).toBe(true);
    });
});
