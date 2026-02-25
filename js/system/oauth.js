const OAUTH_STORAGE_KEY = 'oauth_tokens';
const GITHUB_PENDING_KEY = 'ephemera_oauth_github_pending';
const OAUTH_SESSION_CACHE_KEY = 'ephemera_oauth_cache';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

const DEFAULT_GITHUB_SCOPES = ['repo', 'read:user'];
const OAUTH_PENDING_MAX_AGE_MS = 15 * 60 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 30 * 1000;

function safeJsonParse(raw, fallback = null) {
    if (!raw || typeof raw !== 'string') return fallback;
    try {
        return JSON.parse(raw);
    } catch (_err) {
        return fallback;
    }
}

function bytesToBase64Url(bytesLike) {
    const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike || []);
    let base64 = '';

    if (typeof Buffer !== 'undefined') {
        base64 = Buffer.from(bytes).toString('base64');
    } else {
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
        }
        base64 = btoa(binary);
    }

    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function normalizeScopes(input) {
    const source = Array.isArray(input) ? input : String(input || '').split(/[\s,]+/);
    const unique = new Set();
    source.forEach((item) => {
        const scope = String(item || '').trim();
        if (scope) unique.add(scope);
    });
    return Array.from(unique.values());
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

const EphemeraOAuth = {
    _tokens: {
        github: null
    },
    _lastError: '',
    _initialized: false,
    _initPromise: null,
    _desktopReadyBound: false,

    async init(options = {}) {
        if (options.force) {
            this._initialized = false;
            this._initPromise = null;
        }

        if (this._initPromise) {
            return this._initPromise;
        }

        this._initPromise = (async () => {
            this._loadSessionCache();
            await this._loadTokensFromStorage();
            await this._handleGitHubCallback();
            this._initialized = true;

            if (!this._desktopReadyBound && window.EphemeraEvents?.on) {
                this._desktopReadyBound = true;
                window.EphemeraEvents.on('desktop:ready', () => {
                    this._loadTokensFromStorage()
                        .then(() => this._emitUpdate())
                        .catch(() => {});
                });
            }

            this._emitUpdate();
            return this;
        })();

        return this._initPromise;
    },

    getGithubClientId() {
        const fromState = String(window.EphemeraState?.settings?.githubOAuthClientId || '').trim();
        if (fromState) return fromState;
        return String(import.meta?.env?.VITE_GITHUB_CLIENT_ID || '').trim();
    },

    setGithubClientId(clientId) {
        const value = String(clientId || '').trim();
        if (window.EphemeraState?.updateSetting) {
            window.EphemeraState.updateSetting('githubOAuthClientId', value);
        } else if (window.EphemeraState?.settings) {
            window.EphemeraState.settings.githubOAuthClientId = value;
        }
        this._emitUpdate();
        return value;
    },

    async connectGitHub(options = {}) {
        await this.init();

        const clientId = String(options.clientId || this.getGithubClientId() || '').trim();
        if (!clientId) {
            throw new Error('GitHub OAuth client ID is required.');
        }

        if (options.clientId) {
            this.setGithubClientId(clientId);
        }

        const scopes = normalizeScopes(options.scopes || options.scope || DEFAULT_GITHUB_SCOPES);
        const redirectUri = String(options.redirectUri || this._defaultRedirectUri()).trim();
        const verifier = this._randomToken(64);
        const challenge = await this._createCodeChallenge(verifier);
        const state = this._randomToken(32);

        this._writePending({
            provider: 'github',
            state,
            verifier,
            scopes,
            redirectUri,
            clientId,
            createdAt: Date.now()
        });

        const authUrl = new URL(GITHUB_AUTHORIZE_URL);
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', scopes.join(' '));
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('allow_signup', 'true');
        authUrl.searchParams.set('code_challenge', challenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        const outputUrl = authUrl.toString();
        if (options.dryRun) {
            return outputUrl;
        }

        if (typeof window.location?.assign === 'function') {
            window.location.assign(outputUrl);
        } else if (window.location) {
            window.location.href = outputUrl;
        }

        return outputUrl;
    },

    async disconnectGitHub(options = {}) {
        const wasConnected = Boolean(this._tokens.github?.accessToken);
        this._tokens.github = null;
        this._clearPending();
        this._syncSessionCache();
        await this._persistTokens();

        if (!options.keepError) {
            this._lastError = '';
        }

        this._emitUpdate();
        return wasConnected;
    },

    async getGitAuthForUrl(remoteUrl) {
        const url = String(remoteUrl || '').trim();
        if (!this._isGitHubHttpsUrl(url)) return null;

        const token = await this.getGithubAccessToken();
        if (!token) return null;

        return {
            username: 'x-access-token',
            password: token
        };
    },

    async getGithubAccessToken() {
        await this.init();
        const record = this._tokens.github;
        if (!record?.accessToken) return '';

        if (this._isTokenExpired(record)) {
            await this.disconnectGitHub({ keepError: true });
            this._lastError = 'GitHub OAuth session expired. Connect again to continue.';
            this._emitUpdate();
            return '';
        }

        return record.accessToken;
    },

    isGithubConnected() {
        const record = this._tokens.github;
        return Boolean(record?.accessToken) && !this._isTokenExpired(record);
    },

    getStatus() {
        const github = this._tokens.github;
        const pending = this._readPending();
        return {
            github: {
                connected: this.isGithubConnected(),
                user: github?.user || null,
                scope: github?.scope || '',
                expiresAt: github?.expiresAt || null,
                clientIdConfigured: Boolean(this.getGithubClientId()),
                pending: Boolean(pending),
                error: this._lastError || ''
            }
        };
    },

    async _handleGitHubCallback() {
        const params = new URLSearchParams(window.location?.search || '');
        const hasCode = params.has('code');
        const hasError = params.has('error');

        if (!hasCode && !hasError) return false;

        const pending = this._readPending();
        if (!pending || pending.provider !== 'github') {
            this._lastError = 'GitHub OAuth state was not found. Start sign-in again.';
            this._cleanOAuthQueryParams();
            return false;
        }

        if (Date.now() - Number(pending.createdAt || 0) > OAUTH_PENDING_MAX_AGE_MS) {
            this._clearPending();
            this._lastError = 'GitHub OAuth session expired. Start sign-in again.';
            this._cleanOAuthQueryParams();
            return false;
        }

        if (hasError) {
            const details = params.get('error_description') || params.get('error') || 'GitHub authorization failed.';
            this._clearPending();
            this._lastError = details;
            this._cleanOAuthQueryParams();
            return false;
        }

        const code = String(params.get('code') || '').trim();
        const returnedState = String(params.get('state') || '').trim();
        if (!code) {
            this._clearPending();
            this._lastError = 'GitHub OAuth did not return an authorization code.';
            this._cleanOAuthQueryParams();
            return false;
        }
        if (!returnedState || returnedState !== pending.state) {
            this._clearPending();
            this._lastError = 'GitHub OAuth state mismatch. Sign-in was rejected.';
            this._cleanOAuthQueryParams();
            return false;
        }

        const clientId = String(this.getGithubClientId() || pending.clientId || '').trim();
        if (!clientId) {
            this._clearPending();
            this._lastError = 'GitHub OAuth client ID is not configured.';
            this._cleanOAuthQueryParams();
            return false;
        }

        try {
            const body = new URLSearchParams({
                client_id: clientId,
                grant_type: 'authorization_code',
                code,
                redirect_uri: pending.redirectUri || this._defaultRedirectUri(),
                code_verifier: pending.verifier
            });

            const tokenRes = await fetch(GITHUB_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body.toString()
            });
            if (!tokenRes.ok) {
                throw new Error(`GitHub OAuth token exchange failed (${tokenRes.status})`);
            }

            const tokenPayload = await tokenRes.json();
            if (tokenPayload?.error) {
                throw new Error(tokenPayload.error_description || tokenPayload.error);
            }

            const accessToken = String(tokenPayload?.access_token || '').trim();
            if (!accessToken) {
                throw new Error('GitHub OAuth token exchange did not return an access token.');
            }

            const profile = await this._fetchGitHubProfile(accessToken).catch(() => null);
            const expiresIn = Number(tokenPayload?.expires_in || 0);
            const refreshTokenExpiresIn = Number(tokenPayload?.refresh_token_expires_in || 0);

            this._tokens.github = {
                accessToken,
                tokenType: String(tokenPayload?.token_type || 'bearer'),
                scope: String(tokenPayload?.scope || pending.scopes?.join(' ') || ''),
                refreshToken: String(tokenPayload?.refresh_token || ''),
                createdAt: Date.now(),
                expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : null,
                refreshExpiresAt: refreshTokenExpiresIn > 0 ? Date.now() + refreshTokenExpiresIn * 1000 : null,
                user: profile ? {
                    id: profile.id || null,
                    login: profile.login || '',
                    name: profile.name || ''
                } : null
            };
            this._lastError = '';
            this._clearPending();
            this._syncSessionCache();
            await this._persistTokens();
            this._cleanOAuthQueryParams();

            if (window.EphemeraNotifications?.success) {
                const userLabel = this._tokens.github.user?.login
                    ? `Connected as @${this._tokens.github.user.login}`
                    : 'Connected successfully';
                window.EphemeraNotifications.success('GitHub Connected', userLabel);
            }

            return true;
        } catch (err) {
            this._clearPending();
            this._lastError = err?.message || 'GitHub OAuth failed.';
            this._cleanOAuthQueryParams();
            return false;
        }
    },

    async _fetchGitHubProfile(accessToken) {
        if (!isNonEmptyString(accessToken)) return null;
        const res = await fetch(GITHUB_USER_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github+json'
            }
        });
        if (!res.ok) return null;
        return res.json();
    },

    _isTokenExpired(record) {
        if (!record || !record.expiresAt) return false;
        return Date.now() + TOKEN_EXPIRY_SKEW_MS >= Number(record.expiresAt);
    },

    _defaultRedirectUri() {
        const origin = window.location?.origin || '';
        const pathname = window.location?.pathname || '/';
        return `${origin}${pathname}`;
    },

    _isGitHubHttpsUrl(rawUrl) {
        const value = String(rawUrl || '').trim();
        if (!value) return false;
        if (!/^https?:\/\//i.test(value)) return false;

        try {
            const parsed = new URL(value);
            const host = String(parsed.hostname || '').toLowerCase();
            return host === 'github.com' || host.endsWith('.github.com');
        } catch (_err) {
            return /^https?:\/\/([^/]+\.)?github\.com\//i.test(value);
        }
    },

    _randomToken(byteLength = 32) {
        const bytes = new Uint8Array(Math.max(16, Number(byteLength) || 32));
        crypto.getRandomValues(bytes);
        return bytesToBase64Url(bytes);
    },

    async _createCodeChallenge(verifier) {
        const encoder = typeof TextEncoder !== 'undefined'
            ? new TextEncoder()
            : { encode: (value) => Uint8Array.from(String(value || ''), (c) => c.charCodeAt(0) & 0xff) };
        const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(verifier || '')));
        return bytesToBase64Url(new Uint8Array(digest));
    },

    _writePending(pending) {
        sessionStorage.setItem(GITHUB_PENDING_KEY, JSON.stringify(pending));
        this._emitUpdate();
    },

    _readPending() {
        const pending = safeJsonParse(sessionStorage.getItem(GITHUB_PENDING_KEY), null);
        if (!pending) return null;
        const createdAt = Number(pending.createdAt || 0);
        if (!createdAt || Date.now() - createdAt > OAUTH_PENDING_MAX_AGE_MS) {
            sessionStorage.removeItem(GITHUB_PENDING_KEY);
            return null;
        }
        return pending;
    },

    _clearPending() {
        sessionStorage.removeItem(GITHUB_PENDING_KEY);
    },

    _loadSessionCache() {
        const cached = safeJsonParse(sessionStorage.getItem(OAUTH_SESSION_CACHE_KEY), null);
        if (!cached || typeof cached !== 'object') return;
        if (cached.github && typeof cached.github === 'object') {
            this._tokens.github = { ...cached.github };
        }
    },

    _syncSessionCache() {
        const payload = {
            github: this._tokens.github ? { ...this._tokens.github } : null
        };
        if (payload.github) {
            sessionStorage.setItem(OAUTH_SESSION_CACHE_KEY, JSON.stringify(payload));
        } else {
            sessionStorage.removeItem(OAUTH_SESSION_CACHE_KEY);
        }
    },

    async _loadTokensFromStorage() {
        if (!window.EphemeraStorage?.get) return false;
        try {
            const record = await window.EphemeraStorage.get('metadata', OAUTH_STORAGE_KEY);
            const value = record?.value;
            if (!value || typeof value !== 'object') return false;
            this._tokens.github = value.github && typeof value.github === 'object'
                ? { ...value.github }
                : null;
            this._syncSessionCache();
            return true;
        } catch (_err) {
            return false;
        }
    },

    async _persistTokens() {
        this._syncSessionCache();
        if (!window.EphemeraStorage?.put) return false;
        try {
            await window.EphemeraStorage.put('metadata', {
                key: OAUTH_STORAGE_KEY,
                value: {
                    github: this._tokens.github ? { ...this._tokens.github } : null
                },
                updatedAt: Date.now()
            });
            return true;
        } catch (_err) {
            return false;
        }
    },

    _cleanOAuthQueryParams() {
        const href = window.location?.href;
        if (!href) return;

        let parsed;
        try {
            parsed = new URL(href);
        } catch (_err) {
            return;
        }

        const removed = ['code', 'state', 'error', 'error_description', 'error_uri'];
        let changed = false;
        removed.forEach((key) => {
            if (parsed.searchParams.has(key)) {
                parsed.searchParams.delete(key);
                changed = true;
            }
        });
        if (!changed) return;

        const nextUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        if (window.history?.replaceState) {
            window.history.replaceState({}, '', nextUrl);
        } else if (window.location) {
            window.location.href = nextUrl;
        }
    },

    _emitUpdate() {
        window.EphemeraEvents?.emit?.('oauth:updated', this.getStatus());
    },

    _resetForTests() {
        this._tokens = { github: null };
        this._lastError = '';
        this._initialized = false;
        this._initPromise = null;
        this._desktopReadyBound = false;
        sessionStorage.removeItem(GITHUB_PENDING_KEY);
        sessionStorage.removeItem(OAUTH_SESSION_CACHE_KEY);
    }
};

window.EphemeraOAuth = EphemeraOAuth;

export default EphemeraOAuth;
