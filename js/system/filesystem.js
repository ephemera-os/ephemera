const EphemeraFS = {
    separator: '/',
    root: '/',
    homeDir: '/home/user',
    HISTORY_INTERVAL_MS: 5 * 60 * 1000,
    HISTORY_WARNING_INTERVAL_MS: 5 * 60 * 1000,
    _historyHooksBound: false,
    _historyWarnedAt: 0,
    _historySequence: 0,
    _pendingCloseSnapshots: new Map(),
    _flushSnapshotsPromise: null,

    async init(homeDir = null) {
        this._ensureHistoryHooks();

        if (homeDir) {
            this.homeDir = homeDir;
        }

        await this.ensureDir('/home');
        await this.ensureDir(this.homeDir);
        await this.ensureDir(`${this.homeDir}/Documents`);
        await this.ensureDir(`${this.homeDir}/Downloads`);
        await this.ensureDir(`${this.homeDir}/Pictures`);
        await this.ensureDir(`${this.homeDir}/Music`);
        await this.ensureDir(`${this.homeDir}/Videos`);
        await this.ensureDir(`${this.homeDir}/apps`);
        await this.ensureDir(`${this.homeDir}/.trash`);

        const readme = await this.readFile(`${this.homeDir}/readme.txt`);
        if (!readme) {
            await this.writeFile(`${this.homeDir}/readme.txt`,
`Welcome to Ephemera!

This is your personal browser-based operating system.

Features:
- Virtual file system with persistent storage
- Code editor with syntax highlighting
- Web browser with CORS proxy support
- Multiple workspaces (Ctrl + 1-4)
- App development platform

Press Win/Cmd + Space to open search.
Right-click desktop for context menu.

Enjoy exploring!
`);
        }

        const welcomeMd = await this.readFile(`${this.homeDir}/Documents/welcome.md`);
        if (!welcomeMd) {
            await this.writeFile(`${this.homeDir}/Documents/welcome.md`,
`# Welcome to Ephemera

## Getting Started

1. **Files** - Browse and manage your virtual file system
2. **Code** - Write and run JavaScript applications
3. **Browser** - Browse the web (with CORS proxy)
4. **Terminal** - Use command line tools

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl + 1-4 | Switch workspaces |
| Ctrl + Shift + 1-4 | Move active window |
| Super/Cmd + Tab | Workspace overview |
| Win/Cmd + Space | Open search |
| Ctrl + W | Close window |
| Ctrl + Tab | Cycle windows |
| F11 | Maximize |
| Ctrl + Shift + T | Open terminal |
| Ctrl + Shift + E | Open files |

## Developing Apps

Create apps in \`${this.homeDir}/apps\` folder.
Each app needs an \`app.json\` manifest.
`);
        }
    },

    _ensureHistoryHooks() {
        if (this._historyHooksBound) return;
        this._historyHooksBound = true;

        if (window.EphemeraEvents?.on) {
            EphemeraEvents.on('window:closed', () => {
                if (this._getHistoryMode() !== 'on-close') return;
                this.flushPendingSnapshots().catch((error) => {
                    console.warn('[EphemeraFS] Failed to flush pending snapshots on close:', error);
                });
            });
        }

        if (typeof window.addEventListener === 'function') {
            window.addEventListener('beforeunload', () => {
                if (this._getHistoryMode() !== 'on-close' || this._pendingCloseSnapshots.size === 0) return;
                this.flushPendingSnapshots().catch(() => {});
            });
        }
    },

    _getHistoryMode() {
        const mode = String(window.EphemeraState?.settings?.fileHistoryMode || 'every-save').toLowerCase();
        if (mode === 'interval-5m' || mode === 'on-close') {
            return mode;
        }
        return 'every-save';
    },

    getHistoryMaxVersions() {
        const raw = Number.parseInt(window.EphemeraState?.settings?.fileHistoryMaxVersions, 10);
        if (Number.isFinite(raw) && raw > 0) {
            return Math.min(raw, 200);
        }
        return 10;
    },

    getHistoryWarningThresholdBytes() {
        const thresholdMb = Number.parseFloat(window.EphemeraState?.settings?.fileHistoryWarnMb);
        const safeMb = Number.isFinite(thresholdMb) && thresholdMb > 0 ? thresholdMb : 25;
        return Math.round(safeMb * 1024 * 1024);
    },

    _estimateContentSize(content) {
        if (typeof content === 'string') {
            return content.length;
        }
        if (content instanceof ArrayBuffer) {
            return content.byteLength;
        }
        if (ArrayBuffer.isView(content)) {
            return content.byteLength;
        }
        if (content && typeof content === 'object') {
            try {
                return JSON.stringify(content).length;
            } catch (_error) {
                void _error;
            }
        }
        return 0;
    },

    _contentToBytes(content) {
        if (content instanceof ArrayBuffer) {
            return new Uint8Array(content);
        }
        if (ArrayBuffer.isView(content)) {
            return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
        }
        return null;
    },

    _contentEquals(a, b) {
        if (a === b) return true;

        const bytesA = this._contentToBytes(a);
        const bytesB = this._contentToBytes(b);
        if (bytesA && bytesB) {
            if (bytesA.length !== bytesB.length) return false;
            for (let i = 0; i < bytesA.length; i++) {
                if (bytesA[i] !== bytesB[i]) return false;
            }
            return true;
        }

        if (typeof a === 'string' && typeof b === 'string') {
            return a === b;
        }

        if (a && b && typeof a === 'object' && typeof b === 'object') {
            try {
                return JSON.stringify(a) === JSON.stringify(b);
            } catch (_error) {
                void _error;
            }
        }

        return false;
    },

    _buildVersionId(path, createdAt) {
        const nonce = Math.random().toString(36).slice(2, 10);
        return `${path}::${createdAt}::${nonce}`;
    },

    _compareVersionEntries(a, b, order = 'desc') {
        const asc = order === 'asc';
        const ta = Number(a?.createdAt || 0);
        const tb = Number(b?.createdAt || 0);
        if (ta !== tb) {
            return asc ? ta - tb : tb - ta;
        }

        const sa = Number(a?.sequence || 0);
        const sb = Number(b?.sequence || 0);
        if (sa !== sb) {
            return asc ? sa - sb : sb - sa;
        }

        const ia = String(a?.id || '');
        const ib = String(b?.id || '');
        return asc ? ia.localeCompare(ib) : ib.localeCompare(ia);
    },

    _createVersionRecord(path, file, reason = 'save', createdAt = Date.now()) {
        const normalizedPath = this.normalizePath(path);
        const timestamp = Number.isFinite(createdAt) ? createdAt : Date.now();
        const size = Number.isFinite(file?.size) ? file.size : this._estimateContentSize(file?.content);

        return {
            id: this._buildVersionId(normalizedPath, timestamp),
            path: normalizedPath,
            name: file?.name || this.getBasename(normalizedPath),
            extension: file?.extension || this.getExtension(normalizedPath),
            mimeType: file?.mimeType || this.getMimeType(normalizedPath),
            content: file?.content,
            size,
            reason,
            sourceCreatedAt: file?.createdAt || timestamp,
            sourceModifiedAt: file?.modifiedAt || timestamp,
            sequence: ++this._historySequence,
            createdAt: timestamp
        };
    },

    async _persistVersionRecord(record) {
        await EphemeraStorage.put('fileVersions', record);
        await this._enforceVersionRetention(record.path);
        EphemeraEvents.emit('fs:history:changed', {
            path: record.path,
            versionId: record.id,
            createdAt: record.createdAt
        });
        await this._maybeWarnVersionPressure();
    },

    async _maybeSnapshotBeforeWrite(path, existingFile, newContent, metadata = {}) {
        if (!existingFile || existingFile.type !== 'file') return;
        if (metadata.skipHistory === true) return;
        if (this._contentEquals(existingFile.content, newContent)) return;

        const mode = this._getHistoryMode();
        const snapshotAt = Date.now();
        const record = this._createVersionRecord(
            path,
            existingFile,
            metadata.historyReason || 'save',
            snapshotAt
        );

        if (mode === 'on-close') {
            this._pendingCloseSnapshots.set(this.normalizePath(path), record);
            return;
        }

        if (mode === 'interval-5m') {
            const latest = await this.getFileVersions(path, { limit: 1, order: 'desc' });
            const lastSnapshotAt = latest[0]?.createdAt || 0;
            if (snapshotAt - lastSnapshotAt < this.HISTORY_INTERVAL_MS) {
                return;
            }
        }

        await this._persistVersionRecord(record);
    },

    async flushPendingSnapshots() {
        if (this._flushSnapshotsPromise) {
            return this._flushSnapshotsPromise;
        }

        const pending = Array.from(this._pendingCloseSnapshots.values());
        if (pending.length === 0) {
            return 0;
        }
        this._pendingCloseSnapshots.clear();

        this._flushSnapshotsPromise = (async () => {
            let flushed = 0;
            for (const record of pending) {
                try {
                    await this._persistVersionRecord(record);
                    flushed++;
                } catch (error) {
                    console.warn('[EphemeraFS] Failed to persist pending snapshot:', error);
                }
            }
            return flushed;
        })();

        try {
            return await this._flushSnapshotsPromise;
        } finally {
            this._flushSnapshotsPromise = null;
        }
    },

    async getFileVersion(versionId) {
        if (!versionId) return null;
        return await EphemeraStorage.get('fileVersions', versionId);
    },

    async getFileVersions(path, options = {}) {
        const normalizedPath = this.normalizePath(path);
        let versions = [];

        try {
            versions = await EphemeraStorage.getByIndex('fileVersions', 'path', normalizedPath);
        } catch (_error) {
            void _error;
            versions = [];
        }

        const order = options.order === 'asc' ? 'asc' : 'desc';
        const sorted = (versions || [])
            .filter((entry) => entry && entry.path === normalizedPath)
            .sort((a, b) => this._compareVersionEntries(a, b, order));

        if (Number.isFinite(options.limit) && options.limit > 0) {
            return sorted.slice(0, options.limit);
        }
        return sorted;
    },

    async getAllFileVersions() {
        let versions = [];
        try {
            versions = await EphemeraStorage.getAll('fileVersions');
        } catch (_error) {
            void _error;
            versions = [];
        }

        return (versions || []).sort((a, b) => this._compareVersionEntries(a, b, 'desc'));
    },

    async _enforceVersionRetention(path) {
        const keep = this.getHistoryMaxVersions();
        if (!Number.isFinite(keep) || keep < 1) return 0;

        const versions = await this.getFileVersions(path, { order: 'desc' });
        if (versions.length <= keep) return 0;

        const stale = versions.slice(keep);
        let removed = 0;
        for (const entry of stale) {
            await EphemeraStorage.delete('fileVersions', entry.id);
            removed++;
        }

        if (removed > 0) {
            EphemeraEvents.emit('fs:history:changed', {
                path: this.normalizePath(path),
                pruned: removed
            });
        }

        return removed;
    },

    async pruneAllFileVersions(keepPerFile = null) {
        const parsedKeep = keepPerFile === null
            ? this.getHistoryMaxVersions()
            : Number.parseInt(keepPerFile, 10);
        const keep = Number.isFinite(parsedKeep) && parsedKeep >= 0 ? parsedKeep : this.getHistoryMaxVersions();
        const allVersions = await this.getAllFileVersions();
        const byPath = new Map();

        allVersions.forEach((entry) => {
            if (!entry?.path) return;
            if (!byPath.has(entry.path)) {
                byPath.set(entry.path, []);
            }
            byPath.get(entry.path).push(entry);
        });

        let removed = 0;
        for (const [path, entries] of byPath.entries()) {
            entries.sort((a, b) => this._compareVersionEntries(a, b, 'desc'));
            const stale = keep > 0 ? entries.slice(keep) : entries;
            for (const entry of stale) {
                await EphemeraStorage.delete('fileVersions', entry.id);
                removed++;
            }
            if (stale.length > 0) {
                EphemeraEvents.emit('fs:history:changed', {
                    path,
                    pruned: stale.length
                });
            }
        }

        return removed;
    },

    async relinkVersionHistory(oldPath, newPath) {
        const normalizedOldPath = this.normalizePath(oldPath);
        const normalizedNewPath = this.normalizePath(newPath);
        if (normalizedOldPath === normalizedNewPath) return 0;

        const versions = await this.getFileVersions(normalizedOldPath, { order: 'desc' });
        let moved = 0;
        for (const version of versions) {
            await EphemeraStorage.put('fileVersions', {
                ...version,
                path: normalizedNewPath,
                name: this.getBasename(normalizedNewPath),
                extension: this.getExtension(normalizedNewPath),
                mimeType: version.mimeType || this.getMimeType(normalizedNewPath)
            });
            moved++;
        }

        const pending = this._pendingCloseSnapshots.get(normalizedOldPath);
        if (pending) {
            this._pendingCloseSnapshots.delete(normalizedOldPath);
            this._pendingCloseSnapshots.set(normalizedNewPath, {
                ...pending,
                id: this._buildVersionId(normalizedNewPath, pending.createdAt || Date.now()),
                path: normalizedNewPath,
                name: this.getBasename(normalizedNewPath),
                extension: this.getExtension(normalizedNewPath),
                mimeType: pending.mimeType || this.getMimeType(normalizedNewPath)
            });
        }

        if (moved > 0) {
            EphemeraEvents.emit('fs:history:changed', {
                path: normalizedNewPath,
                relinkedFrom: normalizedOldPath,
                moved
            });
        }

        return moved;
    },

    async restoreFileVersion(versionId) {
        const version = await this.getFileVersion(versionId);
        if (!version || !version.path) return false;

        const normalizedPath = this.normalizePath(version.path);
        const existing = await this.stat(normalizedPath);
        const createdAt = existing?.createdAt
            || version.sourceCreatedAt
            || version.sourceModifiedAt
            || Date.now();

        await this.writeFile(normalizedPath, version.content, {
            createdAt,
            mimeType: version.mimeType || this.getMimeType(normalizedPath),
            historyReason: 'restore'
        });

        EphemeraEvents.emit('fs:history:restored', {
            path: normalizedPath,
            versionId
        });
        return true;
    },

    async getVersionStorageStats() {
        const versions = await this.getAllFileVersions();
        let size = 0;
        const paths = new Set();

        versions.forEach((entry) => {
            if (!entry) return;
            if (entry.path) paths.add(entry.path);
            size += Number.isFinite(entry.size) ? entry.size : this._estimateContentSize(entry.content);
        });

        const thresholdBytes = this.getHistoryWarningThresholdBytes();
        return {
            count: versions.length,
            files: paths.size,
            size,
            thresholdBytes,
            overThreshold: size >= thresholdBytes
        };
    },

    async _maybeWarnVersionPressure(precomputedStats = null) {
        const stats = precomputedStats || await this.getVersionStorageStats();
        if (!stats.overThreshold) {
            return stats;
        }

        const now = Date.now();
        if (now - this._historyWarnedAt < this.HISTORY_WARNING_INTERVAL_MS) {
            return stats;
        }
        this._historyWarnedAt = now;

        if (window.EphemeraNotifications?.warning) {
            const usedMb = (stats.size / (1024 * 1024)).toFixed(1);
            const thresholdMb = (stats.thresholdBytes / (1024 * 1024)).toFixed(1);
            window.EphemeraNotifications.warning(
                'Version History Storage',
                `Version history is using ${usedMb} MB (threshold ${thresholdMb} MB). Open Settings > Data to prune old versions.`
            );
        }

        EphemeraEvents.emit('fs:history:warning', stats);
        return stats;
    },

    getTrashDir() {
        return `${this.homeDir}/.trash`;
    },

    normalizePath(path) {
        if (!path.startsWith(this.separator)) {
            path = this.separator + path;
        }
        const parts = path.split(this.separator).filter(p => p && p !== '.');
        const result = [];

        for (const part of parts) {
            if (part === '..') {
                result.pop();
            } else {
                result.push(part);
            }
        }

        return this.separator + result.join(this.separator);
    },

    getParentDir(path) {
        const normalized = this.normalizePath(path);
        const parts = normalized.split(this.separator).filter(p => p);
        parts.pop();
        return parts.length === 0 ? this.root : this.separator + parts.join(this.separator);
    },

    getBasename(path) {
        const normalized = this.normalizePath(path);
        const parts = normalized.split(this.separator).filter(p => p);
        return parts[parts.length - 1] || '';
    },

    getExtension(path) {
        const basename = this.getBasename(path);
        const dotIndex = basename.lastIndexOf('.');
        return dotIndex > 0 ? basename.slice(dotIndex + 1).toLowerCase() : '';
    },

    async exists(path) {
        const file = await EphemeraStorage.get('files', this.normalizePath(path));
        return !!file;
    },

    async stat(path) {
        return await EphemeraStorage.get('files', this.normalizePath(path));
    },

    async readFile(path) {
        const file = await EphemeraStorage.get('files', this.normalizePath(path));
        if (!file) return null;
        if (file.type === 'directory') throw new Error('Is a directory');
        return file.content;
    },

    async writeFile(path, content, metadata = {}) {
        const normalizedPath = this.normalizePath(path);
        const extension = this.getExtension(normalizedPath) || 'none';
        const saveSpan = window.EphemeraPerformance?.start?.('file.save_ms', {
            extension
        });
        let saveStatus = 'error';
        const parentDir = this.getParentDir(normalizedPath);
        const existingFile = await EphemeraStorage.get('files', normalizedPath);

        try {
            if (parentDir !== this.root) {
                const parent = await EphemeraStorage.get('files', parentDir);
                if (!parent) {
                    await this.ensureDir(parentDir);
                }
            }

            if (existingFile && existingFile.type === 'directory') {
                throw new Error('Cannot overwrite directory');
            }

            await this._maybeSnapshotBeforeWrite(normalizedPath, existingFile, content, metadata);

            const timestamp = Date.now();
            const createdAtRaw = Number(metadata.createdAt);
            const modifiedAtRaw = Number(metadata.modifiedAt);
            const createdAt = Number.isFinite(createdAtRaw) && createdAtRaw > 0
                ? createdAtRaw
                : (existingFile?.createdAt || timestamp);
            const modifiedAt = Number.isFinite(modifiedAtRaw) && modifiedAtRaw > 0
                ? modifiedAtRaw
                : timestamp;
            const file = {
                path: normalizedPath,
                name: this.getBasename(normalizedPath),
                nameLower: this.getBasename(normalizedPath).toLowerCase(),
                parentDir: parentDir,
                type: 'file',
                extension: this.getExtension(normalizedPath),
                content: content,
                size: this._estimateContentSize(content),
                createdAt,
                modifiedAt,
                mimeType: metadata.mimeType || this.getMimeType(normalizedPath)
            };

            await EphemeraStorage.put('files', file);
            EphemeraEvents.emit('fs:changed', { type: 'write', path: normalizedPath });
            saveStatus = 'ok';
            return file;
        } finally {
            window.EphemeraPerformance?.end?.(saveSpan, {
                extension,
                status: saveStatus
            });
        }
    },

    async ensureDir(path) {
        const normalizedPath = this.normalizePath(path);
        if (normalizedPath === this.root) return;

        const parts = normalizedPath.split(this.separator).filter(p => p);
        let currentPath = '';

        for (const part of parts) {
            currentPath += this.separator + part;
            const existing = await EphemeraStorage.get('files', currentPath);

            if (!existing) {
                const dir = {
                    path: currentPath,
                    name: part,
                    nameLower: part.toLowerCase(),
                    parentDir: currentPath.substring(0, currentPath.lastIndexOf(this.separator)) || this.root,
                    type: 'directory',
                    createdAt: Date.now(),
                    modifiedAt: Date.now()
                };
                await EphemeraStorage.put('files', dir);
            }
        }
    },

    async mkdir(path) {
        await this.ensureDir(path);
        EphemeraEvents.emit('fs:changed', { type: 'mkdir', path: this.normalizePath(path) });
    },

    async readdir(path) {
        const normalizedPath = this.normalizePath(path);
        try {
            const files = await EphemeraStorage.getByIndex('files', 'parentDir', normalizedPath);
            return files.sort((a, b) => {
                if (a.type === 'directory' && b.type !== 'directory') return -1;
                if (a.type !== 'directory' && b.type === 'directory') return 1;
                return a.name.localeCompare(b.name);
            });
        } catch (e) {
            // Fallback to getAll if index query fails
            const allFiles = await EphemeraStorage.getAll('files');
            return allFiles.filter(f => f.parentDir === normalizedPath)
                .sort((a, b) => {
                    if (a.type === 'directory' && b.type !== 'directory') return -1;
                    if (a.type !== 'directory' && b.type === 'directory') return 1;
                    return a.name.localeCompare(b.name);
                });
        }
    },

    async delete(path) {
        const normalizedPath = this.normalizePath(path);
        const file = await EphemeraStorage.get('files', normalizedPath);

        if (!file) return false;

        // Move to trash instead of permanent delete
        const trashDir = this.getTrashDir();
        await this.ensureDir(trashDir);

        const trashName = Date.now() + '_' + file.name;
        const trashPath = trashDir + '/' + trashName;

        if (file.type === 'directory') {
            // For directories, recursively move children
            const children = await this.readdir(normalizedPath);
            for (const child of children) {
                await this.permanentDelete(child.path);
            }
            // Store directory metadata in trash
            const trashEntry = {
                ...file,
                path: trashPath,
                name: trashName,
                parentDir: trashDir,
                _originalPath: normalizedPath,
                _trashedAt: Date.now()
            };
            await EphemeraStorage.put('files', trashEntry);
        } else {
            const trashEntry = {
                ...file,
                path: trashPath,
                name: trashName,
                parentDir: trashDir,
                _originalPath: normalizedPath,
                _trashedAt: Date.now()
            };
            await EphemeraStorage.put('files', trashEntry);
        }

        this._pendingCloseSnapshots.delete(normalizedPath);
        await EphemeraStorage.delete('files', normalizedPath);
        EphemeraEvents.emit('fs:changed', { type: 'delete', path: normalizedPath });
        return true;
    },

    async permanentDelete(path) {
        const normalizedPath = this.normalizePath(path);
        const file = await EphemeraStorage.get('files', normalizedPath);

        if (!file) return false;

        if (file.type === 'directory') {
            const children = await this.readdir(normalizedPath);
            for (const child of children) {
                await this.permanentDelete(child.path);
            }
        }

        this._pendingCloseSnapshots.delete(normalizedPath);
        await EphemeraStorage.delete('files', normalizedPath);
        EphemeraEvents.emit('fs:changed', { type: 'delete', path: normalizedPath });
        return true;
    },

    async emptyTrash() {
        const trashDir = this.getTrashDir();
        const items = await this.readdir(trashDir);
        for (const item of items) {
            await this.permanentDelete(item.path);
        }
    },

    async restore(trashPath) {
        const file = await EphemeraStorage.get('files', trashPath);
        if (!file) return false;

        const originalPath = file._originalPath;
        if (!originalPath) return false;

        // Ensure parent directory exists
        const parentDir = this.getParentDir(originalPath);
        await this.ensureDir(parentDir);

        const restored = { ...file };
        restored.path = originalPath;
        restored.name = this.getBasename(originalPath);
        restored.parentDir = parentDir;
        delete restored._originalPath;
        delete restored._trashedAt;

        await EphemeraStorage.put('files', restored);
        await EphemeraStorage.delete('files', trashPath);
        EphemeraEvents.emit('fs:changed', { type: 'restore', path: originalPath });
        return true;
    },

    async move(oldPath, newPath) {
        const normalizedOldPath = this.normalizePath(oldPath);
        const normalizedNewPath = this.normalizePath(newPath);
        const content = await this.readFile(normalizedOldPath);
        if (content === null) throw new Error('File not found');

        await this.writeFile(normalizedNewPath, content);
        await this.relinkVersionHistory(normalizedOldPath, normalizedNewPath);
        await this.permanentDelete(normalizedOldPath);
        EphemeraEvents.emit('fs:changed', {
            type: 'move',
            oldPath: normalizedOldPath,
            newPath: normalizedNewPath
        });
    },

    async copy(sourcePath, destPath) {
        const content = await this.readFile(sourcePath);
        if (content === null) throw new Error('File not found');

        await this.writeFile(destPath, content);
        EphemeraEvents.emit('fs:changed', { type: 'copy', sourcePath, destPath });
    },

    async _searchInMainThread(query, startPath = '/') {
        const lowerQuery = String(query || '').toLowerCase();
        const safeStartPath = String(startPath || '/');
        const results = [];
        const MAX_RESULTS = 20;

        return new Promise((resolve) => {
            if (!EphemeraStorage?.db) {
                resolve(results);
                return;
            }

            const tx = EphemeraStorage.db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = event.target.result;

                if (!cursor || results.length >= MAX_RESULTS) {
                    if (safeStartPath !== '/') {
                        resolve(results.filter(file => String(file.path || '').startsWith(safeStartPath)));
                    } else {
                        resolve(results);
                    }
                    return;
                }

                const file = cursor.value;
                const path = String(file?.path || '');

                if (safeStartPath !== '/' && !path.startsWith(safeStartPath)) {
                    cursor.continue();
                    return;
                }

                const nameLower = file.nameLower || (file.name && file.name.toLowerCase()) || '';
                if (path.toLowerCase().includes(lowerQuery) || nameLower.includes(lowerQuery)) {
                    results.push(file);
                } else if (file.type === 'file' && typeof file.content === 'string') {
                    if (file.content.toLowerCase().includes(lowerQuery)) {
                        results.push({ ...file, matchType: 'content' });
                    }
                }

                cursor.continue();
            };

            request.onerror = () => {
                console.error('[EphemeraFS] Search failed:', request.error);
                resolve([]);
            };
        });
    },

    async search(query, startPath = '/') {
        const safeQuery = String(query || '');
        const safeStartPath = String(startPath || '/');

        if (window.EphemeraFsWorker?.searchFiles) {
            try {
                return await window.EphemeraFsWorker.searchFiles(
                    safeQuery,
                    safeStartPath,
                    {
                        maxResults: 20,
                        dbName: EphemeraStorage?.dbName,
                        dbVersion: EphemeraStorage?.dbVersion
                    }
                );
            } catch (_error) {
                // Fallback to main-thread search path.
            }
        }

        return this._searchInMainThread(safeQuery, safeStartPath);
    },

    getMimeType(path) {
        const ext = this.getExtension(path);
        const mimeTypes = {
            'txt': 'text/plain',
            'md': 'text/markdown',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'json': 'application/json',
            'xml': 'application/xml',
            'svg': 'image/svg+xml',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'pdf': 'application/pdf',
            'zip': 'application/zip'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    },

    isTextFile(path) {
        const ext = this.getExtension(path);
        return ['txt', 'md', 'html', 'css', 'js', 'json', 'xml', 'svg', 'log', 'yml', 'yaml', 'ini', 'cfg', 'sh', 'bat'].includes(ext);
    },

    getIcon(file) {
        if (file.type === 'directory') {
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`;
        }

        const ext = file.extension || this.getExtension(file.path || file.name);
        const icons = {
            'js': `<svg viewBox="0 0 24 24" fill="#f7df1e"><rect width="24" height="24" rx="3"/><text x="12" y="17" text-anchor="middle" font-size="10" fill="#000" font-weight="bold">JS</text></svg>`,
            'html': `<svg viewBox="0 0 24 24" fill="#e34c26"><rect width="24" height="24" rx="3"/><text x="12" y="17" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">HTML</text></svg>`,
            'css': `<svg viewBox="0 0 24 24" fill="#264de4"><rect width="24" height="24" rx="3"/><text x="12" y="17" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">CSS</text></svg>`,
            'json': `<svg viewBox="0 0 24 24" fill="none" stroke="#f7df1e" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>`,
            'md': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M12 18v-6l2 2 2-2v6"/><path d="M8 12v6"/><path d="M8 12l2 2-2 2"/></svg>`,
            'png': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
            'jpg': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
            'gif': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
            'mp3': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
            'wav': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
            'ogg': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
            'mp4': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`
        };

        return icons[ext] || `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    }
};

window.EphemeraFS = EphemeraFS;
