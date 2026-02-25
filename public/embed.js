(function initEphemeraEmbedElement() {
    if (!window.customElements) return;
    if (window.customElements.get('ephemera-desktop')) return;

    function resolveDefaultSrc() {
        const scriptUrl = document.currentScript?.src;
        if (!scriptUrl) {
            return new URL('/', window.location.href).toString();
        }
        return new URL('./', scriptUrl).toString();
    }

    const DEFAULT_SRC = resolveDefaultSrc();
    const DEFAULT_HEIGHT = '600px';
    const DEFAULT_WIDTH = '100%';
    const DEFAULT_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads';

    class EphemeraDesktopElement extends HTMLElement {
        static get observedAttributes() {
            return ['src', 'apps', 'height', 'width', 'sandbox', 'allow'];
        }

        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this._iframe = null;
            this._requestSeq = 0;
            this._requests = new Map();
            this._ready = false;
            this._boundMessage = (event) => this._onMessage(event);
        }

        connectedCallback() {
            this._render();
            window.addEventListener('message', this._boundMessage);
        }

        disconnectedCallback() {
            window.removeEventListener('message', this._boundMessage);
            for (const pending of this._requests.values()) {
                clearTimeout(pending.timeoutId);
                pending.reject(new Error('Ephemera iframe disconnected'));
            }
            this._requests.clear();
        }

        attributeChangedCallback(_name, oldValue, newValue) {
            if (oldValue === newValue) return;
            if (this.isConnected) this._render();
        }

        get iframe() {
            return this._iframe;
        }

        get ready() {
            return this._ready;
        }

        _buildSrc() {
            const rawSrc = String(this.getAttribute('src') || DEFAULT_SRC).trim();
            const rawApps = String(this.getAttribute('apps') || '').trim();
            let url;
            try {
                url = new URL(rawSrc, window.location.href);
            } catch (_error) {
                return rawSrc;
            }

            if (!url.searchParams.has('embed')) {
                url.searchParams.set('embed', '1');
            }
            if (rawApps) {
                url.searchParams.set('apps', rawApps);
            }
            return url.toString();
        }

        _render() {
            if (!this.shadowRoot) return;

            const frameSrc = this._buildSrc();
            const height = String(this.getAttribute('height') || DEFAULT_HEIGHT).trim() || DEFAULT_HEIGHT;
            const width = String(this.getAttribute('width') || DEFAULT_WIDTH).trim() || DEFAULT_WIDTH;
            const sandboxValue = String(this.getAttribute('sandbox') || DEFAULT_SANDBOX).trim() || DEFAULT_SANDBOX;
            const allowValue = String(this.getAttribute('allow') || '').trim();

            if (!this._iframe) {
                const style = document.createElement('style');
                style.textContent = `
                    :host {
                        display: block;
                        width: ${width};
                        height: ${height};
                        min-height: 240px;
                    }
                    .frame {
                        display: block;
                        width: 100%;
                        height: 100%;
                        border: 0;
                        border-radius: 12px;
                        background: #0a0a0f;
                    }
                `;
                const iframe = document.createElement('iframe');
                iframe.className = 'frame';
                iframe.setAttribute('loading', 'lazy');
                iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                iframe.addEventListener('load', () => {
                    this._ready = false;
                });
                this.shadowRoot.append(style, iframe);
                this._iframe = iframe;
            }

            this.style.width = width;
            this.style.height = height;
            this._iframe.setAttribute('sandbox', sandboxValue);
            if (allowValue) this._iframe.setAttribute('allow', allowValue);
            else this._iframe.removeAttribute('allow');

            if (this._iframe.src !== frameSrc) {
                this._ready = false;
                this._iframe.src = frameSrc;
            }
        }

        postMessage(payload, targetOrigin = '*') {
            if (!this._iframe?.contentWindow) return false;
            this._iframe.contentWindow.postMessage(payload, targetOrigin);
            return true;
        }

        send(cmd, payload = {}, options = {}) {
            const requestId = `embed-${Date.now()}-${++this._requestSeq}`;
            const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 10000;
            const targetOrigin = String(options.targetOrigin || '*');
            const body = {
                ephemera: true,
                cmd: String(cmd || '').trim(),
                requestId,
                ...(payload && typeof payload === 'object' ? payload : {})
            };

            if (!body.cmd) {
                return Promise.reject(new Error('cmd is required'));
            }
            if (!this.postMessage(body, targetOrigin)) {
                return Promise.reject(new Error('Ephemera iframe is not available'));
            }

            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    this._requests.delete(requestId);
                    reject(new Error(`Ephemera request timed out (${body.cmd})`));
                }, timeoutMs);
                this._requests.set(requestId, { resolve, reject, timeoutId });
            });
        }

        _onMessage(event) {
            if (!this._iframe?.contentWindow) return;
            if (event.source !== this._iframe.contentWindow) return;
            const data = event.data;
            if (!data || data.ephemera !== true) return;

            if (data.type === 'ready') {
                this._ready = true;
                this.dispatchEvent(new CustomEvent('ephemera-ready', {
                    bubbles: true,
                    composed: true,
                    detail: {
                        origin: event.origin,
                        data
                    }
                }));
            }

            if (data.type === 'response' && data.requestId && this._requests.has(data.requestId)) {
                const pending = this._requests.get(data.requestId);
                this._requests.delete(data.requestId);
                clearTimeout(pending.timeoutId);
                if (data.ok) pending.resolve(data.result);
                else pending.reject(new Error(data.error || 'Ephemera command failed'));
            }

            this.dispatchEvent(new CustomEvent('ephemera-message', {
                bubbles: true,
                composed: true,
                detail: {
                    origin: event.origin,
                    data
                }
            }));
        }
    }

    window.customElements.define('ephemera-desktop', EphemeraDesktopElement);
})();
