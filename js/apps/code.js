EphemeraApps.register({
    id: 'code',
    name: 'Code Editor',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    width: 950,
    height: 650,
    category: 'development',
    content: (windowId, options = {}) => {
        return {
            html: `
                <style>
                    .ide-container { display:flex;height:100%;overflow:hidden; }
                    .ide-sidebar { width:250px;background:rgba(0,0,0,0.3);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0; }
                    .ide-sidebar-header { padding:8px;border-bottom:1px solid var(--border);display:flex;gap:6px; }
                    .ide-sidebar-tab { flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-tertiary);color:var(--fg-secondary);cursor:pointer;font-size:0.72rem;font-weight:500;display:flex;align-items:center;justify-content:center;gap:6px; }
                    .ide-sidebar-tab:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .ide-sidebar-tab.active { background:rgba(0,212,170,0.15);border-color:rgba(0,212,170,0.35);color:var(--accent); }
                    .ide-sidebar-panel { flex:1;display:none;flex-direction:column;min-height:0; }
                    .ide-sidebar-panel.active { display:flex; }
                    .ide-file-tree { flex:1;overflow-y:auto;padding:6px; }
                    .file-tree-item { padding:5px 10px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.75rem;display:flex;align-items:center;gap:6px;margin-bottom:2px; }
                    .file-tree-item:hover { background:rgba(255,255,255,0.05); }
                    .file-tree-item.active { background:rgba(0,212,170,0.15);color:var(--accent); }
                    .file-tree-item svg { width:12px;height:12px;flex-shrink:0; }
                    .file-tree-item .label { flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
                    .file-tree-item .git-indicator { border:1px solid var(--border);border-radius:10px;padding:1px 6px;font-size:0.63rem;font-weight:600;line-height:1.2; }
                    .file-tree-item .git-indicator.modified { color:#ffb84d;border-color:rgba(255,184,77,0.4);background:rgba(255,184,77,0.14); }
                    .file-tree-item .git-indicator.untracked { color:#00a8ff;border-color:rgba(0,168,255,0.4);background:rgba(0,168,255,0.14); }
                    .file-tree-item .git-indicator.added,.file-tree-item .git-indicator.staged,.file-tree-item .git-indicator.staged-and-modified { color:var(--accent);border-color:rgba(0,212,170,0.4);background:rgba(0,212,170,0.14); }
                    .file-tree-item .git-indicator.deleted,.file-tree-item .git-indicator.deleted-staged { color:var(--danger);border-color:rgba(255,77,106,0.4);background:rgba(255,77,106,0.14); }
                    .file-tree-item .git-indicator.conflicted { color:#ff6b6b;border-color:rgba(255,107,107,0.4);background:rgba(255,107,107,0.14); }
                    .file-tree-folder { font-weight:500; }
                    .file-tree-children { padding-left:12px; }
                    .ide-source-control { flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px; }
                    .ide-source-repo { font-family:var(--font-mono);font-size:0.67rem;color:var(--fg-secondary);padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-primary);word-break:break-all; }
                    .ide-source-oauth { border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-primary);padding:7px;display:flex;flex-direction:column;gap:6px; }
                    .ide-source-oauth-status { font-size:0.7rem;color:var(--fg-secondary);line-height:1.35; }
                    .ide-source-oauth-status.ok { color:var(--accent); }
                    .ide-source-oauth-status.err { color:var(--danger); }
                    .ide-source-oauth-actions { display:flex;gap:6px;flex-wrap:wrap; }
                    .ide-source-oauth-actions button { flex:1;min-width:90px;padding:6px 8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:0.69rem;color:var(--fg-secondary); }
                    .ide-source-oauth-actions button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .ide-source-oauth-actions button.primary { background:var(--accent);border-color:var(--accent);color:var(--bg-primary); }
                    .ide-source-oauth-actions button.primary:hover { background:var(--accent-hover); }
                    .ide-source-clone { display:flex;flex-direction:column;gap:6px; }
                    .ide-source-clone input { width:100%;padding:7px 8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.71rem; }
                    .ide-source-clone button { padding:6px 8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:0.7rem;color:var(--fg-secondary); }
                    .ide-source-clone button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .ide-source-clone button.primary { background:var(--accent);border-color:var(--accent);color:var(--bg-primary); }
                    .ide-source-clone button.primary:hover { background:var(--accent-hover); }
                    .ide-source-actions { display:flex;gap:6px;flex-wrap:wrap; }
                    .ide-source-actions button { flex:1;min-width:84px;padding:6px 8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:0.7rem;color:var(--fg-secondary); }
                    .ide-source-actions button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .ide-source-actions button.primary { background:var(--accent);border-color:var(--accent);color:var(--bg-primary); }
                    .ide-source-actions button.primary:hover { background:var(--accent-hover); }
                    .ide-source-commit { display:flex;gap:6px; }
                    .ide-source-commit input { flex:1;min-width:0;padding:7px 8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.72rem; }
                    .ide-source-commit button { padding:7px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:0.7rem;color:var(--fg-secondary); }
                    .ide-source-commit button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .ide-source-commit button.primary { background:var(--accent);border-color:var(--accent);color:var(--bg-primary); }
                    .ide-source-commit button.primary:hover { background:var(--accent-hover); }
                    .ide-source-progress { min-height:20px;padding:4px 6px;font-size:0.69rem;border-radius:var(--radius-sm);display:none; }
                    .ide-source-progress.info { display:block;background:rgba(0,168,255,0.14);color:#00a8ff; }
                    .ide-source-progress.ok { display:block;background:rgba(0,212,170,0.14);color:var(--accent); }
                    .ide-source-progress.err { display:block;background:rgba(255,77,106,0.15);color:var(--danger); }
                    .ide-source-list { display:flex;flex-direction:column;gap:6px;overflow-y:auto;min-height:0;flex:1; }
                    .ide-source-empty { font-size:0.72rem;color:var(--fg-muted);padding:10px;border:1px dashed var(--border);border-radius:var(--radius-sm);text-align:center; }
                    .ide-source-item { border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px;background:var(--bg-primary);font-size:0.7rem;display:flex;flex-direction:column;gap:5px; }
                    .ide-source-item-top { display:flex;align-items:center;gap:6px;min-width:0; }
                    .ide-source-path { font-family:var(--font-mono);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
                    .ide-source-pill { border:1px solid var(--border);border-radius:9px;padding:1px 6px;font-size:0.63rem;font-weight:600;text-transform:uppercase;line-height:1.2; }
                    .ide-source-pill.modified { color:#ffb84d;border-color:rgba(255,184,77,0.4);background:rgba(255,184,77,0.14); }
                    .ide-source-pill.untracked { color:#00a8ff;border-color:rgba(0,168,255,0.4);background:rgba(0,168,255,0.14); }
                    .ide-source-pill.added,.ide-source-pill.staged,.ide-source-pill.staged-and-modified { color:var(--accent);border-color:rgba(0,212,170,0.4);background:rgba(0,212,170,0.14); }
                    .ide-source-pill.deleted,.ide-source-pill.deleted-staged { color:var(--danger);border-color:rgba(255,77,106,0.4);background:rgba(255,77,106,0.14); }
                    .ide-source-pill.conflicted { color:#ff6b6b;border-color:rgba(255,107,107,0.4);background:rgba(255,107,107,0.14); }
                    .ide-source-item button { align-self:flex-end;padding:3px 8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-secondary);cursor:pointer;font-size:0.67rem; }
                    .ide-source-item button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .ide-main { flex:1;display:flex;flex-direction:column;min-width:0; }
                    .ide-tabs { display:flex;background:rgba(0,0,0,0.2);border-bottom:1px solid var(--border);overflow-x:auto; }
                    .ide-tab { padding:8px 14px;font-size:0.8rem;cursor:pointer;border-bottom:2px solid transparent;display:flex;align-items:center;gap:6px;white-space:nowrap; }
                    .ide-tab:hover { background:rgba(255,255,255,0.03); }
                    .ide-tab.active { border-bottom-color:var(--accent);color:var(--accent); }
                    .ide-tab .close { opacity:0.5;font-size:0.9rem;line-height:1; }
                    .ide-tab .close:hover { opacity:1; }
                    .ide-toolbar { display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(0,0,0,0.2);border-bottom:1px solid var(--border); }
                    .ide-toolbar button { padding:5px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:0.75rem;color:var(--fg-secondary);display:flex;align-items:center;gap:5px; }
                    .ide-toolbar button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .ide-toolbar button.primary { background:var(--accent);color:var(--bg-primary);border-color:var(--accent); }
                    .ide-toolbar button.primary:hover { background:var(--accent-hover); }
                    .ide-toolbar button.ai-btn { background:rgba(0,168,255,0.2);color:#00a8ff;border-color:rgba(0,168,255,0.3); }
                    .ide-toolbar button.ai-btn:hover { background:rgba(0,168,255,0.3); }
                    .ide-toolbar button.ai-btn.active { background:#00a8ff;color:var(--bg-primary); }
                    .ide-toolbar button.collab-btn { background:rgba(0,168,255,0.2);color:#00a8ff;border-color:rgba(0,168,255,0.35); }
                    .ide-toolbar button.collab-btn.connected { background:rgba(0,212,170,0.2);color:var(--accent);border-color:rgba(0,212,170,0.35); }
                    .ide-toolbar .app-info { flex:1;display:flex;align-items:center;gap:10px;color:var(--fg-secondary);font-size:0.75rem; }
                    .ide-toolbar .app-info .badge { padding:2px 6px;border-radius:8px;font-size:0.65rem; }
                    .ide-toolbar .app-info .badge.installed { background:rgba(0,212,170,0.2);color:var(--accent); }
                    .ide-toolbar .app-info .badge.not-installed { background:rgba(255,184,77,0.2);color:var(--warning); }
                    .ide-collab-panel { display:none;flex-direction:column;gap:10px;padding:10px;background:rgba(0,0,0,0.2);border-bottom:1px solid var(--border); }
                    .ide-collab-panel.visible { display:flex; }
                    .ide-collab-tabs { display:flex;gap:6px; }
                    .ide-collab-tab { padding:5px 12px;border-radius:var(--radius-sm);cursor:pointer;background:var(--bg-tertiary);border:1px solid var(--border);font-size:0.75rem;color:var(--fg-secondary); }
                    .ide-collab-tab.active { background:rgba(0,212,170,0.15);color:var(--accent);border-color:rgba(0,212,170,0.35); }
                    .ide-collab-code { width:100%;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-family:monospace;font-size:0.72rem;padding:8px;resize:vertical;min-height:56px; }
                    .ide-collab-status { font-size:0.74rem;padding:6px 10px;border-radius:var(--radius-sm);display:none; }
                    .ide-collab-status.ok { background:rgba(0,212,170,0.12);color:var(--accent); }
                    .ide-collab-status.info { background:rgba(0,168,255,0.12);color:#00a8ff; }
                    .ide-collab-status.err { background:rgba(255,77,106,0.12);color:var(--danger); }
                    .ide-collab-presence { font-size:0.72rem;color:var(--fg-muted); }
                    .ide-content-area { flex:1;display:flex;overflow:hidden; }
                    .ide-editor-container { flex:1;display:flex;overflow:hidden;min-width:300px; }
                    .ide-editor { flex:1;display:none; }
                    .ide-editor.active { display:flex;flex-direction:column; }
                    .ide-welcome { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--fg-muted);padding:30px;text-align:center; }
                    .ide-welcome svg { width:48px;height:48px;opacity:0.3;margin-bottom:16px; }
                    .ide-welcome h2 { font-size:1.2rem;color:var(--fg-secondary);margin-bottom:10px; }
                    .ide-welcome p { font-size:0.8rem;margin-bottom:6px; }
                    .ide-welcome .quick-actions { display:flex;flex-direction:column;gap:10px;margin-top:16px; }
                    .ide-welcome .quick-actions .row { display:flex;gap:10px;justify-content:center; }
                    .ide-statusbar { display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 10px;background:rgba(0,0,0,0.3);border-top:1px solid var(--border);font-size:0.7rem;color:var(--fg-muted); }
                    .ide-status-right { display:flex;align-items:center;gap:8px;min-width:0; }
                    .ide-status-btn { padding:2px 7px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-secondary);font-size:0.66rem;cursor:pointer; }
                    .ide-status-btn:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .ide-status-btn:disabled { opacity:0.5;cursor:not-allowed; }
                    .ide-git-branch-select { max-width:150px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-secondary);font-size:0.66rem;padding:2px 6px; }
                    .ide-status-progress { min-width:90px;text-align:right;color:var(--fg-muted);font-size:0.66rem; }
                    .ai-panel { width:0;background:rgba(0,0,0,0.3);border-left:1px solid var(--border);display:flex;flex-direction:column;transition:width 0.2s ease;overflow:hidden; }
                    .ai-panel.open { width:380px; }
                    .preview-panel { width:0;background:var(--bg-primary);border-left:1px solid var(--border);display:flex;flex-direction:column;transition:width 0.2s ease;overflow:hidden; }
                    .preview-panel.open { width:45%;min-width:300px; }
                    .preview-panel-header { padding:8px 12px;background:rgba(0,0,0,0.3);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0; }
                    .preview-panel-header h3 { font-size:0.8rem;display:flex;align-items:center;gap:8px;margin:0; }
                    .preview-panel-header button { padding:4px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:0.7rem;color:var(--fg-secondary); }
                    .preview-panel-header button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .preview-frame { flex:1;border:none;background:#fff; }
                    .preview-toolbar { display:flex;gap:6px;padding:6px 10px;background:rgba(0,0,0,0.2);border-bottom:1px solid var(--border); }
                    .preview-toolbar input { flex:1;padding:6px 10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.75rem; }
                    .ai-panel-header { padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0; }
                    .ai-panel-header h3 { font-size:0.85rem;display:flex;align-items:center;gap:8px; }
                    .ai-panel-header h3 svg { width:16px;height:16px;color:#00a8ff; }
                    .ai-model-select { padding:6px 8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.75rem;width:100%; }
                    .ai-chat { flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px; }
                    .ai-message { padding:12px 14px;border-radius:var(--radius-md);font-size:0.8rem;line-height:1.6;max-width:100%;overflow-wrap:break-word;position:relative; }
                    .ai-message.user { background:rgba(0,168,255,0.15);border:1px solid rgba(0,168,255,0.2);margin-left:20px; }
                    .ai-message.assistant { background:var(--bg-tertiary);border:1px solid var(--border);margin-right:20px; }
                    .ai-message-actions { position:absolute;top:6px;right:6px;display:none;gap:4px; }
                    .ai-message:hover .ai-message-actions { display:flex; }
                    .ai-message-actions button { padding:4px 6px;font-size:0.7rem;background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:4px;color:var(--fg-muted);cursor:pointer; }
                    .ai-message-actions button:hover { background:rgba(0,0,0,0.6);color:var(--fg-primary); }
                    .ai-message h1,.ai-message h2,.ai-message h3 { margin:0.5em 0 0.3em;font-size:1em;font-weight:600; }
                    .ai-message h1 { font-size:1.2em; } .ai-message h2 { font-size:1.1em; }
                    .ai-message p { margin:0.5em 0; }
                    .ai-message ul,.ai-message ol { margin:0.5em 0;padding-left:1.5em; }
                    .ai-message li { margin:0.25em 0; }
                    .ai-message pre { background:rgba(0,0,0,0.4);padding:0;margin:10px 0;border-radius:6px;overflow:hidden; }
                    .ai-message .code-header { display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:rgba(0,0,0,0.3);border-bottom:1px solid var(--border); }
                    .ai-message .code-lang { font-size:0.7rem;color:var(--fg-muted);text-transform:uppercase; }
                    .ai-message .code-copy { padding:2px 8px;font-size:0.7rem;background:rgba(255,255,255,0.1);border:none;border-radius:4px;color:var(--fg-muted);cursor:pointer; }
                    .ai-message .code-copy:hover { background:rgba(255,255,255,0.2);color:var(--fg-primary); }
                    .ai-message .code-copy.copied { color:var(--accent); }
                    .ai-message pre code { display:block;padding:10px;overflow-x:auto;font-family:var(--font-mono);font-size:0.75rem;line-height:1.5;background:none; }
                    .ai-message :not(pre) > code { font-family:var(--font-mono);font-size:0.75rem;background:rgba(0,0,0,0.3);padding:2px 5px;border-radius:4px; }
                    .ai-message blockquote { margin:0.5em 0;padding:0.5em 1em;border-left:3px solid var(--accent);background:rgba(0,0,0,0.2);border-radius:0 4px 4px 0; }
                    .ai-message a { color:var(--accent);text-decoration:none; }
                    .ai-message a:hover { text-decoration:underline; }
                    .ai-message hr { border:none;border-top:1px solid var(--border);margin:1em 0; }
                    .ai-message table { border-collapse:collapse;width:100%;margin:0.5em 0; }
                    .ai-message th,.ai-message td { border:1px solid var(--border);padding:6px 10px;text-align:left; }
                    .ai-message th { background:rgba(0,0,0,0.2); }
                    .ai-typing { display:flex;gap:4px;padding:10px; }
                    .ai-typing span { width:6px;height:6px;background:var(--fg-muted);border-radius:50%;animation:typing 1s infinite; }
                    .ai-typing span:nth-child(2) { animation-delay:0.2s; }
                    .ai-typing span:nth-child(3) { animation-delay:0.4s; }
                    @keyframes typing { 0%,100%{opacity:0.3;} 50%{opacity:1;} }
                    .ai-input-area { padding:12px;border-top:1px solid var(--border);flex-shrink:0; }
                    .ai-input-area textarea { width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--fg-primary);font-size:0.8rem;resize:none;font-family:inherit;outline:none; }
                    .ai-input-area textarea:focus { border-color:#00a8ff; }
                    .ai-input-actions { display:flex;justify-content:space-between;align-items:center;margin-top:8px; }
                    .ai-input-actions button { padding:6px 12px;font-size:0.75rem; }
                    .ai-input-actions .send-btn { background:#00a8ff;color:var(--bg-primary); }
                    .ai-input-actions .send-btn:hover { background:#00bfff; }
                    .ai-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--fg-muted);text-align:center;padding:20px; }
                    .ai-empty svg { width:40px;height:40px;opacity:0.3;margin-bottom:12px; }
                    .CodeMirror { height:100% !important;font-family:'JetBrains Mono',monospace !important;font-size:13px !important; }
                    .CodeMirror-gutters { background:rgba(0,0,0,0.3) !important;border-right:1px solid var(--border) !important; }
                    .CodeMirror-gutter.git-diff-gutter { width:6px !important; min-width:6px !important; }
                    .git-diff-marker { display:block;width:4px;height:1.2em;border-radius:2px;margin:0 auto; }
                    .git-diff-marker.added { background:rgba(0,212,170,0.85); }
                    .git-diff-marker.removed { background:rgba(255,77,106,0.9); }
                    .cm-s-default { background:var(--bg-primary) !important;color:var(--fg-primary) !important; }
                </style>
                <div class="ide-container">
                    <div class="ide-sidebar">
                        <div class="ide-sidebar-header">
                            <button class="ide-sidebar-tab active" id="sidebar-tab-explorer-${windowId}" data-panel="explorer">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                                Explorer
                            </button>
                            <button class="ide-sidebar-tab" id="sidebar-tab-source-${windowId}" data-panel="source">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 3l9 9-9 9-9-9 9-9z"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
                                Source
                            </button>
                        </div>
                        <div class="ide-sidebar-panel active" id="sidebar-panel-explorer-${windowId}">
                            <div class="ide-file-tree" id="file-tree-${windowId}"></div>
                            <div style="padding:6px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:5px;">
                                <button class="btn btn-sm" id="new-file-${windowId}" style="width:100%;" aria-label="New file">+ New File</button>
                                <button class="btn btn-sm" id="new-app-${windowId}" style="width:100%;background:var(--accent);color:var(--bg-primary);" aria-label="New app">+ New App</button>
                            </div>
                        </div>
                        <div class="ide-sidebar-panel" id="sidebar-panel-source-${windowId}">
                            <div class="ide-source-control">
                                <div class="ide-source-repo" id="source-repo-${windowId}">No git repository detected</div>
                                <div class="ide-source-oauth">
                                    <div class="ide-source-oauth-status" id="source-oauth-status-${windowId}">GitHub OAuth: Not connected</div>
                                    <div class="ide-source-oauth-actions">
                                        <button id="source-oauth-connect-${windowId}" class="primary" aria-label="Connect GitHub OAuth">Connect GitHub</button>
                                        <button id="source-oauth-disconnect-${windowId}" aria-label="Disconnect GitHub OAuth">Disconnect</button>
                                    </div>
                                </div>
                                <div class="ide-source-clone">
                                    <input id="source-clone-url-${windowId}" type="text" placeholder="https://github.com/user/repo.git" />
                                    <input id="source-clone-target-${windowId}" type="text" placeholder="/home/user/Documents/repo" />
                                    <button id="source-clone-${windowId}" class="primary" aria-label="Clone repository">Clone Repository</button>
                                </div>
                                <div class="ide-source-actions">
                                    <button id="source-refresh-${windowId}" aria-label="Refresh source control">Refresh</button>
                                    <button id="source-init-${windowId}" aria-label="Initialize git repository">Init Repo</button>
                                    <button id="source-stage-all-${windowId}" aria-label="Stage all changes">Stage All</button>
                                </div>
                                <div class="ide-source-commit">
                                    <input id="source-commit-msg-${windowId}" type="text" placeholder="Commit message..." />
                                    <button id="source-commit-${windowId}" class="primary" aria-label="Commit changes">Commit</button>
                                </div>
                                <div class="ide-source-progress" id="source-progress-${windowId}"></div>
                                <div class="ide-source-list" id="source-list-${windowId}"></div>
                            </div>
                        </div>
                    </div>
                    <div class="ide-main">
                        <div class="ide-toolbar" id="ide-toolbar-${windowId}" style="display:none;">
                            <button id="save-file-${windowId}" title="Save (Ctrl+S)" aria-label="Save">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                                Save
                            </button>
                            <button id="collab-toggle-${windowId}" class="collab-btn" title="Collaborate on current file" aria-label="Collaborate">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M16 11c1.66 0 3-1.79 3-4s-1.34-4-3-4-3 1.79-3 4 1.34 4 3 4z"/><path d="M8 11c1.66 0 3-1.79 3-4S9.66 3 8 3 5 4.79 5 7s1.34 4 3 4z"/><path d="M8 13c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/><path d="M16 13c-.53 0-1.04.05-1.5.13 1.14.84 1.5 1.9 1.5 2.87v3h8v-2c0-2.66-5.33-4-8-4z"/></svg>
                                Collaborate
                            </button>
                            <div class="app-info" id="app-info-${windowId}"></div>
                            <button id="install-app-${windowId}" style="display:none;" aria-label="Install app">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Install
                            </button>
                            <button id="run-app-${windowId}" class="primary" style="display:none;" aria-label="Run code">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                Run
                            </button>
                            <button id="live-preview-${windowId}" style="display:none;" title="Live Preview" aria-label="Toggle preview">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                Preview
                            </button>
                            <button id="toggle-ai-${windowId}" class="ai-btn" title="AI Assistant" aria-label="Toggle AI assistant">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z"/></svg>
                                AI
                            </button>
                        </div>
                        <div class="ide-collab-panel" id="ide-collab-panel-${windowId}">
                            <div class="ide-collab-tabs">
                                <div class="ide-collab-tab active" data-ctab="start">Start Session</div>
                                <div class="ide-collab-tab" data-ctab="join">Join Session</div>
                            </div>
                            <div id="ide-collab-start-${windowId}">
                                <div style="font-size:0.74rem;color:var(--fg-muted);margin-bottom:6px;">Share this offer code with your collaborator:</div>
                                <textarea id="ide-collab-offer-${windowId}" class="ide-collab-code" readonly rows="3" placeholder="Click Generate to start..."></textarea>
                                <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
                                    <button class="btn btn-sm" id="ide-collab-generate-${windowId}">Generate Code</button>
                                    <button class="btn btn-sm" id="ide-collab-copy-offer-${windowId}" style="display:none;">Copy Code</button>
                                </div>
                                <div id="ide-collab-answer-area-${windowId}" style="display:none;margin-top:8px;">
                                    <div style="font-size:0.74rem;color:var(--fg-muted);margin-bottom:6px;">Paste collaborator answer:</div>
                                    <textarea id="ide-collab-answer-in-${windowId}" class="ide-collab-code" rows="3" placeholder="Paste answer code..."></textarea>
                                    <button class="btn btn-sm" id="ide-collab-complete-${windowId}" style="margin-top:6px;">Connect</button>
                                </div>
                            </div>
                            <div id="ide-collab-join-${windowId}" style="display:none;">
                                <div style="font-size:0.74rem;color:var(--fg-muted);margin-bottom:6px;">Paste offer code from initiator:</div>
                                <textarea id="ide-collab-offer-in-${windowId}" class="ide-collab-code" rows="3" placeholder="Paste offer code..."></textarea>
                                <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
                                    <button class="btn btn-sm" id="ide-collab-join-btn-${windowId}">Generate Answer</button>
                                    <button class="btn btn-sm" id="ide-collab-copy-answer-${windowId}" style="display:none;">Copy Answer</button>
                                </div>
                                <textarea id="ide-collab-answer-out-${windowId}" class="ide-collab-code" readonly rows="3" style="display:none;margin-top:8px;" placeholder="Answer code appears here..."></textarea>
                            </div>
                            <div id="ide-collab-status-${windowId}" class="ide-collab-status info"></div>
                            <div id="ide-collab-presence-${windowId}" class="ide-collab-presence"></div>
                        </div>
                        <div class="ide-tabs" id="ide-tabs-${windowId}"></div>
                        <div class="ide-content-area">
                            <div class="ide-editor-container" id="editor-container-${windowId}">
                                <div class="ide-welcome" id="ide-welcome-${windowId}">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                                    <h2>EphemeraCode Editor</h2>
                                    <p>Code editor with AI-powered assistance</p>
                                    <div class="quick-actions">
                                        <div class="row">
                                            <button class="btn" id="quick-new-${windowId}" aria-label="New file">New File</button>
                                            <button class="btn" id="quick-open-${windowId}" aria-label="Open file">Open</button>
                                        </div>
                                        <div class="row">
                                            <button class="btn primary" id="quick-app-${windowId}" aria-label="Create app">Create App</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="ai-panel" id="ai-panel-${windowId}">
                                <div class="ai-panel-header">
                                    <h3>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z"/></svg>
                                        AI Assistant
                                    </h3>
                                </div>
                                <div style="padding:8px 12px;border-bottom:1px solid var(--border);">
                                    <select class="ai-model-select" id="ai-model-${windowId}">
                                        <option value="">Loading models...</option>
                                    </select>
                                </div>
                                <div class="ai-chat" id="ai-chat-${windowId}">
                                    <div class="ai-empty">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                        <p>Ask me to help with your code!</p>
                                        <p style="font-size:0.7rem;margin-top:8px;">Configure API key in Settings</p>
                                    </div>
                                </div>
                                <div class="ai-input-area">
                                    <textarea id="ai-input-${windowId}" placeholder="Ask AI for help..." rows="3"></textarea>
                                    <div class="ai-input-actions">
                                        <button class="btn btn-sm" id="ai-code-${windowId}" title="Send current code">Send Code</button>
                                        <button class="btn btn-sm send-btn" id="ai-send-${windowId}">Send</button>
                                    </div>
                                </div>
                            </div>
                            <div class="preview-panel" id="preview-panel-${windowId}">
                                <div class="preview-panel-header">
                                    <h3>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        Live Preview
                                    </h3>
                                    <button id="preview-refresh-${windowId}">Refresh</button>
                                </div>
                                <iframe class="preview-frame" id="preview-frame-${windowId}" sandbox="allow-scripts allow-same-origin"></iframe>
                            </div>
                        </div>
                        <div class="ide-statusbar" id="ide-status-${windowId}">
                            <span id="ide-status-cursor-${windowId}">Ready - Ctrl+S to save</span>
                            <div class="ide-status-right">
                                <span id="ide-status-encoding-${windowId}">UTF-8</span>
                                <select class="ide-git-branch-select" id="git-branch-select-${windowId}" aria-label="Git branch">
                                    <option value="">No Repo</option>
                                </select>
                                <button class="ide-status-btn" id="git-pull-${windowId}" aria-label="Pull">Pull</button>
                                <button class="ide-status-btn" id="git-push-${windowId}" aria-label="Push">Push</button>
                                <span class="ide-status-progress" id="git-progress-${windowId}"></span>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            init: async () => {
                // Use app lifecycle for clean resource management
                const lifecycle = createAppLifecycle();
                if (!window.EphemeraGit && typeof window.EphemeraModuleLoader?.ensureGit === 'function') {
                    await window.EphemeraModuleLoader.ensureGit().catch(() => false);
                }
                if (!window.EphemeraCollab && typeof window.EphemeraModuleLoader?.ensureCollab === 'function') {
                    await window.EphemeraModuleLoader.ensureCollab().catch(() => false);
                }

                const fileTree = document.getElementById(`file-tree-${windowId}`);
                const tabsContainer = document.getElementById(`ide-tabs-${windowId}`);
                const editorContainer = document.getElementById(`editor-container-${windowId}`);
                const welcomeScreen = document.getElementById(`ide-welcome-${windowId}`);
                const statusCursorEl = document.getElementById(`ide-status-cursor-${windowId}`);
                const statusEncodingEl = document.getElementById(`ide-status-encoding-${windowId}`);
                const branchSelectEl = document.getElementById(`git-branch-select-${windowId}`);
                const pullBtn = document.getElementById(`git-pull-${windowId}`);
                const pushBtn = document.getElementById(`git-push-${windowId}`);
                const gitProgressEl = document.getElementById(`git-progress-${windowId}`);
                const toolbar = document.getElementById(`ide-toolbar-${windowId}`);
                const appInfo = document.getElementById(`app-info-${windowId}`);
                const installBtn = document.getElementById(`install-app-${windowId}`);
                const runBtn = document.getElementById(`run-app-${windowId}`);
                const saveBtn = document.getElementById(`save-file-${windowId}`);
                const sidebarTabExplorer = document.getElementById(`sidebar-tab-explorer-${windowId}`);
                const sidebarTabSource = document.getElementById(`sidebar-tab-source-${windowId}`);
                const sidebarExplorerPanel = document.getElementById(`sidebar-panel-explorer-${windowId}`);
                const sidebarSourcePanel = document.getElementById(`sidebar-panel-source-${windowId}`);
                const sourceRepoEl = document.getElementById(`source-repo-${windowId}`);
                const sourceOAuthStatusEl = document.getElementById(`source-oauth-status-${windowId}`);
                const sourceOAuthConnectBtn = document.getElementById(`source-oauth-connect-${windowId}`);
                const sourceOAuthDisconnectBtn = document.getElementById(`source-oauth-disconnect-${windowId}`);
                const sourceCloneUrlInput = document.getElementById(`source-clone-url-${windowId}`);
                const sourceCloneTargetInput = document.getElementById(`source-clone-target-${windowId}`);
                const sourceCloneBtn = document.getElementById(`source-clone-${windowId}`);
                const sourceRefreshBtn = document.getElementById(`source-refresh-${windowId}`);
                const sourceInitBtn = document.getElementById(`source-init-${windowId}`);
                const sourceStageAllBtn = document.getElementById(`source-stage-all-${windowId}`);
                const sourceCommitInput = document.getElementById(`source-commit-msg-${windowId}`);
                const sourceCommitBtn = document.getElementById(`source-commit-${windowId}`);
                const sourceProgressEl = document.getElementById(`source-progress-${windowId}`);
                const sourceListEl = document.getElementById(`source-list-${windowId}`);
                const collabToggleBtn = document.getElementById(`collab-toggle-${windowId}`);
                const collabPanel = document.getElementById(`ide-collab-panel-${windowId}`);
                const collabStatusEl = document.getElementById(`ide-collab-status-${windowId}`);
                const collabPresenceEl = document.getElementById(`ide-collab-presence-${windowId}`);
                const collabOfferEl = document.getElementById(`ide-collab-offer-${windowId}`);
                const collabGenerateBtn = document.getElementById(`ide-collab-generate-${windowId}`);
                const collabCopyOfferBtn = document.getElementById(`ide-collab-copy-offer-${windowId}`);
                const collabAnswerArea = document.getElementById(`ide-collab-answer-area-${windowId}`);
                const collabAnswerInEl = document.getElementById(`ide-collab-answer-in-${windowId}`);
                const collabCompleteBtn = document.getElementById(`ide-collab-complete-${windowId}`);
                const collabOfferInEl = document.getElementById(`ide-collab-offer-in-${windowId}`);
                const collabJoinBtn = document.getElementById(`ide-collab-join-btn-${windowId}`);
                const collabCopyAnswerBtn = document.getElementById(`ide-collab-copy-answer-${windowId}`);
                const collabAnswerOutEl = document.getElementById(`ide-collab-answer-out-${windowId}`);

                const openFiles = [];
                let activeFile = null;
                const editors = {};
                let currentAppDir = null;
                let autoSaveTimers = {};
                const originalContents = {};
                let collabSessionId = null;
                let collabBoundPath = null;
                let collabUnbind = null;
                let collabConnected = false;
                let unregisterAssistantContext = () => {};
                let gitRepoPath = null;
                let gitBranch = null;
                let gitBranches = [];
                let gitChanges = [];
                let gitChangeMap = new Map();
                const gitDiffMarkers = new Map();
                let gitRefreshTimer = null;
                let gitDiffTimer = null;
                
                function setWindowDirty(dirty) {
                    EphemeraWM.setDirty(windowId, dirty);
                }
                
                function checkWindowDirty() {
                    const dirty = openFiles.some(path => {
                        const editor = editors[path];
                        const original = originalContents[path];
                        return editor && original !== undefined && editor.getValue() !== original;
                    });
                    setWindowDirty(dirty);
                }

                function getActiveEditor() {
                    if (!activeFile) return null;
                    return editors[activeFile] || null;
                }

                function insertIntoActiveEditor(text) {
                    const payload = String(text || '');
                    if (!payload) return false;
                    const editor = getActiveEditor();
                    if (!editor) return false;
                    if (editor.somethingSelected()) {
                        editor.replaceSelection(payload);
                    } else {
                        editor.replaceRange(payload, editor.getCursor());
                    }
                    editor.focus();
                    return true;
                }

                function normalizeGitPath(path) {
                    if (!path) return '';
                    if (window.EphemeraFS?.normalizePath) {
                        return window.EphemeraFS.normalizePath(path);
                    }
                    return path;
                }

                function joinGitPath(base, child) {
                    const left = normalizeGitPath(base);
                    if (!child) return left;
                    if (String(child).startsWith('/')) return normalizeGitPath(child);
                    return normalizeGitPath(`${left}/${child}`);
                }

                function getRepoRelativePath(path) {
                    const normalizedPath = normalizeGitPath(path);
                    const normalizedRepo = normalizeGitPath(gitRepoPath);
                    if (!normalizedRepo) return null;
                    if (normalizedPath === normalizedRepo) return '';
                    if (!normalizedPath.startsWith(`${normalizedRepo}/`)) return null;
                    return normalizedPath.slice(normalizedRepo.length + 1);
                }

                function isPathInsideRepo(path) {
                    return getRepoRelativePath(path) !== null;
                }

                function setSidebarPanel(panel) {
                    const explorerActive = panel !== 'source';
                    sidebarTabExplorer?.classList.toggle('active', explorerActive);
                    sidebarTabSource?.classList.toggle('active', !explorerActive);
                    sidebarExplorerPanel?.classList.toggle('active', explorerActive);
                    sidebarSourcePanel?.classList.toggle('active', !explorerActive);
                }

                function setGitProgress(message, tone = 'info') {
                    const text = String(message || '');
                    if (gitProgressEl) {
                        gitProgressEl.textContent = text;
                    }
                    if (!sourceProgressEl) return;
                    sourceProgressEl.textContent = text;
                    sourceProgressEl.className = 'ide-source-progress';
                    if (text) {
                        sourceProgressEl.classList.add(tone);
                    }
                }

                function getGitStatusBadge(status) {
                    switch (status) {
                    case 'modified': return 'M';
                    case 'untracked': return 'U';
                    case 'added': return 'A';
                    case 'staged': return 'S';
                    case 'staged-and-modified': return 'SM';
                    case 'deleted': return 'D';
                    case 'deleted-staged': return 'DS';
                    case 'conflicted': return '!';
                    default: return '';
                    }
                }

                function setGitControlsEnabled(enabled) {
                    const isEnabled = Boolean(enabled);
                    if (pullBtn) pullBtn.disabled = !isEnabled;
                    if (pushBtn) pushBtn.disabled = !isEnabled;
                    if (branchSelectEl) branchSelectEl.disabled = !isEnabled;
                    if (sourceInitBtn) sourceInitBtn.disabled = false;
                    if (sourceRefreshBtn) sourceRefreshBtn.disabled = false;
                    if (sourceCloneBtn) sourceCloneBtn.disabled = false;
                    if (sourceCloneUrlInput) sourceCloneUrlInput.disabled = false;
                    if (sourceCloneTargetInput) sourceCloneTargetInput.disabled = false;
                    if (sourceStageAllBtn) sourceStageAllBtn.disabled = !isEnabled;
                    if (sourceCommitBtn) sourceCommitBtn.disabled = !isEnabled;
                    if (sourceCommitInput) sourceCommitInput.disabled = !isEnabled;
                }

                function inferCloneTarget(url) {
                    const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                    const baseProjectsDir = `${homeDir}/Documents`;
                    const raw = String(url || '').trim();
                    if (!raw) return '';

                    let repoName = '';
                    try {
                        const parsed = new URL(raw);
                        const segments = parsed.pathname.split('/').filter(Boolean);
                        repoName = segments.pop() || '';
                    } catch (_err) {
                        const segments = raw.split('/').filter(Boolean);
                        repoName = segments.pop() || '';
                    }

                    repoName = repoName.replace(/\.git$/i, '').replace(/[^a-zA-Z0-9._-]/g, '-');
                    if (!repoName) repoName = `repo-${Date.now()}`;
                    return `${baseProjectsDir}/${repoName}`;
                }

                function getGitHubOAuthStatus() {
                    return window.EphemeraOAuth?.getStatus?.()?.github || null;
                }

                function isGitAuthErrorMessage(message) {
                    const text = String(message || '').toLowerCase();
                    if (!text) return false;
                    return (
                        text.includes('auth') ||
                        text.includes('credential') ||
                        text.includes('permission denied') ||
                        text.includes('not authorized') ||
                        text.includes('unauthorized') ||
                        /\b40[13]\b/.test(text)
                    );
                }

                function refreshGitHubOAuthUi() {
                    if (!sourceOAuthStatusEl) return;

                    if (!window.EphemeraOAuth) {
                        sourceOAuthStatusEl.textContent = 'GitHub OAuth unavailable';
                        sourceOAuthStatusEl.className = 'ide-source-oauth-status err';
                        if (sourceOAuthConnectBtn) sourceOAuthConnectBtn.disabled = true;
                        if (sourceOAuthDisconnectBtn) sourceOAuthDisconnectBtn.disabled = true;
                        return;
                    }

                    const status = getGitHubOAuthStatus();
                    const connected = Boolean(status?.connected);
                    const pending = Boolean(status?.pending);
                    const hasClientId = Boolean(status?.clientIdConfigured);
                    const login = String(status?.user?.login || '').trim();
                    const error = String(status?.error || '').trim();

                    if (connected) {
                        sourceOAuthStatusEl.textContent = login
                            ? `GitHub OAuth: Connected as @${login}`
                            : 'GitHub OAuth: Connected';
                        sourceOAuthStatusEl.className = 'ide-source-oauth-status ok';
                    } else if (pending) {
                        sourceOAuthStatusEl.textContent = 'GitHub OAuth: Awaiting callback...';
                        sourceOAuthStatusEl.className = 'ide-source-oauth-status';
                    } else if (error) {
                        sourceOAuthStatusEl.textContent = `GitHub OAuth: ${error}`;
                        sourceOAuthStatusEl.className = 'ide-source-oauth-status err';
                    } else if (!hasClientId) {
                        sourceOAuthStatusEl.textContent = 'GitHub OAuth: Client ID not configured';
                        sourceOAuthStatusEl.className = 'ide-source-oauth-status';
                    } else {
                        sourceOAuthStatusEl.textContent = 'GitHub OAuth: Not connected';
                        sourceOAuthStatusEl.className = 'ide-source-oauth-status';
                    }

                    if (sourceOAuthConnectBtn) sourceOAuthConnectBtn.disabled = pending;
                    if (sourceOAuthDisconnectBtn) sourceOAuthDisconnectBtn.disabled = !connected;
                }

                async function ensureGitHubClientId() {
                    if (!window.EphemeraOAuth) return '';
                    let clientId = String(window.EphemeraOAuth.getGithubClientId?.() || '').trim();
                    if (clientId) return clientId;

                    const entered = await EphemeraDialog.prompt(
                        'Enter your GitHub OAuth App client ID. The app redirect URI must match this page URL.',
                        '',
                        'GitHub OAuth Client ID',
                        'Iv1.1234567890abcdef'
                    );
                    if (!entered) return '';

                    clientId = String(entered || '').trim();
                    if (!clientId) return '';
                    window.EphemeraOAuth.setGithubClientId?.(clientId);
                    return clientId;
                }

                async function hasExistingContent(path) {
                    const normalized = normalizeGitPath(path);
                    if (!normalized) return false;
                    const stat = await EphemeraFS.stat(normalized).catch(() => null);
                    if (!stat) return false;
                    if (stat.type === 'file') return true;
                    const entries = await EphemeraFS.readdir(normalized).catch(() => []);
                    return Array.isArray(entries) && entries.length > 0;
                }

                async function listTextFilesRecursive(rootDir, limit = 120) {
                    const out = [];
                    const stack = [rootDir];

                    while (stack.length > 0 && out.length < limit) {
                        const dir = stack.pop();
                        const items = await EphemeraFS.readdir(dir);
                        for (const item of items) {
                            if (item.type === 'directory') {
                                stack.push(item.path);
                                continue;
                            }
                            if (item.type === 'file' && EphemeraFS.isTextFile(item.path)) {
                                out.push(item.path);
                                if (out.length >= limit) break;
                            }
                        }
                    }

                    return out;
                }

                async function openInitialFileFromRepo(repoPath) {
                    const textFiles = await listTextFilesRecursive(repoPath, 160);
                    if (!textFiles.length) return false;

                    const preferredPatterns = [
                        /\/README(\.[^/]+)?$/i,
                        /\/package\.json$/i,
                        /\/app\.json$/i,
                        /\/index\.(js|ts|html|md)$/i,
                        /\/main\.(js|ts)$/i
                    ];

                    let selected = textFiles[0];
                    for (const pattern of preferredPatterns) {
                        const found = textFiles.find((file) => pattern.test(file));
                        if (found) {
                            selected = found;
                            break;
                        }
                    }

                    await openFile(selected);
                    setActiveFile(selected);
                    return true;
                }

                function populateBranchSelect() {
                    if (!branchSelectEl) return;
                    if (!gitRepoPath || !gitBranches.length) {
                        branchSelectEl.innerHTML = '<option value="">No Repo</option>';
                        return;
                    }

                    branchSelectEl.innerHTML = gitBranches.map((branch) => {
                        const selected = branch === gitBranch ? 'selected' : '';
                        return `<option value="${EphemeraSanitize.escapeAttr(branch)}" ${selected}>${EphemeraSanitize.escapeHtml(branch)}</option>`;
                    }).join('');
                }

                function renderSourceList() {
                    if (!sourceListEl) return;
                    const rows = gitChanges
                        .filter(change => change.status !== 'clean')
                        .sort((a, b) => a.filepath.localeCompare(b.filepath));

                    if (!gitRepoPath) {
                        sourceListEl.innerHTML = '<div class="ide-source-empty">Open a file inside a repository, or click Init Repo.</div>';
                        return;
                    }

                    if (rows.length === 0) {
                        sourceListEl.innerHTML = '<div class="ide-source-empty">Working tree clean.</div>';
                        return;
                    }

                    sourceListEl.innerHTML = rows.map((change) => {
                        const statusClass = change.status || 'modified';
                        const badge = getGitStatusBadge(change.status);
                        const actionLabel = change.staged ? 'Unstage' : 'Stage';
                        const action = change.staged ? 'unstage' : 'stage';
                        return `
                            <div class="ide-source-item">
                                <div class="ide-source-item-top">
                                    <span class="ide-source-path" title="${EphemeraSanitize.escapeAttr(change.filepath)}">${EphemeraSanitize.escapeHtml(change.filepath)}</span>
                                    <span class="ide-source-pill ${statusClass}">${EphemeraSanitize.escapeHtml(badge || statusClass)}</span>
                                </div>
                                <button data-action="${action}" data-file="${EphemeraSanitize.escapeAttr(change.filepath)}">${actionLabel}</button>
                            </div>
                        `;
                    }).join('');
                }

                function applyGitIndicatorsToFileTree() {
                    if (!fileTree) return;
                    fileTree.querySelectorAll('.git-indicator').forEach((el) => el.remove());

                    fileTree.querySelectorAll('.file-tree-item[data-path]:not(.file-tree-folder)').forEach((item) => {
                        const itemPath = normalizeGitPath(item.dataset.path || '');
                        const change = gitChangeMap.get(itemPath);
                        if (!change || !change.status || change.status === 'clean') return;

                        const badge = getGitStatusBadge(change.status);
                        if (!badge) return;

                        const indicator = document.createElement('span');
                        indicator.className = `git-indicator ${change.status}`;
                        indicator.textContent = badge;
                        indicator.title = change.status;
                        item.appendChild(indicator);
                    });
                }

                function clearDiffMarkersForPath(path) {
                    const cm = editors[path];
                    if (!cm) return;
                    const markers = gitDiffMarkers.get(path);
                    if (markers && markers.length) {
                        markers.forEach((line) => {
                            cm.setGutterMarker(line, 'git-diff-gutter', null);
                        });
                    }
                    gitDiffMarkers.delete(path);
                }

                function setDiffMarker(path, cm, lineIndex, type) {
                    if (!cm) return;
                    const lineCount = cm.lineCount();
                    if (lineCount <= 0) return;
                    const safeLine = Math.max(0, Math.min(lineCount - 1, lineIndex));
                    const marker = document.createElement('span');
                    marker.className = `git-diff-marker ${type}`;
                    marker.title = type === 'added' ? 'Added line' : 'Removed line';
                    cm.setGutterMarker(safeLine, 'git-diff-gutter', marker);

                    const existing = gitDiffMarkers.get(path) || [];
                    if (!existing.includes(safeLine)) {
                        existing.push(safeLine);
                        gitDiffMarkers.set(path, existing);
                    }
                }

                async function refreshDiffForActiveFile() {
                    if (!window.EphemeraGit || !activeFile || !editors[activeFile]) return;
                    clearDiffMarkersForPath(activeFile);
                    if (!gitRepoPath || !isPathInsideRepo(activeFile)) return;

                    const relativePath = getRepoRelativePath(activeFile);
                    if (!relativePath) return;

                    const diffRows = await window.EphemeraGit.diff(gitRepoPath, {
                        filepaths: [relativePath]
                    });
                    const row = Array.isArray(diffRows) && diffRows.length ? diffRows[0] : null;
                    if (!row || row.binary || !row.summary) return;

                    const cm = editors[activeFile];
                    const startLine = Math.max(0, Number(row.summary.lineStart || 1) - 1);
                    const addedLines = Math.max(0, Number(row.summary.addedLines || 0));
                    const removedLines = Math.max(0, Number(row.summary.removedLines || 0));

                    if (addedLines > 0) {
                        for (let i = 0; i < addedLines; i++) {
                            setDiffMarker(activeFile, cm, startLine + i, 'added');
                        }
                    }
                    if (removedLines > 0) {
                        const removalAnchor = addedLines > 0 ? startLine : Math.max(0, startLine - 1);
                        setDiffMarker(activeFile, cm, removalAnchor, 'removed');
                    }
                }

                function scheduleDiffRefresh(delay = 180) {
                    if (gitDiffTimer) clearTimeout(gitDiffTimer);
                    gitDiffTimer = setTimeout(() => {
                        refreshDiffForActiveFile().catch((err) => {
                            if (import.meta.env.DEV) {
                                console.warn('[CodeEditor] Failed to refresh git diff markers:', err);
                            }
                        });
                    }, delay);
                }

                async function detectRepoRoot(startPath) {
                    if (!window.EphemeraGit || !startPath) return null;
                    const normalizedStart = normalizeGitPath(startPath);
                    if (gitRepoPath && normalizedStart.startsWith(`${normalizeGitPath(gitRepoPath)}/`)) {
                        return gitRepoPath;
                    }

                    let current = normalizedStart;
                    const stat = await EphemeraFS.stat(current).catch(() => null);
                    if (stat?.type === 'file') {
                        current = EphemeraFS.getParentDir(current);
                    }

                    while (current && current !== '/') {
                        const info = await window.EphemeraGit.getRepoInfo(current);
                        if (info?.isRepo) {
                            return current;
                        }
                        current = EphemeraFS.getParentDir(current);
                    }
                    return null;
                }

                function updateGitUiState() {
                    const currentBranchLabel = gitBranch || 'detached';
                    if (sourceRepoEl) {
                        sourceRepoEl.textContent = gitRepoPath
                            ? `${gitRepoPath} [${currentBranchLabel}]`
                            : 'No git repository detected';
                    }
                    setGitControlsEnabled(Boolean(gitRepoPath));
                    populateBranchSelect();
                    renderSourceList();
                    applyGitIndicatorsToFileTree();
                    if (!gitRepoPath) {
                        setGitProgress('', 'info');
                    }
                }

                function rebuildGitChangeMap(repoPath, changes) {
                    gitChangeMap = new Map();
                    if (!repoPath) return;
                    (changes || []).forEach((change) => {
                        if (!change?.filepath || change.status === 'clean') return;
                        const absolutePath = joinGitPath(repoPath, change.filepath);
                        gitChangeMap.set(absolutePath, change);
                    });
                }

                async function refreshGitState(options = {}) {
                    if (!window.EphemeraGit) {
                        gitRepoPath = null;
                        gitBranch = null;
                        gitBranches = [];
                        gitChanges = [];
                        rebuildGitChangeMap(null, []);
                        updateGitUiState();
                        return;
                    }

                    const referencePath = options.path
                        || activeFile
                        || `${EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user'}/Documents`;
                    const shouldDetect = options.forceDetect
                        || !gitRepoPath
                        || !referencePath
                        || !isPathInsideRepo(referencePath);

                    if (shouldDetect) {
                        gitRepoPath = await detectRepoRoot(referencePath);
                    }

                    if (!gitRepoPath) {
                        gitBranch = null;
                        gitBranches = [];
                        gitChanges = [];
                        rebuildGitChangeMap(null, []);
                        updateGitUiState();
                        clearDiffMarkersForPath(activeFile);
                        return;
                    }

                    const info = await window.EphemeraGit.getRepoInfo(gitRepoPath);
                    if (!info?.isRepo) {
                        gitRepoPath = null;
                        gitBranch = null;
                        gitBranches = [];
                        gitChanges = [];
                        rebuildGitChangeMap(null, []);
                        updateGitUiState();
                        clearDiffMarkersForPath(activeFile);
                        return;
                    }

                    gitBranch = info.branch || null;
                    gitBranches = Array.isArray(info.branches) ? info.branches : [];
                    gitChanges = Array.isArray(info.status) ? info.status : [];
                    rebuildGitChangeMap(gitRepoPath, gitChanges);
                    updateGitUiState();
                    scheduleDiffRefresh(50);
                }

                function scheduleGitRefresh(delay = 250, options = {}) {
                    if (gitRefreshTimer) clearTimeout(gitRefreshTimer);
                    gitRefreshTimer = setTimeout(() => {
                        refreshGitState(options).catch((err) => {
                            console.error('[CodeEditor] Git refresh failed:', err);
                            setGitProgress(err?.message || 'Git refresh failed', 'err');
                        });
                    }, delay);
                }

                async function reloadUnmodifiedEditorsFromDisk() {
                    for (const path of openFiles) {
                        const editor = editors[path];
                        if (!editor) continue;

                        const current = editor.getValue();
                        const original = originalContents[path];
                        const isDirty = original !== undefined && current !== original;
                        if (isDirty) continue;

                        const diskValue = await EphemeraFS.readFile(path);
                        if (typeof diskValue === 'string' && diskValue !== current) {
                            editor.setValue(diskValue);
                            originalContents[path] = diskValue;
                            const tab = tabsContainer.querySelector(`[data-path="${path}"]`);
                            const modified = tab?.querySelector('.modified');
                            if (modified) modified.remove();
                        }
                    }
                }

                async function runGitAction(action, successMessage, errorPrefix = 'Git operation failed', options = {}) {
                    if (!window.EphemeraGit) {
                        setGitProgress('Git integration is unavailable.', 'err');
                        return false;
                    }
                    const requiresRepo = options.requiresRepo !== false;
                    if (requiresRepo && !gitRepoPath) {
                        setGitProgress('No repository selected.', 'err');
                        return false;
                    }
                    try {
                        await action();
                        if (successMessage) setGitProgress(successMessage, 'ok');
                        const refreshPath = options.refreshPath || activeFile || gitRepoPath;
                        const forceDetect = options.forceDetectAfterAction === true;
                        await refreshGitState({ path: refreshPath, forceDetect });
                        return true;
                    } catch (err) {
                        console.error('[CodeEditor] Git action failed:', err);
                        let detail = String(err?.message || 'Unknown error');
                        if (isGitAuthErrorMessage(detail)) {
                            const oauthStatus = getGitHubOAuthStatus();
                            if (!oauthStatus?.connected) {
                                detail += '. Connect GitHub in Source > OAuth and retry.';
                            }
                        }
                        setGitProgress(`${errorPrefix}: ${detail}`, 'err');
                        return false;
                    }
                }

                if (window.EphemeraAIAssistant?.registerContextProvider) {
                    unregisterAssistantContext = window.EphemeraAIAssistant.registerContextProvider(windowId, () => {
                        const editor = getActiveEditor();
                        return {
                            appId: 'code',
                            appName: 'Code Editor',
                            filePath: activeFile || '',
                            fileContent: editor ? editor.getValue() : '',
                            selectedText: editor ? editor.getSelection() : '',
                            insert: (text) => insertIntoActiveEditor(text)
                        };
                    });
                }

                const collabUser = {
                    name: EphemeraState?.user?.displayName || EphemeraState?.user?.name || EphemeraState?.user?.id || 'Collaborator'
                };

                function setCollabStatus(text, type = 'info') {
                    if (!collabStatusEl) return;
                    collabStatusEl.textContent = text;
                    collabStatusEl.className = `ide-collab-status ${type}`;
                    collabStatusEl.style.display = text ? 'block' : 'none';
                }

                function renderCollabPresence(presence = []) {
                    if (!collabPresenceEl) return;
                    if (!presence.length) {
                        collabPresenceEl.textContent = collabConnected
                            ? 'Connected. Waiting for collaborator cursor...'
                            : '';
                        return;
                    }
                    collabPresenceEl.textContent = presence
                        .map((peer) => {
                            const where = (peer.line && peer.col)
                                ? `Ln ${peer.line}, Col ${peer.col}`
                                : 'active';
                            return `${peer.name} (${where})`;
                        })
                        .join(' | ');
                }

                function resetCollabState() {
                    collabConnected = false;
                    collabToggleBtn?.classList.remove('connected');
                    renderCollabPresence([]);
                }

                function closeCollabSession() {
                    if (collabUnbind) {
                        collabUnbind();
                        collabUnbind = null;
                    }
                    if (collabSessionId) {
                        window.EphemeraCollab?.closeSession?.(collabSessionId);
                    }
                    collabSessionId = null;
                    collabBoundPath = null;
                    resetCollabState();
                }

                function bindCollabToPath(path) {
                    if (!collabSessionId || !path || !editors[path]) return;
                    if (collabUnbind) {
                        collabUnbind();
                        collabUnbind = null;
                    }
                    collabBoundPath = path;
                    collabUnbind = window.EphemeraCollab.bindCodeMirror(collabSessionId, editors[path], {
                        onPresence: renderCollabPresence
                    });
                }

                async function ensureCollabTargetFile() {
                    if (activeFile && editors[activeFile]) {
                        return activeFile;
                    }
                    const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                    const path = `${homeDir}/Documents/collab-${Date.now()}.txt`;
                    await EphemeraFS.writeFile(path, '');
                    await openFile(path);
                    setActiveFile(path);
                    return path;
                }

                // Folder-level caching for selective invalidation
                const folderCaches = new Map(); // path -> { html, timestamp }
                let fullTreeCache = null;
                let fullTreeCacheInvalid = true;

                // Listen for filesystem changes to selectively invalidate caches
                const fsChangedHandler = ({ path }) => {
                    // Invalidate full tree cache
                    fullTreeCacheInvalid = true;

                    // Selectively invalidate folder caches
                    for (const cachedPath of folderCaches.keys()) {
                        // Invalidate if the changed path is inside the cached folder,
                        // or if the cached folder is inside the changed path
                        if (path.startsWith(cachedPath) || cachedPath.startsWith(path)) {
                            folderCaches.delete(cachedPath);
                        }
                    }

                    if (gitRepoPath && path && path.startsWith(`${normalizeGitPath(gitRepoPath)}/`)) {
                        scheduleGitRefresh(220, { path, forceDetect: false });
                    }
                };
                lifecycle.addSubscription(EphemeraEvents.on('fs:changed', fsChangedHandler));

                async function loadFileTree(forceReload = false) {
                    // Use full cache if valid and not forcing reload
                    if (!fullTreeCacheInvalid && fullTreeCache && !forceReload) {
                        fileTree.innerHTML = fullTreeCache;
                        attachFileTreeHandlers();
                        return;
                    }

                    const files = await EphemeraFS.readdir(EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user');

                    let html = '';

                    async function renderFolder(path, name) {
                        // Check folder cache first
                        if (!forceReload && folderCaches.has(path)) {
                            return folderCaches.get(path);
                        }

                        const items = await EphemeraFS.readdir(path);
                        if (items.length === 0) {
                            const result = `
                                <div class="file-tree-item file-tree-folder" data-path="${path}" data-expanded="true">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                                    ${name}
                                </div>
                                <div class="file-tree-children">
                                    <div class="file-tree-item file-tree-empty" style="color:var(--fg-muted);font-style:italic;">(empty)</div>
                                </div>
                            `;
                            folderCaches.set(path, result);
                            return result;
                        }

                        let childrenHtml = '';
                        for (const item of items) {
                            if (item.type === 'directory') {
                                const subItems = await EphemeraFS.readdir(item.path);
                                childrenHtml += `
                                    <div class="file-tree-item file-tree-folder" data-path="${item.path}">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                                        ${item.name}
                                    </div>
                                    <div class="file-tree-children">
                                        ${subItems.map(sub => `
                                            <div class="file-tree-item" data-path="${sub.path}">
                                                ${EphemeraFS.getIcon(sub)}
                                                <span class="label">${sub.name}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                `;
                            } else {
                                childrenHtml += `
                                    <div class="file-tree-item" data-path="${item.path}">
                                        ${EphemeraFS.getIcon(item)}
                                        <span class="label">${item.name}</span>
                                    </div>
                                `;
                            }
                        }

                        const result = `
                            <div class="file-tree-item file-tree-folder" data-path="${path}" data-expanded="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                                ${name}
                            </div>
                            <div class="file-tree-children">${childrenHtml}</div>
                        `;

                        folderCaches.set(path, result);
                        return result;
                    }

                    const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                    const appsRoot = `${homeDir}/apps`;
                    const docsRoot = `${homeDir}/Documents`;
                    html += await renderFolder(appsRoot, 'My Apps');
                    html += await renderFolder(docsRoot, 'Documents');

                    const normalizedRepo = normalizeGitPath(gitRepoPath);
                    const showRepoRoot = normalizedRepo
                        && normalizedRepo !== normalizeGitPath(appsRoot)
                        && normalizedRepo !== normalizeGitPath(docsRoot)
                        && !normalizedRepo.startsWith(`${normalizeGitPath(appsRoot)}/`)
                        && !normalizedRepo.startsWith(`${normalizeGitPath(docsRoot)}/`)
                        && await EphemeraFS.exists(normalizedRepo);
                    if (showRepoRoot) {
                        html += await renderFolder(normalizedRepo, `Repository (${EphemeraFS.getBasename(normalizedRepo)})`);
                    }

                    files.filter(f => f.type === 'file').forEach(f => {
                        html += `
                            <div class="file-tree-item" data-path="${f.path}">
                                ${EphemeraFS.getIcon(f)}
                                <span class="label">${f.name}</span>
                            </div>
                        `;
                    });

                    fullTreeCache = html;
                    fullTreeCacheInvalid = false;
                    fileTree.innerHTML = html;
                    attachFileTreeHandlers();
                    applyGitIndicatorsToFileTree();
                }

                function attachFileTreeHandlers() {
                    fileTree.querySelectorAll('.file-tree-item[data-path]:not(.file-tree-folder)').forEach(item => {
                        item.addEventListener('click', async () => {
                            try {
                                await openFile(item.dataset.path);
                            } catch (err) {
                                console.error('[Code] Failed to open file from explorer:', err);
                                if (window.EphemeraTelemetry?.captureException) {
                                    window.EphemeraTelemetry.captureException(err, {
                                        tags: { app: 'code', feature: 'explorer', action: 'openFile' }
                                    });
                                }
                            }
                        });
                    });

                    fileTree.querySelectorAll('.file-tree-folder').forEach(folder => {
                        folder.addEventListener('click', () => {
                            const children = folder.nextElementSibling;
                            if (children && children.classList.contains('file-tree-children')) {
                                children.style.display = children.style.display === 'none' ? 'block' : 'none';
                            }
                        });
                    });
                }
                
                async function openFile(path) {
                    if (!path || typeof path !== 'string') return;
                    if (openFiles.includes(path)) {
                        setActiveFile(path);
                        return;
                    }

                    let content = null;
                    try {
                        content = await EphemeraFS.readFile(path);
                    } catch (err) {
                        // Explorer can contain directories; ignore "open as file" attempts.
                        if (String(err?.message || err) === 'Is a directory') return;
                        throw err;
                    }
                    if (content === null) return;

                    const autoKey = 'autosave:code:' + path;
                    const saved = await EphemeraStorage.get('metadata', autoKey);
                    if (saved && saved.content && saved.timestamp) {
                        const stat = await EphemeraFS.stat(path);
                        if (stat && saved.timestamp > (stat.modifiedAt || 0)) {
                            if (await EphemeraDialog.confirm('A more recent auto-saved version exists. Restore it?', 'Restore Auto-Save')) {
                                content = saved.content;
                            }
                        }
                    }

                    openFiles.push(path);
                    originalContents[path] = content;
                    createTab(path);
                    createEditor(path, content);
                    setActiveFile(path);
                }
                
                function createTab(path) {
                    const name = EphemeraFS.getBasename(path);
                    const tab = document.createElement('div');
                    tab.className = 'ide-tab';
                    tab.dataset.path = path;
                    tab.innerHTML = `<span>${name}</span><span class="close">×</span>`;
                    
                    tab.addEventListener('click', (e) => {
                        if (e.target.classList.contains('close')) {
                            closeFile(path);
                        } else {
                            setActiveFile(path);
                        }
                    });
                    
                    tabsContainer.appendChild(tab);
                }
                
                function createEditor(path, content) {
                    const editor = document.createElement('div');
                    editor.className = 'ide-editor';
                    editor.dataset.path = path;
                    editor.innerHTML = `<textarea id="cm-${windowId}-${openFiles.indexOf(path)}">${content}</textarea>`;
                    editorContainer.appendChild(editor);
                    
                    const engine = window.EphemeraEditorEngine;
                    if (!engine?.createEditor) {
                        throw new Error('Editor engine is unavailable');
                    }
                    const ext = EphemeraFS.getExtension(path);
                    const mode = engine.resolveModeForPath
                        ? engine.resolveModeForPath(path)
                        : 'text';

                    const cm = engine.createEditor(editor.querySelector('textarea'), {
                        mode,
                        gutters: ['CodeMirror-linenumbers', 'git-diff-gutter']
                    });
                    
                    editors[path] = cm;
                    
                    cm.on('change', () => {
                        const tab = tabsContainer.querySelector(`[data-path="${path}"]`);
                        if (tab && !tab.querySelector('.modified')) {
                            const span = tab.querySelector('span');
                            span.insertAdjacentHTML('afterend', '<span class="modified" style="color:var(--warning);margin-left:4px;">●</span>');
                        }
                        updateAppInfo();
                        checkWindowDirty();
                        if (autoSaveTimers[path]) clearTimeout(autoSaveTimers[path]);
                        autoSaveTimers[path] = setTimeout(async () => {
                            const key = 'autosave:code:' + path;
                            await EphemeraStorage.put('metadata', { key, content: cm.getValue(), timestamp: Date.now() });
                        }, 2000);
                        if (gitRepoPath && isPathInsideRepo(path)) {
                            scheduleGitRefresh(250, { path, forceDetect: false });
                            if (path === activeFile) {
                                scheduleDiffRefresh(180);
                            }
                        }
                        if (previewPanel.classList.contains('open') && path === activeFile) {
                            if (previewUpdateTimer) clearTimeout(previewUpdateTimer);
                            previewUpdateTimer = setTimeout(updatePreview, 500);
                        }
                    });
                    
                    cm.on('cursorActivity', () => {
                        const cursor = cm.getCursor();
                        if (statusCursorEl) {
                            statusCursorEl.textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
                        }
                        if (statusEncodingEl) {
                            statusEncodingEl.textContent = ext.toUpperCase() || 'Plain Text';
                        }
                    });
                }
                
                function setActiveFile(path) {
                    activeFile = path;
                    
                    tabsContainer.querySelectorAll('.ide-tab').forEach(tab => {
                        tab.classList.toggle('active', tab.dataset.path === path);
                    });
                    
                    editorContainer.querySelectorAll('.ide-editor').forEach(editor => {
                        editor.classList.toggle('active', editor.dataset.path === path);
                    });

                    fileTree.querySelectorAll('.file-tree-item').forEach(item => {
                        item.classList.toggle('active', item.dataset.path === path);
                    });
                    
                    welcomeScreen.style.display = path ? 'none' : 'flex';
                    toolbar.style.display = path ? 'flex' : 'none';
                    
                    if (editors[path]) {
                        editors[path].refresh();
                        editors[path].focus();
                        const cursor = editors[path].getCursor();
                        if (statusCursorEl) statusCursorEl.textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
                        if (statusEncodingEl) {
                            const ext = EphemeraFS.getExtension(path);
                            statusEncodingEl.textContent = ext ? ext.toUpperCase() : 'Plain Text';
                        }
                    } else {
                        if (statusCursorEl) statusCursorEl.textContent = 'Ready - Ctrl+S to save';
                        if (statusEncodingEl) statusEncodingEl.textContent = 'UTF-8';
                    }
                    
                    updateAppInfo();
                    scheduleGitRefresh(120, { path, forceDetect: false });
                    scheduleDiffRefresh(90);

                    if (collabSessionId && collabBoundPath && path === collabBoundPath) {
                        bindCollabToPath(path);
                    } else if (collabSessionId && collabBoundPath && path !== collabBoundPath) {
                        setCollabStatus(`Collaboration is active on ${EphemeraFS.getBasename(collabBoundPath)}.`, 'info');
                    }
                }
                
                function updateAppInfo() {
                    if (!activeFile) {
                        currentAppDir = null;
                        installBtn.style.display = 'none';
                        runBtn.style.display = 'none';
                        previewToggle.style.display = 'none';
                        appInfo.innerHTML = '';
                        return;
                    }
                    
                    previewToggle.style.display = isPreviewableFile(activeFile) ? 'flex' : 'none';
                    
                    const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                    const appRoot = `${homeDir}/apps/`;
                    if (activeFile.startsWith(appRoot)) {
                        const remainder = activeFile.slice(appRoot.length);
                        const appDirName = remainder.split('/')[0] || '';
                        currentAppDir = appDirName ? `${appRoot}${appDirName}` : null;
                    } else {
                        currentAppDir = null;
                    }
                    
                    if (currentAppDir) {
                        const appName = EphemeraFS.getBasename(currentAppDir);
                        const isInstalled = EphemeraApps.get(`com.user.${appName}`) !== undefined;
                        
                        appInfo.innerHTML = `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                            App: <strong>${appName}</strong>
                            <span class="badge ${isInstalled ? 'installed' : 'not-installed'}">${isInstalled ? 'Installed' : 'Not Installed'}</span>
                        `;
                        
                        installBtn.style.display = 'flex';
                        installBtn.textContent = isInstalled ? 'Reinstall' : 'Install';
                        runBtn.style.display = 'flex';
                        runBtn.innerHTML = isInstalled 
                            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run'
                            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polygon points="5 3 19 12 5 21 5 3"/></svg> Preview';
                    } else {
                        appInfo.innerHTML = `<span>${activeFile}</span>`;
                        installBtn.style.display = 'none';
                        runBtn.style.display = 'none';
                    }
                }
                
                function closeFile(path) {
                    if (collabSessionId && collabBoundPath === path) {
                        closeCollabSession();
                        setCollabStatus('Collaboration closed because its file tab was closed.', 'err');
                    }

                    const idx = openFiles.indexOf(path);
                    if (idx > -1) openFiles.splice(idx, 1);
                    
                    const tab = tabsContainer.querySelector(`[data-path="${path}"]`);
                    if (tab) tab.remove();
                    
                    const editor = editorContainer.querySelector(`[data-path="${path}"]`);
                    if (editor) editor.remove();
                    
                    clearDiffMarkersForPath(path);
                    delete editors[path];
                    
                    if (activeFile === path) {
                        if (openFiles.length > 0) {
                            setActiveFile(openFiles[openFiles.length - 1]);
                        } else {
                            activeFile = null;
                            welcomeScreen.style.display = 'flex';
                            toolbar.style.display = 'none';
                        }
                    }
                }
                
                async function saveFile() {
                    if (!activeFile || !editors[activeFile]) return false;
                    
                    const content = editors[activeFile].getValue();
                    await EphemeraFS.writeFile(activeFile, content);
                    originalContents[activeFile] = content;
                    
                    const tab = tabsContainer.querySelector(`[data-path="${activeFile}"]`);
                    if (tab) {
                        const modified = tab.querySelector('.modified');
                        if (modified) modified.remove();
                    }
                    
                    checkWindowDirty();
                    EphemeraNotifications.success('Saved', `${EphemeraFS.getBasename(activeFile)} saved.`);
                    EphemeraStorage.delete('metadata', 'autosave:code:' + activeFile).catch(() => {});
                    updateAppInfo();
                    scheduleGitRefresh(120, { path: activeFile, forceDetect: false });
                    scheduleDiffRefresh(120);
                    return true;
                }
                
                async function createNewFile() {
                    const name = await EphemeraDialog.prompt('Enter a name for the new file:', '', 'New File', 'e.g., script.js');
                    if (!name) return;
                    
                    const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                    const path = `${homeDir}/Documents/${name}`;
                    await EphemeraFS.writeFile(path, '');
                    await openFile(path);
                    await loadFileTree();
                    scheduleGitRefresh(120, { path, forceDetect: true });
                }
                
                async function createAppScaffold() {
                    const name = await EphemeraDialog.prompt('Enter a name for your app:', '', 'Create App', 'e.g., My Calculator');
                    if (!name || !name.trim()) return;
                    
                    const appDirName = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                    if (!appDirName) {
                        EphemeraDialog.error('App name must contain letters or numbers.', 'Invalid Name');
                        return;
                    }
                    
                    const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                    const appDir = `${homeDir}/apps/${appDirName}`;
                    
                    if (await EphemeraFS.exists(appDir)) {
                        EphemeraDialog.warning(`App "${appDirName}" already exists. Opening it.`, 'App Exists');
                        await openFile(`${appDir}/app.json`);
                        await openFile(`${appDir}/app.js`);
                        scheduleGitRefresh(120, { path: `${appDir}/app.js`, forceDetect: true });
                        return;
                    }
                    
                    const manifest = EphemeraApps.createManifestTemplate();
                    manifest.id = `com.user.${appDirName}`;
                    manifest.name = name.trim();
                    manifest.description = `A custom app called ${name.trim()}`;
                    
                    await EphemeraFS.mkdir(appDir);
                    await EphemeraFS.writeFile(`${appDir}/app.json`, JSON.stringify(manifest, null, 2));
                    await EphemeraFS.writeFile(`${appDir}/app.js`, EphemeraApps.createCodeTemplate());
                    
                    await loadFileTree();
                    
                    await openFile(`${appDir}/app.json`);
                    await openFile(`${appDir}/app.js`);
                    scheduleGitRefresh(120, { path: `${appDir}/app.js`, forceDetect: true });
                    
                    EphemeraNotifications.success('App Created!', `Edit app.json and app.js, then click Install.`);
                }
                
                async function installApp() {
                    if (!currentAppDir) return;
                    
                    const manifestPath = `${currentAppDir}/app.json`;
                    const codePath = `${currentAppDir}/app.js`;
                    
                    const manifestJson = await EphemeraFS.readFile(manifestPath);
                    const code = await EphemeraFS.readFile(codePath);
                    
                    if (!manifestJson) {
                        EphemeraNotifications.error('Error', 'app.json not found. Save it first.');
                        return;
                    }
                    if (!code) {
                        EphemeraNotifications.error('Error', 'app.js not found. Save it first.');
                        return;
                    }
                    
                    try {
                        const manifest = JSON.parse(manifestJson);
                        
                        if (!manifest.id || !manifest.name) {
                            throw new Error('app.json must have "id" and "name" fields');
                        }
                        
                        await EphemeraApps.installApp(manifest, code);
                        
                        EphemeraNotifications.success('Installed!', `${manifest.name} is ready to run.`, {
                            actions: [{ label: 'Run Now', onClick: () => EphemeraWM.open(manifest.id), primary: true }]
                        });
                        
                        updateAppInfo();
                    } catch (e) {
                        EphemeraNotifications.error('Install Failed', e.message);
                    }
                }
                
                async function runApp() {
                    if (!currentAppDir) return;
                    const appName = EphemeraFS.getBasename(currentAppDir);
                    const appId = `com.user.${appName}`;
                    const app = EphemeraApps.get(appId);
                    
                    if (app) {
                        EphemeraWM.open(appId);
                    } else {
                        await runPreview();
                    }
                }
                
                async function runPreview() {
                    if (!currentAppDir) return;
                    
                    const manifestPath = `${currentAppDir}/app.json`;
                    const codePath = `${currentAppDir}/app.js`;
                    
                    const manifestJson = await EphemeraFS.readFile(manifestPath);
                    const code = await EphemeraFS.readFile(codePath);
                    
                    if (!manifestJson) {
                        EphemeraNotifications.error('Error', 'app.json not found. Create it first.');
                        return;
                    }
                    if (!code) {
                        EphemeraNotifications.error('Error', 'app.js not found. Create it first.');
                        return;
                    }
                    
                    try {
                        const manifest = JSON.parse(manifestJson);
                        
                        if (!manifest.id || !manifest.name) {
                            throw new Error('app.json must have "id" and "name" fields');
                        }
                        
                        const previewApp = {
                            id: `dev.preview.${Date.now()}`,
                            name: `${manifest.name} (Preview)`,
                            icon: manifest.icon || EphemeraApps.getDefaultIcon(),
                            width: manifest.window?.width || 600,
                            height: manifest.window?.height || 400,
                            singleton: false,
                            category: 'user',
                            description: manifest.description || 'Preview mode',
                            permissions: manifest.permissions || [],
                            isUserApp: true,
                            isPreview: true,
                            code: code,
                            lazyLoaded: true
                        };

                        previewApp.onClose = (closingWindowId) => {
                            EphemeraApps.removeEphemeralApp(previewApp.id, {
                                closingWindowId,
                                emitEvent: false
                            });
                        };
                        
                        previewApp.content = (windowId, _options) => {
                            return {
                                html: `<div class="user-app-container" id="user-app-${windowId}" style="width:100%;height:100%;overflow:auto;"></div>`,
                                init: () => {
                                    const container = document.getElementById(`user-app-${windowId}`);
                                    if (container && code) {
                                        EphemeraApps.runUserApp(container, code, windowId, manifest);
                                    }
                                }
                            };
                        };
                        
                        EphemeraApps.register(previewApp);
                        EphemeraWM.open(previewApp.id);
                        
                        EphemeraNotifications.info('Preview Mode', 'Running app in preview. Install for persistence.', { timeout: 3000 });
                        
                    } catch (e) {
                        EphemeraNotifications.error('Preview Failed', e.message);
                    }
                }
                
                lifecycle.addListener(document.getElementById(`new-file-${windowId}`), 'click', createNewFile);
                lifecycle.addListener(document.getElementById(`new-app-${windowId}`), 'click', createAppScaffold);
                lifecycle.addListener(document.getElementById(`quick-new-${windowId}`), 'click', createNewFile);
                lifecycle.addListener(document.getElementById(`quick-open-${windowId}`), 'click', () => EphemeraWM.open('files', { mode: 'open', onFileSelect: openFile, modal: true, parentWindowId: windowId }));
                lifecycle.addListener(document.getElementById(`quick-app-${windowId}`), 'click', createAppScaffold);
                lifecycle.addListener(saveBtn, 'click', saveFile);
                lifecycle.addListener(installBtn, 'click', installApp);
                lifecycle.addListener(runBtn, 'click', runApp);

                setSidebarPanel('explorer');
                lifecycle.addListener(sidebarTabExplorer, 'click', () => setSidebarPanel('explorer'));
                lifecycle.addListener(sidebarTabSource, 'click', () => setSidebarPanel('source'));

                if (sourceCloneTargetInput && !sourceCloneTargetInput.value.trim()) {
                    const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                    sourceCloneTargetInput.value = `${homeDir}/Documents/repo`;
                }

                if (sourceCloneUrlInput && sourceCloneTargetInput) {
                    lifecycle.addListener(sourceCloneUrlInput, 'input', () => {
                        const url = String(sourceCloneUrlInput.value || '').trim();
                        if (!url) return;
                        const inferred = inferCloneTarget(url);
                        if (!sourceCloneTargetInput.value.trim()) {
                            sourceCloneTargetInput.value = inferred;
                        }
                    });
                }

                refreshGitHubOAuthUi();
                lifecycle.addSubscription(
                    EphemeraEvents.on('oauth:updated', () => {
                        refreshGitHubOAuthUi();
                    })
                );

                lifecycle.addListener(sourceOAuthConnectBtn, 'click', async () => {
                    if (!window.EphemeraOAuth) {
                        setGitProgress('GitHub OAuth is unavailable.', 'err');
                        return;
                    }
                    try {
                        const clientId = await ensureGitHubClientId();
                        if (!clientId) {
                            setGitProgress('GitHub OAuth client ID is required to connect.', 'err');
                            return;
                        }

                        setGitProgress('Redirecting to GitHub OAuth...', 'info');
                        await window.EphemeraOAuth.connectGitHub({
                            clientId,
                            scopes: ['repo', 'read:user']
                        });
                    } catch (err) {
                        setGitProgress(`GitHub OAuth failed: ${err?.message || 'Unknown error'}`, 'err');
                    } finally {
                        refreshGitHubOAuthUi();
                    }
                });

                lifecycle.addListener(sourceOAuthDisconnectBtn, 'click', async () => {
                    if (!window.EphemeraOAuth) return;
                    const confirmed = await EphemeraDialog.confirm(
                        'Disconnect GitHub OAuth for Git operations in this browser profile?',
                        'Disconnect GitHub'
                    );
                    if (!confirmed) return;

                    await window.EphemeraOAuth.disconnectGitHub();
                    setGitProgress('Disconnected GitHub OAuth.', 'ok');
                    refreshGitHubOAuthUi();
                });

                lifecycle.addListener(sourceCloneBtn, 'click', async () => {
                    const url = String(sourceCloneUrlInput?.value || '').trim();
                    let targetPath = String(sourceCloneTargetInput?.value || '').trim();

                    if (!url) {
                        setGitProgress('Clone URL is required.', 'err');
                        return;
                    }
                    if (!/^https?:\/\//i.test(url)) {
                        setGitProgress('Clone URL must start with http:// or https://', 'err');
                        return;
                    }
                    if (!targetPath) {
                        targetPath = inferCloneTarget(url);
                        if (sourceCloneTargetInput) sourceCloneTargetInput.value = targetPath;
                    }
                    targetPath = normalizeGitPath(targetPath);
                    if (sourceCloneTargetInput) sourceCloneTargetInput.value = targetPath;

                    const occupied = await hasExistingContent(targetPath);
                    if (occupied) {
                        const confirmed = await EphemeraDialog.confirm(
                            `The destination "${targetPath}" already contains files. Replace it with the cloned repository?`,
                            'Overwrite Destination'
                        );
                        if (!confirmed) return;
                    }

                    const cloned = await runGitAction(
                        async () => {
                            setGitProgress('Cloning repository...', 'info');
                            await window.EphemeraGit.clone(url, targetPath, {
                                onProgress: (progress) => {
                                    const loaded = Number(progress?.loaded || 0);
                                    const total = Number(progress?.total || 0);
                                    const phase = progress?.phase ? `${progress.phase}` : 'clone';
                                    const suffix = total > 0 ? ` ${loaded}/${total}` : '';
                                    setGitProgress(`Cloning: ${phase}${suffix}`, 'info');
                                }
                            });

                            gitRepoPath = normalizeGitPath(targetPath);
                            await loadFileTree(true);
                            await openInitialFileFromRepo(gitRepoPath);
                            setSidebarPanel('explorer');
                        },
                        `Cloned ${url}`,
                        'Clone failed',
                        {
                            requiresRepo: false,
                            refreshPath: targetPath,
                            forceDetectAfterAction: true
                        }
                    );

                    if (cloned) {
                        EphemeraNotifications?.success?.('Repository Cloned', `Cloned into ${targetPath}`);
                    }
                });

                lifecycle.addListener(sourceRefreshBtn, 'click', () => {
                    refreshGitState({ path: activeFile || gitRepoPath, forceDetect: true }).catch((err) => {
                        console.error('[CodeEditor] Git refresh failed:', err);
                        setGitProgress(err?.message || 'Failed to refresh source control', 'err');
                    });
                });

                lifecycle.addListener(sourceInitBtn, 'click', async () => {
                    const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                    const targetDir = currentAppDir
                        || (activeFile ? EphemeraFS.getParentDir(activeFile) : `${homeDir}/Documents`);

                    await runGitAction(
                        async () => {
                            await window.EphemeraGit.initRepo(targetDir);
                            gitRepoPath = targetDir;
                            await loadFileTree(true);
                        },
                        `Initialized repository at ${targetDir}`,
                        'Failed to initialize repository',
                        { requiresRepo: false }
                    );
                });

                lifecycle.addListener(sourceStageAllBtn, 'click', async () => {
                    await runGitAction(
                        async () => {
                            await window.EphemeraGit.stageAll(gitRepoPath);
                        },
                        'Staged all changes',
                        'Failed to stage changes'
                    );
                });

                lifecycle.addListener(sourceCommitBtn, 'click', async () => {
                    const message = String(sourceCommitInput?.value || '').trim();
                    if (!message) {
                        setGitProgress('Commit message is required.', 'err');
                        return;
                    }

                    const committed = await runGitAction(
                        async () => {
                            await window.EphemeraGit.commit(gitRepoPath, message);
                        },
                        'Commit created',
                        'Failed to commit'
                    );
                    if (committed && sourceCommitInput) {
                        sourceCommitInput.value = '';
                    }
                });

                lifecycle.addListener(sourceListEl, 'click', async (e) => {
                    const button = e.target.closest('button[data-file]');
                    if (!button) return;
                    const relativePath = String(button.dataset.file || '').trim();
                    const action = String(button.dataset.action || '').trim();
                    if (!relativePath || !action) return;

                    if (action === 'stage') {
                        const change = gitChanges.find((row) => row.filepath === relativePath);
                        await runGitAction(
                            async () => {
                                if (change?.deleted) {
                                    await window.EphemeraGit.stageAll(gitRepoPath);
                                } else {
                                    await window.EphemeraGit.stageFile(gitRepoPath, relativePath);
                                }
                            },
                            `Staged ${relativePath}`,
                            'Failed to stage file'
                        );
                        return;
                    }

                    if (action === 'unstage') {
                        await runGitAction(
                            async () => {
                                await window.EphemeraGit.unstageFile(gitRepoPath, relativePath);
                            },
                            `Unstaged ${relativePath}`,
                            'Failed to unstage file'
                        );
                    }
                });

                lifecycle.addListener(branchSelectEl, 'change', async () => {
                    const branch = String(branchSelectEl?.value || '').trim();
                    if (!branch || !gitRepoPath || branch === gitBranch) return;

                    const switched = await runGitAction(
                        async () => {
                            await window.EphemeraGit.checkout(gitRepoPath, branch);
                            await loadFileTree(true);
                            await reloadUnmodifiedEditorsFromDisk();
                        },
                        `Checked out ${branch}`,
                        'Failed to switch branch'
                    );
                    if (!switched) {
                        populateBranchSelect();
                    }
                });

                lifecycle.addListener(pullBtn, 'click', async () => {
                    await runGitAction(
                        async () => {
                            setGitProgress('Pulling...', 'info');
                            await window.EphemeraGit.pull(gitRepoPath, {
                                onProgress: (progress) => {
                                    const loaded = Number(progress?.loaded || 0);
                                    const total = Number(progress?.total || 0);
                                    const phase = progress?.phase ? `${progress.phase}` : 'sync';
                                    const suffix = total > 0 ? ` ${loaded}/${total}` : '';
                                    setGitProgress(`Pulling: ${phase}${suffix}`, 'info');
                                }
                            });
                            await loadFileTree(true);
                            await reloadUnmodifiedEditorsFromDisk();
                        },
                        'Pull completed',
                        'Failed to pull'
                    );
                });

                lifecycle.addListener(pushBtn, 'click', async () => {
                    await runGitAction(
                        async () => {
                            setGitProgress('Pushing...', 'info');
                            await window.EphemeraGit.push(gitRepoPath, {
                                onProgress: (progress) => {
                                    const loaded = Number(progress?.loaded || 0);
                                    const total = Number(progress?.total || 0);
                                    const phase = progress?.phase ? `${progress.phase}` : 'upload';
                                    const suffix = total > 0 ? ` ${loaded}/${total}` : '';
                                    setGitProgress(`Pushing: ${phase}${suffix}`, 'info');
                                }
                            });
                        },
                        'Push completed',
                        'Failed to push'
                    );
                });

                const copyCollabText = (text, button) => {
                    if (!text) return;
                    navigator.clipboard.writeText(text).then(() => {
                        const original = button.textContent;
                        button.textContent = 'Copied!';
                        setTimeout(() => { button.textContent = original; }, 1200);
                    }).catch(() => {});
                };

                if (collabToggleBtn && collabPanel) {
                    collabToggleBtn.addEventListener('click', () => {
                        collabPanel.classList.toggle('visible');
                    });
                }

                collabPanel?.querySelectorAll('.ide-collab-tab').forEach((tab) => {
                    tab.addEventListener('click', () => {
                        collabPanel.querySelectorAll('.ide-collab-tab').forEach((item) => item.classList.remove('active'));
                        tab.classList.add('active');
                        const which = tab.dataset.ctab;
                        const startEl = document.getElementById(`ide-collab-start-${windowId}`);
                        const joinEl = document.getElementById(`ide-collab-join-${windowId}`);
                        if (startEl) startEl.style.display = which === 'start' ? '' : 'none';
                        if (joinEl) joinEl.style.display = which === 'join' ? '' : 'none';
                    });
                });

                lifecycle.addSubscription(
                    EphemeraEvents.on('p2p:connected', ({ sessionId }) => {
                        if (sessionId !== collabSessionId) return;
                        collabConnected = true;
                        collabToggleBtn?.classList.add('connected');
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
                        collabBoundPath = null;
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

                if (collabCopyOfferBtn && collabOfferEl) {
                    collabCopyOfferBtn.addEventListener('click', () => {
                        copyCollabText(collabOfferEl.value, collabCopyOfferBtn);
                    });
                }

                if (collabCopyAnswerBtn && collabAnswerOutEl) {
                    collabCopyAnswerBtn.addEventListener('click', () => {
                        copyCollabText(collabAnswerOutEl.value, collabCopyAnswerBtn);
                    });
                }

                if (collabGenerateBtn) {
                    collabGenerateBtn.addEventListener('click', async () => {
                        if (!window.EphemeraCollab || !window.EphemeraP2P) {
                            setCollabStatus('Collaboration is unavailable in this environment.', 'err');
                            return;
                        }

                        collabGenerateBtn.disabled = true;
                        collabGenerateBtn.textContent = 'Generating...';
                        try {
                            const targetPath = await ensureCollabTargetFile();
                            const editor = editors[targetPath];
                            if (!editor) throw new Error('Editor is not ready');

                            closeCollabSession();

                            const { sessionId, offerCode } = await window.EphemeraCollab.createOffer({
                                docId: targetPath,
                                title: EphemeraFS.getBasename(targetPath),
                                initialText: editor.getValue(),
                                user: collabUser
                            });

                            collabSessionId = sessionId;
                            collabBoundPath = targetPath;
                            bindCollabToPath(targetPath);

                            if (collabOfferEl) collabOfferEl.value = offerCode;
                            if (collabCopyOfferBtn) collabCopyOfferBtn.style.display = '';
                            if (collabAnswerArea) collabAnswerArea.style.display = '';
                            setCollabStatus('Share the offer code, then paste their answer to connect.', 'info');
                            collabGenerateBtn.textContent = 'Regenerate';
                        } catch (e) {
                            setCollabStatus('Error: ' + e.message, 'err');
                            collabGenerateBtn.textContent = 'Generate Code';
                        } finally {
                            collabGenerateBtn.disabled = false;
                        }
                    });
                }

                if (collabCompleteBtn) {
                    collabCompleteBtn.addEventListener('click', async () => {
                        const answerCode = collabAnswerInEl?.value?.trim();
                        if (!answerCode || !collabSessionId) return;
                        collabCompleteBtn.disabled = true;
                        collabCompleteBtn.textContent = 'Connecting...';
                        try {
                            await window.EphemeraCollab.completeOffer(collabSessionId, answerCode);
                            setCollabStatus('Waiting for peer connection...', 'info');
                        } catch (e) {
                            setCollabStatus('Error: ' + e.message, 'err');
                            collabCompleteBtn.textContent = 'Connect';
                            collabCompleteBtn.disabled = false;
                        }
                    });
                }

                if (collabJoinBtn) {
                    collabJoinBtn.addEventListener('click', async () => {
                        const offerCode = collabOfferInEl?.value?.trim();
                        if (!offerCode) {
                            setCollabStatus('Paste an offer code first.', 'err');
                            return;
                        }
                        if (!window.EphemeraCollab || !window.EphemeraP2P) {
                            setCollabStatus('Collaboration is unavailable in this environment.', 'err');
                            return;
                        }

                        collabJoinBtn.disabled = true;
                        collabJoinBtn.textContent = 'Generating...';
                        try {
                            const targetPath = await ensureCollabTargetFile();
                            closeCollabSession();

                            const { sessionId, answerCode, doc } = await window.EphemeraCollab.createAnswer(offerCode, {
                                user: collabUser
                            });

                            collabSessionId = sessionId;
                            collabBoundPath = targetPath;
                            bindCollabToPath(targetPath);

                            if (collabAnswerOutEl) {
                                collabAnswerOutEl.value = answerCode;
                                collabAnswerOutEl.style.display = '';
                            }
                            if (collabCopyAnswerBtn) collabCopyAnswerBtn.style.display = '';
                            const docTitle = doc?.title ? ` for "${doc.title}"` : '';
                            setCollabStatus(`Send your answer code back to the initiator${docTitle}.`, 'info');
                            collabJoinBtn.textContent = 'Regenerate';
                        } catch (e) {
                            setCollabStatus('Error: ' + e.message, 'err');
                            collabJoinBtn.textContent = 'Generate Answer';
                        } finally {
                            collabJoinBtn.disabled = false;
                        }
                    });
                }
                
                const aiPanel = document.getElementById(`ai-panel-${windowId}`);
                const aiToggle = document.getElementById(`toggle-ai-${windowId}`);
                const aiChat = document.getElementById(`ai-chat-${windowId}`);
                const aiInput = document.getElementById(`ai-input-${windowId}`);
                const aiModel = document.getElementById(`ai-model-${windowId}`);
                const aiSend = document.getElementById(`ai-send-${windowId}`);
                const aiCodeBtn = document.getElementById(`ai-code-${windowId}`);
                
                const aiMessages = [];
                let aiIsStreaming = false;
                
                function toggleAIPanel() {
                    aiPanel.classList.toggle('open');
                    aiToggle.classList.toggle('active', aiPanel.classList.contains('open'));
                    if (aiPanel.classList.contains('open')) {
                        Promise.resolve(EphemeraAI.isConfigured()).then(configured => {
                            if (!configured) showAIMessage('assistant', '⚠️ Please configure your AI provider API key in Settings to use AI assistance.');
                        });
                    }
                }
                
                function escapeHtml(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }
                
                function showAIMessage(role, content, isStreaming = false) {
                    const empty = aiChat.querySelector('.ai-empty');
                    if (empty) empty.remove();
                    
                    const msgEl = document.createElement('div');
                    msgEl.className = `ai-message ${role}`;
                    msgEl.dataset.rawContent = content;
                    
                    if (role === 'assistant' && !isStreaming) {
                        msgEl.innerHTML = `
                            <div class="ai-message-actions">
                                <button class="ai-copy-btn" title="Copy response">Copy</button>
                            </div>
                            <div class="ai-message-content">${formatAIMessage(content)}</div>
                        `;
                        msgEl.querySelector('.ai-copy-btn').addEventListener('click', (e) => {
                            e.stopPropagation();
                            copyToClipboard(content, msgEl.querySelector('.ai-copy-btn'));
                        });
                    } else {
                        msgEl.innerHTML = `<div class="ai-message-content">${formatAIMessage(content)}</div>`;
                    }
                    
                    if (isStreaming) msgEl.id = `ai-streaming-${windowId}`;
                    aiChat.appendChild(msgEl);
                    aiChat.scrollTop = aiChat.scrollHeight;
                    return msgEl;
                }
                
                function copyToClipboard(text, btn) {
                    navigator.clipboard.writeText(text).then(() => {
                        if (btn) {
                            const orig = btn.textContent;
                            btn.textContent = 'Copied!';
                            btn.classList.add('copied');
                            setTimeout(() => {
                                btn.textContent = orig;
                                btn.classList.remove('copied');
                            }, 1500);
                        }
                        EphemeraNotifications.success('Copied', 'Content copied to clipboard');
                    }).catch(() => {
                        EphemeraNotifications.error('Copy Failed', 'Could not copy to clipboard');
                    });
                }
                
                function formatAIMessage(content) {
                    let html = escapeHtml(content);

                    // Extract fenced code blocks so later markdown/newline transforms don't mangle them
                    // (e.g. turning `\n` into `<br>`, which breaks copy/paste).
                    const codeBlocks = [];
                    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
                        const langLabel = lang || 'code';
                        const codeId = 'code-' + Math.random().toString(36).slice(2, 11);
                        const placeholder = `__EPH_CODEBLOCK_${codeId}__`;
                        codeBlocks.push({
                            placeholder,
                            html: `<pre><div class="code-header"><span class="code-lang">${langLabel}</span><button class="code-copy" data-target="${codeId}">Copy</button></div><code id="${codeId}">${code.trim()}</code></pre>`
                        });
                        return placeholder;
                    });
                    
                    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
                    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
                    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
                    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
                    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
                    html = html.replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>');
                    html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
                    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
                    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
                    html = html.replace(/^---$/gm, '<hr>');
                    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
                        const safeUrl = EphemeraSanitize ? EphemeraSanitize.sanitizeUrl(url) : url;
                        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
                    });
                    html = html.replace(/\n\n/g, '</p><p>');
                    html = html.replace(/\n/g, '<br>');
                    html = '<p>' + html + '</p>';
                    html = html.replace(/<p><\/p>/g, '');
                    html = html.replace(/<p>(<[hulob])/g, '$1');
                    html = html.replace(/(<\/[hulob][^>]*>)<\/p>/g, '$1');

                    // Restore code blocks after paragraph/newline processing so they keep real newlines.
                    for (const block of codeBlocks) {
                        html = html.split(block.placeholder).join(block.html);
                    }
                    html = html.replace(/<p>(<pre)/g, '$1');
                    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
                    
                    return html;
                }
                
                function attachCodeCopyHandlers(container) {
                    container.querySelectorAll('.code-copy').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const codeEl = document.getElementById(btn.dataset.target);
                            if (codeEl) {
                                copyToClipboard(codeEl.textContent, btn);
                            }
                        });
                    });
                }
                
                function updateStreamingMessage(msgEl, content) {
                    const contentEl = msgEl.querySelector('.ai-message-content') || msgEl;
                    contentEl.innerHTML = formatAIMessage(content);
                    msgEl.dataset.rawContent = content;
                    attachCodeCopyHandlers(contentEl);
                    aiChat.scrollTop = aiChat.scrollHeight;
                }
                
                function removeStreamingIndicator() {
                    const el = document.getElementById(`ai-streaming-${windowId}`);
                    if (el) {
                        const rawContent = el.dataset.rawContent || el.querySelector('.ai-message-content')?.textContent || '';
                        const formattedHtml = el.querySelector('.ai-message-content')?.innerHTML || '';
                        const newEl = document.createElement('div');
                        newEl.className = 'ai-message assistant';
                        newEl.dataset.rawContent = rawContent;
                        newEl.innerHTML = `
                            <div class="ai-message-actions">
                                <button class="ai-copy-btn" title="Copy response">Copy</button>
                            </div>
                            <div class="ai-message-content">${formattedHtml}</div>
                        `;
                        newEl.querySelector('.ai-copy-btn').addEventListener('click', (e) => {
                            e.stopPropagation();
                            copyToClipboard(rawContent, newEl.querySelector('.ai-copy-btn'));
                        });
                        attachCodeCopyHandlers(newEl);
                        el.replaceWith(newEl);
                    }
                    const typing = aiChat.querySelector('.ai-typing');
                    if (typing) typing.remove();
                }
                
                function showTypingIndicator() {
                    const empty = aiChat.querySelector('.ai-empty');
                    if (empty) empty.remove();
                    const typing = document.createElement('div');
                    typing.className = 'ai-typing';
                    typing.innerHTML = '<span></span><span></span><span></span>';
                    aiChat.appendChild(typing);
                    aiChat.scrollTop = aiChat.scrollHeight;
                }
                
                async function sendAIMessage(includeCode = false) {
                    const input = aiInput.value.trim();
                    if (!input && !includeCode) return;
                    if (aiIsStreaming) return;
                    
                    const configured = await EphemeraAI.isConfigured();
                    if (!configured) {
                        showAIMessage('assistant', '⚠️ Please configure your AI provider API key in Settings first.');
                        return;
                    }
                    
                    let userMessage = input;
                    if (includeCode && activeFile && editors[activeFile]) {
                        const code = editors[activeFile].getValue();
                        const filename = EphemeraFS.getBasename(activeFile);
                        userMessage = `${input || 'Help me with this code'}\n\n[Current file: ${filename}]\n\`\`\`javascript\n${code}\n\`\`\``;
                    }
                    
                    aiMessages.push({ role: 'user', content: userMessage });
                    showAIMessage('user', input || 'Help me with this code');
                    aiInput.value = '';
                    
                    aiIsStreaming = true;
                    aiSend.disabled = true;
                    aiCodeBtn.disabled = true;
                    showTypingIndicator();
                    
                    const streamingEl = showAIMessage('assistant', 'Thinking...', true);
                    let fullResponse = '';
                    
                    try {
                        const model = aiModel.value || (EphemeraAI.getModelForUseCase ? EphemeraAI.getModelForUseCase('code') : EphemeraAI.getDefaultModel());
                        
                        const systemPrompt = {
                            role: 'system',
                            content: `You are a helpful coding assistant for Ephemera, a browser-based OS. 
Help users write, debug, and improve their JavaScript code.
Keep responses concise and practical. Use markdown for formatting.
When providing code, use \`\`\`javascript code blocks.`
                        };
                        
                        const messagesToSend = [systemPrompt, ...aiMessages.slice(-6)];
                        
                        if (import.meta.env.DEV) console.log('[CodeEditor] Sending AI request, model:', model, 'messages:', messagesToSend.length);
                        
                        await EphemeraAI.chat(messagesToSend, model, (chunk, full) => {
                            fullResponse = full;
                            const typing = aiChat.querySelector('.ai-typing');
                            if (typing) typing.remove();
                            updateStreamingMessage(streamingEl, full);
                        });
                        
                        if (import.meta.env.DEV) console.log('[CodeEditor] AI response received, length:', fullResponse.length);
                        
                        if (!fullResponse) {
                            updateStreamingMessage(streamingEl, '(Empty response received)');
                            fullResponse = '(Empty response received)';
                        }
                        
                        streamingEl.dataset.rawContent = fullResponse;
                        aiMessages.push({ role: 'assistant', content: fullResponse });
                    } catch (e) {
                        console.error('[CodeEditor] AI error:', e);
                        updateStreamingMessage(streamingEl, `❌ **Error:** ${e.message}`);
                        streamingEl.dataset.rawContent = `Error: ${e.message}`;
                        aiMessages.pop();
                    } finally {
                        aiIsStreaming = false;
                        aiSend.disabled = false;
                        aiCodeBtn.disabled = false;
                        removeStreamingIndicator();
                    }
                }
                
                aiToggle.addEventListener('click', toggleAIPanel);
                aiSend.addEventListener('click', () => sendAIMessage(false));
                aiCodeBtn.addEventListener('click', () => sendAIMessage(true));
                
                const previewPanel = document.getElementById(`preview-panel-${windowId}`);
                const previewFrame = document.getElementById(`preview-frame-${windowId}`);
                const previewToggle = document.getElementById(`live-preview-${windowId}`);
                const previewRefresh = document.getElementById(`preview-refresh-${windowId}`);
                
                let previewUpdateTimer = null;
                
                function isPreviewableFile(path) {
                    const ext = EphemeraFS.getExtension(path);
                    return ['html', 'htm', 'md'].includes(ext);
                }

                function parseMarkdown(text) {
                    let html = EphemeraSanitize.escapeHtml(text);

                    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
                    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
                    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

                    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
                    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

                    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
                    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
                    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

                    html = html.replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>');
                    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
                    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
                    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

                    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
                        const safeUrl = EphemeraSanitize ? EphemeraSanitize.sanitizeUrl(url) : url;
                        return safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener">${text}</a>` : text;
                    });
                    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
                        const safeUrl = EphemeraSanitize ? EphemeraSanitize.sanitizeUrl(url) : url;
                        return safeUrl ? `<img src="${safeUrl}" alt="${alt}" loading="lazy">` : '';
                    });

                    html = html.replace(/^---$/gm, '<hr>');

                    html = html.replace(/\n\n/g, '</p><p>');
                    html = html.replace(/\n/g, '<br>');
                    html = '<p>' + html + '</p>';

                    html = html.replace(/<p><\/p>/g, '');
                    html = html.replace(/<p>(<h[123]>)/g, '$1');
                    html = html.replace(/(<\/h[123]>)<\/p>/g, '$1');
                    html = html.replace(/<p>(<pre>)/g, '$1');
                    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
                    html = html.replace(/<p>(<ul>)/g, '$1');
                    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
                    html = html.replace(/<p>(<blockquote>)/g, '$1');
                    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
                    html = html.replace(/<p>(<hr>)<\/p>/g, '$1');

                    return EphemeraSanitize ? EphemeraSanitize.sanitizeHtml(html) : html;
                }

                function updatePreview() {
                    if (!previewPanel.classList.contains('open')) return;
                    if (!activeFile || !editors[activeFile]) return;

                    const content = editors[activeFile].getValue();
                    const ext = EphemeraFS.getExtension(activeFile);

                    if (ext === 'md') {
                        // Markdown preview with styling
                        const mdHtml = parseMarkdown(content);
                        const styledHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        :root {
            --bg: #1a1a2e;
            --fg: #e8e8f0;
            --muted: #9898a8;
            --accent: #00d4aa;
            --border: rgba(255,255,255,0.1);
        }
        @media (prefers-color-scheme: light) {
            :root { --bg: #fff; --fg: #333; --muted: #666; --border: rgba(0,0,0,0.1); }
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 24px;
            background: var(--bg);
            color: var(--fg);
            line-height: 1.6;
        }
        h1, h2, h3 { margin: 1.5em 0 0.5em; }
        h1 { font-size: 2em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.25em; }
        code { background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
        pre { background: rgba(0,0,0,0.3); padding: 16px; border-radius: 8px; overflow-x: auto; }
        pre code { background: none; padding: 0; }
        blockquote { border-left: 4px solid var(--accent); margin: 1em 0; padding: 0.5em 1em; background: rgba(0,0,0,0.1); }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
        img { max-width: 100%; border-radius: 8px; }
        ul, ol { padding-left: 2em; }
        li { margin: 0.25em 0; }
        hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
    </style>
</head>
<body>${mdHtml}</body>
</html>`;
                        const blob = new Blob([styledHtml], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        previewFrame.src = url;
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } else {
                        // HTML preview
                        const blob = new Blob([content], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        previewFrame.src = url;
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }
                }
                
                function togglePreview() {
                    previewPanel.classList.toggle('open');
                    previewToggle.classList.toggle('active', previewPanel.classList.contains('open'));
                    if (previewPanel.classList.contains('open')) {
                        updatePreview();
                    }
                }
                
                previewToggle.addEventListener('click', togglePreview);
                previewRefresh.addEventListener('click', updatePreview);
                
                aiInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendAIMessage(false);
                    }
                });
                
                EphemeraAI.populateModelSelect(
                    aiModel,
                    EphemeraAI.getModelForUseCase ? EphemeraAI.getModelForUseCase('code') : EphemeraAI.getDefaultModel(),
                    { useCase: 'code' }
                );
                lifecycle.addListener(aiModel, 'change', () => {
                    EphemeraState.updateSetting('aiModelCode', aiModel.value);
                });

                // Register Ctrl+S save handler
                const ctrlSHandler = (e) => {
                    const key = String(e.key || '').toLowerCase();
                    if (!(e.ctrlKey || e.metaKey) || key !== 's') return;

                    const windowEl = document.getElementById(`window-${windowId}`);
                    if (!windowEl || !windowEl.contains(e.target)) return;
                    if (window.EphemeraState?.activeWindowId !== windowId) return;

                    e.preventDefault();
                    saveFile();
                };
                lifecycle.addListener(document, 'keydown', ctrlSHandler);

                // Accept file drops from Files app
                const editorArea = document.getElementById(`content-${windowId}`);
                if (editorArea) {
                    editorArea.addEventListener('dragover', (e) => {
                        if (e.dataTransfer.types.includes('application/x-ephemera-file')) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                        }
                    });
                    editorArea.addEventListener('drop', async (e) => {
                        const raw = e.dataTransfer.getData('application/x-ephemera-file');
                        if (!raw) return;
                        e.preventDefault();
                        try {
                            const { path, type } = JSON.parse(raw);
                            if (type === 'file' && EphemeraFS.isTextFile(path)) {
                                openFile(path);
                            }
                        } catch (err) {
                            console.error('[CodeEditor] Drop failed:', err);
                        }
                    });
                }

                updateGitUiState();
                await loadFileTree();

                if (options.filePath) {
                    await openFile(options.filePath);
                }
                await refreshGitState({
                    path: options.filePath || activeFile || `${EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user'}/Documents`,
                    forceDetect: true
                });

                return {
                    onSave: async () => {
                        return await saveFile();
                    },
                    destroy: () => {
                        // Clear any pending auto-save timers
                        Object.values(autoSaveTimers).forEach(timer => clearTimeout(timer));
                        autoSaveTimers = {};
                        if (gitRefreshTimer) clearTimeout(gitRefreshTimer);
                        if (gitDiffTimer) clearTimeout(gitDiffTimer);
                        openFiles.forEach((path) => clearDiffMarkersForPath(path));
                        closeCollabSession();
                        unregisterAssistantContext();
                        // Use lifecycle cleanup
                        lifecycle.destroy();
                        console.log('[CodeEditor] Cleaned up listeners');
                    }
                };
            }
        };
    }
});
