import { beforeEach, describe, expect, it, vi } from 'vitest';

let appStore;
let appManagerDef;

function createLifecycleStub() {
    return {
        addListener(target, type, handler, options) {
            target.addEventListener(type, handler, options);
            return handler;
        },
        addSubscription(unsubscribe) {
            return unsubscribe;
        },
        destroy() {}
    };
}

function createEventBus() {
    const listeners = new Map();
    return {
        on: vi.fn((event, handler) => {
            const list = listeners.get(event) || [];
            list.push(handler);
            listeners.set(event, list);
            return () => {
                const current = listeners.get(event) || [];
                listeners.set(event, current.filter(fn => fn !== handler));
            };
        }),
        emit(event, payload) {
            const list = listeners.get(event) || [];
            list.forEach(fn => fn(payload));
        }
    };
}

async function flushAsync(iterations = 6) {
    for (let i = 0; i < iterations; i++) {
        await Promise.resolve();
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

function mountAppManager(windowId = '42') {
    const appView = appManagerDef.content(windowId);
    document.body.innerHTML = appView.html;
    appView.init();
    return appView;
}

describe('App Manager marketplace/community', () => {
    beforeEach(async () => {
        vi.resetModules();
        document.body.innerHTML = '';
        appManagerDef = null;

        appStore = new Map([
            ['calculator', {
                id: 'calculator',
                name: 'Calculator',
                icon: '<svg></svg>',
                category: 'utility',
                description: 'System calculator'
            }],
            ['com.user.demo', {
                id: 'com.user.demo',
                name: 'Demo User App',
                icon: '<svg></svg>',
                category: 'user',
                description: 'User app for tests',
                isUserApp: true,
                width: 640,
                height: 480,
                permissions: []
            }]
        ]);

        const events = createEventBus();
        window.EphemeraEvents = events;
        global.EphemeraEvents = events;

        const appsApi = {
            register: vi.fn(app => {
                appStore.set(app.id, app);
                if (app.id === 'appmanager') {
                    appManagerDef = app;
                }
                return app;
            }),
            getAll: vi.fn(() => Array.from(appStore.values())),
            get: vi.fn(id => appStore.get(id)),
            installApp: vi.fn(async (manifest, code) => {
                const installed = {
                    id: manifest.id,
                    name: manifest.name,
                    icon: manifest.icon || '<svg></svg>',
                    width: manifest.window?.width || 600,
                    height: manifest.window?.height || 400,
                    category: manifest.category || 'user',
                    description: manifest.description || '',
                    isUserApp: true,
                    permissions: manifest.permissions || [],
                    code
                };
                appStore.set(installed.id, installed);
                return installed;
            }),
            uninstallApp: vi.fn(async appId => {
                appStore.delete(appId);
            })
        };
        window.EphemeraApps = appsApi;
        global.EphemeraApps = appsApi;

        window.createAppLifecycle = createLifecycleStub;
        global.createAppLifecycle = createLifecycleStub;

        window.EphemeraFS = { homeDir: '/home/testuser' };
        global.EphemeraFS = window.EphemeraFS;

        window.EphemeraState = window.EphemeraState || {};
        window.EphemeraState.user = {
            ...(window.EphemeraState.user || {}),
            homeDir: '/home/testuser'
        };

        window.EphemeraWM = { open: vi.fn() };
        global.EphemeraWM = window.EphemeraWM;

        window.EphemeraBoot = { updateStartMenu: vi.fn() };
        global.EphemeraBoot = window.EphemeraBoot;

        window.EphemeraDialog = { confirm: vi.fn(async () => true) };
        global.EphemeraDialog = window.EphemeraDialog;

        window.EphemeraNotifications = {
            success: vi.fn(),
            error: vi.fn(),
            warning: vi.fn(),
            info: vi.fn()
        };
        global.EphemeraNotifications = window.EphemeraNotifications;

        window.EphemeraSanitize = {
            escapeHtml: s => String(s),
            escapeAttr: s => String(s),
            sanitizeUrl: u => String(u)
        };
        global.EphemeraSanitize = window.EphemeraSanitize;

        window.open = vi.fn();
        global.fetch.mockReset();

        Object.defineProperty(window.navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn(async () => {}) }
        });

        await import('../js/apps/appmanager.js');
        expect(appManagerDef).toBeTruthy();
    });

    it('shows Media Player in New App templates', () => {
        mountAppManager();
        const newAppTab = document.querySelector('[data-tab="newapp"]');
        expect(newAppTab).toBeTruthy();
        newAppTab.click();

        const templateNames = Array.from(document.querySelectorAll('.na-card-name')).map(el => el.textContent.trim());
        expect(templateNames).toContain('Media Player');
    });

    it('installs marketplace app from install_url package with manifest and code', async () => {
        global.fetch.mockImplementation(async url => {
            const currentUrl = String(url);
            if (currentUrl.includes('raw.githubusercontent.com') || currentUrl.includes('cdn.jsdelivr.net')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        apps: [{
                            id: 'com.community.wave',
                            name: 'Wave Studio',
                            author: 'Alice',
                            description: 'Demo synth app',
                            version: '1.2.3',
                            install_url: 'https://example.com/wave-install.json',
                            screenshot_url: 'https://example.com/wave.png',
                            reviews_url: 'https://github.com/ephemera-os/app-registry/discussions/12'
                        }]
                    })
                };
            }
            if (currentUrl === 'https://example.com/wave-install.json') {
                return {
                    ok: true,
                    status: 200,
                    text: async () => JSON.stringify({
                        manifest: {
                            id: 'com.community.wave',
                            name: 'Wave Studio',
                            version: '2.0.0',
                            category: 'user',
                            window: { width: 520, height: 360 }
                        },
                        code: "container.innerHTML='Wave Installed';"
                    })
                };
            }
            throw new Error(`Unexpected fetch URL: ${currentUrl}`);
        });

        mountAppManager();
        document.querySelector('[data-tab="marketplace"]').click();
        await flushAsync();

        const screenshot = document.querySelector('.mkt-shot');
        expect(screenshot).toBeTruthy();
        expect(screenshot.getAttribute('src')).toBe('https://example.com/wave.png');

        const links = Array.from(document.querySelectorAll('.mkt-link')).map(el => el.textContent.trim());
        expect(links).toContain('Reviews');

        const installBtn = document.querySelector('.mkt-install-btn[data-app-id="com.community.wave"]');
        expect(installBtn).toBeTruthy();
        installBtn.click();
        await flushAsync();

        expect(window.EphemeraApps.installApp).toHaveBeenCalledTimes(1);
        const [manifest, code] = window.EphemeraApps.installApp.mock.calls[0];
        expect(manifest).toMatchObject({
            id: 'com.community.wave',
            name: 'Wave Studio',
            version: '2.0.0'
        });
        expect(manifest.window).toEqual({ width: 520, height: 360 });
        expect(code).toContain('Wave Installed');
    });

    it('resolves relative registry URLs against the source apps.json URL', async () => {
        const registryUrl = 'https://raw.githubusercontent.com/ephemera-os/app-registry/main/apps.json';
        const installUrl = 'https://raw.githubusercontent.com/ephemera-os/app-registry/main/packages/relative-install.json';
        const screenshotUrl = 'https://raw.githubusercontent.com/ephemera-os/app-registry/main/screenshots/relative.png';

        global.fetch.mockImplementation(async url => {
            const currentUrl = String(url);
            if (currentUrl === registryUrl) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        apps: [{
                            id: 'com.community.relative',
                            name: 'Relative Registry App',
                            author: 'Relative Team',
                            description: 'Uses relative install and screenshot URLs',
                            version: '1.0.0',
                            install_url: 'packages/relative-install.json',
                            screenshot_url: 'screenshots/relative.png'
                        }]
                    })
                };
            }
            if (currentUrl === installUrl) {
                return {
                    ok: true,
                    status: 200,
                    text: async () => JSON.stringify({
                        manifest: {
                            id: 'com.community.relative',
                            name: 'Relative Registry App'
                        },
                        code: "container.innerHTML='Relative Install';"
                    })
                };
            }
            throw new Error(`Unexpected fetch URL: ${currentUrl}`);
        });

        mountAppManager();
        document.querySelector('[data-tab="marketplace"]').click();
        await flushAsync();

        const screenshot = document.querySelector('.mkt-shot');
        expect(screenshot).toBeTruthy();
        expect(screenshot.getAttribute('src')).toBe(screenshotUrl);

        const installBtn = document.querySelector('.mkt-install-btn[data-app-id="com.community.relative"]');
        expect(installBtn).toBeTruthy();
        installBtn.click();
        await flushAsync();

        expect(window.EphemeraApps.installApp).toHaveBeenCalledTimes(1);
        const fetchedUrls = global.fetch.mock.calls.map(([calledUrl]) => String(calledUrl));
        expect(fetchedUrls).toContain(installUrl);
    });

    it('normalizes registry entries that only provide code_url', async () => {
        global.fetch.mockImplementation(async url => {
            const currentUrl = String(url);
            if (currentUrl.includes('raw.githubusercontent.com') || currentUrl.includes('cdn.jsdelivr.net')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        apps: [{
                            name: 'Radar Widget',
                            author: 'ACME Labs',
                            code_url: 'https://cdn.example.com/radar.js'
                        }]
                    })
                };
            }
            if (currentUrl === 'https://cdn.example.com/radar.js') {
                return {
                    ok: true,
                    status: 200,
                    text: async () => "container.innerHTML='Radar';"
                };
            }
            throw new Error(`Unexpected fetch URL: ${currentUrl}`);
        });

        mountAppManager();
        document.querySelector('[data-tab="marketplace"]').click();
        await flushAsync();

        const derivedId = 'com.community.acme-labs-radar-widget';
        const installBtn = document.querySelector(`.mkt-install-btn[data-app-id="${derivedId}"]`);
        expect(installBtn).toBeTruthy();
        installBtn.click();
        await flushAsync();

        expect(window.EphemeraApps.installApp).toHaveBeenCalledTimes(1);
        const [manifest, code] = window.EphemeraApps.installApp.mock.calls[0];
        expect(manifest.id).toBe(derivedId);
        expect(manifest.version).toBe('1.0.0');
        expect(code).toContain("container.innerHTML='Radar';");
    });

    it('builds a prefilled compare PR URL in publish modal', async () => {
        mountAppManager();

        const publishBtn = document.querySelector('.am-publish-btn[data-app-id="com.user.demo"]');
        expect(publishBtn).toBeTruthy();
        publishBtn.click();

        const userInput = document.getElementById('am-pub-user-42');
        const branchInput = document.getElementById('am-pub-branch-42');
        const previewInput = document.getElementById('am-pr-preview-42');
        expect(userInput).toBeTruthy();
        expect(branchInput).toBeTruthy();
        expect(previewInput).toBeTruthy();

        userInput.value = 'octocat';
        userInput.dispatchEvent(new Event('input', { bubbles: true }));
        branchInput.value = 'feature/demo';
        branchInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(previewInput.value).toContain('/compare/main...octocat:feature%2Fdemo');
        expect(previewInput.value).toContain('title=');
        expect(previewInput.value).toContain('body=');

        document.getElementById('am-open-pr-42').click();
        expect(window.open).toHaveBeenCalledTimes(1);
        const openedUrl = window.open.mock.calls[0][0];
        expect(openedUrl).toContain('/compare/main...octocat:feature%2Fdemo');
        expect(openedUrl).not.toContain('/issues/new');
    });
});
