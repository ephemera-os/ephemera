const EphemeraP2P = {
    CHUNK_SIZE: 64 * 1024,
    MAX_BUFFERED: 512 * 1024,
    MAX_FILE_SIZE: 100 * 1024 * 1024,
    ICE_TIMEOUT_MS: 8000,
    ICE_SERVERS_SETTING_KEY: 'p2pIceServers',
    ICE_SERVERS: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ],

    _sessions: new Map(),
    _nextId: 0,

    _emit(event, payload) {
        window.EphemeraEvents?.emit?.(event, payload);
    },

    _bytesToBase64(bytes) {
        let normalized = bytes;
        if (normalized instanceof ArrayBuffer) {
            normalized = new Uint8Array(normalized);
        } else if (ArrayBuffer.isView(normalized) && !(normalized instanceof Uint8Array)) {
            normalized = new Uint8Array(normalized.buffer, normalized.byteOffset, normalized.byteLength);
        }
        if (!ArrayBuffer.isView(normalized) || typeof normalized.byteLength !== 'number') {
            throw new Error('bytes must be an ArrayBuffer or typed array');
        }

        const view = normalized instanceof Uint8Array
            ? normalized
            : new Uint8Array(normalized.buffer, normalized.byteOffset, normalized.byteLength);

        const chunkSize = 0x8000;
        let binary = '';
        for (let i = 0; i < view.length; i += chunkSize) {
            const chunk = view.subarray(i, i + chunkSize);
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

    _encode(obj) {
        const bytes = new TextEncoder().encode(JSON.stringify(obj));
        return this._bytesToBase64(bytes)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    },

    _decode(str) {
        if (typeof str !== 'string' || !str.trim()) {
            throw new Error('Code is empty');
        }

        try {
            const sanitized = str.trim().replace(/-/g, '+').replace(/_/g, '/');
            const pad = (4 - (sanitized.length % 4)) % 4;
            const bytes = this._base64ToBytes(sanitized + '='.repeat(pad));
            return JSON.parse(new TextDecoder().decode(bytes));
        } catch (_err) {
            throw new Error('Invalid code');
        }
    },

    _newId() {
        return 'p2p-' + (++this._nextId) + '-' + Math.random().toString(36).slice(2, 8);
    },

    _newToken() {
        return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    },

    _normalizeIceServers(servers) {
        if (!servers) return [];

        let parsed = servers;
        if (typeof parsed === 'string') {
            try {
                parsed = JSON.parse(parsed);
            } catch (_err) {
                return [];
            }
        }

        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;

                let urls = entry.urls;
                if (typeof urls === 'string') {
                    urls = urls.trim();
                } else if (Array.isArray(urls)) {
                    urls = urls
                        .filter(url => typeof url === 'string')
                        .map(url => url.trim())
                        .filter(Boolean);
                }

                const hasUrls = typeof urls === 'string'
                    ? urls.length > 0
                    : Array.isArray(urls) && urls.length > 0;

                if (!hasUrls) return null;

                const normalized = { urls };
                if (typeof entry.username === 'string' && entry.username) {
                    normalized.username = entry.username;
                }
                if (typeof entry.credential === 'string' && entry.credential) {
                    normalized.credential = entry.credential;
                }
                return normalized;
            })
            .filter(Boolean);
    },

    getIceServers() {
        const custom = this._normalizeIceServers(
            window.EphemeraState?.settings?.[this.ICE_SERVERS_SETTING_KEY]
        );
        return custom.length > 0 ? custom : this.ICE_SERVERS;
    },

    setIceServers(servers) {
        const normalized = this._normalizeIceServers(servers);
        if (normalized.length === 0) {
            throw new Error('Invalid ICE server configuration');
        }

        if (window.EphemeraState?.updateSetting) {
            window.EphemeraState.updateSetting(this.ICE_SERVERS_SETTING_KEY, normalized);
        } else if (window.EphemeraState?.settings) {
            window.EphemeraState.settings[this.ICE_SERVERS_SETTING_KEY] = normalized;
        }

        return normalized;
    },

    _assertWebRTCSupported() {
        if (typeof RTCPeerConnection === 'undefined') {
            throw new Error('WebRTC is not supported in this browser');
        }
    },

    _normalizeFileMeta(fileMeta = {}) {
        const name = String(fileMeta.name || 'shared-file');
        const size = Number.isFinite(Number(fileMeta.size))
            ? Math.max(0, Number(fileMeta.size))
            : 0;
        const mimeType = String(fileMeta.mimeType || 'application/octet-stream');

        return { name, size, mimeType };
    },

    _createSession(sessionId, role, sessionToken = this._newToken()) {
        this._assertWebRTCSupported();

        const pc = new RTCPeerConnection({ iceServers: this.getIceServers() });
        const session = {
            id: sessionId,
            token: sessionToken,
            role,
            pc,
            dc: null,
            fileMeta: null,
            receiveBuffer: [],
            receivedSize: 0,
            _iceResolve: null,
            _iceComplete: false
        };
        this._sessions.set(sessionId, session);

        pc.onicecandidate = (event) => {
            if (!event.candidate) {
                session._iceComplete = true;
                session._iceResolve?.();
            }
        };

        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            if (state === 'connected') {
                this._emit('p2p:connected', { sessionId });
            } else if (['disconnected', 'failed', 'closed'].includes(state)) {
                this._emit('p2p:disconnected', { sessionId, state });
                this._cleanup(sessionId);
            }
        };

        return session;
    },

    _waitIce(session) {
        if (session._iceComplete) return Promise.resolve();

        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                clearTimeout(timeoutId);
                resolve();
            };

            session._iceResolve = finish;
            const timeoutId = setTimeout(finish, this.ICE_TIMEOUT_MS);
        });
    },

    _wireChannel(session, dataChannel) {
        session.dc = dataChannel;
        dataChannel.binaryType = 'arraybuffer';

        dataChannel.onmessage = (event) => this._onMessage(session, event.data);
        dataChannel.onerror = (event) => {
            this._emit('p2p:error', {
                sessionId: session.id,
                error: String(event)
            });
        };
    },

    _onMessage(session, data) {
        if (typeof data === 'string') {
            let message;
            try {
                message = JSON.parse(data);
            } catch (_err) {
                return;
            }

            if (message.type === 'meta') {
                const fileMeta = this._normalizeFileMeta(message);

                if (fileMeta.size > this.MAX_FILE_SIZE) {
                    this._emit('p2p:error', {
                        sessionId: session.id,
                        error: `Incoming file exceeds limit of ${this.MAX_FILE_SIZE} bytes`
                    });
                    this._cleanup(session.id);
                    return;
                }

                session.fileMeta = fileMeta;
                session.receiveBuffer = [];
                session.receivedSize = 0;

                this._emit('p2p:transfer-start', {
                    sessionId: session.id,
                    name: fileMeta.name,
                    size: fileMeta.size,
                    mimeType: fileMeta.mimeType
                });
                return;
            }

            if (message.type === 'done') {
                if (!session.fileMeta) return;

                const completedMeta = session.fileMeta;
                const blob = new Blob(session.receiveBuffer, {
                    type: completedMeta.mimeType || 'application/octet-stream'
                });

                session.receiveBuffer = [];

                this._emit('p2p:transfer-complete', {
                    sessionId: session.id,
                    name: completedMeta.name,
                    size: completedMeta.size,
                    mimeType: completedMeta.mimeType,
                    blob
                });
                return;
            }

            if (message.type === 'collab') {
                this._emit('p2p:collab-message', {
                    sessionId: session.id,
                    payload: message.payload
                });
            }
            return;
        }

        if (!session.fileMeta) return;

        const chunkSize = data?.byteLength ?? data?.size ?? 0;
        session.receiveBuffer.push(data);
        session.receivedSize += chunkSize;

        const total = session.fileMeta.size;
        const percent = total > 0
            ? Math.min(100, Math.round((session.receivedSize / total) * 100))
            : 100;

        this._emit('p2p:transfer-progress', {
            sessionId: session.id,
            received: session.receivedSize,
            total,
            percent
        });
    },

    _cleanup(sessionId) {
        const session = this._sessions.get(sessionId);
        if (!session) return;

        try {
            session.dc?.close();
        } catch (_err) {
            // Ignore teardown failures.
        }

        try {
            session.pc?.close();
        } catch (_err) {
            // Ignore teardown failures.
        }

        this._sessions.delete(sessionId);
    },

    _isTextLikeMimeType(mimeType) {
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

    async _toArrayBuffer(content, mimeType = '') {
        if (content == null) return new ArrayBuffer(0);
        if (content instanceof ArrayBuffer) return content;
        if (ArrayBuffer.isView(content)) {
            return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
        }
        if (content instanceof Blob) {
            return content.arrayBuffer();
        }
        if (typeof content === 'string') {
            if (content.startsWith('data:')) {
                const decoded = this._decodeDataUrl(content);
                const declaredText = this._isTextLikeMimeType(mimeType);
                const payloadText = this._isTextLikeMimeType(decoded?.mimeType);
                if (decoded?.bytes && !declaredText && !payloadText) {
                    return decoded.bytes.buffer;
                }
            }
            return new TextEncoder().encode(content).buffer;
        }

        return new TextEncoder().encode(String(content)).buffer;
    },

    async createSendOffer(fileMeta) {
        const normalizedMeta = this._normalizeFileMeta(fileMeta);
        if (normalizedMeta.size > this.MAX_FILE_SIZE) {
            throw new Error('File exceeds 100MB transfer limit');
        }

        const sessionId = this._newId();
        const session = this._createSession(sessionId, 'sender');
        session.fileMeta = normalizedMeta;

        const dataChannel = session.pc.createDataChannel('ephemera-p2p', { ordered: true });
        this._wireChannel(session, dataChannel);

        const offer = await session.pc.createOffer();
        await session.pc.setLocalDescription(offer);
        await this._waitIce(session);

        const offerCode = this._encode({
            v: 1,
            type: session.pc.localDescription.type,
            sdp: session.pc.localDescription.sdp,
            token: session.token,
            meta: normalizedMeta
        });

        return {
            sessionId,
            sessionToken: session.token,
            offerCode
        };
    },

    async completeSend(sessionId, answerCode) {
        const session = this._sessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        const decoded = this._decode(answerCode);
        if (!decoded.type || !decoded.sdp) {
            throw new Error('Invalid answer code');
        }

        if (decoded.token && decoded.token !== session.token) {
            throw new Error('Answer code does not match this session');
        }

        await session.pc.setRemoteDescription({
            type: decoded.type,
            sdp: decoded.sdp
        });
    },

    async sendFile(sessionId, content) {
        const session = this._sessions.get(sessionId);
        if (!session?.dc || session.dc.readyState !== 'open') {
            throw new Error('Data channel not open');
        }

        const meta = this._normalizeFileMeta(session.fileMeta || {});
        const buffer = await this._toArrayBuffer(content, meta.mimeType);

        if (buffer.byteLength > this.MAX_FILE_SIZE) {
            throw new Error('File exceeds 100MB transfer limit');
        }

        const total = buffer.byteLength;
        const bytes = new Uint8Array(buffer);

        session.dc.send(JSON.stringify({
            type: 'meta',
            name: meta.name,
            size: total,
            mimeType: meta.mimeType || 'application/octet-stream'
        }));

        let offset = 0;

        await new Promise((resolve, reject) => {
            const tick = () => {
                if (!session.dc || session.dc.readyState !== 'open') {
                    reject(new Error('Data channel closed during transfer'));
                    return;
                }

                if (offset >= total) {
                    session.dc.send(JSON.stringify({ type: 'done' }));
                    resolve();
                    return;
                }

                if (session.dc.bufferedAmount > this.MAX_BUFFERED) {
                    setTimeout(tick, 40);
                    return;
                }

                const end = Math.min(offset + this.CHUNK_SIZE, total);
                const chunk = bytes.subarray(offset, end);
                session.dc.send(chunk);
                offset = end;

                this._emit('p2p:send-progress', {
                    sessionId,
                    sent: offset,
                    total,
                    percent: total > 0 ? Math.min(100, Math.round((offset / total) * 100)) : 100
                });

                setTimeout(tick, 0);
            };

            tick();
        });
    },

    async createReceiveAnswer(offerCode) {
        const decoded = this._decode(offerCode);
        if (!decoded.type || !decoded.sdp) {
            throw new Error('Invalid offer code');
        }

        const incomingMeta = this._normalizeFileMeta(decoded.meta || {});
        if (incomingMeta.size > this.MAX_FILE_SIZE) {
            throw new Error('Incoming file exceeds 100MB transfer limit');
        }

        const sessionId = this._newId();
        const session = this._createSession(
            sessionId,
            'receiver',
            decoded.token || this._newToken()
        );

        session.pc.ondatachannel = (event) => this._wireChannel(session, event.channel);

        await session.pc.setRemoteDescription({
            type: decoded.type,
            sdp: decoded.sdp
        });

        const answer = await session.pc.createAnswer();
        await session.pc.setLocalDescription(answer);
        await this._waitIce(session);

        const answerCode = this._encode({
            v: 1,
            type: session.pc.localDescription.type,
            sdp: session.pc.localDescription.sdp,
            token: session.token
        });

        return {
            sessionId,
            sessionToken: session.token,
            answerCode,
            meta: incomingMeta
        };
    },

    async createCollabOffer(docInfo = {}) {
        const sessionId = this._newId();
        const session = this._createSession(sessionId, 'collab-init');

        const dataChannel = session.pc.createDataChannel('ephemera-collab', { ordered: true });
        this._wireChannel(session, dataChannel);

        const offer = await session.pc.createOffer();
        await session.pc.setLocalDescription(offer);
        await this._waitIce(session);

        const offerCode = this._encode({
            v: 1,
            type: session.pc.localDescription.type,
            sdp: session.pc.localDescription.sdp,
            token: session.token,
            collab: true,
            doc: docInfo
        });

        return { sessionId, offerCode, sessionToken: session.token };
    },

    async createCollabAnswer(offerCode) {
        const decoded = this._decode(offerCode);
        if (!decoded.collab) throw new Error('Not a collaboration offer');

        const sessionId = this._newId();
        const session = this._createSession(
            sessionId,
            'collab-join',
            decoded.token || this._newToken()
        );

        session.pc.ondatachannel = (event) => this._wireChannel(session, event.channel);

        await session.pc.setRemoteDescription({
            type: decoded.type,
            sdp: decoded.sdp
        });

        const answer = await session.pc.createAnswer();
        await session.pc.setLocalDescription(answer);
        await this._waitIce(session);

        const answerCode = this._encode({
            v: 1,
            type: session.pc.localDescription.type,
            sdp: session.pc.localDescription.sdp,
            token: session.token
        });

        return { sessionId, answerCode, doc: decoded.doc, sessionToken: session.token };
    },

    async completeCollab(sessionId, answerCode) {
        const session = this._sessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        const decoded = this._decode(answerCode);
        if (decoded.token && decoded.token !== session.token) {
            throw new Error('Collaboration answer does not match this session');
        }

        await session.pc.setRemoteDescription({
            type: decoded.type,
            sdp: decoded.sdp
        });
    },

    sendCollab(sessionId, payload) {
        const session = this._sessions.get(sessionId);
        if (!session?.dc || session.dc.readyState !== 'open') return false;

        session.dc.send(JSON.stringify({ type: 'collab', payload }));
        return true;
    },

    isConnected(sessionId) {
        const session = this._sessions.get(sessionId);
        return session?.dc?.readyState === 'open';
    },

    close(sessionId) {
        this._cleanup(sessionId);
    },

    _resetForTests() {
        Array.from(this._sessions.keys()).forEach(sessionId => this._cleanup(sessionId));
        this._nextId = 0;
    }
};

window.EphemeraP2P = EphemeraP2P;
