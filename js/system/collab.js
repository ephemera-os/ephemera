import * as Y from 'yjs';
import {
    Awareness,
    applyAwarenessUpdate,
    encodeAwarenessUpdate,
    removeAwarenessStates
} from 'y-protocols/awareness.js';

const USER_COLORS = [
    '#00d4aa',
    '#00a8ff',
    '#ff6b6b',
    '#ffd166',
    '#c77dff',
    '#4ecdc4'
];

function hashString(value) {
    let hash = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function pickColor(seed) {
    return USER_COLORS[hashString(seed) % USER_COLORS.length];
}

function bytesToBase64(bytesLike) {
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
}

function base64ToBytes(base64) {
    const binary = atob(String(base64 || ''));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}

function clampIndex(index, textLength) {
    if (!Number.isFinite(index)) return 0;
    return Math.min(Math.max(0, Math.floor(index)), textLength);
}

function indexToLineCol(text, index) {
    const clamped = clampIndex(index, text.length);
    let line = 1;
    let col = 1;
    for (let i = 0; i < clamped; i++) {
        if (text[i] === '\n') {
            line += 1;
            col = 1;
        } else {
            col += 1;
        }
    }
    return { line, col };
}

function applyStringDiff(yText, oldText, nextText) {
    if (oldText === nextText) return;

    let start = 0;
    const oldLen = oldText.length;
    const nextLen = nextText.length;

    while (start < oldLen && start < nextLen && oldText[start] === nextText[start]) {
        start += 1;
    }

    let oldEnd = oldLen;
    let nextEnd = nextLen;
    while (
        oldEnd > start &&
        nextEnd > start &&
        oldText[oldEnd - 1] === nextText[nextEnd - 1]
    ) {
        oldEnd -= 1;
        nextEnd -= 1;
    }

    const deleteLen = oldEnd - start;
    const insertText = nextText.slice(start, nextEnd);

    if (deleteLen > 0) {
        yText.delete(start, deleteLen);
    }
    if (insertText) {
        yText.insert(start, insertText);
    }
}

function ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('ephemera-collab-style')) return;

    const style = document.createElement('style');
    style.id = 'ephemera-collab-style';
    style.textContent = `
        .ephemera-remote-selection {
            background: rgba(0, 168, 255, 0.18);
        }
        .ephemera-remote-cursor {
            display: inline-block;
            width: 0;
            border-left: 2px solid var(--remote-color, #00a8ff);
            height: 1.2em;
            margin-left: -1px;
            position: relative;
            pointer-events: none;
        }
        .ephemera-remote-cursor::after {
            content: attr(data-user);
            position: absolute;
            top: -1.35em;
            left: 2px;
            font-size: 10px;
            line-height: 1;
            white-space: nowrap;
            color: var(--remote-color, #00a8ff);
            background: rgba(0, 0, 0, 0.65);
            border-radius: 3px;
            padding: 2px 4px;
        }
    `;
    document.head?.appendChild(style);
}

const EphemeraCollab = {
    _sessions: new Map(),

    _identity(user = {}) {
        const fallbackName = window.EphemeraState?.user?.displayName
            || window.EphemeraState?.user?.name
            || window.EphemeraState?.user?.id
            || 'Collaborator';
        const name = String(user.name || fallbackName);
        const id = String(user.id || window.EphemeraState?.user?.id || name.toLowerCase().replace(/\s+/g, '-'));
        const color = String(user.color || pickColor(id || name));
        return { id, name, color };
    },

    _assertP2P() {
        if (!window.EphemeraP2P) {
            throw new Error('P2P collaboration is unavailable');
        }
    },

    _emit(event, payload) {
        window.EphemeraEvents?.emit?.(event, payload);
    },

    _on(event, handler) {
        window.EphemeraEvents?.on?.(event, handler);
        return () => {
            window.EphemeraEvents?.off?.(event, handler);
        };
    },

    _createSession(sessionId, options = {}) {
        this._assertP2P();
        ensureStyles();

        const doc = new Y.Doc();
        const yText = doc.getText('content');
        const awareness = new Awareness(doc);
        const identity = this._identity(options.user);
        const initialText = String(options.initialText || '');

        if (initialText) {
            yText.insert(0, initialText);
        }

        awareness.setLocalState({
            user: identity,
            cursor: null,
            doc: {
                id: options.docId || null,
                title: options.title || null
            }
        });

        const session = {
            id: sessionId,
            doc,
            yText,
            awareness,
            identity,
            docId: options.docId || null,
            title: options.title || null,
            connected: Boolean(window.EphemeraP2P?.isConnected?.(sessionId)),
            unsubscribers: [],
            cursorMarkers: new Set()
        };

        const onDocUpdate = (update, origin) => {
            if (origin === 'remote') return;
            const payload = {
                type: 'yjs-update',
                data: bytesToBase64(update)
            };
            window.EphemeraP2P.sendCollab(sessionId, payload);
        };
        doc.on('update', onDocUpdate);

        const onAwarenessUpdate = ({ added, updated, removed }, origin) => {
            if (origin === 'remote') return;
            const changed = added.concat(updated, removed);
            if (!changed.length) return;
            const payload = {
                type: 'yjs-awareness',
                data: bytesToBase64(encodeAwarenessUpdate(awareness, changed))
            };
            window.EphemeraP2P.sendCollab(sessionId, payload);
            this._emitPresence(sessionId);
        };
        awareness.on('update', onAwarenessUpdate);

        const onCollabMessage = ({ sessionId: incomingSessionId, payload }) => {
            if (incomingSessionId !== sessionId || !payload || typeof payload !== 'object') return;
            this._onPayload(session, payload);
        };
        const onConnected = ({ sessionId: incomingSessionId }) => {
            if (incomingSessionId !== sessionId) return;
            session.connected = true;
            this._broadcastState(session);
            this._broadcastAwareness(session);
            this._emit('collab:connected', { sessionId });
        };
        const onDisconnected = ({ sessionId: incomingSessionId }) => {
            if (incomingSessionId !== sessionId) return;
            session.connected = false;
            const remoteIds = Array.from(awareness.getStates().keys())
                .filter(id => id !== awareness.clientID);
            if (remoteIds.length > 0) {
                removeAwarenessStates(awareness, remoteIds, 'remote');
            }
            this._emitPresence(sessionId);
            this._emit('collab:disconnected', { sessionId });
        };

        session.unsubscribers.push(this._on('p2p:collab-message', onCollabMessage));
        session.unsubscribers.push(this._on('p2p:connected', onConnected));
        session.unsubscribers.push(this._on('p2p:disconnected', onDisconnected));

        this._sessions.set(sessionId, session);
        return session;
    },

    _onPayload(session, payload) {
        if (payload.type === 'yjs-update' || payload.type === 'yjs-sync') {
            try {
                const update = base64ToBytes(payload.data || '');
                Y.applyUpdate(session.doc, update, 'remote');
            } catch (_err) {
                this._emit('collab:error', {
                    sessionId: session.id,
                    error: 'Invalid Yjs update payload'
                });
            }
            return;
        }

        if (payload.type === 'yjs-awareness') {
            try {
                const update = base64ToBytes(payload.data || '');
                applyAwarenessUpdate(session.awareness, update, 'remote');
                this._emitPresence(session.id);
            } catch (_err) {
                this._emit('collab:error', {
                    sessionId: session.id,
                    error: 'Invalid awareness payload'
                });
            }
        }
    },

    _broadcastState(session) {
        const update = Y.encodeStateAsUpdate(session.doc);
        window.EphemeraP2P.sendCollab(session.id, {
            type: 'yjs-sync',
            data: bytesToBase64(update)
        });
    },

    _broadcastAwareness(session) {
        const ids = Array.from(session.awareness.getStates().keys());
        if (!ids.length) return;
        const payload = {
            type: 'yjs-awareness',
            data: bytesToBase64(encodeAwarenessUpdate(session.awareness, ids))
        };
        window.EphemeraP2P.sendCollab(session.id, payload);
    },

    _getSession(sessionId) {
        const session = this._sessions.get(sessionId);
        if (!session) throw new Error('Collaboration session not found');
        return session;
    },

    _emitPresence(sessionId) {
        const presence = this.getRemotePresence(sessionId);
        this._emit('collab:presence', { sessionId, presence });
    },

    async createOffer(options = {}) {
        this._assertP2P();
        const { sessionId, offerCode, sessionToken } = await window.EphemeraP2P.createCollabOffer({
            docId: options.docId || null,
            title: options.title || null,
            yjs: true
        });
        this._createSession(sessionId, {
            docId: options.docId,
            title: options.title,
            initialText: options.initialText || '',
            user: options.user || {}
        });
        return { sessionId, offerCode, sessionToken };
    },

    async createAnswer(offerCode, options = {}) {
        this._assertP2P();
        const { sessionId, answerCode, doc, sessionToken } = await window.EphemeraP2P.createCollabAnswer(offerCode);
        this._createSession(sessionId, {
            docId: doc?.docId || options.docId || null,
            title: doc?.title || options.title || null,
            initialText: options.initialText || '',
            user: options.user || {}
        });
        return { sessionId, answerCode, doc, sessionToken };
    },

    async completeOffer(sessionId, answerCode) {
        this._assertP2P();
        await window.EphemeraP2P.completeCollab(sessionId, answerCode);
    },

    isConnected(sessionId) {
        return Boolean(window.EphemeraP2P?.isConnected?.(sessionId));
    },

    setCursor(sessionId, anchor, head = anchor) {
        const session = this._getSession(sessionId);
        const textLength = session.yText.toString().length;
        const safeAnchor = clampIndex(anchor, textLength);
        const safeHead = clampIndex(head, textLength);

        session.awareness.setLocalStateField('cursor', {
            anchor: safeAnchor,
            head: safeHead
        });
    },

    clearCursor(sessionId) {
        const session = this._getSession(sessionId);
        session.awareness.setLocalStateField('cursor', null);
    },

    getRemotePresence(sessionId) {
        const session = this._getSession(sessionId);
        const content = session.yText.toString();
        const remote = [];

        session.awareness.getStates().forEach((state, clientId) => {
            if (clientId === session.awareness.clientID) return;
            const user = state?.user || {};
            const cursor = state?.cursor || null;
            const index = cursor ? clampIndex(cursor.head, content.length) : null;
            const location = index == null ? null : indexToLineCol(content, index);

            remote.push({
                clientId,
                name: String(user.name || 'Peer'),
                color: String(user.color || pickColor(clientId)),
                anchor: cursor ? clampIndex(cursor.anchor, content.length) : null,
                head: index,
                line: location?.line || null,
                col: location?.col || null
            });
        });

        return remote;
    },

    bindTextarea(sessionId, textarea, options = {}) {
        if (!textarea) {
            throw new Error('Textarea is required');
        }

        const session = this._getSession(sessionId);
        let shadow = session.yText.toString();
        let applyingRemote = false;

        if (textarea.value !== shadow) {
            textarea.value = shadow;
        }

        const notifyPresence = () => {
            if (typeof options.onPresence === 'function') {
                options.onPresence(this.getRemotePresence(sessionId));
            }
        };

        const onInput = () => {
            if (applyingRemote) return;
            const next = textarea.value;
            applyStringDiff(session.yText, shadow, next);
            shadow = next;
            this.setCursor(sessionId, textarea.selectionStart || 0, textarea.selectionEnd || textarea.selectionStart || 0);
        };

        const onCursor = () => {
            this.setCursor(sessionId, textarea.selectionStart || 0, textarea.selectionEnd || textarea.selectionStart || 0);
        };

        const onYText = () => {
            const next = session.yText.toString();
            shadow = next;
            if (textarea.value !== next) {
                const start = clampIndex(textarea.selectionStart || 0, next.length);
                const end = clampIndex(textarea.selectionEnd || 0, next.length);
                applyingRemote = true;
                textarea.value = next;
                textarea.selectionStart = start;
                textarea.selectionEnd = end;
                applyingRemote = false;
            }
            if (typeof options.onChange === 'function') {
                options.onChange(next);
            }
        };

        const onAwareness = () => {
            notifyPresence();
        };

        session.yText.observe(onYText);
        session.awareness.on('change', onAwareness);

        textarea.addEventListener('input', onInput);
        textarea.addEventListener('keyup', onCursor);
        textarea.addEventListener('mouseup', onCursor);
        textarea.addEventListener('select', onCursor);

        notifyPresence();

        return () => {
            session.yText.unobserve(onYText);
            session.awareness.off('change', onAwareness);
            textarea.removeEventListener('input', onInput);
            textarea.removeEventListener('keyup', onCursor);
            textarea.removeEventListener('mouseup', onCursor);
            textarea.removeEventListener('select', onCursor);
        };
    },

    bindCodeMirror(sessionId, codeMirror, options = {}) {
        if (!codeMirror) {
            throw new Error('CodeMirror instance is required');
        }

        const session = this._getSession(sessionId);
        let shadow = session.yText.toString();
        let applyingRemote = false;
        const marks = new Map();

        if (codeMirror.getValue() !== shadow) {
            codeMirror.setValue(shadow);
        }

        const clearMarks = () => {
            marks.forEach((entry) => {
                entry.cursor?.clear?.();
                entry.selection?.clear?.();
            });
            marks.clear();
        };

        const renderPresence = () => {
            clearMarks();
            const presence = this.getRemotePresence(sessionId);
            const doc = codeMirror.getDoc();
            const content = session.yText.toString();

            presence.forEach((peer) => {
                if (peer.head == null) return;
                const color = peer.color || '#00a8ff';
                const cursorPos = doc.posFromIndex(clampIndex(peer.head, content.length));
                const cursorEl = document.createElement('span');
                cursorEl.className = 'ephemera-remote-cursor';
                cursorEl.dataset.user = peer.name || 'Peer';
                cursorEl.style.setProperty('--remote-color', color);

                const cursorMark = doc.setBookmark(cursorPos, {
                    widget: cursorEl,
                    insertLeft: true
                });

                let selectionMark = null;
                if (peer.anchor != null && peer.anchor !== peer.head) {
                    const from = Math.min(peer.anchor, peer.head);
                    const to = Math.max(peer.anchor, peer.head);
                    selectionMark = doc.markText(
                        doc.posFromIndex(clampIndex(from, content.length)),
                        doc.posFromIndex(clampIndex(to, content.length)),
                        { className: 'ephemera-remote-selection' }
                    );
                }

                marks.set(peer.clientId, { cursor: cursorMark, selection: selectionMark });
            });

            if (typeof options.onPresence === 'function') {
                options.onPresence(presence);
            }
        };

        const syncCursor = () => {
            const doc = codeMirror.getDoc();
            const anchor = doc.indexFromPos(doc.getCursor('anchor'));
            const head = doc.indexFromPos(doc.getCursor('head'));
            this.setCursor(sessionId, anchor, head);
        };

        const onChange = () => {
            if (applyingRemote) return;
            const next = codeMirror.getValue();
            applyStringDiff(session.yText, shadow, next);
            shadow = next;
            syncCursor();
        };

        const onYText = () => {
            const next = session.yText.toString();
            shadow = next;
            if (codeMirror.getValue() !== next) {
                const doc = codeMirror.getDoc();
                const anchor = doc.indexFromPos(doc.getCursor('anchor'));
                const head = doc.indexFromPos(doc.getCursor('head'));
                applyingRemote = true;
                codeMirror.setValue(next);
                const nextAnchor = doc.posFromIndex(clampIndex(anchor, next.length));
                const nextHead = doc.posFromIndex(clampIndex(head, next.length));
                doc.setSelection(nextAnchor, nextHead);
                applyingRemote = false;
            }
            renderPresence();
        };

        const onAwareness = () => {
            renderPresence();
        };

        session.yText.observe(onYText);
        session.awareness.on('change', onAwareness);
        codeMirror.on('change', onChange);
        codeMirror.on('cursorActivity', syncCursor);

        renderPresence();
        syncCursor();

        return () => {
            session.yText.unobserve(onYText);
            session.awareness.off('change', onAwareness);
            codeMirror.off('change', onChange);
            codeMirror.off('cursorActivity', syncCursor);
            clearMarks();
        };
    },

    closeSession(sessionId) {
        const session = this._sessions.get(sessionId);
        if (!session) return;

        session.unsubscribers.forEach((unsubscribe) => {
            try {
                unsubscribe?.();
            } catch (_err) {
                // Ignore listener cleanup errors.
            }
        });
        session.unsubscribers = [];

        const localClientId = session.awareness.clientID;
        removeAwarenessStates(session.awareness, [localClientId], 'local-close');

        try {
            session.doc.destroy();
        } catch (_err) {
            // Ignore destroy failures.
        }

        this._sessions.delete(sessionId);
        window.EphemeraP2P?.close?.(sessionId);
    },

    _resetForTests() {
        Array.from(this._sessions.keys()).forEach((sessionId) => this.closeSession(sessionId));
        this._sessions.clear();
    }
};

window.EphemeraCollab = EphemeraCollab;
