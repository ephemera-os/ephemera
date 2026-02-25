function sanitizePath(path) {
    return String(path || '');
}

function normalizeLimit(value, fallback = 20) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return parsed;
}

function toSearchResults(records, query, startPath, maxResults) {
    const safeQuery = String(query || '').toLowerCase();
    const safeStartPath = sanitizePath(startPath || '/');
    const out = [];
    const list = Array.isArray(records) ? records : [];

    for (let i = 0; i < list.length; i++) {
        if (out.length >= maxResults) break;
        const file = list[i];
        if (!file || typeof file !== 'object') continue;

        const path = sanitizePath(file.path);
        if (safeStartPath !== '/' && !path.startsWith(safeStartPath)) {
            continue;
        }

        const pathLower = path.toLowerCase();
        const nameLower = String(file.nameLower || file.name || '').toLowerCase();
        if (pathLower.includes(safeQuery) || nameLower.includes(safeQuery)) {
            out.push(file);
            continue;
        }

        if (file.type === 'file' && typeof file.content === 'string') {
            if (file.content.toLowerCase().includes(safeQuery)) {
                out.push({
                    ...file,
                    matchType: 'content'
                });
            }
        }
    }

    return out;
}

function openDb(dbName, dbVersion) {
    return new Promise((resolve, reject) => {
        const safeName = String(dbName || '');
        const safeVersion = Number(dbVersion);
        const request = Number.isFinite(safeVersion) && safeVersion > 0
            ? indexedDB.open(safeName, safeVersion)
            : indexedDB.open(safeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    });
}

function searchDbFiles(payload = {}) {
    const query = String(payload.query || '').toLowerCase();
    const startPath = sanitizePath(payload.startPath || '/');
    const maxResults = normalizeLimit(payload.maxResults, 20);
    const dbName = String(payload.dbName || '');
    const dbVersion = Number(payload.dbVersion) || undefined;

    if (!dbName) {
        return Promise.resolve([]);
    }

    return new Promise(async (resolve) => {
        let db = null;
        let settled = false;
        const results = [];

        const finish = (value) => {
            if (settled) return;
            settled = true;
            try {
                db?.close();
            } catch (_error) {
                // Ignore close errors.
            }
            resolve(Array.isArray(value) ? value : []);
        };

        try {
            db = await openDb(dbName, dbVersion);
            const tx = db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const request = store.openCursor();

            tx.onabort = () => finish([]);
            tx.onerror = () => finish([]);

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor || results.length >= maxResults) {
                    finish(results);
                    return;
                }

                const file = cursor.value;
                if (!file || typeof file !== 'object') {
                    cursor.continue();
                    return;
                }

                const path = sanitizePath(file.path);
                if (startPath !== '/' && !path.startsWith(startPath)) {
                    cursor.continue();
                    return;
                }

                const pathLower = path.toLowerCase();
                const nameLower = String(file.nameLower || file.name || '').toLowerCase();

                if (pathLower.includes(query) || nameLower.includes(query)) {
                    results.push(file);
                } else if (file.type === 'file' && typeof file.content === 'string') {
                    if (file.content.toLowerCase().includes(query)) {
                        results.push({
                            ...file,
                            matchType: 'content'
                        });
                    }
                }

                cursor.continue();
            };

            request.onerror = () => finish([]);
        } catch (_error) {
            finish([]);
        }
    });
}

self.onmessage = (event) => {
    const message = event?.data || {};
    const id = Number(message.id);
    const op = String(message.op || '');
    const payload = message.payload || {};

    if (!Number.isFinite(id)) return;

    try {
        if (op !== 'search-files') {
            throw new Error(`Unsupported fs worker op: ${op}`);
        }

        if (Array.isArray(payload.records)) {
            const results = toSearchResults(
                payload.records,
                payload.query,
                payload.startPath,
                normalizeLimit(payload.maxResults, 20)
            );

            self.postMessage({
                id,
                ok: true,
                result: results
            });
            return;
        }

        searchDbFiles(payload).then((results) => {
            self.postMessage({
                id,
                ok: true,
                result: Array.isArray(results) ? results : []
            });
        }).catch((error) => {
            self.postMessage({
                id,
                ok: false,
                error: error?.message || 'FS worker operation failed'
            });
        });
    } catch (error) {
        self.postMessage({
            id,
            ok: false,
            error: error?.message || 'FS worker operation failed'
        });
    }
};
