const EphemeraSystemTray = {
    _items: [],
    _container: null,
    _popup: null,
    _currentPopupId: null,
    _syncStatusUnsub: null,
    _syncSettingUnsub: null,
    _syncConflictUnsub: null,
    _syncState: {
        status: 'idle',
        error: null,
        lastSyncAt: null
    },

    init() {
        this._container = document.getElementById('system-tray');
        this._popup = document.createElement('div');
        this._popup.id = 'system-tray-popup';
        this._popup.style.cssText = `
            position:fixed;
            bottom:60px;
            right:10px;
            background:rgba(15,15,20,0.95);
            backdrop-filter:blur(20px);
            border:1px solid var(--border);
            border-radius:var(--radius-md);
            padding:12px;
            min-width:200px;
            display:none;
            z-index:1000;
            box-shadow:0 8px 32px rgba(0,0,0,0.4);
        `;
        document.body.appendChild(this._popup);

        this.addBuiltInItems();
        this.setupEventListeners();
    },

    addBuiltInItems() {
        this.addItem({
            id: 'audio',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>`,
            tooltip: 'Audio Settings',
            onClick: () => this.togglePopup('audio', () => this.showAudioPopup())
        });

        this.addItem({
            id: 'battery',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="18" height="12" rx="2" ry="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg>`,
            tooltip: 'Battery Status',
            onClick: () => this.togglePopup('battery', () => this.showBatteryPopup()),
            onUpdate: async (item) => {
                if ('getBattery' in navigator) {
                    try {
                        const battery = await navigator.getBattery();
                        const level = Math.round(battery.level * 100);
                        const charging = battery.charging;
                        item.tooltip = `Battery: ${level}%${charging ? ' (Charging)' : ''}`;
                        item.icon = charging 
                            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/><path d="M11 10v4M9 12h4"/></svg>`
                            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/><rect x="4" y="9" width="${Math.round(battery.level * 12)}" height="6" fill="currentColor" opacity="0.5"/></svg>`;
                        this.render();
                    } catch (_e) {
                        // Battery API can fail on unsupported/user-denied environments.
                    }
                }
            }
        });

        this.addItem({
            id: 'network',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`,
            tooltip: navigator.onLine ? 'Connected' : 'Offline',
            onClick: () => this.togglePopup('network', () => this.showNetworkPopup())
        });

        this.addItem({
            id: 'sync',
            icon: this._getSyncIcon(this._syncState.status),
            tooltip: this._getSyncTooltip(this._syncState),
            visible: this._hasConfiguredSyncProvider(),
            onClick: () => this.togglePopup('sync', () => this.showSyncPopup())
        });

        this.addItem({
            id: 'screenshots',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
            tooltip: 'Take Screenshot',
            onClick: () => this.takeScreenshot()
        });

        this.addItem({
            id: 'widgets',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
            tooltip: 'Add Widget',
            onClick: () => this.togglePopup('widgets', () => this.showWidgetsPopup())
        });

        this.addItem({
            id: 'quicksettings',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
            tooltip: 'Quick Settings',
            onClick: () => this.togglePopup('quicksettings', () => this.showQuickSettings())
        });

        this._items.forEach(item => {
            if (item.onUpdate) item.onUpdate(item);
        });
    },

    addItem(item) {
        const defaultItem = {
            id: '',
            icon: '',
            tooltip: '',
            onClick: null,
            onUpdate: null,
            visible: true
        };
        this._items.push({ ...defaultItem, ...item });
        this.render();
    },

    removeItem(id) {
        this._items = this._items.filter(item => item.id !== id);
        this.render();
    },

    render() {
        const trayItems = this._container.querySelector('#tray-items') || document.createElement('div');
        trayItems.id = 'tray-items';
        trayItems.style.cssText = 'display:flex;align-items:center;gap:4px;margin-right:8px;';
        
        trayItems.innerHTML = this._items
            .filter(item => item.visible)
            .map(item => `
                <div class="tray-item" data-id="${item.id}" title="${item.tooltip}" style="
                    width:28px;height:28px;display:flex;align-items:center;justify-content:center;
                    cursor:pointer;border-radius:var(--radius-sm);transition:all 0.15s;
                ">
                    ${item.icon}
                </div>
            `).join('');

        if (!this._container.contains(trayItems)) {
            this._container.insertBefore(trayItems, this._container.firstChild);
        }

        trayItems.querySelectorAll('.tray-item').forEach(el => {
            el.addEventListener('mouseenter', () => el.style.background = 'var(--bg-tertiary)');
            el.addEventListener('mouseleave', () => el.style.background = 'transparent');
            el.addEventListener('click', () => {
                const item = this._items.find(i => i.id === el.dataset.id);
                if (item?.onClick) item.onClick();
            });
        });
    },

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (!this._popup.contains(e.target) && !e.target.closest('.tray-item')) {
                this._popup.style.display = 'none';
            }
        });

        window.addEventListener('online', () => this.updateNetworkStatus(true));
        window.addEventListener('offline', () => this.updateNetworkStatus(false));

        if (this._syncStatusUnsub) this._syncStatusUnsub();
        if (this._syncSettingUnsub) this._syncSettingUnsub();
        if (this._syncConflictUnsub) this._syncConflictUnsub();
        if (window.EphemeraEvents?.on) {
            this._syncStatusUnsub = window.EphemeraEvents.on('sync:status', (payload) => {
                this.updateSyncStatus(payload || {});
            });
            this._syncSettingUnsub = window.EphemeraEvents.on('setting:changed', (payload) => {
                if (payload?.key === 'syncProvider') {
                    this._updateSyncVisibility();
                }
            });
            this._syncConflictUnsub = window.EphemeraEvents.on('sync:conflict', (payload) => {
                this.handleSyncConflict(payload || {});
            });
        }
        this.updateSyncStatus({
            status: this._syncState.status || 'idle',
            error: this._syncState.error || null,
            lastSyncAt: window.EphemeraState?.settings?.syncLastAt || null
        });
        this._updateSyncVisibility();

        setInterval(() => {
            this._items.forEach(item => {
                if (item.onUpdate) item.onUpdate(item);
            });
        }, 30000);
    },

    updateNetworkStatus(online) {
        const item = this._items.find(i => i.id === 'network');
        if (item) {
            item.tooltip = online ? 'Connected' : 'Offline';
            item.icon = online 
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 015.17-2.39"/><path d="M10.71 5.05A16 16 0 0122.58 9"/><path d="M1.42 9a15.91 15.91 0 014.7-2.88"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`;
            this.render();
        }
    },

    _hasConfiguredSyncProvider() {
        const provider = String(window.EphemeraState?.settings?.syncProvider || 'none').toLowerCase();
        return provider !== 'none';
    },

    _getSyncIcon(status = 'idle') {
        const stroke = status === 'error'
            ? 'var(--danger)'
            : status === 'syncing'
                ? 'var(--warning)'
                : status === 'synced'
                    ? 'var(--accent)'
                    : 'currentColor';
        return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2"><path d="M21 12a9 9 0 0 1-3.2 6.9"/><path d="M3 12a9 9 0 0 1 15.2-6.3"/><polyline points="21 16 21 12 17 12"/><polyline points="3 8 3 12 7 12"/></svg>`;
    },

    _getSyncTooltip(state = {}) {
        const status = String(state.status || 'idle');
        if (status === 'syncing') return 'Cloud Sync: Syncing...';
        if (status === 'synced') return 'Cloud Sync: Synced';
        if (status === 'error') {
            const detail = state.error ? ` (${String(state.error).slice(0, 80)})` : '';
            return `Cloud Sync: Error${detail}`;
        }
        return 'Cloud Sync: Idle';
    },

    _updateSyncVisibility() {
        const item = this._items.find(i => i.id === 'sync');
        if (!item) return;
        item.visible = this._hasConfiguredSyncProvider();
        if (!item.visible && this._currentPopupId === 'sync') {
            this.hidePopup();
        }
        this.render();
    },

    updateSyncStatus(payload = {}) {
        const nextState = {
            status: String(payload.status || this._syncState.status || 'idle'),
            error: payload.error ?? this._syncState.error ?? null,
            lastSyncAt: payload.lastSyncAt ?? this._syncState.lastSyncAt ?? null
        };
        this._syncState = nextState;

        const item = this._items.find(i => i.id === 'sync');
        if (!item) return;

        item.icon = this._getSyncIcon(nextState.status);
        item.tooltip = this._getSyncTooltip(nextState);
        this.render();

        if (this._currentPopupId === 'sync' && this._popup.style.display === 'block') {
            this.showSyncPopup();
        }
    },

    _shortenPath(path, maxLength = 84) {
        const value = String(path || '').trim();
        if (!value) return '';
        if (value.length <= maxLength) return value;

        const head = Math.max(16, Math.floor((maxLength - 3) * 0.66));
        const tail = Math.max(10, maxLength - 3 - head);
        return `${value.slice(0, head)}...${value.slice(-tail)}`;
    },

    _openConflictDiff(path, conflictPath = '') {
        if (!path || !window.EphemeraWM?.open) return;
        const options = { filePath: path };
        if (conflictPath) {
            options.comparePath = conflictPath;
            options.compareLabel = 'Conflict Copy';
        }
        window.EphemeraWM.open('file-history', options);
    },

    _openConflictCopy(conflictPath) {
        if (!conflictPath || !window.EphemeraWM?.open) return;
        window.EphemeraWM.open('code', { filePath: conflictPath });
    },

    handleSyncConflict(payload = {}) {
        const path = typeof payload.path === 'string' ? payload.path : '';
        const conflictPath = typeof payload.conflictPath === 'string' ? payload.conflictPath : '';
        if (!path) return;

        const message = conflictPath
            ? `A newer remote version replaced ${this._shortenPath(path)}. Your local copy is preserved at ${this._shortenPath(conflictPath)}.`
            : `A newer remote version replaced ${this._shortenPath(path)}.`;

        if (window.EphemeraNotifications?.warning) {
            window.EphemeraNotifications.warning('Sync Conflict Detected', message, {
                duration: 12000,
                onClick: () => this._openConflictDiff(path, conflictPath),
                actions: [
                    {
                        label: 'View Diff',
                        primary: true,
                        onClick: () => this._openConflictDiff(path, conflictPath)
                    },
                    ...(conflictPath
                        ? [{
                            label: 'Open Conflict Copy',
                            onClick: () => this._openConflictCopy(conflictPath)
                        }]
                        : [])
                ]
            });
            return;
        }

        this._openConflictDiff(path, conflictPath);
    },

    showPopup(content, popupId = null) {
        this._popup.innerHTML = content;
        this._popup.style.display = 'block';
        this._currentPopupId = popupId;
    },

    togglePopup(popupId, showFn) {
        if (this._currentPopupId === popupId && this._popup.style.display === 'block') {
            this.hidePopup();
        } else {
            showFn();
        }
    },

    hidePopup() {
        this._popup.style.display = 'none';
        this._currentPopupId = null;
    },

    showAudioPopup() {
        this.showPopup(`
            <div style="font-size:0.85rem;color:var(--fg-secondary);margin-bottom:10px;">Audio</div>
            <div style="display:flex;align-items:center;gap:10px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>
                <input type="range" id="volume-slider" min="0" max="100" value="100" style="flex:1;accent-color:var(--accent);">
                <span id="volume-value" style="min-width:35px;text-align:right;font-size:0.8rem;color:var(--fg-muted);">100%</span>
            </div>
        `, 'audio');
        
        const slider = document.getElementById('volume-slider');
        const value = document.getElementById('volume-value');
        slider.addEventListener('input', () => {
            value.textContent = slider.value + '%';
            if (window.EphemeraSounds) {
                EphemeraSounds.volume = slider.value / 100;
            }
        });
    },

    async showBatteryPopup() {
        let info = 'Battery information not available';
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                info = `
                    <div style="margin-bottom:8px;"><strong>Level:</strong> ${Math.round(battery.level * 100)}%</div>
                    <div style="margin-bottom:8px;"><strong>Status:</strong> ${battery.charging ? 'Charging' : 'Discharging'}</div>
                    ${battery.charging && battery.chargingTime !== Infinity ? `<div><strong>Full in:</strong> ${Math.round(battery.chargingTime / 60)} min</div>` : ''}
                `;
            } catch (_e) {
                // Battery API can fail on unsupported/user-denied environments.
            }
        }
        this.showPopup(`
            <div style="font-size:0.85rem;color:var(--fg-secondary);margin-bottom:10px;">Battery Status</div>
            ${info}
        `, 'battery');
    },

    showNetworkPopup() {
        this.showPopup(`
            <div style="font-size:0.85rem;color:var(--fg-secondary);margin-bottom:10px;">Network</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <div style="width:8px;height:8px;border-radius:50%;background:${navigator.onLine ? '#22c55e' : '#ef4444'}"></div>
                <span>${navigator.onLine ? 'Online' : 'Offline'}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--fg-muted);">Connection: ${navigator.connection?.effectiveType || 'Unknown'}</div>
        `, 'network');
    },

    showSyncPopup() {
        const status = String(this._syncState.status || 'idle');
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        const statusColor = status === 'error'
            ? 'var(--danger)'
            : status === 'syncing'
                ? 'var(--warning)'
                : status === 'synced'
                    ? 'var(--accent)'
                    : 'var(--fg-secondary)';
        const lastSyncText = this._syncState.lastSyncAt
            ? new Date(this._syncState.lastSyncAt).toLocaleString()
            : 'Never';
        const errorText = this._syncState.error
            ? `<div style="margin-top:8px;font-size:0.75rem;color:var(--danger);line-height:1.4;">${String(this._syncState.error)}</div>`
            : '';

        this.showPopup(`
            <div style="font-size:0.85rem;color:var(--fg-secondary);margin-bottom:10px;">Cloud Sync</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                <span style="font-size:0.78rem;color:var(--fg-muted);">Status</span>
                <span style="font-size:0.78rem;color:${statusColor};font-weight:600;">${statusLabel}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px;">
                <span style="font-size:0.78rem;color:var(--fg-muted);">Last Sync</span>
                <span style="font-size:0.72rem;color:var(--fg-secondary);text-align:right;">${lastSyncText}</span>
            </div>
            ${errorText}
            <div style="margin-top:10px;display:flex;gap:8px;">
                <button data-action="sync-now" style="flex:1;padding:7px 9px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-secondary);font-size:0.74rem;cursor:pointer;">Sync Now</button>
                <button data-action="open-settings" style="flex:1;padding:7px 9px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-secondary);font-size:0.74rem;cursor:pointer;">Sync Settings</button>
            </div>
        `, 'sync');

        const syncNowBtn = this._popup.querySelector('[data-action="sync-now"]');
        const openSettingsBtn = this._popup.querySelector('[data-action="open-settings"]');

        if (syncNowBtn) {
            syncNowBtn.addEventListener('click', async () => {
                syncNowBtn.disabled = true;
                syncNowBtn.textContent = 'Syncing...';
                try {
                    await window.EphemeraSyncManager?.syncAll?.();
                } catch (e) {
                    window.EphemeraNotifications?.error?.('Sync Failed', e?.message || 'Could not complete sync.');
                } finally {
                    syncNowBtn.disabled = false;
                    syncNowBtn.textContent = 'Sync Now';
                }
            });
        }
        if (openSettingsBtn) {
            openSettingsBtn.addEventListener('click', () => {
                this.hidePopup();
                window.EphemeraWM?.open?.('settings', { section: 'sync' });
            });
        }
    },

    showWidgetsPopup() {
        if (window.EphemeraWidgets?.init) {
            window.EphemeraWidgets.init();
        }

        const escapeHtml = window.EphemeraSanitize?.escapeHtml
            ? (value) => window.EphemeraSanitize.escapeHtml(String(value))
            : (value) => String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        const escapeAttr = window.EphemeraSanitize?.escapeAttr
            ? (value) => window.EphemeraSanitize.escapeAttr(String(value))
            : escapeHtml;

        const rawWidgets = window.EphemeraWidgets?.listAvailableWidgets
            ? window.EphemeraWidgets.listAvailableWidgets()
            : [];
        const widgets = Array.isArray(rawWidgets) ? rawWidgets
            .filter((entry) => entry && entry.type)
            .sort((a, b) => {
                const sourceA = String(a.source || 'builtin');
                const sourceB = String(b.source || 'builtin');
                if (sourceA !== sourceB) {
                    return sourceA === 'builtin' ? -1 : 1;
                }
                return String(a.name || a.type).localeCompare(String(b.name || b.type));
            }) : [];

        if (widgets.length === 0) {
            this.showPopup(`
                <div style="font-size:0.85rem;color:var(--fg-secondary);margin-bottom:8px;">Add Widget</div>
                <div style="font-size:0.75rem;color:var(--fg-muted);">No widget definitions are currently available.</div>
            `, 'widgets');
            return;
        }

        this.showPopup(`
            <div style="font-size:0.85rem;color:var(--fg-secondary);margin-bottom:12px;">Add Widget</div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
                ${widgets.map(w => `
                    <div class="widget-option" data-type="${escapeAttr(w.type)}" style="
                        display:flex;align-items:center;gap:8px;padding:10px;
                        background:var(--bg-tertiary);border-radius:var(--radius-sm);
                        cursor:pointer;transition:all 0.15s;
                    ">
                        <span style="font-size:1.2rem;">${escapeHtml(w.icon || '🧩')}</span>
                        <div style="min-width:0;">
                            <div style="font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(w.name || w.type)}</div>
                            <div style="font-size:0.68rem;color:var(--fg-muted);text-transform:uppercase;">${escapeHtml(w.source || 'builtin')}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `, 'widgets');

        this._popup.querySelectorAll('.widget-option').forEach(el => {
            el.addEventListener('mouseenter', () => el.style.background = 'var(--bg-secondary)');
            el.addEventListener('mouseleave', () => el.style.background = 'var(--bg-tertiary)');
            el.addEventListener('click', () => {
                if (window.EphemeraWidgets) {
                    // Let the widget system pick a non-overlapping top-right placement.
                    EphemeraWidgets.add(el.dataset.type);
                    this.hidePopup();
                }
            });
        });
    },

    showQuickSettings() {
        const currentTheme = EphemeraState.settings.theme || 'dark';
        const currentAccent = EphemeraState.settings.accentColor || '#00d4aa';
        const soundsEnabled = EphemeraState.settings.soundsEnabled !== false;
        
        const accentColors = [
            { color: '#00d4aa', name: 'Teal' },
            { color: '#6366f1', name: 'Indigo' },
            { color: '#8b5cf6', name: 'Purple' },
            { color: '#ec4899', name: 'Pink' },
            { color: '#f59e0b', name: 'Amber' },
            { color: '#ef4444', name: 'Red' }
        ];

        this._popup.style.minWidth = '280px';
        this.showPopup(`
            <div style="font-size:0.9rem;font-weight:500;color:var(--fg-primary);margin-bottom:12px;">Quick Settings</div>
            
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <button class="qs-tile ${currentTheme === 'dark' ? 'active' : ''}" data-action="theme-dark" style="
                    flex:1;padding:16px;background:var(--bg-tertiary);border:1px solid var(--border);
                    border-radius:var(--radius-sm);cursor:pointer;text-align:center;
                    ${currentTheme === 'dark' ? 'border-color:var(--accent);background:rgba(0,212,170,0.1);' : ''}
                ">
                    <div style="font-size:1.5rem;margin-bottom:4px;">🌙</div>
                    <div style="font-size:0.7rem;color:var(--fg-secondary);">Dark</div>
                </button>
                <button class="qs-tile ${currentTheme === 'light' ? 'active' : ''}" data-action="theme-light" style="
                    flex:1;padding:16px;background:var(--bg-tertiary);border:1px solid var(--border);
                    border-radius:var(--radius-sm);cursor:pointer;text-align:center;
                    ${currentTheme === 'light' ? 'border-color:var(--accent);background:rgba(0,212,170,0.1);' : ''}
                ">
                    <div style="font-size:1.5rem;margin-bottom:4px;">☀️</div>
                    <div style="font-size:0.7rem;color:var(--fg-secondary);">Light</div>
                </button>
                <button class="qs-tile ${soundsEnabled ? 'active' : ''}" data-action="toggle-sounds" style="
                    flex:1;padding:16px;background:var(--bg-tertiary);border:1px solid var(--border);
                    border-radius:var(--radius-sm);cursor:pointer;text-align:center;
                    ${soundsEnabled ? 'border-color:var(--accent);background:rgba(0,212,170,0.1);' : ''}
                ">
                    <div style="font-size:1.5rem;margin-bottom:4px;">${soundsEnabled ? '🔊' : '🔇'}</div>
                    <div style="font-size:0.7rem;color:var(--fg-secondary);">Sound</div>
                </button>
            </div>

            <div style="margin-bottom:16px;">
                <div style="font-size:0.75rem;color:var(--fg-muted);margin-bottom:8px;">Accent Color</div>
                <div style="display:flex;gap:8px;justify-content:center;">
                    ${accentColors.map(c => `
                        <button class="qs-color" data-color="${c.color}" style="
                            width:32px;height:32px;border-radius:50%;border:3px solid ${c.color === currentAccent ? '#fff' : 'transparent'};
                            background:${c.color};cursor:pointer;transition:transform 0.15s;
                        " title="${c.name}"></button>
                    `).join('')}
                </div>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="qs-btn" data-action="settings" style="flex:1;min-width:100px;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-secondary);font-size:0.8rem;">
                    ⚙️ Settings
                </button>
                <button class="qs-btn" data-action="files" style="flex:1;min-width:100px;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-secondary);font-size:0.8rem;">
                    📁 Files
                </button>
            </div>

            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                <button class="qs-btn" data-action="terminal" style="flex:1;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-secondary);font-size:0.8rem;">
                    💻 Terminal
                </button>
                <button class="qs-btn" data-action="browser" style="flex:1;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-secondary);font-size:0.8rem;">
                    🌐 Browser
                </button>
            </div>
        `, 'quicksettings');

        this._popup.querySelectorAll('.qs-tile').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                if (!btn.classList.contains('active')) btn.style.background = 'var(--bg-secondary)';
            });
            btn.addEventListener('mouseleave', () => {
                if (!btn.classList.contains('active')) btn.style.background = 'var(--bg-tertiary)';
            });
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'theme-dark') {
                    EphemeraState.updateSetting('theme', 'dark');
                    document.documentElement.removeAttribute('data-theme');
                } else if (action === 'theme-light') {
                    EphemeraState.updateSetting('theme', 'light');
                    document.documentElement.setAttribute('data-theme', 'light');
                } else if (action === 'toggle-sounds') {
                    const newState = EphemeraState.settings.soundsEnabled !== false ? false : true;
                    EphemeraState.updateSetting('soundsEnabled', newState);
                }
                this.showQuickSettings();
            });
        });

        this._popup.querySelectorAll('.qs-color').forEach(btn => {
            btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
            btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                EphemeraState.updateSetting('accentColor', color);
                document.documentElement.style.setProperty('--accent', color);
                this.showQuickSettings();
            });
        });

        this._popup.querySelectorAll('.qs-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => btn.style.background = 'var(--bg-secondary)');
            btn.addEventListener('mouseleave', () => btn.style.background = 'var(--bg-tertiary)');
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.hidePopup();
                if (action === 'settings') EphemeraWM.open('settings');
                if (action === 'files') EphemeraWM.open('files');
                if (action === 'terminal') EphemeraWM.open('terminal');
                if (action === 'browser') EphemeraWM.open('browser');
            });
        });
    },

    async takeScreenshot() {
        this.hidePopup();
        
        if (!('getDisplayMedia' in navigator.mediaDevices)) {
            EphemeraNotifications.error('Screenshot Failed', 'Screen capture is not supported in this browser.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            stream.getTracks().forEach(track => track.stop());

            const dataUrl = canvas.toDataURL('image/png');
            const filename = `screenshot_${Date.now()}.png`;
            const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
            
            await EphemeraFS.writeFile(`${homeDir}/Pictures/${filename}`, dataUrl, { mimeType: 'image/png' });
            
            EphemeraNotifications.success('Screenshot Saved', `${filename} saved to Pictures.`);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Screenshot failed:', e);
                EphemeraNotifications.error('Screenshot Failed', 'Could not capture screen.');
            }
        }
    }
};

window.EphemeraSystemTray = EphemeraSystemTray;
