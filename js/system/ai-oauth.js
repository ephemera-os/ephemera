const AI_AUTH_DEFAULT_API_BASE_PATH = '/api';
const AI_AUTH_POLL_TIMEOUT_MS = 16 * 60 * 1000;
const AI_AUTH_MIN_POLL_INTERVAL_MS = 3000;
const AI_AUTH_POPUP_FEATURES = 'width=640,height=760,scrollbars=yes,resizable=yes';

function _aiNormalizePath(path, fallback = '/') {
    let value = String(path || '').trim();
    if (!value) value = fallback;
    if (!value.startsWith('/')) value = `/${value}`;
    value = value.replace(/\/{2,}/g, '/');
    if (value.length > 1) {
        value = value.replace(/\/+$/g, '');
    }
    return value || '/';
}

function _aiJoinPath(basePath, suffix) {
    const base = _aiNormalizePath(basePath, '/');
    const child = String(suffix || '').replace(/^\/+/, '');
    if (!child) return base;
    if (base === '/') return `/${child}`;
    return `${base}/${child}`;
}

function _aiResolveApiBasePath() {
    const configured = String(import.meta?.env?.VITE_AI_OAUTH_API_BASE_PATH || '').trim();
    if (configured) {
        return _aiNormalizePath(configured, AI_AUTH_DEFAULT_API_BASE_PATH);
    }

    const basePath = _aiNormalizePath(import.meta?.env?.BASE_URL || '/', '/');
    if (basePath === '/') {
        return AI_AUTH_DEFAULT_API_BASE_PATH;
    }
    return _aiJoinPath(basePath, 'api');
}

const AI_AUTH_API_BASE_PATH = _aiResolveApiBasePath();
const AI_AUTH_STATUS_PATH = _aiJoinPath(AI_AUTH_API_BASE_PATH, 'ai-oauth/status');
const AI_AUTH_DEVICE_START_PATH = _aiJoinPath(AI_AUTH_API_BASE_PATH, 'ai-oauth/device-start');
const AI_AUTH_DEVICE_POLL_PATH = _aiJoinPath(AI_AUTH_API_BASE_PATH, 'ai-oauth/device-poll');
const AI_AUTH_LOGOUT_PATH = _aiJoinPath(AI_AUTH_API_BASE_PATH, 'ai-oauth/logout');

const DEFAULT_STATUS = Object.freeze({
    connected: false,
    user: null,
    expiresAt: null,
    accountId: ''
});

const EphemeraAIOAuth = {
    _status: { chatgpt: { ...DEFAULT_STATUS } },
    _initialized: false,
    _initPromise: null,

    async init() {
        if (this._initPromise) {
            return this._initPromise;
        }

        this._initPromise = (async () => {
            await this.refreshStatus('chatgpt').catch(() => {
                this._status.chatgpt = { ...DEFAULT_STATUS };
            });
            this._initialized = true;
            return this;
        })();

        return this._initPromise;
    },

    isConnected(provider = 'chatgpt') {
        const status = this._status[String(provider || 'chatgpt')] || DEFAULT_STATUS;
        return Boolean(status.connected);
    },

    getStatus(provider = 'chatgpt') {
        const status = this._status[String(provider || 'chatgpt')] || DEFAULT_STATUS;
        return {
            connected: Boolean(status.connected),
            user: status.user || null,
            expiresAt: Number(status.expiresAt || 0) || null,
            accountId: String(status.accountId || '')
        };
    },

    async refreshStatus(provider = 'chatgpt') {
        const targetProvider = String(provider || 'chatgpt');
        const response = await this._requestJson(AI_AUTH_STATUS_PATH, 'GET');
        this._status[targetProvider] = this._normalizeStatus(response);
        this._emitUpdate(targetProvider);
        return this.getStatus(targetProvider);
    },

    async connect(provider = 'chatgpt') {
        const targetProvider = String(provider || 'chatgpt');
        if (targetProvider !== 'chatgpt') {
            throw new Error(`Unsupported provider: ${targetProvider}`);
        }

        // Open a blank popup before async work to preserve transient user activation.
        const popupHandle = this._openVerificationWindow();
        let start;
        try {
            await this.init();
            start = await this._requestJson(AI_AUTH_DEVICE_START_PATH, 'POST', {});
        } catch (error) {
            this._closePopup(popupHandle);
            throw error;
        }

        const verificationUrl = String(start.verification_url || 'https://auth.openai.com/codex/device').trim();
        const userCode = String(start.user_code || '').trim();

        if (!userCode) {
            this._closePopup(popupHandle);
            throw new Error('Server did not return a device code.');
        }

        const intervalMs = Math.max(
            Number(start.interval_ms || start.interval || 0) || AI_AUTH_MIN_POLL_INTERVAL_MS,
            AI_AUTH_MIN_POLL_INTERVAL_MS
        );

        const opened = this._openVerificationUrl(verificationUrl, popupHandle);
        if (!opened) {
            this._closePopup(popupHandle);
        }
        const instruction = opened
            ? `Enter this code to continue: ${userCode}`
            : `Open ${verificationUrl} and enter code: ${userCode}`;

        window.EphemeraNotifications?.info?.('ChatGPT Sign-in', instruction);

        const status = await this._pollForAuthorization(intervalMs);
        this._status[targetProvider] = this._normalizeStatus(status);
        this._emitUpdate(targetProvider);

        const label = this._status[targetProvider]?.user?.name
            || this._status[targetProvider]?.user?.email
            || this._status[targetProvider]?.accountId
            || 'Connected';
        window.EphemeraNotifications?.success?.('ChatGPT Connected', String(label));

        return this.getStatus(targetProvider);
    },

    async disconnect(provider = 'chatgpt') {
        const targetProvider = String(provider || 'chatgpt');
        await this._requestJson(AI_AUTH_LOGOUT_PATH, 'POST', {});
        this._status[targetProvider] = { ...DEFAULT_STATUS };
        this._emitUpdate(targetProvider);
        return true;
    },

    async getAccessToken(_provider = 'chatgpt') {
        return '';
    },

    async _pollForAuthorization(intervalMs) {
        const startedAt = Date.now();
        let lastError = null;

        while (Date.now() - startedAt < AI_AUTH_POLL_TIMEOUT_MS) {
            let response;
            try {
                response = await this._requestJson(AI_AUTH_DEVICE_POLL_PATH, 'POST', {});
            } catch (error) {
                lastError = error;
                const statusCode = Number(error?.status || 0);
                if (statusCode >= 400 && statusCode < 600) {
                    throw error;
                }
                await this._sleep(intervalMs);
                continue;
            }

            const status = String(response?.status || '').toLowerCase();
            if (status === 'authorized' || response?.connected === true) {
                return response;
            }

            if (status === 'pending' || status === 'authorization_pending' || status === '') {
                await this._sleep(intervalMs);
                continue;
            }

            const detail = String(response?.error_description || response?.error || 'Authorization failed.');
            throw new Error(detail);
        }

        if (lastError?.message) {
            throw new Error(`Sign-in timed out: ${lastError.message}`);
        }
        throw new Error('Sign-in timed out before authorization completed.');
    },

    _normalizeStatus(payload) {
        if (!payload || typeof payload !== 'object') {
            return { ...DEFAULT_STATUS };
        }

        const user = payload.user && typeof payload.user === 'object'
            ? {
                name: String(payload.user.name || '').trim(),
                email: String(payload.user.email || '').trim()
            }
            : null;

        return {
            connected: Boolean(payload.connected),
            user,
            expiresAt: Number(payload.expiresAt || payload.expires_at || 0) || null,
            accountId: String(payload.accountId || payload.account_id || '').trim()
        };
    },

    _openVerificationWindow() {
        try {
            return window.open('', 'ephemera_ai_device_auth', AI_AUTH_POPUP_FEATURES);
        } catch {
            return null;
        }
    },

    _openVerificationUrl(url, popupHandle = null) {
        if (!url) return false;
        try {
            if (popupHandle && !popupHandle.closed) {
                popupHandle.location.href = url;
                popupHandle.focus?.();
                return true;
            }

            const popup = window.open(url, 'ephemera_ai_device_auth', AI_AUTH_POPUP_FEATURES);
            return Boolean(popup);
        } catch {
            return false;
        }
    },

    _closePopup(popupHandle) {
        if (!popupHandle || popupHandle.closed) return;
        try {
            popupHandle.close();
        } catch {
            // Ignore close failures for cross-origin popups.
        }
    },

    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
    },

    async _requestJson(url, method = 'GET', body = null) {
        const headers = {
            'Accept': 'application/json'
        };
        const request = {
            method,
            credentials: 'same-origin',
            headers
        };

        if (body !== null && method !== 'GET') {
            headers['Content-Type'] = 'application/json';
            request.body = JSON.stringify(body);
        }

        const response = await fetch(url, request);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            const message = String(payload?.error_description || payload?.error || `Request failed (${response.status})`);
            const error = new Error(message);
            error.status = Number(response.status || 0);
            error.payload = payload;
            throw error;
        }

        return payload;
    },

    _emitUpdate(provider = 'chatgpt') {
        window.EphemeraEvents?.emit?.('ai:oauth:updated', this.getStatus(provider));
    },

    _resetForTests() {
        this._status = { chatgpt: { ...DEFAULT_STATUS } };
        this._initialized = false;
        this._initPromise = null;
    }
};

window.EphemeraAIOAuth = EphemeraAIOAuth;

export default EphemeraAIOAuth;
