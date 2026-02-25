EphemeraApps.register({
    id: 'trash',
    name: 'Trash',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`,
    width: 600,
    height: 400,
    category: 'system',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .trash-app { display:flex;flex-direction:column;height:100%; }
                    .trash-toolbar { display:flex;gap:8px;padding:0 0 12px 0; }
                    .trash-toolbar button { padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-size:0.8rem; }
                    .trash-toolbar button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .trash-toolbar button.danger { border-color:var(--danger);color:var(--danger); }
                    .trash-toolbar button.danger:hover { background:rgba(255,77,106,0.1); }
                    .trash-list { flex:1;overflow-y:auto; }
                    .trash-item { display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--radius-sm);cursor:pointer;transition:background 0.15s; }
                    .trash-item:hover { background:rgba(255,255,255,0.05); }
                    .trash-item.selected { background:rgba(0,212,170,0.1); }
                    .trash-item svg { width:20px;height:20px;flex-shrink:0; }
                    .trash-item-info { flex:1;min-width:0; }
                    .trash-item-name { font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
                    .trash-item-path { font-size:0.7rem;color:var(--fg-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
                    .trash-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--fg-muted); }
                    .trash-empty svg { width:48px;height:48px;opacity:0.3;margin-bottom:12px; }
                </style>
                <div class="trash-app">
                    <div class="trash-toolbar">
                        <button id="trash-restore-${windowId}">Restore</button>
                        <button id="trash-delete-${windowId}" class="danger">Delete Permanently</button>
                        <button id="trash-empty-${windowId}" class="danger">Empty Trash</button>
                    </div>
                    <div class="trash-list" id="trash-list-${windowId}"></div>
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();

                const listEl = document.getElementById(`trash-list-${windowId}`);
                let selectedPath = null;

                async function loadTrash() {
                    const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                    const trashDir = `${homeDir}/.trash`;
                    if (!await EphemeraFS.exists(trashDir)) {
                        await EphemeraFS.mkdir(trashDir);
                    }
                    const items = await EphemeraFS.readdir(trashDir);

                    if (items.length === 0) {
                        listEl.innerHTML = `<div class="trash-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            <span>Trash is empty</span>
                        </div>`;
                        return;
                    }

                    listEl.innerHTML = items.map(item => {
                        const meta = item._originalPath || item.path;
                        return `<div class="trash-item" data-path="${EphemeraSanitize.escapeAttr(item.path)}" data-original="${EphemeraSanitize.escapeAttr(meta)}">
                            ${EphemeraFS.getIcon(item)}
                            <div class="trash-item-info">
                                <div class="trash-item-name">${EphemeraSanitize.escapeHtml(item.name)}</div>
                                <div class="trash-item-path">Original: ${EphemeraSanitize.escapeHtml(meta)}</div>
                            </div>
                        </div>`;
                    }).join('');

                    listEl.querySelectorAll('.trash-item').forEach(el => {
                        el.addEventListener('click', () => {
                            listEl.querySelectorAll('.trash-item').forEach(i => i.classList.remove('selected'));
                            el.classList.add('selected');
                            selectedPath = el.dataset.path;
                        });
                    });
                }

                lifecycle.addListener(document.getElementById(`trash-restore-${windowId}`), 'click', async () => {
                    if (!selectedPath) return;
                    await EphemeraFS.restore(selectedPath);
                    selectedPath = null;
                    loadTrash();
                    EphemeraNotifications.success('Restored', 'Item restored to original location.');
                });

                lifecycle.addListener(document.getElementById(`trash-delete-${windowId}`), 'click', async () => {
                    if (!selectedPath) return;
                    if (await EphemeraDialog.confirm('Permanently delete this item?', 'Delete', true)) {
                        await EphemeraStorage.delete('files', selectedPath);
                        selectedPath = null;
                        loadTrash();
                    }
                });

                lifecycle.addListener(document.getElementById(`trash-empty-${windowId}`), 'click', async () => {
                    if (await EphemeraDialog.confirm('Permanently delete all items in Trash?', 'Empty Trash', true)) {
                        await EphemeraFS.emptyTrash();
                        selectedPath = null;
                        loadTrash();
                        EphemeraNotifications.success('Trash Emptied', 'All items permanently deleted.');
                    }
                });

                loadTrash();

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
