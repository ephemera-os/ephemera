import { beforeEach, describe, expect, it, vi } from 'vitest';
import EphemeraApps from '../js/system/app-registry.js';

function makeBridgePort() {
    return {
        postMessage: vi.fn()
    };
}

function getReply(bridgePort) {
    return bridgePort.postMessage.mock.calls[0]?.[0];
}

describe('EphemeraApps bridge permissions', () => {
    beforeEach(() => {
        EphemeraApps.registry.clear();
        EphemeraApps._loadedApps.clear();
        EphemeraApps._pendingLoads.clear();
        EphemeraApps._permissionPrompts.clear();
        EphemeraApps._extensionDisposers.clear();
        EphemeraApps.configureEmbed({ enabled: false });

        window.EphemeraState = { installedApps: [] };
        window.EphemeraEvents = { emit: vi.fn() };
        window.EphemeraSanitize = {
            escapeHtml: (v) => String(v),
            escapeAttr: (v) => String(v)
        };
        window.EphemeraStorage = {
            get: vi.fn(async () => ({ manifest: { permissions: [] } })),
            put: vi.fn(async () => {})
        };
        window.EphemeraWM = {
            getWindow: vi.fn(() => ({ appId: 'com.user.demo' })),
            getWindowsByApp: vi.fn(() => [])
        };
        window.EphemeraDialog = {
            show: vi.fn(async () => 'deny')
        };
        window.EphemeraNotifications = {
            success: vi.fn(async () => 'ok'),
            error: vi.fn(async () => 'ok'),
            info: vi.fn(async () => 'ok'),
            warning: vi.fn(async () => 'ok')
        };

        EphemeraApps.register({
            id: 'com.user.demo',
            name: 'Demo',
            category: 'user',
            isUserApp: true,
            permissions: []
        });
    });

    it('denies call when user picks Deny', async () => {
        const bridgePort = makeBridgePort();
        window.EphemeraDialog.show.mockResolvedValue('deny');

        await EphemeraApps._handleBridgeCall(
            1,
            'EphemeraNotifications',
            'success',
            ['Title', 'Body'],
            100,
            'com.user.demo',
            bridgePort
        );

        expect(window.EphemeraDialog.show).toHaveBeenCalledTimes(1);
        expect(window.EphemeraNotifications.success).not.toHaveBeenCalled();

        const reply = getReply(bridgePort);
        expect(reply.type).toBe('ephemera-bridge-reply');
        expect(reply.id).toBe(1);
        expect(reply.error).toContain('Permission denied');
    });

    it('allows call once when user picks Allow Once without persisting permission', async () => {
        const bridgePort = makeBridgePort();
        window.EphemeraDialog.show.mockResolvedValue('once');

        await EphemeraApps._handleBridgeCall(
            2,
            'EphemeraNotifications',
            'success',
            ['Title', 'Body'],
            101,
            'com.user.demo',
            bridgePort
        );

        expect(window.EphemeraDialog.show).toHaveBeenCalledTimes(1);
        const runtimePrompt = window.EphemeraDialog.show.mock.calls[0]?.[0] || {};
        expect(runtimePrompt.message).toContain('Demo (com.user.demo) is requesting Notifications access');
        expect(runtimePrompt.message).not.toMatch(/<[^>]+>/);
        expect(window.EphemeraNotifications.success).toHaveBeenCalledTimes(1);
        expect(EphemeraApps.getAppPermissions('com.user.demo')).toEqual([]);

        const reply = getReply(bridgePort);
        expect(reply.id).toBe(2);
        expect(reply.error).toBeUndefined();
        expect(reply.result).toBe('ok');
    });

    it('persists permission and skips future prompt when user picks Always Allow', async () => {
        const bridgePortA = makeBridgePort();
        const bridgePortB = makeBridgePort();
        window.EphemeraDialog.show.mockResolvedValue('always');

        await EphemeraApps._handleBridgeCall(
            3,
            'EphemeraNotifications',
            'success',
            ['Title', 'Body'],
            102,
            'com.user.demo',
            bridgePortA
        );

        expect(window.EphemeraDialog.show).toHaveBeenCalledTimes(1);
        expect(EphemeraApps.getAppPermissions('com.user.demo')).toContain('notifications');

        await EphemeraApps._handleBridgeCall(
            4,
            'EphemeraNotifications',
            'success',
            ['Again', 'Body'],
            102,
            'com.user.demo',
            bridgePortB
        );

        expect(window.EphemeraDialog.show).toHaveBeenCalledTimes(1);
        expect(window.EphemeraNotifications.success).toHaveBeenCalledTimes(2);
        expect(window.EphemeraStorage.put).toHaveBeenCalled();

        const reply = getReply(bridgePortB);
        expect(reply.id).toBe(4);
        expect(reply.error).toBeUndefined();
        expect(reply.result).toBe('ok');
    });
});

describe('EphemeraApps embed allowlist', () => {
    beforeEach(() => {
        EphemeraApps.registry.clear();
        EphemeraApps._loadedApps.clear();
        EphemeraApps._pendingLoads.clear();
        EphemeraApps._permissionPrompts.clear();
        EphemeraApps._extensionDisposers.clear();
        EphemeraApps.configureEmbed({ enabled: false });

        EphemeraApps.register({
            id: 'files',
            name: 'Files',
            category: 'system'
        });
        EphemeraApps.register({
            id: 'terminal',
            name: 'Terminal',
            category: 'system'
        });
    });

    it('filters get and getAll when embed allowlist is active', () => {
        EphemeraApps.configureEmbed({
            enabled: true,
            allowedApps: ['files']
        });

        expect(EphemeraApps.get('files')).toBeTruthy();
        expect(EphemeraApps.get('terminal')).toBeUndefined();

        const visibleIds = EphemeraApps.getAll().map((app) => app.id);
        expect(visibleIds).toContain('files');
        expect(visibleIds).not.toContain('terminal');
    });

    it('restores full registry visibility when embed mode is disabled', () => {
        EphemeraApps.configureEmbed({
            enabled: true,
            allowedApps: ['files']
        });
        EphemeraApps.configureEmbed({ enabled: false });

        expect(EphemeraApps.get('terminal')).toBeTruthy();
        const visibleIds = EphemeraApps.getAll().map((app) => app.id);
        expect(visibleIds).toContain('files');
        expect(visibleIds).toContain('terminal');
    });
});

describe('EphemeraApps preview cleanup', () => {
    beforeEach(() => {
        EphemeraApps.registry.clear();
        EphemeraApps._loadedApps.clear();
        EphemeraApps._pendingLoads.clear();
        EphemeraApps._permissionPrompts.clear();
        EphemeraApps._extensionDisposers.clear();
        EphemeraApps.configureEmbed({ enabled: false });

        window.EphemeraState = { installedApps: [] };
        window.EphemeraEvents = { emit: vi.fn() };
        window.EphemeraWM = {
            getWindowsByApp: vi.fn(() => [{ id: 10 }])
        };
    });

    it('removes ephemeral preview app on close when it is the last window', () => {
        const previewApp = {
            id: 'dev.preview.1',
            name: 'Preview App',
            category: 'user',
            isUserApp: true,
            permissions: []
        };
        previewApp.onClose = (closingWindowId) => {
            EphemeraApps.removeEphemeralApp(previewApp.id, {
                closingWindowId,
                emitEvent: false
            });
        };

        EphemeraApps.register(previewApp);
        expect(EphemeraApps.get(previewApp.id)).toBeTruthy();

        previewApp.onClose(10);
        expect(EphemeraApps.get(previewApp.id)).toBeUndefined();
    });

    it('keeps ephemeral preview app registered when another window is still open', () => {
        window.EphemeraWM.getWindowsByApp = vi.fn(() => [{ id: 10 }, { id: 11 }]);

        const previewApp = {
            id: 'dev.preview.2',
            name: 'Preview App',
            category: 'user',
            isUserApp: true,
            permissions: []
        };
        previewApp.onClose = (closingWindowId) => {
            EphemeraApps.removeEphemeralApp(previewApp.id, {
                closingWindowId,
                emitEvent: false
            });
        };

        EphemeraApps.register(previewApp);
        previewApp.onClose(10);
        expect(EphemeraApps.get(previewApp.id)).toBeTruthy();
    });
});

describe('EphemeraApps extension install and activation', () => {
    beforeEach(() => {
        EphemeraApps.registry.clear();
        EphemeraApps._loadedApps.clear();
        EphemeraApps._pendingLoads.clear();
        EphemeraApps._permissionPrompts.clear();
        EphemeraApps._extensionDisposers.clear();
        EphemeraApps.configureEmbed({ enabled: false });

        document.body.innerHTML = `
            <div id="taskbar-apps"></div>
            <div id="context-menu"><div class="context-divider"></div></div>
        `;

        window.EphemeraState = { installedApps: [], save: vi.fn() };
        window.EphemeraEvents = { emit: vi.fn() };
        window.EphemeraStorage = {
            put: vi.fn(async () => {}),
            get: vi.fn(async () => null),
            getAll: vi.fn(async () => []),
            delete: vi.fn(async () => {})
        };
        window.EphemeraDialog = {
            show: vi.fn(async () => 'install')
        };
        window.EphemeraWM = {
            open: vi.fn(),
            isMobileShell: vi.fn(() => false),
            getWindowsByApp: vi.fn(() => [])
        };
        window.EphemeraNotifications = {
            success: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warning: vi.fn()
        };
        window.EphemeraWidgets = {
            registerExtensionWidget: vi.fn(),
            unregisterExtensionWidget: vi.fn()
        };
        window.EphemeraSanitize = {
            escapeHtml: (v) => String(v),
            escapeAttr: (v) => String(v),
            sanitizeUrl: (v) => String(v),
            sanitizeHtml: (v) => String(v)
        };

        window.EphemeraCommandPalette = {
            registerCommands: vi.fn(() => vi.fn())
        };
        window.EphemeraShortcuts = {
            register: vi.fn(() => vi.fn())
        };
    });

    it('cancels installation when install permission consent is denied', async () => {
        window.EphemeraDialog.show.mockResolvedValue('cancel');

        await expect(EphemeraApps.installApp({
            id: 'com.community.denied',
            name: 'Denied Extension',
            type: 'system',
            permissions: ['shortcuts']
        }, '')).rejects.toThrow('Installation cancelled');

        expect(window.EphemeraDialog.show).toHaveBeenCalledTimes(1);
        const installPrompt = window.EphemeraDialog.show.mock.calls[0]?.[0] || {};
        expect(installPrompt.message).toContain('Denied Extension (com.community.denied) is requesting the following permissions');
        expect(installPrompt.message).not.toMatch(/<[^>]+>/);
        expect(EphemeraApps.get('com.community.denied')).toBeUndefined();
    });

    it('activates and cleans up system extension contributions', async () => {
        const unregisterCommands = vi.fn();
        const unregisterShortcut = vi.fn();
        window.EphemeraCommandPalette.registerCommands.mockReturnValue(unregisterCommands);
        window.EphemeraShortcuts.register.mockReturnValue(unregisterShortcut);

        await EphemeraApps.installApp({
            id: 'com.community.powerpack',
            name: 'Power Pack',
            type: 'system',
            permissions: ['shortcuts', 'command-palette', 'taskbar', 'contextmenu'],
            contributes: {
                commands: [
                    { id: 'open-files', title: 'Open Files', action: { type: 'open-app', appId: 'files' } }
                ],
                shortcuts: [
                    { combo: 'ctrl+shift+9', action: { type: 'open-app', appId: 'terminal' } }
                ],
                taskbar: [
                    { id: 'quick-files', label: 'Quick Files', action: { type: 'open-app', appId: 'files' } }
                ],
                contextMenu: [
                    { id: 'ctx-files', label: 'Open Files', action: { type: 'open-app', appId: 'files' } }
                ]
            }
        }, '', { persist: false });

        expect(window.EphemeraCommandPalette.registerCommands).toHaveBeenCalledTimes(1);
        expect(window.EphemeraShortcuts.register).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('.extension-taskbar-item').length).toBe(1);
        expect(document.querySelectorAll('.extension-context-item').length).toBe(1);

        const [registeredCommands] = window.EphemeraCommandPalette.registerCommands.mock.calls[0];
        expect(Array.isArray(registeredCommands)).toBe(true);
        registeredCommands[0].action();
        expect(window.EphemeraWM.open).toHaveBeenCalledWith('files', {});

        const [, shortcutHandler] = window.EphemeraShortcuts.register.mock.calls[0];
        shortcutHandler();
        expect(window.EphemeraWM.open).toHaveBeenCalledWith('terminal', {});

        document.querySelector('.extension-context-item').click();
        expect(window.EphemeraWM.open).toHaveBeenCalledWith('files', {});

        await EphemeraApps.uninstallApp('com.community.powerpack');
        expect(unregisterCommands).toHaveBeenCalledTimes(1);
        expect(unregisterShortcut).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('.extension-taskbar-item').length).toBe(0);
        expect(document.querySelectorAll('.extension-context-item').length).toBe(0);
    });

    it('registers and unregisters widget extensions through the widgets runtime', async () => {
        const code = 'container.innerHTML = "<div>Widget</div>";';

        await EphemeraApps.installApp({
            id: 'com.community.marketwidget',
            name: 'Market Widget',
            type: 'widget',
            description: 'Community widget',
            widget: {
                type: 'market-widget',
                name: 'Market Widget'
            }
        }, code, { persist: false });

        expect(window.EphemeraWidgets.registerExtensionWidget).toHaveBeenCalledTimes(1);
        expect(window.EphemeraWidgets.registerExtensionWidget).toHaveBeenCalledWith(
            'com.community.marketwidget',
            expect.objectContaining({
                id: 'com.community.marketwidget',
                type: 'widget'
            }),
            code
        );

        await EphemeraApps.uninstallApp('com.community.marketwidget');
        expect(window.EphemeraWidgets.unregisterExtensionWidget).toHaveBeenCalledWith('com.community.marketwidget');
    });

    it('rejects widget extensions that have no executable code', async () => {
        await expect(EphemeraApps.installApp({
            id: 'com.community.emptywidget',
            name: 'Empty Widget',
            type: 'widget'
        }, '', { persist: false })).rejects.toThrow('Widget extensions require executable code');
    });
});
