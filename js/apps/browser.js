EphemeraApps.register({
    id: 'browser',
    name: 'Browser',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
    width: 1000,
    height: 700,
    category: 'internet',
    content: (windowId, options = {}) => {
        const startUrl = options.url || 'https://example.com';
        
        return {
            html: `
                <style>
                    .browser-container { display:flex;flex-direction:column;height:100%;padding:0; }
                    .browser-toolbar { display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(0,0,0,0.2);border-bottom:1px solid var(--border); }
                    .browser-toolbar button { width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-secondary);transition:all 0.15s; }
                    .browser-toolbar button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .browser-toolbar button:disabled { opacity:0.4;cursor:not-allowed; }
                    .browser-toolbar button svg { width:16px;height:16px; }
                    .browser-url-bar { flex:1;display:flex;align-items:center;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:0 12px; }
                    .browser-url-bar svg { width:14px;height:14px;opacity:0.5;margin-right:8px; }
                    .browser-url-bar input { flex:1;background:transparent;border:none;color:var(--fg-primary);font-size:0.9rem;padding:8px 0;outline:none; }
                    .browser-url-bar .secure { color:var(--success); }
                    .browser-content { flex:1;position:relative;background:#fff;overflow:hidden; }
                    .browser-content iframe { width:100%;height:100%;border:none;background:#fff; }
                    .browser-loading { position:absolute;inset:0;background:var(--bg-primary);display:none;align-items:center;justify-content:center;color:var(--fg-muted); }
                    .browser-loading.active { display:flex; }
                    .browser-error { position:absolute;inset:0;background:var(--bg-primary);display:none;flex-direction:column;align-items:center;justify-content:center;color:var(--fg-muted);padding:40px;text-align:center; }
                    .browser-error.active { display:flex; }
                    .browser-error h3 { color:var(--danger);margin-bottom:12px; }
                    .browser-error p { margin-bottom:8px;max-width:400px; }
                    .browser-tabs { display:flex;background:rgba(0,0,0,0.3);padding:4px 8px 0;gap:4px; }
                    .browser-tab { display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:var(--radius-sm) var(--radius-sm) 0 0;cursor:pointer;font-size:0.8rem;max-width:180px; }
                    .browser-tab.active { background:var(--bg-primary); }
                    .browser-tab span { flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
                    .browser-tab .close { opacity:0.5; }
                    .browser-tab .close:hover { opacity:1; }
                    .browser-tab-new { padding:8px 12px;background:transparent;border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-muted); }
                    .browser-tab-new:hover { background:rgba(255,255,255,0.05);color:var(--fg-primary); }
                    .browser-statusbar { display:flex;justify-content:space-between;padding:4px 12px;background:rgba(0,0,0,0.2);border-top:1px solid var(--border);font-size:0.7rem;color:var(--fg-muted); }
                    .browser-proxy-notice { padding:6px 12px;background:rgba(255,184,77,0.1);border-bottom:1px solid var(--warning);font-size:0.75rem;color:var(--warning);display:flex;align-items:center;gap:8px; }
                </style>
                <div class="browser-container">
                    <div class="browser-tabs" id="browser-tabs-${windowId}">
                        <div class="browser-tab active" data-tab="0">
                            <span>New Tab</span>
                            <span class="close">×</span>
                        </div>
                        <div class="browser-tab-new" id="new-tab-${windowId}" title="New Tab">+</div>
                    </div>
                    <div class="browser-toolbar">
                        <button id="browser-back-${windowId}" title="Back">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <button id="browser-forward-${windowId}" title="Forward">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                        <button id="browser-refresh-${windowId}" title="Refresh">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.22-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
                        </button>
                        <button id="browser-home-${windowId}" title="Home">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                        </button>
                        <div class="browser-url-bar">
                            <svg id="secure-icon-${windowId}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                            <input type="text" id="browser-url-${windowId}" value="${startUrl}" placeholder="Enter URL...">
                        </div>
                        <button id="browser-go-${windowId}" title="Go">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                        </button>
                        <button id="browser-proxy-${windowId}" title="Toggle Proxy">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                        </button>
                    </div>
                    ${EphemeraState.settings.proxyEnabled ? `
                        <div class="browser-proxy-notice" id="proxy-notice-${windowId}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                            Using CORS proxy. Some sites may not work correctly.
                            <button style="margin-left:auto;background:none;border:none;color:var(--warning);cursor:pointer;text-decoration:underline;" id="proxy-settings-${windowId}">Settings</button>
                        </div>
                    ` : ''}
                    <div class="browser-content" id="browser-content-${windowId}">
                        <div class="browser-loading" id="browser-loading-${windowId}">
                            Loading...
                        </div>
                        <div class="browser-error" id="browser-error-${windowId}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64" style="opacity:0.3;margin-bottom:20px;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                            <h3>Unable to load page</h3>
                            <p id="error-message-${windowId}">The page couldn't be loaded.</p>
                            <p style="font-size:0.8rem;margin-top:16px;">
                                Try enabling CORS proxy in Settings, or the site may block embedding.
                            </p>
                            <button class="btn" style="margin-top:16px;" id="open-external-${windowId}">Open in New Tab</button>
                        </div>
                    </div>
                    <div class="browser-statusbar" id="browser-status-${windowId}">
                        <span id="browser-status-text-${windowId}">Ready</span>
                        <span id="browser-proxy-status-${windowId}">Proxy: ${EphemeraState.settings.proxyEnabled ? 'On' : 'Off'}</span>
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const urlInput = document.getElementById(`browser-url-${windowId}`);
                const content = document.getElementById(`browser-content-${windowId}`);
                const loading = document.getElementById(`browser-loading-${windowId}`);
                const errorDiv = document.getElementById(`browser-error-${windowId}`);
                const errorMsg = document.getElementById(`error-message-${windowId}`);
                const statusText = document.getElementById(`browser-status-text-${windowId}`);
                const proxyStatus = document.getElementById(`browser-proxy-status-${windowId}`);
                const secureIcon = document.getElementById(`secure-icon-${windowId}`);
                
                let currentUrl = '';
                let useProxy = EphemeraState.settings.proxyEnabled;
                let iframe = null;
                
                function normalizeUrl(url) {
                    if (!url) return '';
                    url = url.trim();
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        url = 'https://' + url;
                    }
                    return url;
                }
                
                function navigate(url) {
                    url = normalizeUrl(url);
                    if (!url) return;
                    
                    currentUrl = url;
                    urlInput.value = url;
                    statusText.textContent = 'Loading ' + url;
                    
                    const isSecure = url.startsWith('https://');
                    secureIcon.classList.toggle('secure', isSecure);
                    secureIcon.innerHTML = isSecure 
                        ? `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>`
                        : `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><line x1="3" y1="3" x2="21" y2="21" stroke="var(--danger)"/>`;
                    
                    loading.classList.add('active');
                    errorDiv.classList.remove('active');
                    
                    if (iframe) iframe.remove();
                    
                    iframe = document.createElement('iframe');
                    iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups');
                    iframe.style.display = 'none';
                    
                    const loadUrl = useProxy ? EphemeraNetwork.buildUrl(url) : url;
                    
                    iframe.onload = () => {
                        loading.classList.remove('active');
                        iframe.style.display = 'block';
                        statusText.textContent = url;
                    };
                    
                    iframe.onerror = () => {
                        loading.classList.remove('active');
                        showLoadError('Failed to load the page.');
                    };
                    
                    content.appendChild(iframe);
                    
                    setTimeout(() => {
                        try {
                            iframe.src = loadUrl;
                        } catch (e) {
                            showLoadError(e.message);
                        }
                        
                        setTimeout(() => {
                            if (loading.classList.contains('active')) {
                                loading.classList.remove('active');
                                showLoadError('Loading timeout. The site may not allow embedding.');
                            }
                        }, 15000);
                    }, 100);
                }
                
                function showLoadError(message) {
                    loading.classList.remove('active');
                    errorDiv.classList.add('active');
                    errorMsg.textContent = message;
                    statusText.textContent = 'Error loading page';
                }
                
                const goBtn = document.getElementById(`browser-go-${windowId}`);
                const refreshBtn = document.getElementById(`browser-refresh-${windowId}`);
                const homeBtn = document.getElementById(`browser-home-${windowId}`);
                const proxyBtn = document.getElementById(`browser-proxy-${windowId}`);
                const openExternalBtn = document.getElementById(`open-external-${windowId}`);
                const proxySettingsBtn = document.getElementById(`proxy-settings-${windowId}`);
                const newTabBtn = document.getElementById(`new-tab-${windowId}`);

                lifecycle.addListener(goBtn, 'click', () => navigate(urlInput.value));
                lifecycle.addListener(refreshBtn, 'click', () => navigate(currentUrl || urlInput.value));
                lifecycle.addListener(homeBtn, 'click', () => navigate('https://example.com'));

                lifecycle.addListener(urlInput, 'keydown', (e) => {
                    if (e.key === 'Enter') navigate(urlInput.value);
                });

                lifecycle.addListener(proxyBtn, 'click', () => {
                    useProxy = !useProxy;
                    proxyStatus.textContent = 'Proxy: ' + (useProxy ? 'On' : 'Off');
                    if (currentUrl) navigate(currentUrl);
                });

                lifecycle.addListener(openExternalBtn, 'click', () => {
                    if (currentUrl) window.open(currentUrl, '_blank');
                });

                if (proxySettingsBtn) {
                    lifecycle.addListener(proxySettingsBtn, 'click', () => {
                        EphemeraWM.open('settings');
                    });
                }

                if (newTabBtn) {
                    lifecycle.addListener(newTabBtn, 'click', () => {
                        EphemeraWM.open('browser');
                    });
                }

                navigate(startUrl);

                return {
                    destroy: () => {
                        // Clean up iframe to prevent memory leak
                        if (iframe) {
                            iframe.src = 'about:blank';
                            iframe.remove();
                            iframe = null;
                        }
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
