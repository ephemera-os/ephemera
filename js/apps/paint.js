EphemeraApps.register({
    id: 'paint',
    name: 'Paint',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>`,
    width: 800,
    height: 600,
    category: 'creative',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .paint { display:flex;flex-direction:column;height:100%; }
                    .paint-toolbar { display:flex;gap:4px;padding:6px 8px;background:rgba(0,0,0,0.3);border-bottom:1px solid var(--border);align-items:center;flex-wrap:wrap; }
                    .paint-toolbar button { padding:5px 8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-secondary);font-size:0.75rem; }
                    .paint-toolbar button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .paint-toolbar button.active { background:var(--accent);color:var(--bg-primary);border-color:var(--accent); }
                    .paint-toolbar .sep { width:1px;height:20px;background:var(--border);margin:0 4px; }
                    .paint-toolbar input[type=color] { width:30px;height:24px;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:0;background:transparent; }
                    .paint-toolbar input[type=range] { width:80px;accent-color:var(--accent); }
                    .paint-toolbar .label { font-size:0.7rem;color:var(--fg-muted); }
                    .paint-canvas { flex:1;overflow:auto;background:#fff;cursor:crosshair;position:relative; }
                    .paint-canvas canvas { display:block; }
                    .paint-status { display:flex;justify-content:space-between;padding:4px 8px;font-size:0.7rem;color:var(--fg-muted);background:rgba(0,0,0,0.2);border-top:1px solid var(--border); }
                </style>
                <div class="paint">
                    <div class="paint-toolbar">
                        <button class="active" data-tool="brush" id="pt-brush-${windowId}">Brush</button>
                        <button data-tool="eraser" id="pt-eraser-${windowId}">Eraser</button>
                        <button data-tool="line" id="pt-line-${windowId}">Line</button>
                        <button data-tool="rect" id="pt-rect-${windowId}">Rect</button>
                        <button data-tool="circle" id="pt-circle-${windowId}">Circle</button>
                        <button data-tool="fill" id="pt-fill-${windowId}">Fill</button>
                        <div class="sep"></div>
                        <input type="color" id="pt-color-${windowId}" value="#00d4aa" title="Color">
                        <span class="label">Size:</span>
                        <input type="range" id="pt-size-${windowId}" min="1" max="50" value="4">
                        <div class="sep"></div>
                        <button id="pt-undo-${windowId}">Undo</button>
                        <button id="pt-redo-${windowId}">Redo</button>
                        <button id="pt-clear-${windowId}">Clear</button>
                        <button id="pt-save-${windowId}">Save</button>
                    </div>
                    <div class="paint-canvas" id="pt-container-${windowId}">
                        <canvas id="pt-canvas-${windowId}"></canvas>
                    </div>
                    <div class="paint-status">
                        <span id="pt-pos-${windowId}">0, 0</span>
                        <span id="pt-tool-${windowId}">Brush | Size: 4</span>
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const container = document.getElementById(`pt-container-${windowId}`);
                const canvas = document.getElementById(`pt-canvas-${windowId}`);
                const ctx = canvas.getContext('2d');
                const colorInput = document.getElementById(`pt-color-${windowId}`);
                const sizeInput = document.getElementById(`pt-size-${windowId}`);
                const posEl = document.getElementById(`pt-pos-${windowId}`);
                const toolEl = document.getElementById(`pt-tool-${windowId}`);

                canvas.width = 760;
                canvas.height = 500;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                let tool = 'brush', drawing = false, startX = 0, startY = 0;
                const undoStack = [];
                let redoStack = [];
                let originalState = canvas.toDataURL();
                let currentFile = null;

                function setDirty(dirty) {
                    EphemeraWM.setDirty(windowId, dirty);
                }

                function checkDirty() {
                    const currentState = canvas.toDataURL();
                    setDirty(currentState !== originalState);
                }

                function saveState() {
                    undoStack.push(canvas.toDataURL());
                    if (undoStack.length > 30) undoStack.shift();
                    redoStack = [];
                }
                saveState();

                async function saveImage() {
                    const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                    if (currentFile) {
                        const dataUrl = canvas.toDataURL('image/png');
                        await EphemeraFS.writeFile(currentFile, dataUrl);
                        originalState = dataUrl;
                        setDirty(false);
                        EphemeraNotifications.success('Saved', `Image saved to ${EphemeraFS.getBasename(currentFile)}`);
                        return true;
                    }
                    
                    return new Promise((resolve) => {
                        EphemeraWM.open('files', {
                            mode: 'save',
                            modal: true,
                            parentWindowId: windowId,
                            startPath: `${homeDir}/Pictures`,
                            saveFileName: 'drawing.png',
                            onSave: async (path) => {
                                const dataUrl = canvas.toDataURL('image/png');
                                await EphemeraFS.writeFile(path, dataUrl);
                                currentFile = path;
                                originalState = dataUrl;
                                setDirty(false);
                                EphemeraNotifications.success('Saved', `Image saved to ${EphemeraFS.getBasename(path)}`);
                                resolve(true);
                            },
                            onCancel: () => {
                                resolve(false);
                            }
                        });
                    });
                }

                function setTool(t) {
                    tool = t;
                    container.querySelectorAll('.paint-toolbar button[data-tool]')
                        .forEach(b => b.classList.toggle('active', b.dataset.tool === t));
                    toolEl.textContent = `${t.charAt(0).toUpperCase() + t.slice(1)} | Size: ${sizeInput.value}`;
                }

                container.closest('.window-content').querySelectorAll('.paint-toolbar button[data-tool]').forEach(b => {
                    lifecycle.addListener(b, 'click', () => setTool(b.dataset.tool));
                });

                lifecycle.addListener(sizeInput, 'input', () => {
                    toolEl.textContent = `${tool.charAt(0).toUpperCase() + tool.slice(1)} | Size: ${sizeInput.value}`;
                });

                function getPos(e) {
                    const r = canvas.getBoundingClientRect();
                    return { x: e.clientX - r.left, y: e.clientY - r.top };
                }

                lifecycle.addListener(canvas, 'mousedown', (e) => {
                    drawing = true;
                    const p = getPos(e);
                    startX = p.x; startY = p.y;

                    if (tool === 'brush' || tool === 'eraser') {
                        saveState();
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                    } else if (tool === 'fill') {
                        saveState();
                        floodFill(Math.round(p.x), Math.round(p.y), colorInput.value);
                    }
                });

                lifecycle.addListener(canvas, 'mousemove', (e) => {
                    const p = getPos(e);
                    posEl.textContent = `${Math.round(p.x)}, ${Math.round(p.y)}`;

                    if (!drawing) return;
                    if (tool === 'brush') {
                        ctx.strokeStyle = colorInput.value;
                        ctx.lineWidth = parseInt(sizeInput.value);
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.lineTo(p.x, p.y);
                        ctx.stroke();
                    } else if (tool === 'eraser') {
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = parseInt(sizeInput.value) * 2;
                        ctx.lineCap = 'round';
                        ctx.lineTo(p.x, p.y);
                        ctx.stroke();
                    }
                });

                lifecycle.addListener(canvas, 'mouseup', (e) => {
                    if (!drawing) return;
                    drawing = false;
                    const p = getPos(e);

                    if (tool === 'line' || tool === 'rect' || tool === 'circle') {
                        saveState();
                        ctx.strokeStyle = colorInput.value;
                        ctx.lineWidth = parseInt(sizeInput.value);
                        ctx.lineCap = 'round';

                        if (tool === 'line') {
                            ctx.beginPath();
                            ctx.moveTo(startX, startY);
                            ctx.lineTo(p.x, p.y);
                            ctx.stroke();
                        } else if (tool === 'rect') {
                            ctx.strokeRect(startX, startY, p.x - startX, p.y - startY);
                        } else if (tool === 'circle') {
                            const rx = Math.abs(p.x - startX) / 2;
                            const ry = Math.abs(p.y - startY) / 2;
                            const cx = startX + (p.x - startX) / 2;
                            const cy = startY + (p.y - startY) / 2;
                            ctx.beginPath();
                            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                    }
                    checkDirty();
                });

                lifecycle.addListener(canvas, 'mouseleave', () => {
                    if (drawing && (tool === 'brush' || tool === 'eraser')) {
                        checkDirty();
                    }
                    drawing = false;
                });

                function floodFill(sx, sy, fillColor) {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    const w = canvas.width, h = canvas.height;
                    const idx = (sy * w + sx) * 4;
                    const tr = data[idx], tg = data[idx + 1], tb = data[idx + 2];

                    const hex = fillColor.replace('#', '');
                    const fr = parseInt(hex.substr(0, 2), 16);
                    const fg = parseInt(hex.substr(2, 2), 16);
                    const fb = parseInt(hex.substr(4, 2), 16);
                    if (tr === fr && tg === fg && tb === fb) return;

                    const stack = [[sx, sy]];
                    const visited = new Set();
                    while (stack.length > 0) {
                        const [x, y] = stack.pop();
                        if (x < 0 || x >= w || y < 0 || y >= h) continue;
                        const key = y * w + x;
                        if (visited.has(key)) continue;
                        const i = key * 4;
                        if (Math.abs(data[i] - tr) > 10 || Math.abs(data[i + 1] - tg) > 10 || Math.abs(data[i + 2] - tb) > 10) continue;
                        visited.add(key);
                        data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = 255;
                        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
                    }
                    ctx.putImageData(imageData, 0, 0);
                    checkDirty();
                }

                lifecycle.addListener(document.getElementById(`pt-undo-${windowId}`), 'click', () => {
                    if (undoStack.length <= 1) return;
                    redoStack.push(undoStack.pop());
                    const img = new Image();
                    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); checkDirty(); };
                    img.src = undoStack[undoStack.length - 1];
                });

                lifecycle.addListener(document.getElementById(`pt-redo-${windowId}`), 'click', () => {
                    if (redoStack.length === 0) return;
                    const state = redoStack.pop();
                    undoStack.push(state);
                    const img = new Image();
                    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); checkDirty(); };
                    img.src = state;
                });

                lifecycle.addListener(document.getElementById(`pt-clear-${windowId}`), 'click', () => {
                    saveState();
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    checkDirty();
                });

                lifecycle.addListener(document.getElementById(`pt-save-${windowId}`), 'click', saveImage);

                lifecycle.addListener(document, 'keydown', (e) => {
                    if (e.ctrlKey && e.key === 's' && EphemeraState.activeWindowId === windowId) {
                        e.preventDefault();
                        saveImage();
                    }
                });

                return {
                    onSave: async () => {
                        return await saveImage();
                    },
                    destroy: lifecycle.destroy
                };
            }
        };
    }
});
