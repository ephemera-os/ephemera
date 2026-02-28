const EphemeraApps = {
    registry: new Map(),
    _loadedApps: new Set(),
    _pendingLoads: new Map(),
    _permissionPrompts: new Map(),
    _extensionDisposers: new Map(),
    _embedModeEnabled: false,
    _allowedEmbedApps: null,
    VALID_EXTENSION_TYPES: ['app', 'system', 'editor', 'theme', 'widget'],
    VALID_PERMISSIONS: ['fs', 'network', 'events', 'windows', 'notifications', 'dialogs', 'storage'],
    VALID_EXTENSION_PERMISSIONS: [
        'fs', 'network', 'events', 'windows', 'notifications', 'dialogs', 'storage',
        'filesystem:read', 'filesystem:write', 'filesystem:manage',
        'network:http', 'network:ws',
        'events:emit', 'events:subscribe',
        'windows:open', 'windows:manage',
        'storage:read', 'storage:write',
        'clipboard', 'ai',
        'command-palette', 'shortcuts', 'taskbar', 'contextmenu',
        'editor', 'theme'
    ],
    PERMISSION_TO_RUNTIME: {
        fs: 'fs',
        network: 'network',
        events: 'events',
        windows: 'windows',
        notifications: 'notifications',
        dialogs: 'dialogs',
        storage: 'storage',
        'filesystem:read': 'fs',
        'filesystem:write': 'fs',
        'filesystem:manage': 'fs',
        'network:http': 'network',
        'network:ws': 'network',
        'events:emit': 'events',
        'events:subscribe': 'events',
        'windows:open': 'windows',
        'windows:manage': 'windows',
        'storage:read': 'storage',
        'storage:write': 'storage'
    },
    PERMISSION_LABELS: {
        fs: 'File System',
        network: 'Network',
        events: 'Events',
        windows: 'Window Control',
        notifications: 'Notifications',
        dialogs: 'Dialogs',
        storage: 'Storage API'
    },
    EXTENSION_PERMISSION_LABELS: {
        'filesystem:read': 'Filesystem (Read)',
        'filesystem:write': 'Filesystem (Write)',
        'filesystem:manage': 'Filesystem (Manage)',
        'network:http': 'Network (HTTP)',
        'network:ws': 'Network (WebSocket)',
        'events:emit': 'Events (Emit)',
        'events:subscribe': 'Events (Subscribe)',
        'windows:open': 'Windows (Open)',
        'windows:manage': 'Windows (Manage)',
        'storage:read': 'Storage (Read)',
        'storage:write': 'Storage (Write)',
        clipboard: 'Clipboard',
        ai: 'AI Access',
        'command-palette': 'Command Palette',
        shortcuts: 'Keyboard Shortcuts',
        taskbar: 'Taskbar Integration',
        contextmenu: 'Context Menu Integration',
        editor: 'Editor Integration',
        theme: 'Theme Integration'
    },
    API_PERMISSIONS: {
        EphemeraFS: 'fs',
        EphemeraNetwork: 'network',
        EphemeraEvents: 'events',
        EphemeraWM: 'windows',
        EphemeraNotifications: 'notifications',
        EphemeraDialog: 'dialogs',
        EphemeraStorage: 'storage',
        EphemeraSanitize: null
    },

    LAZY_LOADABLE_APPS: {
        'settings': '/js/apps/settings.js',
        'code': '/js/apps/code.js',
        'aichat': '/js/apps/aichat.js',
        'appmanager': '/js/apps/appmanager.js',
        'chess': '/js/apps/chess.js',
        'pdfviewer': '/js/apps/pdfviewer.js',
        'passwordmanager': '/js/apps/passwordmanager.js',
        'videoplayer': '/js/apps/videoplayer.js',
        'voicerecorder': '/js/apps/voicerecorder.js',
        'snake': '/js/apps/snake.js',
        'memory': '/js/apps/memory.js',
        'paint': '/js/apps/paint.js',
        'musicplayer': '/js/apps/musicplayer.js',
        'imageviewer': '/js/apps/imageviewer.js',
        'calendar': '/js/apps/calendar.js',
        'sysmonitor': '/js/apps/sysmonitor.js',
        'minesweeper': '/js/apps/minesweeper.js'
    },

    LAZY_APP_STUBS: {
        settings: { name: 'Settings', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>', width: 500, height: 550, category: 'system' },
        code: { name: 'Code Editor', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>', width: 950, height: 650, category: 'development' },
        aichat: { name: 'AI Chat', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><circle cx="9" cy="10" r="1"/><circle cx="12" cy="10" r="1"/><circle cx="15" cy="10" r="1"/></svg>', width: 900, height: 600, category: 'productivity', singleton: true },
        appmanager: { name: 'App Manager', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>', width: 780, height: 570, category: 'system', singleton: true },
        chess: { name: 'Chess', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z"/></svg>', width: 940, height: 760, category: 'game' },
        pdfviewer: { name: 'PDF Viewer', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-2h1.5a1.5 1.5 0 010 3H9"/><path d="M15 15v-2a1.5 1.5 0 013 0v2"/><path d="M15 13h3"/></svg>', width: 900, height: 700, category: 'utility' },
        passwordmanager: { name: 'Password Vault', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>', width: 700, height: 550, category: 'utility', singleton: true },
        videoplayer: { name: 'Video Player', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/></svg>', width: 900, height: 600, category: 'media' },
        voicerecorder: { name: 'Voice Recorder', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>', width: 450, height: 550, category: 'media' },
        snake: { name: 'Snake', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.82-.13 2.67-.36"/><path d="M22 12c0-1.67-.41-3.24-1.14-4.62"/><circle cx="12" cy="12" r="3"/><path d="M18 4a2 2 0 100 4 2 2 0 000-4z"/></svg>', width: 400, height: 480, category: 'games' },
        memory: { name: 'Memory Match', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>', width: 380, height: 500, category: 'games' },
        paint: { name: 'Paint', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>', width: 800, height: 600, category: 'creative' },
        musicplayer: { name: 'Music Player', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>', width: 450, height: 400, category: 'media' },
        imageviewer: { name: 'Image Viewer', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>', width: 700, height: 500, category: 'media' },
        calendar: { name: 'Calendar', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', width: 450, height: 500, category: 'productivity' },
        sysmonitor: { name: 'System Monitor', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><polyline points="6 10 10 7 14 12 18 8"/></svg>', width: 650, height: 450, category: 'system' },
        minesweeper: { name: 'Minesweeper', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>', width: 520, height: 640, category: 'games' }
    },

    register(app) {
        const appDef = {
            id: app.id,
            name: app.name,
            icon: app.icon,
            width: app.width || 600,
            height: app.height || 400,
            singleton: app.singleton || false,
            category: app.category || 'other',
            description: app.description || '',
            content: app.content,
            onClose: app.onClose,
            permissions: app.permissions || [],
            extensionPermissions: app.extensionPermissions || app.permissions || [],
            type: this.normalizeExtensionType(app.type),
            manifest: app.manifest || null,
            isUserApp: app.isUserApp === true,
            code: app.code,
            lazyLoaded: false
        };

        this.registry.set(app.id, appDef);
        this._loadedApps.add(app.id);
        return appDef;
    },

    async lazyLoad(appId) {
        if (this._loadedApps.has(appId)) {
            return true;
        }

        if (this._pendingLoads.has(appId)) {
            return this._pendingLoads.get(appId);
        }

        const scriptPath = this.LAZY_LOADABLE_APPS[appId];
        if (!scriptPath) {
            return false;
        }

        const loadPromise = this._loadScript(scriptPath, appId);
        this._pendingLoads.set(appId, loadPromise);

        try {
            await loadPromise;
            this._loadedApps.add(appId);
            return true;
        } catch (e) {
            console.error(`[EphemeraApps] Failed to lazy load ${appId}:`, e);
            return false;
        } finally {
            this._pendingLoads.delete(appId);
        }
    },

    _lazyImporters: {
        'settings': () => import('/js/apps/settings.js'),
        'code': () => import('/js/apps/code.js'),
        'aichat': () => import('/js/apps/aichat.js'),
        'appmanager': () => import('/js/apps/appmanager.js'),
        'chess': () => import('/js/apps/chess.js'),
        'pdfviewer': () => import('/js/apps/pdfviewer.js'),
        'passwordmanager': () => import('/js/apps/passwordmanager.js'),
        'videoplayer': () => import('/js/apps/videoplayer.js'),
        'voicerecorder': () => import('/js/apps/voicerecorder.js'),
        'snake': () => import('/js/apps/snake.js'),
        'memory': () => import('/js/apps/memory.js'),
        'paint': () => import('/js/apps/paint.js'),
        'musicplayer': () => import('/js/apps/musicplayer.js'),
        'imageviewer': () => import('/js/apps/imageviewer.js'),
        'calendar': () => import('/js/apps/calendar.js'),
        'sysmonitor': () => import('/js/apps/sysmonitor.js'),
        'minesweeper': () => import('/js/apps/minesweeper.js')
    },

    _loadScript(src, appId) {
        const importer = this._lazyImporters[appId];
        if (importer) {
            return importer();
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    },

    async openWithLazyLoad(appId, options) {
        const app = this.get(appId);
        
        if (app && !this._loadedApps.has(appId)) {
            await this.lazyLoad(appId);
        }
        
        if (window.EphemeraWM) {
            return window.EphemeraWM.open(appId, options);
        }
    },

    configureEmbed(options = {}) {
        this._embedModeEnabled = options?.enabled === true;
        if (!this._embedModeEnabled) {
            this._allowedEmbedApps = null;
            return;
        }

        const allowedApps = Array.isArray(options.allowedApps)
            ? options.allowedApps
                .map((entry) => String(entry || '').trim())
                .filter(Boolean)
            : [];

        this._allowedEmbedApps = allowedApps.length > 0
            ? new Set(allowedApps)
            : null;
    },

    isAppAllowed(appId) {
        if (!this._embedModeEnabled) return true;
        if (!(this._allowedEmbedApps instanceof Set) || this._allowedEmbedApps.size === 0) return true;
        return this._allowedEmbedApps.has(String(appId || '').trim());
    },

    getAllowedEmbedApps() {
        return this._allowedEmbedApps instanceof Set ? [...this._allowedEmbedApps] : [];
    },

    get(appId) {
        const app = this.registry.get(appId);
        if (!app) return undefined;
        if (!this.isAppAllowed(app.id)) return undefined;
        return app;
    },

    getAll() {
        return Array.from(this.registry.values()).filter((app) => this.isAppAllowed(app.id));
    },

    getByCategory(category) {
        return this.getAll().filter(app => app.category === category);
    },

    getLoadedApps() {
        return Array.from(this._loadedApps);
    },

    isLoaded(appId) {
        return this._loadedApps.has(appId);
    },

    removeEphemeralApp(appId, options = {}) {
        const app = this.get(appId);
        if (!app) return false;

        if (window.EphemeraState?.installedApps?.includes(appId)) {
            return false;
        }

        const closingWindowId = options.closingWindowId;
        const openWindows = window.EphemeraWM?.getWindowsByApp
            ? window.EphemeraWM.getWindowsByApp(appId)
            : [];
        const hasOtherWindows = openWindows.some(win => win.id !== closingWindowId);
        if (hasOtherWindows) return false;

        this.deactivateExtension(appId);
        this.registry.delete(appId);
        this._loadedApps.delete(appId);
        this._pendingLoads.delete(appId);
        for (const promptKey of this._permissionPrompts.keys()) {
            if (promptKey.startsWith(`${appId}:`)) {
                this._permissionPrompts.delete(promptKey);
            }
        }

        if (options.emitEvent !== false && window.EphemeraEvents) {
            window.EphemeraEvents.emit('app:ephemeral-removed', { appId });
        }
        return true;
    },

    isUserApp(app) {
        return !!app && (app.isUserApp === true || app.category === 'user' || String(app.id || '').startsWith('com.user.'));
    },

    getUserApps() {
        return this.getAll().filter(app => this.isUserApp(app));
    },

    normalizeExtensionType(type) {
        const value = String(type || 'app').trim().toLowerCase();
        if (this.VALID_EXTENSION_TYPES.includes(value)) {
            return value;
        }
        return 'app';
    },

    normalizePermissions(permissions) {
        if (!Array.isArray(permissions)) return [];
        const valid = new Set(this.VALID_PERMISSIONS);
        return [...new Set(
            permissions
                .map(p => String(p || '').trim().toLowerCase())
                .filter(p => valid.has(p))
        )];
    },

    normalizeExtensionPermissions(permissions) {
        if (!Array.isArray(permissions)) return [];
        const valid = new Set(this.VALID_EXTENSION_PERMISSIONS);
        return [...new Set(
            permissions
                .map(p => String(p || '').trim().toLowerCase())
                .filter(p => valid.has(p))
        )];
    },

    _mapPermissionToRuntime(permission) {
        const key = String(permission || '').trim().toLowerCase();
        return this.PERMISSION_TO_RUNTIME[key] || null;
    },

    mapToRuntimePermissions(permissions) {
        if (!Array.isArray(permissions)) return [];
        const mapped = [];
        for (const permission of permissions) {
            const runtimePermission = this._mapPermissionToRuntime(permission);
            if (runtimePermission) {
                mapped.push(runtimePermission);
            }
        }
        return this.normalizePermissions(mapped);
    },

    getPermissionLabel(permission) {
        const key = String(permission || '').trim().toLowerCase();
        return this.EXTENSION_PERMISSION_LABELS[key] || this.PERMISSION_LABELS[key] || key;
    },

    getExtensionPermissions(appId) {
        const app = this.get(appId);
        if (!app) return [];
        return this.normalizeExtensionPermissions(app.extensionPermissions || app.permissions);
    },

    async requestInstallPermissionConsent(manifest, type, permissions) {
        if (!Array.isArray(permissions) || permissions.length === 0) {
            return true;
        }
        if (!window.EphemeraDialog?.show) {
            return true;
        }

        const safeName = this._escapeDialogText(manifest?.name || manifest?.id || 'Extension');
        const safeId = this._escapeDialogText(manifest?.id || 'unknown');
        const safeType = this._escapeDialogText(type || 'app');
        const permissionsText = permissions
            .map((permission) => this._escapeDialogText(this.getPermissionLabel(permission)))
            .join(', ');

        const decision = await window.EphemeraDialog.show({
            title: 'Install Extension',
            icon: 'question',
            message: `${safeName} (${safeId}) is requesting the following permissions for a ${safeType} extension: ${permissionsText}. Continue with installation?`,
            buttons: [
                { label: 'Cancel', value: 'cancel', primary: true, danger: true },
                { label: 'Install', value: 'install' }
            ]
        });

        return decision === 'install';
    },

    getAppPermissions(appId) {
        const app = this.get(appId);
        if (!app) return [];
        return this.normalizePermissions(app.permissions);
    },

    async setAppPermissions(appId, permissions) {
        const app = this.get(appId);
        if (!app) {
            throw new Error(`App not found: ${appId}`);
        }

        const normalized = this.normalizePermissions(permissions);
        app.permissions = normalized;
        const existingExtensionPermissions = this.normalizeExtensionPermissions(app.extensionPermissions || app.permissions);
        const runtimeDerivedPermissions = new Set(this.mapToRuntimePermissions(existingExtensionPermissions));
        const nonRuntimePermissions = existingExtensionPermissions.filter(
            (permission) => !runtimeDerivedPermissions.has(this._mapPermissionToRuntime(permission))
        );
        app.extensionPermissions = this.normalizeExtensionPermissions([...nonRuntimePermissions, ...normalized]);

        if (this.isUserApp(app) && window.EphemeraStorage) {
            const stored = await window.EphemeraStorage.get('apps', appId);
            if (stored && stored.manifest) {
                stored.manifest.permissions = app.extensionPermissions;
                await window.EphemeraStorage.put('apps', stored);
            }
        }

        if (window.EphemeraEvents) {
            window.EphemeraEvents.emit('app:permissions-changed', {
                appId,
                permissions: normalized,
                extensionPermissions: app.extensionPermissions
            });
        }

        return normalized;
    },

    async grantAppPermission(appId, permission) {
        const current = new Set(this.getAppPermissions(appId));
        current.add(String(permission || '').trim().toLowerCase());
        return this.setAppPermissions(appId, [...current]);
    },

    async revokeAppPermission(appId, permission) {
        const current = new Set(this.getAppPermissions(appId));
        current.delete(String(permission || '').trim().toLowerCase());
        return this.setAppPermissions(appId, [...current]);
    },

    async revokeAllAppPermissions(appId) {
        return this.setAppPermissions(appId, []);
    },

    async installApp(manifest, code, options = {}) {
        const persist = options.persist !== false;
        const emitEvent = options.emitEvent !== false;
        const skipPermissionPrompt = options.skipPermissionPrompt === true || persist === false;

        if (!manifest || typeof manifest !== 'object') {
            throw new Error('Invalid app manifest');
        }

        if (window.EphemeraValidate) {
            const manifestValidation = window.EphemeraValidate.isValidAppManifest(manifest);
            if (!manifestValidation.valid) {
                throw new Error(manifestValidation.errors?.[0] || 'Invalid app manifest');
            }
        }

        const extensionType = this.normalizeExtensionType(manifest.type);
        const extensionPermissions = this.normalizeExtensionPermissions(manifest.permissions);
        const runtimePermissions = this.mapToRuntimePermissions(extensionPermissions);
        const normalizedManifest = {
            ...manifest,
            type: extensionType,
            permissions: extensionPermissions
        };
        const sourceCode = typeof code === 'string' ? code : '';

        if ((extensionType === 'app' || extensionType === 'widget') && !sourceCode.trim()) {
            throw new Error(`${extensionType === 'widget' ? 'Widget' : 'App'} extensions require executable code`);
        }

        if (!skipPermissionPrompt) {
            const allowed = await this.requestInstallPermissionConsent(
                normalizedManifest,
                extensionType,
                extensionPermissions
            );
            if (!allowed) {
                throw new Error('Installation cancelled');
            }
        }

        const app = {
            id: normalizedManifest.id,
            name: normalizedManifest.name,
            icon: normalizedManifest.icon || this.getDefaultIcon(),
            width: normalizedManifest.window?.width || 600,
            height: normalizedManifest.window?.height || 400,
            singleton: normalizedManifest.singleton || false,
            category: normalizedManifest.category || (extensionType === 'app' ? 'user' : 'hidden'),
            description: normalizedManifest.description || '',
            type: extensionType,
            permissions: runtimePermissions,
            extensionPermissions,
            manifest: normalizedManifest,
            isUserApp: true,
            code: sourceCode,
            lazyLoaded: true
        };

        if (extensionType === 'app') {
            app.content = (windowId, _options) => {
                return {
                    html: `<div class="user-app-container" id="user-app-${windowId}" style="width:100%;height:100%;overflow:auto;"></div>`,
                    init: () => {
                        const container = document.getElementById(`user-app-${windowId}`);
                        if (container && sourceCode) {
                            this.runUserApp(container, sourceCode, windowId, normalizedManifest);
                        }
                    }
                };
            };
        } else {
            app.content = () => this.createExtensionInfoContent(app);
        }

        if (persist && window.EphemeraStorage) {
            await window.EphemeraStorage.put('apps', {
                id: normalizedManifest.id,
                manifest: normalizedManifest,
                code: sourceCode,
                installedAt: Date.now()
            });
        }

        this.register(app);
        this.activateExtension(app.id);

        if (!window.EphemeraState.installedApps.includes(app.id)) {
            window.EphemeraState.installedApps.push(app.id);
        }
        if (persist && window.EphemeraState?.save) {
            window.EphemeraState.save();
        }

        if (emitEvent) {
            window.EphemeraEvents?.emit('app:installed', { appId: app.id, type: extensionType });
        }
        return app;
    },

    async uninstallApp(appId) {
        this.deactivateExtension(appId);
        if (window.EphemeraStorage) {
            await window.EphemeraStorage.delete('apps', appId);
        }
        this.registry.delete(appId);
        this._loadedApps.delete(appId);
        for (const promptKey of this._permissionPrompts.keys()) {
            if (promptKey.startsWith(`${appId}:`)) {
                this._permissionPrompts.delete(promptKey);
            }
        }

        const idx = window.EphemeraState.installedApps.indexOf(appId);
        if (idx > -1) {
            window.EphemeraState.installedApps.splice(idx, 1);
            window.EphemeraState.save();
        }

        window.EphemeraEvents?.emit('app:uninstalled', { appId });
    },

    async loadInstalledApps() {
        const apps = await window.EphemeraStorage.getAll('apps');
        const loadedIds = new Set();
        for (const appData of apps) {
            try {
                await this.installApp(appData.manifest, appData.code, {
                    persist: false,
                    emitEvent: false,
                    skipPermissionPrompt: true
                });
                if (appData?.manifest?.id) {
                    loadedIds.add(appData.manifest.id);
                }
            } catch (e) {
                console.error(`Failed to load app ${appData.id}:`, e);
            }
        }

        window.EphemeraState.installedApps = [...loadedIds];
        window.EphemeraState.save();
    },

    createExtensionInfoContent(app) {
        const esc = (value) => this._escapeDialogText(value);
        const permissionList = this.getExtensionPermissions(app.id)
            .map((permission) => this.getPermissionLabel(permission))
            .join(', ');
        const typeLabel = this.normalizeExtensionType(app.type);
        const permissionsLabel = permissionList || 'none';
        return {
            html: `
                <div style="padding:18px;font-family:'Space Grotesk',sans-serif;">
                    <h3 style="margin:0 0 8px 0;font-size:1rem;">${esc(app.name)}</h3>
                    <p style="margin:0 0 10px 0;color:var(--fg-secondary);font-size:0.85rem;">${esc(app.description || 'Extension installed successfully.')}</p>
                    <div style="font-size:0.78rem;color:var(--fg-muted);line-height:1.7;">
                        <div><strong>Type:</strong> ${esc(typeLabel)}</div>
                        <div><strong>ID:</strong> ${esc(app.id)}</div>
                        <div><strong>Permissions:</strong> ${esc(permissionsLabel)}</div>
                    </div>
                </div>
            `
        };
    },

    _runExtensionAction(action, app) {
        if (!action) return;

        const appId = app?.id || 'extension';
        const run = async () => {
            if (typeof action === 'string') {
                if (action.startsWith('event:')) {
                    window.EphemeraEvents?.emit(action.slice(6), { source: appId });
                    return;
                }
                const targetAppId = action.startsWith('app:') ? action.slice(4) : action;
                window.EphemeraWM?.open?.(targetAppId);
                return;
            }

            if (typeof action !== 'object') return;

            const type = String(action.type || 'open-app').trim().toLowerCase();
            if (type === 'open-app') {
                const targetAppId = String(action.appId || action.id || '').trim();
                if (targetAppId) {
                    window.EphemeraWM?.open?.(targetAppId, action.options || {});
                }
                return;
            }

            if (type === 'emit-event') {
                const eventName = String(action.event || '').trim();
                if (eventName) {
                    window.EphemeraEvents?.emit?.(eventName, action.payload);
                }
                return;
            }

            if (type === 'open-url') {
                const rawUrl = String(action.url || '').trim();
                const safeUrl = window.EphemeraSanitize?.sanitizeUrl
                    ? window.EphemeraSanitize.sanitizeUrl(rawUrl)
                    : rawUrl;
                if (safeUrl) {
                    window.open(safeUrl, '_blank', 'noopener,noreferrer');
                }
                return;
            }

            if (type === 'notify') {
                const title = String(action.title || app?.name || 'Extension');
                const message = String(action.message || '');
                const level = String(action.level || 'info').toLowerCase();
                const notifier = window.EphemeraNotifications?.[level] || window.EphemeraNotifications?.info;
                if (typeof notifier === 'function') {
                    notifier(title, message);
                }
            }
        };

        run().catch((error) => {
            console.error(`[EphemeraApps] Extension action failed (${appId}):`, error);
            window.EphemeraNotifications?.error?.('Extension Error', error?.message || String(error));
        });
    },

    sanitizeExtensionIcon(iconMarkup) {
        const source = String(iconMarkup || '').trim();
        if (!source) return '';
        if (window.EphemeraSanitize?.sanitizeHtml) {
            return window.EphemeraSanitize.sanitizeHtml(source, {
                ALLOWED_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'ellipse'],
                ALLOWED_ATTR: [
                    'viewBox', 'fill', 'stroke', 'stroke-width', 'd', 'cx', 'cy', 'r',
                    'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'width', 'height'
                ],
                ALLOW_DATA_ATTR: false
            });
        }
        if (/<script|on\w+\s*=|javascript:/i.test(source)) return '';
        return source;
    },

    _registerExtensionTaskbarItem(app, entry, index) {
        const container = document.getElementById('taskbar-apps');
        if (!container) return null;
        if (window.EphemeraWM?.isMobileShell?.()) return null;

        const item = document.createElement('div');
        item.className = 'taskbar-app extension-taskbar-item';
        item.dataset.appId = `extension:${app.id}`;
        item.dataset.extensionItemId = String(entry?.id || `taskbar-${index}`);
        item.dataset.windowId = `ext-${app.id}-${index}`;
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', String(entry?.label || entry?.title || app.name));
        item.innerHTML = this.sanitizeExtensionIcon(entry?.icon || app.icon || this.getDefaultIcon()) || this.getDefaultIcon();

        const onActivate = () => {
            this._runExtensionAction(entry?.action || { type: 'open-app', appId: entry?.appId }, app);
        };
        const onKeyDown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onActivate();
            }
        };

        item.addEventListener('click', onActivate);
        item.addEventListener('keydown', onKeyDown);
        container.appendChild(item);

        return () => {
            item.removeEventListener('click', onActivate);
            item.removeEventListener('keydown', onKeyDown);
            item.remove();
        };
    },

    _registerExtensionContextMenuItem(app, entry, index) {
        const menu = document.getElementById('context-menu');
        if (!menu) return null;

        const item = document.createElement('div');
        item.className = 'context-item extension-context-item';
        item.dataset.action = `extension:${app.id}:${index}`;
        item.setAttribute('role', 'menuitem');
        item.setAttribute('tabindex', '-1');
        const label = String(entry?.label || entry?.title || app.name);
        const icon = this.sanitizeExtensionIcon(entry?.icon || app.icon || this.getDefaultIcon()) || this.getDefaultIcon();
        item.innerHTML = `${icon}<span>${this._escapeDialogText(label)}</span>`;

        const onClick = () => {
            this._runExtensionAction(entry?.action || { type: 'open-app', appId: entry?.appId }, app);
            const contextMenu = document.getElementById('context-menu');
            if (contextMenu) {
                contextMenu.style.display = 'none';
            }
        };
        item.addEventListener('click', onClick);

        const divider = menu.querySelector('.context-divider');
        if (divider?.parentNode) {
            divider.parentNode.insertBefore(item, divider);
        } else {
            menu.appendChild(item);
        }

        return () => {
            item.removeEventListener('click', onClick);
            item.remove();
        };
    },

    _registerSystemExtension(app, manifest) {
        const disposers = [];
        const contributes = (manifest?.contributes && typeof manifest.contributes === 'object')
            ? manifest.contributes
            : {};

        const commands = Array.isArray(contributes.commands) ? contributes.commands : [];
        if (commands.length > 0 && window.EphemeraCommandPalette?.registerCommands) {
            const registeredCommands = commands
                .map((entry, index) => {
                    if (!entry || typeof entry !== 'object') return null;
                    const title = String(entry.title || entry.name || '').trim();
                    if (!title) return null;
                    return {
                        id: String(entry.id || `${app.id}.command.${index}`),
                        title,
                        subtitle: String(entry.subtitle || manifest?.name || 'Extension Command'),
                        keywords: String(entry.keywords || ''),
                        mode: entry.mode === 'files' || entry.mode === 'both' ? entry.mode : 'actions',
                        icon: String(entry.icon || app.icon || ''),
                        action: () => this._runExtensionAction(entry.action || { type: 'open-app', appId: entry.appId }, app)
                    };
                })
                .filter(Boolean);

            if (registeredCommands.length > 0) {
                const unregister = window.EphemeraCommandPalette.registerCommands(registeredCommands, {
                    source: `extension:${app.id}`
                });
                if (typeof unregister === 'function') {
                    disposers.push(unregister);
                }
            }
        }

        const shortcuts = Array.isArray(contributes.shortcuts) ? contributes.shortcuts : [];
        if (shortcuts.length > 0 && window.EphemeraShortcuts?.register) {
            shortcuts.forEach((entry) => {
                const combo = String(entry?.combo || entry?.shortcut || '').trim().toLowerCase();
                if (!combo) return;
                const unregister = window.EphemeraShortcuts.register(combo, () => {
                    this._runExtensionAction(entry?.action || { type: 'open-app', appId: entry?.appId }, app);
                });
                if (typeof unregister === 'function') {
                    disposers.push(unregister);
                }
            });
        }

        const taskbarItems = Array.isArray(contributes.taskbar)
            ? contributes.taskbar
            : (Array.isArray(contributes.taskBar) ? contributes.taskBar : []);
        taskbarItems.forEach((entry, index) => {
            const dispose = this._registerExtensionTaskbarItem(app, entry, index);
            if (typeof dispose === 'function') {
                disposers.push(dispose);
            }
        });

        const contextMenuItems = Array.isArray(contributes.contextMenu)
            ? contributes.contextMenu
            : (Array.isArray(contributes.contextmenu) ? contributes.contextmenu : []);
        contextMenuItems.forEach((entry, index) => {
            const dispose = this._registerExtensionContextMenuItem(app, entry, index);
            if (typeof dispose === 'function') {
                disposers.push(dispose);
            }
        });

        return disposers;
    },

    _registerThemeExtension(app, manifest) {
        const theme = (manifest?.theme && typeof manifest.theme === 'object') ? manifest.theme : {};
        const tokens = (theme.tokens && typeof theme.tokens === 'object') ? theme.tokens : {};
        const declaredCss = typeof theme.css === 'string' ? theme.css : '';
        const codeCss = typeof app.code === 'string' ? app.code : '';

        const cssVars = Object.entries(tokens)
            .map(([rawKey, rawValue]) => {
                const key = String(rawKey || '').trim();
                const value = String(rawValue || '').trim();
                if (!key || !value) return '';
                const varName = key.startsWith('--') ? key : `--${key}`;
                return `${varName}: ${value};`;
            })
            .filter(Boolean)
            .join('\n');

        const styleText = [
            cssVars ? `:root {\n${cssVars}\n}` : '',
            declaredCss,
            declaredCss && codeCss ? '\n' : '',
            codeCss
        ].join('');

        if (!styleText.trim()) {
            return null;
        }

        const styleId = `extension-theme-${String(app.id || '').replace(/[^a-z0-9_-]/gi, '-')}`;
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.dataset.appId = app.id;
        styleEl.textContent = styleText;
        document.head.appendChild(styleEl);

        return () => {
            styleEl.remove();
        };
    },

    _registerWidgetExtension(app, manifest) {
        if (!window.EphemeraWidgets?.registerExtensionWidget) {
            return null;
        }

        window.EphemeraWidgets.registerExtensionWidget(app.id, manifest, app.code || '');
        return () => {
            if (window.EphemeraWidgets?.unregisterExtensionWidget) {
                window.EphemeraWidgets.unregisterExtensionWidget(app.id);
            }
        };
    },

    activateExtension(appId) {
        const app = this.get(appId);
        if (!app) return;

        this.deactivateExtension(appId);
        const type = this.normalizeExtensionType(app.type);
        const manifest = app.manifest || { id: app.id, name: app.name, type };
        const disposers = [];

        if (type === 'system') {
            disposers.push(...this._registerSystemExtension(app, manifest));
        } else if (type === 'widget') {
            const disposeWidget = this._registerWidgetExtension(app, manifest);
            if (typeof disposeWidget === 'function') {
                disposers.push(disposeWidget);
            }
        } else if (type === 'theme') {
            const disposeTheme = this._registerThemeExtension(app, manifest);
            if (typeof disposeTheme === 'function') {
                disposers.push(disposeTheme);
            }
        } else if (type === 'editor') {
            window.EphemeraEvents?.emit?.('editor:extension-activated', { appId: app.id, manifest });
            disposers.push(() => {
                window.EphemeraEvents?.emit?.('editor:extension-deactivated', { appId: app.id, manifest });
            });
        }

        if (disposers.length > 0) {
            this._extensionDisposers.set(appId, disposers);
        } else {
            this._extensionDisposers.delete(appId);
        }

        if (type !== 'app') {
            window.EphemeraEvents?.emit?.('extension:activated', { appId, type });
        }
    },

    deactivateExtension(appId) {
        const disposers = this._extensionDisposers.get(appId);
        if (!Array.isArray(disposers) || disposers.length === 0) {
            return;
        }

        for (const dispose of disposers) {
            try {
                if (typeof dispose === 'function') {
                    dispose();
                }
            } catch (e) {
                console.warn(`[EphemeraApps] Failed to dispose extension ${appId}:`, e);
            }
        }

        this._extensionDisposers.delete(appId);
        const app = this.get(appId);
        const type = this.normalizeExtensionType(app?.type);
        if (type !== 'app') {
            window.EphemeraEvents?.emit?.('extension:deactivated', { appId, type });
        }
    },

    runUserApp(container, code, windowId, manifest) {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('sandbox', 'allow-scripts');
        iframe.style.cssText = 'width:100%;height:100%;border:none;background:transparent;';

        const channel = new MessageChannel();
        const bridgePort = channel.port1;
        const initBridge = () => {
            if (!iframe.contentWindow) return;
            iframe.contentWindow.postMessage({
                type: 'ephemera-init-bridge',
                windowId,
                manifest,
                code
            }, '*', [channel.port2]);
        };

        iframe.addEventListener('load', initBridge, { once: true });

        const baseUrl = import.meta.env?.BASE_URL || '/';
        const sandboxUrl = new URL(`${baseUrl}sandbox/app.html`, window.location.href);
        sandboxUrl.searchParams.set('parentOrigin', window.location.origin);
        iframe.src = sandboxUrl.toString();
        container.innerHTML = '';
        container.appendChild(iframe);

        bridgePort.onmessage = (event) => {
            const data = event.data || {};
            if (data.type === 'ephemera-console') {
                const fn = window.console[data.level] || window.console.log;
                fn(`[${data.appName}]`, ...(data.args || []));
                return;
            }

            if (data.type === 'ephemera-bridge' && data.windowId === windowId) {
                const { id, api, method, args } = data;
                this._handleBridgeCall(id, api, method, args, windowId, manifest.id, bridgePort);
            }
        };
        bridgePort.start();

        const win = window.EphemeraState.windows.find(w => w.id === windowId);
        if (win) {
            const origOnClose = win.app?.onClose;
            win.app = win.app || {};
            win.app.onClose = (wid) => {
                try {
                    bridgePort.close();
                } catch (_e) {
                    // Port may already be closed.
                }
                if (origOnClose) origOnClose(wid);
            };
        }
    },

    _escapeDialogText(value) {
        const text = String(value ?? '');
        if (window.EphemeraSanitize?.escapeHtml) {
            return window.EphemeraSanitize.escapeHtml(text);
        }
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    async _requestRuntimePermission(app, permission, api, method) {
        if (!permission) return true;
        if (!this.isUserApp(app)) return false;
        if (!window.EphemeraDialog?.show) return false;

        const promptKey = `${app.id}:${permission}`;
        if (this._permissionPrompts.has(promptKey)) {
            return this._permissionPrompts.get(promptKey);
        }

        const promptPromise = (async () => {
            const permissionLabel = this.PERMISSION_LABELS[permission] || permission;
            const safeAppName = this._escapeDialogText(app.name || app.id);
            const safeAppId = this._escapeDialogText(app.id);
            const safePermission = this._escapeDialogText(permissionLabel);
            const safeApiCall = this._escapeDialogText(`${api}.${method}`);

            const decision = await window.EphemeraDialog.show({
                title: 'Permission Request',
                icon: 'question',
                message: `${safeAppName} (${safeAppId}) is requesting ${safePermission} access to call ${safeApiCall}. Choose how to handle this request:`,
                buttons: [
                    { label: 'Deny', value: 'deny', primary: true, danger: true },
                    { label: 'Allow Once', value: 'once' },
                    { label: 'Always Allow', value: 'always' }
                ]
            });

            if (decision === 'always') {
                await this.grantAppPermission(app.id, permission);
                return true;
            }

            return decision === 'once';
        })();

        this._permissionPrompts.set(promptKey, promptPromise);
        try {
            return await promptPromise;
        } catch (e) {
            console.error('[EphemeraApps] Permission prompt failed:', e);
            return false;
        } finally {
            this._permissionPrompts.delete(promptKey);
        }
    },

    async _handleBridgeCall(id, api, method, args, windowId, manifestAppId, bridgePort) {
        const allowedAPIs = {
            EphemeraFS: ['readFile', 'writeFile', 'readdir', 'mkdir', 'delete', 'exists', 'stat', 'move', 'copy'],
            EphemeraNetwork: ['fetch', 'get', 'post'],
            EphemeraEvents: ['emit'],
            EphemeraWM: ['open', 'close'],
            EphemeraNotifications: ['success', 'error', 'info', 'warning'],
            EphemeraDialog: ['alert', 'confirm', 'prompt'],
            EphemeraStorage: ['put', 'get', 'delete', 'getAll'],
            EphemeraSanitize: ['escapeHtml', 'escapeAttr', 'sanitizeUrl']
        };

        const reply = (result, error) => {
            try {
                bridgePort.postMessage({
                    type: 'ephemera-bridge-reply', id,
                    result: error ? undefined : result,
                    error: error || undefined
                });
            } catch (_e) {
                // If posting back fails, the app iframe likely closed.
            }
        };

        if (!allowedAPIs[api] || !allowedAPIs[api].includes(method)) {
            reply(null, `Access denied: ${api}.${method}`);
            return;
        }

        const windowInfo = window.EphemeraWM?.getWindow
            ? window.EphemeraWM.getWindow(windowId)
            : window.EphemeraState?.windows?.find(w => w.id === windowId);
        const windowAppId = windowInfo?.appId;
        const resolvedAppId = windowAppId || manifestAppId;
        const app = resolvedAppId ? this.get(resolvedAppId) : null;
        if (!app) {
            reply(null, 'App context not found');
            return;
        }
        const grantedPermissions = new Set(this.getAppPermissions(app.id));

        const requiredPermission = this.API_PERMISSIONS[api];
        if (requiredPermission && !grantedPermissions.has(requiredPermission)) {
            const allowed = await this._requestRuntimePermission(app, requiredPermission, api, method);
            if (!allowed) {
                reply(null, `Permission denied: "${requiredPermission}" is required for ${api}.${method}`);
                return;
            }
        }

        const target = window[api];
        if (!target || typeof target[method] !== 'function') {
            reply(null, `Unknown method: ${api}.${method}`);
            return;
        }

        try {
            const result = await target[method](...(args || []));
            reply(result);
        } catch (e) {
            reply(null, e?.message || String(e));
        }
    },

    getDefaultIcon() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="12" cy="12" r="3"/>
        </svg>`;
    },

    createManifestTemplate() {
        return {
            // Required: Unique app identifier (e.g., "com.user.myapp")
            id: "com.user.myapp",
            
            // Required: Display name shown in UI
            name: "My App",

            // Extension type: app, system, editor, theme, or widget
            type: "app",
            
            // Semantic version
            version: "1.0.0",
            
            // Short description
            description: "A custom Ephemera application",
            
            // SVG icon markup (or leave empty for default)
            icon: "",
            
            // Category for grouping: "user", "system", "utility", etc.
            category: "user",
            
            // Least-privilege permissions (legacy + extension scopes)
            // e.g. filesystem:read, notifications, ai, clipboard
            permissions: [],

            // Optional extension contributions (system/editor/theme types)
            contributes: {
                commands: [],
                shortcuts: [],
                taskbar: [],
                contextMenu: []
            },

            // Optional widget configuration (used when type is "widget")
            widget: {
                name: "My Widget",
                icon: "🧩",
                width: 260,
                height: 180
            },
            
            // Window configuration
            window: {
                width: 600,        // Initial width in pixels
                height: 400,       // Initial height in pixels
                resizable: true,   // Allow window resizing
                minWidth: 300,     // Minimum width
                minHeight: 200     // Minimum height
            },
            
            // If true, only one window instance allowed
            singleton: false
        };
    },

    createCodeTemplate() {
        return `/**
 * Ephemera App Template
 * ======================
 * 
 * AVAILABLE APIs (see /PROGRAMMERS_GUIDE.md for full documentation):
 * 
 * FILE SYSTEM (EphemeraFS):
 *   await EphemeraFS.readFile(path)           - Read file content
 *   await EphemeraFS.writeFile(path, content) - Write/create file
 *   await EphemeraFS.delete(path)             - Delete file
 *   await EphemeraFS.readdir(path)            - List directory
 *   await EphemeraFS.mkdir(path)              - Create directory
 *   await EphemeraFS.exists(path)             - Check if exists
 *   await EphemeraFS.stat(path)               - Get file info
 *   EphemeraFS.getExtension(path)             - Get file extension
 *   EphemeraFS.getBasename(path)              - Get filename
 * 
 * STORAGE (EphemeraStorage):
 *   await EphemeraStorage.put(store, data)    - Save data {key, value}
 *   await EphemeraStorage.get(store, key)     - Retrieve by key
 *   await EphemeraStorage.delete(store, key)  - Delete by key
 *   Stores: 'files', 'apps', 'metadata'
 * 
 * WINDOWS (EphemeraWM):
 *   EphemeraWM.open(appId, options)           - Open app/window
 *   EphemeraWM.close(windowId)                - Close window
 *   EphemeraWM.focus(windowId)                - Focus window
 * 
 * NETWORK (EphemeraNetwork):
 *   await EphemeraNetwork.get(url)            - HTTP GET
 *   await EphemeraNetwork.getJSON(url)        - GET and parse JSON
 *   await EphemeraNetwork.post(url, data)     - HTTP POST
 * 
 * DIALOGS (EphemeraDialog):
 *   await EphemeraDialog.alert(msg, title)    - Show alert
 *   await EphemeraDialog.confirm(msg, title)  - Yes/No dialog
 *   await EphemeraDialog.prompt(msg, title)   - Input dialog
 * 
 * NOTIFICATIONS (EphemeraNotifications):
 *   EphemeraNotifications.success(title, msg)
 *   EphemeraNotifications.error(title, msg)
 *   EphemeraNotifications.info(title, msg)
 *   EphemeraNotifications.warning(title, msg)
 * 
 * STATE (EphemeraState):
 *   EphemeraState.settings                    - App settings object
 *   EphemeraState.updateSetting(key, value)   - Update and save
 *   EphemeraState.user                        - Current user info
 * 
 * EVENTS (EphemeraEvents):
 *   EphemeraEvents.on(event, callback)        - Subscribe (returns unsubscribe fn)
 *   EphemeraEvents.emit(event, data)          - Publish event
 *   EphemeraEvents.once(event, callback)      - One-time subscription
 * 
 * SECURITY (EphemeraSanitize):
 *   EphemeraSanitize.escapeHtml(str)          - Escape HTML chars
 *   EphemeraSanitize.escapeAttr(str)          - Escape for attributes
 *   EphemeraSanitize.sanitizeUrl(url)         - Validate/block dangerous URLs
 *   EphemeraSanitize.debounce(fn, ms)         - Debounce function
 * 
 * GLOBAL VARIABLES IN YOUR APP:
 *   container  - Your app's root DOM element (HTMLElement)
 *   windowId   - Unique ID for this window instance (string)
 * 
 * CSS VARIABLES (use for theming):
 *   --bg-primary, --bg-secondary, --bg-tertiary
 *   --fg-primary, --fg-secondary, --fg-muted
 *   --accent, --accent-hover, --accent-glow
 *   --border, --danger, --warning
 *   --radius-sm, --radius-md, --radius-lg
 *   --font-mono
 */

function init() {
    container.innerHTML = \`
        <style>
            .my-app { padding: 20px; }
            .my-app h1 { color: var(--fg-primary); margin-bottom: 16px; }
            .my-app button {
                padding: 8px 16px;
                background: var(--accent);
                color: var(--bg-primary);
                border: none;
                border-radius: var(--radius-sm);
                cursor: pointer;
            }
        </style>
        <div class="my-app">
            <h1>Hello, Ephemera!</h1>
            <p>Welcome to my app.</p>
            <button id="btn">Click Me</button>
            <p id="status" style="margin-top: 12px; color: var(--fg-secondary);"></p>
        </div>
    \`;
    
    const statusEl = document.getElementById('status');
    document.getElementById('btn').addEventListener('click', async () => {
        if (statusEl) statusEl.textContent = 'Button clicked.';
        try {
            await EphemeraNotifications.success('Button clicked!', 'Success');
        } catch (_e) {
            // Notifications require explicit permission; keep base UX working without it.
        }
    });
}

init();
`;
    }
};

// Register stubs for lazy-loaded apps so they appear in start menu
for (const [id, stub] of Object.entries(EphemeraApps.LAZY_APP_STUBS)) {
    if (!EphemeraApps.registry.has(id)) {
        EphemeraApps.registry.set(id, {
            id,
            name: stub.name,
            icon: stub.icon,
            width: stub.width,
            height: stub.height,
            singleton: stub.singleton === true,
            category: stub.category,
            description: '',
            content: null,
            permissions: [],
            lazyLoaded: true
        });
    }
}

window.EphemeraApps = EphemeraApps;
export default EphemeraApps;
