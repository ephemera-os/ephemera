const DEFAULT_MAX_SAMPLES = 240;
const DEFAULT_BREADCRUMB_INTERVAL_MS = 60_000;
const REDACTED = '[REDACTED]';
const SENSITIVE_META_PATTERN = /(password|token|secret|apikey|api_key|cookie|authorization|email|path|url)/i;

function roundMetric(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Number(numeric.toFixed(2));
}

function normalizeMetricName(name) {
    const metricName = String(name || '').trim();
    return metricName || null;
}

function percentile(sortedValues, percentileValue) {
    if (!Array.isArray(sortedValues) || sortedValues.length === 0) return 0;
    const rank = Math.max(0, Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * percentileValue) - 1));
    return sortedValues[rank];
}

function sanitizeMeta(meta) {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const sanitized = {};
    const entries = Object.entries(meta).slice(0, 12);
    entries.forEach(([rawKey, rawValue]) => {
        const key = String(rawKey || '').trim().slice(0, 64);
        if (!key) return;

        if (SENSITIVE_META_PATTERN.test(key)) {
            sanitized[key] = REDACTED;
            return;
        }

        if (rawValue == null) {
            sanitized[key] = rawValue;
            return;
        }

        if (typeof rawValue === 'number') {
            if (!Number.isFinite(rawValue)) return;
            sanitized[key] = roundMetric(rawValue);
            return;
        }

        if (typeof rawValue === 'boolean') {
            sanitized[key] = rawValue;
            return;
        }

        if (typeof rawValue === 'string') {
            sanitized[key] = SENSITIVE_META_PATTERN.test(rawValue)
                ? REDACTED
                : rawValue.slice(0, 160);
            return;
        }

        if (Array.isArray(rawValue)) {
            sanitized[key] = `[array:${rawValue.length}]`;
            return;
        }

        sanitized[key] = '[object]';
    });
    return sanitized;
}

const EphemeraPerformance = {
    _initialized: false,
    _enabled: true,
    _maxSamples: DEFAULT_MAX_SAMPLES,
    _breadcrumbIntervalMs: DEFAULT_BREADCRUMB_INTERVAL_MS,
    _metrics: new Map(),
    _lastBreadcrumbAt: new Map(),

    init(options = {}) {
        if (typeof options.enabled === 'boolean') {
            this._enabled = options.enabled;
        }

        const maxSamples = Number(options.maxSamples);
        if (Number.isFinite(maxSamples) && maxSamples >= 10) {
            this._maxSamples = Math.floor(maxSamples);
        }

        const breadcrumbInterval = Number(options.breadcrumbIntervalMs);
        if (Number.isFinite(breadcrumbInterval) && breadcrumbInterval >= 1_000) {
            this._breadcrumbIntervalMs = Math.floor(breadcrumbInterval);
        }

        this._initialized = true;
    },

    _ensureInitialized() {
        if (!this._initialized) {
            this.init();
        }
    },

    _now() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    },

    setEnabled(enabled) {
        this._enabled = enabled === true;
    },

    isEnabled() {
        return this._enabled === true;
    },

    start(name, meta = {}) {
        this._ensureInitialized();
        if (!this._enabled) return null;

        const metric = normalizeMetricName(name);
        if (!metric) return null;

        return {
            metric,
            startedAt: this._now(),
            meta: sanitizeMeta(meta),
            ended: false
        };
    },

    end(span, meta = {}) {
        this._ensureInitialized();
        if (!this._enabled || !span || span.ended) return null;

        const startedAt = Number(span.startedAt);
        if (!Number.isFinite(startedAt)) return null;

        span.ended = true;
        const durationMs = Math.max(0, this._now() - startedAt);
        return this.record(span.metric, durationMs, {
            ...(span.meta || {}),
            ...sanitizeMeta(meta)
        });
    },

    record(name, durationMs, meta = {}) {
        this._ensureInitialized();
        if (!this._enabled) return null;

        const metric = normalizeMetricName(name);
        const numericDuration = Number(durationMs);
        if (!metric || !Number.isFinite(numericDuration) || numericDuration < 0) {
            return null;
        }

        const safeMeta = sanitizeMeta(meta);
        const bucket = this._metrics.get(metric) || {
            samples: [],
            updatedAt: 0,
            lastMeta: {}
        };

        bucket.samples.push(numericDuration);
        if (bucket.samples.length > this._maxSamples) {
            bucket.samples.splice(0, bucket.samples.length - this._maxSamples);
        }

        bucket.updatedAt = Date.now();
        bucket.lastMeta = safeMeta;
        this._metrics.set(metric, bucket);

        const summary = this.getMetric(metric);
        this._emitMetric(metric, numericDuration, safeMeta, summary);
        this._reportToTelemetry(metric, numericDuration, safeMeta, summary);

        return {
            metric,
            durationMs: roundMetric(numericDuration),
            summary
        };
    },

    measure(name, fn, meta = {}) {
        this._ensureInitialized();
        if (typeof fn !== 'function') {
            throw new Error('EphemeraPerformance.measure requires a function');
        }

        const span = this.start(name, meta);
        const finalize = (status) => {
            this.end(span, { status });
        };

        try {
            const result = fn();
            if (result && typeof result.then === 'function') {
                return result.then((value) => {
                    finalize('ok');
                    return value;
                }).catch((error) => {
                    finalize('error');
                    throw error;
                });
            }
            finalize('ok');
            return result;
        } catch (error) {
            finalize('error');
            throw error;
        }
    },

    getMetric(name) {
        this._ensureInitialized();
        const metric = normalizeMetricName(name);
        if (!metric) return null;

        const bucket = this._metrics.get(metric);
        if (!bucket || !Array.isArray(bucket.samples) || bucket.samples.length === 0) {
            return null;
        }

        const values = bucket.samples.filter((sample) => Number.isFinite(sample));
        if (values.length === 0) {
            return null;
        }

        const sorted = [...values].sort((a, b) => a - b);
        const count = sorted.length;
        const sum = sorted.reduce((total, value) => total + value, 0);

        return {
            metric,
            count,
            lastMs: roundMetric(values[values.length - 1]),
            minMs: roundMetric(sorted[0]),
            maxMs: roundMetric(sorted[sorted.length - 1]),
            avgMs: roundMetric(sum / count),
            p50Ms: roundMetric(percentile(sorted, 0.5)),
            p95Ms: roundMetric(percentile(sorted, 0.95)),
            p99Ms: roundMetric(percentile(sorted, 0.99)),
            updatedAt: Number(bucket.updatedAt || 0),
            meta: sanitizeMeta(bucket.lastMeta || {})
        };
    },

    getAllMetrics() {
        this._ensureInitialized();
        const metrics = {};
        Array.from(this._metrics.keys())
            .sort((a, b) => a.localeCompare(b))
            .forEach((metric) => {
                const summary = this.getMetric(metric);
                if (summary) {
                    metrics[metric] = summary;
                }
            });
        return metrics;
    },

    clear(metricName = null) {
        this._ensureInitialized();
        if (metricName == null) {
            this._metrics.clear();
            this._lastBreadcrumbAt.clear();
            return;
        }
        const metric = normalizeMetricName(metricName);
        if (!metric) return;
        this._metrics.delete(metric);
        this._lastBreadcrumbAt.delete(metric);
    },

    _emitMetric(metric, durationMs, meta, summary) {
        if (!window.EphemeraEvents?.emit) return;
        window.EphemeraEvents.emit('performance:metric', {
            metric,
            durationMs: roundMetric(durationMs),
            meta: sanitizeMeta(meta),
            summary,
            at: Date.now()
        });
    },

    _reportToTelemetry(metric, durationMs, meta, summary) {
        if (!window.EphemeraTelemetry?.addBreadcrumb || !summary) return;

        const lastReportedAt = Number(this._lastBreadcrumbAt.get(metric) || 0);
        const now = Date.now();
        const shouldReport = summary.count === 1
            || summary.count % 10 === 0
            || (now - lastReportedAt) >= this._breadcrumbIntervalMs;
        if (!shouldReport) return;

        this._lastBreadcrumbAt.set(metric, now);
        window.EphemeraTelemetry.addBreadcrumb({
            category: 'performance',
            message: metric,
            level: 'info',
            data: {
                durationMs: roundMetric(durationMs),
                count: summary.count,
                p50Ms: summary.p50Ms,
                p95Ms: summary.p95Ms,
                p99Ms: summary.p99Ms,
                ...sanitizeMeta(meta)
            }
        });
    },

    _resetForTests() {
        this._initialized = false;
        this._enabled = true;
        this._maxSamples = DEFAULT_MAX_SAMPLES;
        this._breadcrumbIntervalMs = DEFAULT_BREADCRUMB_INTERVAL_MS;
        this._metrics.clear();
        this._lastBreadcrumbAt.clear();
    }
};

window.EphemeraPerformance = EphemeraPerformance;
export default EphemeraPerformance;
