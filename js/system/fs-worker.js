const REQUEST_TIMEOUT_MS = 30000;

const EphemeraFsWorker = {
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
            this._worker = new Worker(new URL('../workers/fs.worker.js', import.meta.url), {
                type: 'module'
            });
            this._worker.onmessage = (event) => this._onMessage(event?.data || {});
            this._worker.onerror = () => {
                this._available = false;
                this._rejectPending(new Error('FS worker failed'));
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
        pending.reject(new Error(message.error || 'FS worker operation failed'));
    },

    _rejectPending(error) {
        const err = error instanceof Error ? error : new Error(String(error || 'FS worker unavailable'));
        this._pending.forEach((pending) => {
            clearTimeout(pending.timeoutId);
            pending.reject(err);
        });
        this._pending.clear();
    },

    _ensureWorker() {
        const ready = this.init();
        if (!ready || !this._worker) {
            throw new Error('FS worker is unavailable');
        }
        return this._worker;
    },

    _call(op, payload) {
        const worker = this._ensureWorker();
        const id = this._nextId++;
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this._pending.delete(id);
                reject(new Error('FS worker request timed out'));
            }, REQUEST_TIMEOUT_MS);

            this._pending.set(id, { resolve, reject, timeoutId });
            worker.postMessage({ id, op, payload });
        });
    },

    async searchFiles(query, startPath = '/', options = {}) {
        const maxResults = Number.isFinite(options?.maxResults)
            ? Math.max(1, Math.floor(options.maxResults))
            : 20;
        const payload = {
            query: String(query || ''),
            startPath: String(startPath || '/'),
            maxResults
        };

        if (Array.isArray(options.records)) {
            payload.records = options.records;
        }
        if (options.dbName) {
            payload.dbName = String(options.dbName);
        }
        if (Number.isFinite(options.dbVersion) && options.dbVersion > 0) {
            payload.dbVersion = Math.floor(options.dbVersion);
        }

        const response = await this._call('search-files', payload);
        return Array.isArray(response) ? response : [];
    },

    terminate() {
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
        }
        this._available = false;
        this._initialized = false;
        this._rejectPending(new Error('FS worker terminated'));
    },

    _resetForTests() {
        this.terminate();
        this._nextId = 1;
    }
};

window.EphemeraFsWorker = EphemeraFsWorker;
EphemeraFsWorker.init();

export default EphemeraFsWorker;
