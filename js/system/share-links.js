const EphemeraShareLinks = {
    VERSION: 1,

    isTextLikeMimeType(mimeType) {
        if (!mimeType) return false;
        const mime = String(mimeType).toLowerCase();
        return mime.startsWith('text/')
            || mime.includes('json')
            || mime.includes('xml')
            || mime.includes('javascript')
            || mime.includes('svg')
            || mime.includes('yaml')
            || mime.includes('x-www-form-urlencoded');
    },

    sanitizeFileName(name) {
        const raw = typeof name === 'string' ? name : 'shared-item';
        const cleaned = raw
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
            .replace(/\s+/g, ' ')
            .trim();
        return cleaned || 'shared-item';
    },

    sanitizeRelativePath(path) {
        if (typeof path !== 'string') return '';

        const segments = path
            .replace(/\\/g, '/')
            .split('/')
            .filter(Boolean);

        const safe = [];
        for (const segment of segments) {
            if (segment === '.' || segment === '..') continue;
            safe.push(this.sanitizeFileName(segment));
        }

        return safe.join('/');
    },

    toBase64Url(base64) {
        return String(base64)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
    },

    fromBase64Url(base64Url) {
        const raw = String(base64Url || '').replace(/-/g, '+').replace(/_/g, '/');
        const pad = (4 - raw.length % 4) % 4;
        return raw + '='.repeat(pad);
    },

    _bytesToBase64(bytesLike) {
        const bytes = bytesLike instanceof Uint8Array
            ? bytesLike
            : new Uint8Array(bytesLike);

        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
        }
        return btoa(binary);
    },

    _base64ToBytes(base64) {
        const binary = atob(String(base64 || ''));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    },

    _utf8ToBase64(str) {
        return this._bytesToBase64(new TextEncoder().encode(String(str)));
    },

    _base64ToUtf8(base64) {
        return new TextDecoder().decode(this._base64ToBytes(base64));
    },

    encodePayload(payload) {
        const json = JSON.stringify(payload);
        const base64 = this._utf8ToBase64(json);
        return this.toBase64Url(base64);
    },

    decodePayload(token) {
        if (!token || typeof token !== 'string') {
            throw new Error('Share token is missing');
        }
        const base64 = this.fromBase64Url(token.trim());
        const json = this._base64ToUtf8(base64);
        return JSON.parse(json);
    },

    payloadSizeBytes(payload) {
        return new TextEncoder().encode(JSON.stringify(payload)).length;
    },

    _toByteArray(content) {
        if (content instanceof ArrayBuffer) {
            return new Uint8Array(content);
        }
        if (ArrayBuffer.isView(content)) {
            return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
        }
        return null;
    },

    encodeContent(content, mimeType = 'text/plain') {
        if (typeof content === 'string') {
            return {
                encoding: 'utf8',
                data: content,
                byteLength: new TextEncoder().encode(content).length,
                mimeType
            };
        }

        if (content == null) {
            return {
                encoding: 'utf8',
                data: '',
                byteLength: 0,
                mimeType
            };
        }

        const bytes = this._toByteArray(content);
        if (bytes) {
            return {
                encoding: 'base64',
                data: this._bytesToBase64(bytes),
                byteLength: bytes.byteLength,
                mimeType
            };
        }

        const fallback = String(content);
        return {
            encoding: 'utf8',
            data: fallback,
            byteLength: new TextEncoder().encode(fallback).length,
            mimeType
        };
    },

    decodeContent(entry) {
        if (!entry || typeof entry !== 'object') return '';
        if (entry.encoding === 'base64') {
            return this._base64ToBytes(entry.data || '').buffer;
        }
        if (typeof entry.data === 'string') {
            return entry.data;
        }
        return String(entry.data ?? '');
    },

    createFilePayload({ name, mimeType, content }) {
        const safeName = this.sanitizeFileName(name || 'shared-file');
        const normalizedMime = mimeType || 'application/octet-stream';
        const encoded = this.encodeContent(content, normalizedMime);

        return {
            v: this.VERSION,
            kind: 'file',
            name: safeName,
            mimeType: normalizedMime,
            encoding: encoded.encoding,
            data: encoded.data,
            size: encoded.byteLength
        };
    },

    createDirectoryPayload({ name, entries = [] }) {
        const safeName = this.sanitizeFileName(name || 'shared-folder');
        const normalizedEntries = entries.map((entry) => {
            const safePath = this.sanitizeRelativePath(entry.path || '');
            const normalizedMime = entry.mimeType || 'application/octet-stream';
            const encoded = this.encodeContent(entry.content, normalizedMime);
            return {
                path: safePath,
                mimeType: normalizedMime,
                encoding: encoded.encoding,
                data: encoded.data,
                size: encoded.byteLength
            };
        }).filter(entry => entry.path);

        return {
            v: this.VERSION,
            kind: 'directory',
            name: safeName,
            entries: normalizedEntries
        };
    },

    normalizePayload(payload) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('Invalid shared payload');
        }

        if (payload.kind === 'file' || payload.kind === 'directory') {
            return payload;
        }

        // Backward-compatibility with early `ephemera-view` links
        if (payload.name && Object.prototype.hasOwnProperty.call(payload, 'content')) {
            return {
                v: 0,
                kind: 'file',
                name: this.sanitizeFileName(payload.name),
                mimeType: 'text/plain',
                encoding: 'utf8',
                data: String(payload.content ?? ''),
                size: new TextEncoder().encode(String(payload.content ?? '')).length
            };
        }

        throw new Error('Unsupported shared payload type');
    }
};

window.EphemeraShareLinks = EphemeraShareLinks;
