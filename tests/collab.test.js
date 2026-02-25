import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness.js';
import { eventsMock } from './setup.js';

function bytesToBase64(bytesLike) {
    const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

describe('EphemeraCollab', () => {
    let EphemeraCollab;
    let p2pMock;
    let editorEngine;

    beforeEach(async () => {
        eventsMock._reset();

        p2pMock = {
            createCollabOffer: vi.fn(async () => ({
                sessionId: 'collab-sender',
                offerCode: 'offer-code',
                sessionToken: 'token-a'
            })),
            createCollabAnswer: vi.fn(async () => ({
                sessionId: 'collab-receiver',
                answerCode: 'answer-code',
                sessionToken: 'token-b',
                doc: { title: 'Shared Doc' }
            })),
            completeCollab: vi.fn(async () => {}),
            sendCollab: vi.fn(() => true),
            isConnected: vi.fn(() => false),
            close: vi.fn()
        };

        window.EphemeraP2P = p2pMock;

        await import('../js/system/collab.js');
        await import('../js/system/editor-engine.js');
        EphemeraCollab = window.EphemeraCollab;
        editorEngine = window.EphemeraEditorEngine;
        EphemeraCollab._resetForTests();
    });

    it('sends Yjs updates when local textarea content changes', async () => {
        const { sessionId } = await EphemeraCollab.createOffer({
            initialText: 'hello',
            user: { name: 'Alice' }
        });

        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        const unbind = EphemeraCollab.bindTextarea(sessionId, textarea);

        textarea.value = 'hello world';
        textarea.selectionStart = textarea.value.length;
        textarea.selectionEnd = textarea.value.length;
        textarea.dispatchEvent(new Event('input'));

        const sentTypes = p2pMock.sendCollab.mock.calls
            .map((call) => call[1]?.type)
            .filter(Boolean);

        expect(sentTypes).toContain('yjs-update');

        unbind();
    });

    it('applies remote Yjs updates to bound textarea', async () => {
        const { sessionId } = await EphemeraCollab.createOffer({
            initialText: '',
            user: { name: 'Alice' }
        });

        const textarea = document.createElement('textarea');
        const unbind = EphemeraCollab.bindTextarea(sessionId, textarea);

        const remoteDoc = new Y.Doc();
        const remoteText = remoteDoc.getText('content');
        remoteText.insert(0, 'from peer');
        const update = Y.encodeStateAsUpdate(remoteDoc);

        eventsMock.emit('p2p:collab-message', {
            sessionId,
            payload: {
                type: 'yjs-update',
                data: bytesToBase64(update)
            }
        });

        expect(textarea.value).toBe('from peer');

        unbind();
    });

    it('propagates awareness presence with cursor positions', async () => {
        const { sessionId } = await EphemeraCollab.createOffer({
            initialText: 'ab\ncd',
            user: { name: 'Alice' }
        });

        const textarea = document.createElement('textarea');
        let lastPresence = [];
        const unbind = EphemeraCollab.bindTextarea(sessionId, textarea, {
            onPresence: (presence) => {
                lastPresence = presence;
            }
        });

        const remoteDoc = new Y.Doc();
        const remoteAwareness = new Awareness(remoteDoc);
        remoteAwareness.setLocalState({
            user: { name: 'Bob', color: '#ff0000' },
            cursor: { anchor: 2, head: 4 }
        });
        const awarenessUpdate = encodeAwarenessUpdate(remoteAwareness, [remoteAwareness.clientID]);

        eventsMock.emit('p2p:collab-message', {
            sessionId,
            payload: {
                type: 'yjs-awareness',
                data: bytesToBase64(awarenessUpdate)
            }
        });

        expect(lastPresence).toHaveLength(1);
        expect(lastPresence[0].name).toBe('Bob');
        expect(lastPresence[0].line).toBe(2);
        expect(lastPresence[0].col).toBe(2);

        unbind();
    });

    it('binds CM6 adapter via bindCodeMirror and syncs updates', async () => {
        window.EphemeraState.settings.editorEngine = 'cm6';
        editorEngine.setPreferredBackend('cm6', { persist: false });

        const { sessionId } = await EphemeraCollab.createOffer({
            initialText: 'hello',
            user: { name: 'Alice' }
        });

        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        const editor = editorEngine.createEditor(textarea, {
            mode: 'javascript',
            gutters: ['CodeMirror-linenumbers', 'git-diff-gutter']
        });

        const unbind = EphemeraCollab.bindCodeMirror(sessionId, editor);

        editor.replaceRange(' world', { line: 0, ch: 5 });
        const sentTypes = p2pMock.sendCollab.mock.calls
            .map((call) => call[1]?.type)
            .filter(Boolean);
        expect(sentTypes).toContain('yjs-update');

        const remoteDoc = new Y.Doc();
        const remoteText = remoteDoc.getText('content');
        remoteText.insert(0, 'from peer');
        const update = Y.encodeStateAsUpdate(remoteDoc);

        eventsMock.emit('p2p:collab-message', {
            sessionId,
            payload: {
                type: 'yjs-update',
                data: bytesToBase64(update)
            }
        });

        const mergedValue = editor.getValue();
        expect(mergedValue).toContain('from peer');
        expect(mergedValue).toContain('hello world');

        unbind();
        editor.destroy();
        textarea.remove();
    });

    it('closes sessions and tears down P2P', async () => {
        const { sessionId } = await EphemeraCollab.createOffer({
            initialText: 'test',
            user: { name: 'Alice' }
        });

        expect(EphemeraCollab._sessions.has(sessionId)).toBe(true);

        EphemeraCollab.closeSession(sessionId);

        expect(EphemeraCollab._sessions.has(sessionId)).toBe(false);
        expect(p2pMock.close).toHaveBeenCalledWith(sessionId);
    });
});
