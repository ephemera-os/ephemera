/* Ephemera terminal `run` sandbox.
 * Receives JS code from the parent and executes it in a sandboxed iframe.
 * Uses a blob script to avoid requiring `unsafe-inline` in the parent CSP.
 */

(function initEphemeraRunner() {
    'use strict';

    let executed = false;
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

    function isTrustedParentEvent(event) {
        if (!event || event.source !== window.parent) return false;
        if (!trustedParentOrigin) return false;
        return event.origin === trustedParentOrigin;
    }

    function postResult(result) {
        if (!trustedParentOrigin) return;
        try {
            parent.postMessage({
                type: 'ephemera-run-result',
                result: result != null ? String(result) : 'Executed successfully'
            }, trustedParentOrigin);
        } catch (_e) {
            // Ignore.
        }
    }

    function runCode(code) {
        const targetOrigin = JSON.stringify(trustedParentOrigin);
        const wrapped = [
            '(function(){',
            'try {',
            '  const result = (function(){',
            String(code || ''),
            '  })();',
            `  parent.postMessage({ type: "ephemera-run-result", result: result !== undefined ? String(result) : "Executed successfully" }, ${targetOrigin});`,
            '} catch (e) {',
            `  parent.postMessage({ type: "ephemera-run-result", result: "Error: " + (e && e.message ? e.message : String(e)) }, ${targetOrigin});`,
            '}',
            '})();',
            '//# sourceURL=ephemera-terminal-run.js'
        ].join('\n');

        const blob = new Blob([wrapped], { type: 'text/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const script = document.createElement('script');
        script.src = blobUrl;
        script.onload = () => URL.revokeObjectURL(blobUrl);
        script.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            postResult('Error: Failed to load script');
        };
        document.head.appendChild(script);
    }

    window.addEventListener('message', (event) => {
        if (!isTrustedParentEvent(event)) return;
        const data = event?.data || {};
        if (data.type !== 'ephemera-run') return;
        if (executed) return;
        executed = true;
        runCode(String(data.code || ''));
    });
})();
