const EphemeraSyncManager = {
    _provider: null,
    _providerName: 'none',
    _status: 'idle',       // 'idle' | 'syncing' | 'error' | 'synced'
    _error: null,
    _debounceTimer: null,
    _pendingChanges: new Map(), // path -> event
    _syncing: false,            // loop-guard: skip fs:changed during pull

    // Lifecycle

    async init() {
        const providerName = EphemeraState?.settings?.syncProvider || 'none';
        if (providerName !== 'none') {
            await this._initProvider(providerName).catch(e => {
                console.warn('[SyncManager] Provider init failed:', e.message);
            });
        }

        EphemeraEvents.on('fs:changed', (event) => this._onFsChanged(event));

        if (typeof EphemeraSession !== 'undefined' && EphemeraSession.onLock) {
            EphemeraSession.onLock(() => this._teardownProvider());
        }
        if (typeof EphemeraSession !== 'undefined' && EphemeraSession.onUnlock) {
            EphemeraSession.onUnlock(() => {
                this._restoreProviderAfterUnlock().catch(e => {
                    this._setStatus('error', e.message);
                    console.warn('[SyncManager] Provider restore failed:', e.message);
                });
            });
        }

        // schedule initial sync after desktop is ready (non-blocking)
        setTimeout(() => {
            if (this._provider && EphemeraState?.settings?.syncAutoEnabled !== false) {
                this.syncAll().catch(e => console.warn('[SyncManager] Initial sync failed:', e.message));
            }
        }, 2000);
    },

    async _restoreProviderAfterUnlock() {
        const configuredProvider = EphemeraState?.settings?.syncProvider || this._providerName || 'none';
        if (!configuredProvider || configuredProvider === 'none') {
            this._providerName = 'none';
            this._provider = null;
            this._setStatus('idle');
            return;
        }

        await this._initProvider(configuredProvider);
        if (EphemeraState?.settings?.syncAutoEnabled !== false) {
            await this.syncAll().catch(e => {
                console.warn('[SyncManager] Post-unlock sync failed:', e.message);
            });
        } else {
            this._setStatus('idle');
        }
    },

    async _initProvider(name) {
        this._providerName = name;
        this._provider = null;

        try {
            if (name === 'rest') {
                const RestProvider = typeof EphemeraRestProvider !== 'undefined'
                    ? EphemeraRestProvider
                    : (typeof window !== 'undefined' ? window.EphemeraRestProvider : null);
                if (!RestProvider) throw new Error('REST provider is unavailable');

                const url = EphemeraState.settings.syncRestUrl || '';
                const token = await this._getSecret('syncRestToken');
                if (!url || !token) throw new Error('REST: missing server URL or token');
                this._provider = new RestProvider(url, token);
            }

            console.info('[SyncManager] Provider ready:', name);
        } catch (e) {
            this._provider = null;
            console.warn('[SyncManager] Provider init error:', e.message);
            throw e;
        }
    },

    _teardownProvider() {
        this._provider = null;
        this._pendingChanges.clear();
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
        this._status = 'idle';
    },

    // Secret storage helper

    async _getSecret(key) {
        try {
            const record = await EphemeraStorage.get('metadata', key);
            return record?.value || '';
        } catch {
            return '';
        }
    },

    async _setSecret(key, value) {
        await EphemeraStorage.put('metadata', { key, value });
    },

    // fs:changed handler

    _onFsChanged(event) {
        if (this._syncing) return;                                    // loop-guard
        if (!this._provider) return;
        if (EphemeraState?.settings?.syncAutoEnabled === false) return;

        const path = event?.path || event?.newPath || event?.destPath;
        if (!path) return;

        this._pendingChanges.set(path, event);

        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => this._flushPendingChanges(), 1500);
    },

    async _flushPendingChanges() {
        if (!this._provider || this._pendingChanges.size === 0) return;

        const changes = new Map(this._pendingChanges);
        this._pendingChanges.clear();
        this._debounceTimer = null;

        this._setStatus('syncing');
        this._syncing = true;
        try {
            for (const [, event] of changes) {
                await this._syncChange(event).catch(e =>
                    console.warn('[SyncManager] Change sync failed:', e.message)
                );
            }
            this._setStatus('synced');
        } catch (e) {
            this._setStatus('error', e.message);
        } finally {
            this._syncing = false;
        }
    },

    async _syncChange(event) {
        const type = event?.type;
        const path = event?.path;

        if (type === 'write' || type === 'create') {
            const files = await EphemeraStorage.getAll?.('files') || [];
            const stat = files.find(f => f.path === path);
            if (stat) {
                await this._provider.push(path, stat.content ?? '', stat);
            }
        } else if (type === 'delete') {
            await this._provider.delete(path);
        } else if (type === 'move') {
            const oldPath = event.oldPath || path;
            const newPath = event.newPath || path;
            const files = await EphemeraStorage.getAll?.('files') || [];
            const stat = files.find(f => f.path === newPath);
            if (stat) await this._provider.push(newPath, stat.content ?? '', stat);
            if (oldPath !== newPath) await this._provider.delete(oldPath);
        } else if (type === 'copy') {
            const destPath = event.destPath || path;
            const files = await EphemeraStorage.getAll?.('files') || [];
            const stat = files.find(f => f.path === destPath);
            if (stat) await this._provider.push(destPath, stat.content ?? '', stat);
        } else if (type === 'mkdir') {
            await this._provider.mkdir(path);
        }
    },

    _isTextMimeType(mimeType) {
        const mime = String(mimeType || '').split(';')[0].trim().toLowerCase();
        if (!mime) return false;
        if (mime.startsWith('text/')) return true;
        if (mime.endsWith('+json') || mime.endsWith('+xml')) return true;
        return [
            'application/json',
            'application/xml',
            'application/javascript',
            'application/ecmascript',
            'application/typescript',
            'application/x-javascript',
            'application/x-typescript',
            'application/yaml',
            'application/x-yaml',
            'application/toml',
            'image/svg+xml'
        ].includes(mime);
    },

    _toArrayBuffer(content) {
        if (content instanceof ArrayBuffer) return content;
        if (ArrayBuffer.isView(content)) {
            return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
        }
        return null;
    },

    _contentToBytes(content) {
        if (content instanceof ArrayBuffer) return new Uint8Array(content);
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

        return false;
    },

    _extractPullResult(rawValue, path, localFile = null) {
        let content = rawValue;
        let mimeType = null;
        let modifiedAt = 0;

        const payloadObject = rawValue
            && typeof rawValue === 'object'
            && !(rawValue instanceof ArrayBuffer)
            && !ArrayBuffer.isView(rawValue)
            && Object.prototype.hasOwnProperty.call(rawValue, 'content');

        if (payloadObject) {
            content = rawValue.content;
            mimeType = rawValue.mimeType || null;
            modifiedAt = Number(rawValue.modifiedAt || 0);
        }

        if (content === null || content === undefined) {
            content = '';
        }

        const fileLooksText = typeof EphemeraFS !== 'undefined'
            && typeof EphemeraFS.isTextFile === 'function'
            && EphemeraFS.isTextFile(path);

        const shouldDecodeAsText = this._isTextMimeType(mimeType)
            || this._isTextMimeType(localFile?.mimeType)
            || fileLooksText;

        const binaryContent = this._toArrayBuffer(content);
        if (binaryContent && shouldDecodeAsText) {
            content = new TextDecoder().decode(binaryContent);
        } else if (binaryContent) {
            content = binaryContent;
        }

        const fallbackMimeType = typeof EphemeraFS !== 'undefined'
            && typeof EphemeraFS.getMimeType === 'function'
            ? EphemeraFS.getMimeType(path)
            : null;

        return {
            content,
            mimeType: String(mimeType || localFile?.mimeType || fallbackMimeType || '').trim() || null,
            modifiedAt: Number.isFinite(modifiedAt) && modifiedAt > 0 ? modifiedAt : 0
        };
    },

    _buildConflictPath(path, timestamp, index = 0) {
        const normalizedPath = String(path || '/untitled');
        const slashIndex = normalizedPath.lastIndexOf('/');
        const dir = slashIndex > 0 ? normalizedPath.slice(0, slashIndex) : '';
        const fileName = slashIndex >= 0 ? normalizedPath.slice(slashIndex + 1) : normalizedPath;
        const safeName = fileName || 'untitled';
        const dotIndex = safeName.lastIndexOf('.');
        const hasExtension = dotIndex > 0;
        const stem = hasExtension ? safeName.slice(0, dotIndex) : safeName;
        const extension = hasExtension ? safeName.slice(dotIndex) : '';
        const numericTs = Number(timestamp);
        const safeTs = Number.isFinite(numericTs) && numericTs > 0 ? numericTs : Date.now();
        const stamp = new Date(safeTs).toISOString().replace(/[:.]/g, '-');
        const suffix = index > 0 ? `-${index}` : '';
        return `${dir}/${stem}.conflict-${stamp}${suffix}${extension}`;
    },

    async _resolveConflictPath(path, timestamp) {
        let index = 0;
        let candidate = this._buildConflictPath(path, timestamp, index);
        if (typeof EphemeraFS === 'undefined' || typeof EphemeraFS.exists !== 'function') {
            return candidate;
        }

        while (await EphemeraFS.exists(candidate)) {
            index += 1;
            candidate = this._buildConflictPath(path, timestamp, index);
        }
        return candidate;
    },

    async _createConflictCopy(path, localFile, incomingContent, incomingModifiedAt, incomingMimeType) {
        if (!localFile || typeof EphemeraFS === 'undefined' || typeof EphemeraFS.writeFile !== 'function') {
            return null;
        }

        const localModifiedAt = Number(localFile.modifiedAt || 0);
        const remoteModifiedAt = Number(incomingModifiedAt || 0);
        if (remoteModifiedAt > 0 && remoteModifiedAt <= localModifiedAt) {
            return null;
        }
        if (this._contentEquals(localFile.content, incomingContent)) {
            return null;
        }

        const conflictPath = await this._resolveConflictPath(path, localModifiedAt || Date.now());
        await EphemeraFS.writeFile(conflictPath, localFile.content, {
            createdAt: localFile.createdAt || Date.now(),
            modifiedAt: localFile.modifiedAt || Date.now(),
            mimeType: localFile.mimeType || incomingMimeType || 'application/octet-stream'
        });
        return conflictPath;
    },

    // Full sync

    async syncAll() {
        if (!this._provider && this._providerName !== 'none') {
            const sessionLocked = typeof EphemeraSession !== 'undefined'
                && typeof EphemeraSession.isLocked === 'function'
                && EphemeraSession.isLocked();
            if (!sessionLocked) {
                await this._initProvider(this._providerName).catch(() => {});
            }
        }

        if (!this._provider) return;
        this._setStatus('syncing');

        try {
            const allFiles = (await EphemeraStorage.getAll?.('files')) || [];
            const localFiles = allFiles.filter(f =>
                f.type === 'file' && f.path && !f.path.includes('/.trash/')
            );

            const remoteList = await this._provider.list();
            const remoteMap = new Map(remoteList
                .filter(r => r.type === 'file')
                .map(r => [r.path, r])
            );

            // push local -> remote
            for (const local of localFiles) {
                const remote = remoteMap.get(local.path);
                if (!remote || (local.modifiedAt || 0) > (remote.modifiedAt || 0)) {
                    await this._provider.push(local.path, local.content ?? '', local).catch(e =>
                        console.warn('[SyncManager] Push failed:', local.path, e.message)
                    );
                }
            }

            // pull remote -> local
            const localMap = new Map(localFiles.map(f => [f.path, f]));
            for (const remote of remoteList) {
                if (remote.type !== 'file') continue;
                const local = localMap.get(remote.path);
                if (!local || (remote.modifiedAt || 0) > (local.modifiedAt || 0)) {
                    try {
                        const rawPull = await this._provider.pull(remote.path);
                        const pullResult = this._extractPullResult(rawPull, remote.path, local);
                        const resolvedModifiedAt = pullResult.modifiedAt || remote.modifiedAt || Date.now();
                        this._syncing = true;
                        if (typeof EphemeraFS !== 'undefined') {
                            const conflictPath = await this._createConflictCopy(
                                remote.path,
                                local,
                                pullResult.content,
                                resolvedModifiedAt,
                                pullResult.mimeType
                            );

                            await EphemeraFS.writeFile(remote.path, pullResult.content, {
                                modifiedAt: resolvedModifiedAt,
                                mimeType: pullResult.mimeType || undefined
                            });

                            if (conflictPath && typeof EphemeraEvents !== 'undefined') {
                                EphemeraEvents.emit('sync:conflict', {
                                    path: remote.path,
                                    conflictPath,
                                    remoteModifiedAt: resolvedModifiedAt
                                });
                            }
                        }
                    } catch (e) {
                        console.warn('[SyncManager] Pull failed:', remote.path, e.message);
                    } finally {
                        this._syncing = false;
                    }
                }
            }

            EphemeraState.updateSetting('syncLastAt', Date.now());
            this._setStatus('synced');
        } catch (e) {
            this._setStatus('error', e.message);
            throw e;
        }
    },

    // Test connection

    async testConnection() {
        if (!this._provider) throw new Error('No provider configured');
        return this._provider.testConnection();
    },

    // Status helpers

    _setStatus(status, error = null) {
        this._status = status;
        this._error = error;
        if (typeof EphemeraEvents !== 'undefined') {
            EphemeraEvents.emit('sync:status', {
                status,
                error,
                lastSyncAt: EphemeraState?.settings?.syncLastAt || null
            });
        }
    }
};

if (typeof window !== 'undefined') {
    window.EphemeraSyncManager = EphemeraSyncManager;
}
