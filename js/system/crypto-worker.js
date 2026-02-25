const REQUEST_TIMEOUT_MS = 30000;

const EphemeraCryptoWorker = {
    _worker: null,
    _initialized: false,
    _available: false,
    _nextId: 1,
    _pending: new Map(),
    _keyCache: typeof WeakMap === 'function' ? new WeakMap() : null,

    isSupported() {
        return typeof Worker === 'function' && typeof crypto?.subtle !== 'undefined';
    },

    init() {
        if (this._initialized) {
            return this._available;
        }

        this._initialized = true;
        if (!this.isSupported()) {
            this._available = false;
            return false;
        }

        try {
            this._worker = new Worker(new URL('../workers/crypto.worker.js', import.meta.url), {
                type: 'module'
            });
            this._worker.onmessage = (event) => this._onMessage(event?.data || {});
            this._worker.onerror = () => {
                this._available = false;
                this._rejectPending(new Error('Crypto worker failed'));
            };
            this._available = true;
        } catch (_error) {
            this._worker = null;
            this._available = false;
        }

        return this._available;
    },

    _onMessage(message) {
        const id = Number(message?.id);
        if (!Number.isFinite(id)) return;
        const pending = this._pending.get(id);
        if (!pending) return;

        this._pending.delete(id);
        clearTimeout(pending.timeoutId);

        if (message.ok) {
            pending.resolve(message.result);
            return;
        }

        pending.reject(new Error(message.error || 'Crypto worker operation failed'));
    },

    _rejectPending(error) {
        const err = error instanceof Error ? error : new Error(String(error || 'Crypto worker unavailable'));
        this._pending.forEach((pending) => {
            clearTimeout(pending.timeoutId);
            pending.reject(err);
        });
        this._pending.clear();
    },

    _ensureWorker() {
        const ready = this.init();
        if (!ready || !this._worker) {
            throw new Error('Crypto worker is unavailable');
        }
        return this._worker;
    },

    _call(op, payload) {
        const worker = this._ensureWorker();
        const id = this._nextId++;

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this._pending.delete(id);
                reject(new Error('Crypto worker request timed out'));
            }, REQUEST_TIMEOUT_MS);

            this._pending.set(id, { resolve, reject, timeoutId });
            worker.postMessage({ id, op, payload });
        });
    },

    async _exportKeyBase64(key) {
        if (!key || !window.EphemeraCrypto?.exportRawKeyBase64) {
            throw new Error('Crypto key export is unavailable');
        }

        if (this._keyCache?.has(key)) {
            return this._keyCache.get(key);
        }

        const exported = await window.EphemeraCrypto.exportRawKeyBase64(key);
        if (!exported) {
            throw new Error('Crypto key export failed');
        }

        this._keyCache?.set(key, exported);
        return exported;
    },

    async encrypt(text, key) {
        const rawKeyBase64 = await this._exportKeyBase64(key);
        const result = await this._call('encrypt', {
            text: String(text ?? ''),
            key: rawKeyBase64
        });
        if (typeof result !== 'string' || !result.startsWith('enc:')) {
            throw new Error('Crypto worker returned invalid encryption result');
        }
        return result;
    },

    async decrypt(ciphertext, key) {
        if (typeof ciphertext !== 'string' || !ciphertext.startsWith('enc:')) {
            return ciphertext;
        }

        const rawKeyBase64 = await this._exportKeyBase64(key);
        const result = await this._call('decrypt', {
            ciphertext,
            key: rawKeyBase64
        });
        if (result === null || typeof result === 'string') {
            return result;
        }
        throw new Error('Crypto worker returned invalid decryption result');
    },

    terminate() {
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
        }
        this._available = false;
        this._initialized = false;
        this._rejectPending(new Error('Crypto worker terminated'));
        this._keyCache = typeof WeakMap === 'function' ? new WeakMap() : null;
    },

    _resetForTests() {
        this.terminate();
        this._nextId = 1;
    }
};

window.EphemeraCryptoWorker = EphemeraCryptoWorker;
EphemeraCryptoWorker.init();

export default EphemeraCryptoWorker;
