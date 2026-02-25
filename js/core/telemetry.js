import * as Sentry from '@sentry/browser';

const FLOW_HINTS = {
    auth: ['auth', 'login', 'unlock', 'session', 'passkey', 'webauthn', 'profile'],
    sync: ['sync', 'webdav', 'gist', 's3', 'cloud'],
    filesystem: ['filesystem', 'file', 'fs', 'storage', 'quota', 'history', 'export', 'import'],
    network: ['network', 'proxy', 'fetch', 'http', 'cors', 'request'],
    ai: ['ai', 'model', 'openai', 'anthropic', 'openrouter', 'prompt', 'completion'],
    collaboration: ['collab', 'p2p', 'webrtc', 'share', 'yjs'],
    apps: ['app', 'window', 'widget', 'registry', 'sandbox', 'plugin'],
    boot: ['boot', 'startup', 'initialize', 'init']
};

const EphemeraTelemetry = {
    initialized: false,
    enabled: true,

    init(options = {}) {
        if (this.initialized) return;

        const dsn = options.dsn || import.meta.env.VITE_SENTRY_DSN;
        const environment = options.environment || import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development';
        const release = options.release || import.meta.env.VITE_SENTRY_RELEASE || '2.0.0';

        if (!dsn) {
            console.info('[EphemeraTelemetry] No Sentry DSN configured, telemetry disabled');
            this.enabled = false;
            return;
        }

        Sentry.init({
            dsn,
            environment,
            release: `ephemera@${release}`,
            
            integrations: [
                Sentry.browserTracingIntegration(),
                Sentry.replayIntegration({
                    maskAllText: true,
                    blockAllMedia: true
                })
            ],

            tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
            
            replaysSessionSampleRate: 0.1,
            replaysOnErrorSampleRate: 1.0,

            beforeSend(event, _hint) {
                if (event.request?.headers) {
                    delete event.request.headers.Authorization;
                    delete event.request.headers.Cookie;
                }

                if (event.request?.cookies) {
                    delete event.request.cookies;
                }

                if (event.contexts?.user) {
                    delete event.contexts.user.email;
                    delete event.contexts.user.ip_address;
                    delete event.contexts.user.username;
                }

                return event;
            },

            beforeBreadcrumb(breadcrumb) {
                if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
                    return null;
                }
                
                if (breadcrumb.data?.url) {
                    try {
                        const url = new URL(breadcrumb.data.url, window.location.origin);
                        if (url.searchParams.has('key') || url.searchParams.has('token')) {
                            url.searchParams.delete('key');
                            url.searchParams.delete('token');
                            breadcrumb.data.url = url.toString();
                        }
                    } catch (_e) {
                        // Ignore malformed breadcrumb URLs.
                    }
                }
                
                return breadcrumb;
            },

            ignoreErrors: [
                'ResizeObserver loop limit exceeded',
                'ResizeObserver loop completed with undelivered notifications',
                'Network request failed',
                'Failed to fetch',
                'ChunkLoadError',
                'Loading chunk',
                'Non-Error promise rejection captured'
            ],

            denyUrls: [
                /extensions\//i,
                /^chrome:\/\//i,
                /^moz-extension:\/\//i,
                /google-analytics\.com/i,
                /googletagmanager\.com/i
            ]
        });

        this.initialized = true;
        console.info('[EphemeraTelemetry] Initialized for environment:', environment);
    },

    setUser(user) {
        if (!this.initialized || !this.enabled) return;

        if (user) {
            Sentry.setUser({
                id: this._hashId(user.id || user.name),
                username: user.name
            });
        } else {
            Sentry.setUser(null);
        }
    },

    _hashId(id) {
        if (!id) return 'anonymous';
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            const char = id.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'user_' + Math.abs(hash).toString(16);
    },

    _normalizeToken(value, fallback = 'unknown') {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return normalized || fallback;
    },

    _buildHintText(subject, context = {}) {
        const hints = [];
        const push = (value) => {
            if (value == null) return;
            const text = String(value).trim();
            if (text) hints.push(text.toLowerCase());
        };

        push(context.flow);
        push(context.tags?.flow);
        push(context.tags?.component);
        push(context.tags?.type);
        push(context.extra?.flow);
        push(context.extra?.operation);
        push(context.extra?.source);
        push(context.extra?.component);
        push(context.extra?.feature);

        if (typeof subject === 'string') {
            push(subject);
        } else if (subject) {
            push(subject.name);
            push(subject.message);
        }

        return hints.join(' ');
    },

    _inferFlow(subject, context = {}) {
        const explicit = context.flow || context.tags?.flow || context.extra?.flow;
        if (explicit) return this._normalizeToken(explicit);

        const hintText = this._buildHintText(subject, context);
        if (!hintText) return 'unknown';

        for (const [flow, tokens] of Object.entries(FLOW_HINTS)) {
            if (tokens.some((token) => this._matchesFlowToken(hintText, token))) {
                return flow;
            }
        }
        return 'unknown';
    },

    _matchesFlowToken(hintText, token) {
        const source = String(hintText || '');
        const needle = String(token || '').toLowerCase().trim();
        if (!needle) return false;
        if (needle.length <= 2) {
            const pattern = new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
            return pattern.test(source);
        }
        return source.includes(needle);
    },

    _buildFlowSignature(subject, context = {}) {
        const explicitGroup = context.group || context.tags?.group || context.extra?.group;
        if (explicitGroup) return this._normalizeToken(explicitGroup, 'generic');

        const raw = [
            context.tags?.component,
            context.tags?.type,
            context.extra?.operation,
            context.extra?.source,
            typeof subject === 'string' ? subject : subject?.name,
            typeof subject === 'string' ? '' : subject?.message
        ].filter(Boolean).join(' ');

        if (!raw) return 'generic';

        return this._normalizeToken(
            String(raw)
                .replace(/[0-9a-f]{8,}/gi, '*')
                .replace(/\d+/g, '*')
                .slice(0, 160),
            'generic'
        );
    },

    _applyFlowGrouping(scope, subject, context = {}) {
        const flow = this._inferFlow(subject, context);
        const signature = this._buildFlowSignature(subject, context);

        if (scope?.setTag) {
            scope.setTag('flow', flow);
            if (context.flowImpact) {
                scope.setTag('impact', String(context.flowImpact));
            }
        }

        if (scope?.setFingerprint) {
            scope.setFingerprint([`flow:${flow}`, `sig:${signature}`]);
        }

        if (scope?.setContext) {
            scope.setContext('ephemera_flow', { flow, signature });
        }

        return { flow, signature };
    },

    captureException(error, context = {}) {
        if (!this.initialized || !this.enabled) {
            console.error('[EphemeraTelemetry]', error, context);
            return;
        }

        Sentry.withScope((scope) => {
            this._applyFlowGrouping(scope, error, context);

            if (context.tags) {
                Object.entries(context.tags).forEach(([key, value]) => {
                    scope.setTag(key, value);
                });
            }

            if (context.extra) {
                Object.entries(context.extra).forEach(([key, value]) => {
                    scope.setExtra(key, this._sanitizeExtra(value));
                });
            }

            if (context.level) {
                scope.setLevel(context.level);
            }

            Sentry.captureException(error);
        });
    },

    captureMessage(message, level = 'info', context = {}) {
        if (!this.initialized || !this.enabled) {
            console.log(`[EphemeraTelemetry][${level}]`, message);
            return;
        }

        Sentry.withScope((scope) => {
            this._applyFlowGrouping(scope, message, context);

            if (context.tags) {
                Object.entries(context.tags).forEach(([key, value]) => {
                    scope.setTag(key, value);
                });
            }

            if (context.extra) {
                Object.entries(context.extra).forEach(([key, value]) => {
                    scope.setExtra(key, this._sanitizeExtra(value));
                });
            }

            scope.setLevel(level);
            Sentry.captureMessage(message);
        });
    },

    _sanitizeExtra(value) {
        if (typeof value === 'string') {
            if (value.includes('password') || value.includes('token') || value.includes('key') || value.includes('secret')) {
                return '[REDACTED]';
            }
            return value.substring(0, 1000);
        }
        
        if (typeof value === 'object' && value !== null) {
            const sanitized = Array.isArray(value) ? [...value] : { ...value };
            for (const key of Object.keys(sanitized)) {
                if (key.toLowerCase().includes('password') || 
                    key.toLowerCase().includes('token') || 
                    key.toLowerCase().includes('key') ||
                    key.toLowerCase().includes('secret') ||
                    key.toLowerCase().includes('apikey')) {
                    sanitized[key] = '[REDACTED]';
                }
            }
            return sanitized;
        }
        
        return value;
    },

    addBreadcrumb(breadcrumb) {
        if (!this.initialized || !this.enabled) return;

        Sentry.addBreadcrumb({
            category: breadcrumb.category || 'custom',
            message: breadcrumb.message,
            level: breadcrumb.level || 'info',
            data: this._sanitizeExtra(breadcrumb.data)
        });
    },

    startTransaction(name, op = 'operation') {
        if (!this.initialized || !this.enabled) {
            return {
                finish: () => {},
                setStatus: () => {},
                setData: () => {}
            };
        }

        return Sentry.startTransaction({ name, op });
    },

    setEnabled(enabled) {
        this.enabled = enabled;
    },

    isEnabled() {
        return this.enabled && this.initialized;
    },

    wrapFunction(fn, context = {}) {
        return (...args) => {
            try {
                const result = fn(...args);
                if (result && typeof result.then === 'function') {
                    return result.catch((error) => {
                        this.captureException(error, context);
                        throw error;
                    });
                }
                return result;
            } catch (error) {
                this.captureException(error, context);
                throw error;
            }
        };
    },

    measurePerformance(name, fn) {
        const startTime = performance.now();
        
        const result = fn();
        
        if (result && typeof result.then === 'function') {
            return result.finally(() => {
                const duration = performance.now() - startTime;
                this.addBreadcrumb({
                    category: 'performance',
                    message: name,
                    level: 'info',
                    data: { duration: `${duration.toFixed(2)}ms` }
                });
            });
        }
        
        const duration = performance.now() - startTime;
        this.addBreadcrumb({
            category: 'performance',
            message: name,
            level: 'info',
            data: { duration: `${duration.toFixed(2)}ms` }
        });
        
        return result;
    },

    _resetForTests() {
        this.initialized = false;
        this.enabled = true;
    }
};

window.EphemeraTelemetry = EphemeraTelemetry;
export default EphemeraTelemetry;
