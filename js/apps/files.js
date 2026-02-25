EphemeraApps.register({
    id: 'files',
    name: 'Files',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`,
    width: 750,
    height: 500,
    category: 'system',
    content: (windowId, options = {}) => {
        const startPath = options.startPath || EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
        const mode = options.mode || 'browse';
        const isSaveMode = mode === 'save';
        const defaultSaveName = (typeof options.saveFileName === 'string' && options.saveFileName.trim())
            ? options.saveFileName.trim()
            : 'untitled.txt';
        const isMobileVariant = EphemeraState?.shellMode === 'mobile' || window.innerWidth < 768;
        
        return {
            html: `
                <style>
                    .file-app { display:flex;flex-direction:column;height:100%;position:relative; }
                    .file-toolbar { display:flex;gap:8px;padding:0 0 12px 0;flex-wrap:wrap; }
                    .file-toolbar button { padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-size:0.8rem;display:flex;align-items:center;gap:4px; }
                    .file-toolbar button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .file-toolbar button svg { width:14px;height:14px; }
                    .file-path { display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-primary);border-radius:var(--radius-md);margin-bottom:12px; }
                    .file-path-breadcrumb { display:flex;align-items:center;gap:4px;flex:1;overflow-x:auto;font-size:0.85rem; }
                    .file-path-breadcrumb span { cursor:pointer;padding:4px 8px;border-radius:var(--radius-sm);transition:background 0.15s; }
                    .file-path-breadcrumb span:hover { background:rgba(255,255,255,0.1); }
                    .file-path-breadcrumb .current { color:var(--accent);cursor:default; }
                    .file-save-row { display:flex;gap:8px;padding:0 0 12px 0;align-items:center; }
                    .file-save-row input { flex: 1; background:var(--bg-primary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-sm);padding:8px 10px;font-size:0.85rem; }
                    .file-save-row button { padding:8px 12px;background:var(--accent);color:var(--bg-primary);border:1px solid transparent;border-radius:var(--radius-sm);cursor:pointer; }
                    .file-save-row button:hover { opacity:0.9; }
                    .file-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;flex:1;overflow-y:auto;position:relative;transition:all 0.2s;align-content:start;align-items:start; }
                    .file-grid.drag-over { background:rgba(0,212,170,0.1);border:2px dashed var(--accent);border-radius:var(--radius-md); }
                    .file-grid.drag-over::after { content:'Drop files here to upload';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:var(--accent);pointer-events:none;background:rgba(0,0,0,0.5);z-index:10; }
                    .file-item { display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 8px;border-radius:var(--radius-md);cursor:pointer;transition:all 0.2s ease;border:2px solid transparent; }
                    .file-item:hover { background:rgba(255,255,255,0.05); }
                    .file-item.selected { background:rgba(0,212,170,0.1);border-color:var(--accent); }
                    .file-item svg { width:40px;height:40px; }
                    .file-item span { font-size:0.75rem;text-align:center;word-break:break-word;max-width:90px;line-height:1.3; }
                    .file-item .file-size { font-size:0.65rem;color:var(--fg-muted); }
                    .file-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--fg-muted); }
                    .file-empty svg { width:48px;height:48px;opacity:0.3;margin-bottom:12px; }
                    .file-context { position:fixed;background:var(--glass);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:var(--radius-md);padding:6px 0;min-width:150px;z-index:10000;box-shadow:var(--window-shadow); }
                    .file-context-item { padding:8px 14px;font-size:0.85rem;cursor:pointer;display:flex;align-items:center;gap:8px; }
                    .file-context-item:hover { background:rgba(255,255,255,0.08); }
                    .file-item.swipe-delete-ready { background:rgba(255,77,106,0.12);border-color:rgba(255,77,106,0.45); }
                    .file-fab { display:none;position:absolute;right:16px;bottom:16px;width:56px;height:56px;border-radius:50%;border:1px solid rgba(0,212,170,0.35);background:linear-gradient(140deg,#00d4aa,#00a8ff);color:#071018;font-size:1.6rem;line-height:1;cursor:pointer;align-items:center;justify-content:center;box-shadow:0 18px 36px rgba(0,0,0,0.35);z-index:20; }
                    .file-fab.visible { display:flex; }
                    .file-app.mobile-variant .file-toolbar button { min-height:44px;padding:10px 14px;font-size:0.86rem; }
                    .file-app.mobile-variant .file-path { min-height:48px;padding:10px 14px; }
                    .file-app.mobile-variant .file-item { min-height:120px;padding:18px 10px; }
                    .file-app.mobile-variant .file-item svg { width:46px;height:46px; }
                    .file-app.mobile-variant .file-item span { font-size:0.8rem;max-width:120px; }
                    .file-app.mobile-variant .file-item .file-size { font-size:0.72rem; }
                </style>
                <div class="file-app ${isMobileVariant ? 'mobile-variant' : ''}">
                    <div class="file-toolbar">
                        <button data-action="back" title="Back" aria-label="Go back">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <button data-action="up" title="Up" aria-label="Go up one folder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        <button data-action="home" title="Home" aria-label="Go to home folder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                        </button>
                        <button data-action="refresh" title="Refresh" aria-label="Refresh folder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.22-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
                        </button>
                        <button data-action="newfolder" title="New Folder" aria-label="Create new folder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                            Folder
                        </button>
                        <button data-action="newfile" title="New File" aria-label="Create new file">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                            File
                        </button>
                        <button data-action="download" title="Download to Disk" id="download-btn-${windowId}" aria-label="Download selected file">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download
                        </button>
                        <button data-action="upload" title="Upload from Disk" id="upload-btn-${windowId}" aria-label="Upload files">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            Upload
                        </button>
                        <input type="file" id="upload-input-${windowId}" multiple style="display:none;">
                    </div>
                    <div class="file-path">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                        <div class="file-path-breadcrumb" id="file-breadcrumb-${windowId}"></div>
                    </div>
                    ${isSaveMode ? `<div class="file-save-row"><input id="file-save-name-${windowId}" value="${EphemeraSanitize.escapeAttr(defaultSaveName)}" placeholder="File name" /><button id="file-save-btn-${windowId}" type="button">Save</button></div>` : ''}
                    <div class="file-grid" id="file-grid-${windowId}"></div>
                    <button class="file-fab ${isMobileVariant ? 'visible' : ''}" id="file-fab-new-${windowId}" type="button" aria-label="Create new file">+</button>
                </div>
                <div class="file-context" id="file-context-${windowId}" style="display:none;"></div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const grid = document.getElementById(`file-grid-${windowId}`);
                const breadcrumb = document.getElementById(`file-breadcrumb-${windowId}`);
                const contextMenu = document.getElementById(`file-context-${windowId}`);
                const container = grid.closest('.window-content');
                if (!EphemeraWM.getWindow(windowId)) {
                    return;
                }
                const handleDocumentClick = (e) => {
                    if (!contextMenu.contains(e.target)) {
                        contextMenu.style.display = 'none';
                    }
                };
                const saveNameInput = isSaveMode
                    ? document.getElementById(`file-save-name-${windowId}`)
                    : null;
                const fabNewFile = document.getElementById(`file-fab-new-${windowId}`);
                
                let currentPath = startPath;
                let selectedItem = null;
                let history = [startPath];
                let historyIndex = 0;
                
                async function loadDirectory(path) {
                    currentPath = EphemeraFS.normalizePath(path);

                    // Show loading state
                    grid.innerHTML = `
                        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;width:100%;grid-column:1/-1;">
                            <div style="width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                            <span style="margin-top:12px;color:var(--fg-muted);font-size:0.85rem;">Loading...</span>
                        </div>
                        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
                    `;

                    try {
                        const files = await EphemeraFS.readdir(currentPath);
                        selectedItem = null;
                        renderBreadcrumb();
                        renderFiles(files);

                        if (history[historyIndex] !== currentPath) {
                            history = history.slice(0, historyIndex + 1);
                            history.push(currentPath);
                            historyIndex = history.length - 1;
                        }
                    } catch (error) {
                        grid.innerHTML = `
                            <div class="file-empty" style="grid-column:1/-1;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                <span style="color:var(--danger);">Failed to load directory</span>
                                <span style="font-size:0.75rem;margin-top:4px;">${error.message}</span>
                            </div>
                        `;
                    }
                }
                
                function renderBreadcrumb() {
                    const parts = currentPath.split('/').filter(p => p);
                    let html = '<span data-path="/">/</span>';
                    let buildPath = '';

                    parts.forEach((part, i) => {
                        buildPath += '/' + part;
                        const isLast = i === parts.length - 1;
                        html += `<span data-path="${EphemeraSanitize.escapeAttr(buildPath)}" class="${isLast ? 'current' : ''}">${EphemeraSanitize.escapeHtml(part)}</span>`;
                    });
                    
                    breadcrumb.innerHTML = html;
                    
                    breadcrumb.querySelectorAll('span:not(.current)').forEach(el => {
                        el.addEventListener('click', () => loadDirectory(el.dataset.path));
                    });
                }
                
                function renderFiles(files) {
                    if (files.length === 0) {
                        grid.innerHTML = `
                            <div class="file-empty">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                                <span>This folder is empty</span>
                            </div>
                        `;
                        return;
                    }
                    
                    grid.innerHTML = files.map(f => `
                        <div class="file-item" draggable="true" data-path="${EphemeraSanitize.escapeAttr(f.path)}" data-type="${EphemeraSanitize.escapeAttr(f.type)}" data-name="${EphemeraSanitize.escapeAttr(f.name)}">
                            ${EphemeraFS.getIcon(f)}
                            <span>${EphemeraSanitize.escapeHtml(f.name)}</span>
                            ${f.type === 'file' ? `<span class="file-size">${formatSize(f.size || 0)}</span>` : ''}
                        </div>
                    `).join('');

                    grid.querySelectorAll('.file-item').forEach(item => {
                        item.dataset.swipeBlockClick = '0';
                        item.addEventListener('click', () => {
                            if (item.dataset.swipeBlockClick === '1') {
                                item.dataset.swipeBlockClick = '0';
                                return;
                            }
                            selectItem(item);
                        });
                        item.addEventListener('dblclick', () => openItem(item));
                        item.addEventListener('contextmenu', (e) => showContextMenu(e, item));
                        item.addEventListener('dragstart', (e) => {
                            const path = item.dataset.path;
                            const name = item.dataset.name;
                            const type = item.dataset.type;
                            e.dataTransfer.setData('application/x-ephemera-file', JSON.stringify({ path, name, type }));
                            e.dataTransfer.setData('text/plain', name);
                            e.dataTransfer.effectAllowed = 'copyMove';
                        });
                        attachSwipeToDelete(item);
                    });
                }
                
                function formatSize(bytes) {
                    if (bytes < 1024) return bytes + ' B';
                    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
                }

                function getSaveTargetPath() {
                    if (!isSaveMode) return null;
                    
                    if (selectedItem && selectedItem.dataset.type === 'file') {
                        return selectedItem.dataset.path;
                    }

                    if (!saveNameInput) return null;
                    const fileName = saveNameInput.value.trim();
                    if (!fileName) {
                        EphemeraNotifications.error('Save Failed', 'Please enter a file name');
                        return null;
                    }

                    return EphemeraFS.normalizePath(
                        currentPath === '/'
                            ? `/${fileName}`
                            : `${currentPath}/${fileName}`
                    );
                }

                async function confirmOverwrite(path) {
                    const target = await EphemeraFS.stat(path);
                    if (target && target.type === 'file') {
                        return EphemeraDialog.confirm(
                            `"${EphemeraFS.getBasename(path)}" already exists. Replace it?`,
                            'Overwrite file',
                            true
                        );
                    }
                    return true;
                }

                async function commitSaveSelection() {
                    if (!isSaveMode || !options.onSave) return;

                    const savePath = getSaveTargetPath();
                    if (!savePath) return;

                    if (!await confirmOverwrite(savePath)) return;

                    try {
                        const result = await options.onSave(savePath);
                        if (result !== false) {
                            EphemeraWM.close(windowId);
                        }
                    } catch (err) {
                        console.error('Save target callback failed:', err);
                    }
                }

                async function createNewFolder() {
                    const name = await EphemeraDialog.prompt('Enter folder name:', '', 'New Folder');
                    if (!name) return;
                    await EphemeraFS.mkdir(currentPath + '/' + name);
                    loadDirectory(currentPath);
                }

                async function createNewFile() {
                    const name = await EphemeraDialog.prompt('Enter file name:', '', 'New File');
                    if (!name) return;
                    await EphemeraFS.writeFile(currentPath + '/' + name, '');
                    loadDirectory(currentPath);
                }

                function attachSwipeToDelete(item) {
                    if (!isMobileVariant) return;

                    let swipeState = null;
                    const clearSwipeVisuals = () => {
                        item.style.transform = '';
                        item.style.transition = '';
                        item.classList.remove('swipe-delete-ready');
                    };

                    item.addEventListener('pointerdown', (e) => {
                        if (e.pointerType === 'mouse') return;
                        swipeState = {
                            pointerId: e.pointerId,
                            startX: e.clientX,
                            startY: e.clientY,
                            moved: false
                        };
                        item.style.transition = '';
                    });

                    item.addEventListener('pointermove', (e) => {
                        if (!swipeState || e.pointerId !== swipeState.pointerId) return;
                        const dx = e.clientX - swipeState.startX;
                        const dy = Math.abs(e.clientY - swipeState.startY);
                        if (dy > 30) {
                            swipeState = null;
                            clearSwipeVisuals();
                            return;
                        }

                        if (dx < -10) {
                            swipeState.moved = true;
                            const tx = Math.max(dx, -96);
                            item.style.transform = `translateX(${tx}px)`;
                            item.classList.toggle('swipe-delete-ready', dx <= -72);
                        }
                    });

                    const finalizeSwipe = async (e) => {
                        if (!swipeState || e.pointerId !== swipeState.pointerId) return;

                        const shouldDelete = item.classList.contains('swipe-delete-ready');
                        const wasMoved = swipeState.moved;
                        swipeState = null;

                        if (wasMoved) {
                            item.dataset.swipeBlockClick = '1';
                            setTimeout(() => {
                                item.dataset.swipeBlockClick = '0';
                            }, 0);
                        }

                        if (!shouldDelete) {
                            item.style.transition = 'transform 0.2s ease';
                            clearSwipeVisuals();
                            return;
                        }

                        item.style.transition = 'transform 0.15s ease';
                        item.style.transform = 'translateX(-100%)';
                        const confirmed = await EphemeraDialog.confirm(`Delete "${item.dataset.name}"?`, 'Delete Item', true);
                        clearSwipeVisuals();
                        if (!confirmed) return;

                        try {
                            await EphemeraFS.delete(item.dataset.path);
                            await loadDirectory(currentPath);
                        } catch (err) {
                            console.error('Swipe delete failed:', err);
                            EphemeraNotifications.error('Delete Failed', err.message || 'Could not delete item');
                        }
                    };

                    item.addEventListener('pointerup', finalizeSwipe);
                    item.addEventListener('pointercancel', (e) => {
                        if (swipeState && e.pointerId === swipeState.pointerId) {
                            swipeState = null;
                            clearSwipeVisuals();
                        }
                    });
                }
                
                function selectItem(item) {
                    grid.querySelectorAll('.file-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    selectedItem = item;
                    if (isSaveMode && saveNameInput && item.dataset.type === 'file') {
                        saveNameInput.value = item.dataset.name;
                    }
                }
                
                async function openItem(item) {
                    const path = item.dataset.path;
                    const type = item.dataset.type;

                    if (type === 'directory') {
                        loadDirectory(path);
                        return;
                    }

                    if (mode === 'open' && options.onFileSelect) {
                        try {
                            const result = await options.onFileSelect(path);
                            if (result !== false) {
                                EphemeraWM.close(windowId);
                            }
                        } catch (err) {
                            console.error('Open file callback failed:', err);
                        }
                        return;
                    }

                    if (isSaveMode && options.onSave) {
                        if (!await confirmOverwrite(path)) return;
                        try {
                            const result = await options.onSave(path);
                            if (result !== false) {
                                EphemeraWM.close(windowId);
                            }
                        } catch (err) {
                            console.error('Save target callback failed:', err);
                        }
                        return;
                    }

                    if (window.EphemeraFileAssoc) {
                            EphemeraFileAssoc.openFile(path);
                    } else {
                        EphemeraWM.open('notepad', { filePath: path });
                    }
                }
                
                function showContextMenu(e, item) {
                    e.preventDefault();
                    const type = item.dataset.type;
                    const fsApiSupported = window.EphemeraDataManagement?.isFileSystemAccessSupported?.() ?? false;

                    contextMenu.innerHTML = `
                        <div class="file-context-item" data-action="open">Open</div>
                        ${type === 'file' ? `<div class="file-context-item" data-action="edit">Edit</div>` : ''}
                        ${type === 'file' ? `<div class="file-context-item" data-action="history">History...</div>` : ''}
                        <div class="file-context-item" data-action="copy">Copy</div>
                        <div class="file-context-item" data-action="cut">Cut</div>
                        <div class="file-context-item" data-action="rename">Rename</div>
                        ${type === 'file' ? `
                            ${fsApiSupported ? `<div class="file-context-item" data-action="saveToDisk">Save to Disk...</div>` : ''}
                            <div class="file-context-item" data-action="download">Download</div>
                            <div class="file-context-item" data-action="share">Share via P2P…</div>
                        ` : ''}
                        <div class="file-context-item" data-action="publish">${type === 'directory' ? 'Publish Folder as Link…' : 'Publish as Link…'}</div>
                        <div class="file-context-item" data-action="delete" style="color:var(--danger);">Delete</div>
                    `;

                    if (contextMenu.parentElement !== document.body) {
                        document.body.appendChild(contextMenu);
                    }
                    
                    contextMenu.style.display = 'block';
                    contextMenu.style.left = '0px';
                    contextMenu.style.top = '0px';
                    
                    const menuRect = contextMenu.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    
                    let x = e.clientX;
                    let y = e.clientY;
                    
                    if (x + menuRect.width > viewportWidth - 10) {
                        x = viewportWidth - menuRect.width - 10;
                    }
                    if (y + menuRect.height > viewportHeight - 10) {
                        y = viewportHeight - menuRect.height - 10;
                    }
                    if (x < 10) x = 10;
                    if (y < 10) y = 10;
                    
                    contextMenu.style.left = x + 'px';
                    contextMenu.style.top = y + 'px';
                    
                    contextMenu.querySelectorAll('.file-context-item').forEach(el => {
                        el.addEventListener('click', async () => {
                            const action = el.dataset.action;
                            const path = item.dataset.path;
                            
                            if (action === 'open') openItem(item);
                            if (action === 'edit') EphemeraWM.open('notepad', { filePath: path });
                            if (action === 'history') EphemeraWM.open('file-history', { filePath: path });
                            if (action === 'copy' && window.EphemeraClipboard) EphemeraClipboard.copyFile(path);
                            if (action === 'cut' && window.EphemeraClipboard) EphemeraClipboard.cutFile(path);
                            if (action === 'download') downloadFile(path);
                            if (action === 'saveToDisk' && window.EphemeraDataManagement) {
                                await EphemeraDataManagement.saveToDisk(path);
                            }
                            if (action === 'share') {
                                EphemeraWM.open('share', { filePath: path });
                            }
                            if (action === 'publish') {
                                if (type === 'directory') {
                                    EphemeraWM.open('share', { targetPath: path, mode: 'publish' });
                                } else {
                                    EphemeraWM.open('share', { filePath: path, targetPath: path, mode: 'publish' });
                                }
                            }
                            if (action === 'rename') {
                                const newName = await EphemeraDialog.prompt('Enter new name:', item.dataset.name, 'Rename');
                                if (newName && newName !== item.dataset.name) {
                                    const newPath = EphemeraFS.getParentDir(path) + '/' + newName;
                                    await EphemeraFS.move(path, newPath);
                                    loadDirectory(currentPath);
                                }
                            }
                            if (action === 'delete') {
                                if (await EphemeraDialog.confirm(`Delete "${item.dataset.name}"?`, 'Delete Item', true)) {
                                    await EphemeraFS.delete(path);
                                    loadDirectory(currentPath);
                                }
                            }
                            
                            contextMenu.style.display = 'none';
                        });
                    });
                }
                
                async function downloadFile(path) {
                    const file = await EphemeraFS.stat(path);
                    if (!file || file.type === 'directory') {
                        EphemeraNotifications.error('Download Failed', 'Cannot download directory');
                        return;
                    }
                    
                    const content = await EphemeraFS.readFile(path);
                    if (content === null) {
                        EphemeraNotifications.error('Download Failed', 'Could not read file');
                        return;
                    }
                    
                    let blob;
                    const mimeType = file.mimeType || EphemeraFS.getMimeType(path) || 'application/octet-stream';
                    
                    if (typeof content === 'string' && content.startsWith('data:')) {
                        const response = await fetch(content);
                        blob = await response.blob();
                    } else if (content instanceof ArrayBuffer) {
                        blob = new Blob([content], { type: mimeType });
                    } else if (typeof content === 'string') {
                        blob = new Blob([content], { type: mimeType });
                    } else {
                        blob = new Blob([JSON.stringify(content)], { type: mimeType });
                    }
                    
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    EphemeraNotifications.success('Download Complete', `${file.name} has been downloaded`);
                }
                
                function downloadSelectedFile() {
                    if (selectedItem && selectedItem.dataset.type === 'file') {
                        // Use File System Access API if available for better UX
                        if (window.EphemeraDataManagement?.isFileSystemAccessSupported?.()) {
                            EphemeraDataManagement.saveToDisk(selectedItem.dataset.path);
                        } else {
                            downloadFile(selectedItem.dataset.path);
                        }
                    } else if (selectedItem && selectedItem.dataset.type === 'directory') {
                        EphemeraNotifications.error('Download Failed', 'Cannot download directories yet');
                    } else {
                        EphemeraNotifications.info('No Selection', 'Please select a file to download');
                    }
                }
                
                const uploadInput = document.getElementById(`upload-input-${windowId}`);
                
                async function uploadFiles(files) {
                    let uploaded = 0;
                    for (const file of files) {
                        try {
                            const content = await file.arrayBuffer();
                            await EphemeraFS.writeFile(currentPath + '/' + file.name, content, { mimeType: file.type });
                            uploaded++;
                        } catch (e) {
                            console.error('Upload failed:', e);
                            EphemeraNotifications.error('Upload Failed', `Could not upload ${file.name}`);
                        }
                    }
                    if (uploaded > 0) {
                        loadDirectory(currentPath);
                        EphemeraNotifications.success('Upload Complete', `${uploaded} file(s) uploaded`);
                    }
                }
                
                uploadInput.addEventListener('change', (e) => {
                    if (e.target.files.length > 0) {
                        uploadFiles(e.target.files);
                        e.target.value = '';
                    }
                });
                
                grid.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    grid.classList.add('drag-over');
                });
                
                grid.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
                
                grid.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = grid.getBoundingClientRect();
                    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                        grid.classList.remove('drag-over');
                    }
                });
                
                grid.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    grid.classList.remove('drag-over');

                    // Handle internal ephemera file drops (move/copy between folders)
                    const ephemeraData = e.dataTransfer.getData('application/x-ephemera-file');
                    if (ephemeraData) {
                        try {
                            const { path: srcPath } = JSON.parse(ephemeraData);
                            const srcParent = EphemeraFS.getParentDir(srcPath);
                            if (srcParent !== currentPath) {
                                const name = EphemeraFS.getBasename(srcPath);
                                const destPath = EphemeraFS.normalizePath(currentPath + '/' + name);
                                if (e.ctrlKey) {
                                    await EphemeraFS.copy(srcPath, destPath);
                                    EphemeraNotifications.success('Copied', `${name} copied`);
                                } else {
                                    await EphemeraFS.move(srcPath, destPath);
                                    EphemeraNotifications.success('Moved', `${name} moved`);
                                }
                                await loadDirectory(currentPath);
                            }
                        } catch (err) {
                            console.error('[Files] Internal drop failed:', err);
                        }
                        return;
                    }

                    // Handle native file drops (upload from OS)
                    const items = e.dataTransfer.items;
                    const files = [];

                    if (items) {
                        for (const item of items) {
                            if (item.kind === 'file') {
                                const file = item.getAsFile();
                                if (file) files.push(file);
                            }
                        }
                    } else if (e.dataTransfer.files) {
                        files.push(...e.dataTransfer.files);
                    }

                    if (files.length > 0) {
                        await uploadFiles(files);
                    }
                });
                
                container.querySelector('#download-btn-' + windowId).addEventListener('click', downloadSelectedFile);
                container.querySelector('#upload-btn-' + windowId).addEventListener('click', async () => {
                    // Use File System Access API if available
                    if (window.EphemeraDataManagement?.isFileSystemAccessSupported?.()) {
                        const result = await EphemeraDataManagement.openFromDisk(currentPath);
                        if (result.success) {
                            loadDirectory(currentPath);
                        }
                    } else {
                        uploadInput.click();
                    }
                });
                if (isSaveMode) {
                    const saveBtn = document.getElementById(`file-save-btn-${windowId}`);
                    if (saveBtn) {
                        saveBtn.addEventListener('click', commitSaveSelection);
                    }
                    if (saveNameInput) {
                        saveNameInput.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                commitSaveSelection();
                            }
                        });
                        saveNameInput.addEventListener('input', () => {
                            if (selectedItem && selectedItem.dataset.type === 'file') {
                                selectedItem.classList.remove('selected');
                                selectedItem = null;
                            }
                        });
                    }
                }
                
                container.querySelectorAll('.file-toolbar button[data-action]:not([data-action="download"]):not([data-action="upload"])').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const action = btn.dataset.action;
                        
                        if (action === 'back' && historyIndex > 0) {
                            historyIndex--;
                            loadDirectory(history[historyIndex]);
                        }
                        if (action === 'up') {
                            loadDirectory(EphemeraFS.getParentDir(currentPath));
                        }
                        if (action === 'home') {
                            loadDirectory(EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user');
                        }
                        if (action === 'refresh') {
                            loadDirectory(currentPath);
                        }
                        if (action === 'newfolder') {
                            await createNewFolder();
                        }
                        if (action === 'newfile') {
                            await createNewFile();
                        }
                    });
                });

                if (fabNewFile) {
                    fabNewFile.addEventListener('click', async () => {
                        await createNewFile();
                    });
                }
                
                loadDirectory(startPath);

                lifecycle.addListener(document, 'click', handleDocumentClick);

                return {
                    destroy: () => {
                        if (contextMenu && contextMenu.parentElement) {
                            contextMenu.remove();
                        }
                        lifecycle.destroy();
                    }
                };
            }
        };
    },
    onClose: (windowId) => {
        const win = EphemeraWM.getWindow(windowId);
        if (win && win.options && win.options.onCancel) {
            win.options.onCancel();
        }
    }
});
