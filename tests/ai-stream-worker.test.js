describe('EphemeraAIStreamWorker', () => {
    let aiStreamWorker;
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
                    if (message.op === 'process-chunk') {
                        this.onmessage?.({
                            data: {
                                id: message.id,
                                ok: true,
                                result: {
                                    events: [{ type: 'content', content: 'chunk' }]
                                }
                            }
                        });
                        return;
                    }

                    if (message.op === 'flush-session') {
                        this.onmessage?.({
                            data: {
                                id: message.id,
                                ok: true,
                                result: {
                                    events: [{ type: 'usage', usage: { total_tokens: 3 } }]
                                }
                            }
                        });
                        return;
                    }

                    if (message.op === 'close-session') {
                        this.onmessage?.({
                            data: {
                                id: message.id,
                                ok: true,
                                result: { closed: true }
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

        if (!window.EphemeraAIStreamWorker) {
            await import('../js/system/ai-stream-worker.js');
        }

        aiStreamWorker = window.EphemeraAIStreamWorker;
        aiStreamWorker._resetForTests();
    });

    afterEach(() => {
        aiStreamWorker?._resetForTests?.();
        global.Worker = originalWorker;
    });

    it('creates session and parses stream chunks through worker', async () => {
        expect(aiStreamWorker.init()).toBe(true);
        const sessionId = aiStreamWorker.createSession();
        expect(sessionId).toMatch(/^ai-stream-/);

        const parsed = await aiStreamWorker.parseChunk(sessionId, 'data: ...');
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed[0]).toEqual({ type: 'content', content: 'chunk' });

        const flushed = await aiStreamWorker.flushSession(sessionId);
        expect(flushed[0]).toEqual({ type: 'usage', usage: { total_tokens: 3 } });

        await expect(aiStreamWorker.closeSession(sessionId)).resolves.toBe(true);
    });

    it('reports unsupported when Worker is unavailable', async () => {
        aiStreamWorker._resetForTests();
        global.Worker = undefined;

        expect(aiStreamWorker.init()).toBe(false);
        expect(() => aiStreamWorker.createSession()).toThrow('AI stream worker is unavailable');
    });
});
