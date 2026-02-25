EphemeraApps.register({
    id: 'aichat',
    name: 'AI Chat',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><circle cx="9" cy="10" r="1"/><circle cx="12" cy="10" r="1"/><circle cx="15" cy="10" r="1"/></svg>`,
    width: 900,
    height: 600,
    category: 'productivity',
    singleton: true,
    content: (windowId) => {
        return {
            html: `
                <style>
                    .aichat-container { display:flex;flex-direction:row;height:100%;background:var(--bg-primary); }
                    
                    /* Sidebar */
                    .aichat-sidebar { width:250px;min-width:250px;background:var(--bg-secondary);border-right:1px solid var(--border);display:flex;flex-direction:column;transition:width 0.2s,min-width 0.2s,opacity 0.2s;overflow:hidden; }
                    .aichat-sidebar.collapsed { width:0;min-width:0;opacity:0; }
                    .aichat-sidebar-header { display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border); }
                    .aichat-sidebar-header h3 { margin:0;font-size:0.95rem;color:var(--fg-primary); }
                    .aichat-sidebar-new { padding:6px 12px;background:var(--accent);border:none;color:#fff;border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.75rem;font-weight:500; }
                    .aichat-sidebar-new:hover { filter:brightness(1.1); }
                    .aichat-chat-list { flex:1;overflow-y:auto;padding:8px; }
                    .aichat-chat-item { display:flex;align-items:center;padding:10px 12px;border-radius:var(--radius-sm);cursor:pointer;margin-bottom:4px;position:relative; }
                    .aichat-chat-item:hover { background:var(--bg-tertiary); }
                    .aichat-chat-item.active { background:var(--bg-tertiary);border-left:3px solid var(--accent);padding-left:9px; }
                    .aichat-chat-item-info { flex:1;min-width:0; }
                    .aichat-chat-item-title { font-size:0.85rem;color:var(--fg-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
                    .aichat-chat-item-time { font-size:0.7rem;color:var(--fg-muted);margin-top:2px; }
                    .aichat-chat-item-actions { display:flex;gap:4px;opacity:0;transition:opacity 0.15s; }
                    .aichat-chat-item:hover .aichat-chat-item-actions { opacity:1; }
                    .aichat-chat-item-actions button { padding:4px 6px;background:transparent;border:none;color:var(--fg-muted);cursor:pointer;font-family:inherit;border-radius:4px; }
                    .aichat-chat-item-actions button:hover { background:var(--bg-primary);color:var(--fg-primary); }
                    .aichat-chat-item-actions button svg { width:14px;height:14px; }
                    .aichat-rename-input { width:100%;background:var(--bg-primary);border:1px solid var(--accent);border-radius:4px;padding:4px 8px;font-size:0.85rem;color:var(--fg-primary);font-family:inherit;outline:none; }
                    
                    /* Chat panel */
                    .aichat-chat-panel { flex:1;display:flex;flex-direction:column;min-width:0; }
                    .aichat-header { display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border); }
                    .aichat-header-left { display:flex;align-items:center;gap:12px; }
                    .aichat-sidebar-toggle { padding:6px;background:transparent;border:none;color:var(--fg-secondary);cursor:pointer;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center; }
                    .aichat-sidebar-toggle:hover { background:var(--bg-tertiary);color:var(--fg-primary); }
                    .aichat-sidebar-toggle svg { width:18px;height:18px; }
                    .aichat-header h2 { margin:0;font-size:1.1rem;color:var(--fg-primary);display:flex;align-items:center;gap:8px; }
                    .aichat-header-title { font-size:1rem;color:var(--fg-primary);font-weight:500;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
                    .aichat-header-actions { display:flex;gap:8px;align-items:center; }
                    .aichat-header select { padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-sm);font-family:inherit;font-size:0.8rem; }
                    .aichat-header button { padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.8rem; }
                    .aichat-header button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .aichat-messages { flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:16px; }
                    .aichat-message { max-width:85%;padding:12px 16px;border-radius:var(--radius-lg);line-height:1.5;position:relative; }
                    .aichat-message.user { background:var(--accent);color:#fff;align-self:flex-end;border-bottom-right-radius:4px; }
                    .aichat-message.assistant { background:var(--bg-secondary);color:var(--fg-primary);align-self:flex-start;border-bottom-left-radius:4px;border:1px solid var(--border); }
                    .aichat-message.system { background:rgba(245,158,11,0.1);color:var(--warning);align-self:center;font-size:0.8rem;border:1px solid rgba(245,158,11,0.3); }

                    /* Rich markdown in assistant messages */
                    .aichat-message.assistant h1 { font-size:1.3em;font-weight:600;margin:0.6em 0 0.3em;color:var(--fg-primary); }
                    .aichat-message.assistant h2 { font-size:1.15em;font-weight:600;margin:0.5em 0 0.3em;color:var(--fg-primary); }
                    .aichat-message.assistant h3 { font-size:1.05em;font-weight:600;margin:0.4em 0 0.2em;color:var(--fg-primary); }
                    .aichat-message.assistant p { margin:0.4em 0; }
                    .aichat-message.assistant ul,.aichat-message.assistant ol { margin:0.4em 0;padding-left:1.5em; }
                    .aichat-message.assistant li { margin:0.2em 0; }
                    .aichat-message.assistant blockquote { margin:0.5em 0;padding:0.4em 0.8em;border-left:3px solid var(--accent);background:rgba(0,0,0,0.15);border-radius:0 4px 4px 0;color:var(--fg-secondary);font-style:italic; }
                    .aichat-message.assistant a { color:var(--accent);text-decoration:none; }
                    .aichat-message.assistant a:hover { text-decoration:underline; }
                    .aichat-message.assistant hr { border:none;border-top:1px solid var(--border);margin:0.8em 0; }
                    .aichat-message.assistant table { border-collapse:collapse;width:100%;margin:0.5em 0;font-size:0.9em; }
                    .aichat-message.assistant th,.aichat-message.assistant td { border:1px solid var(--border);padding:6px 10px;text-align:left; }
                    .aichat-message.assistant th { background:var(--bg-tertiary);font-weight:600; }
                    .aichat-message.assistant del { opacity:0.6; }

                    /* Code blocks with header */
                    .aichat-message.assistant pre { background:rgba(0,0,0,0.4);padding:0;margin:8px 0;border-radius:6px;overflow:hidden; }
                    .aichat-message.assistant .code-header { display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:rgba(0,0,0,0.3);border-bottom:1px solid var(--border); }
                    .aichat-message.assistant .code-lang { font-size:0.65rem;color:var(--fg-muted);text-transform:uppercase;font-family:inherit; }
                    .aichat-message.assistant .code-copy { padding:2px 8px;font-size:0.65rem;background:rgba(255,255,255,0.1);border:none;border-radius:4px;color:var(--fg-muted);cursor:pointer;font-family:inherit; }
                    .aichat-message.assistant .code-copy:hover { background:rgba(255,255,255,0.2);color:var(--fg-primary); }
                    .aichat-message.assistant pre code { display:block;padding:12px;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:0.85rem;line-height:1.5;background:none;color:var(--fg-primary); }
                    .aichat-message.assistant :not(pre) > code { font-family:'JetBrains Mono',monospace;font-size:0.85em;background:rgba(0,0,0,0.25);padding:2px 6px;border-radius:4px;color:var(--accent); }

                    /* User message code (simple) */
                    .aichat-message.user pre { background:rgba(0,0,0,0.2);padding:12px;border-radius:var(--radius-sm);overflow-x:auto;margin:8px 0;font-family:'JetBrains Mono',monospace;font-size:0.85rem; }
                    .aichat-message.user code { font-family:'JetBrains Mono',monospace;background:rgba(0,0,0,0.15);padding:2px 6px;border-radius:4px;font-size:0.85em; }
                    .aichat-message.user pre code { background:none;padding:0; }

                    /* Message actions toolbar */
                    .aichat-msg-actions { position:absolute;top:6px;right:6px;display:flex;gap:2px;opacity:0;transition:opacity 0.15s;z-index:1; }
                    .aichat-message:hover .aichat-msg-actions { opacity:1; }
                    .aichat-msg-actions button { padding:3px 7px;font-size:0.65rem;background:rgba(0,0,0,0.35);border:none;border-radius:4px;color:rgba(255,255,255,0.8);cursor:pointer;font-family:inherit;white-space:nowrap; }
                    .aichat-msg-actions button:hover { background:rgba(0,0,0,0.55);color:#fff; }
                    .aichat-message.assistant .aichat-msg-actions button { background:var(--bg-tertiary);color:var(--fg-secondary);border:1px solid var(--border); }
                    .aichat-message.assistant .aichat-msg-actions button:hover { background:var(--bg-primary);color:var(--fg-primary); }

                    /* Timestamp */
                    .aichat-timestamp { font-size:0.6rem;color:var(--fg-muted);margin-top:4px;opacity:0.6; }
                    .aichat-message.user .aichat-timestamp { text-align:right; }

                    /* Edit mode */
                    .aichat-edit-area { width:100%;min-height:60px;max-height:200px;padding:8px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.2);border-radius:var(--radius-sm);color:#fff;font-family:inherit;font-size:0.9rem;resize:vertical;outline:none; }
                    .aichat-edit-actions { display:flex;gap:6px;margin-top:6px;justify-content:flex-end; }
                    .aichat-edit-actions button { padding:4px 10px;font-size:0.75rem;border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;border:none; }
                    .aichat-edit-actions .aichat-edit-save { background:rgba(255,255,255,0.9);color:#000; }
                    .aichat-edit-actions .aichat-edit-save:hover { background:#fff; }
                    .aichat-edit-actions .aichat-edit-cancel { background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.8); }
                    .aichat-edit-actions .aichat-edit-cancel:hover { background:rgba(255,255,255,0.25); }

                    /* Stop button */
                    .aichat-stop-wrap { display:none;justify-content:center;padding:8px 16px; }
                    .aichat-stop-wrap.visible { display:flex; }
                    .aichat-stop-btn { padding:8px 20px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-lg);cursor:pointer;font-family:inherit;font-size:0.8rem;display:flex;align-items:center;gap:6px;transition:all 0.2s; }
                    .aichat-stop-btn:hover { background:var(--bg-secondary);color:var(--fg-primary);border-color:var(--fg-muted); }
                    .aichat-stop-btn svg { width:14px;height:14px; }

                    /* Input area */
                    .aichat-input-area { padding:16px;background:var(--bg-secondary);border-top:1px solid var(--border); }
                    .aichat-input-wrapper { display:flex;gap:12px;align-items:flex-end; }
                    .aichat-input { flex:1;min-height:44px;max-height:150px;padding:12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--fg-primary);font-family:inherit;font-size:0.9rem;resize:none;outline:none; }
                    .aichat-input:focus { border-color:var(--accent); }
                    .aichat-send { padding:12px 20px;background:var(--accent);border:none;color:#fff;border-radius:var(--radius-md);cursor:pointer;font-family:inherit;font-size:0.9rem;font-weight:500;transition:all 0.2s; }
                    .aichat-send:hover { filter:brightness(1.1); }
                    .aichat-send:disabled { opacity:0.5;cursor:not-allowed; }
                    .aichat-input-hint { font-size:0.65rem;color:var(--fg-muted);margin-top:6px;opacity:0.6;text-align:right; }

                    /* Welcome */
                    .aichat-welcome { text-align:center;padding:40px 20px;color:var(--fg-muted); }
                    .aichat-welcome h3 { color:var(--fg-primary);margin-bottom:12px;font-size:1.2rem; }
                    .aichat-welcome p { margin-bottom:8px;font-size:0.9rem; }
                    .aichat-welcome .suggestions { display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:20px; }
                    .aichat-welcome .suggestion { padding:8px 16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);cursor:pointer;font-size:0.8rem;color:var(--fg-secondary);transition:all 0.2s; }
                    .aichat-welcome .suggestion:hover { border-color:var(--accent);color:var(--fg-primary); }

                    /* Typing indicator */
                    .aichat-typing { display:flex;gap:4px;padding:12px 16px;background:var(--bg-secondary);border-radius:var(--radius-lg);align-self:flex-start;border:1px solid var(--border); }
                    .aichat-typing span { width:8px;height:8px;background:var(--fg-muted);border-radius:50%;animation:aichat-typing 1.4s infinite; }
                    .aichat-typing span:nth-child(2) { animation-delay:0.2s; }
                    .aichat-typing span:nth-child(3) { animation-delay:0.4s; }
                    @keyframes aichat-typing { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-4px); } }

                    .aichat-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--fg-muted); }
                    .aichat-config-notice { padding:16px;text-align:center;background:rgba(245,158,11,0.1);border-bottom:1px solid rgba(245,158,11,0.3);color:var(--warning);font-size:0.85rem; }
                    .aichat-config-notice a { color:var(--accent);cursor:pointer;text-decoration:underline; }
                </style>
                <div class="aichat-container">
                    <div class="aichat-sidebar" id="aichat-sidebar-${windowId}">
                        <div class="aichat-sidebar-header">
                            <h3>Chats</h3>
                            <button class="aichat-sidebar-new" id="aichat-new-chat-${windowId}" aria-label="New chat">+ New</button>
                        </div>
                        <div class="aichat-chat-list" id="aichat-chat-list-${windowId}"></div>
                    </div>
                    <div class="aichat-chat-panel">
                        <div class="aichat-header">
                            <div class="aichat-header-left">
                                <button class="aichat-sidebar-toggle" id="aichat-sidebar-toggle-${windowId}" aria-label="Toggle chat sidebar">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
                                </button>
                                <span class="aichat-header-title" id="aichat-header-title-${windowId}">AI Chat</span>
                            </div>
                            <div class="aichat-header-actions">
                                <select id="aichat-model-${windowId}">
                                    <option value="">Loading...</option>
                                </select>
                                <button id="aichat-export-${windowId}">Export</button>
                            </div>
                        </div>
                        <div class="aichat-messages" id="aichat-messages-${windowId}">
                            <div class="aichat-welcome">
                                <h3>How can I help you today?</h3>
                                <p>I'm your AI assistant. Ask me anything about coding, writing, or general questions.</p>
                                <div class="suggestions">
                                    <span class="suggestion">Write a JavaScript function</span>
                                    <span class="suggestion">Explain async/await</span>
                                    <span class="suggestion">Help me debug code</span>
                                    <span class="suggestion">Create a React component</span>
                                </div>
                            </div>
                        </div>
                        <div class="aichat-stop-wrap" id="aichat-stop-wrap-${windowId}">
                            <button class="aichat-stop-btn" id="aichat-stop-${windowId}">
                                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                                Stop generating
                            </button>
                        </div>
                        <div class="aichat-input-area">
                            <div class="aichat-input-wrapper">
                                <textarea class="aichat-input" id="aichat-input-${windowId}" placeholder="Type your message..." rows="1"></textarea>
                                <button class="aichat-send" id="aichat-send-${windowId}" aria-label="Send message">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                                </button>
                            </div>
                            <div class="aichat-input-hint">Press Enter to send, Shift+Enter for new line</div>
                        </div>
                    </div>
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();

                const sidebar = document.getElementById(`aichat-sidebar-${windowId}`);
                const chatList = document.getElementById(`aichat-chat-list-${windowId}`);
                const messagesContainer = document.getElementById(`aichat-messages-${windowId}`);
                const input = document.getElementById(`aichat-input-${windowId}`);
                const sendBtn = document.getElementById(`aichat-send-${windowId}`);
                const newChatBtn = document.getElementById(`aichat-new-chat-${windowId}`);
                const exportBtn = document.getElementById(`aichat-export-${windowId}`);
                const modelSelect = document.getElementById(`aichat-model-${windowId}`);
                const stopWrap = document.getElementById(`aichat-stop-wrap-${windowId}`);
                const stopBtn = document.getElementById(`aichat-stop-${windowId}`);
                const toggleBtn = document.getElementById(`aichat-sidebar-toggle-${windowId}`);
                const headerTitle = document.getElementById(`aichat-header-title-${windowId}`);

                const INDEX_KEY = 'ephemera_aichat_index';
                const LEGACY_KEY = 'ephemera_aichat_history';
                const chatKey = (id) => `ephemera_aichat_chat_${id}`;
                const generateChatId = () => `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                const SANITIZE_OPTS = {
                    ALLOWED_TAGS: [
                        'b','i','em','strong','a','p','br','ul','ol','li',
                        'code','pre','blockquote','h1','h2','h3','h4','h5','h6',
                        'table','thead','tbody','tr','th','td','hr','img','span','div','sup','sub','del'
                    ]
                };

                let chatIndex = [];
                let activeChatId = null;
                let conversationHistory = [];
                let isStreaming = false;
                let currentAbortController = null;
                let sidebarCollapsed = false;

                const isConfigured = await EphemeraAI.isConfigured();

                if (!isConfigured) {
                    messagesContainer.innerHTML = `
                        <div class="aichat-config-notice">
                            <p>AI Chat requires an AI provider API key.</p>
                            <p>Go to <a id="aichat-settings-link-${windowId}">Settings</a> to configure your API key.</p>
                        </div>
                    `;
                    document.getElementById(`aichat-settings-link-${windowId}`).addEventListener('click', () => {
                        EphemeraWM.open('settings', { tab: 'ai' });
                    });
                }

                await EphemeraAI.populateModelSelect(
                    modelSelect,
                    EphemeraAI.getModelForUseCase ? EphemeraAI.getModelForUseCase('chat') : EphemeraAI.getDefaultModel(),
                    { useCase: 'chat' }
                );

                // --- Formatting utilities ---

                function formatTimestamp(ts) {
                    if (!ts) return '';
                    return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                }

                function formatRelativeTime(ts) {
                    if (!ts) return '';
                    const now = Date.now();
                    const diff = now - ts;
                    const mins = Math.floor(diff / 60000);
                    const hours = Math.floor(diff / 3600000);
                    const days = Math.floor(diff / 86400000);
                    
                    if (mins < 1) return 'just now';
                    if (mins < 60) return `${mins}m ago`;
                    if (hours < 24) return `${hours}h ago`;
                    if (days < 7) return `${days}d ago`;
                    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
                }

                function formatUserMessage(content) {
                    return EphemeraSanitize.escapeHtml(content).replace(/\n/g, '<br>');
                }

                function formatAIResponse(text) {
                    let html = '';
                    let lastIndex = 0;
                    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
                    let match;

                    while ((match = codeBlockRegex.exec(text)) !== null) {
                        html += formatTextSegment(text.slice(lastIndex, match.index));
                        const lang = match[1] || '';
                        const code = match[2];
                        const langLabel = lang || 'code';
                        const rawCode = EphemeraSanitize.escapeAttr(code);
                        html += `<pre><div class="code-header"><span class="code-lang">${EphemeraSanitize.escapeHtml(langLabel)}</span><button class="code-copy">Copy</button></div><code class="language-${EphemeraSanitize.escapeHtml(lang)}" data-raw="${rawCode}">${EphemeraSanitize.escapeHtml(code.trim())}</code></pre>`;
                        lastIndex = match.index + match[0].length;
                    }

                    html += formatTextSegment(text.slice(lastIndex));
                    return html;
                }

                function formatTextSegment(text) {
                    if (!text) return '';
                    let html = EphemeraSanitize.escapeHtml(text);

                    // Inline code (before bold/italic to avoid conflicts)
                    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

                    // Bold, italic, strikethrough
                    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
                    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
                    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

                    // Headings
                    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
                    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
                    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

                    // Horizontal rules
                    html = html.replace(/^---$/gm, '<hr>');

                    // Blockquotes
                    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

                    // Tables
                    html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm, (_, header, sep, body) => {
                        const thCells = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
                        const rows = body.trim().split('\n').map(row => {
                            const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
                            return `<tr>${cells}</tr>`;
                        }).join('');
                        return `<table><thead><tr>${thCells}</tr></thead><tbody>${rows}</tbody></table>`;
                    });

                    // Lists
                    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
                    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
                    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

                    // Links
                    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
                        const safeUrl = EphemeraSanitize.sanitizeUrl(url);
                        return safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener">${text}</a>` : text;
                    });

                    // Paragraphs
                    html = html.replace(/\n\n/g, '</p><p>');
                    html = html.replace(/\n/g, '<br>');
                    html = '<p>' + html + '</p>';

                    // Clean up empty/misplaced paragraphs
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
                    html = html.replace(/<p>(<table>)/g, '$1');
                    html = html.replace(/(<\/table>)<\/p>/g, '$1');

                    return html;
                }

                function attachCodeBlockHandlers(container) {
                    container.querySelectorAll('.code-copy').forEach(btn => {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            const codeEl = btn.closest('pre').querySelector('code');
                            const code = codeEl.getAttribute('data-raw') || codeEl.textContent;
                            navigator.clipboard.writeText(code);
                            btn.textContent = 'Copied!';
                            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
                        };
                    });
                }

                // --- Index & Chat persistence ---

                async function loadIndex() {
                    const stored = await EphemeraStorage.get('metadata', INDEX_KEY);
                    if (stored?.value) {
                        try {
                            const parsed = JSON.parse(stored.value);
                            chatIndex = parsed.chats || [];
                        } catch (e) {
                            chatIndex = [];
                        }
                    }
                }

                async function saveIndex() {
                    await EphemeraStorage.put('metadata', {
                        key: INDEX_KEY,
                        value: JSON.stringify({ chats: chatIndex })
                    });
                }

                async function loadChat(id) {
                    const stored = await EphemeraStorage.get('metadata', chatKey(id));
                    if (stored?.value) {
                        try {
                            const parsed = JSON.parse(stored.value);
                            return parsed.messages || [];
                        } catch (e) {
                            return [];
                        }
                    }
                    return [];
                }

                async function saveChat(id, messages) {
                    await EphemeraStorage.put('metadata', {
                        key: chatKey(id),
                        value: JSON.stringify({ messages })
                    });
                }

                async function saveActiveChat() {
                    if (!activeChatId) return;
                    await saveChat(activeChatId, conversationHistory);
                }

                async function createChat() {
                    const id = generateChatId();
                    const now = Date.now();
                    const chat = {
                        id,
                        title: 'New Chat',
                        createdAt: now,
                        updatedAt: now,
                        model: modelSelect.value || (EphemeraAI.getModelForUseCase ? EphemeraAI.getModelForUseCase('chat') : EphemeraAI.getDefaultModel())
                    };
                    chatIndex.unshift(chat);
                    await saveIndex();
                    await saveChat(id, []);
                    await switchToChat(id);
                    renderSidebar();
                }

                async function switchToChat(id) {
                    if (isStreaming) return;
                    if (activeChatId) {
                        await saveActiveChat();
                    }
                    activeChatId = id;
                    conversationHistory = await loadChat(id);
                    const chat = chatIndex.find(c => c.id === id);
                    if (chat) {
                        headerTitle.textContent = chat.title;
                    }
                    renderHistory();
                    renderSidebar();
                }

                async function renameChat(id, newTitle) {
                    const chat = chatIndex.find(c => c.id === id);
                    if (chat) {
                        chat.title = newTitle;
                        chat.updatedAt = Date.now();
                        await saveIndex();
                        renderSidebar();
                        if (id === activeChatId) {
                            headerTitle.textContent = newTitle;
                        }
                    }
                }

                async function deleteChat(id) {
                    await EphemeraStorage.delete('metadata', chatKey(id));
                    chatIndex = chatIndex.filter(c => c.id !== id);
                    await saveIndex();
                    
                    if (id === activeChatId) {
                        if (chatIndex.length > 0) {
                            await switchToChat(chatIndex[0].id);
                        } else {
                            activeChatId = null;
                            conversationHistory = [];
                            headerTitle.textContent = 'AI Chat';
                            renderHistory();
                            renderSidebar();
                        }
                    } else {
                        renderSidebar();
                    }
                }

                async function migrateOldHistory() {
                    const stored = await EphemeraStorage.get('metadata', LEGACY_KEY);
                    if (stored?.messages?.length) {
                        const messages = stored.messages;
                        const id = generateChatId();
                        const now = Date.now();
                        const firstUserMsg = messages.find(m => m.role === 'user');
                        let title = 'Migrated Chat';
                        if (firstUserMsg?.content) {
                            title = firstUserMsg.content.substring(0, 40);
                            if (firstUserMsg.content.length > 40) title += '...';
                        }
                        const chat = {
                            id,
                            title,
                            createdAt: now,
                            updatedAt: now,
                            model: modelSelect.value || (EphemeraAI.getModelForUseCase ? EphemeraAI.getModelForUseCase('chat') : EphemeraAI.getDefaultModel())
                        };
                        chatIndex.push(chat);
                        await saveIndex();
                        await saveChat(id, messages);
                        await EphemeraStorage.delete('metadata', LEGACY_KEY);
                    }
                }

                // --- Sidebar rendering ---

                function renderSidebar() {
                    const sorted = [...chatIndex].sort((a, b) => b.updatedAt - a.updatedAt);
                    chatList.innerHTML = sorted.map(chat => `
                        <div class="aichat-chat-item ${chat.id === activeChatId ? 'active' : ''}" data-chat-id="${chat.id}">
                            <div class="aichat-chat-item-info">
                                <div class="aichat-chat-item-title">${EphemeraSanitize.escapeHtml(chat.title)}</div>
                                <div class="aichat-chat-item-time">${formatRelativeTime(chat.updatedAt)}</div>
                            </div>
                            <div class="aichat-chat-item-actions">
                                <button class="aichat-rename-btn" title="Rename" aria-label="Rename chat">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 3 21l.5-4.5L17 3z"/></svg>
                                </button>
                                <button class="aichat-delete-btn" title="Delete" aria-label="Delete chat">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                            </div>
                        </div>
                    `).join('');

                    chatList.querySelectorAll('.aichat-chat-item').forEach(item => {
                        const chatId = item.dataset.chatId;
                        
                        item.addEventListener('click', (e) => {
                            if (e.target.closest('.aichat-chat-item-actions')) return;
                            switchToChat(chatId);
                        });

                        const renameBtn = item.querySelector('.aichat-rename-btn');
                        renameBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            startRenameInline(item, chatId);
                        });

                        const deleteBtn = item.querySelector('.aichat-delete-btn');
                        deleteBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const confirmed = await window.EphemeraDialog?.confirm?.(
                                'Delete this chat?',
                                'Delete Chat',
                                true
                            );
                            if (!confirmed) return;
                            await deleteChat(chatId);
                        });
                    });
                }

                function startRenameInline(item, chatId) {
                    const chat = chatIndex.find(c => c.id === chatId);
                    if (!chat) return;
                    
                    const titleEl = item.querySelector('.aichat-chat-item-title');
                    const originalTitle = chat.title;
                    
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'aichat-rename-input';
                    input.value = originalTitle;
                    
                    titleEl.replaceWith(input);
                    input.focus();
                    input.select();

                    const commit = () => {
                        const newTitle = input.value.trim() || originalTitle;
                        renameChat(chatId, newTitle);
                    };

                    const cancel = () => {
                        const newTitleEl = document.createElement('div');
                        newTitleEl.className = 'aichat-chat-item-title';
                        newTitleEl.textContent = originalTitle;
                        input.replaceWith(newTitleEl);
                    };

                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commit();
                        } else if (e.key === 'Escape') {
                            cancel();
                        }
                    });

                    input.addEventListener('blur', commit);
                }

                // --- Message rendering ---

                function renderHistory() {
                    if (conversationHistory.length === 0) {
                        messagesContainer.innerHTML = `
                            <div class="aichat-welcome">
                                <h3>How can I help you today?</h3>
                                <p>I'm your AI assistant. Ask me anything about coding, writing, or general questions.</p>
                                <div class="suggestions">
                                    <span class="suggestion">Write a JavaScript function</span>
                                    <span class="suggestion">Explain async/await</span>
                                    <span class="suggestion">Help me debug code</span>
                                    <span class="suggestion">Create a React component</span>
                                </div>
                            </div>
                        `;
                        attachSuggestionEvents();
                        return;
                    }

                    messagesContainer.innerHTML = '';
                    conversationHistory.forEach((msg, idx) => {
                        if (msg.role !== 'system') {
                            appendMessage(msg.role, msg.content, idx, msg.timestamp, false);
                        }
                    });
                    scrollToBottom();
                }

                function appendMessage(role, content, msgIndex, timestamp, scroll = true) {
                    const div = document.createElement('div');
                    div.className = `aichat-message ${role}`;

                    div.dataset.msgIndex = msgIndex;
                    div.dataset.rawContent = content;

                    if (role === 'user' || role === 'assistant') {
                        const actionsDiv = document.createElement('div');
                        actionsDiv.className = 'aichat-msg-actions';

                        if (role === 'user') {
                            actionsDiv.innerHTML = '<button class="act-edit">Edit</button><button class="act-copy">Copy</button><button class="act-del">Del</button>';
                        } else {
                            actionsDiv.innerHTML = '<button class="act-copy">Copy</button><button class="act-regen">Regen</button><button class="act-del">Del</button>';
                        }
                        div.appendChild(actionsDiv);
                    }

                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'aichat-msg-content';
                    if (role === 'assistant') {
                        contentDiv.innerHTML = EphemeraSanitize.sanitizeHtml(formatAIResponse(content), SANITIZE_OPTS);
                    } else if (role === 'user') {
                        contentDiv.innerHTML = EphemeraSanitize.sanitizeHtml(formatUserMessage(content));
                    } else {
                        contentDiv.innerHTML = EphemeraSanitize.sanitizeHtml(EphemeraSanitize.escapeHtml(content));
                    }
                    div.appendChild(contentDiv);

                    if (timestamp) {
                        const tsDiv = document.createElement('div');
                        tsDiv.className = 'aichat-timestamp';
                        tsDiv.textContent = formatTimestamp(timestamp);
                        div.appendChild(tsDiv);
                    }

                    messagesContainer.appendChild(div);

                    // DOM pruning: remove old messages if too many
                    const MAX_MESSAGES = 200;
                    const PRUNE_TO = 150;
                    const messages = messagesContainer.querySelectorAll('.aichat-message');
                    if (messages.length > MAX_MESSAGES) {
                        const toRemove = messages.length - PRUNE_TO;
                        for (let i = 0; i < toRemove; i++) {
                            messages[i].remove();
                        }
                    }

                    if (role === 'assistant') {
                        attachCodeBlockHandlers(div);
                    }
                    if (role === 'user' || role === 'assistant') {
                        attachMessageActions(div, msgIndex, role, content);
                    }

                    if (scroll) scrollToBottom();
                    return div;
                }

                function attachMessageActions(div, msgIndex, role, rawContent) {
                    const copyBtn = div.querySelector('.act-copy');
                    if (copyBtn) {
                        copyBtn.onclick = (e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(rawContent);
                            EphemeraNotifications.success('Copied', 'Message copied to clipboard.');
                        };
                    }

                    const delBtn = div.querySelector('.act-del');
                    if (delBtn) {
                        delBtn.onclick = (e) => {
                            e.stopPropagation();
                            deleteMessage(msgIndex, role);
                        };
                    }

                    const editBtn = div.querySelector('.act-edit');
                    if (editBtn) {
                        editBtn.onclick = (e) => {
                            e.stopPropagation();
                            startEditMessage(div, msgIndex);
                        };
                    }

                    const regenBtn = div.querySelector('.act-regen');
                    if (regenBtn) {
                        regenBtn.onclick = (e) => {
                            e.stopPropagation();
                            regenerateResponse(msgIndex);
                        };
                    }
                }

                async function deleteMessage(msgIndex, role) {
                    if (role === 'user') {
                        const nextMsg = conversationHistory[msgIndex + 1];
                        if (nextMsg && nextMsg.role === 'assistant') {
                            conversationHistory.splice(msgIndex, 2);
                        } else {
                            conversationHistory.splice(msgIndex, 1);
                        }
                    } else {
                        conversationHistory.splice(msgIndex, 1);
                    }
                    await saveActiveChat();
                    updateChatTimestamp();
                    renderHistory();
                }

                function startEditMessage(div, msgIndex) {
                    const contentDiv = div.querySelector('.aichat-msg-content');
                    const actionsDiv = div.querySelector('.aichat-msg-actions');
                    const originalContent = conversationHistory[msgIndex].content;

                    if (actionsDiv) actionsDiv.style.display = 'none';

                    contentDiv.innerHTML = '';
                    const editArea = document.createElement('textarea');
                    editArea.className = 'aichat-edit-area';
                    editArea.value = originalContent;
                    contentDiv.appendChild(editArea);

                    const btnsDiv = document.createElement('div');
                    btnsDiv.className = 'aichat-edit-actions';
                    btnsDiv.innerHTML = '<button class="aichat-edit-save">Save & Resubmit</button><button class="aichat-edit-cancel">Cancel</button>';
                    contentDiv.appendChild(btnsDiv);

                    editArea.focus();
                    editArea.setSelectionRange(editArea.value.length, editArea.value.length);

                    btnsDiv.querySelector('.aichat-edit-cancel').onclick = () => {
                        if (actionsDiv) actionsDiv.style.display = '';
                        contentDiv.innerHTML = EphemeraSanitize.sanitizeHtml(formatUserMessage(originalContent));
                    };

                    btnsDiv.querySelector('.aichat-edit-save').onclick = async () => {
                        const newContent = editArea.value.trim();
                        if (!newContent) return;
                        conversationHistory = conversationHistory.slice(0, msgIndex);
                        conversationHistory.push({ role: 'user', content: newContent, timestamp: Date.now() });
                        await saveActiveChat();
                        updateChatTimestamp();
                        renderHistory();
                        generateAssistantResponse();
                    };
                }

                async function regenerateResponse(msgIndex) {
                    conversationHistory = conversationHistory.slice(0, msgIndex);
                    await saveActiveChat();
                    updateChatTimestamp();
                    renderHistory();
                    generateAssistantResponse();
                }

                // --- Core generation logic ---

                async function updateChatTimestamp() {
                    if (!activeChatId) return;
                    const chat = chatIndex.find(c => c.id === activeChatId);
                    if (chat) {
                        chat.updatedAt = Date.now();
                        await saveIndex();
                        renderSidebar();
                    }
                }

                async function autoTitleChat() {
                    if (!activeChatId) return;
                    const chat = chatIndex.find(c => c.id === activeChatId);
                    if (chat && chat.title === 'New Chat') {
                        const firstUserMsg = conversationHistory.find(m => m.role === 'user');
                        if (firstUserMsg?.content) {
                            let title = firstUserMsg.content.substring(0, 40);
                            if (firstUserMsg.content.length > 40) title += '...';
                            chat.title = title;
                            await saveIndex();
                            headerTitle.textContent = title;
                            renderSidebar();
                        }
                    }
                }

                async function generateAssistantResponse() {
                    if (isStreaming) return;
                    if (!isConfigured) {
                        EphemeraNotifications.error('API Key Required', 'Please configure your AI provider API key in Settings.');
                        return;
                    }

                    isStreaming = true;
                    sendBtn.disabled = true;
                    currentAbortController = new AbortController();
                    stopWrap.classList.add('visible');

                    showTypingIndicator();

                    const messages = [
                        {
                            role: 'system',
                            content: `You are a helpful AI assistant. Be concise, accurate, and friendly.
Use markdown formatting when helpful. For code, always use proper code blocks with language specification.
If the user asks about programming, provide clear, well-commented code examples.`
                        },
                        ...conversationHistory.filter(m => m.role !== 'system').slice(-20).map(m => ({ role: m.role, content: m.content }))
                    ];

                    let assistantContent = '';
                    const ts = Date.now();
                    let assistantDiv = null;

                    try {
                        await EphemeraAI.chat(
                            messages,
                            modelSelect.value || (EphemeraAI.getModelForUseCase ? EphemeraAI.getModelForUseCase('chat') : EphemeraAI.getDefaultModel()),
                            (chunk, full) => {
                                assistantContent = full;
                                hideTypingIndicator();
                                if (!assistantDiv) {
                                    const idx = conversationHistory.length;
                                    assistantDiv = appendMessage('assistant', full, idx, ts, true);
                                } else {
                                    const contentEl = assistantDiv.querySelector('.aichat-msg-content');
                                    contentEl.innerHTML = EphemeraSanitize.sanitizeHtml(formatAIResponse(full), SANITIZE_OPTS);
                                    attachCodeBlockHandlers(assistantDiv);
                                    assistantDiv.dataset.rawContent = full;
                                    scrollToBottom();
                                }
                            },
                            { signal: currentAbortController.signal }
                        );

                        if (assistantContent) {
                            conversationHistory.push({ role: 'assistant', content: assistantContent, timestamp: ts });
                            if (assistantDiv) {
                                const idx = conversationHistory.length - 1;
                                assistantDiv.dataset.msgIndex = idx;
                                assistantDiv.dataset.rawContent = assistantContent;
                                attachMessageActions(assistantDiv, idx, 'assistant', assistantContent);
                            }
                            await saveActiveChat();
                            await updateChatTimestamp();
                            await autoTitleChat();
                        }
                    } catch (error) {
                        hideTypingIndicator();
                        if (error.name === 'AbortError') {
                            if (assistantContent) {
                                conversationHistory.push({ role: 'assistant', content: assistantContent, timestamp: ts });
                                await saveActiveChat();
                                await updateChatTimestamp();
                            }
                        } else {
                            appendMessage('system', `Error: ${error.message}`, -1, Date.now(), true);
                        }
                    } finally {
                        isStreaming = false;
                        sendBtn.disabled = false;
                        currentAbortController = null;
                        stopWrap.classList.remove('visible');
                        input.focus();
                    }
                }

                async function sendMessage() {
                    const message = input.value.trim();
                    if (!message || isStreaming) return;

                    const welcomeEl = messagesContainer.querySelector('.aichat-welcome');
                    if (welcomeEl) welcomeEl.remove();

                    const ts = Date.now();
                    const idx = conversationHistory.length;
                    conversationHistory.push({ role: 'user', content: message, timestamp: ts });
                    appendMessage('user', message, idx, ts);

                    input.value = '';
                    input.style.height = 'auto';

                    await generateAssistantResponse();
                }

                // --- Utility ---

                function scrollToBottom() {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }

                function showTypingIndicator() {
                    const div = document.createElement('div');
                    div.className = 'aichat-typing';
                    div.id = `aichat-typing-${windowId}`;
                    div.innerHTML = '<span></span><span></span><span></span>';
                    messagesContainer.appendChild(div);
                    scrollToBottom();
                }

                function hideTypingIndicator() {
                    const el = document.getElementById(`aichat-typing-${windowId}`);
                    if (el) el.remove();
                }

                function attachSuggestionEvents() {
                    messagesContainer.querySelectorAll('.suggestion').forEach(el => {
                        el.addEventListener('click', () => {
                            input.value = el.textContent;
                            input.focus();
                        });
                    });
                }

                function exportConversation() {
                    if (conversationHistory.length === 0) {
                        EphemeraNotifications.info('Nothing to export', 'Start a conversation first.');
                        return;
                    }
                    let md = '# AI Chat Export\n\n';
                    conversationHistory.forEach(msg => {
                        if (msg.role === 'system') return;
                        const label = msg.role === 'user' ? 'You' : 'Assistant';
                        const time = msg.timestamp ? ` (${new Date(msg.timestamp).toLocaleString()})` : '';
                        md += `## ${label}${time}\n\n${msg.content}\n\n---\n\n`;
                    });
                    const blob = new Blob([md], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const chat = chatIndex.find(c => c.id === activeChatId);
                    const slug = chat?.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chat';
                    a.download = `${slug}-${new Date().toISOString().slice(0,10)}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                    EphemeraNotifications.success('Exported', 'Conversation exported as Markdown.');
                }

                // --- Event listeners ---

                lifecycle.addListener(input, 'input', () => {
                    input.style.height = 'auto';
                    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
                });

                lifecycle.addListener(input, 'keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });

                lifecycle.addListener(sendBtn, 'click', sendMessage);

                lifecycle.addListener(stopBtn, 'click', () => {
                    if (currentAbortController) {
                        currentAbortController.abort();
                    }
                });

                lifecycle.addListener(newChatBtn, 'click', createChat);

                lifecycle.addListener(toggleBtn, 'click', () => {
                    sidebarCollapsed = !sidebarCollapsed;
                    sidebar.classList.toggle('collapsed', sidebarCollapsed);
                });

                lifecycle.addListener(exportBtn, 'click', exportConversation);

                lifecycle.addListener(modelSelect, 'change', () => {
                    EphemeraState.updateSetting('aiModelChat', modelSelect.value);
                });

                attachSuggestionEvents();

                // --- Initialization ---
                await migrateOldHistory();
                await loadIndex();

                if (chatIndex.length > 0) {
                    const sorted = [...chatIndex].sort((a, b) => b.updatedAt - a.updatedAt);
                    await switchToChat(sorted[0].id);
                } else {
                    await createChat();
                }

                return {
                    destroy: () => {
                        if (currentAbortController) {
                            currentAbortController.abort();
                        }
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
