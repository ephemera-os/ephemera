// @ts-check

/**
 * @typedef {{
 *   proxyUrl: string;
 *   proxyEnabled: boolean;
 *   theme: string;
 *   locale: string;
 *   notifications: boolean;
 *   terminalBackendEnabled: boolean;
 *   terminalBackendUrl: string;
 *   aiProvider: string;
 *   aiModel: string;
 *   aiMaxTokens: number;
 *   aiTemperature: number;
 *   fileHistoryMode: string;
 *   fileHistoryMaxVersions: number;
 *   fileHistoryWarnMb: number;
 *   editorEngine: string;
 *   [key: string]: unknown;
 * }} EphemeraSettings
 */

/**
 * @typedef {{
 *   id: string;
 *   name: string;
 *   homeDir: string;
 *   [key: string]: unknown;
 * }} EphemeraUser
 */

const EphemeraState = {
    windows: [],
    windowIdCounter: 0,
    activeWindowId: null,
    currentWorkspace: 0,
    workspaces: [[], [], [], []],
    workspaceNames: ['Focus', 'Build', 'Review', 'Explore'],
    workspaceWallpapers: ['particles', 'particles', 'particles', 'particles'],
    workspaceIconLayouts: [{ order: [], openCategory: null }, { order: [], openCategory: null }, { order: [], openCategory: null }, { order: [], openCategory: null }],
    wallpaper: 'particles',
    bootComplete: false,
    /** @type {EphemeraSettings} */
    settings: {
        proxyUrl: 'https://api.allorigins.win/raw?url=',
        proxyEnabled: true,
        theme: 'dark',
        locale: 'en',
        notifications: true,
        terminalBackendEnabled: false,
        terminalBackendUrl: '',
        aiProvider: 'openrouter',
        aiModel: 'openrouter/free',
        aiMaxTokens: 8192,
        aiTemperature: 0.7,
        fileHistoryMode: 'every-save',
        fileHistoryMaxVersions: 10,
        fileHistoryWarnMb: 25,
        editorEngine: 'cm5'
    },
    /** @type {EphemeraUser} */
    user: {
        id: 'default',
        name: 'user',
        homeDir: '/home/user'
    },
    notifications: [],
    installedApps: [],
    
    load() {
        try {
            const saved = localStorage.getItem('ephemeraState');
            if (saved) {
                const data = /** @type {{settings?: Record<string, unknown>, user?: Record<string, unknown>, wallpaper?: string, installedApps?: unknown[], currentWorkspace?: number, workspaceNames?: string[], workspaceWallpapers?: string[], workspaceIconLayouts?: Array<{order?: string[], openCategory?: string | null}>}} */ (JSON.parse(saved));
                this.settings = { ...this.settings, ...(data.settings || {}) };
                this.user = { ...this.user, ...(data.user || {}) };
                this.wallpaper = data.wallpaper || 'particles';
                this.installedApps = data.installedApps || [];
                if (Array.isArray(data.workspaceNames) && data.workspaceNames.length > 0) {
                    this.workspaceNames = this.workspaces.map((_, index) => {
                        const candidate = String(data.workspaceNames[index] || '').trim();
                        return candidate || this.workspaceNames[index] || `Workspace ${index + 1}`;
                    });
                }
                if (Array.isArray(data.workspaceWallpapers) && data.workspaceWallpapers.length > 0) {
                    this.workspaceWallpapers = this.workspaces.map((_, index) => {
                        const wallpaper = String(data.workspaceWallpapers[index] || '').trim();
                        return wallpaper || data.wallpaper || this.workspaceWallpapers[index] || 'particles';
                    });
                } else {
                    this.workspaceWallpapers = this.workspaces.map((_, index) => this.workspaceWallpapers[index] || this.wallpaper || 'particles');
                }
                if (Array.isArray(data.workspaceIconLayouts) && data.workspaceIconLayouts.length > 0) {
                    this.workspaceIconLayouts = this.workspaces.map((_, index) => {
                        const entry = data.workspaceIconLayouts[index];
                        return {
                            order: Array.isArray(entry?.order) ? entry.order.map((value) => String(value)) : [],
                            openCategory: entry?.openCategory ? String(entry.openCategory) : null
                        };
                    });
                } else {
                    this.workspaceIconLayouts = this.workspaces.map(() => ({ order: [], openCategory: null }));
                }

                const requestedWorkspace = Number.parseInt(String(data.currentWorkspace ?? 0), 10);
                const maxWorkspace = this.workspaces.length - 1;
                this.currentWorkspace = Number.isFinite(requestedWorkspace)
                    ? Math.max(0, Math.min(maxWorkspace, requestedWorkspace))
                    : 0;
                this.wallpaper = this.workspaceWallpapers[this.currentWorkspace] || this.wallpaper || 'particles';
            }
        } catch (e) {
            console.warn('Failed to load state:', e);
        }
    },
    
    save() {
        try {
            const data = {
                settings: this.settings,
                user: this.user,
                wallpaper: this.wallpaper,
                installedApps: this.installedApps,
                currentWorkspace: this.currentWorkspace,
                workspaceNames: this.workspaceNames,
                workspaceWallpapers: this.workspaceWallpapers,
                workspaceIconLayouts: this.workspaceIconLayouts
            };
            localStorage.setItem('ephemeraState', JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    },
    
    /**
     * @param {string} key
     * @param {unknown} value
     * @returns {void}
     */
    updateSetting(key, value) {
        const settings = /** @type {Record<string, unknown>} */ (this.settings);
        settings[key] = value;
        this.save();
        EphemeraEvents.emit('setting:changed', { key, value });
    }
};

window.EphemeraState = EphemeraState;
