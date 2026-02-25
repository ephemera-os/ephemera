const EPHEMERA_TERMINAL_DEFAULT_TIMEOUT_MS = 4000;

const EphemeraTerminalBackend = {
    _eventHandlers: new Map(),

    validateUrl(url) {
        if (typeof url !== 'string') {
            return { valid: false, error: 'Terminal backend URL is required' };
        }

        const trimmed = url.trim();
        if (!trimmed) {
            return { valid: false, error: 'Terminal backend URL is required' };
        }

        let parsed;
        try {
            parsed = new URL(trimmed);
        } catch (_e) {
            return { valid: false, error: 'Terminal backend URL is invalid' };
        }

        if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
            return { valid: false, error: 'Terminal backend URL must use ws:// or wss://' };
        }

        return { valid: true, url: parsed.toString() };
    },

    getConfig() {
        const settings = window.EphemeraState?.settings || {};
        const enabled = settings.terminalBackendEnabled === true;
        const rawUrl = typeof settings.terminalBackendUrl === 'string'
            ? settings.terminalBackendUrl.trim()
            : '';
        return { enabled, url: rawUrl };
    },

    isConfigured() {
        const { enabled, url } = this.getConfig();
        if (!enabled || !url) return false;
        return this.validateUrl(url).valid;
    },

    async testConnection(rawUrl, timeoutMs = EPHEMERA_TERMINAL_DEFAULT_TIMEOUT_MS) {
        const validation = this.validateUrl(rawUrl);
        if (!validation.valid) {
            return { ok: false, error: validation.error };
        }

        if (typeof window.WebSocket !== 'function') {
            return { ok: false, error: 'WebSocket is not supported in this browser' };
        }

        return new Promise((resolve) => {
            let settled = false;
            const ws = new window.WebSocket(validation.url);

            const finalize = (result) => {
                if (settled) return;
                settled = true;
                try {
                    if (ws.readyState === window.WebSocket.OPEN || ws.readyState === window.WebSocket.CONNECTING) {
                        ws.close(1000, 'ephemera-test-complete');
                    }
                } catch (_e) {
                    // Best effort close only.
                }
                resolve(result);
            };

            const timeout = window.setTimeout(() => {
                finalize({ ok: false, error: 'Connection timed out' });
            }, Math.max(500, Number(timeoutMs) || EPHEMERA_TERMINAL_DEFAULT_TIMEOUT_MS));

            ws.onopen = () => {
                window.clearTimeout(timeout);
                finalize({ ok: true });
            };

            ws.onerror = () => {
                window.clearTimeout(timeout);
                finalize({ ok: false, error: 'Unable to reach terminal backend' });
            };
        });
    },

    createClient(rawUrl = null) {
        const settingsUrl = this.getConfig().url;
        const chosen = (rawUrl || settingsUrl || '').trim();
        const validation = this.validateUrl(chosen);
        const hasValidUrl = validation.valid;
        const wsUrl = hasValidUrl ? validation.url : '';

        /** @type {WebSocket|null} */
        let socket = null;
        /** @type {Map<string, Set<(payload?: unknown) => void>>} */
        const handlers = new Map();

        const emit = (event, payload) => {
            const subs = handlers.get(event);
            if (!subs || subs.size === 0) return;
            subs.forEach((handler) => {
                try {
                    handler(payload);
                } catch (e) {
                    console.error('[EphemeraTerminalBackend] Client handler failed:', e);
                }
            });
        };

        const setSocket = (next) => {
            socket = next;
            emit('status', {
                connected: socket?.readyState === window.WebSocket.OPEN,
                connecting: socket?.readyState === window.WebSocket.CONNECTING,
                url: wsUrl
            });
        };

        const connect = async (timeoutMs = EPHEMERA_TERMINAL_DEFAULT_TIMEOUT_MS) => {
            if (!hasValidUrl) {
                return { ok: false, error: validation.error || 'Terminal backend URL is invalid' };
            }

            if (typeof window.WebSocket !== 'function') {
                return { ok: false, error: 'WebSocket is not supported in this browser' };
            }

            if (socket && socket.readyState === window.WebSocket.OPEN) {
                return { ok: true };
            }

            return new Promise((resolve) => {
                let settled = false;
                const ws = new window.WebSocket(wsUrl);
                setSocket(ws);

                const finalize = (result) => {
                    if (settled) return;
                    settled = true;
                    resolve(result);
                };

                const timeout = window.setTimeout(() => {
                    if (ws.readyState === window.WebSocket.CONNECTING) {
                        ws.close(1000, 'ephemera-connect-timeout');
                    }
                    finalize({ ok: false, error: 'Connection timed out' });
                }, Math.max(500, Number(timeoutMs) || EPHEMERA_TERMINAL_DEFAULT_TIMEOUT_MS));

                ws.onopen = () => {
                    window.clearTimeout(timeout);
                    emit('open', { url: wsUrl });
                    finalize({ ok: true });
                };

                ws.onclose = (event) => {
                    window.clearTimeout(timeout);
                    const wasConnected = socket === ws && ws.readyState !== window.WebSocket.CONNECTING;
                    if (socket === ws) {
                        setSocket(null);
                    }
                    emit('close', event);
                    if (!settled && !wasConnected) {
                        finalize({ ok: false, error: 'Connection closed before ready' });
                    }
                };

                ws.onerror = () => {
                    window.clearTimeout(timeout);
                    emit('error', { message: 'Unable to reach terminal backend' });
                    if (!settled) {
                        finalize({ ok: false, error: 'Unable to reach terminal backend' });
                    }
                };

                ws.onmessage = (event) => {
                    let payload = event.data;
                    if (typeof payload === 'string') {
                        const trimmed = payload.trim();
                        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                            try {
                                payload = JSON.parse(payload);
                            } catch (_e) {
                                payload = event.data;
                            }
                        }
                    }
                    emit('message', payload);
                };
            });
        };

        const send = (data) => {
            if (!socket || socket.readyState !== window.WebSocket.OPEN) {
                return { ok: false, error: 'Terminal backend is not connected' };
            }
            try {
                if (typeof data === 'string') {
                    socket.send(data);
                } else {
                    socket.send(JSON.stringify(data));
                }
                return { ok: true };
            } catch (e) {
                return { ok: false, error: e.message || 'Failed to send command' };
            }
        };

        const close = (code = 1000, reason = 'ephemera-terminal-close') => {
            if (!socket) return;
            try {
                socket.close(code, reason);
            } catch (_e) {
                // Best effort close only.
            }
            setSocket(null);
        };

        const on = (event, handler) => {
            const key = String(event || '');
            if (!handlers.has(key)) {
                handlers.set(key, new Set());
            }
            handlers.get(key).add(handler);
            return () => {
                handlers.get(key)?.delete(handler);
            };
        };

        return {
            connect,
            send,
            close,
            on,
            isConnected: () => !!socket && socket.readyState === window.WebSocket.OPEN,
            isConnecting: () => !!socket && socket.readyState === window.WebSocket.CONNECTING,
            getUrl: () => wsUrl
        };
    },

    on(event, handler) {
        const key = String(event || '');
        if (!this._eventHandlers.has(key)) {
            this._eventHandlers.set(key, new Set());
        }
        this._eventHandlers.get(key).add(handler);
        return () => {
            this._eventHandlers.get(key)?.delete(handler);
        };
    },

    emit(event, payload) {
        const key = String(event || '');
        const handlers = this._eventHandlers.get(key);
        if (!handlers || handlers.size === 0) return;
        handlers.forEach((handler) => {
            try {
                handler(payload);
            } catch (e) {
                console.error('[EphemeraTerminalBackend] Event handler failed:', e);
            }
        });
    }
};

window.EphemeraTerminalBackend = EphemeraTerminalBackend;
export default EphemeraTerminalBackend;
