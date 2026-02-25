const EphemeraBoot = {
    particles: [],
    animationId: null,
    _clockInterval: null,
    _resizeHandler: null,
    _mousemoveHandler: null,
    _wallpaperInitialized: false,
    _wallpaperSettingUnsub: null,
    _particlesAnimator: null,
    _particlesActive: false,
    _i18nUnsub: null,
    _motionUnsub: null,
    MOBILE_VIEWPORT_WIDTH: 768,
    WORKSPACE_COUNT: 4,
    _workspaceEventsBound: false,
    _workspaceEventUnsubs: [],
    _workspaceOverviewEl: null,
    _workspaceOverviewKeyHandler: null,
    _draggedDesktopIcon: null,
    _workspaceHotkeyHandler: null,

    APP_CATEGORIES: {
        system: { name: 'System', icon: '\u2699\uFE0F', order: 1 },
        productivity: { name: 'Productivity', icon: '\uD83D\uDCCB', order: 2 },
        utility: { name: 'Utilities', icon: '\uD83D\uDD27', order: 3 },
        development: { name: 'Development', icon: '\uD83D\uDCBB', order: 4 },
        media: { name: 'Media', icon: '\uD83C\uDFAC', order: 5 },
        creative: { name: 'Creative', icon: '\uD83C\uDFA8', order: 6 },
        internet: { name: 'Internet', icon: '\uD83C\uDF10', order: 7 },
        games: { name: 'Games', icon: '\uD83C\uDFAE', order: 8 },
        game: { name: 'Games', icon: '\uD83C\uDFAE', order: 8 },
        user: { name: 'My Apps', icon: '\uD83D\uDCF1', order: 0 }
    },

    _t(key, params = {}, fallback = '') {
        if (window.EphemeraI18n?.t) {
            return window.EphemeraI18n.t(key, params, fallback);
        }
        const source = fallback || key;
        return String(source).replace(/\{([a-zA-Z0-9_]+)\}/g, (_all, token) => {
            if (Object.prototype.hasOwnProperty.call(params, token)) {
                return String(params[token]);
            }
            return '';
        });
    },

    _categoryLabel(catId) {
        const catInfo = this.APP_CATEGORIES[catId];
        const fallback = catInfo?.name || catId;
        return this._t(`categories.${catId}`, {}, fallback);
    },

    _isReducedMotion() {
        if (window.EphemeraMotion?.isReducedMotion) {
            return window.EphemeraMotion.isReducedMotion() === true;
        }
        if (typeof window.matchMedia === 'function') {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
        }
        return false;
    },

    _bootDelay(ms) {
        return this._isReducedMotion() ? 0 : ms;
    },

    _syncMotionSensitiveUI() {
        if (EphemeraState.shellMode !== 'desktop') return;
        this.setWallpaperForCurrentWorkspace(
            EphemeraState.workspaceWallpapers?.[EphemeraState.currentWorkspace] || EphemeraState.wallpaper || 'particles',
            {
                persist: false,
                syncSelection: false
            }
        );
    },

    _bindMotionEvents() {
        if (typeof this._motionUnsub === 'function') {
            this._motionUnsub();
            this._motionUnsub = null;
        }
        if (!window.EphemeraEvents?.on) return;
        this._motionUnsub = window.EphemeraEvents.on('motion:changed', () => {
            this._syncMotionSensitiveUI();
        });
    },

    _ensureWorkspaceState() {
        const count = this.WORKSPACE_COUNT;
        if (!Array.isArray(EphemeraState.workspaces)) {
            EphemeraState.workspaces = [];
        }
        while (EphemeraState.workspaces.length < count) {
            EphemeraState.workspaces.push([]);
        }
        EphemeraState.workspaces = EphemeraState.workspaces.slice(0, count).map((entry) => Array.isArray(entry) ? entry : []);

        if (!Array.isArray(EphemeraState.workspaceNames)) {
            EphemeraState.workspaceNames = [];
        }
        while (EphemeraState.workspaceNames.length < count) {
            EphemeraState.workspaceNames.push(`Workspace ${EphemeraState.workspaceNames.length + 1}`);
        }
        EphemeraState.workspaceNames = EphemeraState.workspaceNames.slice(0, count);

        if (!Array.isArray(EphemeraState.workspaceWallpapers)) {
            EphemeraState.workspaceWallpapers = [];
        }
        while (EphemeraState.workspaceWallpapers.length < count) {
            EphemeraState.workspaceWallpapers.push(EphemeraState.wallpaper || 'particles');
        }
        EphemeraState.workspaceWallpapers = EphemeraState.workspaceWallpapers.slice(0, count);

        if (!Array.isArray(EphemeraState.workspaceIconLayouts)) {
            EphemeraState.workspaceIconLayouts = [];
        }
        while (EphemeraState.workspaceIconLayouts.length < count) {
            EphemeraState.workspaceIconLayouts.push({ order: [], openCategory: null });
        }
        EphemeraState.workspaceIconLayouts = EphemeraState.workspaceIconLayouts
            .slice(0, count)
            .map((entry) => ({
                order: Array.isArray(entry?.order) ? entry.order.map((value) => String(value)) : [],
                openCategory: entry?.openCategory ? String(entry.openCategory) : null
            }));

        const requested = Number.parseInt(String(EphemeraState.currentWorkspace ?? 0), 10);
        EphemeraState.currentWorkspace = Number.isFinite(requested)
            ? Math.max(0, Math.min(count - 1, requested))
            : 0;

        const activeWallpaper = EphemeraState.workspaceWallpapers[EphemeraState.currentWorkspace] || EphemeraState.wallpaper || 'particles';
        EphemeraState.workspaceWallpapers[EphemeraState.currentWorkspace] = activeWallpaper;
        EphemeraState.wallpaper = activeWallpaper;
    },

    _workspaceLabel(index) {
        this._ensureWorkspaceState();
        const raw = String(EphemeraState.workspaceNames[index] || '').trim();
        return raw || this._t('desktop.workspace_label', { index: index + 1 }, `Workspace ${index + 1}`);
    },

    _mountWorkspaceIndicator() {
        const indicator = document.getElementById('workspace-indicator');
        const taskbar = document.getElementById('taskbar');
        const systemTray = document.getElementById('system-tray');
        if (!indicator || !taskbar || !systemTray) return;
        if (indicator.parentElement !== taskbar) {
            taskbar.insertBefore(indicator, systemTray);
        }
    },

    _bindWorkspaceEvents() {
        if (this._workspaceEventsBound || !window.EphemeraEvents?.on) return;
        this._workspaceEventsBound = true;
        const refreshIndicator = () => {
            if (EphemeraState.shellMode === 'desktop') {
                this.createWorkspaceIndicator();
            }
        };
        this._workspaceEventUnsubs = [
            EphemeraEvents.on('window:opened', refreshIndicator),
            EphemeraEvents.on('window:closed', refreshIndicator),
            EphemeraEvents.on('window:moved-workspace', refreshIndicator)
        ];
    },

    _unbindWorkspaceEvents() {
        this._workspaceEventUnsubs.forEach((unsubscribe) => {
            if (typeof unsubscribe === 'function') unsubscribe();
        });
        this._workspaceEventUnsubs = [];
        this._workspaceEventsBound = false;
    },

    _getWorkspaceIconLayout(index = EphemeraState.currentWorkspace) {
        this._ensureWorkspaceState();
        const safeIndex = Number.isFinite(Number(index))
            ? Math.max(0, Math.min(this.WORKSPACE_COUNT - 1, Number(index)))
            : 0;
        if (!EphemeraState.workspaceIconLayouts[safeIndex]) {
            EphemeraState.workspaceIconLayouts[safeIndex] = { order: [], openCategory: null };
        }
        return EphemeraState.workspaceIconLayouts[safeIndex];
    },

    _saveCurrentWorkspaceIconLayout(index = EphemeraState.currentWorkspace) {
        const container = document.getElementById('desktop-icons');
        if (!container) return;
        const layout = this._getWorkspaceIconLayout(index);
        layout.order = Array.from(container.querySelectorAll('.desktop-icon'))
            .map((icon) => String(icon.dataset.iconKey || '').trim())
            .filter(Boolean);
        const openFolder = container.querySelector('.desktop-folder.open');
        layout.openCategory = openFolder?.dataset?.category || null;
    },

    _applyWorkspaceIconLayout(index = EphemeraState.currentWorkspace) {
        const container = document.getElementById('desktop-icons');
        if (!container) return;
        const layout = this._getWorkspaceIconLayout(index);

        const orderedElements = [];
        const remaining = new Map();
        Array.from(container.children).forEach((child) => {
            const key = String(child.dataset.iconKey || '').trim();
            if (key) {
                remaining.set(key, child);
            }
        });

        layout.order.forEach((key) => {
            const match = remaining.get(String(key));
            if (match) {
                orderedElements.push(match);
                remaining.delete(String(key));
            }
        });
        orderedElements.push(...remaining.values());
        orderedElements.forEach((child) => container.appendChild(child));

        if (layout.openCategory) {
            const folderEl = container.querySelector(`.desktop-folder[data-category="${layout.openCategory}"]`);
            if (folderEl) {
                this.toggleDesktopFolder(layout.openCategory, folderEl, { persist: false });
            }
        }
    },

    _enableDesktopIconLayoutInteractions(container) {
        if (!container) return;
        const icons = Array.from(container.querySelectorAll('.desktop-icon'));
        icons.forEach((icon) => {
            icon.setAttribute('draggable', 'true');
            icon.addEventListener('dragstart', (e) => {
                this._draggedDesktopIcon = icon;
                icon.classList.add('dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/ephemera-desktop-icon', String(icon.dataset.iconKey || icon.dataset.appId || 'desktop-icon'));
                }
            });
            icon.addEventListener('dragover', (e) => {
                if (!this._draggedDesktopIcon || this._draggedDesktopIcon === icon) return;
                e.preventDefault();
                const rect = icon.getBoundingClientRect();
                const insertBefore = e.clientY < (rect.top + rect.height / 2);
                container.insertBefore(this._draggedDesktopIcon, insertBefore ? icon : icon.nextSibling);
            });
            icon.addEventListener('drop', (e) => {
                e.preventDefault();
                this._saveCurrentWorkspaceIconLayout();
                EphemeraState.save?.();
            });
            icon.addEventListener('dragend', () => {
                icon.classList.remove('dragging');
                this._draggedDesktopIcon = null;
                this._saveCurrentWorkspaceIconLayout();
                EphemeraState.save?.();
            });
        });
    },

    setWallpaperForCurrentWorkspace(type, options = {}) {
        const workspaceIndex = Number(EphemeraState.currentWorkspace || 0);
        setWallpaper(type, { ...options, workspaceIndex });
    },

    toggleWorkspaceOverview(force) {
        const isVisible = !!(this._workspaceOverviewEl && document.body.contains(this._workspaceOverviewEl));
        if (force === false) {
            this.hideWorkspaceOverview();
            return;
        }
        if (force === true || !isVisible) {
            this.showWorkspaceOverview();
            return;
        }
        this.hideWorkspaceOverview();
    },

    showWorkspaceOverview() {
        this._ensureWorkspaceState();
        this.hideWorkspaceOverview();

        const overlay = document.createElement('div');
        overlay.id = 'workspace-overview';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Workspace Overview');

        const cards = EphemeraState.workspaces.map((workspaceWindowIds, index) => {
            const label = this._workspaceLabel(index);
            const windowEntries = workspaceWindowIds
                .map((windowId) => EphemeraState.windows.find((win) => win.id === windowId))
                .filter(Boolean);
            const previews = windowEntries.length > 0
                ? windowEntries.slice(0, 4).map((win) => `
                    <div class="workspace-overview-window">
                        <span class="workspace-overview-window-icon">${win.app?.icon || '🪟'}</span>
                        <span class="workspace-overview-window-title">${EphemeraSanitize.escapeHtml(String(win.app?.name || win.appId || `Window ${win.id}`))}</span>
                    </div>
                `).join('')
                : `<div class="workspace-overview-empty">${this._t('desktop.workspace_empty', {}, 'No open windows')}</div>`;

            return `
                <button class="workspace-overview-card${index === EphemeraState.currentWorkspace ? ' active' : ''}" data-workspace="${index}" type="button">
                    <div class="workspace-overview-card-header">
                        <span class="workspace-overview-card-title">${EphemeraSanitize.escapeHtml(label)}</span>
                        <span class="workspace-overview-card-count">${windowEntries.length}</span>
                    </div>
                    <div class="workspace-overview-card-body">${previews}</div>
                </button>
            `;
        }).join('');

        overlay.innerHTML = `
            <div class="workspace-overview-shell">
                <div class="workspace-overview-title">${this._t('desktop.workspaces', {}, 'Workspaces')}</div>
                <div class="workspace-overview-grid">${cards}</div>
            </div>
        `;

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                this.hideWorkspaceOverview();
            }
        });

        overlay.querySelectorAll('.workspace-overview-card').forEach((cardEl) => {
            cardEl.addEventListener('click', () => {
                const targetWorkspace = Number.parseInt(String(cardEl.dataset.workspace || ''), 10);
                this.hideWorkspaceOverview();
                if (Number.isInteger(targetWorkspace)) {
                    this.switchWorkspace(targetWorkspace);
                }
            });
        });

        this._workspaceOverviewKeyHandler = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.hideWorkspaceOverview();
            }
        };
        document.addEventListener('keydown', this._workspaceOverviewKeyHandler);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));
        this._workspaceOverviewEl = overlay;
    },

    hideWorkspaceOverview() {
        if (this._workspaceOverviewKeyHandler) {
            document.removeEventListener('keydown', this._workspaceOverviewKeyHandler);
            this._workspaceOverviewKeyHandler = null;
        }
        if (this._workspaceOverviewEl) {
            this._workspaceOverviewEl.remove();
            this._workspaceOverviewEl = null;
        }
    },

    async start() {
        const progressBar = document.getElementById('boot-progress-bar');
        const bootScreen = document.getElementById('boot-screen');
        const bootText = document.querySelector('.boot-text');
        let completedSteps = 0;

        const preAuthSteps = [
            { name: this._t('boot.loading_profiles', {}, 'Loading profiles...'), fn: () => { if (typeof EphemeraLogin !== 'undefined') EphemeraLogin.init(); } },
            { name: this._t('boot.initializing_notifications', {}, 'Initializing notifications...'), fn: () => EphemeraNotifications.init() },
        ];

        const postAuthSteps = [
            {
                name: this._t('boot.checking_database_health', {}, 'Checking database health...'),
                fn: async () => {
                    const health = await EphemeraStorage.healthCheck();
                    if (!health.healthy) {
                        console.warn('[Boot] Database health check failed:', health.errors);

                        // Try recovery
                        if (health.canRecover) {
                            bootText.textContent = this._t('boot.recovering_database', {}, 'Recovering database...');

                            // Try to export data first
                            const recoveryData = await EphemeraStorage.exportRecoverableData();
                            const hasData = Object.values(recoveryData).some(arr => arr.length > 0);

                            if (hasData) {
                                // Store recovery data temporarily
                                sessionStorage.setItem('ephemera_recovery_data', JSON.stringify(recoveryData));
                            }

                            const result = await EphemeraStorage.recoverDatabase();
                            if (!result.success) {
                                throw new Error(`Database recovery failed: ${result.error}`);
                            }

                            console.info('[Boot] Database recovered successfully');
                        } else {
                            throw new Error(`Database corrupted: ${health.errors.join(', ')}`);
                        }
                    }
                },
                critical: true
            },
            {
                name: this._t('boot.initializing_secure_storage', {}, 'Initializing secure storage...'),
                fn: () => EphemeraStorage.init(EphemeraState?.user?.id || EphemeraSession?.getUser?.()?.id || 'default'),
                critical: true
            },
            { name: this._t('boot.loading_filesystem', {}, 'Loading file system...'), fn: () => EphemeraFS.init(EphemeraState?.user?.homeDir), critical: true },
            { name: this._t('boot.loading_installed_apps', {}, 'Loading installed apps...'), fn: () => EphemeraApps.loadInstalledApps() },
            {
                name: this._t('boot.initializing_cloud_sync', {}, 'Initializing cloud sync...'),
                fn: async () => {
                    if (typeof EphemeraSyncManager !== 'undefined') {
                        await EphemeraSyncManager.init();
                    }
                }
            }
        ];

        const totalSteps = preAuthSteps.length + postAuthSteps.length;
        const runStep = async (step) => {
            bootText.textContent = step.name;
            try {
                await step.fn();
            } catch (e) {
                console.error(`Boot step failed: ${step.name}`, e);
                if (step.critical) {
                    bootText.textContent = this._t('boot.error_prefix', {
                        step: step.name,
                        message: e.message
                    }, `Error: ${step.name} - ${e.message}`);
                    bootText.style.color = '#ff4d6a';
                    throw e;
                }
            }
            completedSteps++;
            progressBar.style.width = `${(completedSteps / totalSteps) * 100}%`;
            await new Promise(r => setTimeout(r, this._bootDelay(80)));
        };

        const showCriticalError = (title, message, details = '') => {
            const errorScreen = document.createElement('div');
            errorScreen.id = 'critical-error-screen';
            errorScreen.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: linear-gradient(135deg, #0a0a0f 0%, #1a1a25 100%);
                display: flex; flex-direction: column; align-items: center;
                justify-content: center; padding: 40px; text-align: center;
                font-family: 'Space Grotesk', -apple-system, sans-serif;
            `;
            errorScreen.innerHTML = `
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ff4d6a" stroke-width="1.5" style="margin-bottom:24px;">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h1 style="margin:0 0 12px;font-size:1.5rem;color:#e8e8f0;font-weight:600;">${title}</h1>
                <p style="margin:0 0 24px;max-width:400px;color:#8585a0;font-size:0.95rem;line-height:1.5;">${message}</p>
                ${details ? `<details style="max-width:500px;text-align:left;margin-bottom:24px;">
                    <summary style="color:#8585a0;cursor:pointer;font-size:0.85rem;">${this._t('errors.technical_details', {}, 'Technical details')}</summary>
                    <pre style="margin-top:12px;padding:12px;background:rgba(0,0,0,0.3);border-radius:8px;color:#ff4d6a;font-size:0.75rem;overflow-x:auto;white-space:pre-wrap;word-break:break-all;">${details}</pre>
                </details>` : ''}
                <button id="critical-error-retry-btn" type="button" style="padding:12px 32px;background:#00d4aa;border:none;border-radius:8px;color:#0a0a0f;font-size:0.95rem;font-weight:600;cursor:pointer;">
                    ${this._t('common.retry', {}, 'Retry')}
                </button>
            `;
            document.body.appendChild(errorScreen);
            errorScreen.querySelector('#critical-error-retry-btn')?.addEventListener('click', () => {
                window.location.reload();
            });
            bootScreen.classList.add('hidden');
        };

        try {
            for (const step of preAuthSteps) {
                await runStep(step);
            }
        } catch (e) {
            showCriticalError(
                this._t('boot.startup_failed_title', {}, 'Startup Failed'),
                this._t('boot.startup_failed_preauth', {}, 'A critical error occurred during startup. Please try again.'),
                e.message
            );
            return;
        }

        bootText.textContent = this._t('boot.sign_in_continue', {}, 'Sign in to continue...');
        progressBar.style.width = `${(completedSteps / totalSteps) * 100}%`;

        setTimeout(async () => {
            bootScreen.classList.add('hidden');
            
            if (typeof EphemeraLogin !== 'undefined') {
                const loggedIn = await EphemeraLogin.show();
                if (!loggedIn) {
                    console.info('[EphemeraBoot] Login cancelled, showing login screen only');
                    return;
                }
            }

            bootScreen.classList.remove('hidden');
            bootText.style.color = '';

            try {
                for (const step of postAuthSteps) {
                    await runStep(step);
                }
            } catch (e) {
                showCriticalError(
                    this._t('boot.startup_failed_title', {}, 'Startup Failed'),
                    this._t('boot.startup_failed_postauth', {}, 'A critical error occurred while loading your data. Please try again.'),
                    e.message
                );
                return;
            }

            bootText.textContent = this._t('boot.ready', {}, 'Ready!');
            progressBar.style.width = '100%';
            await new Promise(r => setTimeout(r, this._bootDelay(250)));
            bootScreen.classList.add('hidden');
            
            EphemeraState.bootComplete = true;
            if (this.isMobileViewport()) {
                this.initMobileShell();
            } else {
                this.initDesktop();
            }
        }, this._bootDelay(400));
    },

    isMobileViewport() {
        return window.innerWidth < this.MOBILE_VIEWPORT_WIDTH;
    },

    applySharedRuntime() {
        if (typeof EphemeraI18n !== 'undefined') EphemeraI18n.init();
        if (typeof EphemeraAIAssistant !== 'undefined') EphemeraAIAssistant.init();
        if (typeof EphemeraCommandPalette !== 'undefined') EphemeraCommandPalette.init();
        if (typeof EphemeraShortcuts !== 'undefined') EphemeraShortcuts.init();
        if (typeof EphemeraFileAssoc !== 'undefined') EphemeraFileAssoc.init();
        if (typeof EphemeraSounds !== 'undefined') EphemeraSounds.init();
        if (typeof EphemeraWidgets !== 'undefined') EphemeraWidgets.init();
        if (typeof EphemeraSessionRecovery !== 'undefined') EphemeraSessionRecovery.init();
        if (typeof EphemeraSystemTray !== 'undefined') EphemeraSystemTray.init();

        // Migrate plaintext API keys to encrypted
        if (typeof EphemeraAI !== 'undefined') EphemeraAI.migrateKeyIfNeeded();

        // Apply saved theme
        if (EphemeraState.settings.theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        }
        if (EphemeraState.settings.accentColor) {
            document.documentElement.style.setProperty('--accent', EphemeraState.settings.accentColor);
        }

        if (window.EphemeraI18n?.translateDom) {
            window.EphemeraI18n.translateDom(document);
        }

        if (!this._i18nUnsub && window.EphemeraEvents?.on) {
            this._i18nUnsub = window.EphemeraEvents.on('i18n:changed', () => {
                if (window.EphemeraI18n?.translateDom) {
                    window.EphemeraI18n.translateDom(document);
                }
                this.updateTextContextMenuLabels();

                if (EphemeraState.shellMode === 'desktop') {
                    this.createDesktopIcons();
                    this.updateStartMenu();
                    this.createWorkspaceIndicator();
                }

                this.updateClock();
            });
        }
    },

    initMobileShell() {
        EphemeraState.shellMode = 'mobile';
        document.body.classList.add('mobile-shell-mode');
        document.body.classList.remove('app-active');
        document.body.dataset.shellMode = 'mobile';
        stopAllAnimations();
        if (typeof this._motionUnsub === 'function') {
            this._motionUnsub();
            this._motionUnsub = null;
        }

        if (typeof EphemeraMobileShell !== 'undefined') {
            EphemeraMobileShell.init();
        } else {
            console.warn('[EphemeraBoot] Mobile shell requested but EphemeraMobileShell is unavailable');
        }

        this.applySharedRuntime();
        EphemeraEvents.emit('shell:ready', { mode: 'mobile' });
        // Keep this event for compatibility with existing "system ready" listeners.
        EphemeraEvents.emit('desktop:ready');
    },

    initDesktop() {
        this._ensureWorkspaceState();
        EphemeraState.shellMode = 'desktop';
        document.body.classList.remove('mobile-shell-mode');
        document.body.classList.remove('app-active');
        document.body.dataset.shellMode = 'desktop';

        this.createTextContextMenu();
        
        document.addEventListener('contextmenu', (e) => {
            const target = e.target;
            const isEditable = target.tagName === 'INPUT' || 
                              target.tagName === 'TEXTAREA' || 
                              target.isContentEditable;
            
            if (isEditable) {
                e.preventDefault();
                this.showTextContextMenu(e, target);
            } else {
                e.preventDefault();
            }
        }, true);

        this._mountWorkspaceIndicator();
        this.createDesktopIcons();
        this.createStartMenu();
        this.createWorkspaceIndicator();
        this._bindWorkspaceEvents();
        this._bindMotionEvents();
        this.setWallpaperForCurrentWorkspace(EphemeraState.workspaceWallpapers[EphemeraState.currentWorkspace] || EphemeraState.wallpaper, {
            persist: false,
            syncSelection: true
        });
        this.updateClock();
        this._clockInterval = setInterval(() => this.updateClock(), 1000);
        this.initWallpaper();
        this.setupEventListeners();
        this.initSearch();
        if (typeof EphemeraGestures !== 'undefined') EphemeraGestures.init();

        this.applySharedRuntime();

        EphemeraEvents.emit('shell:ready', { mode: 'desktop' });
        EphemeraEvents.emit('desktop:ready');
    },

    destroy() {
        if (this._clockInterval) clearInterval(this._clockInterval);
        stopAllAnimations();
        if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
        if (this._mousemoveHandler) document.removeEventListener('mousemove', this._mousemoveHandler);
        this._resizeHandler = null;
        this._mousemoveHandler = null;
        this._wallpaperInitialized = false;
        this._particlesAnimator = null;
        this.particles = [];
        this.hideWorkspaceOverview();
        this._unbindWorkspaceEvents();
        if (this._workspaceHotkeyHandler) {
            document.removeEventListener('keydown', this._workspaceHotkeyHandler);
            this._workspaceHotkeyHandler = null;
        }
        if (this._textContextMenu) {
            this._textContextMenu.remove();
        }
        if (typeof EphemeraMobileShell !== 'undefined' && typeof EphemeraMobileShell.destroy === 'function') {
            EphemeraMobileShell.destroy();
        }
        if (typeof EphemeraGestures !== 'undefined' && typeof EphemeraGestures.destroy === 'function') {
            EphemeraGestures.destroy();
        }
        if (typeof this._i18nUnsub === 'function') {
            this._i18nUnsub();
            this._i18nUnsub = null;
        }
        if (typeof this._motionUnsub === 'function') {
            this._motionUnsub();
            this._motionUnsub = null;
        }
        if (typeof this._wallpaperSettingUnsub === 'function') {
            this._wallpaperSettingUnsub();
            this._wallpaperSettingUnsub = null;
        }
    },

    createTextContextMenu() {
        this._textContextMenu = document.createElement('div');
        this._textContextMenu.id = 'text-context-menu';
        this._textContextMenu.style.cssText = `
            position: fixed;
            background: rgba(20, 20, 25, 0.95);
            backdrop-filter: blur(12px);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 4px 0;
            min-width: 160px;
            display: none;
            z-index: 10000;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        `;
        
        const createMenuItem = (label, action, icon, enabled = true) => {
            const item = document.createElement('div');
            item.className = 'text-menu-item';
            item.style.cssText = `
                padding: 8px 12px;
                cursor: ${enabled ? 'pointer' : 'default'};
                font-size: 0.8rem;
                color: ${enabled ? 'var(--fg-primary)' : 'var(--fg-muted)'};
                display: flex;
                align-items: center;
                gap: 10px;
                opacity: ${enabled ? '1' : '0.5'};
            `;
            item.innerHTML = `<span style="width:16px;text-align:center;">${icon}</span><span>${label}</span>`;
            item.dataset.action = action;
            if (enabled) {
                item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-tertiary)');
                item.addEventListener('mouseleave', () => item.style.background = 'transparent');
            }
            return item;
        };
        
        this._textContextMenu.appendChild(createMenuItem(this._t('desktop.text_actions.cut', {}, 'Cut'), 'cut', '\u2702\uFE0F'));
        this._textContextMenu.appendChild(createMenuItem(this._t('desktop.text_actions.copy', {}, 'Copy'), 'copy', '\uD83D\uDCCB'));
        this._textContextMenu.appendChild(createMenuItem(this._t('desktop.text_actions.paste', {}, 'Paste'), 'paste', '\uD83D\uDCCE'));
        this._textContextMenu.appendChild(createMenuItem(this._t('desktop.text_actions.select_all', {}, 'Select All'), 'selectall', '\u2611\uFE0F'));
        
        document.body.appendChild(this._textContextMenu);
        
        document.addEventListener('click', (e) => {
            if (!this._textContextMenu.contains(e.target)) {
                this._textContextMenu.style.display = 'none';
            }
        });
    },

    updateTextContextMenuLabels() {
        if (!this._textContextMenu) return;
        const labels = {
            cut: this._t('desktop.text_actions.cut', {}, 'Cut'),
            copy: this._t('desktop.text_actions.copy', {}, 'Copy'),
            paste: this._t('desktop.text_actions.paste', {}, 'Paste'),
            selectall: this._t('desktop.text_actions.select_all', {}, 'Select All')
        };
        this._textContextMenu.querySelectorAll('.text-menu-item').forEach((item) => {
            const action = item.dataset.action;
            const textEl = item.querySelector('span:last-child');
            if (!textEl || !action || !labels[action]) return;
            textEl.textContent = labels[action];
        });
    },

    showTextContextMenu(e, target) {
        const menu = this._textContextMenu;
        const hasSelection = target.selectionStart !== target.selectionEnd && 
                            target.selectionStart !== undefined;
        const isEditable = !target.disabled && !target.readOnly;
        
        menu.querySelectorAll('.text-menu-item').forEach(item => {
            const action = item.dataset.action;
            const enabled = {
                'cut': hasSelection && isEditable,
                'copy': hasSelection,
                'paste': isEditable,
                'selectall': target.value && target.value.length > 0
            }[action] ?? false;
            
            item.style.opacity = enabled ? '1' : '0.5';
            item.style.cursor = enabled ? 'pointer' : 'default';
            item.style.color = enabled ? 'var(--fg-primary)' : 'var(--fg-muted)';
            
            item.onclick = enabled ? () => {
                this.executeTextAction(action, target);
                menu.style.display = 'none';
            } : null;
            
            item.onmouseenter = enabled ? () => item.style.background = 'var(--bg-tertiary)' : null;
            item.onmouseleave = enabled ? () => item.style.background = 'transparent' : null;
        });
        
        let x = e.clientX;
        let y = e.clientY;
        
        menu.style.display = 'block';
        menu.style.left = '0px';
        menu.style.top = '0px';
        
        const rect = menu.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 10;
        if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 10;
        
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    },

    async executeTextAction(action, target) {
        switch (action) {
            case 'cut':
                if (target.selectionStart !== undefined) {
                    const selected = target.value.substring(target.selectionStart, target.selectionEnd);
                    if (window.EphemeraClipboard) await EphemeraClipboard.copy(selected);
                    else await navigator.clipboard.writeText(selected);
                    target.setRangeText('');
                    target.dispatchEvent(new Event('input', { bubbles: true }));
                }
                break;
            case 'copy':
                if (target.selectionStart !== undefined) {
                    const selected = target.value.substring(target.selectionStart, target.selectionEnd);
                    if (window.EphemeraClipboard) await EphemeraClipboard.copy(selected);
                    else await navigator.clipboard.writeText(selected);
                }
                break;
            case 'paste':
                try {
                    const text = window.EphemeraClipboard ? await EphemeraClipboard.paste() : await navigator.clipboard.readText();
                    if (target.selectionStart !== undefined) {
                        target.setRangeText(text);
                        const newPos = target.selectionStart + text.length;
                        target.setSelectionRange(newPos, newPos);
                        target.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } catch (err) {
                    console.warn('Paste failed:', err);
                }
                break;
            case 'selectall':
                if (target.select) {
                    target.select();
                } else if (target.setSelectionRange) {
                    target.setSelectionRange(0, target.value.length);
                }
                break;
        }
        target.focus();
    },

    createDesktopIcons() {
        this._ensureWorkspaceState();
        const container = document.getElementById('desktop-icons');
        container.innerHTML = '';
        const apps = EphemeraApps.getAll().filter(app => app.category !== 'hidden');

        const isUserApp = a => a.isUserApp === true || a.category === 'user' || a.id.startsWith('com.user.');
        const userApps = apps.filter(a => isUserApp(a));
        const systemApps = apps.filter(a => !isUserApp(a));

        const categorized = {};
        systemApps.forEach(app => {
            const cat = app.category || 'utility';
            const catKey = (cat === 'game') ? 'games' : cat;
            if (!categorized[catKey]) categorized[catKey] = [];
            categorized[catKey].push(app);
        });

        Object.entries(categorized)
            .sort((a, b) => (this.APP_CATEGORIES[a[0]]?.order || 99) - (this.APP_CATEGORIES[b[0]]?.order || 99))
            .forEach(([catId, catApps]) => {
                const catInfo = this.APP_CATEGORIES[catId] || { name: catId, icon: '\uD83D\uDCC1', order: 99 };
                const catName = this._categoryLabel(catId);

                const folder = document.createElement('div');
                folder.className = 'desktop-icon desktop-folder';
                folder.dataset.category = catId;
                folder.dataset.iconKey = `folder:${catId}`;
                folder.setAttribute('tabindex', '0');
                folder.setAttribute('role', 'button');
                folder.setAttribute('aria-label', this._t('desktop.folder_label', { name: catName }, `${catName} folder`));
                folder.setAttribute('aria-expanded', 'false');
                folder.innerHTML = `
                    <div class="icon-svg folder-icon" aria-hidden="true">${catInfo.icon}</div>
                    <span class="icon-label">${catName}</span>
                `;
                folder.addEventListener('click', () => this.toggleDesktopFolder(catId, folder));
                folder.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.toggleDesktopFolder(catId, folder);
                    }
                });
                container.appendChild(folder);

                catApps.sort((a, b) => a.name.localeCompare(b.name)).forEach(app => {
                    const icon = document.createElement('div');
                    icon.className = 'desktop-icon desktop-app hidden';
                    icon.dataset.appId = app.id;
                    icon.dataset.category = catId;
                    icon.dataset.iconKey = `catapp:${catId}:${app.id}`;
                    icon.setAttribute('tabindex', '0');
                    icon.setAttribute('role', 'button');
                    icon.setAttribute('aria-label', this._t('desktop.open_app', { name: app.name }, `Open ${app.name}`));
                    icon.innerHTML = `
                        <div class="icon-svg" aria-hidden="true">${app.icon}</div>
                        <span class="icon-label">${EphemeraSanitize.escapeHtml(app.name)}</span>
                    `;
                    icon.addEventListener('dblclick', () => EphemeraWM.open(app.id));
                    icon.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            EphemeraWM.open(app.id);
                        }
                    });
                    container.appendChild(icon);
                });
            });

        userApps.forEach(app => {
            const icon = document.createElement('div');
            icon.className = 'desktop-icon desktop-app';
            icon.dataset.appId = app.id;
            icon.dataset.iconKey = `app:${app.id}`;
            icon.setAttribute('tabindex', '0');
            icon.setAttribute('role', 'button');
            icon.setAttribute('aria-label', this._t('desktop.open_app', { name: app.name }, `Open ${app.name}`));
            icon.innerHTML = `
                <div class="icon-svg" aria-hidden="true">${app.icon}</div>
                <span class="icon-label">${EphemeraSanitize.escapeHtml(app.name)}</span>
            `;
            icon.addEventListener('dblclick', () => EphemeraWM.open(app.id));
            icon.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    EphemeraWM.open(app.id);
                }
            });
            container.appendChild(icon);
        });

        this._applyWorkspaceIconLayout(EphemeraState.currentWorkspace);
        this._enableDesktopIconLayoutInteractions(container);
    },

    toggleDesktopFolder(catId, folderEl, options = {}) {
        const wasOpen = folderEl.classList.contains('open');
        document.querySelectorAll('.desktop-folder').forEach(f => {
            f.classList.remove('open');
            f.setAttribute('aria-expanded', 'false');
        });
        document.querySelectorAll('.desktop-app').forEach(a => a.classList.add('hidden'));

        if (!wasOpen) {
            folderEl.classList.add('open');
            folderEl.setAttribute('aria-expanded', 'true');
            document.querySelectorAll(`.desktop-app[data-category="${catId}"]`).forEach(a => a.classList.remove('hidden'));
        }

        if (options.persist !== false) {
            this._saveCurrentWorkspaceIconLayout();
            EphemeraState.save?.();
        }
    },

    createStartMenu() {
        this.updateStartMenu();

        this._unsubInstalled = EphemeraEvents.on('app:installed', () => this.updateStartMenu());
        this._unsubUninstalled = EphemeraEvents.on('app:uninstalled', () => this.updateStartMenu());
    },

    updateStartMenu() {
        const container = document.getElementById('start-menu-apps');
        const apps = EphemeraApps.getAll().filter(app => app.category !== 'hidden');

        const isUserApp = a => a.isUserApp === true || a.category === 'user' || a.id.startsWith('com.user.');
        const userApps = apps.filter(a => isUserApp(a));
        const systemApps = apps.filter(a => !isUserApp(a));
        
        const currentUser = EphemeraState?.user?.name || 'User';
        const currentAvatar = EphemeraState?.user?.avatar;
        const avatarHTML = window.EphemeraLogin ? window.EphemeraLogin.getAvatarHTML(currentAvatar, 40) : '<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#00d4aa,#00a8ff);"></div>';

        let html = `<div class="start-menu-user" style="display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:12px;">
            ${avatarHTML}
            <div style="flex:1;">
                <div style="font-weight:600;font-size:0.95rem;">${EphemeraSanitize.escapeHtml(currentUser)}</div>
            </div>
            <button id="logout-btn" style="background:rgba(255,255,255,0.05);border:none;border-radius:8px;padding:8px 12px;color:#9898a8;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                ${this._t('common.logout', {}, 'Log Out')}
            </button>
        </div>`;

        if (userApps.length > 0) {
            html += `<div class="start-menu-section">
                <div class="start-menu-section-title collapsible" data-section="user">
                    <span>${this.APP_CATEGORIES.user.icon} ${this._categoryLabel('user')}</span>
                    <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div class="start-menu-grid collapsible-content" data-section="user">
                    ${userApps.map(app => `
                        <div class="start-menu-app user-app" data-app-id="${EphemeraSanitize.escapeAttr(app.id)}">
                            ${app.icon}
                            <span>${EphemeraSanitize.escapeHtml(app.name)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }

        const categorized = {};
        systemApps.forEach(app => {
            const cat = app.category || 'utility';
            const catKey = (cat === 'game') ? 'games' : cat;
            if (!categorized[catKey]) categorized[catKey] = [];
            categorized[catKey].push(app);
        });

        Object.entries(categorized)
            .sort((a, b) => (this.APP_CATEGORIES[a[0]]?.order || 99) - (this.APP_CATEGORIES[b[0]]?.order || 99))
            .forEach(([catId, catApps]) => {
                const catInfo = this.APP_CATEGORIES[catId] || { name: catId, icon: '\uD83D\uDCC1', order: 99 };
                const catName = this._categoryLabel(catId);
                html += `<div class="start-menu-section">
                    <div class="start-menu-section-title collapsible" data-section="${catId}">
                        <span>${catInfo.icon} ${catName}</span>
                        <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                    <div class="start-menu-grid collapsible-content" data-section="${catId}">
                        ${catApps.sort((a, b) => a.name.localeCompare(b.name)).map(app => `
                            <div class="start-menu-app" data-app-id="${EphemeraSanitize.escapeAttr(app.id)}">
                                ${app.icon}
                                <span>${EphemeraSanitize.escapeHtml(app.name)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            });

        container.innerHTML = html;

        container.querySelectorAll('.start-menu-section-title.collapsible').forEach(title => {
            title.addEventListener('click', (e) => {
                if (e.target.closest('.start-menu-app')) return;
                const section = title.dataset.section;
                const content = container.querySelector(`.collapsible-content[data-section="${section}"]`);
                title.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
            });
        });

        container.querySelectorAll('.start-menu-app').forEach(appEl => {
            appEl.setAttribute('tabindex', '0');
            appEl.setAttribute('role', 'menuitem');
            appEl.addEventListener('click', () => {
                EphemeraWM.open(appEl.dataset.appId);
                toggleStartMenu(false);
                document.getElementById('start-btn').setAttribute('aria-expanded', 'false');
            });
            appEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    EphemeraWM.open(appEl.dataset.appId);
                    toggleStartMenu(false);
                    document.getElementById('start-btn').setAttribute('aria-expanded', 'false');
                }
            });
        });
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                toggleStartMenu(false);
                if (window.EphemeraSession) {
                    EphemeraSession.logout();
                } else {
                    location.reload();
                }
            });
        }
    },

    createWorkspaceIndicator() {
        this._ensureWorkspaceState();
        this._mountWorkspaceIndicator();
        const container = document.getElementById('workspace-indicator');
        if (!container) return;
        container.classList.add('taskbar-workspace-indicator');
        container.setAttribute('role', 'tablist');
        container.innerHTML = '';
        for (let i = 0; i < this.WORKSPACE_COUNT; i++) {
            const isActive = i === EphemeraState.currentWorkspace;
            const count = Array.isArray(EphemeraState.workspaces[i]) ? EphemeraState.workspaces[i].length : 0;
            const label = this._workspaceLabel(i);
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'workspace-dot' + (isActive ? ' active' : '');
            dot.dataset.workspace = i;
            dot.setAttribute('role', 'tab');
            dot.setAttribute('tabindex', isActive ? '0' : '-1');
            dot.setAttribute('aria-label', `${label} (${count})`);
            dot.setAttribute('aria-selected', String(isActive));
            dot.innerHTML = `
                <span class="workspace-dot-name">${EphemeraSanitize.escapeHtml(label)}</span>
                <span class="workspace-dot-count">${count}</span>
            `;
            dot.addEventListener('click', () => this.switchWorkspace(i));
            dot.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.switchWorkspace(i);
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = (i + 1) % this.WORKSPACE_COUNT;
                    container.children[next].focus();
                    this.switchWorkspace(next);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = (i + this.WORKSPACE_COUNT - 1) % this.WORKSPACE_COUNT;
                    container.children[prev].focus();
                    this.switchWorkspace(prev);
                }
            });
            dot.addEventListener('dragover', (e) => {
                const hasPayload = !!e.dataTransfer?.types?.includes?.('text/ephemera-window-id');
                if (!hasPayload) return;
                e.preventDefault();
                dot.classList.add('drop-target');
            });
            dot.addEventListener('dragleave', () => {
                dot.classList.remove('drop-target');
            });
            dot.addEventListener('drop', (e) => {
                e.preventDefault();
                dot.classList.remove('drop-target');
                const rawWindowId = e.dataTransfer?.getData('text/ephemera-window-id');
                const windowId = Number.parseInt(String(rawWindowId || ''), 10);
                if (!Number.isInteger(windowId)) return;
                if (window.EphemeraWM?.moveToWorkspace) {
                    EphemeraWM.moveToWorkspace(windowId, i);
                    this.createWorkspaceIndicator();
                }
            });
            container.appendChild(dot);
        }
    },

    switchWorkspace(index) {
        this._ensureWorkspaceState();
        const nextIndex = Number.parseInt(String(index), 10);
        if (!Number.isInteger(nextIndex)) return;
        if (nextIndex < 0 || nextIndex >= this.WORKSPACE_COUNT) return;

        const previousWorkspace = Number(EphemeraState.currentWorkspace || 0);
        if (nextIndex === previousWorkspace) return;
        this.hideWorkspaceOverview();

        this._saveCurrentWorkspaceIconLayout(previousWorkspace);

        EphemeraState.workspaces[previousWorkspace].forEach(winId => {
            const win = document.getElementById(`window-${winId}`);
            if (win) win.style.display = 'none';
        });

        EphemeraState.currentWorkspace = nextIndex;

        EphemeraState.workspaces[nextIndex].forEach(winId => {
            const win = document.getElementById(`window-${winId}`);
            if (win) win.style.display = 'flex';
        });

        const targetWindowIds = EphemeraState.workspaces[nextIndex] || [];
        const topWindowId = targetWindowIds[targetWindowIds.length - 1];
        if (Number.isInteger(Number(topWindowId))) {
            EphemeraState.activeWindowId = Number(topWindowId);
        } else {
            EphemeraState.activeWindowId = null;
        }

        this.createDesktopIcons();
        this.setWallpaperForCurrentWorkspace(EphemeraState.workspaceWallpapers[nextIndex] || EphemeraState.wallpaper || 'particles', {
            persist: false,
            syncSelection: true
        });

        document.querySelectorAll('#workspace-indicator .workspace-dot').forEach((dot, i) => {
            const isActive = i === nextIndex;
            dot.classList.toggle('active', isActive);
            dot.setAttribute('aria-selected', String(isActive));
            dot.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        EphemeraState.save?.();
        EphemeraEvents.emit('workspace:changed', {
            workspace: nextIndex,
            previousWorkspace
        });
    },

    updateClock() {
        const now = new Date();
        const locale = window.EphemeraI18n?.getLocale?.() || 'en-US';
        const time = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        const date = now.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
        document.getElementById('clock').textContent = `${time} | ${date}`;
    },

    initWallpaper() {
        const canvas = document.getElementById('wallpaper-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (this._wallpaperInitialized) {
            this._resizeHandler?.();
            const runtimeType = resolveWallpaperRenderType(EphemeraState.wallpaper, this._isReducedMotion());
            if (runtimeType === 'particles' && !this.animationId && typeof this._particlesAnimator === 'function') {
                this.animationId = requestAnimationFrame(this._particlesAnimator);
            }
            return;
        }

        this._wallpaperInitialized = true;
        this.particles = [];

        this._resizeHandler = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        this._resizeHandler();
        window.addEventListener('resize', this._resizeHandler);

        for (let i = 0; i < 80; i++) {
            this.particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1,
                alpha: Math.random() * 0.5 + 0.2
            });
        }

        let mouseX = canvas.width / 2;
        let mouseY = canvas.height / 2;

        this._mousemoveHandler = (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        };
        document.addEventListener('mousemove', this._mousemoveHandler);

        // Spatial grid for O(n) neighbor lookup
        const GRID_SIZE = 120;

        const animate = () => {
            const runtimeType = resolveWallpaperRenderType(EphemeraState.wallpaper, this._isReducedMotion());
            if (runtimeType !== 'particles') {
                if (this._particlesActive) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    this._particlesActive = false;
                }
                // Stop the loop entirely when not using particles
                this.animationId = null;
                return;
            }

            this._particlesActive = true;

            const gradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, canvas.width * 0.8);
            gradient.addColorStop(0, '#1a2a3a');
            gradient.addColorStop(0.5, '#0f1a2a');
            gradient.addColorStop(1, '#0a0f1a');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Build spatial grid
            const gridCols = Math.ceil(canvas.width / GRID_SIZE);
            const gridRows = Math.ceil(canvas.height / GRID_SIZE);
            const grid = new Array(gridCols * gridRows);
            for (let i = 0; i < grid.length; i++) grid[i] = [];

            this.particles.forEach((p, i) => {
                const dxm = mouseX - p.x;
                const dym = mouseY - p.y;
                const distSq = dxm * dxm + dym * dym;

                if (distSq < 40000) { // 200^2
                    const dist = Math.sqrt(distSq);
                    const force = (200 - dist) / 200 * 0.02;
                    p.vx += dxm * force * 0.01;
                    p.vy += dym * force * 0.01;
                }

                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

                p.x = Math.max(0, Math.min(canvas.width, p.x));
                p.y = Math.max(0, Math.min(canvas.height, p.y));

                const safeRadius = Math.max(0.5, p.radius);
                const glowGradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, safeRadius * 3);
                glowGradient.addColorStop(0, `rgba(0, 212, 170, ${p.alpha})`);
                glowGradient.addColorStop(1, 'rgba(0, 212, 170, 0)');

                ctx.beginPath();
                ctx.arc(p.x, p.y, safeRadius * 3, 0, Math.PI * 2);
                ctx.fillStyle = glowGradient;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(p.x, p.y, safeRadius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 240, 200, ${p.alpha + 0.3})`;
                ctx.fill();

                // Add to grid
                const gx = Math.min(gridCols - 1, Math.max(0, Math.floor(p.x / GRID_SIZE)));
                const gy = Math.min(gridRows - 1, Math.max(0, Math.floor(p.y / GRID_SIZE)));
                grid[gy * gridCols + gx].push(i);
            });

            // Draw connections using spatial grid
            ctx.lineWidth = 0.5;
            this.particles.forEach((p, i) => {
                const gx = Math.min(gridCols - 1, Math.max(0, Math.floor(p.x / GRID_SIZE)));
                const gy = Math.min(gridRows - 1, Math.max(0, Math.floor(p.y / GRID_SIZE)));

                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = gx + dx, ny = gy + dy;
                        if (nx < 0 || nx >= gridCols || ny < 0 || ny >= gridRows) continue;
                        const cell = grid[ny * gridCols + nx];
                        for (const j of cell) {
                            if (j <= i) continue;
                            const p2 = this.particles[j];
                            const ddx = p.x - p2.x;
                            const ddy = p.y - p2.y;
                            const dSq = ddx * ddx + ddy * ddy;
                            if (dSq < 14400) { // 120^2
                                const d = Math.sqrt(dSq);
                                ctx.beginPath();
                                ctx.moveTo(p.x, p.y);
                                ctx.lineTo(p2.x, p2.y);
                                ctx.strokeStyle = `rgba(0, 212, 170, ${0.15 * (1 - d / 120)})`;
                                ctx.stroke();
                            }
                        }
                    }
                }
            });

            this.animationId = requestAnimationFrame(animate);
        };
        this._particlesAnimator = animate;

        // Start or stop particles based on current wallpaper
        if (!this._wallpaperSettingUnsub && window.EphemeraEvents?.on) {
            this._wallpaperSettingUnsub = EphemeraEvents.on('setting:changed', ({ key }) => {
                if (key !== 'wallpaper') return;
                const runtimeType = resolveWallpaperRenderType(EphemeraState.wallpaper, this._isReducedMotion());
                if (runtimeType === 'particles' && !this.animationId) {
                    this.animationId = requestAnimationFrame(animate);
                } else if (runtimeType !== 'particles' && this.animationId) {
                    cancelAnimationFrame(this.animationId);
                    this.animationId = null;
                }
            });
        }

        if (resolveWallpaperRenderType(EphemeraState.wallpaper, this._isReducedMotion()) === 'particles') {
            this.animationId = requestAnimationFrame(animate);
            return;
        }

        if (this._particlesActive) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this._particlesActive = false;
        } else {
            // Ensure stale canvas contents are cleared before a non-animated wallpaper.
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    },

    initSearch() {
        const overlay = document.getElementById('search-overlay');
        const input = document.getElementById('search-input');
        const results = document.getElementById('search-results');

        let selectedIndex = 0;
        let searchResults = [];

        async function performSearch(query) {
            query = query.toLowerCase().trim();
            if (!query) {
                results.innerHTML = '<div class="search-result" style="color:var(--fg-muted);padding:20px;text-align:center;">Start typing to search...</div>';
                return;
            }

            searchResults = [];

            const apps = EphemeraApps.getAll().filter(app =>
                app.name.toLowerCase().includes(query) ||
                app.id.toLowerCase().includes(query)
            );

            apps.forEach(app => {
                searchResults.push({
                    type: 'app',
                    title: app.name,
                    subtitle: 'Application',
                    icon: app.icon,
                    action: () => { EphemeraWM.open(app.id); closeSearch(); }
                });
            });

            try {
                const files = await EphemeraFS.search(query);
                files.slice(0, 10).forEach(file => {
                    searchResults.push({
                        type: 'file',
                        title: file.name,
                        subtitle: file.path,
                        icon: EphemeraFS.getIcon(file),
                        action: () => {
                            if (file.type === 'directory') {
                                EphemeraWM.open('files', { startPath: file.path });
                            } else if (typeof EphemeraFileAssoc !== 'undefined') {
                                EphemeraFileAssoc.openFile(file.path);
                            } else if (EphemeraFS.isTextFile(file.path)) {
                                EphemeraWM.open('notepad', { filePath: file.path });
                            }
                            closeSearch();
                        }
                    });
                });
            } catch (_e) {
                // Ignore launcher search errors and keep UI responsive.
            }

            selectedIndex = 0;
            renderResults();
        }

        const debouncedSearch = EphemeraSanitize.debounce(performSearch, 200);

        function renderResults() {
            if (searchResults.length === 0) {
                results.innerHTML = '<div class="search-result" style="color:var(--fg-muted);padding:20px;text-align:center;">No results found</div>';
                return;
            }

            results.innerHTML = searchResults.map((r, i) => `
                <div class="search-result ${i === selectedIndex ? 'selected' : ''}" data-index="${i}" role="option" aria-selected="${i === selectedIndex}">
                    <span aria-hidden="true">${r.icon}</span>
                    <div class="result-info">
                        <div class="result-title">${EphemeraSanitize.escapeHtml(r.title)}</div>
                        <div class="result-type">${EphemeraSanitize.escapeHtml(r.subtitle)}</div>
                    </div>
                </div>
            `).join('');

            results.querySelectorAll('.search-result').forEach(el => {
                el.addEventListener('click', () => {
                    const idx = parseInt(el.dataset.index);
                    searchResults[idx].action();
                });
            });
        }

        function openSearch() {
            overlay.classList.add('active');
            input.value = '';
            input.setAttribute('aria-expanded', 'true');
            input.focus();
            searchResults = [];
            results.innerHTML = '<div class="search-result" style="color:var(--fg-muted);padding:20px;text-align:center;">Start typing to search...</div>';
        }

        function closeSearch() {
            overlay.classList.remove('active');
            input.setAttribute('aria-expanded', 'false');
        }

        input.addEventListener('input', () => debouncedSearch(input.value));

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSearch();
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
                renderResults();
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                renderResults();
            }
            if (e.key === 'Enter' && searchResults[selectedIndex]) {
                searchResults[selectedIndex].action();
            }
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeSearch();
        });

        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.code === 'Space') {
                e.preventDefault();
                if (overlay.classList.contains('active')) {
                    closeSearch();
                } else {
                    openSearch();
                }
            }
        });
    },

    setupEventListeners() {
        const startBtn = document.getElementById('start-btn');
        const startMenu = document.getElementById('start-menu');

        startBtn.addEventListener('click', () => {
            const isOpen = startMenu.classList.contains('open');
            toggleStartMenu(!isOpen);
            startBtn.setAttribute('aria-expanded', String(!isOpen));
        });

        document.addEventListener('click', (e) => {
            if (!startMenu.contains(e.target) && !startBtn.contains(e.target)) {
                toggleStartMenu(false);
                startBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Escape closes start menu
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (startMenu.classList.contains('open')) {
                    toggleStartMenu(false);
                    startBtn.setAttribute('aria-expanded', 'false');
                    startBtn.focus();
                }
                // Close context menu on Escape
                const contextMenu = document.getElementById('context-menu');
                if (contextMenu.style.display === 'block') {
                    contextMenu.style.display = 'none';
                }
            }
        });

        document.getElementById('desktop').addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const contextMenu = document.getElementById('context-menu');
            contextMenu.style.left = e.clientX + 'px';
            contextMenu.style.top = e.clientY + 'px';
            contextMenu.style.display = 'block';
            // Focus first item for keyboard navigation
            const firstItem = contextMenu.querySelector('.context-item');
            if (firstItem) firstItem.focus();
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#context-menu')) {
                document.getElementById('context-menu').style.display = 'none';
            }
        });

        // Context menu: keyboard navigation with arrow keys and Enter
        const contextMenu = document.getElementById('context-menu');
        contextMenu.addEventListener('keydown', (e) => {
            const items = Array.from(contextMenu.querySelectorAll('.context-item'));
            const currentIdx = items.indexOf(document.activeElement);

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = currentIdx < items.length - 1 ? currentIdx + 1 : 0;
                items[next].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = currentIdx > 0 ? currentIdx - 1 : items.length - 1;
                items[prev].focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (currentIdx >= 0) items[currentIdx].click();
            } else if (e.key === 'Escape') {
                contextMenu.style.display = 'none';
            }
        });

        document.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                if (action === 'settings') EphemeraWM.open('settings');
                if (action === 'terminal') EphemeraWM.open('terminal');
                if (action === 'appmanager') EphemeraWM.open('appmanager');
                if (action === 'refresh') location.reload();
                document.getElementById('context-menu').style.display = 'none';
            });
        });

        this.initDesktopDragDrop();

        if (this._workspaceHotkeyHandler) {
            document.removeEventListener('keydown', this._workspaceHotkeyHandler);
        }
        this._workspaceHotkeyHandler = (e) => {
            if (!e.altKey || e.ctrlKey || e.metaKey) return;
            if (e.key < '1' || e.key > '4') return;
            const targetWorkspace = Number.parseInt(e.key, 10) - 1;
            e.preventDefault();
            if (e.shiftKey) {
                const activeWindowId = Number(EphemeraState.activeWindowId);
                if (Number.isInteger(activeWindowId) && window.EphemeraWM?.moveToWorkspace) {
                    EphemeraWM.moveToWorkspace(activeWindowId, targetWorkspace, { switchTo: true });
                }
                return;
            }
            this.switchWorkspace(targetWorkspace);
        };
        document.addEventListener('keydown', this._workspaceHotkeyHandler);
    },

    initDesktopDragDrop() {
        const desktop = document.getElementById('desktop');
        let dragOverlay = null;

        const createOverlay = () => {
            if (dragOverlay) return;
            dragOverlay = document.createElement('div');
            dragOverlay.id = 'desktop-drop-overlay';
            dragOverlay.style.cssText = `
                position: fixed;
                inset: 0;
                background: rgba(0, 212, 170, 0.15);
                border: 3px dashed var(--accent);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                pointer-events: none;
            `;
            dragOverlay.innerHTML = `
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div style="margin-top:16px;font-size:1.5rem;color:var(--accent);font-weight:500;">Drop files here to upload</div>
            `;
            document.body.appendChild(dragOverlay);
        };

        const removeOverlay = () => {
            if (dragOverlay) {
                dragOverlay.remove();
                dragOverlay = null;
            }
        };

        desktop.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes('Files')) {
                createOverlay();
            }
        });

        document.addEventListener('dragover', (e) => {
            if (dragOverlay) {
                e.preventDefault();
            }
        });

        document.addEventListener('dragleave', (e) => {
            if (dragOverlay && !e.relatedTarget) {
                removeOverlay();
            }
        });

        document.addEventListener('drop', async (e) => {
            if (!dragOverlay) return;
            e.preventDefault();
            removeOverlay();

            const items = e.dataTransfer.items;
            const files = [];

            if (items) {
                for (const item of items) {
                    if (item.kind === 'file') {
                        const file = item.getAsFile();
                        if (file) files.push(file);
                    }
                }
            } else if (e.dataTransfer.files) {
                files.push(...e.dataTransfer.files);
            }

            if (files.length > 0) {
                const uploadPath = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                let uploaded = 0;
                
                for (const file of files) {
                    try {
                        const content = await file.arrayBuffer();
                        await EphemeraFS.writeFile(`${uploadPath}/${file.name}`, content, { mimeType: file.type });
                        uploaded++;
                    } catch (err) {
                        console.error('Upload failed:', err);
                    }
                }
                
                if (uploaded > 0) {
                    EphemeraNotifications.success('Upload Complete', `${uploaded} file(s) uploaded to Home`);
                }
            }
        });
    }
};

function toggleStartMenu(open) {
    document.getElementById('start-menu').classList.toggle('open', open);
}

const REDUCED_MOTION_WALLPAPER_FALLBACKS = {
    particles: 'gradient4',
    matrix: 'solid',
    stars: 'solid',
    waves: 'gradient4'
};

function isReducedMotionEnabled() {
    if (window.EphemeraMotion?.isReducedMotion) {
        return window.EphemeraMotion.isReducedMotion() === true;
    }
    if (typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
    }
    return false;
}

function resolveWallpaperRenderType(type, reducedMotion = isReducedMotionEnabled()) {
    if (!reducedMotion) return type;
    return REDUCED_MOTION_WALLPAPER_FALLBACKS[type] || type;
}

function setWallpaper(type, options = {}) {
    const requestedWorkspace = Number.parseInt(String(options.workspaceIndex ?? EphemeraState.currentWorkspace ?? 0), 10);
    const workspaceCount = Array.isArray(EphemeraState.workspaces) && EphemeraState.workspaces.length > 0
        ? EphemeraState.workspaces.length
        : 4;
    const workspaceIndex = Number.isFinite(requestedWorkspace)
        ? Math.max(0, Math.min(workspaceCount - 1, requestedWorkspace))
        : 0;
    const shouldPersist = options.persist !== false;
    const syncSelection = options.syncSelection !== false;

    if (Array.isArray(EphemeraState.workspaceWallpapers)) {
        while (EphemeraState.workspaceWallpapers.length <= workspaceIndex) {
            EphemeraState.workspaceWallpapers.push(EphemeraState.wallpaper || 'particles');
        }
        EphemeraState.workspaceWallpapers[workspaceIndex] = type;
    }

    if (workspaceIndex === Number(EphemeraState.currentWorkspace || 0)) {
        EphemeraState.wallpaper = type;
    }
    if (shouldPersist) {
        EphemeraState.save?.();
    }

    const desktop = document.getElementById('desktop');
    const canvas = document.getElementById('wallpaper-canvas');
    if (!desktop) return;
    const renderType = resolveWallpaperRenderType(type);

    if (renderType === 'particles') {
        desktop.style.background = 'transparent';
        if (canvas) canvas.style.display = 'block';
        stopAllAnimations({ includeParticles: false });
        if (!EphemeraBoot.animationId) {
            EphemeraBoot.initWallpaper();
        }
    } else if (renderType === 'matrix') {
        desktop.style.background = '#000';
        if (canvas) {
            canvas.style.display = 'block';
            startMatrixRain(canvas);
        }
    } else if (renderType === 'stars') {
        desktop.style.background = '#000';
        if (canvas) {
            canvas.style.display = 'block';
            startStarfield(canvas);
        }
    } else if (renderType === 'waves') {
        desktop.style.background = '#0a0a1a';
        if (canvas) {
            canvas.style.display = 'block';
            startWaves(canvas);
        }
    } else if (renderType.startsWith('custom:')) {
        stopAllAnimations();
        const imageData = renderType.slice(7);
        desktop.style.background = `url(${imageData}) center/cover no-repeat`;
        if (canvas) canvas.style.display = 'none';
    } else {
        stopAllAnimations();
        const wallpapers = {
            solid: '#0a0a0f',
            gradient1: 'linear-gradient(135deg, #0f0f1a, #1a0a2e)',
            gradient2: 'linear-gradient(135deg, #0a1a1a, #0a2e1a)',
            gradient3: 'linear-gradient(135deg, #1a0a0a, #2e1a0a)',
            gradient4: 'linear-gradient(135deg, #0a0a1a, #1a2e3e)',
            gradient5: 'linear-gradient(135deg, #1a0a2e, #0a1a2e)',
            gradient6: 'linear-gradient(45deg, #0a0a0f, #1a1a2e, #0a0a0f)',
            sunset: 'linear-gradient(to bottom, #1a0a1a, #2e1a0f, #0a0a1a)',
            ocean: 'linear-gradient(to bottom, #0a1a2e, #0a2a3e, #0a0a1a)',
            forest: 'linear-gradient(to bottom, #0a1a0f, #0a2e1a, #0a0a0f)'
        };
        desktop.style.background = wallpapers[renderType] || wallpapers.solid;
        if (canvas) canvas.style.display = 'none';
    }

    if (syncSelection) {
        document.querySelectorAll('.wallpaper-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.wallpaper === type);
        });
    }
}

let matrixAnimationId = null;
let starsAnimationId = null;
let wavesAnimationId = null;

function stopAllAnimations(options = {}) {
    const includeParticles = options.includeParticles !== false;
    if (includeParticles && EphemeraBoot.animationId) {
        cancelAnimationFrame(EphemeraBoot.animationId);
        EphemeraBoot.animationId = null;
    }
    if (matrixAnimationId) {
        cancelAnimationFrame(matrixAnimationId);
        matrixAnimationId = null;
    }
    if (starsAnimationId) {
        cancelAnimationFrame(starsAnimationId);
        starsAnimationId = null;
    }
    if (wavesAnimationId) {
        cancelAnimationFrame(wavesAnimationId);
        wavesAnimationId = null;
    }
}

function startMatrixRain(canvas) {
    stopAllAnimations();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = Array(columns).fill(1);
    const chars = 'ã‚¢ã‚¤ã‚¦ã‚¨ã‚ªã‚«ã‚­ã‚¯ã‚±ã‚³ã‚µã‚·ã‚¹ã‚»ã‚½ã‚¿ãƒãƒ„ãƒ†ãƒˆãƒŠãƒ‹ãƒŒãƒãƒŽãƒãƒ’ãƒ•ãƒ˜ãƒ›ãƒžãƒŸãƒ ãƒ¡ãƒ¢ãƒ¤ãƒ¦ãƒ¨ãƒ©ãƒªãƒ«ãƒ¬ãƒ­ãƒ¯ãƒ²ãƒ³0123456789ABCDEF';
    
    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#0f0';
        ctx.font = fontSize + 'px monospace';
        
        for (let i = 0; i < drops.length; i++) {
            const char = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillStyle = `rgba(0, ${150 + Math.random() * 105}, 0, ${0.5 + Math.random() * 0.5})`;
            ctx.fillText(char, i * fontSize, drops[i] * fontSize);
            
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
        
        matrixAnimationId = requestAnimationFrame(draw);
    }
    
    draw();
}

function startStarfield(canvas) {
    stopAllAnimations();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const stars = [];
    for (let i = 0; i < 200; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            z: Math.random() * 1000,
            size: Math.random() * 2
        });
    }
    
    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        
        for (const star of stars) {
            star.z -= 2;
            if (star.z <= 0) {
                star.z = 1000;
                star.x = Math.random() * canvas.width;
                star.y = Math.random() * canvas.height;
            }
            
            const sx = (star.x - cx) * (500 / star.z) + cx;
            const sy = (star.y - cy) * (500 / star.z) + cy;
            const size = (1 - star.z / 1000) * 3;
            
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${1 - star.z / 1000})`;
            ctx.fill();
        }
        
        starsAnimationId = requestAnimationFrame(draw);
    }
    
    draw();
}

function startWaves(canvas) {
    stopAllAnimations();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let time = 0;
    
    function draw() {
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const colors = ['rgba(0, 212, 170, 0.3)', 'rgba(0, 150, 200, 0.2)', 'rgba(100, 100, 255, 0.15)'];
        
        for (let w = 0; w < 3; w++) {
            ctx.beginPath();
            ctx.moveTo(0, canvas.height);
            
            for (let x = 0; x <= canvas.width; x += 5) {
                const y = canvas.height * 0.6 + 
                    Math.sin(x * 0.01 + time + w) * 30 + 
                    Math.sin(x * 0.02 + time * 1.5 + w) * 20 +
                    w * 40;
                ctx.lineTo(x, y);
            }
            
            ctx.lineTo(canvas.width, canvas.height);
            ctx.closePath();
            ctx.fillStyle = colors[w];
            ctx.fill();
        }
        
        time += 0.02;
        wavesAnimationId = requestAnimationFrame(draw);
    }
    
    draw();
}

window.EphemeraBoot = EphemeraBoot;

