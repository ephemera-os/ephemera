const EPHEMERA_SECURE_EXPORT_TYPE = 'ephemera-secure-export';
const EPHEMERA_SECURE_EXPORT_VERSION = 1;
const EPHEMERA_SECURE_EXPORT_MIN_PASSPHRASE_LEN = 12;

const EphemeraDataManagement = {
    _backupDateStamp() {
        return new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    },

    _toUint8Array(value) {
        if (value instanceof Uint8Array) {
            return value;
        }
        if (value instanceof ArrayBuffer) {
            return new Uint8Array(value);
        }
        if (ArrayBuffer.isView(value)) {
            return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        }
        return new Uint8Array();
    },

    _decodeDataUrl(value) {
        const raw = String(value || '');
        const match = raw.match(/^data:([^;,]+)?(?:;(base64))?,([\s\S]*)$/i);
        if (!match) return null;

        const mimeType = String(match[1] || 'application/octet-stream').trim() || 'application/octet-stream';
        const encodedPayload = String(match[3] || '');
        const isBase64 = Boolean(match[2]);

        try {
            if (!isBase64) {
                const decoded = decodeURIComponent(encodedPayload);
                return {
                    mimeType,
                    bytes: new TextEncoder().encode(decoded)
                };
            }

            const binary = atob(encodedPayload.replace(/\s+/g, ''));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i) & 0xff;
            }
            return { mimeType, bytes };
        } catch (_error) {
            return null;
        }
    },

    _normalizeFileExportPayload(content, mimeType) {
        const defaultMime = String(mimeType || 'application/octet-stream');
        if (typeof content === 'string' && content.startsWith('data:')) {
            const decoded = this._decodeDataUrl(content);
            if (decoded?.bytes) {
                return {
                    data: decoded.bytes,
                    mimeType: decoded.mimeType || defaultMime
                };
            }
        }

        if (content instanceof ArrayBuffer) {
            return {
                data: new Uint8Array(content),
                mimeType: defaultMime
            };
        }

        if (ArrayBuffer.isView(content)) {
            return {
                data: new Uint8Array(content.buffer, content.byteOffset, content.byteLength),
                mimeType: defaultMime
            };
        }

        if (typeof content === 'string') {
            return {
                data: content,
                mimeType: defaultMime
            };
        }

        return {
            data: JSON.stringify(content),
            mimeType: 'application/json'
        };
    },

    async _inflateGzipBytes(bytes) {
        if (typeof DecompressionStream !== 'function') {
            throw new Error('Compressed backup import is not supported in this browser');
        }

        const source = new Blob([bytes]).stream();
        const inflatedStream = source.pipeThrough(new DecompressionStream('gzip'));
        const buffer = await new Response(inflatedStream).arrayBuffer();
        return new Uint8Array(buffer);
    },

    async _decodeBackupFile(file) {
        if (typeof file?.arrayBuffer === 'function') {
            const bytes = new Uint8Array(await file.arrayBuffer());
            return new TextDecoder().decode(bytes);
        }

        if (typeof file?.text === 'function') {
            return String(await file.text());
        }

        throw new Error('Unsupported backup file input');
    },

    _isSecureExportEnvelope(data) {
        return !!(
            data
            && typeof data === 'object'
            && data.type === EPHEMERA_SECURE_EXPORT_TYPE
            && Number(data.version || 0) === EPHEMERA_SECURE_EXPORT_VERSION
            && data.payload
            && typeof data.payload === 'object'
        );
    },

    async _promptForPassphrase(options = {}) {
        const title = String(options.title || 'Secure Export');
        const message = String(options.message || 'Enter a passphrase.');
        const confirm = options.confirm === true;
        const minLength = Number.isFinite(Number(options.minLength))
            ? Number(options.minLength)
            : EPHEMERA_SECURE_EXPORT_MIN_PASSPHRASE_LEN;

        const Dialog = window.EphemeraDialog;
        if (!Dialog?.show) {
            throw new Error('Dialog system not available');
        }

        const passphrase = await Dialog.show({
            title,
            message,
            icon: 'info',
            input: { type: 'password', placeholder: `Passphrase (min ${minLength} chars)`, value: '' },
            buttons: [
                { label: 'Cancel', value: false },
                { label: 'Continue', primary: true, value: true }
            ]
        });

        if (passphrase === false) {
            return false;
        }

        const normalized = String(passphrase || '');
        if (normalized.length < minLength) {
            window.EphemeraNotifications?.error?.('Passphrase Too Short', `Passphrase must be at least ${minLength} characters.`);
            return false;
        }

        if (!confirm) {
            return normalized;
        }

        const confirmation = await Dialog.show({
            title: 'Confirm Passphrase',
            message: 'Re-enter the passphrase to confirm.',
            icon: 'info',
            input: { type: 'password', placeholder: 'Passphrase', value: '' },
            buttons: [
                { label: 'Cancel', value: false },
                { label: 'Confirm', primary: true, value: true }
            ]
        });

        if (confirmation === false) {
            return false;
        }

        if (String(confirmation || '') !== normalized) {
            window.EphemeraNotifications?.error?.('Passphrases Do Not Match', 'Please try again.');
            return false;
        }

        return normalized;
    },

    async _decryptSecureExportEnvelope(envelope, options = {}) {
        if (!this._isSecureExportEnvelope(envelope)) {
            throw new Error('Invalid secure export envelope');
        }

        const expectedKind = options.expectedKind ? String(options.expectedKind) : '';
        const kind = String(envelope.kind || '');
        if (expectedKind && kind && kind !== expectedKind) {
            throw new Error(`Invalid secure export kind (expected ${expectedKind}, got ${kind})`);
        }

        const crypto = window.EphemeraCrypto;
        if (!crypto?.decryptBytesWithPassword) {
            throw new Error('Secure import requires cryptography support');
        }

        const passphrase = options.passphrase || await this._promptForPassphrase({
            title: 'Decrypt Export',
            message: 'Enter the passphrase used to encrypt this export.',
            confirm: false
        });

        if (!passphrase) {
            return { cancelled: true };
        }

        const decrypted = await crypto.decryptBytesWithPassword(envelope.payload, passphrase);
        if (!decrypted || decrypted.byteLength === 0) {
            throw new Error('Unable to decrypt export. Check the passphrase and try again.');
        }

        const innerExtension = String(envelope.inner?.extension || '');
        const shouldInflate = envelope.inner?.compressed === true || innerExtension.endsWith('gz');
        const innerBytes = shouldInflate ? await this._inflateGzipBytes(decrypted) : decrypted;
        const jsonText = new TextDecoder().decode(innerBytes);
        return JSON.parse(String(jsonText || '').replace(/^\uFEFF/, ''));
    },

    async _serializeBackup(data) {
        if (window.EphemeraExportWorker?.serializeExport) {
            try {
                const workerResult = await window.EphemeraExportWorker.serializeExport(data, { compress: true });
                const bytes = this._toUint8Array(workerResult?.bytes);
                if (bytes.byteLength > 0) {
                    return {
                        bytes,
                        mimeType: String(workerResult?.mimeType || 'application/json'),
                        extension: String(workerResult?.extension || 'json.gz').replace(/^\.+/, ''),
                        compressed: workerResult?.compressed === true
                    };
                }
            } catch (_error) {
                // Worker failures should not block backup export.
            }
        }

        const jsonStr = JSON.stringify(data, null, 2);
        return {
            bytes: new TextEncoder().encode(jsonStr),
            mimeType: 'application/json',
            extension: 'json',
            compressed: false
        };
    },

    _getHomeDir() {
        return window.EphemeraFS?.homeDir || window.EphemeraState?.user?.homeDir || '/home/user';
    },

    _isTrashPath(path) {
        return /(^|\/)\.trash(\/|$)/.test(String(path || ''));
    },

    async exportAll(options = {}) {
        const data = {
            version: '2.0.0',
            exportedAt: new Date().toISOString(),
            user: null,
            files: [],
            fileVersions: [],
            apps: [],
            settings: {},
            metadata: {}
        };

        try {
            const crypto = window.EphemeraCrypto;
            if (!crypto?.encryptBytesWithPassword) {
                throw new Error('Secure export requires cryptography support');
            }

            const passphrase = options.passphrase || await this._promptForPassphrase({
                title: 'Encrypt Backup',
                message: `Set a passphrase to encrypt this backup export. You'll need it to restore the backup.\nMinimum ${EPHEMERA_SECURE_EXPORT_MIN_PASSPHRASE_LEN} characters.`,
                confirm: true
            });
            if (!passphrase) {
                return { success: false, cancelled: true };
            }

            if (window.EphemeraSession && window.EphemeraSession.getUser()) {
                data.user = {
                    name: window.EphemeraSession.getUser().name,
                    provider: window.EphemeraSession.getUser().provider
                };
            }

            if (window.EphemeraStorage) {
                data.files = await window.EphemeraStorage.getAll('files') || [];
                data.fileVersions = await window.EphemeraStorage.getAll('fileVersions') || [];
                data.apps = await window.EphemeraStorage.getAll('apps') || [];
                
                const metadataKeys = [
                    'terminal_history',
                    'autosave:code',
                    'oauth_tokens'
                ];
                
                for (const key of metadataKeys) {
                    const value = await window.EphemeraStorage.get('metadata', key);
                    if (value) {
                        data.metadata[key] = value;
                    }
                }
            }

            if (window.EphemeraState) {
                data.settings = {
                    theme: window.EphemeraState.settings.theme,
                    accentColor: window.EphemeraState.settings.accentColor,
                    wallpaper: window.EphemeraState.wallpaper,
                    notifications: window.EphemeraState.settings.notifications,
                    sounds: window.EphemeraState.settings.sounds,
                    proxyEnabled: window.EphemeraState.settings.proxyEnabled,
                    proxyUrl: window.EphemeraState.settings.proxyUrl,
                    aiProvider: window.EphemeraState.settings.aiProvider,
                    aiModel: window.EphemeraState.settings.aiModel,
                    aiModelChat: window.EphemeraState.settings.aiModelChat,
                    aiModelCode: window.EphemeraState.settings.aiModelCode,
                    aiModelTerminal: window.EphemeraState.settings.aiModelTerminal,
                    aiModelQuickActions: window.EphemeraState.settings.aiModelQuickActions,
                    aiModelAppBuilder: window.EphemeraState.settings.aiModelAppBuilder,
                    aiModelFileSearch: window.EphemeraState.settings.aiModelFileSearch,
                    aiMaxTokens: window.EphemeraState.settings.aiMaxTokens,
                    aiTemperature: window.EphemeraState.settings.aiTemperature,
                    fileHistoryMode: window.EphemeraState.settings.fileHistoryMode,
                    fileHistoryMaxVersions: window.EphemeraState.settings.fileHistoryMaxVersions,
                    fileHistoryWarnMb: window.EphemeraState.settings.fileHistoryWarnMb
                };
            }

            const profiles = JSON.parse(localStorage.getItem('ephemeraProfiles') || '[]');
            data.profiles = profiles.map(p => ({
                name: p.name,
                createdAt: p.createdAt
            }));

            const serialized = await this._serializeBackup(data);
            const encryptedPayload = await crypto.encryptBytesWithPassword(serialized.bytes, passphrase);
            const envelope = {
                type: EPHEMERA_SECURE_EXPORT_TYPE,
                version: EPHEMERA_SECURE_EXPORT_VERSION,
                kind: 'backup',
                exportedAt: new Date().toISOString(),
                inner: {
                    compressed: serialized.compressed === true,
                    mimeType: serialized.mimeType,
                    extension: serialized.extension
                },
                payload: encryptedPayload
            };

            const blob = new Blob([JSON.stringify(envelope)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const timestamp = this._backupDateStamp();
            const filename = `ephemera-backup-${timestamp}.ephx`;

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (window.EphemeraNotifications) {
                const exportSummary = serialized.compressed ? `${filename} (encrypted, compressed)` : `${filename} (encrypted)`;
                window.EphemeraNotifications.success('Export Complete', `Downloaded ${exportSummary}`);
            }

            if (window.EphemeraTelemetry) {
                window.EphemeraTelemetry.addBreadcrumb({
                    category: 'data',
                    message: 'Data export completed',
                    level: 'info'
                });
            }

            return {
                success: true,
                filename,
                size: blob.size,
                encrypted: true,
                compressed: serialized.compressed === true
            };
        } catch (e) {
            console.error('[EphemeraDataManagement] Export failed:', e);
            
            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.error('Export Failed', e.message);
            }
            
            return { success: false, error: e.message };
        }
    },

    async importBackup(file, options = {}) {
        if (!file) {
            return { success: false, error: 'No file provided' };
        }

        try {
            const text = await this._decodeBackupFile(file);
            const envelope = JSON.parse(String(text || '').replace(/^\uFEFF/, ''));
            if (!this._isSecureExportEnvelope(envelope)) {
                throw new Error('Unsupported backup file format. Expected an encrypted Ephemera export (.ephx).');
            }

            const data = await this._decryptSecureExportEnvelope(envelope, { expectedKind: 'backup', passphrase: options.passphrase });
            if (data?.cancelled) {
                return { success: false, cancelled: true };
            }

            if (!data.version || !data.exportedAt) {
                throw new Error('Invalid backup file format');
            }

            if (data.files && Array.isArray(data.files)) {
                for (const fileData of data.files) {
                    if (fileData.path && !this._isTrashPath(fileData.path)) {
                        await window.EphemeraStorage.put('files', fileData);
                    }
                }
            }

            if (data.fileVersions && Array.isArray(data.fileVersions)) {
                for (const versionData of data.fileVersions) {
                    if (versionData?.id && versionData?.path) {
                        await window.EphemeraStorage.put('fileVersions', versionData);
                    }
                }
            }

            if (data.apps && Array.isArray(data.apps)) {
                for (const appData of data.apps) {
                    if (appData.id && appData.manifest && appData.code) {
                        await window.EphemeraStorage.put('apps', appData);
                    }
                }
            }

            if (data.settings && window.EphemeraState) {
                const sensitiveKeys = new Set(['openrouterApiKey', 'openaiApiKey', 'anthropicApiKey', 'googleApiKey']);
                Object.entries(data.settings).forEach(([key, value]) => {
                    if (!sensitiveKeys.has(key)) {
                        window.EphemeraState.updateSetting(key, value);
                    }
                });
            }

            if (data.metadata) {
                for (const [key, value] of Object.entries(data.metadata)) {
                    const payload = (value && typeof value === 'object') ? value : { value };
                    await window.EphemeraStorage.put('metadata', { ...payload, key });
                }
            }

            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.success('Import Complete', 'Your data has been restored. Refreshing...');
            }

            if (window.EphemeraTelemetry) {
                window.EphemeraTelemetry.addBreadcrumb({
                    category: 'data',
                    message: 'Data import completed',
                    level: 'info'
                });
            }

            setTimeout(() => window.location.reload(), 2000);

            return { success: true };
        } catch (e) {
            console.error('[EphemeraDataManagement] Import failed:', e);
            
            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.error('Import Failed', e.message);
            }
            
            return { success: false, error: e.message };
        }
    },

    async deleteAccount() {
        if (!window.EphemeraDialog) {
            return { success: false, error: 'Dialog system not available' };
        }

        const confirmed = await window.EphemeraDialog.confirm(
            'This will permanently delete all your data including files, apps, and settings. This action cannot be undone.',
            'Delete Account',
            true
        );

        if (!confirmed) {
            return { success: false, cancelled: true };
        }

        const doubleConfirm = await window.EphemeraDialog.prompt(
            'Type "DELETE" to confirm account deletion',
            '',
            'Confirm Deletion',
            'Type DELETE'
        );

        if (doubleConfirm !== 'DELETE') {
            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.info('Cancelled', 'Account deletion was cancelled');
            }
            return { success: false, cancelled: true };
        }

        try {
            await this._wipeAllData();

            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.success('Account Deleted', 'All data has been removed. Redirecting...');
            }

            if (window.EphemeraTelemetry) {
                window.EphemeraTelemetry.captureMessage('Account deleted', 'info');
            }

            setTimeout(() => window.location.reload(), 2000);

            return { success: true };
        } catch (e) {
            console.error('[EphemeraDataManagement] Delete failed:', e);
            
            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.error('Delete Failed', e.message);
            }
            
            return { success: false, error: e.message };
        }
    },

    async _wipeAllData() {
        if (window.indexedDB) {
            const databases = await indexedDB.databases();
            for (const db of databases) {
                if (db.name && db.name.startsWith('Ephemera')) {
                    indexedDB.deleteDatabase(db.name);
                }
            }
        }

        localStorage.clear();
        sessionStorage.clear();

        if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (const name of cacheNames) {
                await caches.delete(name);
            }
        }

        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
    },

    async getStorageStats() {
        const stats = {
            files: { count: 0, size: 0 },
            fileVersions: { count: 0, size: 0 },
            apps: { count: 0, size: 0 },
            metadata: { count: 0, size: 0 },
            total: 0
        };
        const estimateSize = (content) => {
            if (typeof content === 'string') return content.length;
            if (content instanceof ArrayBuffer) return content.byteLength;
            if (ArrayBuffer.isView(content)) return content.byteLength;
            if (content && typeof content === 'object') {
                try {
                    return JSON.stringify(content).length;
                } catch (_error) {
                    void _error;
                }
            }
            return 0;
        };

        try {
            if (window.EphemeraStorage) {
                const files = await window.EphemeraStorage.getAll('files') || [];
                stats.files.count = files.length;
                stats.files.size = files.reduce((sum, f) => sum + (f.size || 0), 0);

                const versions = await window.EphemeraStorage.getAll('fileVersions') || [];
                stats.fileVersions.count = versions.length;
                stats.fileVersions.size = versions.reduce(
                    (sum, v) => sum + (Number.isFinite(v.size) ? v.size : estimateSize(v.content)),
                    0
                );

                const apps = await window.EphemeraStorage.getAll('apps') || [];
                stats.apps.count = apps.length;
                stats.apps.size = apps.reduce((sum, a) => sum + JSON.stringify(a).length, 0);
            }

            stats.total = stats.files.size + stats.fileVersions.size + stats.apps.size + stats.metadata.size;
        } catch (e) {
            console.error('[EphemeraDataManagement] Failed to get storage stats:', e);
        }

        return stats;
    },

    async clearTrash() {
        try {
            if (window.EphemeraFS) {
                await window.EphemeraFS.emptyTrash();
            }

            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.success('Trash Emptied', 'All trashed items have been permanently deleted');
            }

            return { success: true };
        } catch (e) {
            console.error('[EphemeraDataManagement] Failed to clear trash:', e);
            return { success: false, error: e.message };
        }
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // ===== File System Access API =====

    /**
     * Check if File System Access API is supported
     * @returns {boolean}
     */
    isFileSystemAccessSupported() {
        return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
    },

    /**
     * Save a virtual file to the real filesystem using File System Access API
     * @param {string} path - Virtual file path
     * @param {object} options - Optional picker options
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async saveToDisk(path, options = {}) {
        if (!this.isFileSystemAccessSupported()) {
            // Fallback to download attribute
            return this._legacySaveToDisk(path);
        }

        try {
            const file = await window.EphemeraFS.stat(path);
            const content = await window.EphemeraFS.readFile(path);
            if (content === null) {
                return { success: false, error: 'File not found' };
            }

            const filename = path.split('/').pop();
            const extension = filename.includes('.')
                ? filename.split('.').pop().toLowerCase()
                : '';
            const fileMime = file?.mimeType || window.EphemeraFS.getMimeType(path) || 'application/octet-stream';
            const payload = this._normalizeFileExportPayload(content, fileMime);

            // Determine MIME type and file type filter
            const typeMap = {
                'txt': { mime: 'text/plain', desc: 'Text files', accept: { 'text/plain': ['.txt'] } },
                'md': { mime: 'text/markdown', desc: 'Markdown files', accept: { 'text/markdown': ['.md'] } },
                'json': { mime: 'application/json', desc: 'JSON files', accept: { 'application/json': ['.json'] } },
                'js': { mime: 'text/javascript', desc: 'JavaScript files', accept: { 'text/javascript': ['.js'] } },
                'html': { mime: 'text/html', desc: 'HTML files', accept: { 'text/html': ['.html', '.htm'] } },
                'css': { mime: 'text/css', desc: 'CSS files', accept: { 'text/css': ['.css'] } },
                'svg': { mime: 'image/svg+xml', desc: 'SVG files', accept: { 'image/svg+xml': ['.svg'] } },
                'xml': { mime: 'application/xml', desc: 'XML files', accept: { 'application/xml': ['.xml'] } },
                'png': { mime: 'image/png', desc: 'PNG images', accept: { 'image/png': ['.png'] } },
                'jpg': { mime: 'image/jpeg', desc: 'JPEG images', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } },
                'jpeg': { mime: 'image/jpeg', desc: 'JPEG images', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } },
                'gif': { mime: 'image/gif', desc: 'GIF images', accept: { 'image/gif': ['.gif'] } },
                'webp': { mime: 'image/webp', desc: 'WebP images', accept: { 'image/webp': ['.webp'] } },
                'pdf': { mime: 'application/pdf', desc: 'PDF files', accept: { 'application/pdf': ['.pdf'] } }
            };

            const fallbackAccept = extension
                ? { [payload.mimeType]: [`.${extension}`] }
                : { [payload.mimeType || 'application/octet-stream']: ['.bin'] };
            const typeInfo = typeMap[extension] || {
                mime: payload.mimeType,
                desc: 'All files',
                accept: fallbackAccept
            };

            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: typeInfo.desc,
                    accept: typeInfo.accept
                }],
                ...options
            });

            const writable = await handle.createWritable();
            await writable.write(payload.data);
            await writable.close();

            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.success('Saved', `${filename} saved to disk`);
            }

            return { success: true, handle };
        } catch (e) {
            if (e.name === 'AbortError') {
                return { success: false, cancelled: true };
            }
            console.error('[EphemeraDataManagement] Save to disk failed:', e);
            return { success: false, error: e.message };
        }
    },

    /**
     * Fallback download method for browsers without File System Access API
     */
    async _legacySaveToDisk(path) {
        try {
            const file = await window.EphemeraFS.stat(path);
            const content = await window.EphemeraFS.readFile(path);
            if (content === null) {
                return { success: false, error: 'File not found' };
            }

            const filename = path.split('/').pop();
            const fileMime = file?.mimeType || window.EphemeraFS.getMimeType(path) || 'application/octet-stream';
            const payload = this._normalizeFileExportPayload(content, fileMime);
            let blobPayload = payload.data;
            if (blobPayload instanceof Uint8Array) {
                blobPayload = blobPayload.buffer.slice(
                    blobPayload.byteOffset,
                    blobPayload.byteOffset + blobPayload.byteLength
                );
            } else if (ArrayBuffer.isView(blobPayload)) {
                blobPayload = blobPayload.buffer.slice(
                    blobPayload.byteOffset,
                    blobPayload.byteOffset + blobPayload.byteLength
                );
            }
            const blob = new Blob([blobPayload], { type: payload.mimeType });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    /**
     * Open a file from the real filesystem and save it to the virtual FS
     * @param {string} destPath - Destination path in virtual FS
     * @param {object} options - Optional picker options
     * @returns {Promise<{success: boolean, content?: string, error?: string}>}
     */
    async openFromDisk(destPath = null, options = {}) {
        if (!this.isFileSystemAccessSupported()) {
            // Fallback to file input
            return this._legacyOpenFromDisk(destPath);
        }

        try {
            const [handle] = await window.showOpenFilePicker({
                multiple: false,
                types: [{
                    description: 'Text files',
                    accept: {
                        'text/*': ['.txt', '.md', '.json', '.js', '.html', '.css', '.xml', '.svg', '.yaml', '.yml'],
                        'application/json': ['.json']
                    }
                }],
                ...options
            });

            const file = await handle.getFile();
            const content = await file.text();

            // Determine destination path
            const targetPath = destPath || `${this._getHomeDir()}/${file.name}`;

            // Save to virtual filesystem
            await window.EphemeraFS.writeFile(targetPath, content);

            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.success('Imported', `${file.name} imported to ${targetPath}`);
            }

            // Emit event for file tree refresh
            if (window.EphemeraEvents) {
                window.EphemeraEvents.emit('fs:changed', { path: targetPath, action: 'write' });
            }

            return { success: true, path: targetPath, content, name: file.name };
        } catch (e) {
            if (e.name === 'AbortError') {
                return { success: false, cancelled: true };
            }
            console.error('[EphemeraDataManagement] Open from disk failed:', e);
            return { success: false, error: e.message };
        }
    },

    /**
     * Fallback file input method for browsers without File System Access API
     */
    _legacyOpenFromDisk(destPath = null) {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt,.md,.json,.js,.html,.css,.xml,.svg,.yaml,.yml';

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    resolve({ success: false, cancelled: true });
                    return;
                }

                try {
                    const content = await file.text();
                    const targetPath = destPath || `${this._getHomeDir()}/${file.name}`;

                    await window.EphemeraFS.writeFile(targetPath, content);

                    if (window.EphemeraNotifications) {
                        window.EphemeraNotifications.success('Imported', `${file.name} imported to ${targetPath}`);
                    }

                    if (window.EphemeraEvents) {
                        window.EphemeraEvents.emit('fs:changed', { path: targetPath, action: 'write' });
                    }

                    resolve({ success: true, path: targetPath, content, name: file.name });
                } catch (err) {
                    resolve({ success: false, error: err.message });
                }
            };

            input.click();
        });
    },

    // ===== Profile Backup / Restore =====

    _rewriteHomePath(record, sourceHomeDir, targetHomeDir) {
        if (!record || !sourceHomeDir || !targetHomeDir) return record;
        const rewritten = { ...record };
        if (typeof rewritten.path === 'string' && rewritten.path.startsWith(sourceHomeDir)) {
            rewritten.path = targetHomeDir + rewritten.path.slice(sourceHomeDir.length);
        }
        if (typeof rewritten.parentDir === 'string' && rewritten.parentDir.startsWith(sourceHomeDir)) {
            rewritten.parentDir = targetHomeDir + rewritten.parentDir.slice(sourceHomeDir.length);
        }
        return rewritten;
    },

    async exportProfile(options = {}) {
        try {
            const Login = window.EphemeraLogin;
            const profile = Login?.getCurrentProfile?.();
            if (!profile) {
                throw new Error('No active profile found');
            }

            const crypto = window.EphemeraCrypto;
            if (!crypto?.encryptBytesWithPassword) {
                throw new Error('Secure export requires cryptography support');
            }

            const passphrase = options.passphrase || await this._promptForPassphrase({
                title: 'Encrypt Profile Export',
                message: `Set a passphrase to encrypt this profile export. You'll need it to import the profile on another machine.\nMinimum ${EPHEMERA_SECURE_EXPORT_MIN_PASSPHRASE_LEN} characters.`,
                confirm: true
            });
            if (!passphrase) {
                return { success: false, cancelled: true };
            }

            const SENSITIVE_SETTINGS = new Set([
                'openrouterApiKey', 'openaiApiKey', 'anthropicApiKey', 'googleApiKey',
                'syncRestToken', 'syncRestUrl', 'syncProvider'
            ]);
            const SENSITIVE_METADATA = new Set([
                'openrouterApiKey', 'openaiApiKey', 'anthropicApiKey', 'googleApiKey',
                'oauth_tokens', 'syncRestToken'
            ]);

            const allFiles = (await window.EphemeraStorage.getAll('files')) || [];
            const files = allFiles.filter(f => f.path && !this._isTrashPath(f.path));
            const fileVersions = (await window.EphemeraStorage.getAll('fileVersions')) || [];
            const apps = (await window.EphemeraStorage.getAll('apps')) || [];

            const settings = {};
            if (window.EphemeraState?.settings) {
                for (const [key, value] of Object.entries(window.EphemeraState.settings)) {
                    if (!SENSITIVE_SETTINGS.has(key)) {
                        settings[key] = value;
                    }
                }
            }

            const metadata = {};
            const metaKeys = ['terminal_history', 'autosave:code'];
            for (const key of metaKeys) {
                if (SENSITIVE_METADATA.has(key)) continue;
                const record = await window.EphemeraStorage.get('metadata', key);
                if (record) metadata[key] = record;
            }

            const data = {
                version: '2.0.0',
                type: 'profile-backup',
                exportedAt: new Date().toISOString(),
                profile: {
                    name: profile.name,
                    avatar: profile.avatar || null,
                    createdAt: profile.createdAt || null,
                    homeDir: profile.homeDir || null
                },
                files,
                fileVersions,
                apps,
                settings,
                metadata
            };

            const serialized = await this._serializeBackup(data);
            const encryptedPayload = await crypto.encryptBytesWithPassword(serialized.bytes, passphrase);
            const envelope = {
                type: EPHEMERA_SECURE_EXPORT_TYPE,
                version: EPHEMERA_SECURE_EXPORT_VERSION,
                kind: 'profile-backup',
                exportedAt: new Date().toISOString(),
                inner: {
                    compressed: serialized.compressed === true,
                    mimeType: serialized.mimeType,
                    extension: serialized.extension
                },
                payload: encryptedPayload
            };

            const blob = new Blob([JSON.stringify(envelope)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const safeName = String(profile.name || 'profile').replace(/[^a-zA-Z0-9_-]/g, '_');
            const timestamp = this._backupDateStamp();
            const filename = `ephemera-profile-${safeName}-${timestamp}.ephx`;

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (window.EphemeraNotifications) {
                const exportSummary = serialized.compressed ? `${filename} (encrypted, compressed)` : `${filename} (encrypted)`;
                window.EphemeraNotifications.success('Profile Export Complete', `Downloaded ${exportSummary}`);
            }

            return {
                success: true,
                filename,
                size: blob.size,
                encrypted: true,
                compressed: serialized.compressed === true
            };
        } catch (e) {
            console.error('[EphemeraDataManagement] Profile export failed:', e);
            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.error('Profile Export Failed', e.message);
            }
            return { success: false, error: e.message };
        }
    },

    async importProfile(file, options = {}) {
        if (!file) return { success: false, error: 'No file provided' };

        try {
            const text = await this._decodeBackupFile(file);
            const envelope = JSON.parse(String(text || '').replace(/^\uFEFF/, ''));
            if (!this._isSecureExportEnvelope(envelope)) {
                throw new Error('Unsupported profile export format. Expected an encrypted Ephemera profile export (.ephx).');
            }

            const data = await this._decryptSecureExportEnvelope(envelope, { expectedKind: 'profile-backup', passphrase: options.passphrase });
            if (data?.cancelled) {
                return { success: false, cancelled: true };
            }

            if (data.type !== 'profile-backup' || !data.profile?.name) {
                throw new Error('Invalid profile backup file. Expected type "profile-backup" with a profile name.');
            }

            const Dialog = window.EphemeraDialog;
            const Login = window.EphemeraLogin;
            if (!Dialog || !Login) {
                throw new Error('Dialog or Login system unavailable');
            }

            // Prompt for new profile name
            const newName = await Dialog.prompt(
                'Choose a name for the imported profile:',
                `${data.profile.name} (imported)`,
                'Import Profile',
                'Profile name'
            );
            if (newName === false || !String(newName || '').trim()) {
                return { success: false, cancelled: true };
            }

            // Prompt for password
            const password = await Dialog.show({
                title: 'Set Password',
                message: 'Choose a password for the imported profile (min 12 characters):',
                icon: 'info',
                input: { type: 'password', placeholder: 'Password (min 12 chars)', value: '' },
                buttons: [
                    { label: 'Cancel', value: false },
                    { label: 'Create', primary: true, value: true }
                ]
            });
            if (password === false || !password || String(password).length < 12) {
                if (password !== false) {
                    window.EphemeraNotifications?.error('Import Cancelled', 'Password must be at least 12 characters.');
                }
                return { success: false, cancelled: true };
            }

            // Create profile
            const passwordStr = String(password);
            const avatar = data.profile.avatar || undefined;
            const profile = await Login.createProfile(String(newName).trim(), passwordStr, avatar);

            const crypto = window.EphemeraCrypto;
            if (!crypto?.deriveKey) {
                throw new Error('Cryptography support unavailable');
            }
            const salt = profile.hash?.salt;
            if (!salt) {
                throw new Error('Imported profile is missing cryptographic salt');
            }
            const encryptionKey = await crypto.deriveKey(passwordStr, salt);

            const Storage = window.EphemeraStorage;
            if (!Storage?.setActiveProfile || !Storage.putEncrypted) {
                throw new Error('Storage system unavailable');
            }

            // Switch to the new profile's storage
            await Storage.setActiveProfile(profile.id);

            const sourceHomeDir = data.profile.homeDir || `/home/${data.profile.name}`;
            const targetHomeDir = profile.homeDir || `/home/${profile.id}`;

            // Import files
            if (Array.isArray(data.files)) {
                for (const fileData of data.files) {
                    if (!fileData.path || this._isTrashPath(fileData.path)) continue;
                    const rewritten = this._rewriteHomePath(fileData, sourceHomeDir, targetHomeDir);
                    await Storage.putEncrypted('files', rewritten, encryptionKey);
                }
            }

            // Import file versions
            if (Array.isArray(data.fileVersions)) {
                for (const ver of data.fileVersions) {
                    if (!ver?.id || !ver?.path) continue;
                    const rewritten = this._rewriteHomePath(ver, sourceHomeDir, targetHomeDir);
                    await Storage.putEncrypted('fileVersions', rewritten, encryptionKey);
                }
            }

            // Import apps
            if (Array.isArray(data.apps)) {
                for (const appData of data.apps) {
                    if (appData?.id && appData?.manifest && appData?.code) {
                        await Storage.putEncrypted('apps', appData, encryptionKey);
                    }
                }
            }

            // Import settings (skip API keys and sync config)
            const SKIP_SETTINGS = new Set([
                'openrouterApiKey', 'openaiApiKey', 'anthropicApiKey', 'googleApiKey',
                'syncProvider', 'syncRestUrl', 'syncRestToken', 'syncAutoEnabled'
            ]);
            if (data.settings && window.EphemeraState) {
                for (const [key, value] of Object.entries(data.settings)) {
                    if (!SKIP_SETTINGS.has(key)) {
                        window.EphemeraState.updateSetting(key, value);
                    }
                }
            }

            // Import non-sensitive metadata
            const SENSITIVE_META = new Set([
                'openrouterApiKey', 'openaiApiKey', 'anthropicApiKey', 'googleApiKey',
                'oauth_tokens', 'syncRestToken'
            ]);
            if (data.metadata) {
                for (const [key, value] of Object.entries(data.metadata)) {
                    if (SENSITIVE_META.has(key)) continue;
                    const payload = (value && typeof value === 'object') ? value : { value };
                    const record = { ...payload, key };
                    if (Storage.shouldEncrypt?.('metadata', key)) {
                        await Storage.putEncrypted('metadata', record, encryptionKey);
                    } else {
                        await Storage.put('metadata', record);
                    }
                }
            }

            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.success('Profile Imported', `Profile "${String(newName).trim()}" created. Reloading...`);
            }

            if (options.reload !== false) {
                setTimeout(() => window.location.reload(), 2000);
            }
            return { success: true };
        } catch (e) {
            console.error('[EphemeraDataManagement] Profile import failed:', e);
            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.error('Profile Import Failed', e.message);
            }
            return { success: false, error: e.message };
        }
    },

    /**
     * Export multiple files to a directory using File System Access API
     * @param {string[]} paths - Array of virtual file paths
     * @returns {Promise<{success: boolean, exported?: number, error?: string}>}
     */
    async exportToDirectory(paths) {
        if (!this.isFileSystemAccessSupported() || !('showDirectoryPicker' in window)) {
            return { success: false, error: 'Directory export not supported in this browser' };
        }

        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            let exported = 0;

            for (const path of paths) {
                const content = await window.EphemeraFS.readFile(path);
                if (content === null) continue;

                const filename = path.split('/').pop();
                const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
                exported++;
            }

            if (window.EphemeraNotifications) {
                window.EphemeraNotifications.success('Export Complete', `Exported ${exported} files`);
            }

            return { success: true, exported };
        } catch (e) {
            if (e.name === 'AbortError') {
                return { success: false, cancelled: true };
            }
            console.error('[EphemeraDataManagement] Export to directory failed:', e);
            return { success: false, error: e.message };
        }
    }
};

window.EphemeraDataManagement = EphemeraDataManagement;
export default EphemeraDataManagement;
