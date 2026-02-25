EphemeraApps.register({
    id: 'file-history',
    name: 'File History',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v5h5"/><path d="M3.05 13a9 9 0 1 0 2.13-5.83"/><path d="M12 7v5l3 2"/></svg>`,
    width: 900,
    height: 620,
    category: 'development',
    content: (windowId, options = {}) => {
        const initialPath = typeof options.filePath === 'string' ? options.filePath : '';
        const initialComparePath = typeof options.comparePath === 'string' ? options.comparePath : '';
        const initialCompareLabel = typeof options.compareLabel === 'string' ? options.compareLabel.trim() : '';

        return {
            html: `
                <style>
                    .fh-app { display:flex;flex-direction:column;height:100%;gap:10px; }
                    .fh-toolbar { display:flex;gap:8px;align-items:center;flex-wrap:wrap; }
                    .fh-toolbar select,.fh-toolbar button { background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-sm);padding:6px 10px;font-size:0.82rem; }
                    .fh-toolbar button { cursor:pointer; }
                    .fh-toolbar button:hover { background:var(--bg-secondary); }
                    .fh-toolbar .fh-path { min-width:260px;max-width:420px; }
                    .fh-meta { font-size:0.75rem;color:var(--fg-muted); }
                    .fh-main { flex:1;display:grid;grid-template-columns:300px 1fr;gap:10px;min-height:0; }
                    .fh-panel { background:rgba(0,0,0,0.16);border:1px solid var(--border);border-radius:var(--radius-md);min-height:0;display:flex;flex-direction:column; }
                    .fh-panel-header { padding:10px 12px;border-bottom:1px solid var(--border);font-size:0.82rem;color:var(--fg-secondary);display:flex;justify-content:space-between;align-items:center;gap:8px; }
                    .fh-timeline { flex:1;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:8px; }
                    .fh-version-item { border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;background:rgba(0,0,0,0.18);display:flex;flex-direction:column;gap:6px; }
                    .fh-version-time { font-size:0.8rem;color:var(--fg-primary); }
                    .fh-version-sub { font-size:0.72rem;color:var(--fg-muted); }
                    .fh-version-actions { display:flex;gap:6px;flex-wrap:wrap; }
                    .fh-version-actions button { background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);padding:4px 8px;font-size:0.72rem;cursor:pointer; }
                    .fh-version-actions button:hover { color:var(--fg-primary);background:var(--bg-secondary); }
                    .fh-compare { padding:10px 12px;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center;flex-wrap:wrap; }
                    .fh-compare select { background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-sm);padding:6px 8px;font-size:0.8rem;min-width:180px; }
                    .fh-diff-wrap { flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px; }
                    .fh-diff-col { border:1px solid var(--border);border-radius:var(--radius-sm);min-height:0;display:flex;flex-direction:column;background:rgba(0,0,0,0.14); }
                    .fh-diff-title { padding:8px 10px;border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--fg-secondary); }
                    .fh-diff-body { flex:1;overflow:auto;font-family:var(--font-mono);font-size:0.74rem;line-height:1.45; }
                    .fh-line { display:grid;grid-template-columns:48px 1fr;gap:8px;padding:1px 8px;white-space:pre; }
                    .fh-line-num { color:var(--fg-muted);text-align:right; }
                    .fh-line.same { background:transparent; }
                    .fh-line.diff { background:rgba(255,184,77,0.12); }
                    .fh-line.empty { color:var(--fg-muted);opacity:0.6; }
                    .fh-empty { padding:16px;color:var(--fg-muted);font-size:0.82rem; }
                    @media (max-width: 860px) {
                        .fh-main { grid-template-columns:1fr;grid-template-rows:220px 1fr; }
                    }
                </style>
                <div class="fh-app">
                    <div class="fh-toolbar">
                        <select id="fh-path-${windowId}" class="fh-path"></select>
                        <button id="fh-refresh-${windowId}" type="button">Refresh</button>
                        <button id="fh-open-files-${windowId}" type="button">Browse Files</button>
                        <button id="fh-prune-${windowId}" type="button">Prune Old Versions</button>
                        <div class="fh-meta" id="fh-meta-${windowId}">Loading...</div>
                    </div>
                    <div class="fh-main">
                        <div class="fh-panel">
                            <div class="fh-panel-header">
                                <span>Timeline</span>
                                <span id="fh-count-${windowId}" class="fh-meta"></span>
                            </div>
                            <div class="fh-timeline" id="fh-timeline-${windowId}"></div>
                        </div>
                        <div class="fh-panel">
                            <div class="fh-compare">
                                <label for="fh-a-${windowId}" class="fh-meta">Compare A</label>
                                <select id="fh-a-${windowId}"></select>
                                <label for="fh-b-${windowId}" class="fh-meta">Compare B</label>
                                <select id="fh-b-${windowId}"></select>
                                <span id="fh-diff-summary-${windowId}" class="fh-meta"></span>
                            </div>
                            <div class="fh-diff-wrap">
                                <div class="fh-diff-col">
                                    <div class="fh-diff-title" id="fh-title-a-${windowId}">A</div>
                                    <div class="fh-diff-body" id="fh-diff-a-${windowId}"></div>
                                </div>
                                <div class="fh-diff-col">
                                    <div class="fh-diff-title" id="fh-title-b-${windowId}">B</div>
                                    <div class="fh-diff-body" id="fh-diff-b-${windowId}"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const pathSelect = document.getElementById(`fh-path-${windowId}`);
                const refreshBtn = document.getElementById(`fh-refresh-${windowId}`);
                const openFilesBtn = document.getElementById(`fh-open-files-${windowId}`);
                const pruneBtn = document.getElementById(`fh-prune-${windowId}`);
                const metaEl = document.getElementById(`fh-meta-${windowId}`);
                const countEl = document.getElementById(`fh-count-${windowId}`);
                const timelineEl = document.getElementById(`fh-timeline-${windowId}`);
                const selectA = document.getElementById(`fh-a-${windowId}`);
                const selectB = document.getElementById(`fh-b-${windowId}`);
                const diffSummaryEl = document.getElementById(`fh-diff-summary-${windowId}`);
                const diffLeftTitle = document.getElementById(`fh-title-a-${windowId}`);
                const diffRightTitle = document.getElementById(`fh-title-b-${windowId}`);
                const diffLeftBody = document.getElementById(`fh-diff-a-${windowId}`);
                const diffRightBody = document.getElementById(`fh-diff-b-${windowId}`);

                const launchPath = initialPath ? EphemeraFS.normalizePath(initialPath) : '';
                const comparePath = initialComparePath ? EphemeraFS.normalizePath(initialComparePath) : '';
                const compareLabel = initialCompareLabel || 'Compare file';
                const EXTERNAL_SELECTION_PREFIX = '__external__:';

                let currentPath = launchPath;
                let versions = [];
                const versionMap = new Map();

                const fmtTime = (ts) => {
                    if (!ts) return 'Unknown time';
                    return new Date(ts).toLocaleString();
                };
                const fmtBytes = (bytes) => {
                    const value = Number(bytes || 0);
                    if (window.EphemeraDataManagement?.formatBytes) {
                        return window.EphemeraDataManagement.formatBytes(value);
                    }
                    if (value < 1024) return `${value} B`;
                    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
                    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
                };
                const esc = (value) => EphemeraSanitize.escapeHtml(String(value ?? ''));
                const asText = (value) => (typeof value === 'string' ? value : null);

                function getExternalSelectionId() {
                    if (!comparePath || !currentPath) return '';
                    if (comparePath === currentPath) return '';
                    if (launchPath && currentPath !== launchPath) return '';
                    return `${EXTERNAL_SELECTION_PREFIX}${comparePath}`;
                }

                function describeSelection(entry) {
                    if (!entry) return '';
                    const label = entry.isCurrent
                        ? 'Current file'
                        : entry.isExternal
                            ? (entry.label || compareLabel)
                            : `Snapshot - ${fmtTime(entry.createdAt)}`;
                    return `${label} (${fmtBytes(entry.size || 0)})`;
                }

                function renderLines(target, lines, marks) {
                    if (!lines.length) {
                        target.innerHTML = '<div class="fh-empty">No text content.</div>';
                        return;
                    }
                    target.innerHTML = lines.map((line, index) => {
                        const marker = marks[index] || 'same';
                        const lineNo = line === null ? '' : String(index + 1);
                        const safeLine = line === null ? '' : esc(line);
                        return `<div class="fh-line ${marker}"><span class="fh-line-num">${lineNo}</span><span>${safeLine || '&nbsp;'}</span></div>`;
                    }).join('');
                }

                function renderTimeline() {
                    countEl.textContent = versions.length ? `${versions.length} snapshots` : 'No snapshots';
                    if (!versions.length) {
                        timelineEl.innerHTML = '<div class="fh-empty">No snapshots for this file yet. Save changes to start version history.</div>';
                        return;
                    }
                    timelineEl.innerHTML = versions.map((entry) => `
                        <div class="fh-version-item" data-version-id="${esc(entry.id)}">
                            <div class="fh-version-time">${esc(fmtTime(entry.createdAt))}</div>
                            <div class="fh-version-sub">${esc(entry.reason || 'save')} • ${esc(fmtBytes(entry.size || 0))}</div>
                            <div class="fh-version-actions">
                                <button type="button" data-action="set-a">Set A</button>
                                <button type="button" data-action="set-b">Set B</button>
                                <button type="button" data-action="restore">Restore</button>
                            </div>
                        </div>
                    `).join('');
                }

                function renderCompareSelectors() {
                    if (!currentPath) {
                        selectA.innerHTML = '<option value="">No file selected</option>';
                        selectB.innerHTML = '<option value="">No file selected</option>';
                        return;
                    }

                    const externalSelectionId = getExternalSelectionId();
                    const selectorOptions = [
                        '<option value="__current__">Current file</option>',
                        ...(externalSelectionId
                            ? [`<option value="${esc(externalSelectionId)}">${esc(`${compareLabel}: ${comparePath}`)}</option>`]
                            : []),
                        ...versions.map((entry) => `<option value="${esc(entry.id)}">${esc(fmtTime(entry.createdAt))}</option>`)
                    ];
                    const optionsHtml = selectorOptions.join('');

                    const previousA = selectA.value;
                    const previousB = selectB.value;
                    selectA.innerHTML = optionsHtml;
                    selectB.innerHTML = optionsHtml;

                    const hasPreviousA = previousA && Array.from(selectA.options).some((opt) => opt.value === previousA);
                    if (hasPreviousA) {
                        selectA.value = previousA;
                    } else {
                        selectA.value = '__current__';
                    }

                    const hasPreviousB = previousB && Array.from(selectB.options).some((opt) => opt.value === previousB);
                    if (hasPreviousB) {
                        selectB.value = previousB;
                    } else {
                        selectB.value = externalSelectionId || versions[0]?.id || '__current__';
                    }
                }

                async function resolveSelection(selectionId) {
                    if (!currentPath || !selectionId) return null;
                    if (selectionId === '__current__') {
                        const stat = await EphemeraFS.stat(currentPath);
                        const content = await EphemeraFS.readFile(currentPath);
                        return {
                            id: '__current__',
                            isCurrent: true,
                            path: currentPath,
                            createdAt: stat?.modifiedAt || Date.now(),
                            size: stat?.size || 0,
                            content
                        };
                    }
                    if (selectionId.startsWith(EXTERNAL_SELECTION_PREFIX)) {
                        const externalPath = selectionId.slice(EXTERNAL_SELECTION_PREFIX.length);
                        if (!externalPath) return null;
                        const stat = await EphemeraFS.stat(externalPath);
                        if (!stat || stat.type !== 'file') return null;
                        const content = await EphemeraFS.readFile(externalPath);
                        return {
                            id: selectionId,
                            isExternal: true,
                            label: compareLabel,
                            path: externalPath,
                            createdAt: stat?.modifiedAt || Date.now(),
                            size: stat?.size || 0,
                            content
                        };
                    }
                    return versionMap.get(selectionId) || null;
                }

                async function renderDiff() {
                    const left = await resolveSelection(selectA.value);
                    const right = await resolveSelection(selectB.value);

                    if (!left || !right) {
                        diffLeftTitle.textContent = 'A';
                        diffRightTitle.textContent = 'B';
                        diffSummaryEl.textContent = '';
                        diffLeftBody.innerHTML = '<div class="fh-empty">Select versions to compare.</div>';
                        diffRightBody.innerHTML = '<div class="fh-empty">Select versions to compare.</div>';
                        return;
                    }

                    diffLeftTitle.textContent = describeSelection(left);
                    diffRightTitle.textContent = describeSelection(right);

                    const leftText = asText(left.content);
                    const rightText = asText(right.content);
                    if (leftText === null || rightText === null) {
                        diffSummaryEl.textContent = 'Binary content comparison is not available.';
                        diffLeftBody.innerHTML = '<div class="fh-empty">Binary or non-text snapshot.</div>';
                        diffRightBody.innerHTML = '<div class="fh-empty">Binary or non-text snapshot.</div>';
                        return;
                    }

                    const leftLines = leftText.split('\n');
                    const rightLines = rightText.split('\n');
                    const maxLines = Math.max(leftLines.length, rightLines.length, 1);
                    const renderedLeft = [];
                    const renderedRight = [];
                    const marksLeft = [];
                    const marksRight = [];
                    let changed = 0;

                    for (let i = 0; i < maxLines; i++) {
                        const leftLine = i < leftLines.length ? leftLines[i] : null;
                        const rightLine = i < rightLines.length ? rightLines[i] : null;
                        const same = leftLine !== null && rightLine !== null && leftLine === rightLine;

                        renderedLeft.push(leftLine);
                        renderedRight.push(rightLine);
                        if (same) {
                            marksLeft.push('same');
                            marksRight.push('same');
                        } else {
                            changed++;
                            marksLeft.push(leftLine === null ? 'empty' : 'diff');
                            marksRight.push(rightLine === null ? 'empty' : 'diff');
                        }
                    }

                    diffSummaryEl.textContent = `${changed} changed line${changed === 1 ? '' : 's'}`;
                    renderLines(diffLeftBody, renderedLeft, marksLeft);
                    renderLines(diffRightBody, renderedRight, marksRight);
                }

                function renderPathOptions(paths) {
                    if (!paths.length) {
                        pathSelect.innerHTML = '<option value="">No history yet</option>';
                        currentPath = '';
                        return;
                    }

                    pathSelect.innerHTML = paths.map((path) => `
                        <option value="${esc(path)}">${esc(path)}</option>
                    `).join('');

                    if (currentPath && paths.includes(currentPath)) {
                        pathSelect.value = currentPath;
                    } else {
                        currentPath = paths[0];
                        pathSelect.value = currentPath;
                    }
                }

                async function loadPathList() {
                    const allVersions = await EphemeraFS.getAllFileVersions();
                    const pathSet = new Set();
                    allVersions.forEach((entry) => {
                        if (entry?.path) pathSet.add(entry.path);
                    });
                    if (currentPath) pathSet.add(currentPath);
                    renderPathOptions(Array.from(pathSet).sort((a, b) => a.localeCompare(b)));
                }

                async function loadVersions() {
                    versionMap.clear();
                    versions = currentPath
                        ? await EphemeraFS.getFileVersions(currentPath, { order: 'desc' })
                        : [];
                    versions.forEach((entry) => {
                        versionMap.set(entry.id, entry);
                    });

                    renderTimeline();
                    renderCompareSelectors();
                    await renderDiff();

                    if (currentPath) {
                        metaEl.textContent = currentPath;
                    } else {
                        metaEl.textContent = 'No file selected';
                    }
                }

                async function refreshAll() {
                    await loadPathList();
                    await loadVersions();
                }

                async function restoreVersion(versionId) {
                    const entry = versionMap.get(versionId);
                    if (!entry) return;
                    let confirmed = true;
                    if (window.EphemeraDialog) {
                        confirmed = await EphemeraDialog.confirm(
                            `Restore snapshot from ${fmtTime(entry.createdAt)}?`,
                            'Restore Version'
                        );
                    }
                    if (!confirmed) return;

                    const restored = await EphemeraFS.restoreFileVersion(versionId);
                    if (restored) {
                        EphemeraNotifications.success('Version Restored', `Restored ${currentPath}`);
                        await refreshAll();
                    }
                }

                lifecycle.addListener(pathSelect, 'change', async () => {
                    currentPath = pathSelect.value || '';
                    await loadVersions();
                });

                lifecycle.addListener(refreshBtn, 'click', refreshAll);
                lifecycle.addListener(selectA, 'change', renderDiff);
                lifecycle.addListener(selectB, 'change', renderDiff);

                lifecycle.addListener(openFilesBtn, 'click', () => {
                    if (!window.EphemeraWM) return;
                    EphemeraWM.open('files', {
                        mode: 'open',
                        modal: true,
                        parentWindowId: windowId,
                        onFileSelect: async (path) => {
                            currentPath = EphemeraFS.normalizePath(path);
                            await refreshAll();
                            return true;
                        }
                    });
                });

                lifecycle.addListener(pruneBtn, 'click', async () => {
                    const keep = Number.parseInt(EphemeraState.settings.fileHistoryMaxVersions, 10) || 10;
                    let confirmed = true;
                    if (window.EphemeraDialog) {
                        confirmed = await EphemeraDialog.confirm(
                            `Prune version history and keep latest ${keep} snapshots per file?`,
                            'Prune Versions'
                        );
                    }
                    if (!confirmed) return;
                    const removed = await EphemeraFS.pruneAllFileVersions(keep);
                    EphemeraNotifications.success('Version History Pruned', `Removed ${removed} snapshots.`);
                    await refreshAll();
                });

                lifecycle.addListener(timelineEl, 'click', async (event) => {
                    const button = event.target.closest('button[data-action]');
                    if (!button) return;
                    const item = button.closest('.fh-version-item');
                    const versionId = item?.dataset?.versionId;
                    if (!versionId) return;

                    if (button.dataset.action === 'set-a') {
                        selectA.value = versionId;
                        await renderDiff();
                        return;
                    }

                    if (button.dataset.action === 'set-b') {
                        selectB.value = versionId;
                        await renderDiff();
                        return;
                    }

                    if (button.dataset.action === 'restore') {
                        await restoreVersion(versionId);
                    }
                });

                lifecycle.addSubscription(EphemeraEvents.on('fs:history:changed', ({ path } = {}) => {
                    if (!path || path === currentPath) {
                        refreshAll().catch((error) => {
                            console.warn('[FileHistory] Refresh failed after history change:', error);
                        });
                    }
                }));

                lifecycle.addSubscription(EphemeraEvents.on('fs:changed', ({ type, path, oldPath, newPath } = {}) => {
                    if (!currentPath) return;
                    const affectsCurrentPath = path === currentPath || oldPath === currentPath || newPath === currentPath;
                    if (!affectsCurrentPath) return;
                    if (type === 'move' && newPath && oldPath === currentPath) {
                        currentPath = newPath;
                    }
                    refreshAll().catch((error) => {
                        console.warn('[FileHistory] Refresh failed after fs change:', error);
                    });
                }));

                refreshAll();

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
