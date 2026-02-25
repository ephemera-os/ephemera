import { eventsMock } from './setup.js';

describe('EphemeraPerformance', () => {
    let perf;

    beforeEach(async () => {
        if (!window.EphemeraPerformance) {
            await import('../js/core/performance-monitor.js');
        }

        perf = window.EphemeraPerformance;
        perf._resetForTests();
        perf.init({
            maxSamples: 64,
            breadcrumbIntervalMs: 999_999_999
        });

        eventsMock._reset();
        eventsMock.emit.mockClear();
        window.EphemeraTelemetry.addBreadcrumb.mockClear();
    });

    afterEach(() => {
        perf._resetForTests();
    });

    it('computes p50/p95/p99 summaries from collected metrics', () => {
        [10, 20, 30, 40, 50].forEach((value) => {
            perf.record('app.open_ms', value, { appId: 'notepad' });
        });

        const summary = perf.getMetric('app.open_ms');
        expect(summary).toMatchObject({
            metric: 'app.open_ms',
            count: 5,
            minMs: 10,
            maxMs: 50,
            p50Ms: 30,
            p95Ms: 50,
            p99Ms: 50
        });
        expect(summary.avgMs).toBe(30);

        const all = perf.getAllMetrics();
        expect(all['app.open_ms'].metric).toBe('app.open_ms');
    });

    it('measures async functions and emits performance events', async () => {
        const result = await perf.measure('ai.response_ms', async () => {
            await Promise.resolve();
            return 'ok';
        }, {
            provider: 'openai',
            token: 'super-secret-token'
        });

        expect(result).toBe('ok');

        expect(eventsMock.emit).toHaveBeenCalledWith(
            'performance:metric',
            expect.objectContaining({
                metric: 'ai.response_ms',
                durationMs: expect.any(Number)
            })
        );

        const eventPayload = eventsMock.emit.mock.calls.find((call) => call[0] === 'performance:metric')[1];
        expect(eventPayload.meta.token).toBe('[REDACTED]');
        expect(eventPayload.summary.meta.status).toBe('ok');

        expect(window.EphemeraTelemetry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'performance',
                message: 'ai.response_ms'
            })
        );
    });

    it('throttles telemetry breadcrumbs and redacts sensitive metadata', () => {
        for (let i = 0; i < 9; i++) {
            perf.record('file.save_ms', i + 1, {
                extension: 'txt',
                path: '/home/test/notes.txt'
            });
        }

        expect(window.EphemeraTelemetry.addBreadcrumb).toHaveBeenCalledTimes(1);

        perf.record('file.save_ms', 10, {
            extension: 'txt',
            path: '/home/test/notes.txt',
            apiKey: 'abc123'
        });

        expect(window.EphemeraTelemetry.addBreadcrumb).toHaveBeenCalledTimes(2);
        const latestBreadcrumb = window.EphemeraTelemetry.addBreadcrumb.mock.calls[1][0];
        expect(latestBreadcrumb.data.path).toBe('[REDACTED]');
        expect(latestBreadcrumb.data.apiKey).toBe('[REDACTED]');
    });
});
