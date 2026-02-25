import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockIDB, eventsMock, sessionMock } from './setup.js';
import EphemeraStorage from '../js/core/storage.js';
import '../js/system/filesystem.js';

const EphemeraFS = window.EphemeraFS;

async function initStorage() {
    mockIDB._reset();
    EphemeraStorage.db = null;
    EphemeraStorage.profileId = 'default';
    EphemeraStorage.dbName = 'EphemeraFS_default';
    EphemeraStorage._writeQueue.pending = [];
    EphemeraStorage._writeQueue.isProcessing = false;
    await EphemeraStorage.init();
}

describe('EphemeraFS', () => {
    beforeEach(async () => {
        vi.useRealTimers();
        // Unlock session so writes go through immediately (not queued)
        sessionMock._setUnlocked(true, { type: 'secret' });
        await initStorage();
        eventsMock._reset();
        vi.clearAllMocks();
        EphemeraFS._pendingCloseSnapshots = new Map();
        EphemeraFS._flushSnapshotsPromise = null;
        EphemeraFS._historyWarnedAt = 0;
        EphemeraFS._historySequence = 0;
        window.EphemeraState.settings.fileHistoryMode = 'every-save';
        window.EphemeraState.settings.fileHistoryMaxVersions = 10;
    });

    // --- Path utilities ---

    describe('normalizePath', () => {
        it('should return root for empty-like paths', () => {
            expect(EphemeraFS.normalizePath('/')).toBe('/');
        });

        it('should add leading slash', () => {
            expect(EphemeraFS.normalizePath('home/user')).toBe('/home/user');
        });

        it('should remove trailing components with ..', () => {
            expect(EphemeraFS.normalizePath('/home/user/../admin')).toBe('/home/admin');
        });

        it('should remove . components', () => {
            expect(EphemeraFS.normalizePath('/home/./user/./docs')).toBe('/home/user/docs');
        });

        it('should handle multiple slashes', () => {
            expect(EphemeraFS.normalizePath('/home//user///docs')).toBe('/home/user/docs');
        });

        it('should not traverse past root', () => {
            expect(EphemeraFS.normalizePath('/../../etc')).toBe('/etc');
        });
    });

    describe('getParentDir', () => {
        it('should return parent directory', () => {
            expect(EphemeraFS.getParentDir('/home/user/docs')).toBe('/home/user');
        });

        it('should return root for top-level path', () => {
            expect(EphemeraFS.getParentDir('/home')).toBe('/');
        });

        it('should return root for root', () => {
            expect(EphemeraFS.getParentDir('/')).toBe('/');
        });
    });

    describe('getBasename', () => {
        it('should return filename from path', () => {
            expect(EphemeraFS.getBasename('/home/user/test.txt')).toBe('test.txt');
        });

        it('should return directory name', () => {
            expect(EphemeraFS.getBasename('/home/user')).toBe('user');
        });

        it('should return empty for root', () => {
            expect(EphemeraFS.getBasename('/')).toBe('');
        });
    });

    describe('getExtension', () => {
        it('should return file extension', () => {
            expect(EphemeraFS.getExtension('/test.txt')).toBe('txt');
            expect(EphemeraFS.getExtension('/app.min.js')).toBe('js');
        });

        it('should return empty for no extension', () => {
            expect(EphemeraFS.getExtension('/Makefile')).toBe('');
        });

        it('should be lowercase', () => {
            expect(EphemeraFS.getExtension('/test.TXT')).toBe('txt');
        });
    });

    describe('getMimeType', () => {
        it('should return correct MIME types', () => {
            expect(EphemeraFS.getMimeType('/file.js')).toBe('application/javascript');
            expect(EphemeraFS.getMimeType('/file.html')).toBe('text/html');
            expect(EphemeraFS.getMimeType('/file.css')).toBe('text/css');
            expect(EphemeraFS.getMimeType('/file.json')).toBe('application/json');
            expect(EphemeraFS.getMimeType('/file.png')).toBe('image/png');
        });

        it('should return octet-stream for unknown types', () => {
            expect(EphemeraFS.getMimeType('/file.xyz')).toBe('application/octet-stream');
        });
    });

    describe('isTextFile', () => {
        it('should identify text files', () => {
            expect(EphemeraFS.isTextFile('/test.txt')).toBe(true);
            expect(EphemeraFS.isTextFile('/test.js')).toBe(true);
            expect(EphemeraFS.isTextFile('/test.md')).toBe(true);
            expect(EphemeraFS.isTextFile('/test.json')).toBe(true);
        });

        it('should reject non-text files', () => {
            expect(EphemeraFS.isTextFile('/test.png')).toBe(false);
            expect(EphemeraFS.isTextFile('/test.mp3')).toBe(false);
        });
    });

    // --- File operations ---

    describe('writeFile / readFile', () => {
        it('should write and read a file', async () => {
            await EphemeraFS.writeFile('/test.txt', 'hello world');
            const content = await EphemeraFS.readFile('/test.txt');
            expect(content).toBe('hello world');
        });

        it('should preserve binary content when encrypted at rest', async () => {
            const source = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer;
            await EphemeraFS.writeFile('/image.png', source, { mimeType: 'image/png' });

            const content = await EphemeraFS.readFile('/image.png');
            expect(content).toBeInstanceOf(ArrayBuffer);
            expect(Array.from(new Uint8Array(content))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        });

        it('should return null for nonexistent file', async () => {
            const content = await EphemeraFS.readFile('/nonexistent.txt');
            expect(content).toBeNull();
        });

        it('should overwrite existing file', async () => {
            await EphemeraFS.writeFile('/test.txt', 'first');
            await EphemeraFS.writeFile('/test.txt', 'second');
            const content = await EphemeraFS.readFile('/test.txt');
            expect(content).toBe('second');
        });

        it('should store file metadata', async () => {
            await EphemeraFS.writeFile('/docs/readme.md', '# Hello');
            const stat = await EphemeraFS.stat('/docs/readme.md');
            expect(stat.name).toBe('readme.md');
            expect(stat.extension).toBe('md');
            expect(stat.type).toBe('file');
            expect(stat.parentDir).toBe('/docs');
            expect(stat.size).toBe(7);
            expect(stat.mimeType).toBe('text/markdown');
            expect(stat.createdAt).toBeTypeOf('number');
            expect(stat.modifiedAt).toBeTypeOf('number');
        });

        it('should auto-create parent directories', async () => {
            await EphemeraFS.writeFile('/a/b/c/file.txt', 'nested');
            const dirA = await EphemeraFS.stat('/a');
            const dirB = await EphemeraFS.stat('/a/b');
            const dirC = await EphemeraFS.stat('/a/b/c');
            expect(dirA.type).toBe('directory');
            expect(dirB.type).toBe('directory');
            expect(dirC.type).toBe('directory');
        });

        it('should emit fs:changed on write', async () => {
            await EphemeraFS.writeFile('/test.txt', 'data');
            expect(eventsMock.emit).toHaveBeenCalledWith('fs:changed', { type: 'write', path: '/test.txt' });
        });

        it('should throw when reading a directory', async () => {
            await EphemeraFS.mkdir('/mydir');
            await expect(EphemeraFS.readFile('/mydir')).rejects.toThrow('Is a directory');
        });
    });

    describe('file version history', () => {
        it('should snapshot previous content on overwrite by default', async () => {
            await EphemeraFS.writeFile('/history.txt', 'first');
            await EphemeraFS.writeFile('/history.txt', 'second');

            const versions = await EphemeraFS.getFileVersions('/history.txt');
            expect(versions).toHaveLength(1);
            expect(versions[0].content).toBe('first');
        });

        it('should enforce max versions per file', async () => {
            window.EphemeraState.settings.fileHistoryMaxVersions = 2;

            await EphemeraFS.writeFile('/retention.txt', 'v1');
            await EphemeraFS.writeFile('/retention.txt', 'v2');
            await EphemeraFS.writeFile('/retention.txt', 'v3');
            await EphemeraFS.writeFile('/retention.txt', 'v4');

            const versions = await EphemeraFS.getFileVersions('/retention.txt');
            expect(versions).toHaveLength(2);
            const contents = versions.map(v => v.content);
            expect(contents).toContain('v3');
            expect(contents).toContain('v2');
            expect(contents).not.toContain('v1');
        });

        it('should snapshot at most every 5 minutes in interval mode', async () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
            window.EphemeraState.settings.fileHistoryMode = 'interval-5m';

            await EphemeraFS.writeFile('/interval.txt', 'a');
            await EphemeraFS.writeFile('/interval.txt', 'b');
            await EphemeraFS.writeFile('/interval.txt', 'c');

            let versions = await EphemeraFS.getFileVersions('/interval.txt');
            expect(versions).toHaveLength(1);
            expect(versions[0].content).toBe('a');

            vi.setSystemTime(new Date('2026-01-01T00:06:00Z'));
            await EphemeraFS.writeFile('/interval.txt', 'd');
            versions = await EphemeraFS.getFileVersions('/interval.txt');
            expect(versions).toHaveLength(2);
            expect(versions[0].content).toBe('c');
        });

        it('should defer snapshots until flush in on-close mode', async () => {
            window.EphemeraState.settings.fileHistoryMode = 'on-close';

            await EphemeraFS.writeFile('/onclose.txt', 'before');
            await EphemeraFS.writeFile('/onclose.txt', 'after');

            expect(await EphemeraFS.getFileVersions('/onclose.txt')).toHaveLength(0);
            const flushed = await EphemeraFS.flushPendingSnapshots();
            expect(flushed).toBe(1);

            const versions = await EphemeraFS.getFileVersions('/onclose.txt');
            expect(versions).toHaveLength(1);
            expect(versions[0].content).toBe('before');
        });

        it('should restore file content from a snapshot', async () => {
            await EphemeraFS.writeFile('/restore-version.txt', 'one');
            await EphemeraFS.writeFile('/restore-version.txt', 'two');
            await EphemeraFS.writeFile('/restore-version.txt', 'three');

            const versions = await EphemeraFS.getFileVersions('/restore-version.txt');
            const target = versions.find(v => v.content === 'one');
            expect(target).toBeTruthy();

            const restored = await EphemeraFS.restoreFileVersion(target.id);
            expect(restored).toBe(true);
            expect(await EphemeraFS.readFile('/restore-version.txt')).toBe('one');

            const afterVersions = await EphemeraFS.getFileVersions('/restore-version.txt');
            expect(afterVersions.some(v => v.content === 'three')).toBe(true);
        });

        it('should relink history when moving files', async () => {
            await EphemeraFS.writeFile('/old-name.txt', 'alpha');
            await EphemeraFS.writeFile('/old-name.txt', 'beta');

            await EphemeraFS.move('/old-name.txt', '/new-name.txt');

            const oldPathVersions = await EphemeraFS.getFileVersions('/old-name.txt');
            const newPathVersions = await EphemeraFS.getFileVersions('/new-name.txt');
            expect(oldPathVersions).toHaveLength(0);
            expect(newPathVersions.some(v => v.content === 'alpha')).toBe(true);
        });
    });

    // --- Directory operations ---

    describe('ensureDir', () => {
        it('should create nested directories', async () => {
            await EphemeraFS.ensureDir('/a/b/c');
            expect(await EphemeraFS.exists('/a')).toBe(true);
            expect(await EphemeraFS.exists('/a/b')).toBe(true);
            expect(await EphemeraFS.exists('/a/b/c')).toBe(true);
        });

        it('should be idempotent', async () => {
            await EphemeraFS.ensureDir('/mydir');
            await EphemeraFS.ensureDir('/mydir');
            const stat = await EphemeraFS.stat('/mydir');
            expect(stat.type).toBe('directory');
        });

        it('should do nothing for root', async () => {
            await EphemeraFS.ensureDir('/');
            // Should not throw
        });
    });

    describe('mkdir', () => {
        it('should create a directory and emit event', async () => {
            await EphemeraFS.mkdir('/newdir');
            expect(await EphemeraFS.exists('/newdir')).toBe(true);
            expect(eventsMock.emit).toHaveBeenCalledWith('fs:changed', { type: 'mkdir', path: '/newdir' });
        });
    });

    describe('readdir', () => {
        it('should list directory contents', async () => {
            await EphemeraFS.writeFile('/dir/a.txt', 'a');
            await EphemeraFS.writeFile('/dir/b.txt', 'b');
            const entries = await EphemeraFS.readdir('/dir');
            const names = entries.map(e => e.name);
            expect(names).toContain('a.txt');
            expect(names).toContain('b.txt');
        });

        it('should sort directories before files', async () => {
            await EphemeraFS.writeFile('/dir/file.txt', 'data');
            await EphemeraFS.mkdir('/dir/subdir');
            const entries = await EphemeraFS.readdir('/dir');
            expect(entries[0].type).toBe('directory');
            expect(entries[1].type).toBe('file');
        });

        it('should return empty array for empty directory', async () => {
            await EphemeraFS.mkdir('/empty');
            const entries = await EphemeraFS.readdir('/empty');
            expect(entries).toEqual([]);
        });
    });

    // --- exists / stat ---

    describe('exists', () => {
        it('should return true for existing file', async () => {
            await EphemeraFS.writeFile('/exists.txt', 'yes');
            expect(await EphemeraFS.exists('/exists.txt')).toBe(true);
        });

        it('should return false for nonexistent file', async () => {
            expect(await EphemeraFS.exists('/nope.txt')).toBe(false);
        });

        it('should return true for directory', async () => {
            await EphemeraFS.mkdir('/mydir');
            expect(await EphemeraFS.exists('/mydir')).toBe(true);
        });
    });

    describe('stat', () => {
        it('should return file metadata', async () => {
            await EphemeraFS.writeFile('/file.js', 'console.log("hi")');
            const stat = await EphemeraFS.stat('/file.js');
            expect(stat.type).toBe('file');
            expect(stat.name).toBe('file.js');
            expect(stat.extension).toBe('js');
        });

        it('should return undefined for nonexistent path', async () => {
            const stat = await EphemeraFS.stat('/does-not-exist');
            expect(stat).toBeUndefined();
        });
    });

    // --- Delete / trash ---

    describe('delete (trash)', () => {
        it('should move file to trash', async () => {
            await EphemeraFS.mkdir('/home/user/.trash');
            await EphemeraFS.writeFile('/home/user/deleteme.txt', 'bye');
            const result = await EphemeraFS.delete('/home/user/deleteme.txt');
            expect(result).toBe(true);
            expect(await EphemeraFS.exists('/home/user/deleteme.txt')).toBe(false);

            const trash = await EphemeraFS.readdir('/home/user/.trash');
            expect(trash.length).toBe(1);
            expect(trash[0]._originalPath).toBe('/home/user/deleteme.txt');
        });

        it('should return false for nonexistent file', async () => {
            const result = await EphemeraFS.delete('/nonexistent.txt');
            expect(result).toBe(false);
        });

        it('should emit fs:changed on delete', async () => {
            await EphemeraFS.mkdir('/home/user/.trash');
            await EphemeraFS.writeFile('/home/user/todelete.txt', 'data');
            vi.clearAllMocks();
            await EphemeraFS.delete('/home/user/todelete.txt');
            expect(eventsMock.emit).toHaveBeenCalledWith('fs:changed', expect.objectContaining({ type: 'delete' }));
        });
    });

    describe('permanentDelete', () => {
        it('should permanently remove a file', async () => {
            await EphemeraFS.writeFile('/permanent.txt', 'gone');
            const result = await EphemeraFS.permanentDelete('/permanent.txt');
            expect(result).toBe(true);
            expect(await EphemeraFS.exists('/permanent.txt')).toBe(false);
        });

        it('should recursively delete directories', async () => {
            await EphemeraFS.writeFile('/dir/a.txt', 'a');
            await EphemeraFS.writeFile('/dir/b.txt', 'b');
            await EphemeraFS.permanentDelete('/dir');
            expect(await EphemeraFS.exists('/dir')).toBe(false);
            expect(await EphemeraFS.exists('/dir/a.txt')).toBe(false);
            expect(await EphemeraFS.exists('/dir/b.txt')).toBe(false);
        });

        it('should return false for nonexistent path', async () => {
            const result = await EphemeraFS.permanentDelete('/nope');
            expect(result).toBe(false);
        });
    });

    describe('restore', () => {
        it('should restore trashed file to original location', async () => {
            await EphemeraFS.mkdir('/home/user/.trash');
            await EphemeraFS.writeFile('/home/user/restore-me.txt', 'important');
            await EphemeraFS.delete('/home/user/restore-me.txt');

            const trash = await EphemeraFS.readdir('/home/user/.trash');
            expect(trash.length).toBe(1);

            const restored = await EphemeraFS.restore(trash[0].path);
            expect(restored).toBe(true);
            expect(await EphemeraFS.exists('/home/user/restore-me.txt')).toBe(true);
            const content = await EphemeraFS.readFile('/home/user/restore-me.txt');
            expect(content).toBe('important');
        });

        it('should return false for nonexistent trash path', async () => {
            const result = await EphemeraFS.restore('/home/user/.trash/nope');
            expect(result).toBe(false);
        });

        it('should return false if no _originalPath', async () => {
            await EphemeraFS.writeFile('/home/user/.trash/orphan.txt', 'data');
            const result = await EphemeraFS.restore('/home/user/.trash/orphan.txt');
            expect(result).toBe(false);
        });
    });

    // --- move / copy ---

    describe('move', () => {
        it('should move a file', async () => {
            await EphemeraFS.writeFile('/source.txt', 'moving');
            await EphemeraFS.move('/source.txt', '/dest.txt');
            expect(await EphemeraFS.exists('/source.txt')).toBe(false);
            expect(await EphemeraFS.readFile('/dest.txt')).toBe('moving');
        });

        it('should throw for nonexistent source', async () => {
            await expect(EphemeraFS.move('/nope.txt', '/dest.txt')).rejects.toThrow('File not found');
        });

        it('should emit fs:changed on move', async () => {
            await EphemeraFS.writeFile('/mv-src.txt', 'data');
            vi.clearAllMocks();
            await EphemeraFS.move('/mv-src.txt', '/mv-dst.txt');
            expect(eventsMock.emit).toHaveBeenCalledWith('fs:changed', expect.objectContaining({ type: 'move' }));
        });
    });

    describe('copy', () => {
        it('should copy a file', async () => {
            await EphemeraFS.writeFile('/original.txt', 'copy me');
            await EphemeraFS.copy('/original.txt', '/copied.txt');
            expect(await EphemeraFS.readFile('/original.txt')).toBe('copy me');
            expect(await EphemeraFS.readFile('/copied.txt')).toBe('copy me');
        });

        it('should throw for nonexistent source', async () => {
            await expect(EphemeraFS.copy('/nope.txt', '/dest.txt')).rejects.toThrow('File not found');
        });

        it('should emit fs:changed on copy', async () => {
            await EphemeraFS.writeFile('/cp-src.txt', 'data');
            vi.clearAllMocks();
            await EphemeraFS.copy('/cp-src.txt', '/cp-dst.txt');
            expect(eventsMock.emit).toHaveBeenCalledWith('fs:changed', expect.objectContaining({ type: 'copy' }));
        });
    });

    // --- search ---

    describe('search', () => {
        it('should find files by path', async () => {
            await EphemeraFS.writeFile('/docs/readme.md', '# Hello');
            await EphemeraFS.writeFile('/docs/guide.md', '# Guide');
            const results = await EphemeraFS.search('readme');
            expect(results.some(r => r.path === '/docs/readme.md')).toBe(true);
        });

        it('uses fs worker search when available', async () => {
            await EphemeraFS.writeFile('/docs/worker-target.md', '# Worker');
            const originalWorker = window.EphemeraFsWorker;
            window.EphemeraFsWorker = {
                searchFiles: vi.fn(async () => [{ path: '/docs/worker-target.md', type: 'file' }])
            };

            try {
                const results = await EphemeraFS.search('worker-target');
                expect(window.EphemeraFsWorker.searchFiles).toHaveBeenCalledTimes(1);
                expect(results[0].path).toBe('/docs/worker-target.md');
            } finally {
                window.EphemeraFsWorker = originalWorker;
            }
        });

        it('falls back to main-thread search when fs worker fails', async () => {
            await EphemeraFS.writeFile('/docs/fallback-note.md', 'main thread fallback');
            const originalWorker = window.EphemeraFsWorker;
            window.EphemeraFsWorker = {
                searchFiles: vi.fn(async () => {
                    throw new Error('worker failure');
                })
            };

            try {
                const results = await EphemeraFS.search('fallback-note');
                expect(results.some(r => r.path === '/docs/fallback-note.md')).toBe(true);
            } finally {
                window.EphemeraFsWorker = originalWorker;
            }
        });

        it('should find files by content', async () => {
            await EphemeraFS.writeFile('/data/secret.txt', 'hidden treasure');
            const results = await EphemeraFS.search('treasure');
            expect(results.some(r => r.path === '/data/secret.txt' && r.matchType === 'content')).toBe(true);
        });

        it('should limit results to MAX_RESULTS (20)', async () => {
            for (let i = 0; i < 25; i++) {
                await EphemeraFS.writeFile(`/many/match_${i}.txt`, 'data');
            }
            const results = await EphemeraFS.search('match_');
            expect(results.length).toBeLessThanOrEqual(20);
        });

        it('should be case insensitive', async () => {
            await EphemeraFS.writeFile('/CamelCase.txt', 'data');
            const results = await EphemeraFS.search('camelcase');
            expect(results.length).toBeGreaterThan(0);
        });
    });

    // --- getIcon ---

    describe('getIcon', () => {
        it('should return folder icon for directories', () => {
            const icon = EphemeraFS.getIcon({ type: 'directory' });
            expect(icon).toContain('svg');
        });

        it('should return specific icon for known extensions', () => {
            const jsIcon = EphemeraFS.getIcon({ type: 'file', extension: 'js', path: '/test.js' });
            expect(jsIcon).toContain('JS');
        });

        it('should return generic file icon for unknown extensions', () => {
            const icon = EphemeraFS.getIcon({ type: 'file', extension: 'xyz', path: '/test.xyz' });
            expect(icon).toContain('svg');
        });
    });
});
