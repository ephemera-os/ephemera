EphemeraApps.register({
    id: 'settings',
    name: 'Settings',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
    width: 500,
    height: 550,
    category: 'system',
    content: (windowId, options = {}) => {
        return {
            html: `
                <style>
                    .settings-container { height:100%;display:flex;flex-direction:row; }
                    .settings-sidebar { width:180px;height:100%;background:rgba(0,0,0,0.2);border-right:1px solid var(--border);flex-shrink:0;overflow-y:auto; }
                    .settings-nav { padding:8px; }
                    .settings-nav-item { padding:10px 12px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.85rem;display:flex;align-items:center;gap:10px;margin-bottom:4px;transition:background 0.15s; }
                    .settings-nav-item:hover { background:rgba(255,255,255,0.05); }
                    .settings-nav-item.active { background:rgba(0,212,170,0.15);color:var(--accent); }
                    .settings-nav-item svg { width:16px;height:16px;opacity:0.7; }
                    .settings-content { flex:1;min-width:0;overflow-y:auto;padding:20px; }
                    .settings-section { margin-bottom:24px; }
                    .settings-section h3 { font-size:1.1rem;margin-bottom:16px; }
                    .settings-section h4 { font-size:0.9rem;color:var(--fg-secondary);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px; }
                    .settings-row { display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border); }
                    .settings-row:last-child { border-bottom:none; }
                    .settings-row-label { font-size:0.9rem; }
                    .settings-row-desc { font-size:0.75rem;color:var(--fg-muted);margin-top:4px; }
                    .settings-input { width:250px; }
                    .wallpaper-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px; }
                    .wallpaper-option { aspect-ratio:16/10;border-radius:var(--radius-md);cursor:pointer;border:2px solid transparent;transition:all 0.2s ease;overflow:hidden;position:relative; }
                    .wallpaper-option:hover { transform:scale(1.05); }
                    .wallpaper-option.selected { border-color:var(--accent);box-shadow:0 0 15px var(--accent-glow); }
                    .wallpaper-option.canvas { background:linear-gradient(135deg,#1a2a3a,#0f1a2a); }
                    .wallpaper-option.solid { background:var(--bg-primary); }
                    .wallpaper-option.gradient1 { background:linear-gradient(135deg,#0f0f1a,#1a0a2e); }
                    .wallpaper-option.gradient2 { background:linear-gradient(135deg,#0a1a1a,#0a2e1a); }
                    .wallpaper-option.gradient3 { background:linear-gradient(135deg,#1a0a0a,#2e1a0a); }
                    .wallpaper-option.gradient4 { background:linear-gradient(135deg,#0a0a1a,#1a2e3e); }
                    .wallpaper-label { position:absolute;bottom:0;left:0;right:0;padding:6px;background:rgba(0,0,0,0.7);font-size:0.7rem;text-align:center; }
                    .toggle { width:44px;height:24px;background:var(--bg-tertiary);border-radius:12px;position:relative;cursor:pointer;transition:background 0.2s; }
                    .toggle.on { background:var(--accent); }
                    .toggle::after { content:'';position:absolute;width:18px;height:18px;background:white;border-radius:50%;top:3px;left:3px;transition:transform 0.2s; }
                    .toggle.on::after { transform:translateX(20px); }
                    .trust-app-list { display:flex;flex-direction:column;gap:12px; }
                    .trust-app-card { padding:14px;background:rgba(0,0,0,0.2);border:1px solid var(--border);border-radius:var(--radius-md); }
                    .trust-app-header { display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px; }
                    .trust-app-title { font-size:0.92rem;font-weight:600; }
                    .trust-app-id { font-size:0.74rem;color:var(--fg-muted);margin-top:2px; }
                    .trust-permissions { display:flex;flex-direction:column;gap:8px; }
                    .trust-permission-row { display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04); }
                    .trust-permission-row:last-child { border-bottom:none; }
                    .trust-permission-name { font-size:0.84rem; }
                    .trust-permission-desc { font-size:0.72rem;color:var(--fg-muted);margin-top:3px; }
                </style>
                <div class="settings-container">
                    <div class="settings-sidebar">
                        <nav class="settings-nav">
                            <div class="settings-nav-item active" data-section="appearance">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                                Appearance
                            </div>
                            <div class="settings-nav-item" data-section="network">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                                Network
                            </div>
                            <div class="settings-nav-item" data-section="ai">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM7.5 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>
                                AI Assistant
                            </div>
                            <div class="settings-nav-item" data-section="notifications">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                                Notifications
                            </div>
                            <div class="settings-nav-item" data-section="data">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Data
                            </div>
                            <div class="settings-nav-item" data-section="observability">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>
                                Observability
                            </div>
                            <div class="settings-nav-item" data-section="trust">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z"/><path d="M9 12l2 2 4-4"/></svg>
                                Trust Center
                            </div>
                            <div class="settings-nav-item" data-section="sync">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
                                Cloud Sync
                            </div>
                            <div class="settings-nav-item" data-section="about">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                About
                            </div>
                        </nav>
                    </div>
                    <div class="settings-content" id="settings-content-${windowId}">
                        ${renderAppearanceSection(windowId)}
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const content = document.getElementById(`settings-content-${windowId}`);
                const container = content.closest('.window-content');

                const validSections = new Set([
                    'appearance',
                    'network',
                    'ai',
                    'notifications',
                    'data',
                    'observability',
                    'trust',
                    'sync',
                    'about'
                ]);

                const activateSection = (section) => {
                    const safeSection = validSections.has(section) ? section : 'appearance';
                    container.querySelectorAll('.settings-nav-item').forEach((item) => {
                        item.classList.toggle('active', item.dataset.section === safeSection);
                    });
                    content.innerHTML = renderSection(safeSection, windowId);
                    content.scrollTop = 0;
                    initSectionHandlers(safeSection, windowId, lifecycle);
                };

                container.querySelectorAll('.settings-nav-item').forEach(item => {
                    lifecycle.addListener(item, 'click', () => {
                        activateSection(item.dataset.section);
                    });
                });

                const initialSection = validSections.has(String(options.section || ''))
                    ? String(options.section)
                    : 'appearance';
                activateSection(initialSection);

                lifecycle.addSubscription(
                    EphemeraEvents.on('settings:navigate', ({ windowId: targetWindowId, section }) => {
                        if (targetWindowId !== windowId) return;
                        activateSection(section);
                    })
                );

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});

function renderSection(section, windowId) {
    switch (section) {
        case 'appearance': return renderAppearanceSection(windowId);
        case 'network': return renderNetworkSection(windowId);
        case 'ai': return renderAISection(windowId);
        case 'notifications': return renderNotificationsSection(windowId);
        case 'data': return renderDataSection(windowId);
        case 'observability': return renderObservabilitySection(windowId);
        case 'trust': return renderTrustSection(windowId);
        case 'sync': return renderSyncSection(windowId);
        case 'about': return renderAboutSection(windowId);
        default: return '';
    }
}

function settingsT(key, fallback, params = {}) {
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
}

function settingsEscapeHtml(value) {
    if (window.EphemeraSanitize?.escapeHtml) {
        return window.EphemeraSanitize.escapeHtml(value);
    }
    return String(value || '');
}

function settingsEscapeAttr(value) {
    if (window.EphemeraSanitize?.escapeAttr) {
        return window.EphemeraSanitize.escapeAttr(value);
    }
    return String(value || '');
}

function settingsFormatBytes(bytes) {
    if (window.EphemeraStorageQuota?.formatBytes) {
        return window.EphemeraStorageQuota.formatBytes(bytes);
    }
    if (window.EphemeraDataManagement?.formatBytes) {
        return window.EphemeraDataManagement.formatBytes(bytes);
    }
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
    const scaled = value / Math.pow(1024, index);
    return `${scaled.toFixed(scaled >= 100 || index === 0 ? 0 : 2)} ${units[index]}`;
}

function renderQuotaStatusCard(summary) {
    if (!summary) {
        return '<div style="color:var(--fg-muted);">Quota data unavailable in this browser.</div>';
    }

    const ratio = Number.isFinite(summary.usageRatio)
        ? Math.max(0, Math.min(1, summary.usageRatio))
        : 0;
    const percent = Number.isFinite(summary.usagePercent)
        ? Math.max(0, Math.min(100, summary.usagePercent))
        : ratio * 100;
    const tone = summary.overThreshold
        ? 'var(--danger)'
        : (ratio >= 0.6 ? 'var(--warning)' : 'var(--accent)');

    return `
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:var(--fg-secondary);">Used</span>
            <span style="color:var(--fg-primary);">${settingsEscapeHtml(settingsFormatBytes(summary.usageBytes))}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:var(--fg-secondary);">Quota</span>
            <span style="color:var(--fg-primary);">${settingsEscapeHtml(settingsFormatBytes(summary.quotaBytes))}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:var(--fg-secondary);">Free</span>
            <span style="color:var(--fg-primary);">${settingsEscapeHtml(settingsFormatBytes(summary.freeBytes))}</span>
        </div>
        <div style="height:10px;background:rgba(255,255,255,0.08);border:1px solid var(--border);border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${percent.toFixed(2)}%;background:${tone};transition:width 0.25s ease;"></div>
        </div>
        <div style="margin-top:8px;font-size:0.78rem;color:${summary.overThreshold ? 'var(--danger)' : 'var(--fg-muted)'};">
            ${percent.toFixed(1)}% used${summary.overThreshold ? ' (above warning threshold)' : ''}
        </div>
    `;
}

function renderAppearanceSection(windowId) {
    const currentTheme = EphemeraState.settings.theme || 'dark';
    const currentAccent = EphemeraState.settings.accentColor || '#00d4aa';
    const soundsEnabled = EphemeraState.settings.sounds !== false;
    const editorEngineMeta = window.EphemeraEditorEngine?.getMetadata?.() || null;
    const editorBackends = (editorEngineMeta?.availableBackends || window.EphemeraEditorEngine?.getAvailableBackends?.() || [
        { id: 'cm5', name: 'CodeMirror 5', available: true, reason: '' }
    ]).slice();
    const requestedEditorEngine = String(editorEngineMeta?.requested || EphemeraState.settings.editorEngine || 'cm5').toLowerCase();
    const activeEditorEngine = String(editorEngineMeta?.id || requestedEditorEngine || 'cm5').toLowerCase();
    const selectedEditorEngine = editorBackends.some((backend) => String(backend.id || '').toLowerCase() === requestedEditorEngine)
        ? requestedEditorEngine
        : activeEditorEngine;
    const activeEditorBackend = editorBackends.find((backend) => String(backend.id || '').toLowerCase() === activeEditorEngine)
        || { id: activeEditorEngine, name: activeEditorEngine.toUpperCase(), available: true, reason: '' };
    const requestedUnavailable = requestedEditorEngine !== activeEditorEngine;
    const editorEngineStatus = requestedUnavailable
        ? `Requested ${requestedEditorEngine.toUpperCase()} is unavailable in this build. Active: ${activeEditorBackend.name}.`
        : `Active: ${activeEditorBackend.name}. New editor tabs will use this engine.`;
    const currentLocale = window.EphemeraI18n?.normalizeLocale?.(
        window.EphemeraI18n?.getLocale?.() || EphemeraState.settings.locale || 'en'
    ) || String(EphemeraState.settings.locale || 'en').toLowerCase();
    const locales = (window.EphemeraI18n?.getAvailableLocales?.() || [{ code: 'en', name: 'English', nativeName: 'English' }])
        .slice()
        .sort((a, b) => String(a.nativeName || a.name || a.code).localeCompare(String(b.nativeName || b.name || b.code)));
    const languageLabel = settingsT('settings.language_label', 'Language & Region');
    const languageDescription = settingsT(
        'settings.language_description',
        'Choose display language for desktop and core system UI.'
    );
    return `
        <div class="settings-section">
            <h3>Appearance</h3>
            <h4>Theme</h4>
            <div class="settings-row">
                <div>
                    <div class="settings-row-label">Dark / Light Mode</div>
                    <div class="settings-row-desc">Switch between dark and light themes</div>
                </div>
                <div class="toggle ${currentTheme === 'light' ? 'on' : ''}" id="theme-toggle-${windowId}"></div>
            </div>
            <h4 style="margin-top:16px;">Accent Color</h4>
            <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;" id="accent-colors-${windowId}">
                ${['#00d4aa','#00a8ff','#a855f7','#ff4d6a','#ffb84d','#4ade80'].map(c =>
                    `<div class="accent-option" data-color="${c}" style="width:36px;height:36px;border-radius:50%;background:${c};cursor:pointer;border:3px solid ${c === currentAccent ? 'white' : 'transparent'};transition:border 0.2s;"></div>`
                ).join('')}
            </div>
            <h4 style="margin-top:16px;">Sounds</h4>
            <div class="settings-row">
                <div>
                    <div class="settings-row-label">System Sounds</div>
                    <div class="settings-row-desc">Play sounds for window events</div>
                </div>
                <div class="toggle ${soundsEnabled ? 'on' : ''}" id="sounds-toggle-${windowId}"></div>
            </div>
            <h4 style="margin-top:16px;">${settingsEscapeHtml(languageLabel)}</h4>
            <div class="settings-row">
                <div>
                    <div class="settings-row-label">${settingsEscapeHtml(languageLabel)}</div>
                    <div class="settings-row-desc">${settingsEscapeHtml(languageDescription)}</div>
                </div>
                <select id="locale-select-${windowId}" class="settings-input" style="width:240px;">
                    ${locales.map((locale) => {
                        const code = String(locale.code || '').toLowerCase();
                        const nativeName = String(locale.nativeName || locale.name || code);
                        const englishName = String(locale.name || nativeName);
                        const label = nativeName === englishName
                            ? nativeName
                            : `${nativeName} (${englishName})`;
                        return `<option value="${settingsEscapeAttr(code)}" ${code === currentLocale ? 'selected' : ''}>${settingsEscapeHtml(label)}</option>`;
                    }).join('')}
                </select>
            </div>
            <h4 style="margin-top:16px;">Code Editor Engine</h4>
            <div class="settings-row" style="align-items:flex-start;">
                <div>
                    <div class="settings-row-label">Editor Backend</div>
                    <div class="settings-row-desc" id="editor-engine-status-${windowId}">${settingsEscapeHtml(editorEngineStatus)}</div>
                </div>
                <select id="editor-engine-select-${windowId}" class="settings-input" style="width:240px;">
                    ${editorBackends.map((backend) => {
                        const id = String(backend.id || '').toLowerCase();
                        const available = backend.available !== false;
                        const reason = String(backend.reason || '').trim();
                        const label = `${backend.name}${available ? '' : ' (Unavailable)'}`;
                        const title = available
                            ? `${backend.name}`
                            : `${backend.name} - ${reason || 'Not available in this build'}`;
                        const selected = id === selectedEditorEngine ? 'selected' : '';
                        const disabled = available ? '' : 'disabled';
                        return `<option value="${settingsEscapeAttr(id)}" title="${settingsEscapeAttr(title)}" ${selected} ${disabled}>${settingsEscapeHtml(label)}</option>`;
                    }).join('')}
                </select>
            </div>
            <h4 style="margin-top:16px;">Wallpaper</h4>
            <div class="wallpaper-grid">
                <div class="wallpaper-option canvas ${EphemeraState.wallpaper === 'particles' ? 'selected' : ''}" data-wallpaper="particles">
                    <span class="wallpaper-label">Particles</span>
                </div>
                <div class="wallpaper-option solid ${EphemeraState.wallpaper === 'solid' ? 'selected' : ''}" data-wallpaper="solid">
                    <span class="wallpaper-label">Solid Dark</span>
                </div>
                <div class="wallpaper-option gradient1 ${EphemeraState.wallpaper === 'gradient1' ? 'selected' : ''}" data-wallpaper="gradient1">
                    <span class="wallpaper-label">Purple Night</span>
                </div>
                <div class="wallpaper-option gradient2 ${EphemeraState.wallpaper === 'gradient2' ? 'selected' : ''}" data-wallpaper="gradient2">
                    <span class="wallpaper-label">Forest</span>
                </div>
                <div class="wallpaper-option gradient3 ${EphemeraState.wallpaper === 'gradient3' ? 'selected' : ''}" data-wallpaper="gradient3">
                    <span class="wallpaper-label">Warm</span>
                </div>
                <div class="wallpaper-option gradient4 ${EphemeraState.wallpaper === 'gradient4' ? 'selected' : ''}" data-wallpaper="gradient4">
                    <span class="wallpaper-label">Ocean</span>
                </div>
            </div>
        </div>
        <div class="settings-section">
            <h4>Workspaces</h4>
            <p style="color:var(--fg-secondary);font-size:0.85rem;line-height:1.6;">
                Use <strong style="color:var(--accent);">Ctrl + 1-4</strong> to switch workspaces,
                <strong style="color:var(--accent);">Ctrl + Shift + 1-4</strong> to move the active window,
                and <strong style="color:var(--accent);">Super/Cmd + Tab</strong> for workspace overview.
            </p>
        </div>
    `;
}

function renderNetworkSection(windowId) {
    const backendEnabled = EphemeraState.settings.terminalBackendEnabled === true;
    const backendUrl = String(EphemeraState.settings.terminalBackendUrl || '');

    return `
        <div class="settings-section">
            <h3>Network</h3>
            <h4>CORS Proxy Settings</h4>
            <p style="color:var(--fg-secondary);font-size:0.8rem;margin-bottom:16px;">
                Due to browser security, cross-origin requests require a proxy.
                Configure your proxy server or use a public one.
            </p>
            <div class="settings-row">
                <div>
                    <div class="settings-row-label">Enable Proxy</div>
                    <div class="settings-row-desc">Route requests through a CORS proxy</div>
                </div>
                <div class="toggle ${EphemeraState.settings.proxyEnabled ? 'on' : ''}" id="proxy-toggle-${windowId}"></div>
            </div>
            <div class="settings-row" style="flex-direction:column;align-items:stretch;">
                <div class="settings-row-label" style="margin-bottom:8px;">Proxy URL</div>
                <input type="text" class="settings-input" id="proxy-url-${windowId}" 
                    value="${EphemeraState.settings.proxyUrl}" 
                    placeholder="https://api.allorigins.win/raw?url="
                    style="width:100%;">
                <div class="settings-row-desc" style="margin-top:8px;">
                    Common proxies: allorigins.win, corsproxy.io, or your own server
                </div>
            </div>

            <h4 style="margin-top:18px;">Real Terminal Backend (Optional)</h4>
            <p style="color:var(--fg-secondary);font-size:0.8rem;margin-bottom:12px;line-height:1.5;">
                Connect Terminal to a self-hosted WebSocket PTY service. If disabled or unavailable,
                Ephemera automatically falls back to the built-in simulated terminal.
            </p>
            <div class="settings-row">
                <div>
                    <div class="settings-row-label">Enable Real Terminal Backend</div>
                    <div class="settings-row-desc">Use remote shell commands via WebSocket</div>
                </div>
                <div class="toggle ${backendEnabled ? 'on' : ''}" id="terminal-backend-toggle-${windowId}"></div>
            </div>
            <div class="settings-row" style="flex-direction:column;align-items:stretch;">
                <div class="settings-row-label" style="margin-bottom:8px;">Terminal Backend URL</div>
                <input type="text" class="settings-input" id="terminal-backend-url-${windowId}" 
                    value="${settingsEscapeAttr(backendUrl)}"
                    placeholder="ws://localhost:8787/terminal"
                    style="width:100%;">
                <div class="settings-row-desc" style="margin-top:8px;">
                    Example: <code>ws://localhost:8787/terminal</code> (local) or <code>wss://terminal.example.com/ws</code> (TLS)
                </div>
            </div>
            <div style="margin-top:10px;">
                <button class="btn" id="terminal-backend-test-${windowId}">Test Terminal Backend</button>
            </div>
            <div style="margin-top:16px;">
                <button class="btn" id="save-network-${windowId}">Save Network Settings</button>
            </div>
        </div>
    `;
}

function renderNotificationsSection(windowId) {
    return `
        <div class="settings-section">
            <h3>Notifications</h3>
            <div class="settings-row">
                <div>
                    <div class="settings-row-label">Enable Notifications</div>
                    <div class="settings-row-desc">Show system notifications</div>
                </div>
                <div class="toggle ${EphemeraState.settings.notifications ? 'on' : ''}" id="notif-toggle-${windowId}"></div>
            </div>
        </div>
    `;
}

function renderAISection(windowId) {
    const provider = (typeof EphemeraAI.getProvider === 'function')
        ? EphemeraAI.getProvider()
        : (EphemeraState.settings.aiProvider || 'openrouter');
    const providerConfiguredKey = provider === 'openai'
        ? EphemeraState.settings.openaiApiKey
        : provider === 'anthropic'
            ? EphemeraState.settings.anthropicApiKey
            : provider === 'google'
                ? EphemeraState.settings.googleApiKey
                : EphemeraState.settings.openrouterApiKey;
    const hasKey = !!providerConfiguredKey;
    const maxTokens = EphemeraState.settings.aiMaxTokens || 8192;
    const temperature = EphemeraState.settings.aiTemperature ?? 0.7;
    const currentModel = EphemeraState.settings.aiModel
        || (typeof EphemeraAI.getModelForUseCase === 'function'
            ? EphemeraAI.getModelForUseCase('default', provider)
            : EphemeraAI.getDefaultModel());
    const modelByUseCase = {
        chat: EphemeraState.settings.aiModelChat || currentModel,
        code: EphemeraState.settings.aiModelCode || currentModel,
        terminal: EphemeraState.settings.aiModelTerminal || currentModel,
        quickActions: EphemeraState.settings.aiModelQuickActions || currentModel,
        appBuilder: EphemeraState.settings.aiModelAppBuilder || currentModel,
        fileSearch: EphemeraState.settings.aiModelFileSearch || currentModel
    };
    const sessionUsage = typeof EphemeraAI.getSessionUsage === 'function'
        ? EphemeraAI.getSessionUsage()
        : { requests: 0, totalTokens: 0, estimatedCostUsd: 0 };
    const providerKeyLabel = provider === 'openai'
        ? 'OpenAI API Key'
        : provider === 'anthropic'
            ? 'Anthropic API Key'
            : provider === 'google'
                ? 'Google AI API Key'
                : 'OpenRouter API Key';
    const providerKeyPlaceholder = provider === 'openai'
        ? 'sk-...'
        : provider === 'anthropic'
            ? 'sk-ant-...'
            : provider === 'google'
                ? 'AIza...'
                : 'sk-or-...';
    const providerKeyHint = provider === 'openai'
        ? 'Get key from platform.openai.com/api-keys'
        : provider === 'anthropic'
            ? 'Get key from console.anthropic.com/settings/keys'
            : provider === 'google'
                ? 'Get key from aistudio.google.com/app/apikey'
                : 'Get key from openrouter.ai/keys';
    return `
        <div class="settings-section">
            <h3>AI Assistant</h3>
            <p style="color:var(--fg-secondary);font-size:0.85rem;margin-bottom:16px;">
                Configure provider keys, choose models per use-case, and monitor token/cost usage for this session.
            </p>

            <div class="settings-row">
                <div>
                    <div class="settings-row-label">Provider</div>
                    <div class="settings-row-desc">Select the active provider for AI requests</div>
                </div>
                <select id="ai-provider-${windowId}" style="width:220px;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.85rem;">
                    <option value="openrouter" ${provider === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
                    <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                    <option value="anthropic" ${provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                    <option value="google" ${provider === 'google' ? 'selected' : ''}>Google AI</option>
                    <option value="chatgpt" ${provider === 'chatgpt' ? 'selected' : ''}>ChatGPT Plus/Pro</option>
                </select>
            </div>
            
            <div id="ai-apikey-section-${windowId}" class="settings-row" style="flex-direction:column;align-items:stretch;">
                <div class="settings-row-label" id="ai-key-label-${windowId}" style="margin-bottom:8px;">${providerKeyLabel}</div>
                <div style="display:flex;gap:8px;">
                    <input type="password" id="ai-key-${windowId}"
                        value=""
                        placeholder="${providerKeyPlaceholder}"
                        style="flex:1;">
                    <button class="btn btn-sm" id="toggle-key-visibility-${windowId}">Show</button>
                </div>
                <div class="settings-row-desc" style="margin-top:8px;">
                    <span id="ai-key-status-${windowId}">${hasKey ? '<span style="color:var(--accent);">API key configured</span>' : `Enter your ${providerKeyLabel} to enable AI features`}</span><br>
                    <span id="ai-key-hint-${windowId}" style="color:var(--fg-muted);font-size:0.78rem;">${providerKeyHint}</span>
                </div>
            </div>

            <div id="ai-oauth-section-${windowId}" class="settings-row" style="flex-direction:column;align-items:stretch;display:none;">
                <div class="settings-row-label" style="margin-bottom:8px;">ChatGPT Account</div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <button class="btn" id="ai-oauth-login-${windowId}" style="flex:0 0 auto;">Connect ChatGPT</button>
                    <button class="btn btn-sm" id="ai-oauth-disconnect-${windowId}" style="flex:0 0 auto;display:none;">Disconnect</button>
                </div>
                <div class="settings-row-desc" style="margin-top:8px;">
                    <span id="ai-oauth-status-${windowId}" style="color:var(--fg-secondary);">Not connected</span><br>
                    <span style="color:var(--fg-muted);font-size:0.78rem;">Uses an anonymous server-side session. Tokens stay on the server.</span>
                </div>
            </div>

            <div class="settings-row" style="flex-direction:column;align-items:stretch;margin-top:16px;">
                <div class="settings-row-label" style="margin-bottom:8px;">Default Model</div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <select id="ai-model-default-${windowId}" style="flex:1;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.85rem;">
                        <option value="${currentModel}">${currentModel}</option>
                    </select>
                    <button class="btn btn-sm" id="refresh-models-${windowId}" title="Refresh model list">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 12a9 9 0 11-6.22-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
                    </button>
                </div>
                <div class="settings-row-desc" style="margin-top:8px;">
                    <span id="models-status-${windowId}">${hasKey ? 'Click refresh to load models' : 'Enter API key to load models'}</span>
                </div>
            </div>

            <div class="settings-row">
                <div class="settings-row-label">Chat Model</div>
                <select id="ai-model-chat-${windowId}" style="width:320px;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.85rem;">
                    <option value="${modelByUseCase.chat}">${modelByUseCase.chat}</option>
                </select>
            </div>

            <div class="settings-row">
                <div class="settings-row-label">Code Assistant Model</div>
                <select id="ai-model-code-${windowId}" style="width:320px;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.85rem;">
                    <option value="${modelByUseCase.code}">${modelByUseCase.code}</option>
                </select>
            </div>

            <div class="settings-row">
                <div class="settings-row-label">Terminal Model</div>
                <select id="ai-model-terminal-${windowId}" style="width:320px;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.85rem;">
                    <option value="${modelByUseCase.terminal}">${modelByUseCase.terminal}</option>
                </select>
            </div>

            <div class="settings-row">
                <div class="settings-row-label">Quick Actions Model</div>
                <select id="ai-model-quickactions-${windowId}" style="width:320px;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.85rem;">
                    <option value="${modelByUseCase.quickActions}">${modelByUseCase.quickActions}</option>
                </select>
            </div>

            <div class="settings-row">
                <div class="settings-row-label">App Builder Model</div>
                <select id="ai-model-appbuilder-${windowId}" style="width:320px;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.85rem;">
                    <option value="${modelByUseCase.appBuilder}">${modelByUseCase.appBuilder}</option>
                </select>
            </div>

            <div class="settings-row">
                <div class="settings-row-label">File Search Model</div>
                <select id="ai-model-filesearch-${windowId}" style="width:320px;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.85rem;">
                    <option value="${modelByUseCase.fileSearch}">${modelByUseCase.fileSearch}</option>
                </select>
            </div>
             
            <h4 style="margin-top:20px;">Generation Parameters</h4>
            
            <div class="settings-row" style="flex-direction:column;align-items:stretch;margin-top:12px;">
                <div class="settings-row-label" style="margin-bottom:8px;">Max Tokens: <span id="max-tokens-value-${windowId}">${maxTokens}</span></div>
                <input type="range" id="ai-max-tokens-${windowId}" 
                    value="${maxTokens}" 
                    min="2048" 
                    max="128000" 
                    step="1024"
                    style="width:100%;">
                <div class="settings-row-desc" style="margin-top:8px;">
                    Maximum tokens in the response (higher = longer responses)
                </div>
            </div>
            
            <div class="settings-row" style="flex-direction:column;align-items:stretch;margin-top:12px;">
                <div class="settings-row-label" style="margin-bottom:8px;">Temperature: <span id="temperature-value-${windowId}">${temperature}</span></div>
                <input type="range" id="ai-temperature-${windowId}" 
                    value="${temperature}" 
                    min="0" 
                    max="2" 
                    step="0.1"
                    style="width:100%;">
                <div class="settings-row-desc" style="margin-top:8px;">
                    Controls randomness (0 = focused, 2 = creative)
                </div>
            </div>

            <h4 style="margin-top:20px;">Session Usage</h4>
            <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-tertiary);margin-top:10px;">
                <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div>Requests: <strong id="ai-usage-requests-${windowId}">${sessionUsage.requests || 0}</strong></div>
                    <div>Total Tokens: <strong id="ai-usage-tokens-${windowId}">${sessionUsage.totalTokens || 0}</strong></div>
                    <div>Estimated Cost (USD): <strong id="ai-usage-cost-${windowId}">$${Number(sessionUsage.estimatedCostUsd || 0).toFixed(4)}</strong></div>
                </div>
                <div style="margin-top:10px;">
                    <button class="btn btn-sm" id="ai-reset-usage-${windowId}">Reset Session Usage</button>
                </div>
            </div>
             
            <div style="margin-top:20px;">
                <button class="btn primary" id="save-ai-${windowId}">Save AI Settings</button>
                <button class="btn" id="test-ai-${windowId}" style="margin-left:8px;">Test Connection</button>
            </div>
            
            <div id="ai-test-result-${windowId}" style="margin-top:16px;padding:12px;border-radius:var(--radius-md);display:none;"></div>
        </div>
    `;
}

const TRUST_PERMISSIONS = [
    { id: 'fs', name: 'File System', description: 'Read and write files in your profile storage' },
    { id: 'network', name: 'Network', description: 'Make outbound HTTP requests' },
    { id: 'events', name: 'Events', description: 'Publish system events' },
    { id: 'windows', name: 'Window Control', description: 'Open and close app windows' },
    { id: 'notifications', name: 'Notifications', description: 'Display system notifications' },
    { id: 'dialogs', name: 'Dialogs', description: 'Open alert/confirm/prompt dialogs' },
    { id: 'storage', name: 'Storage API', description: 'Read and write app metadata storage' }
];

function renderTrustSection(_windowId) {
    const userApps = (window.EphemeraApps?.getUserApps?.() || [])
        .sort((a, b) => a.name.localeCompare(b.name));
    const esc = window.EphemeraSanitize ? window.EphemeraSanitize.escapeHtml : (s => String(s));
    const escA = window.EphemeraSanitize ? window.EphemeraSanitize.escapeAttr : (s => String(s));

    return `
        <div class="settings-section">
            <h3>Trust Center</h3>
            <p style="color:var(--fg-secondary);font-size:0.85rem;line-height:1.6;margin-bottom:14px;">
                User apps are treated as untrusted by default. Grant only the minimum permissions needed.
                Changes apply immediately. Denied API calls can request one-time or permanent access at runtime.
            </p>
            ${userApps.length === 0 ? `
                <div style="padding:16px;background:rgba(0,0,0,0.2);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--fg-muted);font-size:0.84rem;">
                    No user apps installed yet.
                </div>
            ` : `
                <div class="trust-app-list">
                    ${userApps.map(app => {
                        const permissions = new Set(window.EphemeraApps.getAppPermissions(app.id));
                        return `
                            <div class="trust-app-card" data-app-id="${escA(app.id)}">
                                <div class="trust-app-header">
                                    <div>
                                        <div class="trust-app-title">${esc(app.name)}</div>
                                        <div class="trust-app-id">${esc(app.id)}</div>
                                    </div>
                                    <button class="btn btn-sm trust-revoke-all" data-app-id="${escA(app.id)}">Revoke All</button>
                                </div>
                                <div class="trust-permissions">
                                    ${TRUST_PERMISSIONS.map(permission => `
                                        <div class="trust-permission-row">
                                            <div>
                                                <div class="trust-permission-name">${esc(permission.name)}</div>
                                                <div class="trust-permission-desc">${esc(permission.description)}</div>
                                            </div>
                                            <div class="toggle trust-toggle ${permissions.has(permission.id) ? 'on' : ''}"
                                                data-app-id="${escA(app.id)}"
                                                data-permission="${escA(permission.id)}"
                                                role="switch"
                                                tabindex="0"
                                                aria-checked="${permissions.has(permission.id) ? 'true' : 'false'}"></div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
            <div style="margin-top:16px;padding:12px;background:rgba(255,184,77,0.08);border:1px solid rgba(255,184,77,0.3);border-radius:var(--radius-md);font-size:0.78rem;color:var(--warning);line-height:1.5;">
                Revoking a permission blocks future API calls immediately. Running apps do not need to be restarted.
            </div>
        </div>
    `;
}

function renderAboutSection(windowId) {
    return `
        <div class="settings-section">
            <h3>About Ephemera</h3>
            <div style="padding:20px;background:rgba(0,0,0,0.2);border-radius:var(--radius-md);margin-bottom:20px;">
                <h2 style="font-size:2rem;background:linear-gradient(135deg,var(--accent),#00a8ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px;">Ephemera</h2>
                <p style="color:var(--fg-secondary);">Version 2.0</p>
            </div>
            <p style="color:var(--fg-secondary);font-size:0.9rem;line-height:1.6;margin-bottom:16px;">
                A browser-based operating system with a full virtual file system, 
                network capabilities, and app development platform.
            </p>
            <h4>Features</h4>
            <ul style="color:var(--fg-secondary);font-size:0.85rem;line-height:1.8;padding-left:20px;">
                <li>IndexedDB-based virtual file system</li>
                <li>Code editor with syntax highlighting</li>
                <li>Web browser with CORS proxy support</li>
                <li>Sandboxed app execution</li>
                <li>Multiple workspaces</li>
                <li>Terminal with filesystem commands</li>
                <li>Window snapping</li>
            </ul>
            <h4 style="margin-top:20px;">System Info</h4>
            <div style="font-family:var(--font-mono);font-size:0.8rem;color:var(--fg-muted);background:rgba(0,0,0,0.2);padding:12px;border-radius:var(--radius-sm);">
                <div>Resolution: ${window.innerWidth} x ${window.innerHeight}</div>
                <div>User Agent: ${navigator.userAgent.split(' ').slice(-1)}</div>
                <div>Platform: ${navigator.platform}</div>
            </div>
            <h4 style="margin-top:20px;">Storage Quota</h4>
            <p style="color:var(--fg-secondary);font-size:0.85rem;margin-bottom:8px;">
                Browser storage is shared with this origin quota. Monitor usage to avoid eviction.
            </p>
            <div id="about-storage-quota-${windowId}" style="background:rgba(0,0,0,0.2);padding:12px;border-radius:var(--radius-sm);margin-bottom:10px;">
                <div style="color:var(--fg-muted);">Loading quota details...</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn" id="about-storage-refresh-${windowId}">Refresh Quota</button>
                <button class="btn" id="about-storage-persist-${windowId}">Request Persistent Storage</button>
            </div>
            <div id="about-storage-persist-status-${windowId}" style="margin-top:8px;font-size:0.78rem;color:var(--fg-muted);"></div>
            <h4 style="margin-top:24px;">Legal</h4>
            <div style="display:flex;gap:16px;margin-top:12px;">
                <a href="/privacy.html" target="_blank" style="color:var(--accent);font-size:0.9rem;">Privacy Policy</a>
                <a href="/terms.html" target="_blank" style="color:var(--accent);font-size:0.9rem;">Terms of Service</a>
            </div>
        </div>
    `;
}

function settingsFormatMetricMs(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return `${numeric.toFixed(2)} ms`;
}

function settingsFormatTimestamp(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 'Never';
    return new Date(numeric).toLocaleString();
}

function renderObservabilityRows(entries) {
    if (!entries.length) {
        return `
            <tr>
                <td colspan="6" style="padding:12px;color:var(--fg-muted);font-size:0.8rem;text-align:center;">
                    No performance metrics captured yet.
                </td>
            </tr>
        `;
    }

    return entries.map((entry) => `
        <tr data-metric="${settingsEscapeAttr(entry.metric)}" style="border-top:1px solid rgba(255,255,255,0.06);">
            <td style="padding:8px 10px;font-family:var(--font-mono);font-size:0.74rem;color:var(--fg-primary);">${settingsEscapeHtml(entry.metric)}</td>
            <td style="padding:8px 10px;text-align:right;color:var(--fg-secondary);font-size:0.78rem;">${settingsEscapeHtml(String(entry.count || 0))}</td>
            <td style="padding:8px 10px;text-align:right;color:var(--fg-secondary);font-size:0.78rem;">${settingsEscapeHtml(settingsFormatMetricMs(entry.p50Ms))}</td>
            <td style="padding:8px 10px;text-align:right;color:var(--fg-secondary);font-size:0.78rem;">${settingsEscapeHtml(settingsFormatMetricMs(entry.p95Ms))}</td>
            <td style="padding:8px 10px;text-align:right;color:var(--fg-secondary);font-size:0.78rem;">${settingsEscapeHtml(settingsFormatMetricMs(entry.p99Ms))}</td>
            <td style="padding:8px 10px;color:var(--fg-muted);font-size:0.75rem;">${settingsEscapeHtml(settingsFormatTimestamp(entry.updatedAt))}</td>
        </tr>
    `).join('');
}

function renderObservabilitySection(windowId) {
    const performanceApi = window.EphemeraPerformance || null;
    const metrics = performanceApi?.getAllMetrics ? performanceApi.getAllMetrics() : {};
    const entries = Object.values(metrics).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    const lastUpdated = entries.length > 0
        ? settingsFormatTimestamp(Math.max(...entries.map((entry) => Number(entry.updatedAt || 0))))
        : 'Never';
    const performanceEnabled = performanceApi?.isEnabled
        ? performanceApi.isEnabled() === true
        : false;
    const telemetryEnabled = window.EphemeraTelemetry?.isEnabled
        ? window.EphemeraTelemetry.isEnabled() === true
        : false;

    return `
        <div class="settings-section">
            <h3>Observability</h3>
            <p style="color:var(--fg-secondary);font-size:0.85rem;line-height:1.6;margin-bottom:14px;">
                Live performance metrics with percentile summaries for critical runtime flows.
                Analytics remains opt-in and is currently disabled by policy.
            </p>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px;">
                <div style="padding:10px;background:rgba(0,0,0,0.25);border:1px solid var(--border);border-radius:var(--radius-sm);">
                    <div style="font-size:0.72rem;color:var(--fg-muted);text-transform:uppercase;letter-spacing:0.08em;">Performance Monitor</div>
                    <div id="obs-performance-status-${windowId}" style="margin-top:6px;font-size:0.84rem;color:${performanceEnabled ? 'var(--accent)' : 'var(--danger)'};">${performanceEnabled ? 'Enabled' : 'Disabled'}</div>
                </div>
                <div style="padding:10px;background:rgba(0,0,0,0.25);border:1px solid var(--border);border-radius:var(--radius-sm);">
                    <div style="font-size:0.72rem;color:var(--fg-muted);text-transform:uppercase;letter-spacing:0.08em;">Telemetry</div>
                    <div id="obs-telemetry-status-${windowId}" style="margin-top:6px;font-size:0.84rem;color:${telemetryEnabled ? 'var(--accent)' : 'var(--warning)'};">${telemetryEnabled ? 'Enabled' : 'Disabled'}</div>
                </div>
                <div style="padding:10px;background:rgba(0,0,0,0.25);border:1px solid var(--border);border-radius:var(--radius-sm);">
                    <div style="font-size:0.72rem;color:var(--fg-muted);text-transform:uppercase;letter-spacing:0.08em;">Tracked Metrics</div>
                    <div id="obs-metrics-count-${windowId}" style="margin-top:6px;font-size:0.88rem;color:var(--fg-primary);">${entries.length}</div>
                </div>
                <div style="padding:10px;background:rgba(0,0,0,0.25);border:1px solid var(--border);border-radius:var(--radius-sm);">
                    <div style="font-size:0.72rem;color:var(--fg-muted);text-transform:uppercase;letter-spacing:0.08em;">Last Update</div>
                    <div id="obs-last-updated-${windowId}" style="margin-top:6px;font-size:0.78rem;color:var(--fg-secondary);">${settingsEscapeHtml(lastUpdated)}</div>
                </div>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
                <button class="btn btn-sm" id="obs-refresh-${windowId}">Refresh Metrics</button>
                <button class="btn btn-sm" id="obs-export-${windowId}">Export Snapshot</button>
                <button class="btn btn-sm" id="obs-clear-${windowId}">Reset Metrics</button>
            </div>

            <div id="obs-status-${windowId}" style="font-size:0.76rem;color:var(--fg-muted);margin-bottom:8px;">
                Showing ${entries.length} tracked metric${entries.length === 1 ? '' : 's'}.
            </div>

            <div style="border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;background:rgba(0,0,0,0.2);">
                    <thead>
                        <tr style="background:rgba(255,255,255,0.03);">
                            <th style="text-align:left;padding:9px 10px;font-size:0.72rem;color:var(--fg-muted);font-weight:600;">Metric</th>
                            <th style="text-align:right;padding:9px 10px;font-size:0.72rem;color:var(--fg-muted);font-weight:600;">Count</th>
                            <th style="text-align:right;padding:9px 10px;font-size:0.72rem;color:var(--fg-muted);font-weight:600;">p50</th>
                            <th style="text-align:right;padding:9px 10px;font-size:0.72rem;color:var(--fg-muted);font-weight:600;">p95</th>
                            <th style="text-align:right;padding:9px 10px;font-size:0.72rem;color:var(--fg-muted);font-weight:600;">p99</th>
                            <th style="text-align:left;padding:9px 10px;font-size:0.72rem;color:var(--fg-muted);font-weight:600;">Updated</th>
                        </tr>
                    </thead>
                    <tbody id="obs-metrics-body-${windowId}">
                        ${renderObservabilityRows(entries)}
                    </tbody>
                </table>
            </div>

            <div style="margin-top:10px;font-size:0.75rem;color:var(--fg-muted);line-height:1.5;">
                Captured metrics include: boot time to login screen, app open latency, file save latency, and AI response latency.
            </div>
        </div>
    `;
}

function renderDataSection(windowId) {
    const historyMode = String(EphemeraState.settings.fileHistoryMode || 'every-save');
    const maxVersionsRaw = Number.parseInt(EphemeraState.settings.fileHistoryMaxVersions, 10);
    const maxVersions = Number.isFinite(maxVersionsRaw) && maxVersionsRaw > 0 ? maxVersionsRaw : 10;

    return `
        <div class="settings-section">
            <h3>Data Management</h3>
            <p style="color:var(--fg-secondary);font-size:0.85rem;margin-bottom:16px;">
                Your data is stored locally in your browser. Export regularly to prevent data loss.
            </p>
            
            <h4>Storage Usage</h4>
            <div id="storage-stats-${windowId}" style="background:rgba(0,0,0,0.2);padding:12px;border-radius:var(--radius-sm);margin-bottom:16px;">
                <div style="color:var(--fg-muted);">Loading...</div>
            </div>

            <h4>File Version History</h4>
            <p style="color:var(--fg-secondary);font-size:0.85rem;margin-bottom:8px;">
                Recover previous file states from automatic snapshots.
            </p>
            <div class="settings-row">
                <div>
                    <div class="settings-row-label">Snapshot Frequency</div>
                    <div class="settings-row-desc">Choose when snapshots are captured</div>
                </div>
                <select id="file-history-mode-${windowId}" class="settings-input" style="width:220px;">
                    <option value="every-save" ${historyMode === 'every-save' ? 'selected' : ''}>Every Save</option>
                    <option value="interval-5m" ${historyMode === 'interval-5m' ? 'selected' : ''}>At Most Every 5 Minutes</option>
                    <option value="on-close" ${historyMode === 'on-close' ? 'selected' : ''}>When App Window Closes</option>
                </select>
            </div>
            <div class="settings-row">
                <div>
                    <div class="settings-row-label">Versions Per File</div>
                    <div class="settings-row-desc">Old snapshots beyond this limit are pruned automatically</div>
                </div>
                <input id="file-history-max-${windowId}" class="settings-input" type="number" min="1" max="200" value="${maxVersions}" style="width:120px;">
            </div>
            <div id="file-history-stats-${windowId}" style="background:rgba(0,0,0,0.2);padding:12px;border-radius:var(--radius-sm);margin-bottom:12px;">
                <div style="color:var(--fg-muted);">Loading version history stats...</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                <button class="btn" id="open-file-history-${windowId}">Open File History Viewer</button>
                <button class="btn" id="prune-history-${windowId}">Prune Old Versions</button>
            </div>

            <h4 style="margin-top:18px;">Large Files</h4>
            <p style="color:var(--fg-secondary);font-size:0.85rem;margin-bottom:8px;">
                Review largest files and export or move them to Trash to reclaim space quickly.
            </p>
            <div id="large-files-list-${windowId}" style="background:rgba(0,0,0,0.2);padding:12px;border-radius:var(--radius-sm);margin-bottom:10px;">
                <div style="color:var(--fg-muted);">Loading large files...</div>
            </div>
            <button class="btn" id="refresh-large-files-${windowId}" style="margin-bottom:16px;">Refresh Large Files</button>
              
            <h4>Export Data</h4>
            <p style="color:var(--fg-secondary);font-size:0.85rem;margin-bottom:8px;">
                Download a backup of all your files, apps, and settings.
            </p>
            <button class="btn" id="export-data-${windowId}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:6px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export All Data
            </button>
            
            <h4 style="margin-top:20px;">Import Data</h4>
            <p style="color:var(--fg-secondary);font-size:0.85rem;margin-bottom:8px;">
                Restore from a previously exported backup file.
            </p>
            <input type="file" id="import-data-${windowId}" accept=".ephx" style="display:none;">
            <button class="btn" id="import-btn-${windowId}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:6px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Import Backup
            </button>
            
            <h4 style="margin-top:20px;">Profile Backup</h4>
            <p style="color:var(--fg-secondary);font-size:0.85rem;margin-bottom:8px;">
                Export or import an entire profile (files, apps, settings) to transfer between machines.
            </p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn" id="export-profile-${windowId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:6px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export Profile
                </button>
                <input type="file" id="import-profile-input-${windowId}" accept=".ephx" style="display:none;">
                <button class="btn" id="import-profile-${windowId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:6px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Import Profile
                </button>
            </div>

            <h4 style="margin-top:20px;">Clear Trash</h4>
            <p style="color:var(--fg-secondary);font-size:0.85rem;margin-bottom:8px;">
                Permanently delete all files in the trash.
            </p>
            <button class="btn" id="clear-trash-${windowId}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:6px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                Empty Trash
            </button>
            
            <div style="margin-top:32px;padding-top:24px;border-top:1px solid var(--border);">
                <h4 style="color:var(--danger);">Danger Zone</h4>
                <p style="color:var(--fg-secondary);font-size:0.85rem;margin-bottom:12px;">
                    Permanently delete all your data. This cannot be undone.
                </p>
                <button class="btn" id="delete-account-${windowId}" style="background:rgba(255,77,106,0.2);border-color:rgba(255,77,106,0.3);color:var(--danger);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:6px;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    Delete All Data
                </button>
            </div>
        </div>
    `;
}

function initSectionHandlers(section, windowId, lifecycle) {
    if (section === 'appearance') {
        document.querySelectorAll('.wallpaper-option').forEach(opt => {
            lifecycle.addListener(opt, 'click', () => {
                document.querySelectorAll('.wallpaper-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                applyWallpaperSelection(opt.dataset.wallpaper);
            });
        });

        const themeToggle = document.getElementById(`theme-toggle-${windowId}`);
        if (themeToggle) {
            lifecycle.addListener(themeToggle, 'click', () => {
                themeToggle.classList.toggle('on');
                const theme = themeToggle.classList.contains('on') ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', theme);
                EphemeraState.updateSetting('theme', theme);
            });
        }

        const accentContainer = document.getElementById(`accent-colors-${windowId}`);
        if (accentContainer) {
            accentContainer.querySelectorAll('.accent-option').forEach(opt => {
                lifecycle.addListener(opt, 'click', () => {
                    accentContainer.querySelectorAll('.accent-option').forEach(o => o.style.borderColor = 'transparent');
                    opt.style.borderColor = 'white';
                    const color = opt.dataset.color;
                    document.documentElement.style.setProperty('--accent', color);
                    EphemeraState.updateSetting('accentColor', color);
                });
            });
        }

        const soundsToggle = document.getElementById(`sounds-toggle-${windowId}`);
        if (soundsToggle) {
            lifecycle.addListener(soundsToggle, 'click', () => {
                soundsToggle.classList.toggle('on');
                const enabled = soundsToggle.classList.contains('on');
                EphemeraState.updateSetting('sounds', enabled);
                if (window.EphemeraSounds) EphemeraSounds.enabled = enabled;
            });
        }

        const localeSelect = document.getElementById(`locale-select-${windowId}`);
        if (localeSelect) {
            lifecycle.addListener(localeSelect, 'change', () => {
                const requestedLocale = String(localeSelect.value || 'en');
                let appliedLocale = requestedLocale;
                if (window.EphemeraI18n?.setLocale) {
                    appliedLocale = window.EphemeraI18n.setLocale(requestedLocale, {
                        persist: true,
                        emit: true,
                        apply: true
                    });
                } else {
                    EphemeraState.updateSetting('locale', requestedLocale);
                }
                localeSelect.value = appliedLocale;

                if (window.EphemeraNotifications?.success) {
                    EphemeraNotifications.success(
                        settingsT('settings.language_saved_title', 'Settings Saved'),
                        settingsT(
                            'settings.language_saved_body',
                            'Language updated. Reopen apps if some labels did not refresh yet.'
                        )
                    );
                }
            });
        }

        const editorEngineSelect = document.getElementById(`editor-engine-select-${windowId}`);
        const editorEngineStatus = document.getElementById(`editor-engine-status-${windowId}`);
        if (editorEngineSelect) {
            lifecycle.addListener(editorEngineSelect, 'change', () => {
                const requested = String(editorEngineSelect.value || 'cm5').toLowerCase();
                const selected = window.EphemeraEditorEngine?.setPreferredBackend
                    ? window.EphemeraEditorEngine.setPreferredBackend(requested, { persist: true })
                    : requested;
                const metadata = window.EphemeraEditorEngine?.getMetadata?.() || null;
                const backends = metadata?.availableBackends || window.EphemeraEditorEngine?.getAvailableBackends?.() || [];
                const findLabel = (id) => {
                    const found = backends.find((entry) => String(entry.id || '').toLowerCase() === String(id || '').toLowerCase());
                    return found?.name || String(id || '').toUpperCase();
                };

                const requestedLabel = findLabel(requested);
                const activeLabel = findLabel(selected);

                if (selected !== requested) {
                    editorEngineSelect.value = selected;
                    if (editorEngineStatus) {
                        editorEngineStatus.textContent = `Requested ${requestedLabel} is unavailable in this build. Active: ${activeLabel}.`;
                    }
                    if (window.EphemeraNotifications?.warning) {
                        EphemeraNotifications.warning(
                            settingsT('settings.editor_engine_unavailable_title', 'Editor Engine Unavailable'),
                            settingsT('settings.editor_engine_unavailable_body', `Requested ${requestedLabel} is unavailable. Using ${activeLabel}.`)
                        );
                    }
                    return;
                }

                if (editorEngineStatus) {
                    editorEngineStatus.textContent = `Active: ${activeLabel}. New editor tabs will use this engine.`;
                }
                if (window.EphemeraNotifications?.success) {
                    EphemeraNotifications.success(
                        settingsT('settings.language_saved_title', 'Settings Saved'),
                        settingsT('settings.editor_engine_saved_body', `Code editor backend set to ${activeLabel}.`)
                    );
                }
            });
        }
    }

    if (section === 'network') {
        const toggle = document.getElementById(`proxy-toggle-${windowId}`);
        const urlInput = document.getElementById(`proxy-url-${windowId}`);
        const backendToggle = document.getElementById(`terminal-backend-toggle-${windowId}`);
        const backendUrlInput = document.getElementById(`terminal-backend-url-${windowId}`);
        const backendTestBtn = document.getElementById(`terminal-backend-test-${windowId}`);
        const saveBtn = document.getElementById(`save-network-${windowId}`);

        if (toggle) {
            lifecycle.addListener(toggle, 'click', () => {
                toggle.classList.toggle('on');
                EphemeraState.updateSetting('proxyEnabled', toggle.classList.contains('on'));
            });
        }

        if (backendToggle) {
            lifecycle.addListener(backendToggle, 'click', () => {
                backendToggle.classList.toggle('on');
                EphemeraState.updateSetting('terminalBackendEnabled', backendToggle.classList.contains('on'));
            });
        }

        if (backendTestBtn) {
            lifecycle.addListener(backendTestBtn, 'click', async () => {
                const configured = String(backendUrlInput?.value || '').trim();
                if (!configured) {
                    EphemeraNotifications.error('Invalid URL', 'Enter a ws:// or wss:// terminal backend URL first.');
                    return;
                }

                if (!window.EphemeraTerminalBackend) {
                    EphemeraNotifications.error('Unavailable', 'Terminal backend module is not loaded.');
                    return;
                }

                backendTestBtn.disabled = true;
                backendTestBtn.textContent = 'Testing…';

                try {
                    const result = await window.EphemeraTerminalBackend.testConnection(configured);
                    if (result.ok) {
                        EphemeraNotifications.success('Terminal Backend Ready', 'WebSocket connection succeeded.');
                    } else {
                        EphemeraNotifications.error('Terminal Backend Error', result.error || 'Connection test failed');
                    }
                } catch (e) {
                    EphemeraNotifications.error('Terminal Backend Error', e.message || 'Connection test failed');
                } finally {
                    backendTestBtn.disabled = false;
                    backendTestBtn.textContent = 'Test Terminal Backend';
                }
            });
        }

        if (saveBtn) {
            lifecycle.addListener(saveBtn, 'click', () => {
                EphemeraState.updateSetting('proxyUrl', String(urlInput?.value || '').trim());
                EphemeraState.updateSetting('terminalBackendUrl', String(backendUrlInput?.value || '').trim());
                EphemeraState.updateSetting('terminalBackendEnabled', backendToggle?.classList.contains('on') === true);
                EphemeraNotifications.success('Settings Saved', 'Network settings updated.');
            });
        }
    }

    if (section === 'notifications') {
        const toggle = document.getElementById(`notif-toggle-${windowId}`);
        lifecycle.addListener(toggle, 'click', () => {
            toggle.classList.toggle('on');
            EphemeraState.updateSetting('notifications', toggle.classList.contains('on'));
        });
    }

    if (section === 'observability') {
        const performanceStatusEl = document.getElementById(`obs-performance-status-${windowId}`);
        const telemetryStatusEl = document.getElementById(`obs-telemetry-status-${windowId}`);
        const metricsCountEl = document.getElementById(`obs-metrics-count-${windowId}`);
        const lastUpdatedEl = document.getElementById(`obs-last-updated-${windowId}`);
        const statusEl = document.getElementById(`obs-status-${windowId}`);
        const rowsEl = document.getElementById(`obs-metrics-body-${windowId}`);
        const refreshBtn = document.getElementById(`obs-refresh-${windowId}`);
        const exportBtn = document.getElementById(`obs-export-${windowId}`);
        const clearBtn = document.getElementById(`obs-clear-${windowId}`);

        const collectMetrics = () => {
            if (!window.EphemeraPerformance?.getAllMetrics) return [];
            const metrics = window.EphemeraPerformance.getAllMetrics();
            return Object.values(metrics).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        };

        const updateUi = (options = {}) => {
            const entries = collectMetrics();
            const maxUpdatedAt = entries.length > 0
                ? Math.max(...entries.map((entry) => Number(entry.updatedAt || 0)))
                : 0;
            const perfEnabled = window.EphemeraPerformance?.isEnabled
                ? window.EphemeraPerformance.isEnabled() === true
                : false;
            const telemetryEnabled = window.EphemeraTelemetry?.isEnabled
                ? window.EphemeraTelemetry.isEnabled() === true
                : false;

            if (performanceStatusEl) {
                performanceStatusEl.textContent = perfEnabled ? 'Enabled' : 'Disabled';
                performanceStatusEl.style.color = perfEnabled ? 'var(--accent)' : 'var(--danger)';
            }
            if (telemetryStatusEl) {
                telemetryStatusEl.textContent = telemetryEnabled ? 'Enabled' : 'Disabled';
                telemetryStatusEl.style.color = telemetryEnabled ? 'var(--accent)' : 'var(--warning)';
            }
            if (metricsCountEl) {
                metricsCountEl.textContent = String(entries.length);
            }
            if (lastUpdatedEl) {
                lastUpdatedEl.textContent = settingsFormatTimestamp(maxUpdatedAt);
            }
            if (rowsEl) {
                rowsEl.innerHTML = renderObservabilityRows(entries);
            }
            if (statusEl) {
                const suffix = options.live === true
                    ? ` Live update at ${new Date().toLocaleTimeString()}.`
                    : '';
                statusEl.textContent = `Showing ${entries.length} tracked metric${entries.length === 1 ? '' : 's'}.${suffix}`;
            }
        };

        updateUi();

        if (refreshBtn) {
            lifecycle.addListener(refreshBtn, 'click', () => {
                updateUi();
                EphemeraNotifications?.success?.('Observability', 'Metrics refreshed.');
            });
        }

        if (clearBtn) {
            lifecycle.addListener(clearBtn, 'click', async () => {
                let confirmed = true;
                if (window.EphemeraDialog?.confirm) {
                    confirmed = await window.EphemeraDialog.confirm(
                        'Reset all in-memory performance metrics?',
                        'Reset Metrics'
                    );
                }
                if (!confirmed) return;

                if (window.EphemeraPerformance?.clear) {
                    window.EphemeraPerformance.clear();
                }
                updateUi();
                EphemeraNotifications?.success?.('Observability', 'Performance metrics reset.');
            });
        }

        if (exportBtn) {
            lifecycle.addListener(exportBtn, 'click', () => {
                const entries = collectMetrics();
                const payload = {
                    generatedAt: new Date().toISOString(),
                    metricCount: entries.length,
                    metrics: entries
                };

                try {
                    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `ephemera-observability-${Date.now()}.json`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    EphemeraNotifications?.success?.('Observability', 'Metrics snapshot exported.');
                } catch (e) {
                    EphemeraNotifications?.error?.('Observability', e?.message || 'Could not export metrics snapshot.');
                }
            });
        }

        lifecycle.addSubscription(EphemeraEvents.on('performance:metric', () => {
            updateUi({ live: true });
        }));
    }

    if (section === 'about') {
        const quotaEl = document.getElementById(`about-storage-quota-${windowId}`);
        const refreshBtn = document.getElementById(`about-storage-refresh-${windowId}`);
        const persistBtn = document.getElementById(`about-storage-persist-${windowId}`);
        const persistStatusEl = document.getElementById(`about-storage-persist-status-${windowId}`);

        const setPersistStatus = async () => {
            if (!persistStatusEl) return;
            if (!window.EphemeraStorageQuota) {
                persistStatusEl.textContent = 'Quota monitor is unavailable.';
                if (persistBtn) persistBtn.disabled = true;
                return;
            }
            const supported = window.EphemeraStorageQuota.isPersistenceSupported();
            if (!supported) {
                persistStatusEl.textContent = 'Persistent storage is not supported in this browser.';
                if (persistBtn) persistBtn.disabled = true;
                return;
            }
            const persisted = await window.EphemeraStorageQuota.isPersisted();
            persistStatusEl.textContent = persisted
                ? 'Persistent storage status: Granted.'
                : 'Persistent storage status: Not granted.';
            if (persistBtn) persistBtn.disabled = false;
        };

        const updateQuotaCard = (summary) => {
            if (!quotaEl) return;
            quotaEl.innerHTML = renderQuotaStatusCard(summary);
        };

        const refreshQuota = async () => {
            if (!window.EphemeraStorageQuota) {
                updateQuotaCard(null);
                return;
            }
            const summary = await window.EphemeraStorageQuota.checkQuota({ silent: true });
            updateQuotaCard(summary);
        };

        refreshQuota();
        setPersistStatus();

        if (refreshBtn) {
            lifecycle.addListener(refreshBtn, 'click', async () => {
                refreshBtn.disabled = true;
                refreshBtn.textContent = 'Refreshing...';
                try {
                    await refreshQuota();
                } finally {
                    refreshBtn.disabled = false;
                    refreshBtn.textContent = 'Refresh Quota';
                }
            });
        }

        if (persistBtn) {
            lifecycle.addListener(persistBtn, 'click', async () => {
                persistBtn.disabled = true;
                try {
                    await window.EphemeraStorageQuota?.requestPersistentStorage();
                    await setPersistStatus();
                    await refreshQuota();
                } finally {
                    if (window.EphemeraStorageQuota?.isPersistenceSupported()) {
                        persistBtn.disabled = false;
                    }
                }
            });
        }

        lifecycle.addSubscription(EphemeraEvents.on('storage:quota:update', (summary) => {
            updateQuotaCard(summary);
        }));
    }

    if (section === 'data') {
        const statsEl = document.getElementById(`storage-stats-${windowId}`);
        const historyStatsEl = document.getElementById(`file-history-stats-${windowId}`);
        const historyModeSelect = document.getElementById(`file-history-mode-${windowId}`);
        const historyMaxInput = document.getElementById(`file-history-max-${windowId}`);
        const openHistoryBtn = document.getElementById(`open-file-history-${windowId}`);
        const pruneHistoryBtn = document.getElementById(`prune-history-${windowId}`);
        const largeFilesListEl = document.getElementById(`large-files-list-${windowId}`);
        const refreshLargeFilesBtn = document.getElementById(`refresh-large-files-${windowId}`);
        const exportBtn = document.getElementById(`export-data-${windowId}`);
        const importInput = document.getElementById(`import-data-${windowId}`);
        const importBtn = document.getElementById(`import-btn-${windowId}`);
        const clearTrashBtn = document.getElementById(`clear-trash-${windowId}`);
        const deleteAccountBtn = document.getElementById(`delete-account-${windowId}`);

        const estimateFileSize = (entry) => {
            if (Number.isFinite(entry?.size)) return Number(entry.size);
            const content = entry?.content;
            if (typeof content === 'string') return content.length;
            if (content instanceof ArrayBuffer) return content.byteLength;
            if (ArrayBuffer.isView(content)) return content.byteLength;
            if (content && typeof content === 'object') {
                try {
                    return JSON.stringify(content).length;
                } catch (_error) {
                    return 0;
                }
            }
            return 0;
        };

        async function loadLargeFiles() {
            if (!largeFilesListEl) return;
            if (!window.EphemeraStorage?.getAll) {
                largeFilesListEl.innerHTML = '<div style="color:var(--fg-muted);">Large-file scanning unavailable</div>';
                return;
            }

            const files = await window.EphemeraStorage.getAll('files');
            const rows = (Array.isArray(files) ? files : [])
                .filter((entry) => entry?.type === 'file')
                .filter((entry) => !String(entry.path || '').includes('/.trash/'))
                .map((entry) => ({
                    path: String(entry.path || ''),
                    name: String(entry.name || ''),
                    size: estimateFileSize(entry),
                    modifiedAt: Number(entry.modifiedAt || 0)
                }))
                .sort((a, b) => b.size - a.size)
                .slice(0, 12);

            if (!rows.length) {
                largeFilesListEl.innerHTML = '<div style="color:var(--fg-muted);">No files found.</div>';
                return;
            }

            largeFilesListEl.innerHTML = rows.map((row) => `
                <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="min-width:0;">
                        <div style="font-family:var(--font-mono);font-size:0.74rem;color:var(--fg-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${settingsEscapeAttr(row.path)}">${settingsEscapeHtml(row.path)}</div>
                        <div style="font-size:0.72rem;color:var(--fg-muted);">Size: ${settingsEscapeHtml(settingsFormatBytes(row.size))}</div>
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                        <button class="btn btn-sm" data-large-action="export" data-path="${settingsEscapeAttr(row.path)}">Export</button>
                        <button class="btn btn-sm" data-large-action="trash" data-path="${settingsEscapeAttr(row.path)}">Move to Trash</button>
                    </div>
                </div>
            `).join('');
        }

        async function loadStats() {
            const quotaSummary = window.EphemeraStorageQuota?.getStatus
                ? await window.EphemeraStorageQuota.getStatus({ refresh: true })
                : null;

            if (window.EphemeraDataManagement) {
                const stats = await window.EphemeraDataManagement.getStorageStats();
                statsEl.innerHTML = `
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span style="color:var(--fg-secondary);">Files</span>
                        <span style="color:var(--fg-primary);">${stats.files.count} items (${window.EphemeraDataManagement.formatBytes(stats.files.size)})</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span style="color:var(--fg-secondary);">File Versions</span>
                        <span style="color:var(--fg-primary);">${stats.fileVersions.count} snapshots (${window.EphemeraDataManagement.formatBytes(stats.fileVersions.size)})</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;">
                        <span style="color:var(--fg-secondary);">Apps</span>
                        <span style="color:var(--fg-primary);">${stats.apps.count} installed</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
                        <span style="color:var(--fg-secondary);">Estimated Total</span>
                        <span style="color:var(--fg-primary);">${window.EphemeraDataManagement.formatBytes(stats.total)}</span>
                    </div>
                    ${quotaSummary ? `
                    <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
                        <span style="color:var(--fg-secondary);">Browser Quota</span>
                        <span style="color:${quotaSummary.overThreshold ? 'var(--danger)' : 'var(--fg-primary)'};">
                            ${settingsEscapeHtml(settingsFormatBytes(quotaSummary.usageBytes))} / ${settingsEscapeHtml(settingsFormatBytes(quotaSummary.quotaBytes))}
                            (${Number(quotaSummary.usagePercent || 0).toFixed(1)}%)
                        </span>
                    </div>
                    ` : ''}
                `;
            } else {
                statsEl.innerHTML = '<div style="color:var(--fg-muted);">Storage info unavailable</div>';
            }

            if (!historyStatsEl) return;
            if (window.EphemeraFS && typeof window.EphemeraFS.getVersionStorageStats === 'function') {
                const historyStats = await window.EphemeraFS.getVersionStorageStats();
                const formatBytes = window.EphemeraDataManagement?.formatBytes
                    ? window.EphemeraDataManagement.formatBytes
                    : ((value) => `${value} B`);
                historyStatsEl.innerHTML = `
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span style="color:var(--fg-secondary);">Tracked Files</span>
                        <span style="color:var(--fg-primary);">${historyStats.files}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span style="color:var(--fg-secondary);">Snapshots</span>
                        <span style="color:var(--fg-primary);">${historyStats.count}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;">
                        <span style="color:var(--fg-secondary);">Storage Used</span>
                        <span style="color:${historyStats.overThreshold ? 'var(--danger)' : 'var(--fg-primary)'};">${formatBytes(historyStats.size)}</span>
                    </div>
                    <div style="margin-top:8px;font-size:0.75rem;color:${historyStats.overThreshold ? 'var(--danger)' : 'var(--fg-muted)'};">
                        Warning threshold: ${formatBytes(historyStats.thresholdBytes)}
                    </div>
                    ${historyStats.overThreshold
                        ? '<div style="margin-top:6px;font-size:0.75rem;color:var(--danger);">History storage is above the threshold. Prune old versions to free space.</div>'
                        : ''}
                `;
            } else {
                historyStatsEl.innerHTML = '<div style="color:var(--fg-muted);">Version history info unavailable</div>';
            }
        }

        loadStats();
        loadLargeFiles();

        lifecycle.addListener(historyModeSelect, 'change', async () => {
            const nextMode = String(historyModeSelect.value || 'every-save');
            const previousMode = String(EphemeraState.settings.fileHistoryMode || 'every-save');
            if (previousMode === 'on-close' && nextMode !== 'on-close' && window.EphemeraFS?.flushPendingSnapshots) {
                await window.EphemeraFS.flushPendingSnapshots();
            }
            EphemeraState.updateSetting('fileHistoryMode', nextMode);
            await loadStats();
            EphemeraNotifications.success('Settings Saved', 'File history snapshot mode updated.');
        });

        lifecycle.addListener(historyMaxInput, 'change', async () => {
            const parsed = Number.parseInt(historyMaxInput.value, 10);
            const safe = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 10;
            historyMaxInput.value = String(safe);
            EphemeraState.updateSetting('fileHistoryMaxVersions', safe);
            if (window.EphemeraFS?.pruneAllFileVersions) {
                await window.EphemeraFS.pruneAllFileVersions(safe);
            }
            await loadStats();
            EphemeraNotifications.success('Settings Saved', `Kept latest ${safe} versions per file.`);
        });

        lifecycle.addListener(openHistoryBtn, 'click', () => {
            if (window.EphemeraWM) {
                EphemeraWM.open('file-history');
            }
        });

        lifecycle.addListener(pruneHistoryBtn, 'click', async () => {
            const keep = Number.parseInt(historyMaxInput?.value, 10) || 10;
            let confirmed = true;
            if (window.EphemeraDialog) {
                confirmed = await window.EphemeraDialog.confirm(
                    `Prune snapshots and keep only the latest ${keep} versions per file?`,
                    'Prune Version History'
                );
            }
            if (!confirmed) return;

            if (window.EphemeraFS?.pruneAllFileVersions) {
                const removed = await window.EphemeraFS.pruneAllFileVersions(keep);
                EphemeraNotifications.success('Version History Pruned', `Removed ${removed} old snapshots.`);
                await loadStats();
                await loadLargeFiles();
            }
        });

        if (refreshLargeFilesBtn) {
            lifecycle.addListener(refreshLargeFilesBtn, 'click', () => {
                loadLargeFiles();
            });
        }

        if (largeFilesListEl) {
            lifecycle.addListener(largeFilesListEl, 'click', async (event) => {
                const targetEl = event.target instanceof Element ? event.target : null;
                if (!targetEl) return;
                const actionBtn = targetEl.closest('button[data-large-action]');
                if (!actionBtn) return;

                const action = String(actionBtn.dataset.largeAction || '');
                const path = String(actionBtn.dataset.path || '');
                if (!path) return;

                actionBtn.disabled = true;
                try {
                    if (action === 'export') {
                        if (!window.EphemeraDataManagement?.saveToDisk) {
                            EphemeraNotifications.error('Export Unavailable', 'File export is not available in this browser.');
                            return;
                        }
                        await window.EphemeraDataManagement.saveToDisk(path);
                        return;
                    }

                    if (action === 'trash') {
                        let confirmed = true;
                        if (window.EphemeraDialog?.confirm) {
                            confirmed = await window.EphemeraDialog.confirm(
                                `Move ${window.EphemeraFS?.getBasename?.(path) || path} to Trash?`,
                                'Move to Trash'
                            );
                        }
                        if (!confirmed) return;

                        await window.EphemeraFS?.delete?.(path);
                        await loadStats();
                        await loadLargeFiles();
                        await window.EphemeraStorageQuota?.checkQuota?.({ silent: true });
                    }
                } finally {
                    actionBtn.disabled = false;
                }
            });
        }

        lifecycle.addListener(exportBtn, 'click', async () => {
            if (window.EphemeraDataManagement) {
                await window.EphemeraDataManagement.exportAll();
            }
        });

        lifecycle.addListener(importBtn, 'click', () => importInput.click());
        lifecycle.addListener(importInput, 'change', async (e) => {
            const file = e.target.files[0];
            if (file && window.EphemeraDataManagement) {
                await window.EphemeraDataManagement.importBackup(file);
            }
            importInput.value = '';
        });

        const exportProfileBtn = document.getElementById(`export-profile-${windowId}`);
        const importProfileBtn = document.getElementById(`import-profile-${windowId}`);
        const importProfileInput = document.getElementById(`import-profile-input-${windowId}`);

        if (exportProfileBtn) {
            lifecycle.addListener(exportProfileBtn, 'click', async () => {
                if (window.EphemeraDataManagement) {
                    await window.EphemeraDataManagement.exportProfile();
                }
            });
        }
        if (importProfileBtn && importProfileInput) {
            lifecycle.addListener(importProfileBtn, 'click', () => importProfileInput.click());
            lifecycle.addListener(importProfileInput, 'change', async (e) => {
                const file = e.target.files[0];
                if (file && window.EphemeraDataManagement) {
                    await window.EphemeraDataManagement.importProfile(file);
                }
                importProfileInput.value = '';
            });
        }

        lifecycle.addListener(clearTrashBtn, 'click', async () => {
            if (window.EphemeraDialog) {
                const confirmed = await window.EphemeraDialog.confirm('Permanently delete all files in trash?', 'Empty Trash');
                if (confirmed && window.EphemeraDataManagement) {
                    await window.EphemeraDataManagement.clearTrash();
                    await loadStats();
                    await loadLargeFiles();
                    await window.EphemeraStorageQuota?.checkQuota?.({ silent: true });
                }
            }
        });

        lifecycle.addListener(deleteAccountBtn, 'click', async () => {
            if (window.EphemeraDataManagement) {
                await window.EphemeraDataManagement.deleteAccount();
            }
        });

        lifecycle.addSubscription(EphemeraEvents.on('fs:history:changed', () => {
            loadStats();
        }));
        lifecycle.addSubscription(EphemeraEvents.on('fs:changed', () => {
            loadLargeFiles();
        }));
    }

    if (section === 'trust') {
        const contentEl = document.getElementById(`settings-content-${windowId}`);
        const setToggleState = (toggleEl, enabled) => {
            toggleEl.classList.toggle('on', enabled);
            toggleEl.setAttribute('aria-checked', enabled ? 'true' : 'false');
        };

        const applyPermissionToggle = async (toggleEl, enable) => {
            const appId = toggleEl.dataset.appId;
            const permission = toggleEl.dataset.permission;
            if (!appId || !permission || !window.EphemeraApps) return;

            toggleEl.style.pointerEvents = 'none';
            const previous = toggleEl.classList.contains('on');
            setToggleState(toggleEl, enable);

            try {
                if (enable) {
                    await window.EphemeraApps.grantAppPermission(appId, permission);
                } else {
                    await window.EphemeraApps.revokeAppPermission(appId, permission);
                }
            } catch (e) {
                setToggleState(toggleEl, previous);
                if (window.EphemeraNotifications) {
                    window.EphemeraNotifications.error('Permission Update Failed', e.message || 'Could not update app permissions.');
                }
            } finally {
                toggleEl.style.pointerEvents = '';
            }
        };

        contentEl.querySelectorAll('.trust-toggle').forEach(toggleEl => {
            lifecycle.addListener(toggleEl, 'click', () => {
                const enable = !toggleEl.classList.contains('on');
                applyPermissionToggle(toggleEl, enable);
            });

            lifecycle.addListener(toggleEl, 'keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const enable = !toggleEl.classList.contains('on');
                    applyPermissionToggle(toggleEl, enable);
                }
            });
        });

        contentEl.querySelectorAll('.trust-revoke-all').forEach(button => {
            lifecycle.addListener(button, 'click', async () => {
                const appId = button.dataset.appId;
                if (!appId || !window.EphemeraApps) return;

                let confirmed = true;
                if (window.EphemeraDialog) {
                    confirmed = await window.EphemeraDialog.confirm(
                        'Revoke all permissions for this app?',
                        'Revoke Permissions'
                    );
                }
                if (!confirmed) return;

                button.disabled = true;
                try {
                    await window.EphemeraApps.revokeAllAppPermissions(appId);
                    contentEl.querySelectorAll(`.trust-toggle[data-app-id="${appId}"]`).forEach(toggleEl => {
                        setToggleState(toggleEl, false);
                    });
                    if (window.EphemeraNotifications) {
                        window.EphemeraNotifications.success('Permissions Updated', 'All permissions were revoked.');
                    }
                } catch (e) {
                    if (window.EphemeraNotifications) {
                        window.EphemeraNotifications.error('Permission Update Failed', e.message || 'Could not revoke permissions.');
                    }
                } finally {
                    button.disabled = false;
                }
            });
        });
    }

    if (section === 'ai') {
        const providerSelect = document.getElementById(`ai-provider-${windowId}`);
        const keyInput = document.getElementById(`ai-key-${windowId}`);
        const keyLabel = document.getElementById(`ai-key-label-${windowId}`);
        const keyStatus = document.getElementById(`ai-key-status-${windowId}`);
        const keyHint = document.getElementById(`ai-key-hint-${windowId}`);
        const apiKeySection = document.getElementById(`ai-apikey-section-${windowId}`);
        const oauthSection = document.getElementById(`ai-oauth-section-${windowId}`);
        const oauthLoginBtn = document.getElementById(`ai-oauth-login-${windowId}`);
        const oauthDisconnectBtn = document.getElementById(`ai-oauth-disconnect-${windowId}`);
        const oauthStatusEl = document.getElementById(`ai-oauth-status-${windowId}`);
        const modelSelectDefault = document.getElementById(`ai-model-default-${windowId}`);
        const modelSelectChat = document.getElementById(`ai-model-chat-${windowId}`);
        const modelSelectCode = document.getElementById(`ai-model-code-${windowId}`);
        const modelSelectTerminal = document.getElementById(`ai-model-terminal-${windowId}`);
        const modelSelectQuickActions = document.getElementById(`ai-model-quickactions-${windowId}`);
        const modelSelectAppBuilder = document.getElementById(`ai-model-appbuilder-${windowId}`);
        const modelSelectFileSearch = document.getElementById(`ai-model-filesearch-${windowId}`);
        const maxTokensInput = document.getElementById(`ai-max-tokens-${windowId}`);
        const maxTokensValue = document.getElementById(`max-tokens-value-${windowId}`);
        const temperatureInput = document.getElementById(`ai-temperature-${windowId}`);
        const temperatureValue = document.getElementById(`temperature-value-${windowId}`);
        const saveBtn = document.getElementById(`save-ai-${windowId}`);
        const testBtn = document.getElementById(`test-ai-${windowId}`);
        const toggleBtn = document.getElementById(`toggle-key-visibility-${windowId}`);
        const testResult = document.getElementById(`ai-test-result-${windowId}`);
        const refreshBtn = document.getElementById(`refresh-models-${windowId}`);
        const modelsStatus = document.getElementById(`models-status-${windowId}`);
        const usageRequestsEl = document.getElementById(`ai-usage-requests-${windowId}`);
        const usageTokensEl = document.getElementById(`ai-usage-tokens-${windowId}`);
        const usageCostEl = document.getElementById(`ai-usage-cost-${windowId}`);
        const resetUsageBtn = document.getElementById(`ai-reset-usage-${windowId}`);

        const providerMeta = {
            openrouter: { setting: 'openrouterApiKey', label: 'OpenRouter API Key', placeholder: 'sk-or-...', name: 'OpenRouter', hint: 'Get key from openrouter.ai/keys' },
            openai: { setting: 'openaiApiKey', label: 'OpenAI API Key', placeholder: 'sk-...', name: 'OpenAI', hint: 'Get key from platform.openai.com/api-keys' },
            anthropic: { setting: 'anthropicApiKey', label: 'Anthropic API Key', placeholder: 'sk-ant-...', name: 'Anthropic', hint: 'Get key from console.anthropic.com/settings/keys' },
            google: { setting: 'googleApiKey', label: 'Google AI API Key', placeholder: 'AIza...', name: 'Google AI', hint: 'Get key from aistudio.google.com/app/apikey' },
            chatgpt: { setting: null, label: 'ChatGPT Plus/Pro', placeholder: '', name: 'ChatGPT Plus/Pro', hint: '', authType: 'session', sessionProvider: 'chatgpt' }
        };

        const modelSelectMap = {
            default: modelSelectDefault,
            chat: modelSelectChat,
            code: modelSelectCode,
            terminal: modelSelectTerminal,
            quickActions: modelSelectQuickActions,
            appBuilder: modelSelectAppBuilder,
            fileSearch: modelSelectFileSearch
        };

        const modelSettingKeyMap = {
            default: 'aiModel',
            chat: 'aiModelChat',
            code: 'aiModelCode',
            terminal: 'aiModelTerminal',
            quickActions: 'aiModelQuickActions',
            appBuilder: 'aiModelAppBuilder',
            fileSearch: 'aiModelFileSearch'
        };

        function getActiveProvider() {
            return providerSelect?.value || EphemeraState.settings.aiProvider || 'openrouter';
        }

        function getActiveMeta() {
            return providerMeta[getActiveProvider()] || providerMeta.openrouter;
        }

        function isOAuthProvider(provider) {
            const meta = providerMeta[provider];
            return meta?.authType === 'session';
        }

        function updateOAuthStatus() {
            if (!oauthStatusEl) return;
            const provider = getActiveProvider();
            const meta = getActiveMeta();
            if (!isOAuthProvider(provider)) return;
            const status = window.EphemeraAIOAuth?.getStatus?.(meta.sessionProvider) || { connected: false };
            if (status.connected) {
                const userName = status.user?.name || status.user?.email || 'Connected';
                oauthStatusEl.innerHTML = `<span style="color:var(--accent);">${EphemeraSanitize.escapeHtml(userName)}</span>`;
                if (oauthLoginBtn) oauthLoginBtn.style.display = 'none';
                if (oauthDisconnectBtn) oauthDisconnectBtn.style.display = '';
                testBtn.disabled = false;
            } else {
                oauthStatusEl.innerHTML = '<span style="color:var(--fg-secondary);">Not connected</span>';
                if (oauthLoginBtn) oauthLoginBtn.style.display = '';
                if (oauthDisconnectBtn) oauthDisconnectBtn.style.display = 'none';
                testBtn.disabled = true;
            }
        }

        function updateUsageUi() {
            if (typeof EphemeraAI.getSessionUsage !== 'function') return;
            const usage = EphemeraAI.getSessionUsage();
            if (usageRequestsEl) usageRequestsEl.textContent = String(usage.requests || 0);
            if (usageTokensEl) usageTokensEl.textContent = String(usage.totalTokens || 0);
            if (usageCostEl) usageCostEl.textContent = `$${Number(usage.estimatedCostUsd || 0).toFixed(4)}`;
        }

        async function syncProviderField() {
            const provider = getActiveProvider();
            const meta = getActiveMeta();
            const oauth = isOAuthProvider(provider);

            if (apiKeySection) apiKeySection.style.display = oauth ? 'none' : '';
            if (oauthSection) oauthSection.style.display = oauth ? '' : 'none';

            if (oauth) {
                updateOAuthStatus();
                return;
            }

            if (keyLabel) keyLabel.textContent = meta.label;
            if (keyHint) keyHint.textContent = meta.hint || '';
            if (keyInput) keyInput.placeholder = meta.placeholder;
            let key = '';
            try {
                key = await EphemeraAI.getApiKey(provider);
            } catch {
                key = '';
            }
            keyInput.value = key || '';
            if (keyStatus) {
                keyStatus.textContent = keyInput.value.trim()
                    ? 'API key configured'
                    : `Enter your ${meta.label} to enable AI features`;
                keyStatus.style.color = keyInput.value.trim() ? 'var(--accent)' : 'var(--fg-secondary)';
            }
            testBtn.disabled = !keyInput.value.trim();
        }

        async function populateAllModelSelects(provider, forceRefresh = false) {
            for (const [useCase, selectEl] of Object.entries(modelSelectMap)) {
                if (!selectEl) continue;
                const settingKey = modelSettingKeyMap[useCase];
                const selectedModel = selectEl.value
                    || (typeof EphemeraAI.getModelForUseCase === 'function'
                        ? EphemeraAI.getModelForUseCase(useCase, provider)
                        : (EphemeraState.settings[settingKey] || EphemeraAI.getDefaultModel(provider)));
                await EphemeraAI.populateModelSelect(selectEl, selectedModel, { provider, useCase, forceRefresh });
            }
        }

        async function loadModels(forceRefresh = false) {
            const provider = getActiveProvider();
            const meta = getActiveMeta();
            const oauth = isOAuthProvider(provider);

            if (oauth) {
                const connected = window.EphemeraAIOAuth?.isConnected?.(meta.sessionProvider);
                if (!connected) {
                    modelsStatus.textContent = 'Log in to load models';
                    modelsStatus.style.color = 'var(--fg-muted)';
                    await populateAllModelSelects(provider, false);
                    return;
                }

                modelsStatus.textContent = 'Loading models...';
                modelsStatus.style.color = 'var(--fg-muted)';
                refreshBtn.disabled = true;

                try {
                    const models = await EphemeraAI.getModels(forceRefresh, provider);
                    await populateAllModelSelects(provider, false);
                    modelsStatus.textContent = models.length > 0
                        ? `${models.length} models loaded`
                        : 'No models found; using fallback defaults';
                    modelsStatus.style.color = models.length > 0 ? 'var(--accent)' : 'var(--warning)';
                } catch (e) {
                    modelsStatus.textContent = 'Failed to load models: ' + e.message;
                    modelsStatus.style.color = 'var(--danger)';
                } finally {
                    refreshBtn.disabled = false;
                }
                return;
            }

            const tempKey = keyInput.value.trim();
            const originalEncrypted = EphemeraState.settings[meta.setting] || '';

            if (!tempKey) {
                modelsStatus.textContent = 'Enter API key to load models';
                modelsStatus.style.color = 'var(--fg-muted)';
                await populateAllModelSelects(provider, false);
                return;
            }

            modelsStatus.textContent = 'Loading models...';
            modelsStatus.style.color = 'var(--fg-muted)';
            refreshBtn.disabled = true;

            await EphemeraAI.setApiKey(tempKey, provider);

            try {
                const models = await EphemeraAI.getModels(forceRefresh, provider);
                await populateAllModelSelects(provider, false);
                modelsStatus.textContent = models.length > 0
                    ? `${models.length} models loaded`
                    : 'No models found; using fallback defaults';
                modelsStatus.style.color = models.length > 0 ? 'var(--accent)' : 'var(--warning)';
            } catch (e) {
                modelsStatus.textContent = 'Failed to load models: ' + e.message;
                modelsStatus.style.color = 'var(--danger)';
            } finally {
                refreshBtn.disabled = false;
                EphemeraState.updateSetting(meta.setting, originalEncrypted);
            }
        }

        lifecycle.addListener(toggleBtn, 'click', () => {
            if (keyInput.type === 'password') {
                keyInput.type = 'text';
                toggleBtn.textContent = 'Hide';
            } else {
                keyInput.type = 'password';
                toggleBtn.textContent = 'Show';
            }
        });

        if (maxTokensInput && maxTokensValue) {
            lifecycle.addListener(maxTokensInput, 'input', () => {
                maxTokensValue.textContent = maxTokensInput.value;
            });
        }

        if (temperatureInput && temperatureValue) {
            lifecycle.addListener(temperatureInput, 'input', () => {
                temperatureValue.textContent = temperatureInput.value;
            });
        }

        lifecycle.addListener(providerSelect, 'change', async () => {
            await syncProviderField();
            await loadModels(true);
        });

        lifecycle.addListener(refreshBtn, 'click', () => loadModels(true));

        if (oauthLoginBtn) {
            lifecycle.addListener(oauthLoginBtn, 'click', async () => {
                const provider = getActiveProvider();
                const meta = getActiveMeta();
                if (!isOAuthProvider(provider)) return;
                oauthLoginBtn.disabled = true;
                try {
                    await window.EphemeraAIOAuth.connect(meta.sessionProvider);
                    updateOAuthStatus();
                    await loadModels(true);
                } catch (e) {
                    if (window.EphemeraNotifications) {
                        window.EphemeraNotifications.error('ChatGPT Connect Failed', e.message || 'Could not connect.');
                    }
                } finally {
                    oauthLoginBtn.disabled = false;
                }
            });
        }

        if (oauthDisconnectBtn) {
            lifecycle.addListener(oauthDisconnectBtn, 'click', async () => {
                const provider = getActiveProvider();
                const meta = getActiveMeta();
                if (!isOAuthProvider(provider)) return;
                try {
                    await window.EphemeraAIOAuth.disconnect(meta.sessionProvider);
                    updateOAuthStatus();
                } catch (e) {
                    window.EphemeraNotifications?.error?.(
                        'ChatGPT Disconnect Failed',
                        e?.message || 'Could not disconnect.'
                    );
                }
            });
        }

        lifecycle.addSubscription(EphemeraEvents.on('ai:oauth:updated', () => {
            if (isOAuthProvider(getActiveProvider())) {
                updateOAuthStatus();
            }
        }));

        lifecycle.addListener(saveBtn, 'click', async () => {
            const provider = getActiveProvider();
            const meta = getActiveMeta();
            const maxTokens = parseInt(maxTokensInput?.value || 8192);
            const temperature = parseFloat(temperatureInput?.value || 0.7);

            EphemeraState.updateSetting('aiProvider', provider);

            if (!isOAuthProvider(provider)) {
                const key = keyInput.value.trim();
                await EphemeraAI.setApiKey(key, provider);
                testBtn.disabled = !key;
            }

            for (const [useCase, selectEl] of Object.entries(modelSelectMap)) {
                if (!selectEl) continue;
                EphemeraState.updateSetting(modelSettingKeyMap[useCase], selectEl.value);
            }

            EphemeraState.updateSetting('aiMaxTokens', maxTokens);
            EphemeraState.updateSetting('aiTemperature', temperature);

            EphemeraNotifications.success('AI Settings Saved', `${meta.name} configuration updated.`);
        });

        lifecycle.addListener(testBtn, 'click', async () => {
            const provider = getActiveProvider();
            const meta = getActiveMeta();
            const oauth = isOAuthProvider(provider);
            testResult.style.display = 'block';
            testResult.style.background = 'rgba(0,0,0,0.2)';
            testResult.innerHTML = '<span style="color:var(--fg-muted);">Testing connection...</span>';

            if (oauth) {
                const connected = window.EphemeraAIOAuth?.isConnected?.(meta.sessionProvider);
                if (!connected) {
                    testResult.style.background = 'rgba(255,77,106,0.1)';
                    testResult.innerHTML = '<span style="color:var(--danger);">Not connected</span><br><span style="font-size:0.85rem;color:var(--fg-secondary);">Please log in first.</span>';
                    return;
                }

                try {
                    const response = await EphemeraAI.chat(
                        [{ role: 'user', content: 'Reply with exactly: Connection OK' }],
                        modelSelectDefault.value || EphemeraAI.getDefaultModel(provider),
                        null,
                        { provider, useCase: 'default' }
                    );

                    testResult.style.background = 'rgba(0,212,170,0.1)';
                    testResult.innerHTML = `<span style="color:var(--accent);">Connected</span><br><span style="font-size:0.85rem;color:var(--fg-secondary);">Response: ${EphemeraSanitize.escapeHtml(response)}</span>`;
                } catch (e) {
                    testResult.style.background = 'rgba(255,77,106,0.1)';
                    testResult.innerHTML = `<span style="color:var(--danger);">Connection failed</span><br><span style="font-size:0.85rem;color:var(--fg-secondary);">${e.message}</span>`;
                } finally {
                    updateUsageUi();
                }
                return;
            }

            const tempKey = keyInput.value.trim();
            if (!tempKey) {
                testResult.style.background = 'rgba(255,77,106,0.1)';
                testResult.innerHTML = '<span style="color:var(--danger);">Connection failed</span><br><span style="font-size:0.85rem;color:var(--fg-secondary);">API key is required.</span>';
                return;
            }

            const originalEncrypted = EphemeraState.settings[meta.setting] || '';
            try {
                await EphemeraAI.setApiKey(tempKey, provider);

                const response = await EphemeraAI.chat(
                    [{ role: 'user', content: 'Reply with exactly: Connection OK' }],
                    modelSelectDefault.value || EphemeraAI.getDefaultModel(provider),
                    null,
                    { provider, useCase: 'default' }
                );

                testResult.style.background = 'rgba(0,212,170,0.1)';
                testResult.innerHTML = `<span style="color:var(--accent);">Connected</span><br><span style="font-size:0.85rem;color:var(--fg-secondary);">Response: ${EphemeraSanitize.escapeHtml(response)}</span>`;
            } catch (e) {
                testResult.style.background = 'rgba(255,77,106,0.1)';
                testResult.innerHTML = `<span style="color:var(--danger);">Connection failed</span><br><span style="font-size:0.85rem;color:var(--fg-secondary);">${e.message}</span>`;
            } finally {
                EphemeraState.updateSetting(meta.setting, originalEncrypted);
                updateUsageUi();
            }
        });

        if (resetUsageBtn) {
            lifecycle.addListener(resetUsageBtn, 'click', () => {
                if (typeof EphemeraAI.resetSessionUsage === 'function') {
                    EphemeraAI.resetSessionUsage();
                    updateUsageUi();
                }
            });
        }

        updateUsageUi();
        syncProviderField().then(() => loadModels(false));
    }

    if (section === 'sync') {
        initSyncHandlers(windowId, lifecycle);
    }
}

function renderSyncSection(windowId) {
    const s = EphemeraState.settings;
    const provider    = s.syncProvider    || 'none';
    const autoEnabled = s.syncAutoEnabled !== false;
    const lastAt      = s.syncLastAt ? new Date(s.syncLastAt).toLocaleString() : 'Never';
    const restHide    = provider === 'rest' ? '' : 'display:none;';

    return `
        <div class="settings-section">
            <h3>Cloud Sync</h3>
            <p style="color:var(--fg-secondary);font-size:0.82rem;margin-bottom:16px;line-height:1.5;">
                Keep your files in sync across devices using your own self-hosted sync server. Credentials are encrypted at rest.
            </p>

            <h4>Provider</h4>
            <div class="settings-row">
                <div>
                    <div class="settings-row-label">Sync Backend</div>
                    <div class="settings-row-desc">Choose where to store your synced data</div>
                </div>
                <select id="sync-provider-${windowId}" class="settings-input" style="width:220px;">
                    <option value="none" ${provider==='none' ?'selected':''}>None</option>
                    <option value="rest" ${provider==='rest' ?'selected':''}>Ephemera Sync Server</option>
                </select>
            </div>

            <div class="settings-row">
                <div>
                    <div class="settings-row-label">Auto-Sync</div>
                    <div class="settings-row-desc">Automatically sync on file changes (1.5s debounce)</div>
                </div>
                <div class="toggle ${autoEnabled ? 'on' : ''}" id="sync-auto-${windowId}"></div>
            </div>

            <!-- REST panel -->
            <div id="sync-panel-rest-${windowId}" style="${restHide}margin-top:16px;">
                <h4>Sync Server Settings</h4>
                <div class="settings-row">
                    <div class="settings-row-label">Server URL</div>
                    <input type="url" id="sync-rest-url-${windowId}" class="settings-input"
                        placeholder="http://localhost:3001"
                        value="${EphemeraSanitize.escapeHtml(s.syncRestUrl || '')}">
                </div>
                <div class="settings-row">
                    <div class="settings-row-label">Auth Token</div>
                    <input type="password" id="sync-rest-token-${windowId}" class="settings-input"
                        placeholder="••••••••">
                </div>
                <div style="margin-top:12px;">
                    <button class="btn" id="sync-test-rest-${windowId}">Test Connection</button>
                </div>
            </div>

            <!-- Status row -->
            <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                <div>
                    <div style="font-size:0.85rem;color:var(--fg-secondary);">
                        Status: <span id="sync-status-${windowId}" style="color:var(--fg-primary);">Idle</span>
                    </div>
                    <div id="sync-last-${windowId}" style="font-size:0.75rem;color:var(--fg-muted);margin-top:4px;">
                        Last synced: ${lastAt}
                    </div>
                </div>
                <button class="btn" id="sync-now-${windowId}">Sync Now</button>
            </div>
        </div>
    `;
}

function initSyncHandlers(windowId, lifecycle) {
    const providerSel  = document.getElementById(`sync-provider-${windowId}`);
    const autoToggle   = document.getElementById(`sync-auto-${windowId}`);
    const statusEl     = document.getElementById(`sync-status-${windowId}`);
    const lastEl       = document.getElementById(`sync-last-${windowId}`);
    const syncNowBtn   = document.getElementById(`sync-now-${windowId}`);
    const restPanel    = document.getElementById(`sync-panel-rest-${windowId}`);

    function showPanel(name) {
        if (restPanel) restPanel.style.display = name === 'rest' ? '' : 'none';
    }

    function updateStatus({ status, error, lastSyncAt }) {
        const labels = { idle: 'Idle', syncing: 'Syncing…', synced: 'Synced', error: 'Error' };
        const colors = { idle: 'var(--fg-secondary)', syncing: 'var(--warning)', synced: 'var(--accent)', error: 'var(--danger)' };
        if (statusEl) {
            statusEl.textContent = error ? `Error: ${error}` : (labels[status] || status);
            statusEl.style.color = colors[status] || 'var(--fg-primary)';
        }
        if (lastEl && lastSyncAt) {
            lastEl.textContent = 'Last synced: ' + new Date(lastSyncAt).toLocaleString();
        }
    }

    lifecycle.addSubscription(EphemeraEvents.on('sync:status', updateStatus));

    // provider selector
    if (providerSel) {
        lifecycle.addListener(providerSel, 'change', async () => {
            const name = providerSel.value;
            showPanel(name);
            EphemeraState.updateSetting('syncProvider', name);
            if (typeof EphemeraSyncManager !== 'undefined') {
                await EphemeraSyncManager._initProvider(name).catch(() => {});
            }
        });
    }

    // auto-sync toggle
    if (autoToggle) {
        lifecycle.addListener(autoToggle, 'click', () => {
            autoToggle.classList.toggle('on');
            EphemeraState.updateSetting('syncAutoEnabled', autoToggle.classList.contains('on'));
        });
    }

    // ── REST fields ──────────────────────────────────────────────────────────
    const restUrl   = document.getElementById(`sync-rest-url-${windowId}`);
    const restToken = document.getElementById(`sync-rest-token-${windowId}`);
    const testRest  = document.getElementById(`sync-test-rest-${windowId}`);

    if (restUrl) {
        lifecycle.addListener(restUrl, 'change', () =>
            EphemeraState.updateSetting('syncRestUrl', restUrl.value.trim()));
    }
    if (restToken) {
        lifecycle.addListener(restToken, 'change', async () => {
            if (restToken.value) {
                await EphemeraStorage.put('metadata', { key: 'syncRestToken', value: restToken.value });
            }
        });
    }
    if (testRest) {
        lifecycle.addListener(testRest, 'click', async () => {
            testRest.disabled = true;
            testRest.textContent = 'Testing…';
            try {
                if (restUrl?.value)  EphemeraState.updateSetting('syncRestUrl', restUrl.value.trim());
                if (restToken?.value) await EphemeraStorage.put('metadata', { key: 'syncRestToken', value: restToken.value });
                await EphemeraSyncManager._initProvider('rest');
                await EphemeraSyncManager.testConnection();
                EphemeraNotifications.success('Sync Server Connected', 'Connection successful.');
            } catch (e) {
                EphemeraNotifications.error('Sync Server Error', e.message);
            } finally {
                testRest.disabled = false;
                testRest.textContent = 'Test Connection';
            }
        });
    }

    // ── Sync Now ──────────────────────────────────────────────────────────────
    if (syncNowBtn) {
        lifecycle.addListener(syncNowBtn, 'click', async () => {
            syncNowBtn.disabled = true;
            syncNowBtn.textContent = 'Syncing…';
            try {
                if (typeof EphemeraSyncManager !== 'undefined') {
                    await EphemeraSyncManager.syncAll();
                }
            } catch (e) {
                EphemeraNotifications.error('Sync Failed', e.message);
            } finally {
                syncNowBtn.disabled = false;
                syncNowBtn.textContent = 'Sync Now';
            }
        });
    }
}

function applyWallpaperSelection(type) {
    if (window.EphemeraBoot?.setWallpaperForCurrentWorkspace) {
        EphemeraBoot.setWallpaperForCurrentWorkspace(type, {
            persist: true,
            syncSelection: true
        });
        return;
    }

    // Fallback for partial runtime contexts (tests/older boots).
    EphemeraState.wallpaper = type;
    EphemeraState.save?.();
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    if (type === 'particles') {
        desktop.style.background = 'transparent';
    } else {
        const wallpapers = {
            solid: '#0a0a0f',
            gradient1: 'linear-gradient(135deg, #0f0f1a, #1a0a2e)',
            gradient2: 'linear-gradient(135deg, #0a1a1a, #0a2e1a)',
            gradient3: 'linear-gradient(135deg, #1a0a0a, #2e1a0a)',
            gradient4: 'linear-gradient(135deg, #0a0a1a, #1a2e3e)'
        };
        desktop.style.background = wallpapers[type] || wallpapers.solid;
    }
    document.querySelectorAll('.wallpaper-option').forEach((el) => {
        el.classList.toggle('selected', el.dataset.wallpaper === type);
    });
}
