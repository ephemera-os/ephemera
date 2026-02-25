const EphemeraSessionRecovery = {
    STORAGE_KEY: 'ephemera_session_recovery',
    _saveTimeout: null,
    _enabled: true,

    init() {
        EphemeraEvents.on('window:opened', () => this.scheduleSave());
        EphemeraEvents.on('window:closed', () => this.scheduleSave());
        EphemeraEvents.on('window:minimized', () => this.scheduleSave());
        EphemeraEvents.on('window:maximized', () => this.scheduleSave());
        EphemeraEvents.on('window:snapped', () => this.scheduleSave());

        window.addEventListener('beforeunload', () => {
            this.save();
        });

        EphemeraEvents.on('desktop:ready', () => {
            this.checkRecovery();
        });
    },

    scheduleSave() {
        if (!this._enabled) return;
        if (this._saveTimeout) clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(() => this.save(), 500);
    },

    async save() {
        if (!this._enabled) return;

        const sessionData = {
            timestamp: Date.now(),
            workspace: EphemeraState.currentWorkspace,
            windows: []
        };

        EphemeraState.windows.forEach(win => {
            if (!win || !win.element) return;

            const rect = win.element.getBoundingClientRect();
            const isMaximized = win.element.classList.contains('maximized');
            const isMinimized = win.element.classList.contains('minimized');
            
            let snapState = null;
            ['snapped-left', 'snapped-right', 'snapped-tl', 'snapped-tr', 'snapped-bl', 'snapped-br'].forEach(cls => {
                if (win.element.classList.contains(cls)) {
                    snapState = cls;
                }
            });

            const serializableOptions = {};
            if (win.options) {
                for (const key of Object.keys(win.options)) {
                    const val = win.options[key];
                    if (typeof val !== 'function' && typeof val !== 'undefined') {
                        serializableOptions[key] = val;
                    }
                }
            }

            sessionData.windows.push({
                appId: win.appId,
                options: serializableOptions,
                state: {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    maximized: isMaximized,
                    minimized: isMinimized,
                    snapped: snapState
                }
            });
        });

        try {
            await EphemeraStorage.put('metadata', { key: this.STORAGE_KEY, ...sessionData });
        } catch (e) {
            console.warn('[SessionRecovery] Failed to save session:', e);
        }
    },

    async checkRecovery() {
        const session = await EphemeraStorage.get('metadata', this.STORAGE_KEY);
        if (!session || !session.windows || session.windows.length === 0) return;

        const age = Date.now() - session.timestamp;
        const maxAge = 24 * 60 * 60 * 1000;

        if (age > maxAge) {
            await this.clear();
            return;
        }

        const timeAgo = this.formatTimeAgo(session.timestamp);
        const message = `A previous session from ${timeAgo} was found with ${session.windows.length} open window${session.windows.length > 1 ? 's' : ''}. Would you like to restore it?`;

        const restore = await EphemeraDialog.confirm(message, 'Restore Session?');
        
        if (restore) {
            await this.restore(session);
        } else {
            await this.clear();
        }
    },

    async restore(session) {
        if (!session || !session.windows) return;

        if (session.workspace && EphemeraState.workspaces[session.workspace]) {
            EphemeraState.currentWorkspace = session.workspace;
        }

        for (const winData of session.windows) {
            const app = EphemeraApps.get(winData.appId);
            if (!app) continue;

            setTimeout(() => {
                const windowId = EphemeraWM.open(winData.appId, winData.options);
                if (windowId && winData.state) {
                    setTimeout(() => {
                        const win = EphemeraWM.getWindow(windowId);
                        if (win && win.element) {
                            if (winData.state.left) win.element.style.left = winData.state.left + 'px';
                            if (winData.state.top) win.element.style.top = Math.max(0, winData.state.top) + 'px';
                            if (winData.state.width) win.element.style.width = winData.state.width + 'px';
                            if (winData.state.height) win.element.style.height = winData.state.height + 'px';
                            
                            if (winData.state.maximized) {
                                win.element.classList.add('maximized');
                            }
                            if (winData.state.snapped) {
                                win.element.classList.add(winData.state.snapped);
                            }
                            if (winData.state.minimized) {
                                win.element.classList.add('minimized');
                            }
                        }
                    }, 100);
                }
            }, 100);
        }

        EphemeraNotifications.success('Session Restored', `${session.windows.length} window${session.windows.length > 1 ? 's' : ''} restored.`);
        await this.clear();
    },

    async clear() {
        try {
            await EphemeraStorage.delete('metadata', this.STORAGE_KEY);
        } catch (e) {
            console.warn('[SessionRecovery] Failed to clear session:', e);
        }
    },

    formatTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    },

    enable() {
        this._enabled = true;
    },

    disable() {
        this._enabled = false;
    },

    isEnabled() {
        return this._enabled;
    }
};

window.EphemeraSessionRecovery = EphemeraSessionRecovery;
