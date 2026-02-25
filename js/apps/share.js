EphemeraApps.register({
    id: 'share',
    name: 'Share',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
    width: 500,
    height: 560,
    category: 'system',
    content: (windowId, options = {}) => {
        // options.filePath => send + publish for a file
        // options.targetPath => publish for a file or directory
        // options.mode === 'receive' + options.offerCode => Receive mode pre-filled
        const filePath = options.filePath || null;
        const publishPath = options.targetPath || options.filePath || null;
        const initOfferCode = options.offerCode || '';
        const initSessionToken = options.sessionToken || '';
        const hasSendTarget = Boolean(filePath);
        const hasPublishTarget = Boolean(publishPath);
        const defaultTab = options.mode === 'receive' ? 'receive'
            : options.mode === 'publish' ? 'publish'
                : hasSendTarget ? 'send' : 'receive';
        const fileName = filePath ? EphemeraFS.getBasename(filePath) : '';
        const publishName = publishPath ? EphemeraFS.getBasename(publishPath) : '';

        return {
            html: `
<style>
    .share-app { display:flex;flex-direction:column;height:100%;gap:0; }
    .share-tabs { display:flex;border-bottom:1px solid var(--border);flex-shrink:0; }
    .share-tab  { padding:10px 18px;font-size:0.82rem;cursor:pointer;border-bottom:2px solid transparent;color:var(--fg-secondary);transition:all 0.15s; }
    .share-tab:hover { color:var(--fg-primary); }
    .share-tab.active { border-bottom-color:var(--accent);color:var(--accent); }
    .share-panel { display:none;flex-direction:column;gap:14px;padding:20px;overflow-y:auto;flex:1; }
    .share-panel.active { display:flex; }
    .share-label  { font-size:0.78rem;color:var(--fg-muted);margin-bottom:4px; }
    .share-code   { width:100%;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);
                    color:var(--fg-primary);font-family:monospace;font-size:0.72rem;padding:10px;resize:none;
                    line-height:1.5;min-height:72px; }
    .share-code:focus { outline:none;border-color:var(--accent); }
    .share-row    { display:flex;gap:8px;align-items:flex-start; }
    .share-progress { width:100%;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;display:none; }
    .share-progress-bar { height:100%;background:var(--accent);width:0%;transition:width 0.15s; }
    .share-info   { background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.2);border-radius:var(--radius-md);padding:12px;font-size:0.82rem;line-height:1.6; }
    .share-step   { display:flex;align-items:flex-start;gap:10px;font-size:0.82rem;line-height:1.5;color:var(--fg-secondary); }
    .share-step-num { width:20px;height:20px;border-radius:50%;background:var(--accent);color:#000;font-size:0.7rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px; }
    .share-divider { border:none;border-top:1px solid var(--border);margin:4px 0; }
    .share-status { font-size:0.8rem;padding:8px 12px;border-radius:var(--radius-sm);display:none; }
    .share-status.ok   { background:rgba(0,212,170,0.12);color:var(--accent); }
    .share-status.err  { background:rgba(255,77,106,0.12);color:var(--danger); }
    .share-status.info { background:rgba(0,168,255,0.12);color:#00a8ff; }
    .share-file-info { font-size:0.8rem;color:var(--fg-secondary);padding:8px 0;border-bottom:1px solid var(--border); }
</style>
<div class="share-app">
    <div class="share-tabs">
        ${hasSendTarget ? `<div class="share-tab ${defaultTab==='send'?'active':''}" data-tab="send">Send</div>` : ''}
        <div class="share-tab ${defaultTab==='receive'?'active':''}" data-tab="receive">Receive</div>
        ${hasPublishTarget ? `<div class="share-tab ${defaultTab==='publish'?'active':''}" data-tab="publish">Publish Link</div>` : ''}
    </div>

    <!-- SEND panel -->
    ${hasSendTarget ? `
    <div class="share-panel ${defaultTab==='send'?'active':''}" id="share-send-${windowId}">
        <div class="share-file-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <strong>${EphemeraSanitize.escapeHtml(fileName)}</strong>
        </div>

        <div class="share-step"><div class="share-step-num">1</div><div>Click <strong>Generate Offer</strong> to create a share code, then copy the link and send it to your recipient.</div></div>
        <button class="btn" id="share-gen-offer-${windowId}">Generate Offer Code</button>

        <div id="share-offer-area-${windowId}" style="display:none;flex-direction:column;gap:10px;">
            <div>
                <div class="share-label">Share URL (send this to recipient):</div>
                <div class="share-row">
                    <input type="text" id="share-url-${windowId}" readonly
                        style="flex:1;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);padding:8px;font-size:0.78rem;">
                    <button class="btn" id="share-copy-url-${windowId}">Copy URL</button>
                </div>
            </div>
            <details style="font-size:0.8rem;color:var(--fg-muted);">
                <summary style="cursor:pointer;">Raw offer code</summary>
                <div style="margin-top:8px;">
                    <textarea id="share-offer-code-${windowId}" class="share-code" readonly rows="3"></textarea>
                    <button class="btn" id="share-copy-offer-${windowId}" style="margin-top:6px;font-size:0.75rem;">Copy Code</button>
                </div>
            </details>

            <hr class="share-divider">
            <div class="share-step"><div class="share-step-num">2</div><div>The recipient will give you their <strong>answer code</strong>. Paste it below to connect.</div></div>
            <div>
                <div class="share-label">Recipient's answer code:</div>
                <div class="share-row">
                    <textarea id="share-answer-input-${windowId}" class="share-code" rows="3" placeholder="Paste answer code here…"></textarea>
                </div>
                <button class="btn" id="share-connect-${windowId}" style="margin-top:8px;">Connect & Send</button>
            </div>
            <div class="share-progress" id="share-send-progress-${windowId}"><div class="share-progress-bar" id="share-send-bar-${windowId}"></div></div>
            <div class="share-status" id="share-send-status-${windowId}"></div>
        </div>
    </div>` : ''}

    <!-- RECEIVE panel -->
    <div class="share-panel ${defaultTab==='receive'?'active':''}" id="share-receive-${windowId}">
        <div class="share-step"><div class="share-step-num">1</div><div>Paste the <strong>share URL or offer code</strong> you received from the sender.</div></div>
        <div>
            <div class="share-label">Offer code or share URL:</div>
            <textarea id="share-recv-offer-${windowId}" class="share-code" rows="3"
                placeholder="Paste code or URL here…">${EphemeraSanitize.escapeHtml(initOfferCode)}</textarea>
            <button class="btn" id="share-recv-gen-${windowId}" style="margin-top:8px;">Generate Answer Code</button>
        </div>

        <div id="share-answer-area-${windowId}" style="display:none;flex-direction:column;gap:10px;">
            <div class="share-step"><div class="share-step-num">2</div><div>Send your <strong>answer code</strong> back to the sender. They will paste it to establish the connection.</div></div>
            <div>
                <div class="share-label">Your answer code (send to sender):</div>
                <div class="share-row">
                    <textarea id="share-answer-code-${windowId}" class="share-code" readonly rows="3"></textarea>
                    <button class="btn" id="share-copy-answer-${windowId}">Copy</button>
                </div>
            </div>
            <div class="share-progress" id="share-recv-progress-${windowId}"><div class="share-progress-bar" id="share-recv-bar-${windowId}"></div></div>
            <div class="share-status" id="share-recv-status-${windowId}"></div>
            <button class="btn" id="share-save-file-${windowId}" style="display:none;">Save to Ephemera</button>
        </div>
    </div>

    <!-- PUBLISH panel -->
    ${hasPublishTarget ? `
    <div class="share-panel ${defaultTab==='publish'?'active':''}" id="share-publish-${windowId}">
        <div class="share-info">
            Generate a <strong>read-only link</strong> anyone can open in Ephemera. For items under 200 KB the link is self-contained. Larger items can be published to a public GitHub Gist (token required in Settings → Cloud Sync).
        </div>
        <div class="share-file-info">
            <strong>${EphemeraSanitize.escapeHtml(publishName)}</strong>
            <span id="share-pub-size-${windowId}" style="margin-left:8px;color:var(--fg-muted);"></span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn" id="share-pub-url-${windowId}">Generate URL Link</button>
            <button class="btn" id="share-pub-gist-${windowId}">Publish to Gist</button>
        </div>
        <div id="share-pub-result-${windowId}" style="display:none;flex-direction:column;gap:8px;">
            <div class="share-label">Shareable link:</div>
            <div class="share-row">
                <input type="text" id="share-pub-link-${windowId}" readonly
                    style="flex:1;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);padding:8px;font-size:0.78rem;">
                <button class="btn" id="share-pub-copy-${windowId}">Copy</button>
            </div>
        </div>
        <div class="share-status" id="share-pub-status-${windowId}"></div>
    </div>` : ''}
</div>`,

            init: () => {
                const lifecycle = createAppLifecycle();
                const shareLinks = window.EphemeraShareLinks || null;

                // ── Tab switching ─────────────────────────────────────────────
                const container = document.getElementById(`share-send-${windowId}`)?.closest('.window-content')
                               || document.getElementById(`share-receive-${windowId}`)?.closest('.window-content');

                container?.querySelectorAll('.share-tab').forEach(tab => {
                    lifecycle.addListener(tab, 'click', () => {
                        container.querySelectorAll('.share-tab').forEach(t => t.classList.remove('active'));
                        container.querySelectorAll('.share-panel').forEach(p => p.classList.remove('active'));
                        tab.classList.add('active');
                        const panel = document.getElementById(`share-${tab.dataset.tab}-${windowId}`);
                        panel?.classList.add('active');
                        if (tab.dataset.tab === 'publish') loadPubSize();
                    });
                });

                // ── Helpers ───────────────────────────────────────────────────
                function setStatus(elId, text, type = 'info') {
                    const el = document.getElementById(elId);
                    if (!el) return;
                    el.textContent = text;
                    el.className = `share-status ${type}`;
                    el.style.display = text ? 'block' : 'none';
                }

                function setProgress(barId, progressId, pct) {
                    const bar  = document.getElementById(barId);
                    const wrap = document.getElementById(progressId);
                    if (!bar || !wrap) return;
                    wrap.style.display = 'block';
                    bar.style.width = pct + '%';
                }

                function formatBytes(n) {
                    if (n < 1024) return `${n} B`;
                    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
                    return `${(n / 1024 / 1024).toFixed(1)} MB`;
                }

                function copyText(text, btn) {
                    const copyWithToast = () => {
                        const orig = btn.textContent;
                        btn.textContent = 'Copied!';
                        setTimeout(() => { btn.textContent = orig; }, 1500);
                    };

                    if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(text).then(copyWithToast).catch(() => {
                            const ta = document.createElement('textarea');
                            ta.value = text;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            ta.remove();
                            copyWithToast();
                        });
                    } else {
                        // Fallback for non-HTTPS
                        const ta = document.createElement('textarea');
                        ta.value = text;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        ta.remove();
                        copyWithToast();
                    }
                }

                function extractCode(raw) {
                    // Accept raw code or a URL containing ?ephemera-receive=<code>
                    const raw2 = raw.trim();
                    try {
                        const url = new URL(raw2, location.origin);
                        const code = url.searchParams.get('ephemera-receive');
                        if (code) {
                            const session = url.searchParams.get('ephemera-session');
                            return { code, sessionToken: session || '' };
                        }
                    } catch { /* not a URL */ }
                    return { code: raw2, sessionToken: '' };
                }

                function isTextLikeMimeType(mimeType) {
                    return shareLinks?.isTextLikeMimeType(mimeType) ?? false;
                }

                async function getUniquePath(basePath) {
                    if (!await EphemeraFS.exists(basePath)) return basePath;

                    const ext = EphemeraFS.getExtension(basePath);
                    const dotExt = ext ? `.${ext}` : '';
                    const stem = dotExt ? basePath.slice(0, -dotExt.length) : basePath;

                    for (let i = 1; i < 1000; i++) {
                        const candidate = `${stem} (${i})${dotExt}`;
                        if (!await EphemeraFS.exists(candidate)) {
                            return candidate;
                        }
                    }

                    throw new Error('Could not allocate a unique file name');
                }

                async function summarizeTarget(path) {
                    const stat = await EphemeraFS.stat(path);
                    if (!stat) throw new Error('Target not found');

                    if (stat.type === 'file') {
                        return {
                            type: 'file',
                            size: stat.size || 0,
                            files: 1
                        };
                    }

                    let totalSize = 0;
                    let fileCount = 0;
                    const stack = [path];

                    while (stack.length > 0) {
                        const current = stack.pop();
                        const children = await EphemeraFS.readdir(current);
                        for (const child of children) {
                            if (child.type === 'directory') {
                                stack.push(child.path);
                            } else {
                                fileCount += 1;
                                totalSize += child.size || 0;
                            }
                        }
                    }

                    return {
                        type: 'directory',
                        size: totalSize,
                        files: fileCount
                    };
                }

                async function buildFilePayload(path, stat) {
                    const content = await EphemeraFS.readFile(path);
                    if (content === null) {
                        throw new Error('Could not read file');
                    }
                    return shareLinks.createFilePayload({
                        name: stat?.name || EphemeraFS.getBasename(path),
                        mimeType: stat?.mimeType || EphemeraFS.getMimeType(path) || 'application/octet-stream',
                        content
                    });
                }

                async function buildDirectoryPayload(path) {
                    const entries = [];
                    const rootName = EphemeraFS.getBasename(path) || 'shared-folder';
                    const stack = [{ abs: path, rel: '' }];

                    while (stack.length > 0) {
                        const current = stack.pop();
                        const children = await EphemeraFS.readdir(current.abs);

                        for (const child of children) {
                            const relPath = current.rel ? `${current.rel}/${child.name}` : child.name;
                            if (child.type === 'directory') {
                                stack.push({ abs: child.path, rel: relPath });
                                continue;
                            }

                            const content = await EphemeraFS.readFile(child.path);
                            if (content === null) continue;
                            entries.push({
                                path: relPath,
                                mimeType: child.mimeType || EphemeraFS.getMimeType(child.path) || 'application/octet-stream',
                                content
                            });
                        }
                    }

                    return shareLinks.createDirectoryPayload({
                        name: rootName,
                        entries
                    });
                }

                async function buildReadOnlyPayload(path) {
                    if (!shareLinks) {
                        throw new Error('Share links module is not available');
                    }

                    const stat = await EphemeraFS.stat(path);
                    if (!stat) throw new Error('Target not found');

                    if (stat.type === 'directory') {
                        return buildDirectoryPayload(path);
                    }

                    return buildFilePayload(path, stat);
                }

                let sendSessionId = null;

                // ── SEND panel ────────────────────────────────────────────────
                if (hasSendTarget) {
                    let sendSessionToken = '';
                    const maxP2PSize = Number(window.EphemeraP2P?.MAX_FILE_SIZE) || (100 * 1024 * 1024);

                    const genOfferBtn    = document.getElementById(`share-gen-offer-${windowId}`);
                    const offerArea      = document.getElementById(`share-offer-area-${windowId}`);
                    const urlInput       = document.getElementById(`share-url-${windowId}`);
                    const copyUrlBtn     = document.getElementById(`share-copy-url-${windowId}`);
                    const offerCodeTA    = document.getElementById(`share-offer-code-${windowId}`);
                    const copyOfferBtn   = document.getElementById(`share-copy-offer-${windowId}`);
                    const answerInputTA  = document.getElementById(`share-answer-input-${windowId}`);
                    const connectBtn     = document.getElementById(`share-connect-${windowId}`);

                    lifecycle.addListener(genOfferBtn, 'click', async () => {
                        genOfferBtn.disabled = true;
                        genOfferBtn.textContent = 'Generating...';
                        try {
                            const stat = await EphemeraFS.stat(filePath);
                            if (!stat || stat.type !== 'file') {
                                throw new Error('File not found');
                            }
                            if (stat.size > maxP2PSize) {
                                throw new Error(`File is ${formatBytes(stat.size)}. P2P limit is ${formatBytes(maxP2PSize)}.`);
                            }

                            if (sendSessionId) {
                                EphemeraP2P.close(sendSessionId);
                            }

                            const { sessionId, offerCode, sessionToken } = await EphemeraP2P.createSendOffer({
                                name: fileName,
                                size: stat.size ?? 0,
                                mimeType: stat?.mimeType || 'application/octet-stream'
                            });
                            sendSessionId = sessionId;
                            sendSessionToken = sessionToken || '';

                            const shareUrl = `${location.origin}${location.pathname}?ephemera-receive=${encodeURIComponent(offerCode)}&ephemera-session=${encodeURIComponent(sendSessionToken)}`;
                            urlInput.value    = shareUrl;
                            offerCodeTA.value = offerCode;
                            offerArea.style.display = 'flex';
                            genOfferBtn.textContent = 'Regenerate Offer';
                            setStatus(`share-send-status-${windowId}`, 'Offer generated. Share this link with your recipient.', 'info');
                            genOfferBtn.disabled = false;
                        } catch (e) {
                            genOfferBtn.textContent = 'Generate Offer Code';
                            genOfferBtn.disabled = false;
                            setStatus(`share-send-status-${windowId}`, 'Failed to create offer: ' + e.message, 'err');
                        }
                    });

                    lifecycle.addListener(copyUrlBtn,   'click', () => copyText(urlInput.value,    copyUrlBtn));
                    lifecycle.addListener(copyOfferBtn, 'click', () => copyText(offerCodeTA.value, copyOfferBtn));

                    lifecycle.addListener(connectBtn, 'click', async () => {
                        if (!sendSessionId) {
                            setStatus(`share-send-status-${windowId}`, 'Generate an offer first.', 'err');
                            return;
                        }
                        const answerCode = answerInputTA.value.trim();
                        if (!answerCode) {
                            setStatus(`share-send-status-${windowId}`, 'Paste the recipient\'s answer code.', 'err');
                            return;
                        }
                        connectBtn.disabled = true;
                        connectBtn.textContent = 'Connecting...';
                        setStatus(`share-send-status-${windowId}`, 'Connecting to recipient...', 'info');

                        try {
                            await EphemeraP2P.completeSend(sendSessionId, answerCode);

                            if (EphemeraP2P.isConnected(sendSessionId)) {
                                setStatus(`share-send-status-${windowId}`, 'Connected! Sending file...', 'info');
                                try {
                                    const content = await EphemeraFS.readFile(filePath);
                                    await EphemeraP2P.sendFile(sendSessionId, content ?? '');
                                    setStatus(`share-send-status-${windowId}`, 'File sent successfully.', 'ok');
                                    setProgress(`share-send-bar-${windowId}`, `share-send-progress-${windowId}`, 100);
                                    connectBtn.textContent = 'Sent';
                                    return;
                                } catch (e) {
                                    setStatus(`share-send-status-${windowId}`, 'Send failed: ' + e.message, 'err');
                                    connectBtn.disabled = false;
                                    connectBtn.textContent = 'Retry Send';
                                    return;
                                }
                            }
                        } catch (e) {
                            connectBtn.disabled = false;
                            connectBtn.textContent = 'Connect & Send';
                            setStatus(`share-send-status-${windowId}`, 'Connection failed: ' + e.message, 'err');
                            return;
                        }

                        // Wait for channel to open (p2p:connected)
                        const connSub = lifecycle.addSubscription(
                            EphemeraEvents.on('p2p:connected', async ({ sessionId }) => {
                                if (sessionId !== sendSessionId) return;
                                connSub?.(); // unsubscribe
                                setStatus(`share-send-status-${windowId}`, 'Connected! Sending file...', 'info');

                                try {
                                    const content = await EphemeraFS.readFile(filePath);
                                    await EphemeraP2P.sendFile(sendSessionId, content ?? '');
                                    setStatus(`share-send-status-${windowId}`, `File sent successfully.`, 'ok');
                                    setProgress(`share-send-bar-${windowId}`, `share-send-progress-${windowId}`, 100);
                                    connectBtn.textContent = 'Sent';
                                } catch (e) {
                                    setStatus(`share-send-status-${windowId}`, 'Send failed: ' + e.message, 'err');
                                    connectBtn.disabled = false;
                                    connectBtn.textContent = 'Retry Send';
                                }
                            })
                        );

                        lifecycle.addSubscription(
                            EphemeraEvents.on('p2p:send-progress', ({ sessionId, percent }) => {
                                if (sessionId !== sendSessionId) return;
                                setProgress(`share-send-bar-${windowId}`, `share-send-progress-${windowId}`, percent);
                            })
                        );
                    });
                }

                // ── RECEIVE panel ─────────────────────────────────────────────
                let recvSessionId = null;
                let receivedBlob  = null;
                let receivedName  = null;
                let receivedMimeType = 'application/octet-stream';
                let expectedSessionToken = initSessionToken;

                const recvOfferTA    = document.getElementById(`share-recv-offer-${windowId}`);
                const recvGenBtn     = document.getElementById(`share-recv-gen-${windowId}`);
                const answerArea     = document.getElementById(`share-answer-area-${windowId}`);
                const answerCodeTA   = document.getElementById(`share-answer-code-${windowId}`);
                const copyAnswerBtn  = document.getElementById(`share-copy-answer-${windowId}`);
                const saveFileBtn    = document.getElementById(`share-save-file-${windowId}`);

                // Auto-trigger if offer code was passed in options
                if (initOfferCode && recvOfferTA) {
                    recvOfferTA.value = initOfferCode;
                }

                if (recvGenBtn) {
                    lifecycle.addListener(recvGenBtn, 'click', async () => {
                        const raw = recvOfferTA?.value || '';
                        const parsed = extractCode(raw);
                        const offerCode = parsed.code;
                        if (!offerCode) {
                            setStatus(`share-recv-status-${windowId}`, 'Paste an offer code or URL first.', 'err');
                            return;
                        }
                        if (parsed.sessionToken) {
                            expectedSessionToken = parsed.sessionToken;
                        }

                        recvGenBtn.disabled = true;
                        recvGenBtn.textContent = 'Generating...';

                        try {
                            const { sessionId, answerCode, meta, sessionToken } = await EphemeraP2P.createReceiveAnswer(offerCode);
                            if (expectedSessionToken && sessionToken && expectedSessionToken !== sessionToken) {
                                throw new Error('Session token mismatch');
                            }
                            recvSessionId = sessionId;
                            receivedName  = meta?.name || 'received-file';
                            receivedMimeType = meta?.mimeType || 'application/octet-stream';
                            receivedBlob = null;

                            answerCodeTA.value = answerCode;
                            answerArea.style.display = 'flex';
                            if (saveFileBtn) saveFileBtn.style.display = 'none';
                            setStatus(`share-recv-status-${windowId}`, `Answer ready. Waiting for ${receivedName}...`, 'info');
                            recvGenBtn.textContent = 'Regenerate Answer';
                            recvGenBtn.disabled = false;

                            // Subscribe to transfer events
                            lifecycle.addSubscription(
                                EphemeraEvents.on('p2p:transfer-start', ({ sessionId, name, mimeType }) => {
                                    if (sessionId !== recvSessionId) return;
                                    if (name) receivedName = name;
                                    if (mimeType) receivedMimeType = mimeType;
                                    setStatus(`share-recv-status-${windowId}`, `Connected. Receiving ${receivedName}...`, 'info');
                                })
                            );

                            lifecycle.addSubscription(
                                EphemeraEvents.on('p2p:transfer-progress', ({ sessionId, percent }) => {
                                    if (sessionId !== recvSessionId) return;
                                    setProgress(`share-recv-bar-${windowId}`, `share-recv-progress-${windowId}`, percent);
                                    setStatus(`share-recv-status-${windowId}`, `Receiving... ${percent}%`, 'info');
                                })
                            );

                            lifecycle.addSubscription(
                                EphemeraEvents.on('p2p:transfer-complete', ({ sessionId, name, mimeType, blob }) => {
                                    if (sessionId !== recvSessionId) return;
                                    receivedBlob = blob;
                                    receivedName = name || receivedName;
                                    receivedMimeType = mimeType || receivedMimeType;
                                    setProgress(`share-recv-bar-${windowId}`, `share-recv-progress-${windowId}`, 100);
                                    setStatus(`share-recv-status-${windowId}`, `"${receivedName}" received!`, 'ok');
                                    if (saveFileBtn) saveFileBtn.style.display = 'block';
                                })
                            );

                        } catch (e) {
                            recvGenBtn.disabled = false;
                            recvGenBtn.textContent = 'Generate Answer Code';
                            setStatus(`share-recv-status-${windowId}`, 'Error: ' + e.message, 'err');
                        }
                    });
                }

                if (initOfferCode && recvGenBtn) {
                    queueMicrotask(() => recvGenBtn.click());
                }

                if (copyAnswerBtn && answerCodeTA) {
                    lifecycle.addListener(copyAnswerBtn, 'click', () => copyText(answerCodeTA.value, copyAnswerBtn));
                }

                if (saveFileBtn) {
                    lifecycle.addListener(saveFileBtn, 'click', async () => {
                        if (!receivedBlob || !receivedName) return;
                        saveFileBtn.disabled = true;
                        saveFileBtn.textContent = 'Saving...';
                        try {
                            const homeDir = EphemeraFS.homeDir || '/home/user';
                            const downloadsDir = `${homeDir}/Downloads`;
                            await EphemeraFS.ensureDir(downloadsDir);

                            const basePath = `${downloadsDir}/${receivedName}`;
                            const savePath = await getUniquePath(basePath);
                            const content = isTextLikeMimeType(receivedMimeType)
                                ? await receivedBlob.text()
                                : await receivedBlob.arrayBuffer();

                            await EphemeraFS.writeFile(savePath, content, {
                                mimeType: receivedMimeType || 'application/octet-stream'
                            });
                            EphemeraNotifications.success('File Saved', `Saved to ${savePath}`);
                            saveFileBtn.textContent = 'Saved!';
                        } catch (e) {
                            EphemeraNotifications.error('Save Failed', e.message);
                            saveFileBtn.disabled = false;
                            saveFileBtn.textContent = 'Save to Ephemera';
                        }
                    });
                }

                // ── PUBLISH panel ─────────────────────────────────────────────
                const MAX_URL_PAYLOAD_BYTES = 200 * 1024; // 200 KB serialized payload budget

                async function loadPubSize() {
                    if (!publishPath) return;
                    const sizeEl = document.getElementById(`share-pub-size-${windowId}`);
                    if (!sizeEl) return;
                    try {
                        const summary = await summarizeTarget(publishPath);
                        if (summary.type === 'directory') {
                            sizeEl.textContent = `Directory • ${summary.files} files • ${formatBytes(summary.size)}`;
                        } else {
                            sizeEl.textContent = `File • ${formatBytes(summary.size)}`;
                        }
                    } catch {
                        sizeEl.textContent = '';
                    }
                }

                const pubUrlBtn  = document.getElementById(`share-pub-url-${windowId}`);
                const pubGistBtn = document.getElementById(`share-pub-gist-${windowId}`);
                const pubResult  = document.getElementById(`share-pub-result-${windowId}`);
                const pubLinkIn  = document.getElementById(`share-pub-link-${windowId}`);
                const pubCopyBtn = document.getElementById(`share-pub-copy-${windowId}`);

                function showPubLink(url) {
                    if (!pubLinkIn || !pubResult) return;
                    pubLinkIn.value = url;
                    pubResult.style.display = 'flex';
                }

                if (pubUrlBtn) {
                    lifecycle.addListener(pubUrlBtn, 'click', async () => {
                        pubUrlBtn.disabled = true;
                        pubUrlBtn.textContent = 'Generating...';
                        setStatus(`share-pub-status-${windowId}`, '', '');
                        try {
                            if (!publishPath) throw new Error('No file or folder selected');
                            const payload = await buildReadOnlyPayload(publishPath);
                            const bytes = shareLinks.payloadSizeBytes(payload);
                            if (bytes > MAX_URL_PAYLOAD_BYTES) {
                                setStatus(`share-pub-status-${windowId}`,
                                    `Item is ${formatBytes(bytes)}. URL link limit is ${formatBytes(MAX_URL_PAYLOAD_BYTES)}. Use Publish to Gist.`, 'err');
                                return;
                            }
                            const encoded = shareLinks.encodePayload(payload);
                            const url = `${location.origin}${location.pathname}?ephemera-view=${encodeURIComponent(encoded)}`;
                            showPubLink(url);
                            setStatus(`share-pub-status-${windowId}`, 'Read-only link generated.', 'ok');
                        } catch (e) {
                            setStatus(`share-pub-status-${windowId}`, 'Error: ' + e.message, 'err');
                        } finally {
                            pubUrlBtn.disabled = false;
                            pubUrlBtn.textContent = 'Generate URL Link';
                        }
                    });
                }

                if (pubGistBtn) {
                    lifecycle.addListener(pubGistBtn, 'click', async () => {
                        const token = await EphemeraStorage.get('metadata', 'syncGistToken')
                            .then(r => r?.value || '').catch(() => '');
                        if (!token) {
                            setStatus(`share-pub-status-${windowId}`,
                                'No GitHub token configured. Add one in Settings → Cloud Sync → Gist.', 'err');
                            return;
                        }
                        pubGistBtn.disabled = true;
                        pubGistBtn.textContent = 'Publishing...';
                        setStatus(`share-pub-status-${windowId}`, '', '');
                        try {
                            if (!publishPath) throw new Error('No file or folder selected');
                            const payload = await buildReadOnlyPayload(publishPath);
                            const manifest = JSON.stringify(payload, null, 2);
                            const body = JSON.stringify({
                                description: `Shared via Ephemera: ${publishName || 'shared-item'}`,
                                public: true,
                                files: {
                                    '.ephemera-share.json': { content: manifest },
                                    'README_ephemera_share.txt': {
                                        content: 'Open via Ephemera using the generated ephemera-gist link.'
                                    }
                                }
                            });
                            const res = await fetch('https://api.github.com/gists', {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Accept': 'application/vnd.github.v3+json',
                                    'Content-Type': 'application/json'
                                },
                                body
                            });
                            if (!res.ok) throw new Error(`GitHub ${res.status}: ${res.statusText}`);
                            const gist = await res.json();
                            if (!gist?.id) throw new Error('Invalid response from GitHub');
                            const ephemeraUrl = `${location.origin}${location.pathname}?ephemera-gist=${encodeURIComponent(gist.id)}`;
                            showPubLink(ephemeraUrl);
                            setStatus(`share-pub-status-${windowId}`, 'Published to GitHub Gist.', 'ok');
                        } catch (e) {
                            setStatus(`share-pub-status-${windowId}`, 'Publish failed: ' + e.message, 'err');
                        } finally {
                            pubGistBtn.disabled = false;
                            pubGistBtn.textContent = 'Publish to Gist';
                        }
                    });
                }

                if (pubCopyBtn && pubLinkIn) {
                    lifecycle.addListener(pubCopyBtn, 'click', () => copyText(pubLinkIn.value, pubCopyBtn));
                }

                if (defaultTab === 'publish') {
                    queueMicrotask(() => {
                        loadPubSize().catch(() => {});
                    });
                }

                return {
                    destroy: () => {
                        // Clean up any active P2P sessions
                        if (sendSessionId) EphemeraP2P.close(sendSessionId);
                        if (recvSessionId) EphemeraP2P.close(recvSessionId);
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
