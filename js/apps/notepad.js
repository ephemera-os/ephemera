EphemeraApps.register({
    id: 'notepad',
    name: 'Notepad',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    width: 600,
    height: 450,
    category: 'productivity',
    content: (windowId, options) => {
        const filePath = options?.filePath || null;
        const fileName = filePath ? EphemeraFS.getBasename(filePath) : 'Untitled';
        const isMobileVariant = EphemeraState?.shellMode === 'mobile' || window.innerWidth < 768;
        
        return {
            html: `
                <style>
                    .notepad-container { display:flex;flex-direction:column;height:100%; }
                    .notepad-toolbar { display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap; }
                    .notepad-toolbar button { padding:8px 16px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.8rem;transition:all 0.2s ease; }
                    .notepad-toolbar button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .notepad-toolbar .file-name { flex:1;background:transparent;border:none;color:var(--fg-primary);font-size:0.9rem;padding:0 8px; }
                    .notepad-textarea { flex:1;width:100%;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--fg-primary);font-family:'JetBrains Mono',monospace;font-size:0.9rem;padding:16px;resize:none;outline:none;line-height:1.6; }
                    .notepad-textarea:focus { border-color:var(--accent); }
                    .notepad-status { display:flex;justify-content:space-between;padding:8px 0;font-size:0.75rem;color:var(--fg-muted); }
                    .notepad-collab-panel { background:rgba(0,0,0,0.2);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:10px;display:none;flex-direction:column;gap:10px;font-size:0.8rem; }
                    .notepad-collab-panel.visible { display:flex; }
                    .notepad-collab-tabs { display:flex;gap:6px;margin-bottom:4px; }
                    .notepad-collab-tab { padding:5px 12px;border-radius:var(--radius-sm);cursor:pointer;background:var(--bg-tertiary);border:1px solid var(--border);font-size:0.76rem;color:var(--fg-secondary); }
                    .notepad-collab-tab.active { background:rgba(0,212,170,0.15);color:var(--accent);border-color:rgba(0,212,170,0.3); }
                    .notepad-collab-code { width:100%;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-family:monospace;font-size:0.72rem;padding:8px;resize:none;min-height:56px; }
                    .notepad-collab-code:focus { outline:none;border-color:var(--accent); }
                    .notepad-collab-status { font-size:0.76rem;padding:5px 10px;border-radius:var(--radius-sm); }
                    .notepad-collab-status.ok   { background:rgba(0,212,170,0.12);color:var(--accent); }
                    .notepad-collab-status.info { background:rgba(0,168,255,0.12);color:#00a8ff; }
                    .notepad-collab-status.err  { background:rgba(255,77,106,0.12);color:var(--danger); }
                    .notepad-collab-presence { font-size:0.74rem;color:var(--fg-muted); }
                    .notepad-btn-collab { background:rgba(0,168,255,0.15);color:#00a8ff;border-color:rgba(0,168,255,0.3) !important; }
                    .notepad-btn-collab.connected { background:rgba(0,212,170,0.15);color:var(--accent);border-color:rgba(0,212,170,0.3) !important; }
                    .notepad-container.notepad-mobile { --np-keyboard-offset:0px; }
                    .notepad-container.notepad-mobile .notepad-toolbar { position:fixed;left:12px;right:12px;bottom:calc(72px + var(--np-keyboard-offset));z-index:40;padding:10px;background:var(--glass);backdrop-filter:blur(14px);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:0 12px 28px rgba(0,0,0,0.35);margin-bottom:0; }
                    .notepad-container.notepad-mobile .notepad-toolbar button { min-height:44px;padding:10px 14px;font-size:0.85rem; }
                    .notepad-container.notepad-mobile .notepad-toolbar .file-name { min-height:44px;font-size:1rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:rgba(0,0,0,0.25); }
                    .notepad-container.notepad-mobile .notepad-textarea { padding:14px 14px 160px;min-height:50vh;font-size:1rem;line-height:1.65; }
                    .notepad-container.notepad-mobile .notepad-status { padding:10px 0 92px; }
                </style>
                <div class="notepad-container ${isMobileVariant ? 'notepad-mobile' : ''}">
                    <div class="notepad-toolbar" id="notepad-toolbar-${windowId}">
                        <input type="text" class="file-name" id="notepad-filename-${windowId}" value="${fileName}" placeholder="File name">
                        <button data-action="new">New</button>
                        <button data-action="open">Open</button>
                        <button data-action="save">Save</button>
                        <button data-action="saveas">Save As</button>
                        <button data-action="collab" class="notepad-btn-collab" id="notepad-collab-btn-${windowId}" title="Start or join a collaborative editing session">Collaborate</button>
                    </div>
                    <!-- Collaborate panel -->
                    <div class="notepad-collab-panel" id="notepad-collab-panel-${windowId}">
                        <div class="notepad-collab-tabs">
                            <div class="notepad-collab-tab active" data-ctab="start">Start Session</div>
                            <div class="notepad-collab-tab" data-ctab="join">Join Session</div>
                        </div>
                        <!-- Start session sub-panel -->
                        <div id="notepad-collab-start-${windowId}">
                            <div style="color:var(--fg-muted);margin-bottom:8px;">Share this code with your collaborator:</div>
                            <textarea class="notepad-collab-code" id="notepad-collab-offer-${windowId}" readonly placeholder="Click 'Generate Code' to start…" rows="3"></textarea>
                            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
                                <button class="btn" id="notepad-collab-gen-${windowId}" style="font-size:0.76rem;">Generate Code</button>
                                <button class="btn" id="notepad-collab-copy-offer-${windowId}" style="font-size:0.76rem;display:none;">Copy Code</button>
                            </div>
                            <div id="notepad-collab-answer-area-${windowId}" style="display:none;margin-top:10px;">
                                <div style="color:var(--fg-muted);margin-bottom:6px;">Paste collaborator's answer:</div>
                                <textarea class="notepad-collab-code" id="notepad-collab-answer-in-${windowId}" rows="3" placeholder="Paste answer code…"></textarea>
                                <button class="btn" id="notepad-collab-complete-${windowId}" style="margin-top:6px;font-size:0.76rem;">Connect</button>
                            </div>
                        </div>
                        <!-- Join session sub-panel -->
                        <div id="notepad-collab-join-${windowId}" style="display:none;">
                            <div style="color:var(--fg-muted);margin-bottom:8px;">Paste the initiator's code:</div>
                            <textarea class="notepad-collab-code" id="notepad-collab-offer-in-${windowId}" rows="3" placeholder="Paste offer code…"></textarea>
                            <div style="display:flex;gap:6px;margin-top:6px;">
                                <button class="btn" id="notepad-collab-join-btn-${windowId}" style="font-size:0.76rem;">Generate Answer</button>
                                <button class="btn" id="notepad-collab-copy-answer-${windowId}" style="font-size:0.76rem;display:none;">Copy Answer</button>
                            </div>
                            <textarea class="notepad-collab-code" id="notepad-collab-answer-out-${windowId}" readonly rows="3" placeholder="Answer code will appear here…" style="margin-top:8px;display:none;"></textarea>
                        </div>
                        <!-- Status -->
                        <div id="notepad-collab-status-${windowId}" class="notepad-collab-status info" style="display:none;"></div>
                        <div id="notepad-collab-presence-${windowId}" class="notepad-collab-presence"></div>
                    </div>
                    <textarea class="notepad-textarea" id="notepad-textarea-${windowId}" placeholder="Start typing..." spellcheck="false"></textarea>
                    <div class="notepad-status">
                        <span id="notepad-status-${windowId}">Ready</span>
                        <span id="notepad-chars-${windowId}">0 characters</span>
                    </div>
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();
                if (!window.EphemeraCollab && typeof window.EphemeraModuleLoader?.ensureCollab === 'function') {
                    await window.EphemeraModuleLoader.ensureCollab().catch(() => false);
                }

                const textarea = document.getElementById(`notepad-textarea-${windowId}`);
                const filenameInput = document.getElementById(`notepad-filename-${windowId}`);
                const statusEl = document.getElementById(`notepad-status-${windowId}`);
                const charsEl = document.getElementById(`notepad-chars-${windowId}`);
                const container = textarea.closest('.window-content');
                const notepadRoot = textarea.closest('.notepad-container');
                const isMobileLayout = notepadRoot?.classList.contains('notepad-mobile') ?? false;
                const visualViewport = window.visualViewport;

                if (isMobileLayout && visualViewport) {
                    const syncKeyboardOffset = () => {
                        const keyboardOffset = Math.max(0, Math.round(window.innerHeight - visualViewport.height - visualViewport.offsetTop));
                        notepadRoot.style.setProperty('--np-keyboard-offset', `${keyboardOffset}px`);
                    };
                    syncKeyboardOffset();
                    lifecycle.addListener(visualViewport, 'resize', syncKeyboardOffset);
                    lifecycle.addListener(visualViewport, 'scroll', syncKeyboardOffset);
                }
                
                let currentFile = filePath;
                let autoSaveTimer = null;
                let originalContent = '';
                let isDirty = false;
                let unregisterAssistantContext = () => {};

                function setDirty(dirty) {
                    isDirty = dirty;
                    EphemeraWM.setDirty(windowId, dirty);
                }

                function checkDirty() {
                    const dirty = textarea.value !== originalContent;
                    setDirty(dirty);
                }

                function scheduleAutoSave() {
                    if (autoSaveTimer) clearTimeout(autoSaveTimer);
                    autoSaveTimer = setTimeout(async () => {
                        const key = 'autosave:notepad:' + (currentFile || 'untitled');
                        await EphemeraStorage.put('metadata', { key, content: textarea.value, timestamp: Date.now() });
                    }, 2000);
                }

                function insertTextIntoTextarea(text) {
                    const payload = String(text || '');
                    if (!payload) return false;
                    const start = Number(textarea.selectionStart || 0);
                    const end = Number(textarea.selectionEnd || 0);
                    const current = String(textarea.value || '');
                    textarea.value = current.slice(0, start) + payload + current.slice(end);
                    const cursor = start + payload.length;
                    textarea.selectionStart = cursor;
                    textarea.selectionEnd = cursor;
                    textarea.focus();
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    return true;
                }

                if (window.EphemeraAIAssistant?.registerContextProvider) {
                    unregisterAssistantContext = window.EphemeraAIAssistant.registerContextProvider(windowId, () => {
                        const start = Number(textarea.selectionStart || 0);
                        const end = Number(textarea.selectionEnd || 0);
                        return {
                            appId: 'notepad',
                            appName: 'Notepad',
                            filePath: currentFile || '',
                            fileContent: textarea.value || '',
                            selectedText: end > start ? String(textarea.value || '').slice(start, end) : '',
                            insert: (text) => insertTextIntoTextarea(text)
                        };
                    });
                }

                if (filePath) {
                    const autoKey = 'autosave:notepad:' + filePath;
                    const saved = await EphemeraStorage.get('metadata', autoKey);
                    const content = await EphemeraFS.readFile(filePath);
                    if (saved && saved.content && content !== null && saved.timestamp) {
                        const stat = await EphemeraFS.stat(filePath);
                        if (stat && saved.timestamp > (stat.modifiedAt || 0)) {
                            if (await EphemeraDialog.confirm('A more recent auto-saved version was found. Restore it?', 'Restore Auto-Save')) {
                                textarea.value = saved.content;
                                originalContent = saved.content;
                                updateChars();
                            } else {
                                textarea.value = content;
                                originalContent = content;
                                updateChars();
                            }
                        } else {
                            textarea.value = content;
                            originalContent = content;
                            updateChars();
                        }
                    } else if (content !== null) {
                        textarea.value = content;
                        originalContent = content;
                        updateChars();
                    }
                }
                
                function updateChars() {
                    charsEl.textContent = `${textarea.value.length} characters, ${textarea.value.split('\n').length} lines`;
                }
                
                function setStatus(msg) {
                    statusEl.textContent = msg;
                    setTimeout(() => statusEl.textContent = 'Ready', 2000);
                }
                
                function getSaveDirectory() {
                    const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                    return currentFile ? EphemeraFS.getParentDir(currentFile) : `${homeDir}/Documents`;
                }
                
                function getDefaultFileName() {
                    return filenameInput.value.trim() || 'untitled.txt';
                }
                
                async function persistFile(path) {
                    const name = EphemeraFS.getBasename(path);
                    await EphemeraFS.writeFile(path, textarea.value);
                    currentFile = path;
                    filenameInput.value = name;
                    originalContent = textarea.value;
                    setDirty(false);
                    EphemeraStorage.delete('metadata', 'autosave:notepad:' + path).catch(() => {});
                    setStatus(`Saved: ${path}`);
                    EphemeraNotifications.success('File Saved', `${name} has been saved.`);
                    return true;
                }
                
                async function saveFile() {
                    if (!currentFile) {
                        return new Promise((resolve) => {
                            EphemeraWM.open('files', {
                                mode: 'save',
                                modal: true,
                                parentWindowId: windowId,
                                startPath: getSaveDirectory(),
                                saveFileName: getDefaultFileName(),
                                onSave: async (path) => {
                                    const result = await saveAs(path);
                                    resolve(result);
                                },
                                onCancel: () => {
                                    resolve(false);
                                }
                            });
                        });
                    }
                    const path = currentFile;
                    await persistFile(path);
                    return true;
                }
                
                async function saveAs(path) {
                    await persistFile(path);
                    return true;
                }
                
                lifecycle.addListener(textarea, 'input', () => {
                    updateChars();
                    checkDirty();
                    scheduleAutoSave();
                });

                container.querySelectorAll('.notepad-toolbar button').forEach(btn => {
                    lifecycle.addListener(btn, 'click', async () => {
                        const action = btn.dataset.action;

                        if (action === 'new') {
                            if (isDirty) {
                                const result = await EphemeraWM.promptUnsavedChanges(
                                    'You have unsaved changes. Do you want to save before creating a new file?'
                                );
                                if (result === 'cancel') return;
                                if (result === 'save') {
                                    const saved = await saveFile();
                                    if (!saved) return;
                                }
                            }
                            textarea.value = '';
                            originalContent = '';
                            filenameInput.value = 'Untitled';
                            currentFile = null;
                            setDirty(false);
                            updateChars();
                            setStatus('New file');
                        }

                        if (action === 'open') {
                            if (isDirty) {
                                const result = await EphemeraWM.promptUnsavedChanges(
                                    'You have unsaved changes. Do you want to save before opening another file?'
                                );
                                if (result === 'cancel') return;
                                if (result === 'save') {
                                    const saved = await saveFile();
                                    if (!saved) return;
                                }
                            }
                            EphemeraWM.open('files', {
                                mode: 'open',
                                modal: true,
                                parentWindowId: windowId,
                                onFileSelect: async (path) => {
                                    const content = await EphemeraFS.readFile(path);
                                    if (content !== null) {
                                        textarea.value = content;
                                        originalContent = content;
                                        currentFile = path;
                                        filenameInput.value = EphemeraFS.getBasename(path);
                                        setDirty(false);
                                        updateChars();
                                        setStatus(`Opened: ${path}`);
                                    }
                                }
                            });
                        }

                        if (action === 'save') {
                            await saveFile();
                        }

                        if (action === 'saveas') {
                            EphemeraWM.open('files', {
                                mode: 'save',
                                modal: true,
                                parentWindowId: windowId,
                                startPath: getSaveDirectory(),
                                saveFileName: getDefaultFileName(),
                                onSave: async (path) => {
                                    return saveAs(path);
                                }
                            });
                        }
                    });
                });

                lifecycle.addListener(textarea, 'keydown', (e) => {
                    if (e.ctrlKey && e.key === 's') {
                        e.preventDefault();
                        saveFile();
                    }
                });

                // ── Collaborative editing ─────────────────────────────────────
                let destroyCollab = () => {};

                if (window.EphemeraCollab && window.EphemeraP2P) {
                    const collabBtn = document.getElementById(`notepad-collab-btn-${windowId}`);
                    const collabPanel = document.getElementById(`notepad-collab-panel-${windowId}`);
                    const collabStatus = document.getElementById(`notepad-collab-status-${windowId}`);
                    const collabPresence = document.getElementById(`notepad-collab-presence-${windowId}`);

                    const collabUser = {
                        name: EphemeraState?.user?.displayName || EphemeraState?.user?.name || EphemeraState?.user?.id || 'Collaborator'
                    };

                    let collabSessionId = null;
                    let collabConnected = false;
                    let collabUnbind = null;

                    function setCollabStatus(text, type = 'info') {
                        if (!collabStatus) return;
                        collabStatus.textContent = text;
                        collabStatus.className = `notepad-collab-status ${type}`;
                        collabStatus.style.display = text ? 'block' : 'none';
                    }

                    function renderPresence(presence = []) {
                        if (!collabPresence) return;
                        if (!presence.length) {
                            collabPresence.textContent = collabConnected
                                ? 'Connected. Waiting for collaborator cursor...'
                                : '';
                            return;
                        }

                        collabPresence.textContent = presence
                            .map((peer) => {
                                const loc = (peer.line && peer.col)
                                    ? `Ln ${peer.line}, Col ${peer.col}`
                                    : 'active';
                                return `${peer.name} (${loc})`;
                            })
                            .join(' | ');
                    }

                    function resetCollabState() {
                        collabConnected = false;
                        collabBtn?.classList.remove('connected');
                        renderPresence([]);
                    }

                    function closeCurrentSession() {
                        if (collabUnbind) {
                            collabUnbind();
                            collabUnbind = null;
                        }
                        if (collabSessionId) {
                            window.EphemeraCollab.closeSession(collabSessionId);
                            collabSessionId = null;
                        }
                        resetCollabState();
                    }

                    function bindSession(sessionId) {
                        if (collabUnbind) collabUnbind();
                        collabSessionId = sessionId;
                        collabUnbind = window.EphemeraCollab.bindTextarea(sessionId, textarea, {
                            onPresence: (presence) => {
                                renderPresence(presence);
                            },
                            onChange: () => {
                                updateChars();
                                checkDirty();
                            }
                        });
                    }

                    destroyCollab = () => {
                        closeCurrentSession();
                    };

                    lifecycle.addSubscription(
                        EphemeraEvents.on('p2p:connected', ({ sessionId }) => {
                            if (sessionId !== collabSessionId) return;
                            collabConnected = true;
                            collabBtn?.classList.add('connected');
                            setCollabStatus('Connected - collaborating in real time', 'ok');
                        })
                    );

                    lifecycle.addSubscription(
                        EphemeraEvents.on('p2p:disconnected', ({ sessionId }) => {
                            if (sessionId !== collabSessionId) return;
                            if (collabUnbind) {
                                collabUnbind();
                                collabUnbind = null;
                            }
                            collabSessionId = null;
                            resetCollabState();
                            setCollabStatus('Collaborator disconnected', 'err');
                        })
                    );

                    lifecycle.addSubscription(
                        EphemeraEvents.on('collab:error', ({ sessionId, error }) => {
                            if (sessionId !== collabSessionId) return;
                            setCollabStatus('Collaboration error: ' + error, 'err');
                        })
                    );

                    if (collabBtn) {
                        lifecycle.addListener(collabBtn, 'click', () => {
                            if (!collabPanel) return;
                            collabPanel.classList.toggle('visible');
                        });
                    }

                    collabPanel?.querySelectorAll('.notepad-collab-tab').forEach(tab => {
                        lifecycle.addListener(tab, 'click', () => {
                            collabPanel.querySelectorAll('.notepad-collab-tab').forEach(t => t.classList.remove('active'));
                            tab.classList.add('active');
                            const which = tab.dataset.ctab;
                            const startDiv = document.getElementById(`notepad-collab-start-${windowId}`);
                            const joinDiv = document.getElementById(`notepad-collab-join-${windowId}`);
                            if (startDiv) startDiv.style.display = which === 'start' ? '' : 'none';
                            if (joinDiv) joinDiv.style.display = which === 'join' ? '' : 'none';
                        });
                    });

                    const genBtn = document.getElementById(`notepad-collab-gen-${windowId}`);
                    const offerTA = document.getElementById(`notepad-collab-offer-${windowId}`);
                    const copyOfferBtn = document.getElementById(`notepad-collab-copy-offer-${windowId}`);
                    const answerArea = document.getElementById(`notepad-collab-answer-area-${windowId}`);
                    const answerInTA = document.getElementById(`notepad-collab-answer-in-${windowId}`);
                    const completeBtn = document.getElementById(`notepad-collab-complete-${windowId}`);
                    const joinBtn = document.getElementById(`notepad-collab-join-btn-${windowId}`);
                    const offerInTA = document.getElementById(`notepad-collab-offer-in-${windowId}`);
                    const answerOutTA = document.getElementById(`notepad-collab-answer-out-${windowId}`);
                    const copyAnsBtn = document.getElementById(`notepad-collab-copy-answer-${windowId}`);

                    if (genBtn) {
                        lifecycle.addListener(genBtn, 'click', async () => {
                            genBtn.disabled = true;
                            genBtn.textContent = 'Generating...';
                            try {
                                closeCurrentSession();
                                const { sessionId, offerCode } = await window.EphemeraCollab.createOffer({
                                    docId: currentFile || `notepad-${windowId}`,
                                    title: filenameInput?.value || 'Untitled',
                                    initialText: textarea.value,
                                    user: collabUser
                                });
                                bindSession(sessionId);
                                if (offerTA) offerTA.value = offerCode;
                                if (copyOfferBtn) copyOfferBtn.style.display = '';
                                if (answerArea) answerArea.style.display = '';
                                setCollabStatus('Share the code above, then paste their answer to connect', 'info');
                                genBtn.textContent = 'Regenerate';
                            } catch (e) {
                                setCollabStatus('Error: ' + e.message, 'err');
                                genBtn.textContent = 'Generate Code';
                            } finally {
                                genBtn.disabled = false;
                            }
                        });
                    }

                    if (copyOfferBtn && offerTA) {
                        lifecycle.addListener(copyOfferBtn, 'click', () => {
                            navigator.clipboard.writeText(offerTA.value).catch(() => {});
                            const orig = copyOfferBtn.textContent;
                            copyOfferBtn.textContent = 'Copied!';
                            setTimeout(() => { copyOfferBtn.textContent = orig; }, 1500);
                        });
                    }

                    if (completeBtn) {
                        lifecycle.addListener(completeBtn, 'click', async () => {
                            const code = answerInTA?.value?.trim();
                            if (!code || !collabSessionId) return;
                            completeBtn.disabled = true;
                            completeBtn.textContent = 'Connecting...';
                            try {
                                await window.EphemeraCollab.completeOffer(collabSessionId, code);
                                setCollabStatus('Waiting for peer connection...', 'info');
                            } catch (e) {
                                setCollabStatus('Error: ' + e.message, 'err');
                                completeBtn.textContent = 'Connect';
                                completeBtn.disabled = false;
                            }
                        });
                    }

                    if (joinBtn) {
                        lifecycle.addListener(joinBtn, 'click', async () => {
                            const code = offerInTA?.value?.trim();
                            if (!code) {
                                setCollabStatus('Paste the offer code first.', 'err');
                                return;
                            }
                            joinBtn.disabled = true;
                            joinBtn.textContent = 'Generating...';
                            try {
                                closeCurrentSession();
                                const { sessionId, answerCode, doc } = await window.EphemeraCollab.createAnswer(code, {
                                    user: collabUser
                                });
                                bindSession(sessionId);
                                if (answerOutTA) {
                                    answerOutTA.value = answerCode;
                                    answerOutTA.style.display = '';
                                }
                                if (copyAnsBtn) copyAnsBtn.style.display = '';
                                const docTitle = doc?.title ? ` for "${doc.title}"` : '';
                                setCollabStatus(`Send your answer code back to the initiator${docTitle}`, 'info');
                                joinBtn.textContent = 'Regenerate';
                            } catch (e) {
                                setCollabStatus('Error: ' + e.message, 'err');
                                joinBtn.textContent = 'Generate Answer';
                            } finally {
                                joinBtn.disabled = false;
                            }
                        });
                    }

                    if (copyAnsBtn && answerOutTA) {
                        lifecycle.addListener(copyAnsBtn, 'click', () => {
                            navigator.clipboard.writeText(answerOutTA.value).catch(() => {});
                            const orig = copyAnsBtn.textContent;
                            copyAnsBtn.textContent = 'Copied!';
                            setTimeout(() => { copyAnsBtn.textContent = orig; }, 1500);
                        });
                    }
                }

                updateChars();

                return {
                    onSave: async () => {
                        return await saveFile();
                    },
                    destroy: () => {
                        if (autoSaveTimer) clearTimeout(autoSaveTimer);
                        destroyCollab();
                        unregisterAssistantContext();
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});

