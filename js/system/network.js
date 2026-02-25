const EphemeraNetwork = {
    defaultProxies: [
        { name: 'AllOrigins', url: 'https://api.allorigins.win/raw?url=', encode: true, healthy: true, lastCheck: 0 },
        { name: 'CorsProxy', url: 'https://corsproxy.io/?', encode: false, healthy: true, lastCheck: 0 },
        { name: 'CodeTabs', url: 'https://api.codetabs.com/v1/proxy?quest=', encode: true, healthy: true, lastCheck: 0 }
    ],

    _csrfToken: null,
    _currentProxyIndex: 0,
    _proxyHealthCheckInterval: 60000, // 1 minute
    MAX_REDIRECTS: 5,
    REQUEST_TIMEOUT: 30000,

    init() {
        this._csrfToken = this._generateCSRFToken();
        sessionStorage.setItem('ephemera_csrf_token', this._csrfToken);
    },

    _generateCSRFToken() {
        const stored = sessionStorage.getItem('ephemera_csrf_token');
        if (stored) return stored;
        
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    getCSRFToken() {
        if (!this._csrfToken) {
            this._csrfToken = this._generateCSRFToken();
        }
        return this._csrfToken;
    },

    isProxyEnabled() {
        return window.EphemeraState?.settings?.proxyEnabled === true;
    },

    _getCustomProxySetting() {
        const raw = window.EphemeraState?.settings?.proxyUrl;
        if (!raw || typeof raw !== 'string') return null;
        const trimmed = raw.trim();
        return trimmed || null;
    },

    _getDefaultProxyByUrl(proxyUrl) {
        if (!proxyUrl) return null;
        return this.defaultProxies.find(p => proxyUrl.includes(p.url.split('?')[0])) || null;
    },

    _hasCustomProxyConfigured() {
        const customProxyUrl = this._getCustomProxySetting();
        if (!customProxyUrl) return false;
        return !this._getDefaultProxyByUrl(customProxyUrl);
    },

    _guessProxyEncoding(proxyUrl) {
        if (!proxyUrl) return true;
        if (proxyUrl.includes('{url}')) return true;
        if (proxyUrl.includes('corsproxy.io/?')) return false;
        if (proxyUrl.includes('allorigins.win/raw?url=')) return true;
        if (proxyUrl.includes('codetabs.com/v1/proxy?quest=')) return true;
        return true;
    },

    _getConfiguredProxy() {
        if (!this.isProxyEnabled()) {
            return null;
        }

        const customProxyUrl = this._getCustomProxySetting();
        if (customProxyUrl) {
            const knownProxy = this._getDefaultProxyByUrl(customProxyUrl);
            if (knownProxy) {
                return knownProxy;
            }

            return {
                name: 'Custom',
                url: customProxyUrl,
                encode: this._guessProxyEncoding(customProxyUrl),
                healthy: true,
                custom: true
            };
        }

        return this._getNextHealthyProxy();
    },

    getProxyUrl() {
        return this._getConfiguredProxy()?.url || null;
    },

    _getNextHealthyProxy() {
        const now = Date.now();

        // Try to find a healthy proxy, starting from current index
        for (let i = 0; i < this.defaultProxies.length; i++) {
            const idx = (this._currentProxyIndex + i) % this.defaultProxies.length;
            const proxy = this.defaultProxies[idx];

            // Consider proxy healthy if last check was recent and it was healthy
            if (proxy.healthy || (now - proxy.lastCheck) > this._proxyHealthCheckInterval) {
                return proxy;
            }
        }

        // All proxies marked unhealthy, reset and try first one
        this._resetProxyHealth();
        return this.defaultProxies[0];
    },

    _markProxyUnhealthy(proxyUrl) {
        const proxy = this.defaultProxies.find(p => proxyUrl.includes(p.url.split('?')[0]));
        if (proxy) {
            proxy.healthy = false;
            proxy.lastCheck = Date.now();
            // Move to next proxy
            this._currentProxyIndex = (this._currentProxyIndex + 1) % this.defaultProxies.length;

            console.warn(`[EphemeraNetwork] Proxy ${proxy.name} marked unhealthy, switching to ${this.defaultProxies[this._currentProxyIndex].name}`);

            if (window.EphemeraNotifications) {
                EphemeraNotifications.warning('Proxy Issue', `Switched from ${proxy.name} to ${this.defaultProxies[this._currentProxyIndex].name}`);
            }
        }
    },

    _resetProxyHealth() {
        for (const proxy of this.defaultProxies) {
            proxy.healthy = true;
            proxy.lastCheck = 0;
        }
        this._currentProxyIndex = 0;
    },

    async checkProxyHealth(proxy) {
        try {
            const testUrl = proxy.url + encodeURIComponent('https://httpbin.org/status/200');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(testUrl, {
                method: 'HEAD',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            proxy.healthy = response.ok;
            proxy.lastCheck = Date.now();
            return proxy.healthy;
        } catch {
            proxy.healthy = false;
            proxy.lastCheck = Date.now();
            return false;
        }
    },

    shouldEncodeUrl() {
        const proxy = this._getConfiguredProxy();
        if (!proxy) return false;
        return proxy.encode !== false;
    },
    
    buildUrl(url) {
        if (!this.isProxyEnabled()) {
            return url;
        }
        const proxy = this._getConfiguredProxy();
        return this._buildUrlWithProxy(url, proxy);
    },
    
    isCrossOrigin(url) {
        try {
            const target = new URL(url, window.location.origin);
            if (target.origin !== window.location.origin) {
                return true;
            }
        } catch {
            return true;
        }
        return false;
    },

    validateUrl(url) {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: 'URL is required' };
        }

        const trimmed = url.trim();
        
        if (trimmed.toLowerCase().startsWith('javascript:')) {
            return { valid: false, error: 'JavaScript URLs not allowed' };
        }
        
        if (trimmed.toLowerCase().startsWith('data:')) {
            return { valid: false, error: 'Data URLs not allowed' };
        }
        
        if (trimmed.toLowerCase().startsWith('vbscript:')) {
            return { valid: false, error: 'VBScript URLs not allowed' };
        }

        try {
            const parsed = new URL(trimmed, window.location.origin);
            
            const blockedSchemes = ['file', 'ftp', 'blob'];
            if (blockedSchemes.includes(parsed.protocol.replace(':', ''))) {
                return { valid: false, error: `Protocol ${parsed.protocol} not allowed` };
            }

            const privatePatterns = [
                /^127\./,
                /^10\./,
                /^172\.(1[6-9]|2[0-9]|3[01])\./,
                /^192\.168\./,
                /^169\.254\./,
                /^0\.0\.0\.0$/,
                /^localhost$/i,
                /^::1$/,
                /^fc00:/i,
                /^fe80:/i,
                /^\[::1\]$/
            ];

            const hostname = parsed.hostname;
            for (const pattern of privatePatterns) {
                if (pattern.test(hostname)) {
                    if (window.EphemeraTelemetry) {
                        window.EphemeraTelemetry.addBreadcrumb({
                            category: 'security',
                            message: 'Blocked request to private IP',
                            level: 'warning',
                            data: { hostname }
                        });
                    }
                    return { valid: false, error: 'Private IP addresses not allowed' };
                }
            }

            return { valid: true, url: parsed.href };
        } catch (e) {
            return { valid: false, error: 'Invalid URL format' };
        }
    },

    _getSecurityHeaders() {
        const headers = {
            'Accept': '*/*'
        };
        
        headers['X-CSRF-Token'] = this.getCSRFToken();
        headers['X-Requested-With'] = 'XMLHttpRequest';
        
        return headers;
    },
    
    async fetch(url, options = {}) {
        const validation = this.validateUrl(url);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const isCrossOrigin = this.isCrossOrigin(url);
        const proxyEnabled = this.isProxyEnabled();

        if (isCrossOrigin && !proxyEnabled) {
            throw new Error('CORS_ERROR');
        }

        // Try with auto-switch on failure
        let lastError = null;
        const configuredProxy = isCrossOrigin && proxyEnabled ? this._getConfiguredProxy() : null;
        const usingCustomProxy = !!configuredProxy?.custom;
        const attempts = isCrossOrigin && proxyEnabled
            ? (usingCustomProxy ? 1 : this.defaultProxies.length)
            : 1;

        for (let attempt = 0; attempt < attempts; attempt++) {
            const proxy = isCrossOrigin && proxyEnabled
                ? (usingCustomProxy ? configuredProxy : this._getNextHealthyProxy())
                : null;
            const finalUrl = isCrossOrigin ? this._buildUrlWithProxy(url, proxy) : url;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

            if (window.EphemeraTelemetry) {
                window.EphemeraTelemetry.addBreadcrumb({
                    category: 'network',
                    message: `Fetch request to ${url}`,
                    level: 'info',
                    data: { method: options.method || 'GET', proxy: proxy?.name || 'direct' }
                });
            }

            try {
                const response = await fetch(finalUrl, {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        ...this._getSecurityHeaders(),
                        ...options.headers
                    }
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                lastError = error;

                // If using proxy and it failed, try next proxy
                if (isCrossOrigin && proxyEnabled && proxy && !proxy.custom) {
                    this._markProxyUnhealthy(proxy.url);

                    // Don't retry on abort or specific errors
                    if (error.name === 'AbortError') {
                        throw new Error('Request timeout');
                    }
                } else {
                    // Direct request failed, don't retry
                    break;
                }
            }
        }

        // All attempts failed
        if (lastError?.name === 'AbortError') {
            throw new Error('Request timeout');
        }

        if (lastError?.message === 'CORS_ERROR') {
            throw new Error('CORS_ERROR');
        }
        if (lastError?.message?.includes('Failed to fetch') && !url.startsWith('http')) {
            throw new Error('Invalid URL. Make sure to include http:// or https://');
        }
        if (lastError?.message?.includes('Failed to fetch') && isCrossOrigin) {
            if (this._hasCustomProxyConfigured()) {
                throw new Error('Custom proxy failed to respond. Check Settings → Network and verify the proxy URL.');
            }
            throw new Error(this.formatAllProxiesFailedMessage());
        }

        if (window.EphemeraTelemetry && lastError) {
            window.EphemeraTelemetry.captureException(lastError, {
                tags: { component: 'network' },
                extra: { url }
            });
        }

        throw lastError || new Error('Network request failed');
    },

    _buildUrlWithProxy(url, proxy) {
        if (!proxy) return url;

        if (proxy.url.includes('{url}')) {
            return proxy.url.replace('{url}', encodeURIComponent(url));
        }

        return proxy.encode ? proxy.url + encodeURIComponent(url) : proxy.url + url;
    },

    formatAllProxiesFailedMessage() {
        return `All CORS proxies failed to respond.

Try the following:
1. Check your internet connection
2. Wait a moment and try again
3. In Settings → Network, try a different proxy
4. Use a browser extension like "CORS Unblock"

Proxies tried: ${this.defaultProxies.map(p => p.name).join(', ')}`;
    },
    
    formatCORSMessage() {
        return `CORS Error: Cross-origin requests blocked by browser security.

To access external URLs, you need to enable the CORS proxy:
1. Open Settings → Network
2. Enable "Proxy"
3. Try again

Alternatively, use a browser extension like "CORS Unblock" for development.`;
    },
    
    async get(url) {
        const response = await this.fetch(url);
        return response.text();
    },
    
    async getJSON(url) {
        const response = await this.fetch(url);
        return response.json();
    },
    
    async post(url, data, options = {}) {
        const isJson = typeof data === 'object' && data !== null;
        const response = await this.fetch(url, {
            method: 'POST',
            body: isJson ? JSON.stringify(data) : data,
            headers: {
                'Content-Type': isJson ? 'application/json' : 'text/plain',
                ...options.headers
            }
        });
        return response.text();
    },

    async postJSON(url, data, options = {}) {
        const response = await this.fetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            }
        });
        return response.json();
    },
    
    async download(url, filename) {
        const validation = this.validateUrl(url);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const response = await this.fetch(url);
        const blob = await response.blob();
        
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || this.getFilenameFromUrl(url);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    },
    
    getFilenameFromUrl(url) {
        try {
            const pathname = new URL(url).pathname;
            return pathname.split('/').pop() || 'download';
        } catch {
            return 'download';
        }
    },
    
    async head(url) {
        const response = await this.fetch(url, { method: 'HEAD' });
        return {
            ok: response.ok,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries())
        };
    },

    async put(url, data, options = {}) {
        const isJson = typeof data === 'object' && data !== null;
        return this.fetch(url, {
            method: 'PUT',
            body: isJson ? JSON.stringify(data) : data,
            headers: {
                'Content-Type': isJson ? 'application/json' : 'text/plain',
                ...options.headers
            }
        });
    },

    async del(url, options = {}) {
        return this.fetch(url, {
            method: 'DELETE',
            ...options
        });
    },

    isOnline() {
        return navigator.onLine;
    },

    getConnectionInfo() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            return {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
        }
        return null;
    }
};

window.EphemeraNetwork = EphemeraNetwork;
export default EphemeraNetwork;
