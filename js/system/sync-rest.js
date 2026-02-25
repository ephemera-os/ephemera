class EphemeraRestProvider {
    constructor(serverUrl, token) {
        this._baseUrl = String(serverUrl || '').replace(/\/+$/, '');
        this._token = String(token || '');
    }

    _headers(extra = {}) {
        return {
            'Authorization': `Bearer ${this._token}`,
            ...extra
        };
    }

    _encodePath(filePath) {
        return filePath
            .split('/')
            .map(segment => encodeURIComponent(segment))
            .join('/');
    }

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
    }

    async list() {
        const res = await fetch(`${this._baseUrl}/api/files`, {
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`List failed: ${res.status}`);
        const data = await res.json();
        return (data.files || []).map(f => ({
            path: f.path,
            modifiedAt: f.modifiedAt || 0,
            type: f.type || 'file'
        }));
    }

    async push(path, content, metadata = {}) {
        const encoded = this._encodePath(path);
        let body = content;
        if (typeof content === 'string') {
            body = new TextEncoder().encode(content);
        }
        const headers = this._headers({
            'X-Ephemera-ModifiedAt': String(metadata.modifiedAt || Date.now()),
            'X-Ephemera-MimeType': metadata.mimeType || 'application/octet-stream'
        });
        const res = await fetch(`${this._baseUrl}/api/files${encoded}`, {
            method: 'PUT',
            headers,
            body
        });
        if (!res.ok) throw new Error(`Push failed: ${res.status}`);
    }

    async pull(path) {
        const encoded = this._encodePath(path);
        const res = await fetch(`${this._baseUrl}/api/files${encoded}`, {
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`Pull failed: ${res.status}`);

        const mimeType = res.headers.get('X-Ephemera-MimeType') || null;
        const modifiedAt = parseInt(res.headers.get('X-Ephemera-ModifiedAt') || '0', 10);

        let content;
        if (this._isTextMimeType(mimeType)) {
            content = await res.text();
        } else {
            content = await res.arrayBuffer();
        }

        return { content, mimeType, modifiedAt };
    }

    async delete(path) {
        const encoded = this._encodePath(path);
        const res = await fetch(`${this._baseUrl}/api/files${encoded}`, {
            method: 'DELETE',
            headers: this._headers()
        });
        if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`);
    }

    async mkdir(path) {
        const encoded = this._encodePath(path);
        const res = await fetch(`${this._baseUrl}/api/mkdir${encoded}`, {
            method: 'PUT',
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`Mkdir failed: ${res.status}`);
    }

    async testConnection() {
        const res = await fetch(`${this._baseUrl}/api/ping`, {
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`Connection test failed: ${res.status}`);
        const data = await res.json();
        if (!data.ok) throw new Error('Server responded with error');
        return true;
    }
}

window.EphemeraRestProvider = EphemeraRestProvider;
