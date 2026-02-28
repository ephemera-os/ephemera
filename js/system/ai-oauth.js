const AI_OAUTH_STORAGE_KEY = 'ai_oauth_tokens';
const AI_OAUTH_SESSION_CACHE_KEY = 'ephemera_ai_oauth_cache';
const AI_OAUTH_PENDING_KEY = 'ephemera_ai_oauth_pending';
const AI_OAUTH_PENDING_MAX_AGE_MS = 15 * 60 * 1000;
const AI_OAUTH_TOKEN_EXPIRY_SKEW_MS = 30 * 1000;

const AI_OAUTH_CONFIGS = {
    chatgpt: {
        authorizeUrl: 'https://auth0.openai.com/authorize',
        tokenUrl: 'https://auth0.openai.com/oauth/token',
        scopes: ['openid', 'profile', 'email', 'model.read', 'model.request'],
        audience: 'https://api.openai.com/v1',
        getClientId() {
            return String(import.meta?.env?.VITE_OPENAI_OAUTH_CLIENT_ID || '').trim();
        }
    }
};

function _aiOAuthSafeJsonParse(raw, fallback = null) {
    if (!raw || typeof raw !== 'string') return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function _aiOAuthBytesToBase64Url(bytesLike) {
    const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike || []);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

const EphemeraAIOAuth = {
    _tokens: {},
    _initialized: false,
    _initPromise: null,

    async init() {
        if (this._initPromise) {
            return this._initPromise;
        }

        this._initPromise = (async () => {
            this._loadSessionCache();
            await this._loadTokensFromStorage();
            this._initialized = true;
            return this;
        })();

        return this._initPromise;
    },

    isConnected(provider) {
        const record = this._tokens[provider];
        return Boolean(record?.accessToken) && !this._isTokenExpired(record);
    },

    async getAccessToken(provider) {
        await this.init();
        const record = this._tokens[provider];
        if (!record?.accessToken) return '';

        if (this._isTokenExpired(record)) {
            const refreshed = await this._refreshToken(provider);
            if (!refreshed) {
                await this.disconnect(provider);
                return '';
            }
            return this._tokens[provider]?.accessToken || '';
        }

        return record.accessToken;
    },

    async connect(provider) {
        await this.init();

        const config = AI_OAUTH_CONFIGS[provider];
        if (!config) {
            throw new Error(`Unknown AI OAuth provider: ${provider}`);
        }

        const clientId = config.getClientId();
        if (!clientId) {
            throw new Error('OpenAI OAuth client ID is not configured. Set VITE_OPENAI_OAUTH_CLIENT_ID in your environment.');
        }

        const state = this._randomToken(32);
        const codeVerifier = this._randomToken(64);
        const codeChallenge = await this._createCodeChallenge(codeVerifier);
        const redirectUri = `${window.location.origin}/api/ai-oauth/callback`;

        sessionStorage.setItem(AI_OAUTH_PENDING_KEY, JSON.stringify({
            provider,
            state,
            codeVerifier,
            createdAt: Date.now()
        }));

        const authUrl = new URL(config.authorizeUrl);
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', config.scopes.join(' '));
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        if (config.audience) {
            authUrl.searchParams.set('audience', config.audience);
        }

        return new Promise((resolve, reject) => {
            const popup = window.open(
                authUrl.toString(),
                'ai_oauth_popup',
                'width=600,height=700,scrollbars=yes,resizable=yes'
            );

            if (!popup) {
                sessionStorage.removeItem(AI_OAUTH_PENDING_KEY);
                reject(new Error('Popup was blocked. Please allow popups for this site.'));
                return;
            }

            const onMessage = async (event) => {
                if (event.origin !== window.location.origin) return;

                const data = event.data;
                if (!data || data.type !== 'ai-oauth-callback') return;

                window.removeEventListener('message', onMessage);
                clearInterval(pollClosed);

                if (data.error) {
                    sessionStorage.removeItem(AI_OAUTH_PENDING_KEY);
                    reject(new Error(data.error_description || data.error));
                    return;
                }

                const pending = _aiOAuthSafeJsonParse(sessionStorage.getItem(AI_OAUTH_PENDING_KEY));
                sessionStorage.removeItem(AI_OAUTH_PENDING_KEY);

                if (!pending || pending.state !== data.state) {
                    reject(new Error('OAuth state mismatch. Please try again.'));
                    return;
                }

                try {
                    this._tokens[provider] = {
                        accessToken: data.access_token,
                        refreshToken: data.refresh_token || '',
                        expiresAt: data.expires_in
                            ? Date.now() + Number(data.expires_in) * 1000
                            : null,
                        user: data.user || null
                    };

                    this._syncSessionCache();
                    await this._persistTokens();
                    this._emitUpdate();

                    if (window.EphemeraNotifications?.success) {
                        const label = this._tokens[provider]?.user?.name || 'Connected';
                        window.EphemeraNotifications.success('ChatGPT Connected', label);
                    }

                    resolve(this.getStatus(provider));
                } catch (err) {
                    reject(err);
                }
            };

            window.addEventListener('message', onMessage);

            const pollClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(pollClosed);
                    window.removeEventListener('message', onMessage);
                    sessionStorage.removeItem(AI_OAUTH_PENDING_KEY);
                    reject(new Error('OAuth popup was closed before completing sign-in.'));
                }
            }, 500);
        });
    },

    async disconnect(provider) {
        const wasConnected = Boolean(this._tokens[provider]?.accessToken);
        delete this._tokens[provider];
        this._syncSessionCache();
        await this._persistTokens();
        this._emitUpdate();
        return wasConnected;
    },

    getStatus(provider) {
        const record = this._tokens[provider];
        return {
            connected: this.isConnected(provider),
            user: record?.user || null,
            expiresAt: record?.expiresAt || null
        };
    },

    async _refreshToken(provider) {
        const record = this._tokens[provider];
        if (!record?.refreshToken) return false;

        try {
            const response = await fetch('/api/ai-oauth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refresh_token: record.refreshToken,
                    provider
                })
            });

            if (!response.ok) return false;

            const data = await response.json();
            if (!data.access_token) return false;

            this._tokens[provider] = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token || record.refreshToken,
                expiresAt: data.expires_in
                    ? Date.now() + Number(data.expires_in) * 1000
                    : null,
                user: record.user
            };

            this._syncSessionCache();
            await this._persistTokens();
            return true;
        } catch {
            return false;
        }
    },

    _isTokenExpired(record) {
        if (!record || !record.expiresAt) return false;
        return Date.now() + AI_OAUTH_TOKEN_EXPIRY_SKEW_MS >= Number(record.expiresAt);
    },

    _randomToken(byteLength = 32) {
        const bytes = new Uint8Array(Math.max(16, Number(byteLength) || 32));
        crypto.getRandomValues(bytes);
        return _aiOAuthBytesToBase64Url(bytes);
    },

    async _createCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(verifier || '')));
        return _aiOAuthBytesToBase64Url(new Uint8Array(digest));
    },

    _loadSessionCache() {
        const cached = _aiOAuthSafeJsonParse(sessionStorage.getItem(AI_OAUTH_SESSION_CACHE_KEY));
        if (!cached || typeof cached !== 'object') return;
        for (const [key, value] of Object.entries(cached)) {
            if (value && typeof value === 'object') {
                this._tokens[key] = { ...value };
            }
        }
    },

    _syncSessionCache() {
        const payload = {};
        for (const [key, value] of Object.entries(this._tokens)) {
            payload[key] = value ? { ...value } : null;
        }
        const hasAny = Object.values(payload).some(Boolean);
        if (hasAny) {
            sessionStorage.setItem(AI_OAUTH_SESSION_CACHE_KEY, JSON.stringify(payload));
        } else {
            sessionStorage.removeItem(AI_OAUTH_SESSION_CACHE_KEY);
        }
    },

    async _loadTokensFromStorage() {
        if (!window.EphemeraStorage?.get) return false;
        try {
            const record = await window.EphemeraStorage.get('metadata', AI_OAUTH_STORAGE_KEY);
            const value = record?.value;
            if (!value || typeof value !== 'object') return false;
            for (const [key, data] of Object.entries(value)) {
                if (data && typeof data === 'object') {
                    this._tokens[key] = { ...data };
                }
            }
            this._syncSessionCache();
            return true;
        } catch {
            return false;
        }
    },

    async _persistTokens() {
        this._syncSessionCache();
        if (!window.EphemeraStorage?.put) return false;
        try {
            const value = {};
            for (const [key, data] of Object.entries(this._tokens)) {
                value[key] = data ? { ...data } : null;
            }
            await window.EphemeraStorage.put('metadata', {
                key: AI_OAUTH_STORAGE_KEY,
                value,
                updatedAt: Date.now()
            });
            return true;
        } catch {
            return false;
        }
    },

    _emitUpdate() {
        window.EphemeraEvents?.emit?.('ai:oauth:updated', this.getStatus('chatgpt'));
    },

    _resetForTests() {
        this._tokens = {};
        this._initialized = false;
        this._initPromise = null;
        sessionStorage.removeItem(AI_OAUTH_SESSION_CACHE_KEY);
        sessionStorage.removeItem(AI_OAUTH_PENDING_KEY);
    }
};

window.EphemeraAIOAuth = EphemeraAIOAuth;

export default EphemeraAIOAuth;
