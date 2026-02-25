let _pdfjsLibPromise = null;

function loadPdfJsLib() {
    if (!_pdfjsLibPromise) {
        _pdfjsLibPromise = import('pdfjs-dist/build/pdf.mjs').then((pdfJsModule) => {
            const pdfjsLib = pdfJsModule.default || pdfJsModule;
            // Keep PDF.js fully vendored but avoid bundling the large worker chunk.
            // Rendering runs on the main thread (acceptable for small/medium documents).
            pdfjsLib.GlobalWorkerOptions.workerSrc = '';
            return pdfjsLib;
        });
    }

    return _pdfjsLibPromise;
}

EphemeraApps.register({
    id: 'pdfviewer',
    name: 'PDF Viewer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-2h1.5a1.5 1.5 0 010 3H9"/><path d="M15 15v-2a1.5 1.5 0 013 0v2"/><path d="M15 13h3"/></svg>`,
    width: 900,
    height: 700,
    category: 'utility',
    content: (windowId, _options = {}) => {
        return {
            html: `
                <style>
                    .pdf-container { display:flex;flex-direction:column;height:100%;background:#2a2a35; }
                    .pdf-toolbar { display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border);flex-wrap:wrap; }
                    .pdf-toolbar button { padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.8rem;transition:all 0.15s; }
                    .pdf-toolbar button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .pdf-toolbar button:disabled { opacity:0.4;cursor:not-allowed; }
                    .pdf-toolbar input[type="file"] { display:none; }
                    .pdf-toolbar .filename { flex:1;color:var(--fg-primary);font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
                    .pdf-toolbar .page-info { color:var(--fg-muted);font-size:0.8rem;font-family:'JetBrains Mono',monospace;min-width:100px;text-align:center; }
                    .pdf-toolbar .zoom-controls { display:flex;align-items:center;gap:6px; }
                    .pdf-toolbar .zoom-value { min-width:50px;text-align:center;color:var(--fg-secondary);font-size:0.8rem; }
                    .pdf-main { flex:1;display:flex;overflow:hidden; }
                    .pdf-sidebar { width:200px;background:var(--bg-secondary);border-right:1px solid var(--border);display:none;flex-direction:column;overflow:hidden; }
                    .pdf-sidebar.open { display:flex; }
                    .pdf-sidebar-header { padding:12px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:500;color:var(--fg-secondary); }
                    .pdf-thumbnails { flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px; }
                    .pdf-thumbnail { cursor:pointer;border:2px solid transparent;border-radius:var(--radius-sm);overflow:hidden;transition:all 0.15s; }
                    .pdf-thumbnail:hover { border-color:var(--fg-muted); }
                    .pdf-thumbnail.active { border-color:var(--accent); }
                    .pdf-thumbnail canvas { width:100%;height:auto;display:block; }
                    .pdf-thumbnail-num { text-align:center;font-size:0.7rem;color:var(--fg-muted);padding:4px; }
                    .pdf-viewer { flex:1;overflow:auto;display:flex;flex-direction:column;align-items:center;padding:20px;background:#1e1e28; }
                    .pdf-canvas-container { box-shadow:0 4px 20px rgba(0,0,0,0.4);background:#fff;border-radius:4px; }
                    .pdf-canvas { display:block; }
                    .pdf-welcome { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--fg-muted);text-align:center;padding:40px; }
                    .pdf-welcome h3 { color:var(--fg-secondary);margin-bottom:16px;font-size:1.2rem; }
                    .pdf-welcome p { margin-bottom:8px;font-size:0.9rem; }
                    .pdf-welcome .btn { margin-top:20px;padding:12px 24px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-md);cursor:pointer;font-family:inherit;font-size:0.9rem; }
                    .pdf-loading { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--fg-muted); }
                    .pdf-loading .spinner { width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:pdf-spin 1s linear infinite; }
                    @keyframes pdf-spin { to { transform:rotate(360deg); } }
                    .pdf-find-bar { display:none;padding:10px 16px;background:var(--bg-tertiary);border-bottom:1px solid var(--border);align-items:center;gap:10px; }
                    .pdf-find-bar.open { display:flex; }
                    .pdf-find-bar input { flex:1;max-width:300px;padding:8px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-family:inherit;font-size:0.85rem; }
                    .pdf-find-bar input:focus { outline:none;border-color:var(--accent); }
                    .pdf-find-results { color:var(--fg-muted);font-size:0.8rem; }
                </style>
                <div class="pdf-container">
                    <div class="pdf-toolbar">
                        <button id="pdf-open-${windowId}">Open PDF</button>
                        <input type="file" id="pdf-file-${windowId}" accept=".pdf">
                        <span class="filename" id="pdf-filename-${windowId}">No file loaded</span>
                        <div class="page-info">
                            <button id="pdf-prev-${windowId}" disabled>◀</button>
                            <span id="pdf-page-${windowId}">- / -</span>
                            <button id="pdf-next-${windowId}" disabled>▶</button>
                        </div>
                        <div class="zoom-controls">
                            <button id="pdf-zoomout-${windowId}" disabled>−</button>
                            <span class="zoom-value" id="pdf-zoom-${windowId}">100%</span>
                            <button id="pdf-zoomin-${windowId}" disabled>+</button>
                        </div>
                        <button id="pdf-fit-${windowId}" disabled>Fit</button>
                        <button id="pdf-find-toggle-${windowId}">🔍</button>
                        <button id="pdf-sidebar-${windowId}">☰</button>
                    </div>
                    <div class="pdf-find-bar" id="pdf-find-bar-${windowId}">
                        <input type="text" id="pdf-find-input-${windowId}" placeholder="Search in document...">
                        <button id="pdf-find-prev-${windowId}">◀</button>
                        <button id="pdf-find-next-${windowId}">▶</button>
                        <span class="pdf-find-results" id="pdf-find-results-${windowId}"></span>
                    </div>
                    <div class="pdf-main">
                        <div class="pdf-sidebar" id="pdf-sidebar-${windowId}">
                            <div class="pdf-sidebar-header">Pages</div>
                            <div class="pdf-thumbnails" id="pdf-thumbnails-${windowId}"></div>
                        </div>
                        <div class="pdf-viewer" id="pdf-viewer-${windowId}">
                            <div class="pdf-welcome" id="pdf-welcome-${windowId}">
                                <h3>PDF Viewer</h3>
                                <p>Open a PDF file to view it</p>
                                <p style="font-size:0.8rem;color:var(--fg-muted);">Supports zoom, search, and page thumbnails</p>
                                <button class="btn" id="pdf-welcome-open-${windowId}">Open PDF</button>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();
                let pdfjsLib = null;
                const pdfReady = loadPdfJsLib().then((lib) => {
                    pdfjsLib = lib;
                    return lib;
                }).catch((error) => {
                    console.error('[PDF Viewer] Failed to load PDF.js:', error);
                    EphemeraNotifications.error('PDF Viewer', 'Failed to initialize PDF engine. Please reopen the app.');
                    return null;
                });

                const viewer = document.getElementById(`pdf-viewer-${windowId}`);
                const welcomeEl = document.getElementById(`pdf-welcome-${windowId}`);
                const fileInput = document.getElementById(`pdf-file-${windowId}`);
                const openBtn = document.getElementById(`pdf-open-${windowId}`);
                const welcomeOpenBtn = document.getElementById(`pdf-welcome-open-${windowId}`);
                const filenameEl = document.getElementById(`pdf-filename-${windowId}`);
                const pageEl = document.getElementById(`pdf-page-${windowId}`);
                const zoomEl = document.getElementById(`pdf-zoom-${windowId}`);
                const prevBtn = document.getElementById(`pdf-prev-${windowId}`);
                const nextBtn = document.getElementById(`pdf-next-${windowId}`);
                const zoomInBtn = document.getElementById(`pdf-zoomin-${windowId}`);
                const zoomOutBtn = document.getElementById(`pdf-zoomout-${windowId}`);
                const fitBtn = document.getElementById(`pdf-fit-${windowId}`);
                const sidebarBtn = document.getElementById(`pdf-sidebar-${windowId}`);
                const sidebar = document.getElementById(`pdf-sidebar-${windowId}`);
                const thumbnails = document.getElementById(`pdf-thumbnails-${windowId}`);
                const findToggle = document.getElementById(`pdf-find-toggle-${windowId}`);
                const findBar = document.getElementById(`pdf-find-bar-${windowId}`);
                const findInput = document.getElementById(`pdf-find-input-${windowId}`);
                const findPrev = document.getElementById(`pdf-find-prev-${windowId}`);
                const findNext = document.getElementById(`pdf-find-next-${windowId}`);
                const findResults = document.getElementById(`pdf-find-results-${windowId}`);

                let pdfDoc = null;
                let currentPage = 1;
                let scale = 1.0;
                let rendering = false;
                let canvas = null;
                let ctx = null;

                function enableControls(enabled) {
                    prevBtn.disabled = !enabled;
                    nextBtn.disabled = !enabled;
                    zoomInBtn.disabled = !enabled;
                    zoomOutBtn.disabled = !enabled;
                    fitBtn.disabled = !enabled;
                }

                async function loadPDF(data, filename) {
                    if (!pdfjsLib?.getDocument) {
                        await pdfReady;
                    }
                    if (!pdfjsLib?.getDocument) {
                        EphemeraNotifications.error('PDF Viewer', 'PDF engine not available. Please reopen the app.');
                        return;
                    }

                    welcomeEl.style.display = 'none';
                    viewer.innerHTML = '<div class="pdf-loading"><div class="spinner"></div><p style="margin-top:12px;">Loading PDF...</p></div>';

                    try {
                        pdfDoc = await pdfjsLib.getDocument({
                            ...data,
                            disableWorker: true
                        }).promise;
                        filenameEl.textContent = filename;
                        currentPage = 1;
                        scale = 1.0;

                        viewer.innerHTML = `
                            <div class="pdf-canvas-container">
                                <canvas class="pdf-canvas" id="pdf-canvas-${windowId}"></canvas>
                            </div>
                        `;
                        canvas = document.getElementById(`pdf-canvas-${windowId}`);
                        ctx = canvas.getContext('2d');

                        enableControls(true);
                        updatePageInfo();
                        renderPage(currentPage);
                        renderThumbnails();
                    } catch (error) {
                        viewer.innerHTML = `<div class="pdf-welcome"><h3>Error</h3><p>Could not load PDF: ${error.message}</p></div>`;
                    }
                }

                async function renderPage(pageNum) {
                    if (rendering || !pdfDoc) return;
                    rendering = true;

                    const page = await pdfDoc.getPage(pageNum);
                    const viewport = page.getViewport({ scale });

                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    await page.render({
                        canvasContext: ctx,
                        viewport: viewport
                    }).promise;

                    rendering = false;
                    updatePageInfo();
                    updateThumbnails();
                }

                async function renderThumbnails() {
                    if (!pdfDoc) return;
                    thumbnails.innerHTML = '';

                    for (let i = 1; i <= pdfDoc.numPages; i++) {
                        const thumbContainer = document.createElement('div');
                        thumbContainer.className = 'pdf-thumbnail' + (i === currentPage ? ' active' : '');
                        thumbContainer.dataset.page = i;

                        const thumbCanvas = document.createElement('canvas');
                        const page = await pdfDoc.getPage(i);
                        const viewport = page.getViewport({ scale: 0.3 });
                        thumbCanvas.height = viewport.height;
                        thumbCanvas.width = viewport.width;

                        const thumbCtx = thumbCanvas.getContext('2d');
                        await page.render({
                            canvasContext: thumbCtx,
                            viewport: viewport
                        }).promise;

                        thumbContainer.appendChild(thumbCanvas);

                        const pageNum = document.createElement('div');
                        pageNum.className = 'pdf-thumbnail-num';
                        pageNum.textContent = i;
                        thumbContainer.appendChild(pageNum);

                        thumbContainer.addEventListener('click', () => {
                            currentPage = parseInt(thumbContainer.dataset.page);
                            renderPage(currentPage);
                        });

                        thumbnails.appendChild(thumbContainer);
                    }
                }

                function updateThumbnails() {
                    thumbnails.querySelectorAll('.pdf-thumbnail').forEach(thumb => {
                        thumb.classList.toggle('active', parseInt(thumb.dataset.page) === currentPage);
                    });
                }

                function updatePageInfo() {
                    if (!pdfDoc) {
                        pageEl.textContent = '- / -';
                        return;
                    }
                    pageEl.textContent = `${currentPage} / ${pdfDoc.numPages}`;
                    prevBtn.disabled = currentPage <= 1;
                    nextBtn.disabled = currentPage >= pdfDoc.numPages;
                }

                function updateZoom() {
                    zoomEl.textContent = Math.round(scale * 100) + '%';
                }

                function goToPage(page) {
                    if (!pdfDoc || page < 1 || page > pdfDoc.numPages) return;
                    currentPage = page;
                    renderPage(currentPage);
                }

                function openFile() {
                    fileInput.click();
                }

                lifecycle.addListener(fileInput, 'change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        loadPDF({ data: ev.target.result }, file.name);
                    };
                    reader.readAsArrayBuffer(file);
                });

                lifecycle.addListener(openBtn, 'click', openFile);
                if (welcomeOpenBtn) lifecycle.addListener(welcomeOpenBtn, 'click', openFile);

                lifecycle.addListener(prevBtn, 'click', () => goToPage(currentPage - 1));
                lifecycle.addListener(nextBtn, 'click', () => goToPage(currentPage + 1));

                lifecycle.addListener(zoomInBtn, 'click', () => {
                    scale = Math.min(3, scale + 0.25);
                    updateZoom();
                    renderPage(currentPage);
                });

                lifecycle.addListener(zoomOutBtn, 'click', () => {
                    scale = Math.max(0.25, scale - 0.25);
                    updateZoom();
                    renderPage(currentPage);
                });

                lifecycle.addListener(fitBtn, 'click', async () => {
                    if (!pdfDoc) return;
                    const page = await pdfDoc.getPage(currentPage);
                    const containerWidth = viewer.clientWidth - 40;
                    const viewport = page.getViewport({ scale: 1 });
                    scale = containerWidth / viewport.width;
                    updateZoom();
                    renderPage(currentPage);
                });

                lifecycle.addListener(sidebarBtn, 'click', () => {
                    sidebar.classList.toggle('open');
                });

                lifecycle.addListener(findToggle, 'click', () => {
                    findBar.classList.toggle('open');
                    if (findBar.classList.contains('open')) {
                        findInput.focus();
                    }
                });

                let findMatches = [];
                let currentMatch = -1;

                if (findInput) {
                    lifecycle.addListener(findInput, 'input', async () => {
                        const query = findInput.value.trim();
                        findMatches = [];
                        currentMatch = -1;
                        findResults.textContent = '';

                        if (!query || !pdfDoc) return;

                        const page = await pdfDoc.getPage(currentPage);
                        const textContent = await page.getTextContent();
                        const text = textContent.items.map(item => item.str).join(' ').toLowerCase();

                        let index = 0;
                        const lowerQuery = query.toLowerCase();
                        while ((index = text.indexOf(lowerQuery, index)) !== -1) {
                            findMatches.push(index);
                            index++;
                        }

                        if (findMatches.length > 0) {
                            currentMatch = 0;
                            findResults.textContent = `${currentMatch + 1} of ${findMatches.length}`;
                        } else {
                            findResults.textContent = 'No matches';
                        }
                    });
                }

                if (findNext) {
                    lifecycle.addListener(findNext, 'click', () => {
                        if (findMatches.length === 0) return;
                        currentMatch = (currentMatch + 1) % findMatches.length;
                        findResults.textContent = `${currentMatch + 1} of ${findMatches.length}`;
                    });
                }

                if (findPrev) {
                    lifecycle.addListener(findPrev, 'click', () => {
                        if (findMatches.length === 0) return;
                        currentMatch = (currentMatch - 1 + findMatches.length) % findMatches.length;
                        findResults.textContent = `${currentMatch + 1} of ${findMatches.length}`;
                    });
                }

                lifecycle.addListener(viewer, 'keydown', (e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                        goToPage(currentPage - 1);
                    } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                        goToPage(currentPage + 1);
                    } else if (e.key === 'Home') {
                        goToPage(1);
                    } else if (e.key === 'End') {
                        goToPage(pdfDoc?.numPages || 1);
                    }
                });

                return {
                    destroy: () => {
                        if (pdfDoc) {
                            pdfDoc.destroy().catch(() => {});
                            pdfDoc = null;
                        }
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
