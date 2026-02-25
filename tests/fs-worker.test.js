describe('EphemeraFsWorker', () => {
    let fsWorker;
    let originalWorker;

    beforeEach(async () => {
        originalWorker = global.Worker;
        class MockWorker {
            constructor() {
                this.onmessage = null;
                this.onerror = null;
            }

            postMessage(message) {
                setTimeout(() => {
                    if (message.op === 'search-files') {
                        this.onmessage?.({
                            data: {
                                id: message.id,
                                ok: true,
                                result: [{ path: '/mock.txt', type: 'file' }]
                            }
                        });
                        return;
                    }
                    this.onmessage?.({
                        data: {
                            id: message.id,
                            ok: false,
                            error: 'unsupported'
                        }
                    });
                }, 0);
            }

            terminate() {}
        }

        global.Worker = MockWorker;

        if (!window.EphemeraFsWorker) {
            await import('../js/system/fs-worker.js');
        }

        fsWorker = window.EphemeraFsWorker;
        fsWorker._resetForTests();
    });

    afterEach(() => {
        fsWorker?._resetForTests?.();
        global.Worker = originalWorker;
    });

    it('initializes and routes search requests through the worker', async () => {
        expect(fsWorker.init()).toBe(true);
        const results = await fsWorker.searchFiles('mock', '/', { maxResults: 5, dbName: 'EphemeraFS_default', dbVersion: 4 });
        expect(Array.isArray(results)).toBe(true);
        expect(results[0].path).toBe('/mock.txt');
    });

    it('reports unsupported when Worker is unavailable', async () => {
        fsWorker._resetForTests();
        global.Worker = undefined;
        expect(fsWorker.init()).toBe(false);
        await expect(fsWorker.searchFiles('x')).rejects.toThrow('FS worker is unavailable');
    });
});
