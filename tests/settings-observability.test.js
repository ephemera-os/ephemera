import { beforeEach, describe, expect, it, vi } from 'vitest';

let settingsDef;
let metricsState;
let eventBus;

function createLifecycleStub() {
    return {
        addListener(target, type, handler, options) {
            target.addEventListener(type, handler, options);
            return handler;
        },
        addSubscription(unsubscribe) {
            return unsubscribe;
        },
        destroy() {}
    };
}

function createEventBus() {
    const listeners = new Map();
    return {
        on: vi.fn((event, handler) => {
            const list = listeners.get(event) || [];
            list.push(handler);
            listeners.set(event, list);
            return () => {
                const current = listeners.get(event) || [];
                listeners.set(event, current.filter((fn) => fn !== handler));
            };
        }),
        emit(event, payload) {
            const list = listeners.get(event) || [];
            list.forEach((handler) => handler(payload));
        }
    };
}

function mountSettings(windowId = '17', section = 'observability') {
    const view = settingsDef.content(windowId, { section });
    document.body.innerHTML = `<div class="window-content">${view.html}</div>`;
    view.init();
}

describe('Settings observability section', () => {
    beforeEach(async () => {
        vi.resetModules();
        settingsDef = null;
        metricsState = {
            'app.open_ms': {
                metric: 'app.open_ms',
                count: 4,
                p50Ms: 12,
                p95Ms: 22,
                p99Ms: 30,
                updatedAt: Date.now() - 2000
            },
            'file.save_ms': {
                metric: 'file.save_ms',
                count: 7,
                p50Ms: 4,
                p95Ms: 9,
                p99Ms: 14,
                updatedAt: Date.now() - 1000
            }
        };

        eventBus = createEventBus();
        window.EphemeraEvents = eventBus;
        global.EphemeraEvents = eventBus;

        window.EphemeraApps = {
            register: vi.fn((app) => {
                if (app.id === 'settings') settingsDef = app;
                return app;
            })
        };
        global.EphemeraApps = window.EphemeraApps;
        window.createAppLifecycle = createLifecycleStub;
        global.createAppLifecycle = createLifecycleStub;

        window.EphemeraPerformance = {
            isEnabled: vi.fn(() => true),
            getAllMetrics: vi.fn(() => ({ ...metricsState })),
            clear: vi.fn(() => {
                metricsState = {};
            })
        };
        global.EphemeraPerformance = window.EphemeraPerformance;

        window.EphemeraTelemetry = {
            isEnabled: vi.fn(() => true)
        };
        global.EphemeraTelemetry = window.EphemeraTelemetry;

        window.EphemeraDialog = {
            confirm: vi.fn(async () => true)
        };
        global.EphemeraDialog = window.EphemeraDialog;

        window.EphemeraNotifications = {
            success: vi.fn(),
            error: vi.fn()
        };
        global.EphemeraNotifications = window.EphemeraNotifications;

        window.URL.createObjectURL = vi.fn(() => 'blob:metrics');
        window.URL.revokeObjectURL = vi.fn();

        await import('../js/apps/settings.js');
        expect(settingsDef).toBeTruthy();
    });

    it('renders observability metrics and supports reset', async () => {
        mountSettings();

        const navItem = document.querySelector('.settings-nav-item[data-section="observability"]');
        expect(navItem).toBeTruthy();

        const rows = document.querySelectorAll('#obs-metrics-body-17 tr[data-metric]');
        expect(rows.length).toBe(2);
        expect(document.getElementById('obs-metrics-count-17').textContent).toBe('2');

        const resetBtn = document.getElementById('obs-clear-17');
        resetBtn.click();
        await vi.waitFor(() => {
            expect(window.EphemeraPerformance.clear).toHaveBeenCalledTimes(1);
            expect(document.getElementById('obs-metrics-count-17').textContent).toBe('0');
        });
        expect(window.EphemeraNotifications.success).toHaveBeenCalledWith('Observability', 'Performance metrics reset.');
    });

    it('updates metrics table when performance events are emitted', () => {
        metricsState = {};
        mountSettings();
        expect(document.getElementById('obs-metrics-count-17').textContent).toBe('0');

        metricsState = {
            'ai.response_ms': {
                metric: 'ai.response_ms',
                count: 3,
                p50Ms: 80,
                p95Ms: 140,
                p99Ms: 180,
                updatedAt: Date.now()
            }
        };
        eventBus.emit('performance:metric', { metric: 'ai.response_ms' });

        const rows = document.querySelectorAll('#obs-metrics-body-17 tr[data-metric]');
        expect(rows.length).toBe(1);
        expect(rows[0].dataset.metric).toBe('ai.response_ms');
        expect(document.getElementById('obs-status-17').textContent).toContain('Live update');
    });
});
