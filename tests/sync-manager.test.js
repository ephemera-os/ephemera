import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventsMock, stateMock } from './setup.js';

import '../js/system/sync-manager.js';

const EphemeraSyncManager = window.EphemeraSyncManager;

function resetSyncManagerForTests() {
    if (EphemeraSyncManager._debounceTimer) {
        clearTimeout(EphemeraSyncManager._debounceTimer);
    }
    EphemeraSyncManager._provider = null;
    EphemeraSyncManager._providerName = 'none';
    EphemeraSyncManager._status = 'idle';
    EphemeraSyncManager._error = null;
    EphemeraSyncManager._debounceTimer = null;
    EphemeraSyncManager._pendingChanges = new Map();
    EphemeraSyncManager._syncing = false;
}

function createMockProvider(overrides = {}) {
    return {
        list: vi.fn(async () => []),
        pull: vi.fn(async () => ({ content: '', mimeType: 'text/plain', modifiedAt: Date.now() })),
        push: vi.fn(async () => {}),
        delete: vi.fn(async () => {}),
        mkdir: vi.fn(async () => {}),
        testConnection: vi.fn(async () => true),
        ...overrides
    };
}

async function flushAsync(iterations = 3) {
    for (let i = 0; i < iterations; i++) {
        await Promise.resolve();
    }
}

describe('EphemeraSyncManager', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        eventsMock._reset();
        eventsMock.emit.mockClear();
        stateMock._reset();
        stateMock.updateSetting.mockClear();

        window.EphemeraStorage = {
            get: vi.fn(async () => null),
            getAll: vi.fn(async () => []),
            put: vi.fn(async () => {})
        };
        globalThis.EphemeraStorage = window.EphemeraStorage;

        window.EphemeraFS = {
            writeFile: vi.fn(async () => ({})),
            exists: vi.fn(async () => false),
            isTextFile: vi.fn(() => false),
            getMimeType: vi.fn(() => 'application/octet-stream')
        };
        globalThis.EphemeraFS = window.EphemeraFS;

        const lockHandlers = [];
        const unlockHandlers = [];
        window.EphemeraSession = {
            onLock: vi.fn((cb) => lockHandlers.push(cb)),
            onUnlock: vi.fn((cb) => unlockHandlers.push(cb)),
            isLocked: vi.fn(() => false),
            _lockHandlers: lockHandlers,
            _unlockHandlers: unlockHandlers
        };
        globalThis.EphemeraSession = window.EphemeraSession;

        window.EphemeraRestProvider = vi.fn(() => createMockProvider());
        globalThis.EphemeraRestProvider = window.EphemeraRestProvider;

        resetSyncManagerForTests();
    });

    afterEach(() => {
        resetSyncManagerForTests();
        vi.runOnlyPendingTimers();
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('re-initializes the REST provider after unlock following lock teardown', async () => {
        stateMock.settings.syncProvider = 'rest';
        stateMock.settings.syncAutoEnabled = false;
        stateMock.settings.syncRestUrl = 'http://localhost:3001';
        window.EphemeraStorage.get.mockImplementation(async (_store, key) => {
            if (key === 'syncRestToken') return { value: 'test-token' };
            return null;
        });

        await EphemeraSyncManager.init();
        expect(window.EphemeraRestProvider).toHaveBeenCalledTimes(1);
        expect(window.EphemeraRestProvider).toHaveBeenCalledWith('http://localhost:3001', 'test-token');
        expect(window.EphemeraSession._lockHandlers).toHaveLength(1);
        expect(window.EphemeraSession._unlockHandlers).toHaveLength(1);

        window.EphemeraSession._lockHandlers[0]();
        expect(EphemeraSyncManager._provider).toBeNull();

        window.EphemeraSession._unlockHandlers[0]();
        await flushAsync();
        expect(window.EphemeraRestProvider).toHaveBeenCalledTimes(2);
        expect(EphemeraSyncManager._provider).toBeTruthy();
    });

    it('keeps binary payloads as ArrayBuffer when pulling non-text files', async () => {
        const binaryPayload = new Uint8Array([0, 255, 17, 42]).buffer;
        const path = '/home/testuser/Pictures/photo.png';

        window.EphemeraStorage.getAll.mockResolvedValue([]);
        EphemeraSyncManager._providerName = 'rest';
        EphemeraSyncManager._provider = createMockProvider({
            list: vi.fn(async () => [{ path, type: 'file', modifiedAt: 2000 }]),
            pull: vi.fn(async () => ({ content: binaryPayload, mimeType: 'application/octet-stream', modifiedAt: 2000 }))
        });

        await EphemeraSyncManager.syncAll();

        expect(window.EphemeraFS.writeFile).toHaveBeenCalledTimes(1);
        const [writtenPath, writtenContent, metadata] = window.EphemeraFS.writeFile.mock.calls[0];
        expect(writtenPath).toBe(path);
        expect(writtenContent instanceof ArrayBuffer).toBe(true);
        expect(Array.from(new Uint8Array(writtenContent))).toEqual([0, 255, 17, 42]);
        expect(metadata.mimeType).toBe('application/octet-stream');
        expect(stateMock.updateSetting).toHaveBeenCalledWith('syncLastAt', expect.any(Number));
    });

    it('creates a conflict copy before applying a newer remote version', async () => {
        const path = '/home/testuser/Documents/notes.txt';
        const localFile = {
            path,
            type: 'file',
            content: 'local edits',
            mimeType: 'text/plain',
            createdAt: 900,
            modifiedAt: 1000
        };

        window.EphemeraStorage.getAll.mockResolvedValue([localFile]);
        window.EphemeraFS.exists.mockResolvedValue(false);
        window.EphemeraFS.isTextFile.mockReturnValue(true);
        window.EphemeraFS.getMimeType.mockReturnValue('text/plain');

        EphemeraSyncManager._providerName = 'rest';
        EphemeraSyncManager._provider = createMockProvider({
            list: vi.fn(async () => [{ path, type: 'file', modifiedAt: 2000 }]),
            pull: vi.fn(async () => ({ content: 'remote edits', mimeType: 'text/plain', modifiedAt: 2000 }))
        });

        await EphemeraSyncManager.syncAll();

        expect(window.EphemeraFS.writeFile).toHaveBeenCalledTimes(2);
        const [conflictPath, conflictContent] = window.EphemeraFS.writeFile.mock.calls[0];
        const [finalPath, finalContent] = window.EphemeraFS.writeFile.mock.calls[1];

        expect(conflictPath).toContain('/notes.conflict-');
        expect(conflictContent).toBe('local edits');
        expect(finalPath).toBe(path);
        expect(finalContent).toBe('remote edits');

        const conflictEvents = eventsMock.emit.mock.calls.filter(([eventName]) => eventName === 'sync:conflict');
        expect(conflictEvents).toHaveLength(1);
        expect(conflictEvents[0][1].path).toBe(path);
        expect(conflictEvents[0][1].conflictPath).toContain('/notes.conflict-');
    });
});
