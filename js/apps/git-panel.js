EphemeraApps.register({
    id: 'git-panel',
    name: 'Git Panel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 9-9 9-9-9 9-9z"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>`,
    width: 760,
    height: 620,
    category: 'development',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .git-panel { display:flex;flex-direction:column;height:100%;background:var(--bg-primary); }
                    .git-toolbar { display:flex;gap:8px;align-items:center;padding:10px;border-bottom:1px solid var(--border);background:var(--bg-secondary); }
                    .git-toolbar input { flex:1;min-width:180px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:7px 10px;color:var(--fg-primary);font-size:0.8rem; }
                    .git-toolbar button,.git-actions button,.git-clone button { border:1px solid var(--border);background:var(--bg-tertiary);color:var(--fg-secondary);border-radius:var(--radius-sm);padding:7px 10px;cursor:pointer;font-size:0.76rem; }
                    .git-toolbar button:hover,.git-actions button:hover,.git-clone button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .git-toolbar button.primary,.git-actions button.primary,.git-clone button.primary { background:var(--accent);border-color:var(--accent);color:var(--bg-primary); }
                    .git-toolbar button.primary:hover,.git-actions button.primary:hover,.git-clone button.primary:hover { background:var(--accent-hover); }
                    .git-main { display:grid;grid-template-columns:1.1fr 1fr;gap:10px;flex:1;min-height:0;padding:10px; }
                    .git-col { display:flex;flex-direction:column;gap:10px;min-height:0; }
                    .git-card { border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-secondary);padding:10px;display:flex;flex-direction:column;min-height:0; }
                    .git-card h3 { margin:0 0 8px;font-size:0.8rem;font-weight:600;color:var(--fg-secondary);display:flex;align-items:center;justify-content:space-between; }
                    .git-actions { display:flex;gap:8px;flex-wrap:wrap; }
                    .git-status { min-height:24px;font-size:0.74rem;border-radius:var(--radius-sm);padding:6px 8px;display:none; }
                    .git-status.show { display:block; }
                    .git-status.info { background:rgba(0,168,255,0.14);color:#00a8ff; }
                    .git-status.ok { background:rgba(0,212,170,0.14);color:var(--accent); }
                    .git-status.err { background:rgba(255,77,106,0.15);color:var(--danger); }
                    .git-branch-line { font-size:0.78rem;color:var(--fg-secondary);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px; }
                    .git-badge { border:1px solid var(--border);padding:3px 8px;border-radius:999px;font-size:0.72rem;background:var(--bg-tertiary);color:var(--fg-primary); }
                    .git-list { list-style:none;margin:0;padding:0;overflow:auto;display:flex;flex-direction:column;gap:5px;min-height:0; }
                    .git-list li { border:1px solid var(--border);border-radius:var(--radius-sm);padding:7px 9px;background:var(--bg-primary);font-size:0.74rem;line-height:1.35; }
                    .git-list .meta { color:var(--fg-muted);font-size:0.7rem;display:flex;justify-content:space-between;gap:8px;margin-top:4px; }
                    .git-list .path { font-family:var(--font-mono);word-break:break-all; }
                    .git-list .pill { padding:2px 7px;border-radius:999px;border:1px solid var(--border);font-size:0.68rem; }
                    .git-list .pill.clean { color:var(--fg-muted); }
                    .git-list .pill.modified { color:#ffb84d;border-color:rgba(255,184,77,0.45);background:rgba(255,184,77,0.14); }
                    .git-list .pill.untracked { color:#00a8ff;border-color:rgba(0,168,255,0.45);background:rgba(0,168,255,0.14); }
                    .git-list .pill.added,.git-list .pill.staged,.git-list .pill.staged-and-modified { color:var(--accent);border-color:rgba(0,212,170,0.45);background:rgba(0,212,170,0.14); }
                    .git-list .pill.deleted,.git-list .pill.deleted-staged { color:var(--danger);border-color:rgba(255,77,106,0.45);background:rgba(255,77,106,0.14); }
                    .git-list .pill.conflicted { color:#ff6b6b;border-color:rgba(255,107,107,0.45);background:rgba(255,107,107,0.14); }
                    .git-empty { color:var(--fg-muted);font-size:0.75rem;padding:10px;border:1px dashed var(--border);border-radius:var(--radius-sm);text-align:center; }
                    .git-commit-row { display:flex;gap:8px; }
                    .git-commit-row input { flex:1;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:7px 10px;color:var(--fg-primary);font-size:0.78rem; }
                    .git-clone { display:flex;flex-direction:column;gap:7px; }
                    .git-clone input { width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:7px 10px;color:var(--fg-primary);font-size:0.76rem; }
                    @media (max-width: 920px) {
                        .git-main { grid-template-columns:1fr; }
                    }
                </style>
                <div class="git-panel">
                    <div class="git-toolbar">
                        <input id="git-path-${windowId}" placeholder="/home/user/my-repo" />
                        <button id="git-open-${windowId}" class="primary">Open</button>
                        <button id="git-init-${windowId}">Init</button>
                        <button id="git-refresh-${windowId}">Refresh</button>
                    </div>
                    <div class="git-main">
                        <div class="git-col">
                            <div class="git-card">
                                <h3>Repository</h3>
                                <div class="git-branch-line">
                                    <span id="git-branch-${windowId}" class="git-badge">No repo</span>
                                    <div class="git-actions">
                                        <button id="git-branch-create-${windowId}">New Branch</button>
                                        <button id="git-branch-switch-${windowId}">Checkout</button>
                                    </div>
                                </div>
                                <div class="git-actions">
                                    <button id="git-stage-all-${windowId}">Stage All</button>
                                    <button id="git-pull-${windowId}">Pull</button>
                                    <button id="git-push-${windowId}">Push</button>
                                    <button id="git-stash-save-${windowId}">Stash Save</button>
                                    <button id="git-stash-pop-${windowId}">Stash Pop</button>
                                </div>
                                <div style="height:8px"></div>
                                <div class="git-commit-row">
                                    <input id="git-commit-msg-${windowId}" placeholder="Commit message..." />
                                    <button id="git-commit-${windowId}" class="primary">Commit</button>
                                </div>
                            </div>
                            <div class="git-card" style="flex:1;">
                                <h3>Changes</h3>
                                <ul id="git-status-list-${windowId}" class="git-list"></ul>
                            </div>
                        </div>
                        <div class="git-col">
                            <div class="git-card">
                                <h3>Clone</h3>
                                <div class="git-clone">
                                    <input id="git-clone-url-${windowId}" placeholder="https://github.com/user/repo.git" />
                                    <input id="git-clone-target-${windowId}" placeholder="/home/user/projects/repo" />
                                    <button id="git-clone-run-${windowId}" class="primary">Clone</button>
                                </div>
                            </div>
                            <div class="git-card" style="flex:1;">
                                <h3>Recent Commits</h3>
                                <ul id="git-log-list-${windowId}" class="git-list"></ul>
                            </div>
                        </div>
                    </div>
                    <div id="git-status-msg-${windowId}" class="git-status info"></div>
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();
                const home = window.EphemeraFS?.homeDir || '/home/user';
                const defaultPath = `${home}/projects/demo-repo`;

                const pathInput = document.getElementById(`git-path-${windowId}`);
                const branchBadge = document.getElementById(`git-branch-${windowId}`);
                const statusList = document.getElementById(`git-status-list-${windowId}`);
                const logList = document.getElementById(`git-log-list-${windowId}`);
                const statusMsg = document.getElementById(`git-status-msg-${windowId}`);
                const commitInput = document.getElementById(`git-commit-msg-${windowId}`);
                const cloneUrlInput = document.getElementById(`git-clone-url-${windowId}`);
                const cloneTargetInput = document.getElementById(`git-clone-target-${windowId}`);

                pathInput.value = defaultPath;
                cloneTargetInput.value = defaultPath;

                let activeRepoPath = pathInput.value;

                function showStatus(message, tone = 'info') {
                    statusMsg.textContent = String(message || '');
                    statusMsg.className = `git-status show ${tone}`;
                }

                function getRepoPath() {
                    return String(pathInput.value || '').trim();
                }

                async function promptInput(message, title, defaultValue = '', placeholder = '') {
                    if (window.EphemeraDialog?.prompt) {
                        const value = await window.EphemeraDialog.prompt(message, defaultValue, title, placeholder);
                        return typeof value === 'string' ? value.trim() : '';
                    }
                    showStatus('Dialog system is unavailable.', 'err');
                    return '';
                }

                function escapeHtml(value) {
                    return window.EphemeraSanitize?.escapeHtml?.(value) || String(value || '');
                }

                function renderStatusRows(rows) {
                    if (!rows || rows.length === 0) {
                        statusList.innerHTML = '<div class="git-empty">No pending changes.</div>';
                        return;
                    }

                    statusList.innerHTML = rows.map((row) => {
                        return `
                            <li>
                                <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
                                    <span class="path">${escapeHtml(row.filepath)}</span>
                                    <span class="pill ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span>
                                </div>
                                <div class="meta">
                                    <span>staged: ${row.staged ? 'yes' : 'no'}</span>
                                    <span>unstaged: ${row.unstaged ? 'yes' : 'no'}</span>
                                </div>
                            </li>
                        `;
                    }).join('');
                }

                function renderLogRows(rows) {
                    if (!rows || rows.length === 0) {
                        logList.innerHTML = '<div class="git-empty">No commits yet.</div>';
                        return;
                    }
                    logList.innerHTML = rows.map((entry) => {
                        const oid = (entry.oid || '').slice(0, 8);
                        const msg = entry.commit?.message?.trim?.() || '(no message)';
                        const author = entry.commit?.author?.name || 'unknown';
                        const when = entry.commit?.author?.timestamp
                            ? new Date(entry.commit.author.timestamp * 1000).toLocaleString()
                            : '';
                        return `
                            <li>
                                <div>${escapeHtml(msg)}</div>
                                <div class="meta">
                                    <span>${escapeHtml(author)}</span>
                                    <span>${escapeHtml(oid)} ${escapeHtml(when)}</span>
                                </div>
                            </li>
                        `;
                    }).join('');
                }

                async function refreshRepoData(path = null) {
                    const repoPath = path || activeRepoPath || getRepoPath();
                    if (!repoPath) return;
                    activeRepoPath = repoPath;
                    pathInput.value = repoPath;
                    cloneTargetInput.value = repoPath;

                    if (!window.EphemeraGit) {
                        showStatus('Git system not loaded.', 'err');
                        return;
                    }

                    try {
                        const info = await window.EphemeraGit.getRepoInfo(repoPath);
                        if (!info.isRepo) {
                            branchBadge.textContent = 'No git repo';
                            renderStatusRows([]);
                            renderLogRows([]);
                            showStatus('Not a git repository. Click Init or Clone.', 'info');
                            return;
                        }

                        branchBadge.textContent = info.branch ? `branch: ${info.branch}` : 'detached HEAD';
                        renderStatusRows(info.status || []);
                        const commits = await window.EphemeraGit.getLog(repoPath, { depth: 15 });
                        renderLogRows(commits || []);
                        showStatus(`Loaded ${repoPath}`, 'ok');
                    } catch (err) {
                        console.error('[GitPanel] refresh failed:', err);
                        showStatus(err?.message || 'Failed to load repository', 'err');
                    }
                }

                async function runAction(action, successMessage) {
                    const repoPath = getRepoPath();
                    if (!repoPath) {
                        showStatus('Repository path is required.', 'err');
                        return;
                    }
                    try {
                        await action(repoPath);
                        await refreshRepoData(repoPath);
                        if (successMessage) {
                            showStatus(successMessage, 'ok');
                        }
                    } catch (err) {
                        console.error('[GitPanel] action failed:', err);
                        showStatus(err?.message || 'Git action failed', 'err');
                    }
                }

                lifecycle.addListener(document.getElementById(`git-open-${windowId}`), 'click', async () => {
                    await refreshRepoData(getRepoPath());
                });

                lifecycle.addListener(document.getElementById(`git-refresh-${windowId}`), 'click', async () => {
                    await refreshRepoData(getRepoPath());
                });

                lifecycle.addListener(document.getElementById(`git-init-${windowId}`), 'click', async () => {
                    await runAction(async (repoPath) => {
                        await window.EphemeraGit.initRepo(repoPath);
                    }, 'Repository initialized.');
                });

                lifecycle.addListener(document.getElementById(`git-stage-all-${windowId}`), 'click', async () => {
                    await runAction(async (repoPath) => {
                        await window.EphemeraGit.stageAll(repoPath);
                    }, 'All changes staged.');
                });

                lifecycle.addListener(document.getElementById(`git-commit-${windowId}`), 'click', async () => {
                    const msg = String(commitInput.value || '').trim();
                    if (!msg) {
                        showStatus('Commit message is required.', 'err');
                        return;
                    }
                    await runAction(async (repoPath) => {
                        await window.EphemeraGit.commit(repoPath, msg);
                        commitInput.value = '';
                    }, 'Commit created.');
                });

                lifecycle.addListener(document.getElementById(`git-pull-${windowId}`), 'click', async () => {
                    await runAction(async (repoPath) => {
                        await window.EphemeraGit.pull(repoPath);
                    }, 'Pull completed.');
                });

                lifecycle.addListener(document.getElementById(`git-push-${windowId}`), 'click', async () => {
                    await runAction(async (repoPath) => {
                        await window.EphemeraGit.push(repoPath);
                    }, 'Push completed.');
                });

                lifecycle.addListener(document.getElementById(`git-stash-save-${windowId}`), 'click', async () => {
                    await runAction(async (repoPath) => {
                        const result = await window.EphemeraGit.stashSave(repoPath);
                        if (!result) {
                            throw new Error('No changes to stash.');
                        }
                    }, 'Stash saved.');
                });

                lifecycle.addListener(document.getElementById(`git-stash-pop-${windowId}`), 'click', async () => {
                    await runAction(async (repoPath) => {
                        await window.EphemeraGit.stashPop(repoPath);
                    }, 'Stash applied.');
                });

                lifecycle.addListener(document.getElementById(`git-branch-create-${windowId}`), 'click', async () => {
                    const branch = await promptInput(
                        'Enter a name for the new branch.',
                        'New Branch',
                        '',
                        'feature/my-branch'
                    );
                    if (!branch) return;
                    await runAction(async (repoPath) => {
                        await window.EphemeraGit.createBranch(repoPath, branch, { checkout: true });
                    }, `Branch ${branch} created.`);
                });

                lifecycle.addListener(document.getElementById(`git-branch-switch-${windowId}`), 'click', async () => {
                    const branch = await promptInput(
                        'Enter the branch to checkout.',
                        'Checkout Branch',
                        '',
                        'main'
                    );
                    if (!branch) return;
                    await runAction(async (repoPath) => {
                        await window.EphemeraGit.checkout(repoPath, branch);
                    }, `Checked out ${branch}.`);
                });

                lifecycle.addListener(document.getElementById(`git-clone-run-${windowId}`), 'click', async () => {
                    const url = String(cloneUrlInput.value || '').trim();
                    const target = String(cloneTargetInput.value || '').trim();
                    if (!url || !target) {
                        showStatus('Clone URL and target path are required.', 'err');
                        return;
                    }

                    try {
                        await window.EphemeraGit.clone(url, target);
                        activeRepoPath = target;
                        pathInput.value = target;
                        await refreshRepoData(target);
                        showStatus('Repository cloned.', 'ok');
                    } catch (err) {
                        console.error('[GitPanel] clone failed:', err);
                        showStatus(err?.message || 'Clone failed', 'err');
                    }
                });

                await refreshRepoData(defaultPath);

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
