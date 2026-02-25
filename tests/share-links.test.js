import { describe, expect, it } from 'vitest';

import '../js/system/share-links.js';

const EphemeraShareLinks = window.EphemeraShareLinks;

describe('EphemeraShareLinks', () => {
    it('encodes and decodes text file payloads', () => {
        const payload = EphemeraShareLinks.createFilePayload({
            name: 'notes.txt',
            mimeType: 'text/plain',
            content: 'hello world'
        });
        const token = EphemeraShareLinks.encodePayload(payload);
        const decoded = EphemeraShareLinks.normalizePayload(
            EphemeraShareLinks.decodePayload(token)
        );

        expect(decoded.kind).toBe('file');
        expect(decoded.name).toBe('notes.txt');
        expect(EphemeraShareLinks.decodeContent(decoded)).toBe('hello world');
    });

    it('round-trips binary file payloads', () => {
        const payload = EphemeraShareLinks.createFilePayload({
            name: 'image.bin',
            mimeType: 'application/octet-stream',
            content: new Uint8Array([1, 2, 3, 4]).buffer
        });
        const token = EphemeraShareLinks.encodePayload(payload);
        const decoded = EphemeraShareLinks.normalizePayload(
            EphemeraShareLinks.decodePayload(token)
        );
        const content = EphemeraShareLinks.decodeContent(decoded);

        expect(decoded.encoding).toBe('base64');
        expect(Array.from(new Uint8Array(content))).toEqual([1, 2, 3, 4]);
    });

    it('sanitizes directory entry paths and preserves file entries', () => {
        const payload = EphemeraShareLinks.createDirectoryPayload({
            name: '../unsafe/folder',
            entries: [
                {
                    path: '../docs/./readme.txt',
                    mimeType: 'text/plain',
                    content: 'docs'
                },
                {
                    path: 'images\\icon.bin',
                    mimeType: 'application/octet-stream',
                    content: new Uint8Array([9, 8, 7]).buffer
                }
            ]
        });

        expect(payload.name.includes('/')).toBe(false);
        expect(payload.entries[0].path).toBe('docs/readme.txt');
        expect(payload.entries[1].path).toBe('images/icon.bin');

        const token = EphemeraShareLinks.encodePayload(payload);
        const decoded = EphemeraShareLinks.normalizePayload(
            EphemeraShareLinks.decodePayload(token)
        );
        const binary = EphemeraShareLinks.decodeContent(decoded.entries[1]);

        expect(decoded.kind).toBe('directory');
        expect(decoded.entries).toHaveLength(2);
        expect(Array.from(new Uint8Array(binary))).toEqual([9, 8, 7]);
    });

    it('normalizes legacy shared payloads', () => {
        const payload = EphemeraShareLinks.normalizePayload({
            name: 'legacy.txt',
            content: 'legacy-content'
        });

        expect(payload.kind).toBe('file');
        expect(payload.encoding).toBe('utf8');
        expect(EphemeraShareLinks.decodeContent(payload)).toBe('legacy-content');
    });
});
