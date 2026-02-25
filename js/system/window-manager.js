function formatTemplate(template, params = {}) {
    const source = String(template ?? '');
    return source.replace(/\{([a-zA-Z0-9_]+)\}/g, (_all, token) => {
        if (Object.prototype.hasOwnProperty.call(params, token)) {
            return String(params[token]);
        }
        return '';
    });
}

const EphemeraWM = {
    headerHeight: 40,
    contentPadding: 32,
    _dragState: null,
    _resizeState: null,
    _globalHandlersAttached: false,
    _storedHandlers: {
        mousemove: null,
        mouseup: null
    },
    _modalBackdrops: new Map(),
    _modalParents: new Map(),
    _blockedParents: new Set(),
    _dirtyWindows: new Set(),

    _t(key, params = {}, fallback = '') {
        if (window.EphemeraI18n?.t) {
            return window.EphemeraI18n.t(key, params, fallback);
        }
        return formatTemplate(fallback || key, params);
    },

    isMobileShell() {
        return EphemeraState?.shellMode === 'mobile' || document.body.classList.contains('mobile-shell-mode');
    },

    getBottomBarHeight() {
        return this.isMobileShell() ? 64 : 56;
    },

    setDirty(windowId, isDirty) {
        if (isDirty) {
            this._dirtyWindows.add(windowId);
            this.updateWindowIndicator(windowId, true);
        } else {
            this._dirtyWindows.delete(windowId);
            this.updateWindowIndicator(windowId, false);
        }
    },

    isDirty(windowId) {
        return this._dirtyWindows.has(windowId);
    },

    updateWindowIndicator(windowId, isDirty) {
        const taskbarApp = document.querySelector(`.taskbar-app[data-window-id="${windowId}"]`);
        if (taskbarApp) {
            if (isDirty) {
                taskbarApp.classList.add('dirty');
            } else {
                taskbarApp.classList.remove('dirty');
            }
        }
    },

    async promptUnsavedChanges(message) {
        return EphemeraDialog.show({
            title: this._t('window.unsaved_changes_title', {}, 'Unsaved Changes'),
            message,
            icon: 'warning',
            buttons: [
                { label: this._t('common.cancel', {}, 'Cancel'), value: 'cancel' },
                { label: this._t('common.dont_save', {}, "Don't Save"), value: 'discard', danger: true },
                { label: this._t('common.save', {}, 'Save'), value: 'save', primary: true }
            ]
        });
    },

    async confirmClose(windowId) {
        if (!this.isDirty(windowId)) return true;

        const win = EphemeraState.windows.find(w => w.id === windowId);
        const appName = win?.app?.name || this._t('window.document_fallback_name', {}, 'Document');

        const result = await this.promptUnsavedChanges(
            this._t(
                'window.unsaved_changes_message',
                { appName },
                `${appName} has unsaved changes. Do you want to save before closing?`
            )
        );

        if (result === 'save') {
            if (win?.instance?.onSave) {
                const saveResult = await win.instance.onSave();
                return saveResult === true;
            }
            return true;
        } else if (result === 'discard') {
            return true;
        } else {
            return false;
        }
    },

    _attachGlobalHandlers() {
        if (this._globalHandlersAttached) return;
        this._globalHandlersAttached = true;

        this._storedHandlers.mousemove = (e) => {
            if (this._dragState) {
                const { windowEl, startX, startY, startLeft, startTop } = this._dragState;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                windowEl.style.left = (startLeft + dx) + 'px';
                windowEl.style.top = Math.max(0, startTop + dy) + 'px';

                if (!this.isMobileShell()) {
                    // Edge snap preview
                    const x = e.clientX, y = e.clientY;
                    const w = window.innerWidth, h = window.innerHeight;
                    if (x < 10 && y < 60) this.showSnapPreview('tl');
                    else if (x > w - 10 && y < 60) this.showSnapPreview('tr');
                    else if (x < 10 && y > h - 80) this.showSnapPreview('bl');
                    else if (x > w - 10 && y > h - 80) this.showSnapPreview('br');
                    else if (x < 10) this.showSnapPreview('left');
                    else if (x > w - 10) this.showSnapPreview('right');
                    else this.hideSnapPreview();
                }
            }

            if (this._resizeState) {
                const { windowEl, startX, startY, startWidth, startHeight } = this._resizeState;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                windowEl.style.width = Math.max(300, startWidth + dx) + 'px';
                windowEl.style.height = Math.max(200 + this.headerHeight, startHeight + dy) + 'px';
            }
        };

        this._storedHandlers.mouseup = (e) => {
            if (this._dragState) {
                const { windowId } = this._dragState;
                if (!this.isMobileShell()) {
                    const x = e.clientX, y = e.clientY;
                    const w = window.innerWidth, h = window.innerHeight;
                    if (x < 10 && y < 60) this.snapWindow(windowId, 'tl');
                    else if (x > w - 10 && y < 60) this.snapWindow(windowId, 'tr');
                    else if (x < 10 && y > h - 80) this.snapWindow(windowId, 'bl');
                    else if (x > w - 10 && y > h - 80) this.snapWindow(windowId, 'br');
                    else if (x < 10) this.snapWindow(windowId, 'left');
                    else if (x > w - 10) this.snapWindow(windowId, 'right');
                }
                this.hideSnapPreview();
                this._dragState = null;
            }
            this._resizeState = null;
        };

        document.addEventListener('mousemove', this._storedHandlers.mousemove);
        document.addEventListener('mouseup', this._storedHandlers.mouseup);
    },

    detachGlobalHandlers() {
        if (!this._globalHandlersAttached) return;

        if (this._storedHandlers.mousemove) {
            document.removeEventListener('mousemove', this._storedHandlers.mousemove);
            this._storedHandlers.mousemove = null;
        }
        if (this._storedHandlers.mouseup) {
            document.removeEventListener('mouseup', this._storedHandlers.mouseup);
            this._storedHandlers.mouseup = null;
        }

        this._globalHandlersAttached = false;
    },

    destroy() {
        const windowIds = EphemeraState.windows.map(w => w.id);
        for (const id of windowIds) this.close(id);
        this.detachGlobalHandlers();
        this._modalBackdrops.clear();
        this._modalParents.clear();
        this._blockedParents.clear();
        this._dirtyWindows.clear();
    },

    open(appId, options = {}) {
        const useMobileFullscreen = this.isMobileShell() || options.mobileFullscreen === true;
        const normalizedOptions = useMobileFullscreen
            ? { ...options, mobileFullscreen: true }
            : options;

        if (!useMobileFullscreen) {
            this._attachGlobalHandlers();
        }

        // Handle lazy-loaded apps: load first, then re-open
        if (window.EphemeraApps && window.EphemeraApps.LAZY_LOADABLE_APPS[appId] && !window.EphemeraApps.isLoaded(appId)) {
            window.EphemeraApps.lazyLoad(appId).then(loaded => {
                if (loaded) this.open(appId, normalizedOptions);
                else console.error(`Failed to lazy-load app: ${appId}`);
            });
            return null;
        }

        const app = this.getApp(appId);
        if (!app) {
            console.error(`App not found: ${appId}`);
            return null;
        }

        const appOpenSpan = window.EphemeraPerformance?.start?.('app.open_ms', {
            appId: app.id
        });
        let appOpenMetricDone = false;
        const completeAppOpenMetric = (status = 'ok') => {
            if (appOpenMetricDone) return;
            appOpenMetricDone = true;
            window.EphemeraPerformance?.end?.(appOpenSpan, {
                appId: app.id,
                status
            });
        };

        const parentWindowId = Object.prototype.hasOwnProperty.call(normalizedOptions, 'parentWindowId')
            ? normalizedOptions.parentWindowId
            : null;
        const isModalRequest = normalizedOptions.modal && parentWindowId !== null && parentWindowId !== undefined;

        if (isModalRequest) {
            if (this._blockedParents.has(parentWindowId)) {
                const existingModalId = this._modalParents.get(parentWindowId);
                if (existingModalId) {
                    const existingModal = EphemeraState.windows.find(w => w.id === existingModalId);
                    if (existingModal) {
                        this.focusWindow(existingModalId);
                    }
                }
                completeAppOpenMetric('blocked');
                return null;
            }
            this._blockedParents.add(parentWindowId);
        }

        const windowId = EphemeraState.windowIdCounter++;
        const windowEl = this.createWindow(windowId, app, normalizedOptions);

        if (isModalRequest) {
            this._createModalBackdrop(windowId, parentWindowId);
        }

        document.getElementById('windows-container').appendChild(windowEl);

        const windowInfo = {
            id: windowId,
            appId: app.id,
            app: app,
            element: windowEl,
            options: normalizedOptions,
            createdAt: Date.now()
        };
        EphemeraState.windows.push(windowInfo);
        const workspaceIndex = Number.isFinite(Number(EphemeraState.currentWorkspace))
            ? Math.max(0, Math.min((EphemeraState.workspaces?.length || 1) - 1, Number(EphemeraState.currentWorkspace)))
            : 0;
        if (!Array.isArray(EphemeraState.workspaces)) {
            EphemeraState.workspaces = [[], [], [], []];
        }
        if (!Array.isArray(EphemeraState.workspaces[workspaceIndex])) {
            EphemeraState.workspaces[workspaceIndex] = [];
        }
        EphemeraState.workspaces[workspaceIndex].push(windowId);

        if (app.content) {
            const content = app.content(windowId, normalizedOptions);
            const contentEl = document.getElementById(`content-${windowId}`);
            if (contentEl) {
                contentEl.innerHTML = content.html || '';
                if (content.init) {
                    setTimeout(async () => {
                        try {
                            const initResult = await content.init();
                            if (initResult) {
                                windowInfo.instance = initResult;
                            }
                            completeAppOpenMetric('ok');
                        } catch (error) {
                            console.error(`[EphemeraWM] App "${app.id}" init failed:`, error);
                            const errorMessage = error?.message || this._t('errors.unexpected', {}, 'An unexpected error occurred');
                            const failedTitle = this._t('window.failed_to_load', { appName: app.name }, `Failed to load ${app.name}`);
                            // Show error state in window content
                            contentEl.innerHTML = `
                                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="1.5" style="margin-bottom:16px;">
                                        <circle cx="12" cy="12" r="10"/>
                                        <line x1="12" y1="8" x2="12" y2="12"/>
                                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                                    </svg>
                                    <h3 style="margin:0 0 8px;color:var(--fg-primary);">${failedTitle}</h3>
                                    <p style="margin:0;color:var(--fg-muted);font-size:0.85rem;">${errorMessage}</p>
                                </div>
                            `;
                            if (window.EphemeraNotifications) {
                                EphemeraNotifications.error(
                                    this._t('window.app_error_title', {}, 'App Error'),
                                    this._t(
                                        'window.app_error',
                                        { appName: app.name, message: error?.message || 'Unknown error' },
                                        `Failed to load ${app.name}: ${error?.message || 'Unknown error'}`
                                    )
                                );
                            }
                            completeAppOpenMetric('error');
                        }
                    }, 0);
                } else {
                    completeAppOpenMetric('ok');
                }
            } else {
                completeAppOpenMetric('error');
            }
        } else {
            completeAppOpenMetric('ok');
        }

        this.setupWindowInteractions(windowEl, windowId, normalizedOptions);
        this.addTaskbarApp(app, windowId);
        this.focusWindow(windowId);

        if (window.EphemeraSounds) EphemeraSounds.windowOpen();
        EphemeraEvents.emit('window:opened', { windowId, appId: app.id });
        return windowId;
    },

    _createModalBackdrop(windowId, parentWindowId) {
        // Mark the modal window as aria-modal
        const modalWinEl = document.getElementById(`window-${windowId}`);
        if (modalWinEl) {
            modalWinEl.setAttribute('aria-modal', 'true');
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.dataset.windowId = windowId;
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            pointer-events: auto;
        `;
        
        document.getElementById('windows-container').appendChild(backdrop);
        
        this._modalBackdrops.set(windowId, backdrop);
        this._modalParents.set(parentWindowId, windowId);
        
        const parentWin = EphemeraState.windows.find(w => w.id === parentWindowId);
        if (parentWin && parentWin.element) {
            parentWin.element.style.filter = 'blur(2px)';
        }
        
        backdrop.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const modalWin = EphemeraState.windows.find(w => w.id === windowId);
            if (modalWin && modalWin.element) {
                modalWin.element.style.animation = 'none';
                modalWin.element.offsetHeight;
                modalWin.element.style.animation = 'modal-shake 0.3s ease';
            }
        });
    },

    _removeModalBackdrop(windowId) {
        const backdrop = this._modalBackdrops.get(windowId);
        if (backdrop) {
            backdrop.remove();
            this._modalBackdrops.delete(windowId);
        }
        
        for (const [parentId, modalId] of this._modalParents.entries()) {
            if (modalId === windowId) {
                const parentWin = EphemeraState.windows.find(w => w.id === parentId);
                if (parentWin && parentWin.element) {
                    parentWin.element.style.filter = '';
                }
                this._modalParents.delete(parentId);
                this._blockedParents.delete(parentId);
                break;
            }
        }
    },

    createWindow(windowId, app, options) {
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.id = `window-${windowId}`;
        windowEl.setAttribute('tabindex', '-1');
        const isMobileWindow = options.mobileFullscreen === true || this.isMobileShell();
        if (isMobileWindow) {
            windowEl.classList.add('mobile-fullscreen');
        }

        let x = options.x ?? (100 + (EphemeraState.windows.length % 5) * 40);
        let y = options.y ?? (60 + (EphemeraState.windows.length % 5) * 40);
        let width = options.width ?? app.width ?? 600;
        let height = options.height ?? app.height ?? 400;

        // Viewport clamping - ensure window fits within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const taskbarHeight = this.getBottomBarHeight();
        const minVisibleWidth = 100;
        const minVisibleHeight = 60;

        const title = options.title ?? app.name;
        const minimizeLabel = this._t('common.minimize', {}, 'Minimize');
        const maximizeLabel = this._t('common.maximize', {}, 'Maximize');
        const closeLabel = this._t('common.close', {}, 'Close');

        windowEl.setAttribute('role', 'dialog');
        windowEl.setAttribute('aria-label', title);

        windowEl.innerHTML = `
            <div class="window-header">
                <div class="window-title">
                    <span aria-hidden="true">${app.icon}</span>
                    <span>${EphemeraSanitize ? EphemeraSanitize.escapeHtml(title) : title}</span>
                </div>
                <div class="window-controls">
                    <button class="window-btn minimize" title="${minimizeLabel}" aria-label="${minimizeLabel}"></button>
                    <button class="window-btn maximize" title="${maximizeLabel}" aria-label="${maximizeLabel}"></button>
                    <button class="window-btn close" title="${closeLabel}" aria-label="${closeLabel}"></button>
                </div>
            </div>
            <div class="window-content" id="content-${windowId}" role="document"></div>
            <div class="window-resize" aria-hidden="true"></div>
        `;

        if (isMobileWindow) {
            windowEl.classList.add('maximized');
            windowEl.style.left = '0px';
            windowEl.style.top = '0px';
            windowEl.style.width = '100vw';
            windowEl.style.height = `calc(100vh - ${taskbarHeight}px)`;
        } else {
            // Clamp width to viewport (with some padding)
            width = Math.min(width, viewportWidth - 40);
            // Clamp height to viewport (with taskbar consideration)
            height = Math.min(height, viewportHeight - taskbarHeight - 40);
            const clampedTotalHeight = height + this.headerHeight;

            // Clamp x position - ensure window titlebar is accessible
            x = Math.max(0, Math.min(x, viewportWidth - minVisibleWidth));
            // Clamp y position - ensure window titlebar is always visible
            y = Math.max(0, Math.min(y, viewportHeight - taskbarHeight - minVisibleHeight));

            windowEl.style.left = x + 'px';
            windowEl.style.top = y + 'px';
            windowEl.style.width = width + 'px';
            windowEl.style.height = clampedTotalHeight + 'px';
        }

        return windowEl;
    },

    _focusWindowElement(windowEl) {
        if (!windowEl || typeof windowEl.focus !== 'function') return;
        try {
            windowEl.focus({ preventScroll: true });
        } catch (_error) {
            windowEl.focus();
        }
    },

    setupWindowInteractions(windowEl, windowId, options = {}) {
        const header = windowEl.querySelector('.window-header');
        const resizeHandle = windowEl.querySelector('.window-resize');
        const closeBtn = windowEl.querySelector('.window-btn.close');
        const minBtn = windowEl.querySelector('.window-btn.minimize');
        const maxBtn = windowEl.querySelector('.window-btn.maximize');
        const isMobileWindow = options.mobileFullscreen === true || this.isMobileShell();

        if (!isMobileWindow) {
            header.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('window-btn')) return;
                if (windowEl.classList.contains('maximized')) return;

                this._dragState = {
                    windowEl, windowId,
                    startX: e.clientX, startY: e.clientY,
                    startLeft: windowEl.offsetLeft, startTop: windowEl.offsetTop
                };
                this.focusWindow(windowId);
            });

            resizeHandle.addEventListener('mousedown', (e) => {
                if (windowEl.classList.contains('maximized')) return;

                this._resizeState = {
                    windowEl,
                    startX: e.clientX, startY: e.clientY,
                    startWidth: windowEl.offsetWidth, startHeight: windowEl.offsetHeight
                };
                e.stopPropagation();
            });
        }

        closeBtn.addEventListener('click', async () => await this.close(windowId));
        if (!isMobileWindow) {
            minBtn.addEventListener('click', () => this.minimize(windowId));
            maxBtn.addEventListener('click', () => this.toggleMaximize(windowId));
        }

        windowEl.addEventListener('mousedown', () => this.focusWindow(windowId));

        if (!isMobileWindow) {
            header.addEventListener('dblclick', (e) => {
                if (!e.target.classList.contains('window-btn')) {
                    this.toggleMaximize(windowId);
                }
            });
        }
    },

    showSnapPreview(side) {
        if (this.isMobileShell()) return;
        if (!this.snapPreviewEl) {
            this.snapPreviewEl = document.createElement('div');
            this.snapPreviewEl.style.cssText = `
                position: fixed;
                background: rgba(0, 212, 170, 0.1);
                border: 2px dashed var(--accent);
                pointer-events: none;
                z-index: 9999;
                transition: all 0.15s ease;
            `;
            document.body.appendChild(this.snapPreviewEl);
        }
        const el = this.snapPreviewEl;
        const taskbarH = this.getBottomBarHeight();
        const hw = window.innerWidth / 2;
        const hh = (window.innerHeight - taskbarH) / 2;
        const fh = window.innerHeight - taskbarH;

        const positions = {
            left:  { top: 0, left: 0, width: hw, height: fh },
            right: { top: 0, left: hw, width: hw, height: fh },
            tl:    { top: 0, left: 0, width: hw, height: hh },
            tr:    { top: 0, left: hw, width: hw, height: hh },
            bl:    { top: hh, left: 0, width: hw, height: hh },
            br:    { top: hh, left: hw, width: hw, height: hh }
        };

        const pos = positions[side] || positions.left;
        el.style.top = pos.top + 'px';
        el.style.left = pos.left + 'px';
        el.style.width = pos.width + 'px';
        el.style.height = pos.height + 'px';
        el.style.display = 'block';
    },

    hideSnapPreview() {
        if (this.snapPreviewEl) {
            this.snapPreviewEl.style.display = 'none';
        }
    },

    snapWindow(windowId, side) {
        if (this.isMobileShell()) return;
        const win = EphemeraState.windows.find(w => w.id === windowId);
        if (!win) return;

        win.element.classList.remove('maximized', 'snapped-left', 'snapped-right', 'snapped-tl', 'snapped-tr', 'snapped-bl', 'snapped-br');
        const classMap = {
            left: 'snapped-left', right: 'snapped-right',
            tl: 'snapped-tl', tr: 'snapped-tr', bl: 'snapped-bl', br: 'snapped-br'
        };
        if (classMap[side]) {
            win.element.classList.add(classMap[side]);
        }
        EphemeraEvents.emit('window:snapped', { windowId, side });
    },

    focusWindow(windowId) {
        const winToFocus = EphemeraState.windows.find(w => w.id === windowId);
        if (!winToFocus) return;
        const modalWindowIds = new Set(this._modalBackdrops.keys());
        
        if (this._modalBackdrops.size > 0 && winToFocus) {
            let isModalWindow = false;
            for (const backdrop of this._modalBackdrops.values()) {
                if (backdrop.dataset.windowId == windowId) {
                    isModalWindow = true;
                    break;
                }
            }
            
            if (!isModalWindow) {
                for (const modalId of this._modalBackdrops.keys()) {
                    const modalWin = EphemeraState.windows.find(w => w.id === modalId);
                    if (modalWin) {
                        this.focusWindow(modalId);
                        if (modalWin.element) {
                            modalWin.element.style.animation = 'none';
                            modalWin.element.offsetHeight;
                            modalWin.element.style.animation = 'modal-shake 0.3s ease';
                        }
                    }
                }
                return;
            }
        }

        EphemeraState.activeWindowId = windowId;

        // Move focused window to end of array for z-ordering
        const idx = EphemeraState.windows.findIndex(w => w.id === windowId);
        if (idx > -1 && idx < EphemeraState.windows.length - 1) {
            const [win] = EphemeraState.windows.splice(idx, 1);
            EphemeraState.windows.push(win);
        }

        // Assign z-index based on array position
        const baseZ = 100;
        EphemeraState.windows.forEach((win, i) => {
            if (win && win.element) {
                if (modalWindowIds.has(win.id)) {
                    win.element.style.zIndex = 10100 + i;
                } else {
                    win.element.style.zIndex = baseZ + i;
                }
            }
        });

        this._modalBackdrops.forEach((backdrop, modalId) => {
            const modalWin = EphemeraState.windows.find(w => w.id === modalId);
            if (modalWin && modalWin.element) {
                const idx = EphemeraState.windows.findIndex(w => w.id === modalId);
                if (idx >= 0) {
                    backdrop.style.zIndex = String(10099 + idx);
                }
            }
        });

        const win = EphemeraState.windows.find(w => w.id === windowId);
        if (win) {
            win.element.classList.remove('minimized');
            if (!this.isMobileShell()) {
                this.updateTaskbarActive(win.appId);
            }
            this._focusWindowElement(win.element);
        }

        EphemeraEvents.emit('window:focused', { windowId });
    },

    async close(windowId) {
        const winIndex = EphemeraState.windows.findIndex(w => w.id === windowId);
        if (winIndex === -1) return;

        const win = EphemeraState.windows[winIndex];
        const wasActive = EphemeraState.activeWindowId === windowId;
        
        if (this.isDirty(windowId)) {
            const shouldClose = await this.confirmClose(windowId);
            if (!shouldClose) return;
        }

        if (win.app && win.app.onClose) {
            try {
                win.app.onClose(windowId);
            } catch (error) {
                console.error('Window onClose handler failed:', error);
            }
        }

        // Call instance destroy for cleanup (listeners, intervals, etc.)
        if (win.instance && typeof win.instance.destroy === 'function') {
            try {
                win.instance.destroy();
            } catch (error) {
                console.error('Window instance destroy failed:', error);
            }
        }

        this._removeModalBackdrop(windowId);
        this._dirtyWindows.delete(windowId);

        win.element.remove();
        EphemeraState.windows.splice(winIndex, 1);

        EphemeraState.workspaces.forEach((ws) => {
            const idx = ws.indexOf(windowId);
            if (idx !== -1) ws.splice(idx, 1);
        });

        const taskbarApp = document.querySelector(`.taskbar-app[data-window-id="${windowId}"]`);
        if (taskbarApp) taskbarApp.remove();

        if (wasActive) {
            const currentWorkspace = Number(EphemeraState.currentWorkspace || 0);
            const inCurrentWorkspace = EphemeraState.windows.filter((entry) => {
                const workspace = this.getWindowWorkspace(entry.id);
                return workspace === currentWorkspace;
            });
            const nextWindow = inCurrentWorkspace[inCurrentWorkspace.length - 1]
                || EphemeraState.windows[EphemeraState.windows.length - 1]
                || null;

            if (nextWindow) {
                this.focusWindow(nextWindow.id);
            } else {
                EphemeraState.activeWindowId = null;
                if (!this.isMobileShell()) {
                    document.querySelectorAll('.taskbar-app.active').forEach((entry) => {
                        entry.classList.remove('active');
                    });
                }
            }
        }

        if (window.EphemeraSounds) EphemeraSounds.windowClose();
        EphemeraEvents.emit('window:closed', { windowId, appId: win.appId });
    },

    minimize(windowId) {
        const win = EphemeraState.windows.find(w => w.id === windowId);
        if (win) {
            win.element.classList.add('minimized');
            EphemeraEvents.emit('window:minimized', { windowId });
        }
    },

    toggleMaximize(windowId) {
        const win = EphemeraState.windows.find(w => w.id === windowId);
        if (win) {
            win.element.classList.toggle('maximized');
            win.element.classList.remove('snapped-left', 'snapped-right', 'snapped-tl', 'snapped-tr', 'snapped-bl', 'snapped-br');
            EphemeraEvents.emit('window:maximized', { windowId });
        }
    },

    getWindow(windowId) {
        return EphemeraState.windows.find(w => w.id === windowId);
    },

    getWindowsByApp(appId) {
        return EphemeraState.windows.filter(w => w.appId === appId);
    },

    getWindowWorkspace(windowId) {
        if (!Array.isArray(EphemeraState.workspaces)) return -1;
        const normalizedWindowId = Number(windowId);
        for (let index = 0; index < EphemeraState.workspaces.length; index++) {
            const bucket = EphemeraState.workspaces[index];
            if (Array.isArray(bucket) && bucket.includes(normalizedWindowId)) {
                return index;
            }
        }
        return -1;
    },

    moveToWorkspace(windowId, targetWorkspace, options = {}) {
        const normalizedWindowId = Number(windowId);
        const normalizedTarget = Number(targetWorkspace);
        if (!Number.isInteger(normalizedWindowId) || !Number.isInteger(normalizedTarget)) return false;
        if (!Array.isArray(EphemeraState.workspaces) || EphemeraState.workspaces.length === 0) return false;
        if (normalizedTarget < 0 || normalizedTarget >= EphemeraState.workspaces.length) return false;

        const sourceWorkspace = this.getWindowWorkspace(normalizedWindowId);
        if (sourceWorkspace === -1) return false;
        if (sourceWorkspace === normalizedTarget) {
            if (options.switchTo === true) {
                window.EphemeraBoot?.switchWorkspace?.(normalizedTarget);
            }
            return true;
        }

        const sourceBucket = Array.isArray(EphemeraState.workspaces[sourceWorkspace])
            ? EphemeraState.workspaces[sourceWorkspace]
            : [];
        const sourceIndex = sourceBucket.indexOf(normalizedWindowId);
        if (sourceIndex !== -1) sourceBucket.splice(sourceIndex, 1);

        if (!Array.isArray(EphemeraState.workspaces[normalizedTarget])) {
            EphemeraState.workspaces[normalizedTarget] = [];
        }
        const targetBucket = EphemeraState.workspaces[normalizedTarget];
        if (!targetBucket.includes(normalizedWindowId)) {
            targetBucket.push(normalizedWindowId);
        }

        const win = this.getWindow(normalizedWindowId);
        const currentWorkspace = Number(EphemeraState.currentWorkspace || 0);
        if (win?.element) {
            if (sourceWorkspace === currentWorkspace && normalizedTarget !== currentWorkspace) {
                win.element.style.display = 'none';
                if (EphemeraState.activeWindowId === normalizedWindowId) {
                    EphemeraState.activeWindowId = null;
                }
            } else if (normalizedTarget === currentWorkspace) {
                win.element.style.display = 'flex';
                if (options.focus !== false) {
                    this.focusWindow(normalizedWindowId);
                }
            }
        }

        if (options.switchTo === true) {
            window.EphemeraBoot?.switchWorkspace?.(normalizedTarget);
        }

        window.EphemeraEvents?.emit?.('window:moved-workspace', {
            windowId: normalizedWindowId,
            fromWorkspace: sourceWorkspace,
            toWorkspace: normalizedTarget
        });
        return true;
    },

    cascadeAll() {
        if (this.isMobileShell()) return;
        EphemeraState.windows.forEach((win, i) => {
            if (win && win.element) {
                win.element.classList.remove('maximized', 'snapped-left', 'snapped-right', 'snapped-tl', 'snapped-tr', 'snapped-bl', 'snapped-br', 'minimized');
                win.element.style.left = (80 + i * 30) + 'px';
                win.element.style.top = (40 + i * 30) + 'px';
                win.element.style.width = '600px';
                win.element.style.height = '440px';
            }
        });
    },

    tileAll() {
        if (this.isMobileShell()) return;
        const visible = EphemeraState.windows.filter(w => w && w.element && !w.element.classList.contains('minimized'));
        if (visible.length === 0) return;

        const taskbarH = this.getBottomBarHeight();
        const w = window.innerWidth;
        const h = window.innerHeight - taskbarH;

        const cols = Math.ceil(Math.sqrt(visible.length));
        const rows = Math.ceil(visible.length / cols);
        const tileW = Math.floor(w / cols);
        const tileH = Math.floor(h / rows);

        visible.forEach((win, i) => {
            win.element.classList.remove('maximized', 'snapped-left', 'snapped-right', 'snapped-tl', 'snapped-tr', 'snapped-bl', 'snapped-br');
            const col = i % cols;
            const row = Math.floor(i / cols);
            win.element.style.left = (col * tileW) + 'px';
            win.element.style.top = (row * tileH) + 'px';
            win.element.style.width = tileW + 'px';
            win.element.style.height = tileH + 'px';
            win.element.style.borderRadius = '0';
        });
    },

    addTaskbarApp(app, windowId) {
        if (this.isMobileShell()) return;
        const container = document.getElementById('taskbar-apps');
        if (!container) return;
        const taskbarApp = document.createElement('div');
        taskbarApp.className = 'taskbar-app active';
        taskbarApp.dataset.appId = app.id;
        taskbarApp.dataset.windowId = windowId;
        taskbarApp.setAttribute('draggable', 'true');
        taskbarApp.setAttribute('role', 'button');
        taskbarApp.setAttribute('tabindex', '0');
        taskbarApp.setAttribute('aria-label', this._t('desktop.open_app', { name: app.name }, `Open ${app.name}`));
        taskbarApp.innerHTML = app.icon;

        const activateTaskbarApp = () => {
            const win = EphemeraState.windows.find(w => w.id === windowId);
            if (win) {
                if (win.element.classList.contains('minimized')) {
                    win.element.classList.remove('minimized');
                }
                this.focusWindow(windowId);
            }
        };

        taskbarApp.addEventListener('click', activateTaskbarApp);
        taskbarApp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activateTaskbarApp();
            }
        });

        // Right-click context menu on taskbar
        taskbarApp.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._showTaskbarContextMenu(e, windowId, app);
        });

        taskbarApp.addEventListener('dragstart', (e) => {
            taskbarApp.classList.add('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/ephemera-window-id', String(windowId));
            }
        });
        taskbarApp.addEventListener('dragend', () => {
            taskbarApp.classList.remove('dragging');
        });

        container.appendChild(taskbarApp);
    },

    _showTaskbarContextMenu(e, windowId, app) {
        let menu = document.getElementById('taskbar-context-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'taskbar-context-menu';
            menu.style.cssText = `position:fixed;background:var(--glass);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:var(--radius-md);padding:6px 0;min-width:150px;z-index:100000;box-shadow:var(--window-shadow);display:none;`;
            document.body.appendChild(menu);
            document.addEventListener('click', () => { menu.style.display = 'none'; });
        }

        const closeLabel = this._t('common.close', {}, 'Close');
        const minimizeLabel = this._t('common.minimize', {}, 'Minimize');
        const maximizeLabel = this._t('common.maximize', {}, 'Maximize');
        const newWindowLabel = this._t('window.new_window', {}, 'New Window');
        const workspaces = Array.isArray(EphemeraState.workspaces) && EphemeraState.workspaces.length > 0
            ? EphemeraState.workspaces
            : [[], [], [], []];
        const workspaceNames = Array.isArray(EphemeraState.workspaceNames) && EphemeraState.workspaceNames.length === workspaces.length
            ? EphemeraState.workspaceNames
            : workspaces.map((_, index) => `Workspace ${index + 1}`);
        const esc = window.EphemeraSanitize?.escapeHtml
            ? (value) => window.EphemeraSanitize.escapeHtml(String(value))
            : (value) => String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        menu.innerHTML = `
            <div class="context-item" data-action="close" style="padding:8px 14px;font-size:0.85rem;cursor:pointer;">${closeLabel}</div>
            <div class="context-item" data-action="minimize" style="padding:8px 14px;font-size:0.85rem;cursor:pointer;">${minimizeLabel}</div>
            <div class="context-item" data-action="maximize" style="padding:8px 14px;font-size:0.85rem;cursor:pointer;">${maximizeLabel}</div>
            <div class="context-item" data-action="new" style="padding:8px 14px;font-size:0.85rem;cursor:pointer;">${newWindowLabel}</div>
            <div style="height:1px;background:var(--border);margin:6px 0;"></div>
            ${workspaceNames.map((name, index) => `
                <div class="context-item" data-action="move-workspace" data-workspace="${index}" style="padding:8px 14px;font-size:0.8rem;cursor:pointer;color:var(--fg-secondary);">
                    Move to ${esc(name)}
                </div>
            `).join('')}
        `;

        menu.style.left = e.clientX + 'px';
        menu.style.top = 'auto';
        menu.style.bottom = '60px';
        menu.style.display = 'block';

        menu.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', async () => {
                const action = item.dataset.action;
                if (action === 'close') await this.close(windowId);
                else if (action === 'minimize') this.minimize(windowId);
                else if (action === 'maximize') this.toggleMaximize(windowId);
                else if (action === 'new') this.open(app.id);
                else if (action === 'move-workspace') {
                    const targetWorkspace = Number.parseInt(String(item.dataset.workspace || ''), 10);
                    this.moveToWorkspace(windowId, targetWorkspace);
                }
                menu.style.display = 'none';
            });
        });
    },

    updateTaskbarActive(appId) {
        if (this.isMobileShell()) return;
        document.querySelectorAll('.taskbar-app').forEach(el => {
            el.classList.toggle('active', el.dataset.appId === appId);
        });
    },

    getApp(appId) {
        return EphemeraApps.get(appId);
    }
};

window.EphemeraWM = EphemeraWM;
