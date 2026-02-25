import { beforeEach, describe, expect, it } from 'vitest';
import { mockIDB, sessionMock } from './setup.js';
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

describe('EphemeraFS performance', () => {
    beforeEach(async () => {
        sessionMock._setUnlocked(true, { type: 'secret' });
        await initStorage();
    });

    it('searches a 200-file dataset in under 50ms', async () => {
        for (let i = 0; i < 200; i++) {
            await EphemeraFS.writeFile(`/bench/file_${i}.txt`, `content ${i}`);
        }
        await EphemeraFS.writeFile('/bench/special_readme.md', 'important note');

        const start = performance.now();
        const results = await EphemeraFS.search('special_readme');
        const duration = performance.now() - start;

        expect(results.some((r) => r.path === '/bench/special_readme.md')).toBe(true);
        expect(duration).toBeLessThan(50);
    });
});
