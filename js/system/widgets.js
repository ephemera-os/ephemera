const WIDGET_LAYOUT_KEY = 'ephemera_widget_layout';

const EphemeraWidgets = {
    _widgets: [],
    _container: null,
    _widgetDefinitions: new Map(),
    _extensionWidgetTypes: new Map(),
    _builtinsRegistered: false,

    _getAutoPositionFor(el, options = {}) {
        const margin = Number.isFinite(Number(options.margin)) ? Number(options.margin) : 20;
        const gap = Number.isFinite(Number(options.gap)) ? Number(options.gap) : 12;

        const containerWidth = this._container?.clientWidth || window.innerWidth || 0;
        const containerHeight = this._container?.clientHeight || (window.innerHeight - 56) || 0;

        const widgetWidth = el?.offsetWidth || 0;
        const widgetHeight = el?.offsetHeight || 0;

        const maxX = Math.max(0, containerWidth - widgetWidth - margin);
        const maxY = Math.max(0, containerHeight - widgetHeight - margin);

        const existingRects = this._widgets
            .map((widget) => widget?.el)
            .filter((existingEl) => existingEl && existingEl !== el)
            .map((existingEl) => ({
                x0: existingEl.offsetLeft - gap,
                y0: existingEl.offsetTop - gap,
                x1: existingEl.offsetLeft + existingEl.offsetWidth + gap,
                y1: existingEl.offsetTop + existingEl.offsetHeight + gap
            }));

        const isOverlapping = (x, y) => {
            const x0 = x - gap;
            const y0 = y - gap;
            const x1 = x + widgetWidth + gap;
            const y1 = y + widgetHeight + gap;
            return existingRects.some((r) => x0 < r.x1 && x1 > r.x0 && y0 < r.y1 && y1 > r.y0);
        };

        const findYForX = (x) => {
            const x0 = x - gap;
            const x1 = x + widgetWidth + gap;
            const blockers = existingRects
                .filter((r) => x0 < r.x1 && x1 > r.x0)
                .sort((a, b) => a.y0 - b.y0);

            let y = margin;
            for (const r of blockers) {
                if (y + widgetHeight <= r.y0) {
                    break;
                }
                if (y < r.y1) {
                    y = r.y1;
                }
                if (y > maxY) return null;
            }
            return y <= maxY ? y : null;
        };

        const xStart = maxX;
        const xStep = Math.max(20, widgetWidth + gap);
        for (let x = xStart; x >= margin; x -= xStep) {
            const y = findYForX(x);
            if (typeof y === 'number' && !isOverlapping(x, y)) {
                return { x, y };
            }
        }

        // Fallback: clamp to top-right-ish, even if overlapping is unavoidable.
        return {
            x: Math.min(Math.max(0, xStart), maxX),
            y: Math.min(Math.max(0, margin), maxY)
        };
    },

    init() {
        if (this._container && document.body.contains(this._container)) {
            return;
        }

        const desktop = document.getElementById('desktop');
        if (!desktop) return;

        this._container = document.getElementById('widgets-container') || document.createElement('div');
        this._container.id = 'widgets-container';
        // Keep the layer itself transparent to clicks, but place it above desktop icons so widgets remain interactive.
        this._container.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:56px;pointer-events:none;z-index:3;';
        const desktopIcons = document.getElementById('desktop-icons');
        if (desktopIcons && desktopIcons.parentNode === desktop) {
            desktop.insertBefore(this._container, desktopIcons);
        } else {
            desktop.appendChild(this._container);
        }

        this._registerBuiltIns();
        this._restoreLayout();
    },

    _registerBuiltIns() {
        if (this._builtinsRegistered) return;
        const builtins = [
            { type: 'clock', name: 'Clock', icon: '🕐', source: 'builtin', description: 'Analog or digital clock', init: (widget) => this._initClock(widget) },
            { type: 'weather', name: 'Weather', icon: '🌤️', source: 'builtin', description: 'Current weather with configurable city', init: (widget) => this._initWeather(widget) },
            { type: 'calendar', name: 'Calendar', icon: '📅', source: 'builtin', description: 'Mini month calendar', init: (widget) => this._initCalendar(widget) },
            { type: 'stickynote', name: 'Sticky Note', icon: '📝', source: 'builtin', description: 'Resizable, color-coded sticky note', init: (widget) => this._initStickyNote(widget) },
            { type: 'sysinfo', name: 'System Stats', icon: '💻', source: 'builtin', description: 'CPU/memory style bars and uptime', init: (widget) => this._initSysInfo(widget) },
            { type: 'rss', name: 'RSS Ticker', icon: '📰', source: 'builtin', description: 'Scrollable RSS headline ticker', init: (widget) => this._initRSS(widget) },
            { type: 'pomodoro', name: 'Pomodoro', icon: '🍅', source: 'builtin', description: 'Focus timer', init: (widget) => this._initPomodoro(widget) },
            { type: 'quicknotes', name: 'Quick Notes', icon: '✏️', source: 'builtin', description: 'Fast scratchpad', init: (widget) => this._initQuickNotes(widget) }
        ];
        builtins.forEach((definition) => {
            this.registerWidget(definition, { replace: true, persist: false });
        });
        this._builtinsRegistered = true;
    },

    registerWidget(definition, options = {}) {
        if (!definition || typeof definition !== 'object') {
            throw new Error('Widget definition must be an object');
        }
        const type = String(definition.type || '').trim().toLowerCase();
        if (!type) {
            throw new Error('Widget definition requires a type');
        }
        if (typeof definition.init !== 'function') {
            throw new Error(`Widget definition "${type}" requires an init function`);
        }

        const replace = options.replace === true;
        if (!replace && this._widgetDefinitions.has(type)) {
            throw new Error(`Widget type already registered: ${type}`);
        }

        this._widgetDefinitions.set(type, {
            type,
            name: String(definition.name || type),
            icon: String(definition.icon || '🧩'),
            description: String(definition.description || ''),
            source: String(definition.source || 'builtin'),
            appId: definition.appId ? String(definition.appId) : null,
            init: definition.init
        });

        if (options.persist !== false) {
            this._saveLayout();
        }
        window.EphemeraEvents?.emit?.('widget:definition-registered', { type });
        return type;
    },

    unregisterWidget(type, options = {}) {
        const normalizedType = String(type || '').trim().toLowerCase();
        if (!normalizedType || !this._widgetDefinitions.has(normalizedType)) return false;
        this._widgetDefinitions.delete(normalizedType);

        const removeInstances = options.removeInstances !== false;
        if (removeInstances) {
            const ids = this._widgets.filter(w => w.type === normalizedType).map(w => w.id);
            ids.forEach((id) => this.remove(id, { persist: false }));
        }

        if (options.persist !== false) {
            this._saveLayout();
        }
        window.EphemeraEvents?.emit?.('widget:definition-unregistered', { type: normalizedType });
        return true;
    },

    listAvailableWidgets() {
        return Array.from(this._widgetDefinitions.values()).map((entry) => ({
            type: entry.type,
            name: entry.name,
            icon: entry.icon,
            description: entry.description,
            source: entry.source,
            appId: entry.appId
        }));
    },

    getWidgets() {
        return this._widgets.map((widget) => ({
            id: widget.id,
            type: widget.type,
            options: { ...widget.options }
        }));
    },

    registerExtensionWidget(appId, manifest, code) {
        const normalizedAppId = String(appId || '').trim();
        if (!normalizedAppId) return null;

        this.init();
        this.unregisterExtensionWidget(normalizedAppId);

        const widgetType = String(manifest?.widget?.type || `widget:${normalizedAppId}`).trim().toLowerCase();
        const widgetName = String(manifest?.widget?.name || manifest?.name || normalizedAppId);
        const widgetIcon = String(manifest?.widget?.icon || manifest?.icon || '🧩');
        const widgetDescription = String(manifest?.description || 'Custom widget');
        const widgetCode = typeof code === 'string' ? code : '';

        this.registerWidget({
            type: widgetType,
            name: widgetName,
            icon: widgetIcon,
            source: 'custom',
            appId: normalizedAppId,
            description: widgetDescription,
            init: (widget) => this._initCustomWidget(widget, {
                appId: normalizedAppId,
                manifest: manifest || {},
                code: widgetCode
            })
        }, { replace: true, persist: false });

        this._extensionWidgetTypes.set(normalizedAppId, widgetType);
        return widgetType;
    },

    unregisterExtensionWidget(appId) {
        const normalizedAppId = String(appId || '').trim();
        if (!normalizedAppId) return false;
        const widgetType = this._extensionWidgetTypes.get(normalizedAppId);
        if (!widgetType) return false;
        this._extensionWidgetTypes.delete(normalizedAppId);
        this.unregisterWidget(widgetType, { removeInstances: true, persist: true });
        return true;
    },

    _saveLayout() {
        try {
            const layout = this._widgets.map((widget) => ({
                id: widget.id,
                type: widget.type,
                options: {
                    ...widget.options,
                    x: widget.el.offsetLeft,
                    y: widget.el.offsetTop
                }
            }));
            localStorage.setItem(WIDGET_LAYOUT_KEY, JSON.stringify(layout));
        } catch (_e) {
            // Ignore storage quota/session errors.
        }
    },

    _restoreLayout() {
        let parsed = [];
        try {
            parsed = JSON.parse(localStorage.getItem(WIDGET_LAYOUT_KEY) || '[]');
        } catch (_e) {
            parsed = [];
        }
        if (!Array.isArray(parsed)) return;

        parsed.forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;
            const type = String(entry.type || '').trim().toLowerCase();
            if (!type || !this._widgetDefinitions.has(type)) return;
            const options = (entry.options && typeof entry.options === 'object') ? entry.options : {};
            this.add(type, { ...options, id: entry.id, persist: true });
        });
    },

    add(type, options = {}) {
        if (!this._container) {
            this.init();
        }

        const normalizedType = String(type || '').trim().toLowerCase();
        const definition = this._widgetDefinitions.get(normalizedType);
        if (!definition || !this._container) return null;

        const hasExplicitX = options.x !== undefined && options.x !== null && Number.isFinite(Number(options.x));
        const hasExplicitY = options.y !== undefined && options.y !== null && Number.isFinite(Number(options.y));
        const useAutoPosition = !(hasExplicitX && hasExplicitY);

        const id = options.id || `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const el = document.createElement('div');
        el.id = id;
        el.style.cssText = `position:absolute;pointer-events:auto;z-index:2;
            background:rgba(10,10,15,0.75);backdrop-filter:blur(20px);
            border:1px solid var(--border);border-radius:var(--radius-md);
            padding:12px;min-width:140px;cursor:move;user-select:none;`;
        el.style.top = (useAutoPosition ? 20 : Number(options.y)) + 'px';
        el.style.left = (useAutoPosition ? 20 : Number(options.x)) + 'px';
        if (useAutoPosition) el.style.visibility = 'hidden';

        const widget = { id, type: normalizedType, name: definition.name, el, options: { ...options }, _intervals: [], _cleanup: null };

        definition.init(widget);

        this._makeDraggable(el);
        this._container.appendChild(el);

        if (useAutoPosition) {
            const pos = this._getAutoPositionFor(el);
            el.style.left = pos.x + 'px';
            el.style.top = pos.y + 'px';
            el.style.right = 'auto';
            el.style.visibility = 'visible';
            widget.options.x = pos.x;
            widget.options.y = pos.y;
        }
        this._widgets.push(widget);
        if (options.persist !== false) {
            this._saveLayout();
        }
        window.EphemeraEvents?.emit?.('widget:added', { id, type: normalizedType });
        return id;
    },

    remove(id, options = {}) {
        const idx = this._widgets.findIndex(w => w.id === id);
        if (idx === -1) return;
        const w = this._widgets[idx];
        w._intervals.forEach(clearInterval);
        if (typeof w._cleanup === 'function') {
            try { w._cleanup(); } catch (_e) { /* noop */ }
        }
        w.el.remove();
        this._widgets.splice(idx, 1);
        if (options.persist !== false) {
            this._saveLayout();
        }
        window.EphemeraEvents?.emit?.('widget:removed', { id, type: w.type });
    },

    _initClock(widget) {
        const drawAnalog = (ctx) => {
            const now = new Date();
            const cx = 60;
            const cy = 60;
            const r = 50;
            ctx.clearRect(0, 0, 120, 120);
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
            for (let i = 0; i < 12; i++) {
                const a = (i * 30 - 90) * Math.PI / 180;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
                ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            const h = now.getHours() % 12;
            const m = now.getMinutes();
            const s = now.getSeconds();
            const ha = ((h + m / 60) * 30 - 90) * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(ha) * 28, cy + Math.sin(ha) * 28);
            ctx.strokeStyle = '#e8e8f0';
            ctx.lineWidth = 3;
            ctx.stroke();
            const ma = ((m + s / 60) * 6 - 90) * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(ma) * 38, cy + Math.sin(ma) * 38);
            ctx.strokeStyle = '#e8e8f0';
            ctx.lineWidth = 2;
            ctx.stroke();
            const sa = (s * 6 - 90) * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(sa) * 42, cy + Math.sin(sa) * 42);
            ctx.strokeStyle = '#00d4aa';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#00d4aa';
            ctx.fill();
        };

        const render = () => {
            const mode = String(widget.options.mode || 'analog') === 'digital' ? 'digital' : 'analog';
            widget.options.mode = mode;
            widget.el.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="color:var(--accent);font-weight:500;">Clock</span>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <button class="clock-mode-toggle" style="padding:2px 8px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-size:0.68rem;">${mode === 'digital' ? 'Analog' : 'Digital'}</button>
                        <span class="widget-close" style="cursor:pointer;opacity:0.5;">&times;</span>
                    </div>
                </div>
                <div class="clock-host" style="display:flex;align-items:center;justify-content:center;min-height:112px;"></div>
            `;

            const host = widget.el.querySelector('.clock-host');
            const update = () => {
                if (widget.options.mode === 'digital') {
                    const now = new Date();
                    host.innerHTML = `
                        <div style="text-align:center;">
                            <div style="font-size:1.4rem;font-family:'JetBrains Mono',monospace;color:var(--fg-primary);">${now.toLocaleTimeString()}</div>
                            <div style="font-size:0.72rem;color:var(--fg-muted);margin-top:4px;">${now.toLocaleDateString()}</div>
                        </div>
                    `;
                    return;
                }
                host.innerHTML = '';
                const face = document.createElement('canvas');
                face.width = 120;
                face.height = 120;
                face.style.cssText = 'display:block;';
                host.appendChild(face);
                const ctx = face.getContext('2d');
                if (ctx) drawAnalog(ctx);
            };

            update();
            widget._intervals.push(setInterval(update, 1000));
            widget.el.querySelector('.clock-mode-toggle').addEventListener('click', () => {
                widget._intervals.forEach(clearInterval);
                widget._intervals = [];
                widget.options.mode = widget.options.mode === 'digital' ? 'analog' : 'digital';
                this._saveLayout();
                render();
            });
            widget.el.querySelector('.widget-close').addEventListener('click', () => {
                this.remove(widget.id);
            });
        };

        render();
    },

    _initStickyNote(widget) {
        const colors = ['yellow', 'mint', 'rose', 'sky'];
        const colorStyles = {
            yellow: { bg: 'rgba(255,200,50,0.15)', border: 'rgba(255,200,50,0.3)' },
            mint: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
            rose: { bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.3)' },
            sky: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' }
        };

        widget.options.color = colors.includes(String(widget.options.color || 'yellow'))
            ? String(widget.options.color)
            : 'yellow';

        const render = () => {
            const style = colorStyles[widget.options.color] || colorStyles.yellow;
            widget.el.style.background = style.bg;
            widget.el.style.borderColor = style.border;
            widget.el.style.minWidth = '220px';
            widget.el.style.minHeight = '200px';
            widget.el.innerHTML = `
                <div style="font-size:0.7rem;color:var(--fg-muted);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                    <span>Sticky Note</span>
                    <div style="display:flex;align-items:center;gap:6px;">
                        ${colors.map((name) => `<button class="sticky-color" data-color="${name}" title="${name}" style="width:10px;height:10px;border-radius:50%;border:${widget.options.color === name ? '1px solid #fff' : '1px solid transparent'};background:${colorStyles[name].bg};cursor:pointer;"></button>`).join('')}
                        <span class="widget-close" style="cursor:pointer;opacity:0.5;">&times;</span>
                    </div>
                </div>
                <textarea style="width:100%;height:130px;background:transparent;border:none;color:var(--fg-primary);font-size:0.8rem;resize:both;min-width:180px;min-height:110px;outline:none;font-family:inherit;line-height:1.5;">${EphemeraSanitize.escapeHtml(String(widget.options.text || ''))}</textarea>
            `;

            const ta = widget.el.querySelector('textarea');
            ta.addEventListener('input', () => {
                widget.options.text = ta.value;
                this._saveLayout();
            });
            widget.el.querySelectorAll('.sticky-color').forEach((button) => {
                button.addEventListener('click', () => {
                    widget.options.color = button.dataset.color;
                    this._saveLayout();
                    render();
                });
            });
            widget.el.querySelector('.widget-close').addEventListener('click', () => this.remove(widget.id));
        };

        render();
    },

    _initSysInfo(widget) {
        const info = document.createElement('div');
        info.style.cssText = 'font-size:0.75rem;color:var(--fg-secondary);';
        widget.el.appendChild(info);

        // Client-side only: browsers cannot expose real OS CPU usage, so we estimate main-thread load
        // by sampling event-loop delay (timer drift). This is a proxy for responsiveness, not system CPU.
        const sampleIntervalMs = 500;
        let lastSampleAt = (typeof performance !== 'undefined' && typeof performance.now === 'function')
            ? performance.now()
            : Date.now();
        let uiLoadEwma = 0; // 0..1
        let lastLagMs = 0;

        const sampleLoad = () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
                ? performance.now()
                : Date.now();
            const delta = now - lastSampleAt;
            lastSampleAt = now;

            const drift = Math.max(0, delta - sampleIntervalMs);
            lastLagMs = Math.round(drift);
            const instantLoad = Math.min(1, drift / sampleIntervalMs);
            uiLoadEwma = uiLoadEwma * 0.8 + instantLoad * 0.2;
        };

        function update() {
            const wins = EphemeraState.windows.length;

            const uiPct = Math.max(0, Math.min(100, Math.round(uiLoadEwma * 100)));

            const memInfo = performance?.memory;
            const usedBytes = Number(memInfo?.usedJSHeapSize);
            const limitBytes = Number(memInfo?.jsHeapSizeLimit);
            const hasHeap = Number.isFinite(usedBytes) && usedBytes >= 0;
            const hasLimit = Number.isFinite(limitBytes) && limitBytes > 0;
            const usedMb = hasHeap ? usedBytes / 1048576 : 0;
            const limitMb = hasLimit ? limitBytes / 1048576 : 0;
            const heapLabel = hasHeap
                ? (hasLimit ? `${usedMb.toFixed(1)} / ${limitMb.toFixed(0)} MB` : `${usedMb.toFixed(1)} MB`)
                : 'n/a';
            const heapPct = (hasHeap && hasLimit)
                ? Math.max(0, Math.min(100, Math.round((usedBytes / limitBytes) * 100)))
                : 0;
            info.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="color:var(--accent);font-weight:500;">System</span>
                    <span class="widget-close" style="cursor:pointer;opacity:0.5;">&times;</span>
                </div>
                <div style="display:flex;justify-content:space-between;" title="Estimated main-thread load based on timer drift (not OS CPU).">
                    <span>UI Load</span><span>${uiPct}%</span>
                </div>
                <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;margin:4px 0 8px;">
                    <div style="height:100%;width:${uiPct}%;background:var(--accent);"></div>
                </div>
                <div style="display:flex;justify-content:space-between;" title="JavaScript heap usage reported by the browser.">
                    <span>Heap</span><span>${heapLabel}</span>
                </div>
                <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;margin:4px 0 8px;">
                    <div style="height:100%;width:${heapPct}%;background:#60a5fa;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;color:var(--fg-muted);"><span>Windows</span><span>${wins}</span></div>
                <div style="display:flex;justify-content:space-between;color:var(--fg-muted);"><span>Lag</span><span>${lastLagMs}ms</span></div>
                <div style="display:flex;justify-content:space-between;color:var(--fg-muted);"><span>Uptime</span><span>${((Date.now() - performance.timeOrigin) / 60000).toFixed(0)}m</span></div>`;
            info.querySelector('.widget-close')?.addEventListener('click', () => {
                EphemeraWidgets.remove(widget.id);
            });
        }

        sampleLoad();
        update();
        widget._intervals.push(setInterval(sampleLoad, sampleIntervalMs));
        widget._intervals.push(setInterval(update, 2000));
    },

    _makeDraggable(el) {
        let ox, oy, sx, sy;
        el.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            ox = e.clientX; oy = e.clientY;
            sx = el.offsetLeft; sy = el.offsetTop;
            const move = (ev) => {
                const maxX = Math.max(0, (this._container?.clientWidth || window.innerWidth) - el.offsetWidth);
                const maxY = Math.max(0, (this._container?.clientHeight || (window.innerHeight - 56)) - el.offsetHeight);
                const nextX = Math.min(maxX, Math.max(0, sx + ev.clientX - ox));
                const nextY = Math.min(maxY, Math.max(0, sy + ev.clientY - oy));
                el.style.left = nextX + 'px';
                el.style.top = nextY + 'px';
                el.style.right = 'auto';
            };
            const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                this._saveLayout();
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
    },

    async _initWeather(widget) {
        widget.el.style.minWidth = '200px';
        const content = document.createElement('div');
        content.style.cssText = 'font-size:0.8rem;';
        widget.el.appendChild(content);

        const weatherKey = 'ephemera_weather_data';
        const locationKey = 'ephemera_weather_location';

        const getCityName = async (lat, lon) => {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
                );
                const data = await response.json();
                return data.address?.city || data.address?.town || data.address?.village || data.address?.county || 'Unknown';
            } catch {
                return 'Unknown';
            }
        };

        const searchCity = async (query) => {
            try {
                const response = await fetch(
                    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
                );
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    return {
                        lat: data.results[0].latitude,
                        lon: data.results[0].longitude,
                        city: data.results[0].name
                    };
                }
            } catch (_e) {
                // Ignore transient geocoding/network failures.
            }
            return null;
        };

        const showLocationInput = () => {
            content.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="color:var(--accent);font-weight:500;">📍 Set Location</span>
                    <span class="widget-back" style="cursor:pointer;opacity:0.7;font-size:0.85rem;" title="Back">← Back</span>
                </div>
                <input type="text" id="weather-location-input" placeholder="Enter city name..." 
                    style="width:100%;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.8rem;margin-bottom:8px;">
                <div style="display:flex;gap:6px;">
                    <button id="weather-detect-btn" style="flex:1;padding:6px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-size:0.75rem;">📍 Detect</button>
                    <button id="weather-save-btn" style="flex:1;padding:6px;background:var(--accent);border:none;color:#fff;border-radius:var(--radius-sm);cursor:pointer;font-size:0.75rem;">Save</button>
                </div>
                <div id="weather-location-error" style="color:#ef4444;font-size:0.7rem;margin-top:6px;"></div>
                <div class="widget-close" style="position:absolute;top:8px;right:8px;cursor:pointer;opacity:0.3;font-size:1rem;" title="Close widget">&times;</div>
            `;

            content.querySelector('.widget-back').addEventListener('click', () => {
                getWeather();
            });

            content.querySelector('.widget-close').addEventListener('click', () => {
                this.remove(widget.id);
            });

            content.querySelector('#weather-detect-btn').addEventListener('click', async () => {
                const errorEl = content.querySelector('#weather-location-error');
                errorEl.textContent = 'Detecting...';
                try {
                    const pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
                    });
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    const city = await getCityName(lat, lon);
                    await EphemeraStorage.put('metadata', { key: locationKey, lat, lon, city });
                    errorEl.style.color = '#22c55e';
                    errorEl.textContent = `Detected: ${city}`;
                    setTimeout(() => getWeather(), 500);
                } catch (e) {
                    errorEl.textContent = 'Could not detect location. Please enter manually.';
                }
            });

            content.querySelector('#weather-save-btn').addEventListener('click', async () => {
                const input = content.querySelector('#weather-location-input');
                const errorEl = content.querySelector('#weather-location-error');
                const query = input.value.trim();
                if (!query) {
                    errorEl.textContent = 'Please enter a city name';
                    return;
                }
                errorEl.textContent = 'Searching...';
                const result = await searchCity(query);
                if (result) {
                    await EphemeraStorage.put('metadata', { key: locationKey, lat: result.lat, lon: result.lon, city: result.city });
                    getWeather();
                } else {
                    errorEl.textContent = 'City not found. Try a different name.';
                }
            });
        };

        const getWeather = async () => {
            content.innerHTML = '<div style="color:var(--fg-muted);text-align:center;padding:10px;">Loading...</div>';
            
            let lat, lon, cityName = null;
            const savedLocation = await EphemeraStorage.get('metadata', locationKey);
            
            if (savedLocation && savedLocation.lat !== undefined) {
                lat = savedLocation.lat;
                lon = savedLocation.lon;
                cityName = savedLocation.city;
            } else {
                try {
                    const pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                    });
                    lat = pos.coords.latitude;
                    lon = pos.coords.longitude;
                    cityName = await getCityName(lat, lon);
                    await EphemeraStorage.put('metadata', { key: locationKey, lat, lon, city: cityName });
                } catch {
                    showLocationInput();
                    return;
                }
            }

            try {
                const response = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`
                );
                const data = await response.json();
                const current = data.current;

                const weatherCodes = {
                    0: { icon: '☀️', desc: 'Clear' },
                    1: { icon: '🌤️', desc: 'Mainly Clear' },
                    2: { icon: '⛅', desc: 'Partly Cloudy' },
                    3: { icon: '☁️', desc: 'Overcast' },
                    45: { icon: '🌫️', desc: 'Foggy' },
                    48: { icon: '🌫️', desc: 'Rime Fog' },
                    51: { icon: '🌦️', desc: 'Light Drizzle' },
                    53: { icon: '🌦️', desc: 'Drizzle' },
                    55: { icon: '🌧️', desc: 'Heavy Drizzle' },
                    61: { icon: '🌧️', desc: 'Light Rain' },
                    63: { icon: '🌧️', desc: 'Rain' },
                    65: { icon: '🌧️', desc: 'Heavy Rain' },
                    71: { icon: '🌨️', desc: 'Light Snow' },
                    73: { icon: '🌨️', desc: 'Snow' },
                    75: { icon: '❄️', desc: 'Heavy Snow' },
                    95: { icon: '⛈️', desc: 'Thunderstorm' }
                };

                const weather = weatherCodes[current.weather_code] || { icon: '🌡️', desc: 'Unknown' };

                content.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="color:var(--accent);font-weight:500;">Weather</span>
                        <div style="display:flex;gap:8px;align-items:center;">
                            <span class="widget-location-btn" style="cursor:pointer;opacity:0.5;font-size:0.9rem;" title="Change location">📍</span>
                            <span class="widget-close" style="cursor:pointer;opacity:0.5;">&times;</span>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                        <span style="font-size:2rem;">${weather.icon}</span>
                        <div>
                            <div style="font-size:1.5rem;font-weight:600;color:var(--fg-primary);">${Math.round(current.temperature_2m)}°C</div>
                            <div style="color:var(--fg-secondary);">${weather.desc}</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;color:var(--fg-muted);font-size:0.75rem;">
                        <div>💧 ${current.relative_humidity_2m}%</div>
                        <div>💨 ${Math.round(current.wind_speed_10m)} km/h</div>
                    </div>
                    <div style="margin-top:8px;font-size:0.7rem;color:var(--fg-muted);text-align:center;">
                        ${cityName || 'Unknown'}
                    </div>
                `;

                content.querySelector('.widget-close').addEventListener('click', () => {
                    this.remove(widget.id);
                });

                content.querySelector('.widget-location-btn').addEventListener('click', () => {
                    showLocationInput();
                });

                await EphemeraStorage.put('metadata', { key: weatherKey, data: { ...current, weather, cityName }, timestamp: Date.now() });

            } catch (error) {
                content.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span style="color:var(--accent);font-weight:500;">Weather</span>
                        <span class="widget-close" style="cursor:pointer;opacity:0.5;">&times;</span>
                    </div>
                    <div style="color:var(--fg-muted);font-size:0.75rem;">Unable to load weather</div>
                    <div style="display:flex;gap:6px;margin-top:8px;">
                        <button class="retry-btn" style="flex:1;padding:4px 8px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-size:0.7rem;">Retry</button>
                        <button class="location-btn" style="flex:1;padding:4px 8px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-size:0.7rem;">Location</button>
                    </div>
                `;
                content.querySelector('.widget-close').addEventListener('click', () => {
                    this.remove(widget.id);
                });
                content.querySelector('.retry-btn').addEventListener('click', getWeather);
                content.querySelector('.location-btn').addEventListener('click', showLocationInput);
            }
        }

        await getWeather();
        widget._intervals.push(setInterval(getWeather, 600000));
    },

    _initRSS(widget) {
        widget.el.style.minWidth = '320px';
        widget.options.feedUrl = String(widget.options.feedUrl || 'https://feeds.bbci.co.uk/news/world/rss.xml');
        let headlines = [];
        let index = 0;

        const fallback = [
            'Ephemera Widgets: custom widget manifests are now supported.',
            'Tip: use the tray widget menu to quickly add dashboard widgets.',
            'RSS feed unavailable. Check your connection or feed URL.'
        ];

        async function fetchWithTimeout(url, timeoutMs) {
            if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
                return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
            }
            if (typeof AbortController === 'undefined') {
                return fetch(url);
            }
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                return await fetch(url, { signal: controller.signal });
            } finally {
                clearTimeout(timer);
            }
        }

        const renderFeedEditor = (error = '') => {
            widget.el.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="color:var(--accent);font-weight:500;">RSS Feed</span>
                    <span class="widget-close" style="cursor:pointer;opacity:0.5;">&times;</span>
                </div>
                <div style="display:flex;gap:6px;">
                    <input class="rss-input" value="${EphemeraSanitize.escapeAttr(widget.options.feedUrl)}" style="flex:1;padding:6px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.76rem;">
                    <button class="rss-save" style="padding:6px 10px;background:var(--accent);border:none;color:#fff;border-radius:var(--radius-sm);cursor:pointer;font-size:0.75rem;">Save</button>
                </div>
                <div class="rss-error" style="margin-top:6px;color:#f87171;font-size:0.7rem;">${EphemeraSanitize.escapeHtml(error)}</div>
            `;

            widget.el.querySelector('.widget-close').addEventListener('click', () => this.remove(widget.id));
            widget.el.querySelector('.rss-save').addEventListener('click', async () => {
                const input = widget.el.querySelector('.rss-input');
                const nextFeed = String(input.value || '').trim();
                if (!nextFeed) {
                    renderFeedEditor('Please enter a valid feed URL.');
                    return;
                }
                widget.options.feedUrl = nextFeed;
                this._saveLayout();
                await loadFeed();
                renderTicker();
            });
        };

        const renderTicker = () => {
            const headline = headlines[index] || fallback[index % fallback.length];
            widget.el.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="color:var(--accent);font-weight:500;">RSS Ticker</span>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <button class="rss-config" style="padding:2px 8px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-size:0.68rem;">Feed</button>
                        <span class="widget-close" style="cursor:pointer;opacity:0.5;">&times;</span>
                    </div>
                </div>
                <div style="font-size:0.78rem;color:var(--fg-secondary);line-height:1.5;min-height:36px;display:flex;align-items:center;">
                    ${EphemeraSanitize.escapeHtml(String(headline))}
                </div>
                <div style="margin-top:8px;font-size:0.68rem;color:var(--fg-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${EphemeraSanitize.escapeHtml(widget.options.feedUrl)}
                </div>
            `;

            widget.el.querySelector('.widget-close').addEventListener('click', () => this.remove(widget.id));
            widget.el.querySelector('.rss-config').addEventListener('click', () => renderFeedEditor());
        };

        const loadFeed = async () => {
            try {
                const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(widget.options.feedUrl)}`;
                const response = await fetchWithTimeout(endpoint, 10000);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = await response.json();
                headlines = Array.isArray(payload?.items)
                    ? payload.items.map((item) => String(item?.title || '').trim()).filter(Boolean).slice(0, 20)
                    : [];
                if (headlines.length === 0) headlines = [...fallback];
                index = 0;
            } catch (_e) {
                headlines = [...fallback];
                index = 0;
            }
        };

        loadFeed().then(() => renderTicker());
        widget._intervals.push(setInterval(() => {
            if (!Array.isArray(headlines) || headlines.length === 0) return;
            index = (index + 1) % headlines.length;
            renderTicker();
        }, 5000));
        widget._intervals.push(setInterval(loadFeed, 300000));
    },

    _initCustomWidget(widget, config = {}) {
        const manifest = (config && typeof config.manifest === 'object') ? config.manifest : {};
        const widgetConfig = (manifest.widget && typeof manifest.widget === 'object') ? manifest.widget : {};
        const title = String(widgetConfig.name || manifest.name || widget.name || 'Custom Widget');

        const rawWidth = Number(widget.options.width ?? widgetConfig.width ?? manifest.window?.width ?? 320);
        const rawHeight = Number(widget.options.height ?? widgetConfig.height ?? manifest.window?.height ?? 240);
        const width = Number.isFinite(rawWidth) ? Math.max(200, Math.min(640, rawWidth)) : 320;
        const height = Number.isFinite(rawHeight) ? Math.max(160, Math.min(640, rawHeight)) : 240;

        widget.options.width = width;
        widget.options.height = height;
        widget.el.style.width = `${width}px`;
        widget.el.style.height = `${height}px`;
        widget.el.style.minWidth = `${Math.min(width, 220)}px`;
        widget.el.style.minHeight = `${Math.min(height, 160)}px`;
        widget.el.style.padding = '10px';
        widget.el.style.overflow = 'hidden';

        const escapeHtml = window.EphemeraSanitize?.escapeHtml
            ? (value) => window.EphemeraSanitize.escapeHtml(String(value))
            : (value) => String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

        widget.el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="color:var(--accent);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(title)}</span>
                <span class="widget-close" style="cursor:pointer;opacity:0.5;">&times;</span>
            </div>
            <div class="custom-widget-host" style="height:calc(100% - 28px);background:rgba(0,0,0,0.12);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-sm);overflow:hidden;"></div>
        `;

        const host = widget.el.querySelector('.custom-widget-host');
        widget.el.querySelector('.widget-close')?.addEventListener('click', () => this.remove(widget.id));

        if (!host) {
            return;
        }

        const appId = String(config.appId || manifest.id || `widget.${widget.id}`);
        const runtimeManifest = {
            ...manifest,
            id: appId,
            name: title,
            type: 'widget'
        };
        const widgetCode = typeof config.code === 'string' ? config.code : '';
        const windowId = Number(Date.now()) + Math.floor(Math.random() * 10000);

        if (window.EphemeraApps?.runUserApp && widgetCode.trim()) {
            try {
                window.EphemeraApps.runUserApp(host, widgetCode, windowId, runtimeManifest);
            } catch (e) {
                host.innerHTML = `
                    <div style="padding:10px;color:var(--danger);font-size:0.75rem;">
                        Failed to start widget runtime.
                    </div>
                `;
            }
        } else {
            host.innerHTML = `
                <div style="padding:10px;color:var(--fg-muted);font-size:0.75rem;">
                    No widget runtime available.
                </div>
            `;
        }

        widget._cleanup = () => {
            try {
                const frame = host.querySelector('iframe');
                if (frame) {
                    frame.srcdoc = '<!DOCTYPE html><html><body></body></html>';
                }
            } catch (_e) {
                // Ignore cleanup failures when frame is already detached.
            }
            host.innerHTML = '';
        };
    },

    _initPomodoro(widget) {
        widget.el.style.minWidth = '160px';
        
        let timeLeft = 25 * 60;
        let isRunning = false;
        let isBreak = false;
        let interval = null;

        const content = document.createElement('div');
        content.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="color:var(--accent);font-weight:500;">Pomodoro</span>
                <span class="widget-close" style="cursor:pointer;opacity:0.5;">&times;</span>
            </div>
            <div id="pomodoro-timer" style="font-size:2rem;font-weight:600;text-align:center;color:var(--fg-primary);font-family:'JetBrains Mono',monospace;">25:00</div>
            <div id="pomodoro-status" style="text-align:center;color:var(--fg-muted);font-size:0.75rem;margin:4px 0 10px;">Focus Time</div>
            <div style="display:flex;gap:6px;justify-content:center;">
                <button id="pomodoro-start" style="padding:6px 12px;background:var(--accent);border:none;color:#fff;border-radius:var(--radius-sm);cursor:pointer;font-size:0.75rem;">Start</button>
                <button id="pomodoro-reset" style="padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-size:0.75rem;">Reset</button>
            </div>
        `;
        widget.el.appendChild(content);

        const timerEl = content.querySelector('#pomodoro-timer');
        const statusEl = content.querySelector('#pomodoro-status');
        const startBtn = content.querySelector('#pomodoro-start');
        const resetBtn = content.querySelector('#pomodoro-reset');

        function formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }

        function updateDisplay() {
            timerEl.textContent = formatTime(timeLeft);
            statusEl.textContent = isBreak ? 'Break Time' : 'Focus Time';
            startBtn.textContent = isRunning ? 'Pause' : 'Start';
        }

        function tick() {
            if (timeLeft > 0) {
                timeLeft--;
                updateDisplay();
            } else {
                isRunning = false;
                clearInterval(interval);
                if (isBreak) {
                    isBreak = false;
                    timeLeft = 25 * 60;
                    EphemeraNotifications.success('Pomodoro', 'Break over! Time to focus.');
                } else {
                    isBreak = true;
                    timeLeft = 5 * 60;
                    EphemeraNotifications.success('Pomodoro Complete!', 'Great work! Take a 5-minute break.');
                }
                updateDisplay();
            }
        }

        startBtn.addEventListener('click', () => {
            if (isRunning) {
                isRunning = false;
                clearInterval(interval);
            } else {
                isRunning = true;
                interval = setInterval(tick, 1000);
            }
            updateDisplay();
        });

        resetBtn.addEventListener('click', () => {
            isRunning = false;
            clearInterval(interval);
            isBreak = false;
            timeLeft = 25 * 60;
            updateDisplay();
        });

        content.querySelector('.widget-close').addEventListener('click', () => {
            if (interval) clearInterval(interval);
            this.remove(widget.id);
        });

        widget._cleanup = () => {
            if (interval) clearInterval(interval);
        };

        updateDisplay();
    },

    _initQuickNotes(widget) {
        const key = 'ephemera_quicknotes_' + widget.id;
        widget.el.style.minWidth = '200px';
        widget.el.style.background = 'rgba(139,92,246,0.1)';
        widget.el.style.borderColor = 'rgba(139,92,246,0.3)';

        const saved = localStorage.getItem(key) || '';
        widget.el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="color:#a78bfa;font-weight:500;">Quick Notes</span>
                <span class="widget-close" style="cursor:pointer;opacity:0.5;">&times;</span>
            </div>
            <textarea style="width:100%;height:120px;background:transparent;border:none;color:var(--fg-primary);font-size:0.8rem;resize:vertical;outline:none;font-family:inherit;line-height:1.5;" placeholder="Type your notes here...">${EphemeraSanitize.escapeHtml(saved)}</textarea>
        `;

        const ta = widget.el.querySelector('textarea');
        ta.addEventListener('input', () => localStorage.setItem(key, ta.value));

        widget.el.querySelector('.widget-close').addEventListener('click', () => {
            localStorage.removeItem(key);
            this.remove(widget.id);
        });
    },

    _initCalendar(widget) {
        widget.el.style.minWidth = '220px';
        const content = document.createElement('div');
        widget.el.appendChild(content);

        const currentDate = new Date();
        let viewMonth = currentDate.getMonth();
        let viewYear = currentDate.getFullYear();

        const render = () => {
            const firstDay = new Date(viewYear, viewMonth, 1);
            const lastDay = new Date(viewYear, viewMonth + 1, 0);
            const startDay = firstDay.getDay();
            const daysInMonth = lastDay.getDate();

            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

            let daysHTML = '';
            for (let i = 0; i < startDay; i++) {
                daysHTML += '<div style="padding:4px;color:var(--fg-muted);opacity:0.3;"></div>';
            }
            for (let d = 1; d <= daysInMonth; d++) {
                const isToday = d === currentDate.getDate() && viewMonth === currentDate.getMonth() && viewYear === currentDate.getFullYear();
                daysHTML += `<div style="padding:4px;text-align:center;border-radius:4px;${isToday ? 'background:var(--accent);color:#fff;font-weight:600;' : ''}">${d}</div>`;
            }

            content.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <span style="color:var(--accent);font-weight:500;">${monthNames[viewMonth]} ${viewYear}</span>
                    <span class="widget-close" style="cursor:pointer;opacity:0.5;">&times;</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-size:0.7rem;margin-bottom:6px;color:var(--fg-muted);">
                    ${dayNames.map(d => `<div style="text-align:center;padding:2px;">${d}</div>`).join('')}
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-size:0.75rem;color:var(--fg-primary);">
                    ${daysHTML}
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:10px;">
                    <button class="cal-prev" style="padding:4px 10px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-size:0.7rem;">◀ Prev</button>
                    <button class="cal-today" style="padding:4px 10px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-size:0.7rem;">Today</button>
                    <button class="cal-next" style="padding:4px 10px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-size:0.7rem;">Next ▶</button>
                </div>
            `;

            content.querySelector('.cal-prev').addEventListener('click', () => {
                viewMonth--;
                if (viewMonth < 0) { viewMonth = 11; viewYear--; }
                render();
            });

            content.querySelector('.cal-next').addEventListener('click', () => {
                viewMonth++;
                if (viewMonth > 11) { viewMonth = 0; viewYear++; }
                render();
            });

            content.querySelector('.cal-today').addEventListener('click', () => {
                viewMonth = currentDate.getMonth();
                viewYear = currentDate.getFullYear();
                render();
            });

            content.querySelector('.widget-close').addEventListener('click', () => {
                this.remove(widget.id);
            });
        };

        render();
    }
};

window.EphemeraWidgets = EphemeraWidgets;
