/* Ephemera sandbox runtime.
 * This file runs inside a sandboxed iframe (allow-scripts, without allow-same-origin).
 * It receives a MessagePort bridge + app code from the parent, exposes the Ephemera APIs,
 * and executes user code via a blob script (so the main app CSP can stay strict).
 */

(function initEphemeraSandbox() {
    'use strict';

    const root = document.getElementById('ephemera-sandbox-root') || document.body;
    const params = new URLSearchParams(window.location.search);

    function resolveTrustedParentOrigin() {
        const fromQuery = String(params.get('parentOrigin') || '').trim();
        if (fromQuery) return fromQuery;
        try {
            if (document.referrer) return new URL(document.referrer).origin;
        } catch (_e) {
            // Ignore invalid referrer values.
        }
        return '';
    }

    const trustedParentOrigin = resolveTrustedParentOrigin();

    /** @type {MessagePort | null} */
    let bridgePort = null;
    let initialized = false;
    let appName = 'User App';
    let windowId = null;

    const pending = new Map(); // id -> { resolve, reject, timeoutId }
    let reqId = 0;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function postConsole(level, args) {
        if (!bridgePort) return;
        try {
            bridgePort.postMessage({
                type: 'ephemera-console',
                level: String(level || 'log'),
                args: Array.isArray(args) ? args.map((v) => String(v)) : [String(args)],
                appName
            });
        } catch (_e) {
            // Ignore.
        }
    }

    function showErrorScreen(title, message) {
        root.innerHTML = `
            <div style="padding:16px;text-align:center;color:#ff4d6a;">
                <h3 style="margin:0 0 10px;">${escapeHtml(title)}</h3>
                <pre style="margin:0;white-space:pre-wrap;word-break:break-word;">${escapeHtml(message)}</pre>
            </div>
        `;
    }

    function handleBridgeReply(event) {
        const data = event?.data || {};
        if (data.type !== 'ephemera-bridge-reply') return;
        const entry = pending.get(data.id);
        if (!entry) return;
        pending.delete(data.id);
        clearTimeout(entry.timeoutId);
        if (data.error) entry.reject(new Error(String(data.error)));
        else entry.resolve(data.result);
    }

    function call(api, method, args) {
        if (!bridgePort) {
            return Promise.reject(new Error('Bridge not initialized'));
        }

        return new Promise((resolve, reject) => {
            const id = ++reqId;
            const timeoutId = setTimeout(() => {
                pending.delete(id);
                reject(new Error('Bridge request timeout'));
            }, 30000);
            pending.set(id, { resolve, reject, timeoutId });
            bridgePort.postMessage({
                type: 'ephemera-bridge',
                id,
                api,
                method,
                args,
                windowId
            });
        });
    }

    function exposeApis(manifest) {
        globalThis.manifest = manifest;
        globalThis.windowId = windowId;
        globalThis.container = root;

        globalThis.EphemeraFS = {
            readFile: (p) => call('EphemeraFS', 'readFile', [p]),
            writeFile: (p, c) => call('EphemeraFS', 'writeFile', [p, c]),
            readdir: (p) => call('EphemeraFS', 'readdir', [p]),
            mkdir: (p) => call('EphemeraFS', 'mkdir', [p]),
            delete: (p) => call('EphemeraFS', 'delete', [p]),
            exists: (p) => call('EphemeraFS', 'exists', [p]),
            stat: (p) => call('EphemeraFS', 'stat', [p]),
            move: (o, n) => call('EphemeraFS', 'move', [o, n]),
            copy: (s, d) => call('EphemeraFS', 'copy', [s, d])
        };

        globalThis.EphemeraNetwork = {
            fetch: (u, o) => call('EphemeraNetwork', 'fetch', [u, o]),
            get: (u) => call('EphemeraNetwork', 'get', [u]),
            post: (u, d) => call('EphemeraNetwork', 'post', [u, d])
        };

        globalThis.EphemeraEvents = {
            emit: (e, d) => call('EphemeraEvents', 'emit', [e, d])
        };

        globalThis.EphemeraWM = {
            open: (a, o) => call('EphemeraWM', 'open', [a, o]),
            close: (w) => call('EphemeraWM', 'close', [w])
        };

        globalThis.EphemeraNotifications = {
            success: (t, m, o) => call('EphemeraNotifications', 'success', [t, m, o]),
            error: (t, m, o) => call('EphemeraNotifications', 'error', [t, m, o]),
            info: (t, m, o) => call('EphemeraNotifications', 'info', [t, m, o]),
            warning: (t, m, o) => call('EphemeraNotifications', 'warning', [t, m, o])
        };

        globalThis.EphemeraDialog = {
            alert: (m, t) => call('EphemeraDialog', 'alert', [m, t]),
            confirm: (m, t) => call('EphemeraDialog', 'confirm', [m, t]),
            prompt: (m, d, t, p) => call('EphemeraDialog', 'prompt', [m, d, t, p])
        };

        globalThis.EphemeraStorage = {
            put: (s, d) => call('EphemeraStorage', 'put', [s, d]),
            get: (s, k) => call('EphemeraStorage', 'get', [s, k]),
            delete: (s, k) => call('EphemeraStorage', 'delete', [s, k]),
            getAll: (s) => call('EphemeraStorage', 'getAll', [s])
        };

        globalThis.EphemeraSanitize = {
            escapeHtml: (s) => call('EphemeraSanitize', 'escapeHtml', [s]),
            escapeAttr: (s) => call('EphemeraSanitize', 'escapeAttr', [s]),
            sanitizeUrl: (u) => call('EphemeraSanitize', 'sanitizeUrl', [u])
        };
    }

    function overrideConsole() {
        const real = globalThis.console || { log() {}, warn() {}, error() {}, info() {}, debug() {} };
        const wrap = (level) => (...args) => {
            try { real[level]?.(...args); } catch (_e) {}
            postConsole(level, args);
        };

        globalThis.console = {
            log: wrap('log'),
            info: wrap('info'),
            warn: wrap('warn'),
            error: wrap('error'),
            debug: wrap('debug')
        };

        globalThis.addEventListener('error', (e) => {
            const msg = e?.message || (e?.error?.message || String(e?.error || 'Unknown error'));
            postConsole('error', [msg]);
        });

        globalThis.addEventListener('unhandledrejection', (e) => {
            const reason = e?.reason;
            const msg = reason?.message || String(reason || 'Unhandled rejection');
            postConsole('error', [`Unhandled rejection: ${msg}`]);
        });
    }

    function runUserCode(code) {
        // Provide a small wrapper for consistent error handling, without relying on inline scripts.
        const wrapped = [
            '(function(){',
            'try {',
            String(code || ''),
            '} catch (e) {',
            '  var root = document.getElementById("ephemera-sandbox-root") || document.body;',
            '  root.innerHTML = "<div style=\\"padding:16px;text-align:center;color:#ff4d6a;\\"><h3 style=\\"margin:0 0 10px;\\">App Error</h3><pre style=\\"margin:0;white-space:pre-wrap;word-break:break-word;\\">" + String(e && e.message ? e.message : e) + "</pre></div>";',
            '  try { console.error(e && e.message ? e.message : String(e)); } catch (_e) {}',
            '}',
            '})();',
            '//# sourceURL=ephemera-user-app.js'
        ].join('\n');

        const blob = new Blob([wrapped], { type: 'text/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const script = document.createElement('script');
        script.src = blobUrl;
        script.onload = () => URL.revokeObjectURL(blobUrl);
        script.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            showErrorScreen('App Error', 'Failed to load app script.');
        };
        document.head.appendChild(script);
    }

    if (!trustedParentOrigin) {
        showErrorScreen('Sandbox Error', 'Unable to determine trusted parent origin.');
        return;
    }

    window.addEventListener('message', (event) => {
        if (event.source !== window.parent) return;
        if (event.origin !== trustedParentOrigin) return;
        const data = event?.data || {};
        if (data.type !== 'ephemera-init-bridge') return;
        if (initialized) return;
        if (!event.ports || !event.ports[0]) {
            showErrorScreen('Sandbox Error', 'Missing MessagePort from parent.');
            return;
        }

        initialized = true;
        windowId = data.windowId;
        const manifest = (data.manifest && typeof data.manifest === 'object') ? data.manifest : {};
        const code = String(data.code || '');
        appName = String(manifest.name || 'User App');

        bridgePort = event.ports[0];
        bridgePort.onmessage = handleBridgeReply;
        bridgePort.start();

        overrideConsole();
        exposeApis(manifest);
        runUserCode(code);
    });
})();
