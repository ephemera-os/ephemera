EphemeraApps.register({
    id: 'colorpicker',
    name: 'Color Picker',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg>`,
    width: 550,
    height: 520,
    category: 'utility',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .color-container { display:flex;flex-direction:column;height:100%;padding:16px;gap:16px; }
                    .color-preview { display:flex;gap:16px; }
                    .color-preview-main { flex:1;height:120px;border-radius:var(--radius-md);border:1px solid var(--border);position:relative; }
                    .color-preview-hex { position:absolute;bottom:12px;left:50%;transform:translateX(-50%);padding:6px 12px;background:rgba(0,0,0,0.7);color:#fff;border-radius:var(--radius-sm);font-family:'JetBrains Mono',monospace;font-size:0.9rem;cursor:pointer; }
                    .color-harmony { width:180px;background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;border:1px solid var(--border); }
                    .color-harmony-title { font-size:0.75rem;color:var(--fg-muted);margin-bottom:10px;text-transform:uppercase; }
                    .color-harmony-colors { display:grid;grid-template-columns:repeat(4,1fr);gap:6px; }
                    .color-harmony-item { aspect-ratio:1;border-radius:var(--radius-sm);cursor:pointer;border:1px solid var(--border); }
                    .color-harmony-item:hover { transform:scale(1.1); }
                    .color-picker-area { position:relative;height:200px;border-radius:var(--radius-md);overflow:hidden;cursor:crosshair; }
                    .color-picker-area canvas { width:100%;height:100%; }
                    .color-picker-pointer { position:absolute;width:16px;height:16px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.5);pointer-events:none;transform:translate(-50%,-50%); }
                    .color-controls { display:flex;gap:16px; }
                    .color-slider-group { flex:1; }
                    .color-slider-label { display:flex;justify-content:space-between;font-size:0.75rem;color:var(--fg-muted);margin-bottom:6px; }
                    .color-slider { height:24px;border-radius:var(--radius-sm);position:relative;cursor:pointer;overflow:hidden; }
                    .color-slider-hue { background:linear-gradient(to right,red,yellow,lime,cyan,blue,magenta,red); }
                    .color-slider-alpha { background:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAADFJREFUOE9jZGBg+M+ABRw6dOg/I7miRwoMv0ckNoBI+AKZEwXiDQBAW4IFmL5KZgAAAABJRU5ErkJggg=='),linear-gradient(to right,transparent,var(--current-color));background-size:8px 8px,100% 100%; }
                    .color-slider-pointer { position:absolute;top:0;width:4px;height:100%;background:#fff;border:1px solid #000;cursor:ew-resize; }
                    .color-inputs { display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px; }
                    .color-input-group { }
                    .color-input-group label { display:block;font-size:0.75rem;color:var(--fg-muted);margin-bottom:4px; }
                    .color-input-group input { width:100%;padding:8px 10px;background:var(--bg-primary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-sm);font-family:'JetBrains Mono',monospace;font-size:0.85rem;text-align:center; }
                    .color-input-group input:focus { outline:none;border-color:var(--accent); }
                    .color-history { margin-top:auto; }
                    .color-history-title { font-size:0.75rem;color:var(--fg-muted);margin-bottom:8px; }
                    .color-history-list { display:flex;gap:8px; }
                    .color-history-item { width:32px;height:32px;border-radius:var(--radius-sm);cursor:pointer;border:1px solid var(--border); }
                    .color-history-item:hover { transform:scale(1.1); }
                    .color-copy-buttons { display:flex;gap:8px;margin-top:12px; }
                    .color-copy-btn { flex:1;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.8rem;transition:all 0.15s; }
                    .color-copy-btn:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                </style>
                <div class="color-container">
                    <div class="color-preview">
                        <div class="color-preview-main" id="color-preview-${windowId}">
                            <div class="color-preview-hex" id="color-hex-display-${windowId}">#FFFFFF</div>
                        </div>
                        <div class="color-harmony">
                            <div class="color-harmony-title">Harmony Colors</div>
                            <div class="color-harmony-colors" id="color-harmony-${windowId}"></div>
                        </div>
                    </div>
                    <div class="color-picker-area" id="color-area-${windowId}">
                        <canvas id="color-canvas-${windowId}"></canvas>
                        <div class="color-picker-pointer" id="color-pointer-${windowId}"></div>
                    </div>
                    <div class="color-controls">
                        <div class="color-slider-group">
                            <div class="color-slider-label"><span>Hue</span><span id="color-hue-val-${windowId}">0°</span></div>
                            <div class="color-slider color-slider-hue" id="color-hue-slider-${windowId}">
                                <div class="color-slider-pointer" id="color-hue-pointer-${windowId}"></div>
                            </div>
                        </div>
                        <div class="color-slider-group">
                            <div class="color-slider-label"><span>Alpha</span><span id="color-alpha-val-${windowId}">100%</span></div>
                            <div class="color-slider color-slider-alpha" id="color-alpha-slider-${windowId}" style="--current-color:#fff">
                                <div class="color-slider-pointer" id="color-alpha-pointer-${windowId}"></div>
                            </div>
                        </div>
                    </div>
                    <div class="color-inputs">
                        <div class="color-input-group">
                            <label>HEX</label>
                            <input type="text" id="color-input-hex-${windowId}" value="#FFFFFF">
                        </div>
                        <div class="color-input-group">
                            <label>RGB</label>
                            <input type="text" id="color-input-rgb-${windowId}" value="255, 255, 255">
                        </div>
                        <div class="color-input-group">
                            <label>HSL</label>
                            <input type="text" id="color-input-hsl-${windowId}" value="0°, 0%, 100%">
                        </div>
                    </div>
                    <div class="color-copy-buttons">
                        <button class="color-copy-btn" data-format="hex">Copy HEX</button>
                        <button class="color-copy-btn" data-format="rgb">Copy RGB</button>
                        <button class="color-copy-btn" data-format="hsl">Copy HSL</button>
                        <button class="color-copy-btn" data-format="rgba">Copy RGBA</button>
                    </div>
                    <div class="color-history">
                        <div class="color-history-title">Recent Colors</div>
                        <div class="color-history-list" id="color-history-${windowId}"></div>
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const previewEl = document.getElementById(`color-preview-${windowId}`);
                const hexDisplayEl = document.getElementById(`color-hex-display-${windowId}`);
                const canvas = document.getElementById(`color-canvas-${windowId}`);
                const ctx = canvas.getContext('2d');
                const pointerEl = document.getElementById(`color-pointer-${windowId}`);
                const hueSlider = document.getElementById(`color-hue-slider-${windowId}`);
                const huePointer = document.getElementById(`color-hue-pointer-${windowId}`);
                const hueValEl = document.getElementById(`color-hue-val-${windowId}`);
                const alphaSlider = document.getElementById(`color-alpha-slider-${windowId}`);
                const alphaPointer = document.getElementById(`color-alpha-pointer-${windowId}`);
                const alphaValEl = document.getElementById(`color-alpha-val-${windowId}`);
                const harmonyEl = document.getElementById(`color-harmony-${windowId}`);
                const historyEl = document.getElementById(`color-history-${windowId}`);

                const inputHex = document.getElementById(`color-input-hex-${windowId}`);
                const inputRgb = document.getElementById(`color-input-rgb-${windowId}`);
                const inputHsl = document.getElementById(`color-input-hsl-${windowId}`);

                let currentHue = 0;
                let currentSat = 100;
                let currentLight = 50;
                let currentAlpha = 1;
                let colorHistory = [];

                function initCanvas() {
                    canvas.width = canvas.offsetWidth * 2;
                    canvas.height = canvas.offsetHeight * 2;
                    drawCanvas();
                }

                function drawCanvas() {
                    const width = canvas.width;
                    const height = canvas.height;

                    for (let x = 0; x < width; x++) {
                        for (let y = 0; y < height; y++) {
                            const sat = (x / width) * 100;
                            const light = 100 - (y / height) * 100;
                            ctx.fillStyle = `hsl(${currentHue}, ${sat}%, ${light}%)`;
                            ctx.fillRect(x, y, 1, 1);
                        }
                    }
                }

                function updateColor() {
                    const rgb = hslToRgb(currentHue, currentSat, currentLight);
                    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
                    const hsl = `hsl(${Math.round(currentHue)}, ${Math.round(currentSat)}%, ${Math.round(currentLight)}%)`;

                    previewEl.style.background = hsl;
                    alphaSlider.style.setProperty('--current-color', hsl);
                    hexDisplayEl.textContent = hex;

                    inputHex.value = hex;
                    inputRgb.value = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
                    inputHsl.value = `${Math.round(currentHue)}°, ${Math.round(currentSat)}%, ${Math.round(currentLight)}%`;

                    updatePointer();
                    updateHarmony();
                }

                function updatePointer() {
                    const rect = canvas.getBoundingClientRect();
                    const x = (currentSat / 100) * rect.width;
                    const y = ((100 - currentLight) / 100) * rect.height;
                    pointerEl.style.left = x + 'px';
                    pointerEl.style.top = y + 'px';
                }

                function updateHarmony() {
                    const harmonies = [
                        currentHue,
                        (currentHue + 30) % 360,
                        (currentHue + 60) % 360,
                        (currentHue + 180) % 360,
                        (currentHue + 210) % 360,
                        (currentHue + 240) % 360,
                        (currentHue + 120) % 360,
                        (currentHue + 300) % 360
                    ];

                    harmonyEl.innerHTML = harmonies.map(h => 
                        `<div class="color-harmony-item" style="background:hsl(${h}, ${currentSat}%, ${currentLight}%)" data-hue="${h}" title="HSL(${Math.round(h)}, ${Math.round(currentSat)}%, ${Math.round(currentLight)}%)"></div>`
                    ).join('');

                    harmonyEl.querySelectorAll('.color-harmony-item').forEach(item => {
                        item.addEventListener('click', () => {
                            currentHue = parseFloat(item.dataset.hue);
                            hueValEl.textContent = Math.round(currentHue) + '°';
                            huePointer.style.left = (currentHue / 360 * 100) + '%';
                            drawCanvas();
                            updateColor();
                        });
                    });
                }

                function hslToRgb(h, s, l) {
                    s /= 100;
                    l /= 100;
                    const c = (1 - Math.abs(2 * l - 1)) * s;
                    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
                    const m = l - c / 2;
                    let r = 0, g = 0, b = 0;

                    if (h < 60) { r = c; g = x; }
                    else if (h < 120) { r = x; g = c; }
                    else if (h < 180) { g = c; b = x; }
                    else if (h < 240) { g = x; b = c; }
                    else if (h < 300) { r = x; b = c; }
                    else { r = c; b = x; }

                    return {
                        r: Math.round((r + m) * 255),
                        g: Math.round((g + m) * 255),
                        b: Math.round((b + m) * 255)
                    };
                }

                function rgbToHex(r, g, b) {
                    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
                }

                function hexToRgb(hex) {
                    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                    return result ? {
                        r: parseInt(result[1], 16),
                        g: parseInt(result[2], 16),
                        b: parseInt(result[3], 16)
                    } : null;
                }

                function rgbToHsl(r, g, b) {
                    r /= 255; g /= 255; b /= 255;
                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    let h, s;
                    const l = (max + min) / 2;

                    if (max === min) {
                        h = s = 0;
                    } else {
                        const d = max - min;
                        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                        switch (max) {
                            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                            case g: h = ((b - r) / d + 2) / 6; break;
                            case b: h = ((r - g) / d + 4) / 6; break;
                        }
                    }
                    return { h: h * 360, s: s * 100, l: l * 100 };
                }

                function addToHistory() {
                    const hsl = `hsl(${Math.round(currentHue)}, ${Math.round(currentSat)}%, ${Math.round(currentLight)}%)`;
                    if (colorHistory.includes(hsl)) return;
                    colorHistory.unshift(hsl);
                    colorHistory = colorHistory.slice(0, 8);
                    renderHistory();
                }

                function renderHistory() {
                    historyEl.innerHTML = colorHistory.map(c => 
                        `<div class="color-history-item" style="background:${c}" data-color="${c}" title="${c}"></div>`
                    ).join('');

                    historyEl.querySelectorAll('.color-history-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const match = item.dataset.color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
                            if (match) {
                                currentHue = parseFloat(match[1]);
                                currentSat = parseFloat(match[2]);
                                currentLight = parseFloat(match[3]);
                                hueValEl.textContent = Math.round(currentHue) + '°';
                                huePointer.style.left = (currentHue / 360 * 100) + '%';
                                drawCanvas();
                                updateColor();
                            }
                        });
                    });
                }

                lifecycle.addListener(canvas.parentElement, 'click', (e) => {
                    const rect = canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    currentSat = (x / rect.width) * 100;
                    currentLight = 100 - (y / rect.height) * 100;
                    updateColor();
                    addToHistory();
                });

                lifecycle.addListener(canvas.parentElement, 'mousemove', (e) => {
                    if (e.buttons !== 1) return;
                    const rect = canvas.getBoundingClientRect();
                    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
                    currentSat = (x / rect.width) * 100;
                    currentLight = 100 - (y / rect.height) * 100;
                    updateColor();
                });

                lifecycle.addListener(canvas.parentElement, 'mouseup', () => addToHistory());

                lifecycle.addListener(hueSlider, 'click', (e) => {
                    const rect = hueSlider.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    currentHue = (x / rect.width) * 360;
                    hueValEl.textContent = Math.round(currentHue) + '°';
                    huePointer.style.left = (currentHue / 360 * 100) + '%';
                    drawCanvas();
                    updateColor();
                    addToHistory();
                });

                lifecycle.addListener(alphaSlider, 'click', (e) => {
                    const rect = alphaSlider.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    currentAlpha = x / rect.width;
                    alphaValEl.textContent = Math.round(currentAlpha * 100) + '%';
                    alphaPointer.style.left = (currentAlpha * 100) + '%';
                });

                lifecycle.addListener(inputHex, 'change', () => {
                    const rgb = hexToRgb(inputHex.value);
                    if (rgb) {
                        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
                        currentHue = hsl.h;
                        currentSat = hsl.s;
                        currentLight = hsl.l;
                        hueValEl.textContent = Math.round(currentHue) + '°';
                        huePointer.style.left = (currentHue / 360 * 100) + '%';
                        drawCanvas();
                        updateColor();
                        addToHistory();
                    }
                });

                lifecycle.addListener(hexDisplayEl, 'click', () => {
                    navigator.clipboard.writeText(inputHex.value);
                    EphemeraNotifications.success('Copied', inputHex.value + ' copied to clipboard');
                });

                document.querySelectorAll('.color-copy-btn').forEach(btn => {
                    lifecycle.addListener(btn, 'click', () => {
                        const rgb = hslToRgb(currentHue, currentSat, currentLight);
                        let value;
                        switch (btn.dataset.format) {
                            case 'hex': value = inputHex.value; break;
                            case 'rgb': value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`; break;
                            case 'hsl': value = inputHsl.value.replace(/°/g, '').replace(/%/g, '%'); value = `hsl(${value})`; break;
                            case 'rgba': value = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${currentAlpha.toFixed(2)})`; break;
                        }
                        navigator.clipboard.writeText(value);
                        EphemeraNotifications.success('Copied', value + ' copied');
                    });
                });

                setTimeout(initCanvas, 100);
                lifecycle.addListener(window, 'resize', initCanvas);

                currentHue = Math.random() * 360;
                currentSat = 70;
                currentLight = 50;
                hueValEl.textContent = Math.round(currentHue) + '°';
                huePointer.style.left = (currentHue / 360 * 100) + '%';
                updateColor();

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
