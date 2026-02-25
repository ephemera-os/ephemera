const DEFAULT_WARNING_THRESHOLD = 0.8;
const DEFAULT_WARNING_COOLDOWN_MS = 10 * 60 * 1000;
const DEFAULT_MONITOR_INTERVAL_MS = 5 * 60 * 1000;
const CHANGE_DEBOUNCE_MS = 1000;

function toSafeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

const EphemeraStorageQuota = {
    WARNING_THRESHOLD: DEFAULT_WARNING_THRESHOLD,
    WARNING_COOLDOWN_MS: DEFAULT_WARNING_COOLDOWN_MS,
    MONITOR_INTERVAL_MS: DEFAULT_MONITOR_INTERVAL_MS,
    _started: false,
    _intervalId: null,
    _debounceTimer: null,
    _unbinders: [],
    _lastWarningAt: 0,
    _lastUsageRatio: 0,
    _lastSummary: null,

    formatBytes(bytes) {
        const value = toSafeNumber(bytes);
        if (value === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const index = Math.min(
            units.length - 1,
            Math.floor(Math.log(value) / Math.log(1024))
        );
        const scaled = value / Math.pow(1024, index);
        return `${scaled.toFixed(scaled >= 100 || index === 0 ? 0 : 2)} ${units[index]}`;
    },

    async _estimateStorage() {
        try {
            if (window.EphemeraStorage?.getStorageEstimate) {
                const result = await window.EphemeraStorage.getStorageEstimate();
                if (result && typeof result === 'object') return result;
            }
        } catch (_error) {
            // Ignore and continue with navigator fallback.
        }

        try {
            if (window.navigator?.storage?.estimate) {
                const result = await window.navigator.storage.estimate();
                if (result && typeof result === 'object') return result;
            }
        } catch (_error) {
            // Ignore estimate failures.
        }

        return { usage: 0, quota: 0 };
    },

    _toSummary(rawEstimate = {}) {
        const usageBytes = toSafeNumber(rawEstimate.usage);
        const quotaBytes = toSafeNumber(rawEstimate.quota);
        const usageRatio = quotaBytes > 0 ? Math.min(1, usageBytes / quotaBytes) : 0;
        const usagePercent = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;

        return {
            usageBytes,
            quotaBytes,
            freeBytes: Math.max(0, quotaBytes - usageBytes),
            usageRatio,
            usagePercent,
            thresholdRatio: this.WARNING_THRESHOLD,
            thresholdPercent: this.WARNING_THRESHOLD * 100,
            overThreshold: quotaBytes > 0 && usageRatio >= this.WARNING_THRESHOLD,
            measuredAt: Date.now()
        };
    },

    _emitUpdate(summary) {
        window.EphemeraEvents?.emit?.('storage:quota:update', summary);
    },

    _maybeWarn(summary, options = {}) {
        if (options.silent === true) return;
        if (!summary?.overThreshold) return;

        const now = Date.now();
        const cooldownElapsed = now - this._lastWarningAt >= this.WARNING_COOLDOWN_MS;
        const crossedThreshold = this._lastUsageRatio < this.WARNING_THRESHOLD;
        const shouldWarn = options.forceWarning === true || crossedThreshold || cooldownElapsed;
        if (!shouldWarn) return;

        this._lastWarningAt = now;
        window.EphemeraEvents?.emit?.('storage:quota:warning', summary);
        if (window.EphemeraNotifications?.warning) {
            window.EphemeraNotifications.warning(
                'Storage Nearly Full',
                `Using ${this.formatBytes(summary.usageBytes)} of ${this.formatBytes(summary.quotaBytes)} (${summary.usagePercent.toFixed(1)}%). Open Settings > About or Data to clean up.`
            );
        }
    },

    async checkQuota(options = {}) {
        const rawEstimate = await this._estimateStorage();
        const summary = this._toSummary(rawEstimate);
        this._lastSummary = summary;
        this._emitUpdate(summary);
        this._maybeWarn(summary, options);
        this._lastUsageRatio = summary.usageRatio;
        return summary;
    },

    getLastSummary() {
        return this._lastSummary;
    },

    async getStatus(options = {}) {
        if (options.refresh === true || !this._lastSummary) {
            return this.checkQuota({ silent: true });
        }
        return this._lastSummary;
    },

    isPersistenceSupported() {
        const storage = window.navigator?.storage;
        return Boolean(
            storage &&
            typeof storage.persist === 'function' &&
            typeof storage.persisted === 'function'
        );
    },

    async isPersisted() {
        if (!this.isPersistenceSupported()) return false;
        try {
            return Boolean(await window.navigator.storage.persisted());
        } catch (_error) {
            return false;
        }
    },

    async requestPersistentStorage(options = {}) {
        if (!this.isPersistenceSupported()) {
            if (options.silent !== true) {
                window.EphemeraNotifications?.warning?.(
                    'Not Supported',
                    'Persistent storage is not supported by this browser.'
                );
            }
            return {
                supported: false,
                granted: false,
                persisted: false
            };
        }

        try {
            const granted = Boolean(await window.navigator.storage.persist());
            const persisted = await this.isPersisted();
            if (options.silent !== true) {
                if (granted || persisted) {
                    window.EphemeraNotifications?.success?.(
                        'Persistent Storage Enabled',
                        'Browser storage persistence has been granted.'
                    );
                } else {
                    window.EphemeraNotifications?.warning?.(
                        'Persistent Storage Not Granted',
                        'The browser denied persistent storage. Data can still be evicted under pressure.'
                    );
                }
            }
            return {
                supported: true,
                granted,
                persisted
            };
        } catch (error) {
            const message = error?.message || 'Failed to request persistent storage.';
            if (options.silent !== true) {
                window.EphemeraNotifications?.error?.('Persistent Storage Error', message);
            }
            return {
                supported: true,
                granted: false,
                persisted: false,
                error: message
            };
        }
    },

    _scheduleCheck() {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        this._debounceTimer = setTimeout(() => {
            this._debounceTimer = null;
            this.checkQuota().catch(() => {
                // Ignore background check failures.
            });
        }, CHANGE_DEBOUNCE_MS);
    },

    _subscribeToChanges() {
        if (!window.EphemeraEvents?.on) return;
        const on = window.EphemeraEvents.on.bind(window.EphemeraEvents);

        const subscribe = (eventName, handler) => {
            const maybeUnsubscribe = on(eventName, handler);
            if (typeof maybeUnsubscribe === 'function') {
                this._unbinders.push(maybeUnsubscribe);
                return;
            }
            if (window.EphemeraEvents?.off) {
                this._unbinders.push(() => {
                    window.EphemeraEvents.off(eventName, handler);
                });
            }
        };

        subscribe('fs:changed', () => this._scheduleCheck());
        subscribe('fs:history:changed', () => this._scheduleCheck());
    },

    start() {
        if (this._started) return;
        this._started = true;
        this._subscribeToChanges();
        this.checkQuota({ silent: true }).catch(() => {
            // Ignore startup failures.
        });
        this._intervalId = setInterval(() => {
            this.checkQuota().catch(() => {
                // Ignore periodic check failures.
            });
        }, this.MONITOR_INTERVAL_MS);
    },

    _resetForTests() {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
        this._unbinders.forEach((unbind) => {
            try {
                unbind?.();
            } catch (_error) {
                // Ignore cleanup failures.
            }
        });
        this._unbinders = [];
        this._started = false;
        this._lastWarningAt = 0;
        this._lastUsageRatio = 0;
        this._lastSummary = null;
    }
};

window.EphemeraStorageQuota = EphemeraStorageQuota;
EphemeraStorageQuota.start();

export default EphemeraStorageQuota;
