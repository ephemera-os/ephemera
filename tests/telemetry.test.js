import * as Sentry from '@sentry/browser';
import '../js/core/telemetry.js';

describe('EphemeraTelemetry flow grouping', () => {
    let scope;

    beforeEach(() => {
        scope = {
            setTag: vi.fn(),
            setExtra: vi.fn(),
            setLevel: vi.fn(),
            setFingerprint: vi.fn(),
            setContext: vi.fn()
        };

        Sentry.init.mockClear();
        Sentry.captureException.mockClear();
        Sentry.captureMessage.mockClear();
        Sentry.withScope.mockImplementation((cb) => cb(scope));

        window.EphemeraTelemetry._resetForTests();
        window.EphemeraTelemetry.init({
            dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
            environment: 'test',
            release: '2.0.0-test'
        });
    });

    afterEach(() => {
        window.EphemeraTelemetry._resetForTests();
    });

    it('groups exceptions by inferred user flow and signature', () => {
        const error = new Error('Sync push failed for /home/user/docs.txt');
        window.EphemeraTelemetry.captureException(error, {
            tags: { component: 'sync-manager' },
            extra: { source: 'js/system/sync-manager.js', operation: 'push' }
        });

        expect(scope.setTag).toHaveBeenCalledWith('flow', 'sync');
        expect(scope.setFingerprint).toHaveBeenCalledWith([
            'flow:sync',
            expect.stringMatching(/^sig:/)
        ]);
        expect(scope.setContext).toHaveBeenCalledWith(
            'ephemera_flow',
            expect.objectContaining({ flow: 'sync' })
        );
        expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('respects explicit flow and grouping hints', () => {
        window.EphemeraTelemetry.captureMessage('Session unlock failed', 'error', {
            flow: 'auth',
            group: 'unlock',
            flowImpact: 'blocking',
            tags: { component: 'session' }
        });

        expect(scope.setTag).toHaveBeenCalledWith('flow', 'auth');
        expect(scope.setTag).toHaveBeenCalledWith('impact', 'blocking');
        expect(scope.setFingerprint).toHaveBeenCalledWith(['flow:auth', 'sig:unlock']);
        expect(Sentry.captureMessage).toHaveBeenCalledWith('Session unlock failed');
    });

    it('falls back to unknown flow when no hints are available', () => {
        window.EphemeraTelemetry.captureException(new Error('Unexpected failure'), {
            extra: { detail: 'misc' }
        });

        expect(scope.setTag).toHaveBeenCalledWith('flow', 'unknown');
        expect(scope.setFingerprint).toHaveBeenCalledWith([
            'flow:unknown',
            expect.stringMatching(/^sig:/)
        ]);
    });
});
