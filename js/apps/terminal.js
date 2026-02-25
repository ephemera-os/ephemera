EphemeraApps.register({
    id: 'terminal',
    name: 'Terminal',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    width: 700,
    height: 450,
    category: 'system',
    content: (windowId) => {
        const isMobileVariant = EphemeraState?.shellMode === 'mobile' || window.innerWidth < 768;
        return {
            html: `
                <style>
                    .terminal-container { display:flex;flex-direction:column;height:100%;background:var(--bg-primary);border-radius:var(--radius-md);overflow:hidden; }
                    .terminal-content { flex:1;overflow-y:auto;padding:16px;font-family:'JetBrains Mono',monospace;font-size:0.85rem;line-height:1.6; }
                    .terminal-line { margin-bottom:4px;white-space:pre-wrap;word-break:break-all; }
                    .terminal-prompt { color:var(--accent); }
                    .terminal-output { color:var(--fg-secondary); }
                    .terminal-error { color:var(--danger); }
                    .terminal-success { color:var(--success); }
                    .terminal-input-line { display:flex;align-items:center;padding:8px 16px;background:rgba(0,0,0,0.3);border-top:1px solid var(--border); }
                    .terminal-input { flex:1;background:transparent;border:none;color:var(--fg-primary);font-family:'JetBrains Mono',monospace;font-size:0.85rem;outline:none; }
                    .terminal-mobile-keys { display:none;gap:6px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(0,0,0,0.35);border-top:1px solid var(--border);flex-wrap:wrap; }
                    .terminal-mobile-keys .terminal-mobile-key { min-height:40px;min-width:40px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:var(--bg-tertiary);color:var(--fg-primary);font-family:'JetBrains Mono',monospace;font-size:0.8rem;cursor:pointer; }
                    .terminal-mobile-keys .terminal-mobile-key.ctrl-active { background:rgba(0,212,170,0.15);border-color:var(--accent);color:var(--accent); }
                    .terminal-mobile-keys .terminal-mobile-key.wide { min-width:64px; }
                    .terminal-container.terminal-mobile .terminal-content { padding:14px;font-size:0.9rem; }
                    .terminal-container.terminal-mobile .terminal-input-line { padding:10px 12px; }
                    .terminal-container.terminal-mobile .terminal-input { min-height:40px;font-size:0.95rem; }
                    .terminal-container.terminal-mobile .terminal-mobile-keys { display:flex; }
                </style>
                <div class="terminal-container ${isMobileVariant ? 'terminal-mobile' : ''}">
                    <div class="terminal-content" id="terminal-content-${windowId}">
                        <div class="terminal-line">Ephemera Terminal v2.0</div>
                        <div class="terminal-line terminal-output">Type "help" for available commands.</div>
                        <div class="terminal-line">&nbsp;</div>
                    </div>
                    <div class="terminal-input-line">
                        <span class="terminal-prompt" id="terminal-prompt-${windowId}">user@ephemera:~$ </span>
                        <input type="text" class="terminal-input" id="terminal-input-${windowId}" autofocus>
                    </div>
                    <div class="terminal-mobile-keys" id="terminal-mobile-keys-${windowId}" aria-label="Terminal keyboard shortcuts">
                        <button type="button" class="terminal-mobile-key wide" data-key="Tab">Tab</button>
                        <button type="button" class="terminal-mobile-key wide" data-key="Ctrl">Ctrl</button>
                        <button type="button" class="terminal-mobile-key" data-key="ArrowUp">↑</button>
                        <button type="button" class="terminal-mobile-key" data-key="ArrowDown">↓</button>
                        <button type="button" class="terminal-mobile-key" data-key="ArrowLeft">←</button>
                        <button type="button" class="terminal-mobile-key" data-key="ArrowRight">→</button>
                        <button type="button" class="terminal-mobile-key" data-key="/">/</button>
                        <button type="button" class="terminal-mobile-key" data-key="L">L</button>
                        <button type="button" class="terminal-mobile-key" data-key="C">C</button>
                        <button type="button" class="terminal-mobile-key wide" data-key="Enter">Enter</button>
                    </div>
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();

                const content = document.getElementById(`terminal-content-${windowId}`);
                const input = document.getElementById(`terminal-input-${windowId}`);
                const promptEl = document.getElementById(`terminal-prompt-${windowId}`);
                const mobileKeys = document.getElementById(`terminal-mobile-keys-${windowId}`);

                const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                let cwd = homeDir;
                let history = [];
                let historyIndex = -1;
                let ctrlArmed = false;
                let lastExecution = null;
                const terminalBackend = window.EphemeraTerminalBackend || null;
                let backendClient = null;
                let remoteMode = false;

                // Load persisted history
                try {
                    const saved = await EphemeraStorage.get('metadata', 'terminal_history');
                    if (saved && saved.value) {
                        history = saved.value;
                        historyIndex = history.length;
                    }
                } catch (_e) {
                    // Ignore missing/corrupt history
                }

                async function saveHistory() {
                    try {
                        await EphemeraStorage.put('metadata', { key: 'terminal_history', value: history.slice(-100) });
                    } catch (_e) {
                        // Ignore history persistence failures
                    }
                }

                function updatePrompt() {
                    const displayPath = cwd === homeDir ? '~' : cwd;
                    promptEl.textContent = `user@ephemera:${displayPath}$ `;
                }

                const MAX_LINES = 1000;
                const PRUNE_TO = 800;

                function pruneLines() {
                    const lines = content.querySelectorAll('.terminal-line');
                    if (lines.length > MAX_LINES) {
                        const toRemove = lines.length - PRUNE_TO;
                        for (let i = 0; i < toRemove; i++) {
                            lines[i].remove();
                        }
                    }
                }

                function addLine(text, className = '') {
                    const line = document.createElement('div');
                    line.className = 'terminal-line ' + className;
                    line.textContent = text;
                    content.appendChild(line);
                    pruneLines();
                    content.scrollTop = content.scrollHeight;
                }

                function addHTML(html) {
                    const line = document.createElement('div');
                    line.className = 'terminal-line';
                    line.innerHTML = html;
                    content.appendChild(line);
                    pruneLines();
                    content.scrollTop = content.scrollHeight;
                }

                function renderText(text, className = 'terminal-output') {
                    const message = String(text ?? '');
                    if (message.includes('\n')) {
                        addHTML(`<pre class="${className}">${EphemeraSanitize.escapeHtml(message)}</pre>`);
                    } else {
                        addLine(message, className);
                    }
                }

                function isRemoteConnected() {
                    return remoteMode && !!backendClient && typeof backendClient.isConnected === 'function' && backendClient.isConnected();
                }

                function handleRemoteBackendMessage(payload) {
                    if (payload === null || payload === undefined) return;

                    if (typeof payload === 'string') {
                        if (payload.trim()) renderText(payload, 'terminal-output');
                        return;
                    }

                    if (typeof payload !== 'object') {
                        renderText(String(payload), 'terminal-output');
                        return;
                    }

                    const type = String(payload.type || '').toLowerCase();

                    if (typeof payload.cwd === 'string' && payload.cwd) {
                        cwd = payload.cwd;
                        updatePrompt();
                    }

                    if (type === 'prompt' && typeof payload.prompt === 'string') {
                        promptEl.textContent = payload.prompt;
                        return;
                    }

                    if (type === 'stderr' || type === 'error') {
                        const msg = payload.data || payload.error || payload.message || '';
                        if (msg) renderText(msg, 'terminal-error');
                        return;
                    }

                    if (type === 'status' || type === 'info') {
                        const msg = payload.message || payload.data || '';
                        if (msg) renderText(msg, 'terminal-output');
                        return;
                    }

                    const output = payload.data ?? payload.output ?? payload.message;
                    if (output !== undefined && output !== null && String(output).length > 0) {
                        renderText(output, 'terminal-output');
                    }
                }

                function stopRemoteMode(announce = true) {
                    const wasRemote = remoteMode;
                    remoteMode = false;
                    if (backendClient) {
                        if (typeof backendClient.close === 'function') {
                            backendClient.close(1000, 'ephemera-terminal-local-mode');
                        }
                        backendClient = null;
                    }
                    updatePrompt();
                    if (announce && wasRemote) {
                        addLine('Switched to local simulated terminal mode.', 'terminal-output');
                    }
                }

                async function connectRemoteMode(options = {}) {
                    const announce = options.announce !== false;
                    const silentFailure = options.silentFailure === true;

                    if (!terminalBackend || typeof terminalBackend.createClient !== 'function') {
                        return { ok: false, error: 'Terminal backend module is unavailable' };
                    }

                    if (typeof terminalBackend.isConfigured !== 'function' || !terminalBackend.isConfigured()) {
                        return { ok: false, error: 'Terminal backend is not configured' };
                    }

                    if (isRemoteConnected()) {
                        if (announce) {
                            addLine(`Real terminal already connected (${backendClient.getUrl()}).`, 'terminal-success');
                        }
                        return { ok: true };
                    }

                    if (backendClient && typeof backendClient.close === 'function') {
                        backendClient.close(1000, 'ephemera-terminal-reconnect');
                    }

                    backendClient = terminalBackend.createClient();
                    if (!backendClient || typeof backendClient.connect !== 'function') {
                        backendClient = null;
                        return { ok: false, error: 'Failed to create terminal backend client' };
                    }

                    if (typeof backendClient.on === 'function') {
                        backendClient.on('message', handleRemoteBackendMessage);
                        backendClient.on('close', (event) => {
                            const code = Number(event?.code);
                            const hasCode = Number.isFinite(code) && code > 0;
                            const reason = String(event?.reason || '').trim();
                            const details = [
                                hasCode ? `code ${code}` : '',
                                reason ? `reason: ${reason}` : ''
                            ].filter(Boolean).join(', ');

                            const wasRemote = remoteMode;
                            remoteMode = false;
                            backendClient = null;
                            updatePrompt();

                            if (wasRemote) {
                                addLine(
                                    `Real terminal disconnected${details ? ` (${details})` : ''}. Falling back to local simulation.`,
                                    'terminal-error'
                                );
                            }
                        });
                        backendClient.on('error', (event) => {
                            const message = String(event?.message || '').trim();
                            if (message) {
                                addLine(`Real terminal error: ${message}`, 'terminal-error');
                            }
                        });
                    }

                    const result = await backendClient.connect();
                    if (result.ok) {
                        remoteMode = true;
                        if (announce) {
                            addLine(`Connected to real terminal backend: ${backendClient.getUrl()}`, 'terminal-success');
                        }
                        return result;
                    }

                    remoteMode = false;
                    backendClient = null;
                    updatePrompt();

                    if (!silentFailure) {
                        addLine(
                            `Real terminal unavailable: ${result.error || 'connection failed'}. Using local simulation.`,
                            'terminal-error'
                        );
                    }
                    return result;
                }

                async function handleBackendCommand(args = []) {
                    const action = String(args[0] || 'status').toLowerCase();
                    const backendConfig = terminalBackend?.getConfig?.() || { enabled: false, url: '' };
                    const configured = terminalBackend?.isConfigured?.() === true;
                    const connected = isRemoteConnected();

                    if (action === 'status') {
                        const mode = connected ? 'remote' : 'local';
                        return [
                            `Mode: ${mode}`,
                            `Backend enabled: ${backendConfig.enabled ? 'yes' : 'no'}`,
                            `Backend URL: ${backendConfig.url || '(not set)'}`,
                            `Backend configured: ${configured ? 'yes' : 'no'}`,
                            `Backend connection: ${connected ? 'connected' : 'disconnected'}`
                        ].join('\n');
                    }

                    if (action === 'connect' || action === 'remote') {
                        const result = await connectRemoteMode({ announce: false, silentFailure: true });
                        if (result.ok) {
                            return `Connected to real terminal backend: ${backendClient.getUrl()}`;
                        }
                        return `Backend connect failed: ${result.error || 'unknown error'}`;
                    }

                    if (action === 'disconnect' || action === 'local') {
                        stopRemoteMode(false);
                        return 'Switched to local simulated terminal mode';
                    }

                    if (action === 'test') {
                        if (!terminalBackend || typeof terminalBackend.testConnection !== 'function') {
                            return 'Backend test is unavailable';
                        }
                        if (!backendConfig.url) {
                            return 'Backend URL is not set. Configure it in Settings > Network.';
                        }
                        const result = await terminalBackend.testConnection(backendConfig.url);
                        return result.ok
                            ? `Backend connection test succeeded: ${backendConfig.url}`
                            : `Backend connection test failed: ${result.error || 'unknown error'}`;
                    }

                    return 'Usage: backend [status|connect|disconnect|test|local|remote]';
                }

                // Tokenizer supporting single/double quotes and escape characters
                function tokenize(str) {
                    const tokens = [];
                    let current = '';
                    let inSingle = false;
                    let inDouble = false;
                    let escape = false;

                    for (let i = 0; i < str.length; i++) {
                        const ch = str[i];
                        if (escape) {
                            current += ch;
                            escape = false;
                            continue;
                        }
                        if (ch === '\\') {
                            escape = true;
                            continue;
                        }
                        if (ch === "'" && !inDouble) {
                            inSingle = !inSingle;
                            continue;
                        }
                        if (ch === '"' && !inSingle) {
                            inDouble = !inDouble;
                            continue;
                        }
                        if (ch === ' ' && !inSingle && !inDouble) {
                            if (current) {
                                tokens.push(current);
                                current = '';
                            }
                            continue;
                        }
                        current += ch;
                    }
                    if (current) tokens.push(current);
                    return tokens;
                }

                // Safe math parser for calc command
                function safeCalc(expr) {
                    const tokens = [];
                    let i = 0;
                    expr = expr.replace(/\s+/g, '');

                    function parseNumber() {
                        let num = '';
                        if (expr[i] === '-' && (tokens.length === 0 || tokens[tokens.length - 1] === '(')) {
                            num += '-';
                            i++;
                        }
                        while (i < expr.length && (expr[i] >= '0' && expr[i] <= '9' || expr[i] === '.')) {
                            num += expr[i++];
                        }
                        return parseFloat(num);
                    }

                    function parseFactor() {
                        if (expr[i] === '(') {
                            i++; // skip (
                            const val = parseExpression();
                            i++; // skip )
                            return val;
                        }
                        // Check for Math functions
                        const funcs = ['sqrt', 'abs', 'sin', 'cos', 'tan', 'log', 'ceil', 'floor', 'round', 'pow'];
                        for (const fn of funcs) {
                            if (expr.slice(i, i + fn.length) === fn) {
                                i += fn.length;
                                if (expr[i] === '(') {
                                    i++;
                                    const arg = parseExpression();
                                    let arg2;
                                    if (fn === 'pow' && expr[i] === ',') {
                                        i++;
                                        arg2 = parseExpression();
                                    }
                                    i++; // skip )
                                    return arg2 !== undefined ? Math[fn](arg, arg2) : Math[fn](arg);
                                }
                            }
                        }
                        if (expr.slice(i, i + 2) === 'PI') { i += 2; return Math.PI; }
                        if (expr.slice(i, i + 1) === 'E' && (i + 1 >= expr.length || '+-*/%()'.includes(expr[i + 1]))) { i += 1; return Math.E; }
                        return parseNumber();
                    }

                    function parsePower() {
                        let left = parseFactor();
                        while (i < expr.length && expr[i] === '^') {
                            i++;
                            left = Math.pow(left, parseFactor());
                        }
                        return left;
                    }

                    function parseTerm() {
                        let left = parsePower();
                        while (i < expr.length && (expr[i] === '*' || expr[i] === '/' || expr[i] === '%')) {
                            const op = expr[i++];
                            const right = parsePower();
                            if (op === '*') left *= right;
                            else if (op === '/') left /= right;
                            else left %= right;
                        }
                        return left;
                    }

                    function parseExpression() {
                        let left = parseTerm();
                        while (i < expr.length && (expr[i] === '+' || expr[i] === '-') && expr[i - 1] !== '(') {
                            const op = expr[i++];
                            const right = parseTerm();
                            if (op === '+') left += right;
                            else left -= right;
                        }
                        return left;
                    }

                    try {
                        const result = parseExpression();
                        if (isNaN(result)) return 'Error: Invalid expression';
                        return String(result);
                    } catch {
                        return 'Error: Invalid expression';
                    }
                }

                const commands = {
                    help: () => {
                        return `Available commands:
  help              - Show this help message
  clear             - Clear terminal screen
  pwd               - Print working directory
  cd <dir>          - Change directory
  ls [dir]          - List directory contents
  cat <file>        - Display file contents
  mkdir <name>      - Create directory
  touch <name>      - Create empty file
  rm <path>         - Remove file or directory
  cp <src> <dest>   - Copy file
  mv <src> <dest>   - Move/rename file
  echo <text>       - Print text
  date              - Show current date/time
  whoami            - Display current user
  neofetch          - Display system info
  curl <url>        - Fetch URL content (requires proxy)
  proxy [on|off]    - Toggle CORS proxy
  backend <action>  - Manage real terminal backend (status/connect/disconnect)
  run <file.js>     - Execute JavaScript file (sandboxed)
  app create <name> - Create new app scaffold
  app list          - List installed apps
  calc <expr>       - Calculate math expression

AI helpers:
  !! explain        - Explain the last command (or diagnose last error)
  <natural language>- Unknown phrases get AI command suggestions`;
                    },

                    clear: () => { content.innerHTML = ''; return null; },

                    pwd: () => cwd,

                    cd: async (args) => {
                        if (!args[0] || args[0] === '~') {
                            cwd = homeDir;
                        } else if (args[0] === '..') {
                            cwd = EphemeraFS.getParentDir(cwd);
                        } else if (args[0].startsWith('/')) {
                            const stat = await EphemeraFS.stat(args[0]);
                            if (stat && stat.type === 'directory') {
                                cwd = args[0];
                            } else {
                                return `cd: ${args[0]}: No such directory`;
                            }
                        } else {
                            const newPath = EphemeraFS.normalizePath(cwd + '/' + args[0]);
                            const stat = await EphemeraFS.stat(newPath);
                            if (stat && stat.type === 'directory') {
                                cwd = newPath;
                            } else {
                                return `cd: ${args[0]}: No such directory`;
                            }
                        }
                        updatePrompt();
                        return null;
                    },

                    ls: async (args) => {
                        const path = args[0] ? (args[0].startsWith('/') ? args[0] : cwd + '/' + args[0]) : cwd;
                        const normalizedPath = EphemeraFS.normalizePath(path);
                        const files = await EphemeraFS.readdir(normalizedPath);

                        if (files.length === 0) return '(empty)';

                        return files.map(f => {
                            const prefix = f.type === 'directory' ? '\u{1F4C1} ' : '\u{1F4C4} ';
                            return prefix + f.name;
                        }).join('\n');
                    },

                    cat: async (args) => {
                        if (!args[0]) return 'Usage: cat <file>';
                        const path = args[0].startsWith('/') ? args[0] : cwd + '/' + args[0];
                        const fileContent = await EphemeraFS.readFile(EphemeraFS.normalizePath(path));
                        if (fileContent === null) return `cat: ${args[0]}: No such file`;
                        return fileContent;
                    },

                    mkdir: async (args) => {
                        if (!args[0]) return 'Usage: mkdir <name>';
                        const path = args[0].startsWith('/') ? args[0] : cwd + '/' + args[0];
                        await EphemeraFS.mkdir(EphemeraFS.normalizePath(path));
                        return `Created directory: ${args[0]}`;
                    },

                    touch: async (args) => {
                        if (!args[0]) return 'Usage: touch <name>';
                        const path = args[0].startsWith('/') ? args[0] : cwd + '/' + args[0];
                        await EphemeraFS.writeFile(EphemeraFS.normalizePath(path), '');
                        return `Created file: ${args[0]}`;
                    },

                    rm: async (args) => {
                        if (!args[0]) return 'Usage: rm <path>';
                        const path = args[0].startsWith('/') ? args[0] : cwd + '/' + args[0];
                        const deleted = await EphemeraFS.delete(EphemeraFS.normalizePath(path));
                        return deleted ? `Removed: ${args[0]}` : `rm: ${args[0]}: No such file or directory`;
                    },

                    cp: async (args) => {
                        if (args.length < 2) return 'Usage: cp <source> <dest>';
                        const src = args[0].startsWith('/') ? args[0] : cwd + '/' + args[0];
                        const dest = args[1].startsWith('/') ? args[1] : cwd + '/' + args[1];
                        await EphemeraFS.copy(EphemeraFS.normalizePath(src), EphemeraFS.normalizePath(dest));
                        return `Copied: ${args[0]} -> ${args[1]}`;
                    },

                    mv: async (args) => {
                        if (args.length < 2) return 'Usage: mv <source> <dest>';
                        const src = args[0].startsWith('/') ? args[0] : cwd + '/' + args[0];
                        const dest = args[1].startsWith('/') ? args[1] : cwd + '/' + args[1];
                        await EphemeraFS.move(EphemeraFS.normalizePath(src), EphemeraFS.normalizePath(dest));
                        return `Moved: ${args[0]} -> ${args[1]}`;
                    },

                    echo: (args) => args.join(' '),

                    date: () => new Date().toLocaleString(),

                    whoami: () => EphemeraState.user.name,

                    neofetch: () => {
                        return `
 \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510   OS: Ephemera v2.0
 \u2502    Ephemera       \u2502   Host: Browser (${navigator.userAgent.split(' ').pop()})
 \u2502    \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588      \u2502   Kernel: JavaScript ES2023
 \u2502  \u2588\u2588        \u2588\u2588    \u2502   Shell: EphemeraShell
 \u2502 \u2588  \u25CF    \u25CF  \u2588     \u2502   Resolution: ${window.innerWidth}x${window.innerHeight}
 \u2502 \u2588    \u25BD    \u2588      \u2502   Theme: Dark Teal
 \u2502  \u2588\u2588      \u2588\u2588      \u2502   Storage: IndexedDB
 \u2502    \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588      \u2502   Apps: ${EphemeraApps.getAll().length}
 \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518   Workspaces: 4`;
                    },

                    curl: async (args) => {
                        if (!args[0]) return 'Usage: curl <url>';
                        try {
                            addLine(`Fetching ${args[0]}...`, 'terminal-output');
                            const response = await EphemeraNetwork.get(args[0]);
                            return response.substring(0, 5000) + (response.length > 5000 ? '\n... (truncated)' : '');
                        } catch (e) {
                            if (e.message === 'CORS_ERROR') {
                                return EphemeraNetwork.formatCORSMessage();
                            }
                            return `curl: ${e.message}`;
                        }
                    },

                    run: async (args) => {
                        if (!args[0]) return 'Usage: run <file.js>';
                        const path = args[0].startsWith('/') ? args[0] : cwd + '/' + args[0];
                        const code = await EphemeraFS.readFile(EphemeraFS.normalizePath(path));
                        if (code === null) return `run: ${args[0]}: No such file`;

                        // Run in sandboxed iframe
                        return new Promise((resolve) => {
                            const iframe = document.createElement('iframe');
                            iframe.setAttribute('sandbox', 'allow-scripts');
                            iframe.style.display = 'none';
                            document.body.appendChild(iframe);

                            const handler = (e) => {
                                if (e.source !== iframe.contentWindow) return;
                                if (e.data && e.data.type === 'ephemera-run-result') {
                                    window.removeEventListener('message', handler);
                                    iframe.remove();
                                    resolve(e.data.result || 'Executed successfully');
                                }
                            };
                            window.addEventListener('message', handler);

                            const baseUrl = import.meta.env?.BASE_URL || '/';
                            const sandboxUrl = new URL(`${baseUrl}sandbox/run.html`, window.location.href);
                            sandboxUrl.searchParams.set('parentOrigin', window.location.origin);
                            iframe.addEventListener('load', () => {
                                iframe.contentWindow?.postMessage({
                                    type: 'ephemera-run',
                                    code: String(code || '')
                                }, '*');
                            }, { once: true });
                            iframe.src = sandboxUrl.toString();

                            setTimeout(() => {
                                window.removeEventListener('message', handler);
                                iframe.remove();
                                resolve('Error: Execution timeout');
                            }, 5000);
                        });
                    },

                    app: async (args) => {
                        if (args[0] === 'create') {
                            if (!args[1]) return 'Usage: app create <name>';
                            const appDir = `${homeDir}/apps/${args[1]}`;
                            await EphemeraFS.mkdir(appDir);

                            const manifest = EphemeraApps.createManifestTemplate();
                            manifest.id = `com.user.${args[1].toLowerCase().replace(/[^a-z0-9]/g, '')}`;
                            manifest.name = args[1];

                            await EphemeraFS.writeFile(`${appDir}/app.json`, JSON.stringify(manifest, null, 2));
                            await EphemeraFS.writeFile(`${appDir}/app.js`, EphemeraApps.createCodeTemplate());

                            return `Created app scaffold at ${appDir}/\nEdit app.json and app.js, then use "app install ${appDir}"`;
                        }

                        if (args[0] === 'list') {
                            const apps = EphemeraApps.getAll();
                            return apps.map(a => `  ${a.id} - ${a.name} (${a.category})`).join('\n') || 'No apps installed';
                        }

                        if (args[0] === 'install') {
                            if (!args[1]) return 'Usage: app install <app-directory>';
                            const manifestPath = `${args[1]}/app.json`;
                            const codePath = `${args[1]}/app.js`;

                            const manifestJson = await EphemeraFS.readFile(manifestPath);
                            const code = await EphemeraFS.readFile(codePath);

                            if (!manifestJson) return `Manifest not found: ${manifestPath}`;
                            if (!code) return `Code not found: ${codePath}`;

                            try {
                                const manifest = JSON.parse(manifestJson);
                                await EphemeraApps.installApp(manifest, code);
                                return `App "${manifest.name}" installed successfully!`;
                            } catch (e) {
                                return `Failed to install app: ${e.message}`;
                            }
                        }

                        return 'Usage: app [create|list|install] <args>';
                    },

                    calc: (args) => {
                        if (!args.length) return 'Usage: calc <expression>';
                        return safeCalc(args.join(''));
                    },

                    proxy: (args) => {
                        if (!args[0]) {
                            const status = EphemeraNetwork.isProxyEnabled() ? 'enabled' : 'disabled';
                            const url = EphemeraState.settings.proxyUrl || 'default';
                            return `Proxy: ${status}\nURL: ${url}`;
                        }
                        if (args[0] === 'on' || args[0] === 'enable') {
                            EphemeraState.updateSetting('proxyEnabled', true);
                            return 'Proxy enabled';
                        }
                        if (args[0] === 'off' || args[0] === 'disable') {
                            EphemeraState.updateSetting('proxyEnabled', false);
                            return 'Proxy disabled';
                        }
                        return 'Usage: proxy [on|off]';
                    },

                    backend: async (args) => {
                        return handleBackendCommand(args);
                    }
                };

                function isFailureResult(command, result) {
                    if (typeof result !== 'string') return false;
                    const text = result.trim().toLowerCase();
                    if (!text) return false;
                    if (text.startsWith('error:')) return true;
                    if (text.startsWith('failed')) return true;
                    if (text.startsWith('usage:')) return true;
                    if (text.includes('no such file') || text.includes('no such directory')) return true;
                    if (command && text.startsWith(`${command.toLowerCase()}:`)) return true;
                    return false;
                }

                async function canUseAI() {
                    if (!window.EphemeraAI) return false;
                    if (typeof EphemeraAI.isConfigured !== 'function') return false;
                    try {
                        return await EphemeraAI.isConfigured();
                    } catch (_e) {
                        return false;
                    }
                }

                function storeExecution(execution) {
                    lastExecution = {
                        ...execution,
                        cwdAfter: cwd,
                        timestamp: Date.now()
                    };
                }

                function offerErrorHelpHint() {
                    addLine('Tip: run "!! explain" for AI diagnosis of the last command.', 'terminal-output');
                }

                async function suggestCommandFromNaturalLanguage(request) {
                    if (!window.EphemeraAI || typeof EphemeraAI.suggestTerminalCommand !== 'function') return '';
                    const trimmed = String(request || '').trim();
                    if (!trimmed) return '';
                    if (trimmed.split(/\s+/).length < 3) return '';
                    if (!(await canUseAI())) return '';
                    try {
                        return await EphemeraAI.suggestTerminalCommand(trimmed, { cwd, homeDir });
                    } catch (_e) {
                        return '';
                    }
                }

                async function explainLastExecution() {
                    if (!lastExecution) {
                        addLine('Nothing to explain yet. Run a command first.', 'terminal-output');
                        return;
                    }
                    if (!window.EphemeraAI) {
                        const verdict = lastExecution.success ? 'succeeded' : 'failed';
                        addLine(`Last command "${lastExecution.rawCommand}" ${verdict}.`, 'terminal-output');
                        return;
                    }
                    if (!(await canUseAI())) {
                        addLine('AI is not configured. Add API key in Settings to use !! explain.', 'terminal-error');
                        return;
                    }

                    try {
                        addLine('Asking AI to explain last command...', 'terminal-output');
                        const text = lastExecution.success
                            ? await EphemeraAI.explainTerminalExecution(lastExecution)
                            : await EphemeraAI.diagnoseTerminalError(lastExecution);
                        const safe = String(text || '').trim() || 'No explanation returned.';
                        if (safe.includes('\n')) {
                            addHTML(`<pre class="terminal-output">${EphemeraSanitize.escapeHtml(safe)}</pre>`);
                        } else {
                            addLine(safe, 'terminal-output');
                        }
                    } catch (e) {
                        addLine(`AI explain failed: ${e.message}`, 'terminal-error');
                    }
                }

                async function runCommandFromInput() {
                    const cmd = input.value.trim();
                    input.value = '';

                    if (cmd) {
                        history.push(cmd);
                        historyIndex = history.length;
                        saveHistory();
                    }

                    const escapedCmd = EphemeraSanitize.escapeHtml(cmd);
                    addHTML(`<span class="terminal-prompt">${EphemeraSanitize.escapeHtml(promptEl.textContent)}</span>${escapedCmd}`);

                    if (!cmd) return;

                    const lowerCmd = cmd.toLowerCase();
                    if (lowerCmd === '!! explain' || lowerCmd === '!!explain') {
                        await explainLastExecution();
                        return;
                    }

                    const parts = tokenize(cmd);
                    const command = parts[0]?.toLowerCase();
                    const args = parts.slice(1);
                    const cwdBefore = cwd;

                    if (isRemoteConnected() && command !== 'backend') {
                        const sent = backendClient.send(`${cmd}\n`);
                        if (sent.ok) {
                            storeExecution({
                                rawCommand: cmd,
                                command,
                                args,
                                cwdBefore,
                                success: true,
                                output: '[sent to remote backend]',
                                error: ''
                            });
                            return;
                        }

                        addLine(`Real terminal send failed: ${sent.error || 'unknown error'}`, 'terminal-error');
                        stopRemoteMode(false);
                        addLine('Falling back to local simulated terminal for this command.', 'terminal-output');
                    }

                    if (!commands[command]) {
                        const errText = `Command not found: ${command}`;
                        addLine(errText, 'terminal-error');

                        const suggestion = await suggestCommandFromNaturalLanguage(cmd);
                        if (suggestion) {
                            addLine(`AI suggestion: ${suggestion}`, 'terminal-success');
                            input.value = suggestion;
                            addLine('Press Enter to run the suggested command.', 'terminal-output');
                        }

                        storeExecution({
                            rawCommand: cmd,
                            command,
                            args,
                            cwdBefore,
                            success: false,
                            output: '',
                            error: errText
                        });
                        offerErrorHelpHint();
                        return;
                    }

                    try {
                        const result = await commands[command](args);
                        const failed = isFailureResult(command, result);
                        const outputText = result === null || result === undefined ? '' : String(result);
                        if (result !== null && result !== undefined) {
                            if (typeof result === 'string' && result.includes('\n')) {
                                addHTML(`<pre class="${failed ? 'terminal-error' : 'terminal-output'}">${EphemeraSanitize.escapeHtml(result)}</pre>`);
                            } else {
                                addLine(result, failed ? 'terminal-error' : 'terminal-output');
                            }
                        }
                        storeExecution({
                            rawCommand: cmd,
                            command,
                            args,
                            cwdBefore,
                            success: !failed,
                            output: outputText,
                            error: failed ? outputText : ''
                        });
                        if (failed) offerErrorHelpHint();
                    } catch (err) {
                        const errText = `Error: ${err.message}`;
                        addLine(errText, 'terminal-error');
                        storeExecution({
                            rawCommand: cmd,
                            command,
                            args,
                            cwdBefore,
                            success: false,
                            output: '',
                            error: errText
                        });
                        offerErrorHelpHint();
                    }
                }

                function moveHistoryUp() {
                    if (historyIndex > 0) {
                        historyIndex--;
                        input.value = history[historyIndex];
                    }
                }

                function moveHistoryDown() {
                    if (historyIndex < history.length - 1) {
                        historyIndex++;
                        input.value = history[historyIndex];
                    } else {
                        historyIndex = history.length;
                        input.value = '';
                    }
                }

                async function handleTabCompletion() {
                    const parts = input.value.split(' ');
                    const lastPart = parts[parts.length - 1];
                    if (!lastPart) return;

                    const files = await EphemeraFS.readdir(cwd);
                    const matches = files.filter(f => f.name.startsWith(lastPart));
                    if (matches.length === 1) {
                        parts[parts.length - 1] = matches[0].name;
                        input.value = parts.join(' ');
                    } else if (matches.length > 1) {
                        addLine(matches.map(m => m.name).join('  '), 'terminal-output');
                    }
                }

                function insertAtCursor(text) {
                    const start = input.selectionStart ?? input.value.length;
                    const end = input.selectionEnd ?? input.value.length;
                    input.value = input.value.slice(0, start) + text + input.value.slice(end);
                    const nextPos = start + text.length;
                    input.setSelectionRange(nextPos, nextPos);
                }

                function clearTerminal() {
                    content.innerHTML = '';
                }

                function interruptInput() {
                    addLine('^C', 'terminal-error');
                    if (isRemoteConnected()) {
                        backendClient.send('\u0003');
                    }
                    input.value = '';
                }

                async function applyVirtualKey(key, ctrlKey = false) {
                    if (ctrlKey && key.toLowerCase() === 'l') {
                        clearTerminal();
                        return;
                    }
                    if (ctrlKey && key.toLowerCase() === 'c') {
                        interruptInput();
                        return;
                    }

                    if (key === 'Enter') {
                        await runCommandFromInput();
                        return;
                    }
                    if (key === 'Tab') {
                        await handleTabCompletion();
                        return;
                    }
                    if (key === 'ArrowUp') {
                        moveHistoryUp();
                        return;
                    }
                    if (key === 'ArrowDown') {
                        moveHistoryDown();
                        return;
                    }
                    if (key === 'ArrowLeft') {
                        const pos = input.selectionStart ?? 0;
                        const next = Math.max(0, pos - 1);
                        input.setSelectionRange(next, next);
                        return;
                    }
                    if (key === 'ArrowRight') {
                        const pos = input.selectionStart ?? input.value.length;
                        const next = Math.min(input.value.length, pos + 1);
                        input.setSelectionRange(next, next);
                        return;
                    }
                    if (key.length === 1 && !ctrlKey) {
                        insertAtCursor(key);
                    }
                }

                lifecycle.addListener(input, 'keydown', async (e) => {
                    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
                        e.preventDefault();
                        clearTerminal();
                        return;
                    }
                    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
                        e.preventDefault();
                        interruptInput();
                        return;
                    }
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        await runCommandFromInput();
                        return;
                    }
                    if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        moveHistoryUp();
                        return;
                    }
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        moveHistoryDown();
                        return;
                    }
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        await handleTabCompletion();
                    }
                });

                if (mobileKeys) {
                    lifecycle.addListener(mobileKeys, 'click', async (e) => {
                        const keyBtn = e.target.closest('.terminal-mobile-key');
                        if (!keyBtn) return;
                        const key = keyBtn.dataset.key;
                        if (!key) return;

                        input.focus();

                        if (key === 'Ctrl') {
                            ctrlArmed = !ctrlArmed;
                            keyBtn.classList.toggle('ctrl-active', ctrlArmed);
                            return;
                        }

                        const useCtrl = ctrlArmed;
                        ctrlArmed = false;
                        const ctrlBtn = mobileKeys.querySelector('[data-key="Ctrl"]');
                        if (ctrlBtn) ctrlBtn.classList.remove('ctrl-active');

                        await applyVirtualKey(key, useCtrl);
                    });
                }

                if (terminalBackend?.isConfigured?.()) {
                    const bootstrapRemote = await connectRemoteMode({ announce: true, silentFailure: true });
                    if (!bootstrapRemote.ok) {
                        addLine(
                            `Real terminal unavailable: ${bootstrapRemote.error || 'connection failed'}. Using local simulation.`,
                            'terminal-output'
                        );
                    }
                }

                input.focus();
                lifecycle.addListener(content.parentElement, 'click', () => input.focus());

                return {
                    destroy: () => {
                        stopRemoteMode(false);
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
