EphemeraApps.register({
    id: 'imageviewer',
    name: 'Image Viewer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
    width: 700,
    height: 500,
    category: 'media',
    content: (windowId, options = {}) => {
        const filePath = options.filePath || null;
        return {
            html: `
                <style>
                    .imgview { display:flex;flex-direction:column;height:100%;background:#0a0a0f; }
                    .imgview-toolbar { display:flex;gap:6px;padding:8px;background:rgba(0,0,0,0.3);border-bottom:1px solid var(--border);align-items:center; }
                    .imgview-toolbar button { padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-secondary);font-size:0.75rem; }
                    .imgview-toolbar button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .imgview-toolbar .spacer { flex:1; }
                    .imgview-toolbar .info { font-size:0.75rem;color:var(--fg-muted); }
                    .imgview-canvas { flex:1;display:flex;align-items:center;justify-content:center;overflow:auto;position:relative; }
                    .imgview-canvas img { max-width:100%;max-height:100%;object-fit:contain;transition:transform 0.2s; }
                    .imgview-empty { color:var(--fg-muted);text-align:center; }
                    .imgview-empty svg { width:48px;height:48px;opacity:0.3;margin-bottom:12px;display:block;margin:0 auto 12px; }
                </style>
                <div class="imgview">
                    <div class="imgview-toolbar">
                        <button id="iv-open-${windowId}">Open</button>
                        <button id="iv-zoomin-${windowId}">+</button>
                        <button id="iv-zoomout-${windowId}">-</button>
                        <button id="iv-fit-${windowId}">Fit</button>
                        <button id="iv-rotate-${windowId}">Rotate</button>
                        <span class="spacer"></span>
                        <span class="info" id="iv-info-${windowId}"></span>
                    </div>
                    <div class="imgview-canvas" id="iv-canvas-${windowId}">
                        <div class="imgview-empty" id="iv-empty-${windowId}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                            <p>Open an image file to view it</p>
                        </div>
                    </div>
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();

                const canvas = document.getElementById(`iv-canvas-${windowId}`);
                const emptyEl = document.getElementById(`iv-empty-${windowId}`);
                const infoEl = document.getElementById(`iv-info-${windowId}`);
                let zoom = 1, rotation = 0, imgEl = null;

                function updateTransform() {
                    if (imgEl) imgEl.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
                }

                async function loadImage(path) {
                    const content = await EphemeraFS.readFile(path);
                    if (content === null) return;
                    emptyEl.style.display = 'none';
                    if (imgEl) imgEl.remove();

                    imgEl = document.createElement('img');
                    const mime = EphemeraFS.getMimeType(path) || 'image/png';
                    
                    if (typeof content === 'string' && content.startsWith('data:')) {
                        imgEl.src = content;
                    } else if (typeof content === 'string' && content.startsWith('<svg')) {
                        imgEl.src = 'data:image/svg+xml;base64,' + btoa(content);
                    } else if (content instanceof ArrayBuffer) {
                        const blob = new Blob([content], { type: mime });
                        imgEl.src = URL.createObjectURL(blob);
                    } else if (content && typeof content === 'object' && content.buffer instanceof ArrayBuffer) {
                        const blob = new Blob([content.buffer], { type: mime });
                        imgEl.src = URL.createObjectURL(blob);
                    } else if (typeof content === 'string') {
                        imgEl.src = `data:${mime};base64,${content}`;
                    } else {
                        console.error('Unknown content type for image:', typeof content, content);
                        infoEl.textContent = 'Unsupported image format';
                        return;
                    }
                    
                    imgEl.onload = () => {
                        infoEl.textContent = `${imgEl.naturalWidth}x${imgEl.naturalHeight} - ${EphemeraFS.getBasename(path)}`;
                    };
                    imgEl.onerror = () => {
                        infoEl.textContent = 'Failed to load image';
                    };
                    zoom = 1; rotation = 0;
                    canvas.appendChild(imgEl);
                }

                lifecycle.addListener(document.getElementById(`iv-zoomin-${windowId}`), 'click', () => { zoom = Math.min(5, zoom + 0.25); updateTransform(); });
                lifecycle.addListener(document.getElementById(`iv-zoomout-${windowId}`), 'click', () => { zoom = Math.max(0.1, zoom - 0.25); updateTransform(); });
                lifecycle.addListener(document.getElementById(`iv-fit-${windowId}`), 'click', () => { zoom = 1; rotation = 0; updateTransform(); });
                lifecycle.addListener(document.getElementById(`iv-rotate-${windowId}`), 'click', () => { rotation = (rotation + 90) % 360; updateTransform(); });
                lifecycle.addListener(document.getElementById(`iv-open-${windowId}`), 'click', () => {
                    EphemeraWM.open('files', { mode: 'open', onFileSelect: (path) => loadImage(path), modal: true, parentWindowId: windowId });
                });

                if (filePath) loadImage(filePath);

                return {
                    destroy: () => {
                        // Clean up blob URLs
                        if (imgEl && imgEl.src && imgEl.src.startsWith('blob:')) {
                            URL.revokeObjectURL(imgEl.src);
                        }
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
