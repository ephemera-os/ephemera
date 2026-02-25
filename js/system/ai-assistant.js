const QUICK_ACTION_TEMPLATES = new Map([
    ['summarize this file', 'Summarize the active file in concise bullet points with key takeaways.'],
    ['fix this code', 'Review the active code and provide a corrected version plus a short explanation.'],
    ['write a reply to this note', 'Write a polished reply based on the selected note text.'],
    ['create a to-do from this email', 'Extract actionable TODO items from the selected text.'],
    ['translate to french', 'Translate the selected text to French while preserving tone and intent.']
]);

const MAX_CONTEXT_CHARS = 12000;
const MAX_FILE_RESULTS = 10;
const MAX_FILE_SCAN_COUNT = 400;
const MAX_CONTENT_SCAN_COUNT = 160;
const FILE_QUERY_STOP_WORDS = new Set([
    'a', 'about', 'all', 'an', 'and', 'are', 'around', 'at', 'be', 'by', 'document',
    'documents', 'edited', 'files', 'file', 'find', 'for', 'from', 'get', 'i', 'in',
    'is', 'it', 'last', 'list', 'locate', 'me', 'my', 'of', 'on', 'recent', 'recently',
    'related', 'search', 'show', 'that', 'the', 'this', 'to', 'week', 'where', 'with'
]);

const FILE_SEMANTIC_SYNONYMS = new Map([
    ['auth', ['authentication', 'authorize', 'login', 'signin', 'password', 'session', 'token', 'oauth', 'jwt']],
    ['authentication', ['auth', 'authorize', 'login', 'signin', 'password', 'session', 'token', 'oauth', 'jwt']],
    ['login', ['signin', 'auth', 'authentication', 'session', 'password']],
    ['signin', ['login', 'auth', 'authentication', 'session', 'password']],
    ['account', ['user', 'profile', 'auth', 'login', 'session']],
    ['permission', ['access', 'role', 'policy', 'authorization']],
    ['security', ['auth', 'token', 'encryption', 'password', 'session']]
]);

const APP_BUILDER_CATEGORIES = new Set([
    'user', 'productivity', 'utility', 'development', 'creative', 'media', 'internet', 'games'
]);

const EphemeraAIAssistant = {
    _initialized: false,
    _mode: 'default',
    _providers: new Map(),
    _overlay: null,
    _panel: null,
    _input: null,
    _contextSummary: null,
    _result: null,
    _status: null,
    _sendBtn: null,
    _insertBtn: null,
    _copyBtn: null,
    _saveBtn: null,
    _activeRequestId: 0,
    _lastResponse: '',
    _lastContext: null,
    _lastFocusedElement: null,
    _documentKeydownHandler: null,
    _fileSearchPanel: null,
    _fileSearchResults: null,
    _fileSearchPreviewTitle: null,
    _fileSearchPreviewMeta: null,
    _fileSearchPreviewSummary: null,
    _fileSearchOpenBtn: null,
    _fileSearchState: null,
    _filePreviewRequestId: 0,
    _lastBuiltApp: null,

    init() {
        if (this._initialized) return;
        this._render();
        this._attachEvents();
        this._initialized = true;
    },

    registerContextProvider(windowId, provider) {
        const numericWindowId = Number(windowId);
        if (!Number.isFinite(numericWindowId)) return () => {};
        if (typeof provider !== 'function') return () => {};
        this._providers.set(numericWindowId, provider);
        return () => this.unregisterContextProvider(numericWindowId);
    },

    unregisterContextProvider(windowId) {
        const numericWindowId = Number(windowId);
        if (!Number.isFinite(numericWindowId)) return;
        this._providers.delete(numericWindowId);
    },

    isOpen() {
        return !!(this._overlay && this._overlay.style.display !== 'none');
    },

    open(prefill = '') {
        this.init();
        this._lastFocusedElement = document.activeElement;
        this._updateContextSummary();
        if (prefill) this._input.value = String(prefill);
        this._overlay.style.display = 'flex';
        this._overlay.classList.add('open');
        this._input.focus();
    },

    close() {
        if (!this._overlay) return;
        this._overlay.classList.remove('open');
        this._overlay.style.display = 'none';
        this._setStatus('', 'info');
        if (this._lastFocusedElement && typeof this._lastFocusedElement.focus === 'function') {
            try {
                this._lastFocusedElement.focus();
            } catch (_e) {
                // Ignore focus restoration failures.
            }
        }
    },

    toggle() {
        if (this.isOpen()) this.close();
        else this.open();
    },

    async submit(promptOverride = '') {
        const prompt = String(promptOverride || this._input?.value || '').trim();
        if (!prompt) return;

        if (!window.EphemeraAI || typeof EphemeraAI.chat !== 'function') {
            this._setStatus('AI engine is unavailable.', 'error');
            return;
        }

        if (typeof EphemeraAI.isConfigured === 'function') {
            const configured = await EphemeraAI.isConfigured();
            if (!configured) {
                this._setStatus('Configure your AI API key in Settings first.', 'error');
                this._notify('error', 'AI Not Configured', 'Open Settings and add your AI provider API key.');
                return;
            }
        }

        const context = this.getActiveContext();
        this._lastContext = context;
        this._setBusy(true);
        this._setStatus('Thinking...', 'info');
        this._renderResult('Thinking...');

        const requestId = ++this._activeRequestId;
        try {
            if (this._isAppBuilderPrompt(prompt)) {
                await this._submitAppBuilder(prompt, context, requestId);
                if (requestId !== this._activeRequestId) return;
                if (this._input) this._input.value = '';
                return;
            }

            if (this._isFileSearchPrompt(prompt)) {
                await this._submitFileSearch(prompt, requestId);
                if (requestId !== this._activeRequestId) return;
                this._setStatus('Done', 'ok');
                if (this._input) this._input.value = '';
                return;
            }

            this._setMode('default');
            const messages = this._buildMessages(prompt, context);
            const model = (typeof EphemeraAI.getModelForUseCase === 'function')
                ? EphemeraAI.getModelForUseCase('quickActions')
                : (typeof EphemeraAI.getDefaultModel === 'function' ? EphemeraAI.getDefaultModel() : undefined);
            const result = await EphemeraAI.chat(messages, model);
            if (requestId !== this._activeRequestId) return;

            this._lastResponse = String(result || '').trim() || '(No response returned.)';
            this._renderResult(this._lastResponse);
            this._setStatus('Done', 'ok');
            if (this._input) this._input.value = '';
        } catch (e) {
            if (requestId !== this._activeRequestId) return;
            const message = e?.message || 'AI request failed';
            this._lastResponse = '';
            this._renderResult(`Error: ${message}`);
            this._setStatus(message, 'error');
            this._notify('error', 'AI Request Failed', message);
        } finally {
            if (requestId === this._activeRequestId) this._setBusy(false);
        }
    },

    _isAppBuilderPrompt(prompt) {
        const text = String(prompt || '').trim().toLowerCase();
        if (!text) return false;

        if (QUICK_ACTION_TEMPLATES.has(text)) return false;
        const hasBuilderVerb = /\b(build|create|make|generate|scaffold)\b/.test(text);
        const hasAppNoun = /\b(app|application|tool|tracker|game|dashboard|manager|editor)\b/.test(text);
        const hasBuilderPhrase = /\bbuild me\b|\bmake me\b/.test(text);
        return (hasBuilderVerb && hasAppNoun) || hasBuilderPhrase;
    },

    _isFileSearchPrompt(prompt) {
        const text = String(prompt || '').trim().toLowerCase();
        if (!text) return false;

        const hasFileWord = /\b(file|files|document|documents|note|notes|code)\b/.test(text);
        const hasSearchVerb = /\b(find|search|locate|where|which|show|get|list)\b/.test(text);
        const hasTimeContext = /\b(today|yesterday|week|month|last\s+\d+\s+days?)\b/.test(text);
        const hasIntentPhrase = /\bedited\b|\brecent\b|\brecently\b/.test(text);
        return (hasFileWord && hasSearchVerb) || (hasFileWord && (hasTimeContext || hasIntentPhrase));
    },

    async _submitAppBuilder(prompt, context, requestId) {
        this._setMode('default');
        this._setStatus('Designing app scaffold...', 'info');
        this._renderResult('Designing app scaffold...');
        this._lastBuiltApp = null;

        const blueprint = await this._generateAppBuilderBlueprint(prompt, context);
        if (requestId !== this._activeRequestId) return;

        const manifest = this._sanitizeGeneratedManifest(blueprint?.manifest, prompt);
        const code = this._sanitizeGeneratedCode(blueprint?.code, manifest);

        const appValidation = window.EphemeraValidate?.isValidAppManifest
            ? EphemeraValidate.isValidAppManifest(manifest)
            : { valid: true, errors: [] };
        if (!appValidation.valid) {
            throw new Error(appValidation.errors?.[0] || 'Generated manifest is invalid.');
        }

        const codeValidation = window.EphemeraValidate?.isValidAppCode
            ? EphemeraValidate.isValidAppCode(code)
            : { valid: true };
        if (!codeValidation.valid) {
            throw new Error(codeValidation.error || 'Generated app code is invalid.');
        }

        if (!window.EphemeraApps || typeof EphemeraApps.installApp !== 'function') {
            throw new Error('App install API is unavailable.');
        }

        this._setStatus('Installing generated app...', 'info');
        const installed = await EphemeraApps.installApp(manifest, code);
        if (requestId !== this._activeRequestId) return;

        await this._saveGeneratedAppFiles(manifest, code);
        this._lastBuiltApp = installed || manifest;
        this._lastResponse = this._buildAppInstallSummary(manifest, installed, prompt);
        this._renderResult(this._lastResponse);
        this._setStatus('App installed', 'ok');

        if (window.EphemeraBoot && typeof EphemeraBoot.updateStartMenu === 'function') {
            EphemeraBoot.updateStartMenu();
        }
        if (window.EphemeraWM && typeof EphemeraWM.open === 'function') {
            EphemeraWM.open(manifest.id);
        }

        this._notify('success', 'App Built', `${manifest.name} installed and opened.`);
    },

    async _generateAppBuilderBlueprint(prompt, context = {}) {
        if (window.EphemeraAI && typeof EphemeraAI.buildAppFromPrompt === 'function') {
            return EphemeraAI.buildAppFromPrompt(prompt, context);
        }

        const messages = [
            {
                role: 'system',
                content: [
                    'Generate an Ephemera app blueprint as strict JSON only.',
                    'Return {"manifest":{...},"code":"..."} with no markdown.',
                    'Code must run directly in sandbox globals and not call EphemeraApps.register.'
                ].join(' ')
            },
            {
                role: 'user',
                content: String(prompt || '')
            }
        ];

        const model = typeof EphemeraAI.getModelForUseCase === 'function'
            ? EphemeraAI.getModelForUseCase('appBuilder')
            : (typeof EphemeraAI.getDefaultModel === 'function' ? EphemeraAI.getDefaultModel() : undefined);
        const raw = await EphemeraAI.chat(messages, model);
        const parsed = this._extractJsonObject(raw);
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('AI app builder did not return valid JSON.');
        }

        return {
            manifest: parsed.manifest && typeof parsed.manifest === 'object' ? parsed.manifest : {},
            code: String(parsed.code || '')
        };
    },

    _sanitizeGeneratedManifest(rawManifest, prompt) {
        const template = window.EphemeraApps && typeof EphemeraApps.createManifestTemplate === 'function'
            ? EphemeraApps.createManifestTemplate()
            : {
                id: 'com.user.myapp',
                name: 'My App',
                version: '1.0.0',
                description: '',
                icon: '',
                category: 'user',
                permissions: [],
                window: { width: 600, height: 420, resizable: true, minWidth: 320, minHeight: 240 },
                singleton: false
            };

        const source = rawManifest && typeof rawManifest === 'object' ? rawManifest : {};
        const inferredName = this._inferAppNameFromPrompt(prompt);
        const name = String(source.name || inferredName || template.name || 'Generated App')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 64) || 'Generated App';
        const slug = this._slugify(source.id || name || inferredName || 'generated-app');
        const id = `com.user.${slug}`;

        const version = /^\d+\.\d+\.\d+$/.test(String(source.version || ''))
            ? String(source.version)
            : '1.0.0';

        const description = String(source.description || `AI-generated app: ${name}`)
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 180);

        const rawCategory = String(source.category || template.category || 'user').toLowerCase();
        const category = APP_BUILDER_CATEGORIES.has(rawCategory) ? rawCategory : 'user';

        const rawPermissions = Array.isArray(source.permissions) ? source.permissions : [];
        const allowedPermissions = new Set(Array.isArray(window.EphemeraApps?.VALID_PERMISSIONS) ? EphemeraApps.VALID_PERMISSIONS : []);
        const permissions = [];
        rawPermissions.forEach((permission) => {
            const normalized = String(permission || '').trim().toLowerCase();
            if (!normalized) return;
            if (allowedPermissions.size > 0 && !allowedPermissions.has(normalized)) return;
            if (!permissions.includes(normalized)) permissions.push(normalized);
        });

        const width = this._clampNumber(source?.window?.width, 320, 1400, 680);
        const height = this._clampNumber(source?.window?.height, 260, 1000, 520);

        return {
            ...template,
            id,
            name,
            version,
            description,
            icon: this._sanitizeGeneratedIconMarkup(
                typeof source.icon === 'string' && source.icon.trim() ? source.icon : (template.icon || '')
            ),
            category,
            permissions,
            window: {
                width,
                height,
                resizable: source?.window?.resizable !== false,
                minWidth: this._clampNumber(source?.window?.minWidth, 220, width, 300),
                minHeight: this._clampNumber(source?.window?.minHeight, 200, height, 220)
            },
            singleton: Boolean(source.singleton)
        };
    },

    _sanitizeGeneratedIconMarkup(icon) {
        const markup = String(icon || '').trim();
        if (!markup) return '';
        if (!/^<svg[\s>]/i.test(markup)) return '';
        if (markup.length > 10000) return '';
        if (/<script|on\w+\s*=|javascript:/i.test(markup)) return '';
        return markup;
    },

    _sanitizeGeneratedCode(rawCode, manifest) {
        let code = String(rawCode || '').trim();
        code = code.replace(/^```(?:javascript|js)?\s*/i, '').replace(/```$/g, '').trim();

        if (!code || code.length < 40) {
            return this._fallbackGeneratedAppCode(manifest);
        }

        if (/EphemeraApps\.register\s*\(/.test(code) || /\bexport\s+default\b/.test(code) || /\bimport\s+/.test(code)) {
            return this._fallbackGeneratedAppCode(manifest);
        }

        return code;
    },

    _fallbackGeneratedAppCode(manifest) {
        const appTitle = this._escapeHtml(manifest?.name || 'Generated App');
        return `
container.innerHTML = \`
    <style>
        .ai-built-app { padding: 16px; color: var(--fg-primary); }
        .ai-built-app h2 { font-size: 1.1rem; margin-bottom: 10px; }
        .ai-built-app p { color: var(--fg-secondary); margin-bottom: 12px; line-height: 1.5; }
        .ai-built-app button {
            padding: 8px 12px;
            border: none;
            border-radius: var(--radius-sm);
            background: var(--accent);
            color: var(--bg-primary);
            cursor: pointer;
            font-weight: 600;
        }
        .ai-built-app .status { margin-top: 10px; color: var(--fg-muted); font-size: 0.82rem; }
    </style>
    <div class="ai-built-app">
        <h2>${appTitle}</h2>
        <p>This app scaffold was generated by AI and is ready for customization.</p>
        <button id="ai-built-btn">Run Check</button>
        <div class="status" id="ai-built-status">Status: idle</div>
    </div>
\`;

const statusEl = document.getElementById('ai-built-status');
document.getElementById('ai-built-btn')?.addEventListener('click', async () => {
    if (statusEl) statusEl.textContent = 'Status: ready';
    try {
        await EphemeraNotifications.info('App Ready', 'Customize this scaffold in Code Editor.');
    } catch (_e) {
        // Notifications can be denied; keep baseline UX functional.
    }
});
`.trim();
    },

    _inferAppNameFromPrompt(prompt) {
        const text = String(prompt || '').trim();
        if (!text) return 'Generated App';

        const cleaned = text
            .replace(/^(build|create|make|generate|scaffold)\s+/i, '')
            .replace(/\b(an?|my)\b/gi, '')
            .replace(/\b(app|application)\b/gi, '')
            .replace(/[^\w\s-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!cleaned) return 'Generated App';

        return cleaned
            .split(' ')
            .slice(0, 6)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    },

    _slugify(value) {
        const slug = String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48);
        return slug || `ai-app-${Date.now().toString(36)}`;
    },

    _clampNumber(value, min, max, fallback) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(max, Math.max(min, Math.round(parsed)));
    },

    _extractJsonObject(text) {
        const raw = String(text || '').trim();
        if (!raw) return null;

        const unwrapped = raw
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/```$/g, '')
            .trim();

        try {
            return JSON.parse(unwrapped);
        } catch (_e) {
            // Fall back to object extraction.
        }

        const start = unwrapped.indexOf('{');
        const end = unwrapped.lastIndexOf('}');
        if (start === -1 || end <= start) return null;

        try {
            return JSON.parse(unwrapped.slice(start, end + 1));
        } catch (_e) {
            return null;
        }
    },

    async _saveGeneratedAppFiles(manifest, code) {
        if (!window.EphemeraFS || typeof EphemeraFS.writeFile !== 'function') return;

        const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
        const slug = String(manifest?.id || '').replace(/^com\.user\./, '') || this._slugify(manifest?.name || 'app');
        const appDir = `${homeDir}/apps/${slug}`;
        try {
            if (typeof EphemeraFS.ensureDir === 'function') {
                await EphemeraFS.ensureDir(appDir);
            }
            await EphemeraFS.writeFile(`${appDir}/app.json`, JSON.stringify(manifest, null, 2));
            await EphemeraFS.writeFile(`${appDir}/app.js`, code);
        } catch (_e) {
            // Non-fatal: install already succeeded.
        }
    },

    _buildAppInstallSummary(manifest, installed, prompt) {
        const appId = installed?.id || manifest?.id || '';
        const appName = installed?.name || manifest?.name || 'Generated App';
        const perms = Array.isArray(manifest?.permissions) && manifest.permissions.length
            ? manifest.permissions.join(', ')
            : 'none';
        return [
            `Built and installed **${appName}**.`,
            `- Request: ${prompt}`,
            `- App ID: ${appId}`,
            `- Category: ${manifest?.category || 'user'}`,
            `- Permissions: ${perms}`,
            '- Scaffold saved under `~/apps/<app-id>/app.json` and `app.js`.'
        ].join('\n');
    },

    _setMode(mode = 'default') {
        this._mode = mode === 'file-search' ? 'file-search' : 'default';
        if (this._fileSearchPanel) {
            this._fileSearchPanel.style.display = this._mode === 'file-search' ? 'grid' : 'none';
        }
        this._updateResultActionState();
    },

    _createEmptyFileSearchState() {
        return {
            query: '',
            results: [],
            selectedIndex: -1,
            summaryCache: new Map()
        };
    },

    async _submitFileSearch(prompt, requestId) {
        this._setMode('file-search');
        this._fileSearchState = this._createEmptyFileSearchState();
        this._fileSearchState.query = String(prompt || '').trim();
        this._renderFileSearchResults([]);
        this._setStatus('Searching files...', 'info');

        const intent = this._parseFileSearchIntent(prompt);
        const ranked = await this._rankFileSearchCandidates(prompt, intent, requestId);
        if (requestId !== this._activeRequestId) return;

        this._fileSearchState.results = ranked;

        if (ranked.length === 0) {
            const noResultMessage = this._buildNoResultMessage(prompt, intent);
            this._lastResponse = noResultMessage;
            this._renderResult(noResultMessage);
            this._setStatus('No files found', 'info');
            this._renderFileSearchResults([]);
            return;
        }

        const headline = `Found ${ranked.length} file${ranked.length === 1 ? '' : 's'} for "${prompt}". Select one to view AI summary.`;
        this._lastResponse = headline;
        this._renderResult(headline);
        this._renderFileSearchResults(ranked);
        this._setStatus(`Found ${ranked.length} file${ranked.length === 1 ? '' : 's'}.`, 'ok');
        await this._selectFileSearchResult(0, requestId);
    },

    _parseFileSearchIntent(prompt) {
        const raw = String(prompt || '').trim();
        const lower = raw.toLowerCase();
        const range = this._resolveDateRangeFromPrompt(lower);
        const extensions = this._extractExtensionFilters(lower);
        const baseTerms = this._tokenizeForFileSearch(lower);
        const expandedTerms = this._expandSemanticTerms(baseTerms);

        return {
            raw,
            rawLower: lower,
            baseTerms,
            expandedTerms,
            extensions,
            modifiedAfter: range?.after || null,
            modifiedBefore: range?.before || null,
            wantsRecent: Boolean(range?.wantsRecent),
            rangeLabel: range?.label || ''
        };
    },

    _resolveDateRangeFromPrompt(lowerPrompt) {
        const now = Date.now();
        const startOfToday = this._startOfDay(now);
        const startOfWeek = this._startOfWeek(now);
        const startOfMonth = this._startOfMonth(now);

        if (/\byesterday\b/.test(lowerPrompt)) {
            const start = startOfToday - 24 * 60 * 60 * 1000;
            return { after: start, before: startOfToday, wantsRecent: true, label: 'yesterday' };
        }
        if (/\btoday\b/.test(lowerPrompt)) {
            return { after: startOfToday, before: null, wantsRecent: true, label: 'today' };
        }
        if (/\bthis\s+week\b/.test(lowerPrompt)) {
            return { after: startOfWeek, before: null, wantsRecent: true, label: 'this week' };
        }
        if (/\blast\s+week\b/.test(lowerPrompt)) {
            return {
                after: startOfWeek - (7 * 24 * 60 * 60 * 1000),
                before: startOfWeek,
                wantsRecent: true,
                label: 'last week'
            };
        }
        if (/\bthis\s+month\b/.test(lowerPrompt)) {
            return { after: startOfMonth, before: null, wantsRecent: true, label: 'this month' };
        }
        if (/\blast\s+month\b/.test(lowerPrompt)) {
            const prevMonthDate = new Date(startOfMonth);
            prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
            const prevMonthStart = this._startOfMonth(prevMonthDate.getTime());
            return { after: prevMonthStart, before: startOfMonth, wantsRecent: true, label: 'last month' };
        }

        const daysMatch = lowerPrompt.match(/\blast\s+(\d+)\s+days?\b/);
        if (daysMatch) {
            const days = Math.max(1, Math.min(365, Number(daysMatch[1]) || 0));
            return {
                after: now - (days * 24 * 60 * 60 * 1000),
                before: null,
                wantsRecent: true,
                label: `last ${days} days`
            };
        }

        return null;
    },

    _startOfDay(timestamp) {
        const d = new Date(timestamp);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    },

    _startOfWeek(timestamp) {
        const d = new Date(timestamp);
        const weekday = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - weekday);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    },

    _startOfMonth(timestamp) {
        const d = new Date(timestamp);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    },

    _extractExtensionFilters(lowerPrompt) {
        const filters = new Set();
        const patterns = [
            { regex: /\bjs\b|\bjavascript\b/, extensions: ['js'] },
            { regex: /\bts\b|\btypescript\b/, extensions: ['ts'] },
            { regex: /\bmd\b|\bmarkdown\b/, extensions: ['md'] },
            { regex: /\bjson\b/, extensions: ['json'] },
            { regex: /\bhtml?\b/, extensions: ['html', 'htm'] },
            { regex: /\bcss\b/, extensions: ['css'] },
            { regex: /\btxt\b|\btext\b|\bnote\b|\bnotes\b/, extensions: ['txt', 'md', 'log'] }
        ];

        patterns.forEach((pattern) => {
            if (!pattern.regex.test(lowerPrompt)) return;
            pattern.extensions.forEach((ext) => filters.add(ext));
        });

        return Array.from(filters);
    },

    _tokenizeForFileSearch(text) {
        const tokens = String(text || '').toLowerCase().match(/[a-z0-9_]{3,}/g) || [];
        return Array.from(new Set(tokens.filter((token) => !FILE_QUERY_STOP_WORDS.has(token))));
    },

    _expandSemanticTerms(baseTerms) {
        const terms = new Set(Array.isArray(baseTerms) ? baseTerms : []);
        for (const term of terms) {
            const related = FILE_SEMANTIC_SYNONYMS.get(term);
            if (!related) continue;
            related.forEach((token) => terms.add(token));
        }
        return Array.from(terms);
    },

    _getSearchRootDir() {
        return EphemeraFS?.homeDir || EphemeraState?.user?.homeDir || '/home/user';
    },

    async _collectFilesForSearch(startPath, requestId) {
        if (!window.EphemeraFS || typeof EphemeraFS.readdir !== 'function') return [];
        const normalize = typeof EphemeraFS.normalizePath === 'function'
            ? (p) => EphemeraFS.normalizePath(p)
            : (p) => String(p || '/');

        const queue = [normalize(startPath)];
        const visited = new Set();
        const files = [];

        while (queue.length > 0 && files.length < MAX_FILE_SCAN_COUNT) {
            if (requestId !== this._activeRequestId) return [];

            const current = queue.shift();
            if (!current || visited.has(current)) continue;
            visited.add(current);

            let entries = [];
            try {
                entries = await EphemeraFS.readdir(current) || [];
            } catch (_e) {
                continue;
            }

            for (const entry of entries) {
                if (!entry?.path) continue;
                if (entry.type === 'directory') {
                    if (entry.path.endsWith('/.trash')) continue;
                    queue.push(entry.path);
                    continue;
                }
                if (entry.type === 'file') {
                    files.push(entry);
                    if (files.length >= MAX_FILE_SCAN_COUNT) break;
                }
            }
        }

        return files;
    },

    async _rankFileSearchCandidates(prompt, intent, requestId) {
        const files = await this._collectFilesForSearch(this._getSearchRootDir(), requestId);
        if (requestId !== this._activeRequestId) return [];
        if (!files.length) return [];

        const ranked = [];
        const budget = { remaining: MAX_CONTENT_SCAN_COUNT };
        for (const file of files) {
            if (requestId !== this._activeRequestId) return [];
            const scored = await this._scoreFileCandidate(file, intent, budget);
            if (!scored) continue;
            ranked.push(scored);
        }

        if (ranked.length === 0) return [];
        ranked.sort((a, b) =>
            (b.score - a.score)
            || ((b.modifiedAt || 0) - (a.modifiedAt || 0))
            || a.path.localeCompare(b.path)
        );

        let limited = ranked
            .slice(0, Math.max(MAX_FILE_RESULTS * 2, 12))
            .map((item, index) => ({ ...item, id: index }));

        if (window.EphemeraAI && typeof EphemeraAI.rankFileSearchCandidates === 'function') {
            try {
                const reranked = await EphemeraAI.rankFileSearchCandidates(prompt, limited);
                if (requestId !== this._activeRequestId) return [];
                if (Array.isArray(reranked) && reranked.length) {
                    const byPath = new Map(limited.map((entry) => [entry.path, entry]));
                    const normalized = [];
                    reranked.forEach((entry) => {
                        const path = String(entry?.path || '');
                        if (!path || !byPath.has(path)) return;
                        const base = byPath.get(path);
                        normalized.push({ ...base, ...entry });
                        byPath.delete(path);
                    });
                    byPath.forEach((value) => normalized.push(value));
                    limited = normalized;
                }
            } catch (_e) {
                // Best-effort rerank. Keep local order on AI failures.
            }
        }

        return limited.slice(0, MAX_FILE_RESULTS).map((entry) => {
            const rest = { ...entry };
            delete rest.id;
            return rest;
        });
    },

    async _scoreFileCandidate(file, intent, budget) {
        if (!file?.path || file.type !== 'file') return null;

        const extension = String(file.extension || EphemeraFS?.getExtension?.(file.path) || '').toLowerCase();
        if (intent.extensions.length > 0 && !intent.extensions.includes(extension)) return null;

        const modifiedAt = Number(file.modifiedAt || 0);
        if (Number.isFinite(intent.modifiedAfter) && intent.modifiedAfter !== null) {
            if (!modifiedAt || modifiedAt < intent.modifiedAfter) return null;
        }
        if (Number.isFinite(intent.modifiedBefore) && intent.modifiedBefore !== null) {
            if (!modifiedAt || modifiedAt >= intent.modifiedBefore) return null;
        }

        const name = String(file.name || EphemeraFS?.getBasename?.(file.path) || file.path.split('/').pop() || file.path);
        const nameLower = name.toLowerCase();
        const pathLower = String(file.path || '').toLowerCase();
        const terms = intent.expandedTerms.length ? intent.expandedTerms : intent.baseTerms;
        const matched = new Set();
        let score = 0;

        if (intent.rawLower && intent.rawLower.length > 5 && pathLower.includes(intent.rawLower)) {
            score += 16;
        }

        terms.forEach((term) => {
            if (!term) return;
            let hit = false;
            if (nameLower.includes(term)) {
                score += 10;
                hit = true;
            }
            if (pathLower.includes(term)) {
                score += 6;
                hit = true;
            }
            if (hit) matched.add(term);
        });

        let snippet = '';
        if (budget.remaining > 0 && this._isTextCandidate(file.path, extension) && typeof EphemeraFS.readFile === 'function') {
            budget.remaining--;
            try {
                const content = await EphemeraFS.readFile(file.path);
                if (typeof content === 'string' && content) {
                    const contentLower = content.toLowerCase();
                    terms.forEach((term) => {
                        if (!term || !contentLower.includes(term)) return;
                        matched.add(term);
                        score += 4;
                    });
                    snippet = this._buildContentSnippet(content, terms);
                }
            } catch (_e) {
                // Ignore files that cannot be read.
            }
        }

        const hasSemanticTerms = terms.length > 0;
        if (hasSemanticTerms && matched.size === 0) return null;

        if (!hasSemanticTerms) score += 1;
        if (intent.wantsRecent && modifiedAt > 0) {
            const ageDays = Math.max(0, (Date.now() - modifiedAt) / (24 * 60 * 60 * 1000));
            score += Math.max(0, 6 - Math.min(ageDays, 6));
        }
        if (intent.modifiedAfter && modifiedAt > 0) score += 3;

        if (!snippet) snippet = name;

        return {
            path: file.path,
            name,
            extension,
            modifiedAt,
            size: Number(file.size || 0),
            score,
            matchedTerms: Array.from(matched).slice(0, 8),
            snippet
        };
    },

    _isTextCandidate(path, extension = '') {
        if (window.EphemeraFS && typeof EphemeraFS.isTextFile === 'function') {
            return EphemeraFS.isTextFile(path);
        }
        return ['txt', 'md', 'js', 'json', 'html', 'css', 'xml', 'log', 'yml', 'yaml'].includes(String(extension || '').toLowerCase());
    },

    _buildContentSnippet(content, terms) {
        const compact = String(content || '').replace(/\s+/g, ' ').trim();
        if (!compact) return '';

        const normalizedTerms = Array.isArray(terms) ? terms.filter(Boolean) : [];
        if (normalizedTerms.length === 0) return compact.slice(0, 220);

        const lower = compact.toLowerCase();
        let firstIndex = -1;
        normalizedTerms.forEach((term) => {
            const idx = lower.indexOf(term.toLowerCase());
            if (idx === -1) return;
            if (firstIndex === -1 || idx < firstIndex) firstIndex = idx;
        });

        if (firstIndex === -1) return compact.slice(0, 220);
        const start = Math.max(0, firstIndex - 90);
        const end = Math.min(compact.length, firstIndex + 140);
        return `${start > 0 ? '...' : ''}${compact.slice(start, end)}${end < compact.length ? '...' : ''}`;
    },

    _buildNoResultMessage(prompt, intent) {
        const rangeHint = intent?.rangeLabel ? ` within ${intent.rangeLabel}` : '';
        return `No files matched "${prompt}"${rangeHint}. Try broader keywords or a wider date range.`;
    },

    _renderFileSearchResults(results) {
        if (!this._fileSearchResults) return;

        if (!Array.isArray(results) || results.length === 0) {
            this._fileSearchResults.innerHTML = '<div class="ea-file-empty">No matching files yet.</div>';
            this._renderFilePreviewPlaceholder('No file selected', '', 'Select a result to see an AI summary.');
            return;
        }

        const selectedIndex = Number(this._fileSearchState?.selectedIndex ?? -1);
        this._fileSearchResults.innerHTML = results.map((file, index) => {
            const isActive = index === selectedIndex;
            const scoreValue = Number(file.aiScore ?? file.score ?? 0);
            const scoreText = Number.isFinite(scoreValue) ? `${Math.round(scoreValue * 100) / 100}` : '';
            const modifiedText = this._formatDateTime(file.modifiedAt);
            return `
                <button class="ea-file-item ${isActive ? 'active' : ''}" data-ea-file-index="${index}" type="button">
                    <div class="ea-file-item-name">${this._escapeHtml(file.name || file.path)}</div>
                    <div class="ea-file-item-path">${this._escapeHtml(file.path || '')}</div>
                    <div class="ea-file-item-meta">
                        <span>${this._escapeHtml(modifiedText)}</span>
                        ${scoreText ? `<span>Score ${this._escapeHtml(scoreText)}</span>` : ''}
                    </div>
                </button>
            `;
        }).join('');
    },

    _renderFilePreviewPlaceholder(title, meta = '', summary = '') {
        if (this._fileSearchPreviewTitle) this._fileSearchPreviewTitle.textContent = String(title || 'No file selected');
        if (this._fileSearchPreviewMeta) this._fileSearchPreviewMeta.textContent = String(meta || '');
        if (this._fileSearchPreviewSummary) this._fileSearchPreviewSummary.innerHTML = this._formatResult(summary || '');
        if (this._fileSearchOpenBtn) this._fileSearchOpenBtn.disabled = true;
    },

    async _selectFileSearchResult(index, requestId = this._activeRequestId) {
        const numericIndex = Number(index);
        const state = this._fileSearchState;
        if (!state || !Array.isArray(state.results) || !Number.isInteger(numericIndex)) return;
        if (numericIndex < 0 || numericIndex >= state.results.length) return;

        state.selectedIndex = numericIndex;
        this._renderFileSearchResults(state.results);
        const file = state.results[numericIndex];
        const meta = [
            file.path || '',
            file.modifiedAt ? `Edited ${this._formatDateTime(file.modifiedAt)}` : '',
            file.size ? this._formatFileSize(file.size) : ''
        ].filter(Boolean).join(' | ');

        if (this._fileSearchPreviewTitle) this._fileSearchPreviewTitle.textContent = file.name || file.path;
        if (this._fileSearchPreviewMeta) this._fileSearchPreviewMeta.textContent = meta;
        if (this._fileSearchOpenBtn) this._fileSearchOpenBtn.disabled = false;
        if (this._fileSearchPreviewSummary) this._fileSearchPreviewSummary.innerHTML = this._formatResult('Generating AI summary...');

        await this._loadFileSearchPreviewSummary(file, requestId);
    },

    async _loadFileSearchPreviewSummary(file, requestId) {
        const state = this._fileSearchState;
        if (!state || !file?.path) return;

        const cacheKey = `${state.query}::${file.path}`;
        if (state.summaryCache.has(cacheKey)) {
            if (this._fileSearchPreviewSummary) {
                this._fileSearchPreviewSummary.innerHTML = this._formatResult(state.summaryCache.get(cacheKey));
            }
            return;
        }

        const previewRequestId = ++this._filePreviewRequestId;
        try {
            const summary = await this._generateFileSearchSummary(file, state.query);
            if (requestId !== this._activeRequestId || previewRequestId !== this._filePreviewRequestId) return;

            const selected = state.results[state.selectedIndex];
            if (!selected || selected.path !== file.path) return;

            const finalSummary = String(summary || '').trim() || this._buildFileSearchSummaryFallback(file, state.query);
            state.summaryCache.set(cacheKey, finalSummary);
            if (this._fileSearchPreviewSummary) {
                this._fileSearchPreviewSummary.innerHTML = this._formatResult(finalSummary);
            }
        } catch (_e) {
            if (requestId !== this._activeRequestId || previewRequestId !== this._filePreviewRequestId) return;
            const fallback = this._buildFileSearchSummaryFallback(file, state.query);
            state.summaryCache.set(cacheKey, fallback);
            if (this._fileSearchPreviewSummary) {
                this._fileSearchPreviewSummary.innerHTML = this._formatResult(fallback);
            }
        }
    },

    async _generateFileSearchSummary(file, query) {
        const summaryPayload = { ...file };
        if (this._isTextCandidate(file.path, file.extension) && typeof EphemeraFS.readFile === 'function') {
            try {
                const content = await EphemeraFS.readFile(file.path);
                if (typeof content === 'string' && content) {
                    const queryTerms = this._tokenizeForFileSearch(query);
                    summaryPayload.snippet = this._buildContentSnippet(content, queryTerms) || content.slice(0, 500);
                }
            } catch (_e) {
                // Keep existing snippet.
            }
        }

        if (window.EphemeraAI && typeof EphemeraAI.summarizeFilePreview === 'function') {
            return await EphemeraAI.summarizeFilePreview(summaryPayload, query);
        }

        if (window.EphemeraAI && typeof EphemeraAI.chat === 'function') {
            const messages = [
                {
                    role: 'system',
                    content: [
                        'You summarize a file for Ephemera AI search preview.',
                        'Return concise markdown bullets with:',
                        '1) what the file contains,',
                        '2) why it may match the query,',
                        '3) one suggested next action.'
                    ].join(' ')
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        query: String(query || ''),
                        path: summaryPayload.path,
                        modifiedAt: summaryPayload.modifiedAt,
                        snippet: String(summaryPayload.snippet || '').slice(0, 3000)
                    }, null, 2)
                }
            ];
            const model = typeof EphemeraAI.getModelForUseCase === 'function'
                ? EphemeraAI.getModelForUseCase('fileSearch')
                : (typeof EphemeraAI.getDefaultModel === 'function' ? EphemeraAI.getDefaultModel() : undefined);
            return await EphemeraAI.chat(messages, model);
        }

        return this._buildFileSearchSummaryFallback(file, query);
    },

    _buildFileSearchSummaryFallback(file, query) {
        const bullets = [];
        bullets.push(`- File: ${file.path}`);
        if (file.modifiedAt) bullets.push(`- Last edited: ${this._formatDateTime(file.modifiedAt)}`);
        if (Array.isArray(file.matchedTerms) && file.matchedTerms.length > 0) {
            bullets.push(`- Matched terms: ${file.matchedTerms.slice(0, 6).join(', ')}`);
        }
        if (file.snippet) {
            bullets.push(`- Snippet: ${String(file.snippet).slice(0, 220)}`);
        } else if (query) {
            bullets.push(`- Query: ${query}`);
        }
        bullets.push('- Next action: Open the file and validate the matching section.');
        return bullets.join('\n');
    },

    _openSelectedFileSearchResult() {
        const state = this._fileSearchState;
        if (!state || !Array.isArray(state.results) || state.results.length === 0) return;
        const index = Number(state.selectedIndex);
        if (!Number.isInteger(index) || index < 0 || index >= state.results.length) return;

        const file = state.results[index];
        if (!file?.path) return;

        if (window.EphemeraFileAssoc && typeof EphemeraFileAssoc.openFile === 'function') {
            EphemeraFileAssoc.openFile(file.path);
            return;
        }

        if (window.EphemeraWM && typeof EphemeraWM.open === 'function') {
            if (window.EphemeraFS && typeof EphemeraFS.isTextFile === 'function' && EphemeraFS.isTextFile(file.path)) {
                EphemeraWM.open('notepad', { filePath: file.path });
                return;
            }
            const parentDir = window.EphemeraFS && typeof EphemeraFS.getParentDir === 'function'
                ? EphemeraFS.getParentDir(file.path)
                : '/';
            EphemeraWM.open('files', { startPath: parentDir });
        }
    },

    _formatDateTime(timestamp) {
        const numeric = Number(timestamp || 0);
        if (!Number.isFinite(numeric) || numeric <= 0) return 'Unknown date';
        try {
            return new Date(numeric).toLocaleString();
        } catch (_e) {
            return 'Unknown date';
        }
    },

    _formatFileSize(size) {
        const bytes = Number(size || 0);
        if (!Number.isFinite(bytes) || bytes <= 0) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < (1024 * 1024)) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },

    async insertLastResult() {
        if (!this._lastResponse) return;
        const context = this.getActiveContext();

        if (context && typeof context.insert === 'function') {
            try {
                const inserted = await Promise.resolve(context.insert(this._lastResponse));
                if (inserted !== false) {
                    this._notify('success', 'Inserted', 'AI output inserted into active document.');
                    return;
                }
            } catch (e) {
                this._notify('error', 'Insert Failed', e?.message || 'Could not insert AI output.');
                return;
            }
        }

        if (this._insertIntoEditable(this._lastFocusedElement, this._lastResponse)) {
            this._notify('success', 'Inserted', 'AI output inserted into active field.');
            return;
        }

        this._notify('error', 'Insert Failed', 'The active app does not support direct insertion.');
    },

    async copyLastResult() {
        if (!this._lastResponse) return;
        try {
            await navigator.clipboard.writeText(this._lastResponse);
            this._notify('success', 'Copied', 'AI output copied to clipboard.');
        } catch (_e) {
            this._notify('error', 'Copy Failed', 'Could not write to clipboard.');
        }
    },

    async saveLastResultToFile() {
        if (!this._lastResponse) return;
        if (!window.EphemeraFS || typeof EphemeraFS.writeFile !== 'function') {
            this._notify('error', 'Save Failed', 'Filesystem is unavailable.');
            return;
        }

        const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
        const docsDir = `${homeDir}/Documents`;
        const filePath = `${docsDir}/ai-quick-action-${Date.now()}.md`;
        try {
            if (typeof EphemeraFS.ensureDir === 'function') {
                await EphemeraFS.ensureDir(docsDir);
            }
            await EphemeraFS.writeFile(filePath, this._lastResponse);
            if (window.EphemeraWM && typeof EphemeraWM.open === 'function') {
                EphemeraWM.open('notepad', { filePath });
            }
            this._notify('success', 'Saved', `AI output saved to ${filePath}`);
        } catch (e) {
            this._notify('error', 'Save Failed', e?.message || 'Could not save AI output.');
        }
    },

    getActiveContext() {
        const rawWindowId = EphemeraState?.activeWindowId;
        const parsedWindowId = rawWindowId === null || rawWindowId === undefined
            ? NaN
            : Number(rawWindowId);
        const activeWindowId = Number.isFinite(parsedWindowId) ? parsedWindowId : null;
        const windowInfo = this._resolveWindow(activeWindowId);
        const base = {
            windowId: activeWindowId,
            appId: windowInfo?.appId || '',
            appName: windowInfo?.app?.name || windowInfo?.appId || 'Unknown App',
            filePath: '',
            fileContent: '',
            selectedText: ''
        };

        const fallbackContext = this._buildFallbackContext();
        const provider = activeWindowId === null ? null : this._providers.get(activeWindowId);
        if (!provider) return { ...base, ...fallbackContext };

        try {
            const providerContext = provider() || {};
            return { ...base, ...fallbackContext, ...providerContext };
        } catch (e) {
            console.warn('[EphemeraAIAssistant] Context provider failed:', e);
            return { ...base, ...fallbackContext };
        }
    },

    _buildMessages(prompt, context) {
        const normalizedPrompt = this._normalizePrompt(prompt);
        const selectedText = String(context.selectedText || '').trim();
        const fileContent = String(context.fileContent || '').trim();
        const contextSections = [
            `Active app: ${context.appName || context.appId || 'Unknown'}`,
            context.filePath ? `Active file path: ${context.filePath}` : '',
            selectedText ? `Selected text:\n${selectedText}` : '',
            fileContent ? `Active file content:\n${fileContent.slice(0, MAX_CONTEXT_CHARS)}` : ''
        ].filter(Boolean);

        return [
            {
                role: 'system',
                content: [
                    'You are Ephemera Quick Actions, a system-wide assistant for a browser desktop environment.',
                    'Use the provided active app and file context.',
                    'Keep responses concise and actionable.',
                    'When the user asks to rewrite or fix content, return ready-to-insert final content first.'
                ].join(' ')
            },
            {
                role: 'user',
                content: [
                    `Quick action request: ${normalizedPrompt}`,
                    contextSections.length ? `Context:\n${contextSections.join('\n\n')}` : 'Context: none'
                ].join('\n\n')
            }
        ];
    },

    _normalizePrompt(prompt) {
        const trimmed = String(prompt || '').trim();
        if (!trimmed) return '';
        const key = trimmed.toLowerCase();
        return QUICK_ACTION_TEMPLATES.get(key) || trimmed;
    },

    _buildFallbackContext() {
        const target = this._lastFocusedElement;
        if (!target || !(target instanceof HTMLElement)) return {};
        const selectedText = this._readSelectionFromElement(target);
        return {
            selectedText,
            insert: (text) => this._insertIntoEditable(target, text)
        };
    },

    _readSelectionFromElement(element) {
        if (!element) return '';

        const isTextInput = element instanceof HTMLTextAreaElement
            || (element instanceof HTMLInputElement && ['text', 'search', 'email', 'url', 'tel'].includes(element.type || 'text'));
        if (isTextInput) {
            const start = Number(element.selectionStart || 0);
            const end = Number(element.selectionEnd || 0);
            if (end > start) {
                return String(element.value || '').slice(start, end);
            }
            return '';
        }

        if (element.isContentEditable) {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return '';
            return selection.toString();
        }

        return '';
    },

    _insertIntoEditable(element, text) {
        if (!element || !(element instanceof HTMLElement)) return false;
        const payload = String(text || '');
        if (!payload) return false;

        const isTextInput = element instanceof HTMLTextAreaElement
            || (element instanceof HTMLInputElement && ['text', 'search', 'email', 'url', 'tel'].includes(element.type || 'text'));
        if (isTextInput) {
            const value = String(element.value || '');
            const start = Number(element.selectionStart || 0);
            const end = Number(element.selectionEnd || 0);
            element.value = value.slice(0, start) + payload + value.slice(end);
            const caret = start + payload.length;
            element.selectionStart = caret;
            element.selectionEnd = caret;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.focus();
            return true;
        }

        if (element.isContentEditable) {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return false;
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(payload));
            selection.collapseToEnd();
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.focus();
            return true;
        }

        return false;
    },

    _resolveWindow(windowId) {
        if (!Number.isFinite(windowId)) return null;
        if (window.EphemeraWM && typeof EphemeraWM.getWindow === 'function') {
            const win = EphemeraWM.getWindow(windowId);
            if (win) return win;
        }
        const windows = Array.isArray(EphemeraState?.windows) ? EphemeraState.windows : [];
        return windows.find((win) => Number(win?.id) === Number(windowId)) || null;
    },

    _setBusy(busy) {
        const isBusy = Boolean(busy);
        if (this._sendBtn) {
            this._sendBtn.disabled = isBusy;
            this._sendBtn.textContent = isBusy ? 'Thinking...' : 'Run';
        }
        if (this._input) this._input.disabled = isBusy;
    },

    _setStatus(message, type = 'info') {
        if (!this._status) return;
        const text = String(message || '').trim();
        this._status.textContent = text;
        this._status.className = `ea-status ${type}`;
        this._status.style.display = text ? 'block' : 'none';
    },

    _renderResult(text) {
        if (!this._result) return;
        const safeHtml = this._formatResult(String(text || ''));
        this._result.innerHTML = safeHtml;
        this._updateResultActionState();
    },

    _formatResult(text) {
        const escaped = this._escapeHtml(text).replace(/\n/g, '<br>');
        if (window.EphemeraSanitize && typeof EphemeraSanitize.sanitizeHtml === 'function') {
            return EphemeraSanitize.sanitizeHtml(escaped);
        }
        return escaped;
    },

    _escapeHtml(value) {
        const str = String(value || '');
        if (window.EphemeraSanitize && typeof EphemeraSanitize.escapeHtml === 'function') {
            return EphemeraSanitize.escapeHtml(str);
        }
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    _updateContextSummary() {
        if (!this._contextSummary) return;
        const context = this.getActiveContext();
        const parts = [
            `App: ${context.appName || context.appId || 'Unknown'}`,
            context.filePath ? `File: ${context.filePath}` : 'File: none',
            context.selectedText ? 'Selection: yes' : 'Selection: no'
        ];
        this._contextSummary.textContent = parts.join(' | ');
    },

    _updateResultActionState() {
        const hasOutput = Boolean(this._lastResponse);
        if (this._insertBtn) this._insertBtn.disabled = !hasOutput || this._mode === 'file-search';
        if (this._copyBtn) this._copyBtn.disabled = !hasOutput;
        if (this._saveBtn) this._saveBtn.disabled = !hasOutput;
    },

    _notify(type, title, message) {
        if (!window.EphemeraNotifications) return;
        const fn = EphemeraNotifications[type] || EphemeraNotifications.info;
        if (typeof fn === 'function') fn(title, message);
    },

    _attachEvents() {
        this._overlay.addEventListener('mousedown', (e) => {
            if (e.target === this._overlay) this.close();
        });

        if (!this._documentKeydownHandler) {
            this._documentKeydownHandler = (e) => {
                if (e.key === 'Escape' && this.isOpen()) {
                    e.preventDefault();
                    this.close();
                }
            };
            document.addEventListener('keydown', this._documentKeydownHandler);
        }

        const closeBtn = this._panel.querySelector('#ea-close');
        closeBtn?.addEventListener('click', () => this.close());

        this._sendBtn?.addEventListener('click', () => this.submit());
        this._insertBtn?.addEventListener('click', () => this.insertLastResult());
        this._copyBtn?.addEventListener('click', () => this.copyLastResult());
        this._saveBtn?.addEventListener('click', () => this.saveLastResultToFile());
        this._fileSearchOpenBtn?.addEventListener('click', () => this._openSelectedFileSearchResult());

        this._input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submit();
            }
        });

        this._fileSearchResults?.addEventListener('click', (e) => {
            const target = e.target?.closest?.('[data-ea-file-index]');
            if (!target) return;
            const index = Number(target.getAttribute('data-ea-file-index'));
            if (!Number.isInteger(index)) return;
            this._selectFileSearchResult(index);
        });

        this._panel.querySelectorAll('[data-ea-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-ea-action') || '';
                if (this._input) this._input.value = action;
                this.submit(action);
            });
        });
    },

    _render() {
        const existing = document.getElementById('ephemera-ai-assistant');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ephemera-ai-assistant';
        overlay.style.display = 'none';
        overlay.innerHTML = `
            <style>
                #ephemera-ai-assistant {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.45);
                    backdrop-filter: blur(3px);
                    z-index: 100000;
                    align-items: flex-start;
                    justify-content: center;
                    padding-top: 10vh;
                }
                #ephemera-ai-assistant.open { display: flex; }
                #ephemera-ai-assistant .ea-panel {
                    width: min(860px, 92vw);
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.45);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    max-height: 78vh;
                }
                #ephemera-ai-assistant .ea-header {
                    padding: 12px 14px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--border);
                    background: rgba(0,0,0,0.15);
                }
                #ephemera-ai-assistant .ea-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.92rem;
                    font-weight: 600;
                }
                #ephemera-ai-assistant .ea-title svg { width: 16px; height: 16px; color: #00a8ff; }
                #ephemera-ai-assistant .ea-close {
                    background: transparent;
                    border: 1px solid var(--border);
                    color: var(--fg-muted);
                    border-radius: 8px;
                    padding: 4px 10px;
                    cursor: pointer;
                    font-size: 0.78rem;
                }
                #ephemera-ai-assistant .ea-close:hover { color: var(--fg-primary); }
                #ephemera-ai-assistant .ea-body {
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    overflow: auto;
                }
                #ephemera-ai-assistant .ea-context {
                    font-size: 0.72rem;
                    color: var(--fg-muted);
                    background: rgba(0,0,0,0.18);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 8px 10px;
                }
                #ephemera-ai-assistant .ea-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }
                #ephemera-ai-assistant .ea-chip {
                    background: rgba(0,168,255,0.12);
                    border: 1px solid rgba(0,168,255,0.3);
                    color: #00a8ff;
                    padding: 6px 10px;
                    border-radius: 999px;
                    cursor: pointer;
                    font-size: 0.74rem;
                }
                #ephemera-ai-assistant .ea-chip:hover { background: rgba(0,168,255,0.2); }
                #ephemera-ai-assistant .ea-input-wrap { display: flex; gap: 8px; }
                #ephemera-ai-assistant .ea-input {
                    flex: 1;
                    resize: vertical;
                    min-height: 54px;
                    max-height: 180px;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    background: var(--bg-primary);
                    color: var(--fg-primary);
                    padding: 10px 12px;
                    font-family: inherit;
                    font-size: 0.88rem;
                    outline: none;
                }
                #ephemera-ai-assistant .ea-input:focus { border-color: var(--accent); }
                #ephemera-ai-assistant .ea-send {
                    min-width: 110px;
                    border: none;
                    border-radius: 10px;
                    background: var(--accent);
                    color: var(--bg-primary);
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 0.82rem;
                    padding: 0 14px;
                }
                #ephemera-ai-assistant .ea-send:disabled { opacity: 0.6; cursor: default; }
                #ephemera-ai-assistant .ea-status {
                    display: none;
                    font-size: 0.75rem;
                    border-radius: 8px;
                    padding: 6px 10px;
                }
                #ephemera-ai-assistant .ea-status.info { background: rgba(0,168,255,0.1); color: #00a8ff; }
                #ephemera-ai-assistant .ea-status.ok { background: rgba(0,212,170,0.12); color: var(--accent); }
                #ephemera-ai-assistant .ea-status.error { background: rgba(255,77,106,0.12); color: var(--danger); }
                #ephemera-ai-assistant .ea-result {
                    min-height: 120px;
                    background: rgba(0,0,0,0.22);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    padding: 12px;
                    font-size: 0.84rem;
                    line-height: 1.5;
                    color: var(--fg-primary);
                    overflow: auto;
                    white-space: normal;
                }
                #ephemera-ai-assistant .ea-result-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                #ephemera-ai-assistant .ea-btn {
                    border: 1px solid var(--border);
                    background: var(--bg-tertiary);
                    color: var(--fg-secondary);
                    border-radius: 8px;
                    font-size: 0.76rem;
                    padding: 6px 10px;
                    cursor: pointer;
                }
                #ephemera-ai-assistant .ea-btn:hover { color: var(--fg-primary); }
                #ephemera-ai-assistant .ea-btn:disabled { opacity: 0.6; cursor: default; }
                #ephemera-ai-assistant .ea-file-search {
                    display: none;
                    gap: 10px;
                    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
                }
                #ephemera-ai-assistant .ea-file-results {
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    overflow: auto;
                    background: rgba(0,0,0,0.22);
                    max-height: 280px;
                    min-height: 200px;
                }
                #ephemera-ai-assistant .ea-file-empty {
                    color: var(--fg-muted);
                    font-size: 0.78rem;
                    padding: 14px;
                    text-align: center;
                }
                #ephemera-ai-assistant .ea-file-item {
                    width: 100%;
                    text-align: left;
                    background: transparent;
                    border: none;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    padding: 10px 12px;
                    color: var(--fg-secondary);
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                #ephemera-ai-assistant .ea-file-item:last-child { border-bottom: none; }
                #ephemera-ai-assistant .ea-file-item:hover { background: rgba(255,255,255,0.03); color: var(--fg-primary); }
                #ephemera-ai-assistant .ea-file-item.active {
                    background: rgba(0,168,255,0.16);
                    color: #cdefff;
                }
                #ephemera-ai-assistant .ea-file-item-name {
                    font-size: 0.8rem;
                    font-weight: 600;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                #ephemera-ai-assistant .ea-file-item-path {
                    font-size: 0.72rem;
                    color: var(--fg-muted);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                #ephemera-ai-assistant .ea-file-item-meta {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    font-size: 0.68rem;
                    color: var(--fg-muted);
                }
                #ephemera-ai-assistant .ea-file-preview {
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    background: rgba(0,0,0,0.22);
                    padding: 10px 12px;
                    display: flex;
                    flex-direction: column;
                    min-height: 200px;
                    gap: 8px;
                }
                #ephemera-ai-assistant .ea-file-preview-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 10px;
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                    padding-bottom: 8px;
                }
                #ephemera-ai-assistant .ea-file-preview-title {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--fg-primary);
                    overflow-wrap: anywhere;
                }
                #ephemera-ai-assistant .ea-file-preview-meta {
                    margin-top: 4px;
                    font-size: 0.7rem;
                    color: var(--fg-muted);
                    overflow-wrap: anywhere;
                }
                #ephemera-ai-assistant .ea-file-preview-summary {
                    flex: 1;
                    overflow: auto;
                    font-size: 0.78rem;
                    line-height: 1.45;
                    color: var(--fg-primary);
                    white-space: normal;
                }
                @media (max-width: 820px) {
                    #ephemera-ai-assistant .ea-file-search { grid-template-columns: 1fr; }
                    #ephemera-ai-assistant .ea-file-results { max-height: 200px; }
                }
            </style>
            <div class="ea-panel">
                <div class="ea-header">
                    <div class="ea-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
                        </svg>
                        AI Quick Actions
                    </div>
                    <button class="ea-close" id="ea-close">Esc</button>
                </div>
                <div class="ea-body">
                    <div class="ea-context" id="ea-context">App: unknown | File: none | Selection: no</div>
                    <div class="ea-actions">
                        <button class="ea-chip" data-ea-action="Summarize this file">Summarize this file</button>
                        <button class="ea-chip" data-ea-action="Fix this code">Fix this code</button>
                        <button class="ea-chip" data-ea-action="Write a reply to this note">Write a reply to this note</button>
                        <button class="ea-chip" data-ea-action="Create a to-do from this email">Create a to-do from this email</button>
                        <button class="ea-chip" data-ea-action="Translate to French">Translate to French</button>
                        <button class="ea-chip" data-ea-action="Build me a habit tracker with a streak counter">Build me a habit tracker with a streak counter</button>
                        <button class="ea-chip" data-ea-action="Find files I edited this week about authentication">Find files I edited this week about authentication</button>
                    </div>
                    <div class="ea-input-wrap">
                        <textarea id="ea-input" class="ea-input" placeholder="Ask AI to act on the active app context..."></textarea>
                        <button id="ea-send" class="ea-send">Run</button>
                    </div>
                    <div id="ea-status" class="ea-status info"></div>
                    <div id="ea-result" class="ea-result">Run a quick action to see output here.</div>
                    <div id="ea-file-search" class="ea-file-search">
                        <div id="ea-file-results" class="ea-file-results">
                            <div class="ea-file-empty">Run a file query to see matching files.</div>
                        </div>
                        <div class="ea-file-preview">
                            <div class="ea-file-preview-head">
                                <div>
                                    <div id="ea-file-preview-title" class="ea-file-preview-title">No file selected</div>
                                    <div id="ea-file-preview-meta" class="ea-file-preview-meta"></div>
                                </div>
                                <button id="ea-file-open" class="ea-btn" disabled>Open File</button>
                            </div>
                            <div id="ea-file-preview-summary" class="ea-file-preview-summary">AI-generated summary will appear here.</div>
                        </div>
                    </div>
                    <div class="ea-result-actions">
                        <button id="ea-insert" class="ea-btn" disabled>Insert to Active App</button>
                        <button id="ea-copy" class="ea-btn" disabled>Copy</button>
                        <button id="ea-save" class="ea-btn" disabled>Open in New File</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        this._overlay = overlay;
        this._panel = overlay.querySelector('.ea-panel');
        this._input = overlay.querySelector('#ea-input');
        this._contextSummary = overlay.querySelector('#ea-context');
        this._status = overlay.querySelector('#ea-status');
        this._result = overlay.querySelector('#ea-result');
        this._sendBtn = overlay.querySelector('#ea-send');
        this._insertBtn = overlay.querySelector('#ea-insert');
        this._copyBtn = overlay.querySelector('#ea-copy');
        this._saveBtn = overlay.querySelector('#ea-save');
        this._fileSearchPanel = overlay.querySelector('#ea-file-search');
        this._fileSearchResults = overlay.querySelector('#ea-file-results');
        this._fileSearchPreviewTitle = overlay.querySelector('#ea-file-preview-title');
        this._fileSearchPreviewMeta = overlay.querySelector('#ea-file-preview-meta');
        this._fileSearchPreviewSummary = overlay.querySelector('#ea-file-preview-summary');
        this._fileSearchOpenBtn = overlay.querySelector('#ea-file-open');
        this._fileSearchState = this._createEmptyFileSearchState();
        this._lastResponse = '';
        this._mode = 'default';
        this._setMode('default');
        this._renderFilePreviewPlaceholder('No file selected', '', 'AI-generated summary will appear here.');
        this._updateResultActionState();
    },

    _resetForTests() {
        this._providers.clear();
        this._activeRequestId++;
        this._filePreviewRequestId++;
        this._lastResponse = '';
        this._lastContext = null;
        this._lastFocusedElement = null;
        this._lastBuiltApp = null;
        this._mode = 'default';
        this._fileSearchState = this._createEmptyFileSearchState();
        this._initialized = false;
        if (this._documentKeydownHandler) {
            document.removeEventListener('keydown', this._documentKeydownHandler);
            this._documentKeydownHandler = null;
        }
        if (this._overlay) {
            this._overlay.remove();
        } else {
            const existing = document.getElementById('ephemera-ai-assistant');
            if (existing) existing.remove();
        }
        this._overlay = null;
        this._panel = null;
        this._input = null;
        this._contextSummary = null;
        this._result = null;
        this._status = null;
        this._sendBtn = null;
        this._insertBtn = null;
        this._copyBtn = null;
        this._saveBtn = null;
        this._fileSearchPanel = null;
        this._fileSearchResults = null;
        this._fileSearchPreviewTitle = null;
        this._fileSearchPreviewMeta = null;
        this._fileSearchPreviewSummary = null;
        this._fileSearchOpenBtn = null;
    }
};

window.EphemeraAIAssistant = EphemeraAIAssistant;
export default EphemeraAIAssistant;
