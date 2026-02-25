const REQUEST_TIMEOUT_MS = 60000;

const EphemeraExportWorker = {
    _worker: null,
    _initialized: false,
    _available: false,
    _nextId: 1,
    _pending: new Map(),

    isSupported() {
        return typeof Worker === 'function';
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
            this._worker = new Worker(new URL('../workers/export.worker.js', import.meta.url), {
                type: 'module'
            });
            this._worker.onmessage = (event) => this._onMessage(event?.data || {});
            this._worker.onerror = () => {
                this._available = false;
                this._rejectPending(new Error('Export worker failed'));
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

        pending.reject(new Error(message.error || 'Export worker operation failed'));
    },

    _rejectPending(error) {
        const err = error instanceof Error ? error : new Error(String(error || 'Export worker unavailable'));
        this._pending.forEach((pending) => {
            clearTimeout(pending.timeoutId);
            pending.reject(err);
        });
        this._pending.clear();
    },

    _ensureWorker() {
        const ready = this.init();
        if (!ready || !this._worker) {
            throw new Error('Export worker is unavailable');
        }
        return this._worker;
    },

    _call(op, payload) {
        const worker = this._ensureWorker();
        const id = this._nextId++;

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this._pending.delete(id);
                reject(new Error('Export worker request timed out'));
            }, REQUEST_TIMEOUT_MS);

            this._pending.set(id, { resolve, reject, timeoutId });
            worker.postMessage({ id, op, payload });
        });
    },

    async serializeExport(data, options = {}) {
        const response = await this._call('serialize-export', {
            data,
            options: {
                compress: options.compress === true
            }
        });

        const buffer = response?.buffer;
        const bytes = buffer instanceof ArrayBuffer
            ? new Uint8Array(buffer)
            : new Uint8Array();

        return {
            bytes,
            compressed: Boolean(response?.compressed),
            mimeType: String(response?.mimeType || 'application/octet-stream'),
            extension: String(response?.extension || 'bin')
        };
    },

    terminate() {
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
        }
        this._available = false;
        this._initialized = false;
        this._rejectPending(new Error('Export worker terminated'));
    },

    _resetForTests() {
        this.terminate();
        this._nextId = 1;
    }
};

window.EphemeraExportWorker = EphemeraExportWorker;
EphemeraExportWorker.init();

export default EphemeraExportWorker;
