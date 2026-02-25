import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../js/system/system-tray.js';

describe('EphemeraSystemTray widgets popup', () => {
    beforeEach(() => {
        document.body.innerHTML = '';

        const popup = document.createElement('div');
        popup.id = 'system-tray-popup';
        document.body.appendChild(popup);

        window.EphemeraSystemTray._popup = popup;
        window.EphemeraSystemTray._currentPopupId = null;
        window.EphemeraSystemTray._container = document.createElement('div');
        window.EphemeraSystemTray._items = [];
        window.EphemeraSystemTray._syncState = {
            status: 'idle',
            error: null,
            lastSyncAt: null
        };

        window.EphemeraWidgets = {
            init: vi.fn(),
            listAvailableWidgets: vi.fn(() => [
                { type: 'clock', name: 'Clock', icon: 'clock', source: 'builtin' },
                { type: 'community-note', name: 'Community Note', icon: 'puzzle', source: 'custom' }
            ]),
            getWidgets: vi.fn(() => []),
            add: vi.fn()
        };
        window.EphemeraSanitize = {
            escapeHtml: (value) => String(value),
            escapeAttr: (value) => String(value)
        };
    });

    it('renders available widgets dynamically and adds selected widget', () => {
        window.EphemeraSystemTray.showWidgetsPopup();

        expect(window.EphemeraWidgets.init).toHaveBeenCalledTimes(1);
        expect(window.EphemeraWidgets.listAvailableWidgets).toHaveBeenCalledTimes(1);
        expect(window.EphemeraSystemTray._popup.querySelectorAll('.widget-option').length).toBe(2);

        const custom = window.EphemeraSystemTray._popup.querySelector('[data-type="community-note"]');
        custom.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(window.EphemeraWidgets.add).toHaveBeenCalledWith('community-note');
    });
});

describe('EphemeraSystemTray sync tray', () => {
    beforeEach(() => {
        document.body.innerHTML = '';

        const container = document.createElement('div');
        container.id = 'system-tray';
        document.body.appendChild(container);

        const popup = document.createElement('div');
        popup.id = 'system-tray-popup';
        document.body.appendChild(popup);

        window.EphemeraSystemTray._container = container;
        window.EphemeraSystemTray._popup = popup;
        window.EphemeraSystemTray._items = [];
        window.EphemeraSystemTray._currentPopupId = null;
        window.EphemeraSystemTray._syncStatusUnsub = null;
        window.EphemeraSystemTray._syncSettingUnsub = null;
        window.EphemeraSystemTray._syncConflictUnsub = null;
        window.EphemeraSystemTray._syncState = {
            status: 'idle',
            error: null,
            lastSyncAt: null
        };

        window.EphemeraState = {
            settings: {
                syncProvider: 'none',
                syncLastAt: null
            }
        };
        window.EphemeraSyncManager = {
            syncAll: vi.fn().mockResolvedValue(undefined)
        };
        window.EphemeraWM = {
            open: vi.fn()
        };
        window.EphemeraNotifications = {
            warning: vi.fn(),
            error: vi.fn()
        };
    });

    it('shows sync tray item only when sync provider is configured', () => {
        window.EphemeraSystemTray.addBuiltInItems();

        const syncItem = window.EphemeraSystemTray._items.find((item) => item.id === 'sync');
        expect(syncItem.visible).toBe(false);
        expect(window.EphemeraSystemTray._container.querySelector('[data-id="sync"]')).toBeNull();

        window.EphemeraState.settings.syncProvider = 'drive';
        window.EphemeraSystemTray._updateSyncVisibility();

        expect(syncItem.visible).toBe(true);
        expect(window.EphemeraSystemTray._container.querySelector('[data-id="sync"]')).not.toBeNull();
    });

    it('updates sync tray icon and tooltip when sync status changes', () => {
        window.EphemeraState.settings.syncProvider = 'drive';
        window.EphemeraSystemTray.addBuiltInItems();

        window.EphemeraSystemTray.updateSyncStatus({ status: 'syncing' });
        const syncItem = window.EphemeraSystemTray._items.find((item) => item.id === 'sync');
        expect(syncItem.tooltip).toBe('Cloud Sync: Syncing...');
        expect(syncItem.icon).toContain('var(--warning)');

        window.EphemeraSystemTray.updateSyncStatus({ status: 'error', error: 'Rate limit exceeded' });
        expect(syncItem.tooltip).toContain('Cloud Sync: Error');
        expect(syncItem.tooltip).toContain('Rate limit exceeded');
        expect(syncItem.icon).toContain('var(--danger)');
    });

    it('reacts to sync status and settings events', () => {
        const handlers = {};
        window.EphemeraEvents = {
            on: vi.fn((name, handler) => {
                handlers[name] = handler;
                return vi.fn();
            })
        };
        const intervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue(1);

        window.EphemeraSystemTray.addBuiltInItems();
        const syncItem = window.EphemeraSystemTray._items.find((item) => item.id === 'sync');
        expect(syncItem.visible).toBe(false);

        window.EphemeraSystemTray.setupEventListeners();
        expect(window.EphemeraEvents.on).toHaveBeenCalledWith('sync:status', expect.any(Function));
        expect(window.EphemeraEvents.on).toHaveBeenCalledWith('setting:changed', expect.any(Function));
        expect(window.EphemeraEvents.on).toHaveBeenCalledWith('sync:conflict', expect.any(Function));

        window.EphemeraState.settings.syncProvider = 'drive';
        handlers['setting:changed']({ key: 'syncProvider' });
        expect(syncItem.visible).toBe(true);

        handlers['sync:status']({ status: 'synced' });
        expect(syncItem.tooltip).toBe('Cloud Sync: Synced');

        intervalSpy.mockRestore();
    });

    it('shows sync conflict notifications with diff and conflict-copy actions', () => {
        const handlers = {};
        window.EphemeraEvents = {
            on: vi.fn((name, handler) => {
                handlers[name] = handler;
                return vi.fn();
            })
        };
        const intervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue(1);

        window.EphemeraSystemTray.addBuiltInItems();
        window.EphemeraSystemTray.setupEventListeners();

        const path = '/home/testuser/Documents/notes.txt';
        const conflictPath = '/home/testuser/Documents/notes.conflict-2026-02-20T12-00-00-000Z.txt';
        handlers['sync:conflict']({ path, conflictPath });

        expect(window.EphemeraNotifications.warning).toHaveBeenCalledTimes(1);
        const [title, message, options] = window.EphemeraNotifications.warning.mock.calls[0];
        expect(title).toBe('Sync Conflict Detected');
        expect(message).toContain('notes.txt');
        expect(message).toContain('notes.conflict');
        expect(options.actions).toHaveLength(2);
        expect(options.actions[0].label).toBe('View Diff');
        expect(options.actions[1].label).toBe('Open Conflict Copy');

        options.actions[0].onClick();
        expect(window.EphemeraWM.open).toHaveBeenNthCalledWith(1, 'file-history', {
            filePath: path,
            comparePath: conflictPath,
            compareLabel: 'Conflict Copy'
        });

        options.actions[1].onClick();
        expect(window.EphemeraWM.open).toHaveBeenNthCalledWith(2, 'code', {
            filePath: conflictPath
        });

        intervalSpy.mockRestore();
    });

    it('supports sync popup actions for manual sync and settings navigation', async () => {
        window.EphemeraSystemTray.showSyncPopup();

        const syncNowBtn = window.EphemeraSystemTray._popup.querySelector('[data-action="sync-now"]');
        const openSettingsBtn = window.EphemeraSystemTray._popup.querySelector('[data-action="open-settings"]');
        expect(syncNowBtn).not.toBeNull();
        expect(openSettingsBtn).not.toBeNull();

        syncNowBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(window.EphemeraSyncManager.syncAll).toHaveBeenCalledTimes(1);

        await vi.waitFor(() => {
            expect(syncNowBtn.textContent).toBe('Sync Now');
            expect(syncNowBtn.disabled).toBe(false);
        });

        openSettingsBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(window.EphemeraWM.open).toHaveBeenCalledWith('settings', { section: 'sync' });
        expect(window.EphemeraSystemTray._currentPopupId).toBe(null);
        expect(window.EphemeraSystemTray._popup.style.display).toBe('none');
    });
});
