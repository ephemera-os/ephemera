describe('EphemeraExportWorker', () => {
    let exportWorker;
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
                    if (message.op === 'serialize-export') {
                        const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
                        this.onmessage?.({
                            data: {
                                id: message.id,
                                ok: true,
                                result: {
                                    buffer,
                                    compressed: true,
                                    mimeType: 'application/gzip',
                                    extension: 'json.gz'
                                }
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

        if (!window.EphemeraExportWorker) {
            await import('../js/system/export-worker.js');
        }

        exportWorker = window.EphemeraExportWorker;
        exportWorker._resetForTests();
    });

    afterEach(() => {
        exportWorker?._resetForTests?.();
        global.Worker = originalWorker;
    });

    it('initializes and routes serialization requests through the worker', async () => {
        expect(exportWorker.init()).toBe(true);
        const result = await exportWorker.serializeExport({ hello: 'world' }, { compress: true });

        expect(result.compressed).toBe(true);
        expect(result.mimeType).toBe('application/gzip');
        expect(result.extension).toBe('json.gz');
        expect(result.bytes).toBeInstanceOf(Uint8Array);
        expect(result.bytes.byteLength).toBeGreaterThan(0);
    });

    it('reports unsupported when Worker is unavailable', async () => {
        exportWorker._resetForTests();
        global.Worker = undefined;

        expect(exportWorker.init()).toBe(false);
        await expect(exportWorker.serializeExport({})).rejects.toThrow('Export worker is unavailable');
    });
});
