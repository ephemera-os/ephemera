import { eventsMock } from './setup.js';

describe('EphemeraStorageQuota', () => {
    let quota;
    let persisted;

    beforeEach(async () => {
        eventsMock._reset();
        if (!window.EphemeraStorageQuota) {
            await import('../js/system/storage-quota.js');
        }

        quota = window.EphemeraStorageQuota;
        quota._resetForTests();

        persisted = false;
        window.navigator.storage = {
            estimate: vi.fn(async () => ({
                usage: 10 * 1024 * 1024,
                quota: 100 * 1024 * 1024
            })),
            persisted: vi.fn(async () => persisted),
            persist: vi.fn(async () => {
                persisted = true;
                return true;
            })
        };

        window.EphemeraNotifications.warning.mockClear();
        window.EphemeraNotifications.success.mockClear();
        window.EphemeraNotifications.error.mockClear();

        quota.start();
    });

    afterEach(() => {
        quota._resetForTests();
    });

    it('returns quota summary metrics', async () => {
        const summary = await quota.checkQuota({ silent: true });

        expect(summary.usageBytes).toBe(10 * 1024 * 1024);
        expect(summary.quotaBytes).toBe(100 * 1024 * 1024);
        expect(summary.overThreshold).toBe(false);
        expect(summary.usagePercent).toBeCloseTo(10, 5);
    });

    it('shows warning when usage crosses 80% and honors cooldown', async () => {
        window.navigator.storage.estimate = vi.fn(async () => ({
            usage: 90 * 1024 * 1024,
            quota: 100 * 1024 * 1024
        }));

        await quota.checkQuota();
        await quota.checkQuota();

        expect(window.EphemeraNotifications.warning).toHaveBeenCalledTimes(1);

        await quota.checkQuota({ forceWarning: true });
        expect(window.EphemeraNotifications.warning).toHaveBeenCalledTimes(2);
    });

    it('requests persistent storage and reports granted status', async () => {
        const result = await quota.requestPersistentStorage();

        expect(result.supported).toBe(true);
        expect(result.granted).toBe(true);
        expect(result.persisted).toBe(true);
        expect(window.EphemeraNotifications.success).toHaveBeenCalled();
    });

    it('handles browsers without persistent storage support', async () => {
        window.navigator.storage = {
            estimate: vi.fn(async () => ({ usage: 0, quota: 0 }))
        };

        expect(quota.isPersistenceSupported()).toBe(false);
        const result = await quota.requestPersistentStorage({ silent: true });
        expect(result.supported).toBe(false);
        expect(result.granted).toBe(false);
    });
});
