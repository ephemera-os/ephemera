import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventsMock } from './setup.js';

import '../js/system/p2p.js';

const EphemeraP2P = window.EphemeraP2P;

class FakeDataChannel {
    constructor(label) {
        this.label = label;
        this.readyState = 'open';
        this.bufferedAmount = 0;
        this.binaryType = 'arraybuffer';
        this.sent = [];
        this.onmessage = null;
        this.onerror = null;
    }

    send(payload) {
        this.sent.push(payload);
    }

    close() {
        this.readyState = 'closed';
    }
}

class FakePeerConnection {
    constructor(config) {
        this.config = config;
        this.localDescription = null;
        this.remoteDescription = null;
        this.connectionState = 'new';

        this.onicecandidate = null;
        this.onconnectionstatechange = null;
        this.ondatachannel = null;

        this._channel = null;
    }

    createDataChannel(label) {
        this._channel = new FakeDataChannel(label);
        return this._channel;
    }

    async createOffer() {
        return { type: 'offer', sdp: 'offer-sdp' };
    }

    async createAnswer() {
        return { type: 'answer', sdp: 'answer-sdp' };
    }

    async setLocalDescription(desc) {
        this.localDescription = desc;
        queueMicrotask(() => {
            this.onicecandidate?.({ candidate: null });
        });
    }

    async setRemoteDescription(desc) {
        this.remoteDescription = desc;
    }

    close() {
        this.connectionState = 'closed';
    }

    markConnected() {
        this.connectionState = 'connected';
        this.onconnectionstatechange?.();
    }
}

describe('EphemeraP2P', () => {
    const originalRTCPeerConnection = globalThis.RTCPeerConnection;
    let peerConnections = [];

    beforeEach(() => {
        eventsMock._reset();
        peerConnections = [];

        globalThis.RTCPeerConnection = vi.fn((config) => {
            const pc = new FakePeerConnection(config);
            peerConnections.push(pc);
            return pc;
        });

        EphemeraP2P._resetForTests();
    });

    afterEach(() => {
        EphemeraP2P._resetForTests();
        globalThis.RTCPeerConnection = originalRTCPeerConnection;
    });

    it('uses custom ICE servers from settings in new sessions', async () => {
        window.EphemeraState.settings.p2pIceServers = [
            { urls: 'stun:custom.example:3478' }
        ];

        const offer = await EphemeraP2P.createSendOffer({
            name: 'demo.txt',
            size: 4,
            mimeType: 'text/plain'
        });

        expect(offer.sessionToken).toBeTruthy();
        expect(peerConnections[0].config.iceServers).toEqual([
            { urls: 'stun:custom.example:3478' }
        ]);
    });

    it('rejects an answer code with a mismatched session token', async () => {
        const { sessionId } = await EphemeraP2P.createSendOffer({
            name: 'notes.txt',
            size: 5,
            mimeType: 'text/plain'
        });

        const invalidAnswer = EphemeraP2P._encode({
            v: 1,
            type: 'answer',
            sdp: 'remote-answer',
            token: 'wrong-token'
        });

        await expect(EphemeraP2P.completeSend(sessionId, invalidAnswer))
            .rejects
            .toThrow('does not match this session');
    });

    it('chunks outbound content and emits send progress', async () => {
        EphemeraP2P.CHUNK_SIZE = 4;

        const progress = [];
        window.EphemeraEvents.on('p2p:send-progress', (payload) => {
            progress.push(payload.percent);
        });

        const { sessionId } = await EphemeraP2P.createSendOffer({
            name: 'payload.txt',
            size: 11,
            mimeType: 'text/plain'
        });

        await EphemeraP2P.sendFile(sessionId, 'hello world');

        const session = EphemeraP2P._sessions.get(sessionId);
        const sent = session.dc.sent;
        const first = JSON.parse(sent[0]);
        const last = JSON.parse(sent[sent.length - 1]);

        expect(first.type).toBe('meta');
        expect(first.size).toBe(11);
        expect(last.type).toBe('done');
        expect(progress.at(-1)).toBe(100);
    });

    it('decodes binary data URLs before sending file chunks', async () => {
        const { sessionId } = await EphemeraP2P.createSendOffer({
            name: 'shot.png',
            size: 12,
            mimeType: 'image/png'
        });

        await EphemeraP2P.sendFile(sessionId, 'data:image/png;base64,iVBORw0KGgo=');

        const session = EphemeraP2P._sessions.get(sessionId);
        const sent = session.dc.sent;
        const meta = JSON.parse(sent[0]);

        const binaryChunks = sent.filter((entry) => typeof entry !== 'string');
        const totalBytes = binaryChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const merged = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of binaryChunks) {
            merged.set(chunk, offset);
            offset += chunk.byteLength;
        }

        expect(meta.mimeType).toBe('image/png');
        expect(meta.size).toBe(8);
        expect(Array.from(merged)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    });

    it('emits transfer-complete with file metadata for received chunks', async () => {
        const completed = [];
        window.EphemeraEvents.on('p2p:transfer-complete', (payload) => {
            completed.push(payload);
        });

        const { offerCode } = await EphemeraP2P.createSendOffer({
            name: 'archive.bin',
            size: 3,
            mimeType: 'application/octet-stream'
        });

        const { sessionId } = await EphemeraP2P.createReceiveAnswer(offerCode);
        const session = EphemeraP2P._sessions.get(sessionId);

        EphemeraP2P._onMessage(session, JSON.stringify({
            type: 'meta',
            name: 'archive.bin',
            size: 3,
            mimeType: 'application/octet-stream'
        }));
        EphemeraP2P._onMessage(session, new Uint8Array([1, 2, 3]).buffer);
        EphemeraP2P._onMessage(session, JSON.stringify({ type: 'done' }));

        expect(completed).toHaveLength(1);
        expect(completed[0].name).toBe('archive.bin');
        expect(completed[0].size).toBe(3);
        expect(completed[0].mimeType).toBe('application/octet-stream');
        expect(completed[0].blob.size).toBe(3);
    });

    it('preserves unicode metadata through offer/answer encoding', async () => {
        const unicodeName = 'r\u00e9sum\u00e9-\ud83d\udcc4.txt';

        const { offerCode } = await EphemeraP2P.createSendOffer({
            name: unicodeName,
            size: 3,
            mimeType: 'text/plain'
        });

        const { meta } = await EphemeraP2P.createReceiveAnswer(offerCode);
        expect(meta.name).toBe(unicodeName);
    });
});
