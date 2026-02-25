EphemeraApps.register({
    id: 'sysmonitor',
    name: 'System Monitor',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><polyline points="6 10 10 7 14 12 18 8"/></svg>`,
    width: 650,
    height: 450,
    category: 'system',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .sysmon { display:flex;flex-direction:column;height:100%;gap:12px; }
                    .sysmon-cards { display:grid;grid-template-columns:repeat(4,1fr);gap:10px; }
                    .sysmon-card { background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;text-align:center; }
                    .sysmon-card .value { font-size:1.4rem;font-weight:600;color:var(--accent); }
                    .sysmon-card .label { font-size:0.7rem;color:var(--fg-muted);margin-top:4px; }
                    .sysmon-chart { flex:1;background:rgba(0,0,0,0.2);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;min-height:150px; }
                    .sysmon-footer { display:flex;justify-content:space-between;font-size:0.75rem;color:var(--fg-muted); }
                </style>
                <div class="sysmon">
                    <div class="sysmon-cards">
                        <div class="sysmon-card"><div class="value" id="sm-wins-${windowId}">0</div><div class="label">Windows</div></div>
                        <div class="sysmon-card"><div class="value" id="sm-files-${windowId}">0</div><div class="label">Files</div></div>
                        <div class="sysmon-card"><div class="value" id="sm-events-${windowId}">0</div><div class="label">Event Types</div></div>
                        <div class="sysmon-card"><div class="value" id="sm-storage-${windowId}">-</div><div class="label">Storage Used</div></div>
                    </div>
                    <div class="sysmon-chart"><canvas id="sm-canvas-${windowId}" style="width:100%;height:100%;"></canvas></div>
                    <div class="sysmon-footer">
                        <span id="sm-uptime-${windowId}">Uptime: 0m</span>
                        <span id="sm-mem-${windowId}">Memory: --</span>
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const winsEl = document.getElementById(`sm-wins-${windowId}`);
                const filesEl = document.getElementById(`sm-files-${windowId}`);
                const eventsEl = document.getElementById(`sm-events-${windowId}`);
                const storageEl = document.getElementById(`sm-storage-${windowId}`);
                const uptimeEl = document.getElementById(`sm-uptime-${windowId}`);
                const memEl = document.getElementById(`sm-mem-${windowId}`);
                const canvas = document.getElementById(`sm-canvas-${windowId}`);
                const ctx = canvas.getContext('2d');

                const history = [];
                const maxPoints = 60;

                function resize() {
                    canvas.width = canvas.clientWidth;
                    canvas.height = canvas.clientHeight;
                }
                resize();
                const resObs = new ResizeObserver(resize);
                resObs.observe(canvas);
                // Track ResizeObserver for cleanup
                const origDisconnect = resObs.disconnect.bind(resObs);
                lifecycle.addSubscription(() => origDisconnect());

                async function update() {
                    winsEl.textContent = EphemeraState.windows.length;
                    eventsEl.textContent = EphemeraEvents.listeners.size;
                    uptimeEl.textContent = `Uptime: ${((Date.now() - performance.timeOrigin) / 60000).toFixed(0)}m`;

                    if (performance.memory) {
                        memEl.textContent = `Memory: ${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB`;
                    }

                    try {
                        const allFiles = await EphemeraStorage.getAll('files');
                        filesEl.textContent = allFiles.length;
                    } catch (e) { filesEl.textContent = '?'; }

                    try {
                        const est = await navigator.storage.estimate();
                        const usedMB = (est.usage / 1048576).toFixed(1);
                        storageEl.textContent = usedMB + 'MB';
                    } catch (e) { storageEl.textContent = '?'; }

                    history.push(EphemeraState.windows.length);
                    if (history.length > maxPoints) history.shift();
                    drawChart();
                }

                function drawChart() {
                    const w = canvas.width, h = canvas.height;
                    ctx.clearRect(0, 0, w, h);
                    if (history.length < 2) return;

                    const max = Math.max(1, ...history);
                    const stepX = w / (maxPoints - 1);

                    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                    ctx.lineWidth = 1;
                    for (let i = 0; i <= 4; i++) {
                        const y = (h / 4) * i;
                        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                    }

                    ctx.beginPath();
                    ctx.strokeStyle = '#00d4aa';
                    ctx.lineWidth = 2;
                    history.forEach((v, i) => {
                        const x = i * stepX;
                        const y = h - (v / max) * (h - 20) - 10;
                        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    });
                    ctx.stroke();

                    const grad = ctx.createLinearGradient(0, 0, 0, h);
                    grad.addColorStop(0, 'rgba(0,212,170,0.2)');
                    grad.addColorStop(1, 'rgba(0,212,170,0)');
                    ctx.lineTo((history.length - 1) * stepX, h);
                    ctx.lineTo(0, h);
                    ctx.fillStyle = grad;
                    ctx.fill();
                }

                update();
                lifecycle.addInterval(setInterval(update, 2000));

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
