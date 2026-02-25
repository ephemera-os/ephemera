const PALETTE_USAGE_KEY = 'ephemera_command_palette_usage';
const PALETTE_RECENT_KEY = 'ephemera_command_palette_recent';
const MAX_RECENT_COMMANDS = 60;
const MAX_RENDERED_RESULTS = 60;

const SETTINGS_SECTIONS = [
    { id: 'appearance', title: 'Appearance', titleKey: 'settings.sections.appearance', keywords: 'theme wallpaper accent color' },
    { id: 'network', title: 'Network', titleKey: 'settings.sections.network', keywords: 'proxy cors connectivity' },
    { id: 'ai', title: 'AI Assistant', titleKey: 'settings.sections.ai', keywords: 'models api key openai anthropic google openrouter' },
    { id: 'notifications', title: 'Notifications', titleKey: 'settings.sections.notifications', keywords: 'alerts sounds toast' },
    { id: 'data', title: 'Data', titleKey: 'settings.sections.data', keywords: 'backup export import account' },
    { id: 'trust', title: 'Trust Center', titleKey: 'settings.sections.trust', keywords: 'permissions security app trust' },
    { id: 'sync', title: 'Cloud Sync', titleKey: 'settings.sections.sync', keywords: 'webdav gist s3 sync' },
    { id: 'about', title: 'About', titleKey: 'settings.sections.about', keywords: 'version credits help' }
];

function safeJsonParse(raw, fallback) {
    if (!raw || typeof raw !== 'string') return fallback;
    try {
        return JSON.parse(raw);
    } catch (_err) {
        return fallback;
    }
}

function escapeHtml(value) {
    if (window.EphemeraSanitize?.escapeHtml) {
        return window.EphemeraSanitize.escapeHtml(value);
    }
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeMode(mode) {
    if (mode === 'files') return 'files';
    return 'actions';
}

function sanitizeIcon(iconMarkup) {
    const source = String(iconMarkup || '').trim();
    if (!source) return '';
    if (window.EphemeraSanitize?.sanitizeHtml) {
        return window.EphemeraSanitize.sanitizeHtml(source, {
            ALLOWED_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'ellipse'],
            ALLOWED_ATTR: [
                'viewBox', 'fill', 'stroke', 'stroke-width', 'd', 'cx', 'cy', 'r',
                'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'width', 'height'
            ],
            ALLOW_DATA_ATTR: false
        });
    }
    return source;
}

function formatTemplate(template, params = {}) {
    const source = String(template ?? '');
    return source.replace(/\{([a-zA-Z0-9_]+)\}/g, (_all, token) => {
        if (Object.prototype.hasOwnProperty.call(params, token)) {
            return String(params[token]);
        }
        return '';
    });
}

const EphemeraCommandPalette = {
    _initialized: false,
    _open: false,
    _mode: 'actions',
    _selectedIndex: 0,
    _results: [],
    _usage: {},
    _recent: [],
    _customCommandSets: new Map(),
    _subscriptions: [],
    _refreshTimer: null,
    _searchSeq: 0,
    _setCounter: 0,

    _overlay: null,
    _panel: null,
    _titleEl: null,
    _closeHintEl: null,
    _inputEl: null,
    _resultsEl: null,
    _footerEl: null,

    _t(key, params = {}, fallback = '') {
        if (window.EphemeraI18n?.t) {
            return window.EphemeraI18n.t(key, params, fallback);
        }
        return formatTemplate(fallback || key, params);
    },

    init() {
        if (this._initialized) return this;
        this._initialized = true;
        this._usage = safeJsonParse(localStorage.getItem(PALETTE_USAGE_KEY), {}) || {};
        this._recent = safeJsonParse(localStorage.getItem(PALETTE_RECENT_KEY), []) || [];

        this._buildUi();
        this._bindUiEvents();
        this._bindSystemEvents();
        this._installGlobalRegistrationHooks();
        return this;
    },

    destroy() {
        this._subscriptions.forEach((unsubscribe) => {
            try {
                unsubscribe();
            } catch (_err) {
                void _err;
            }
        });
        this._subscriptions = [];

        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }

        if (this._overlay) {
            this._overlay.remove();
        }

        this._overlay = null;
        this._panel = null;
        this._titleEl = null;
        this._closeHintEl = null;
        this._inputEl = null;
        this._resultsEl = null;
        this._footerEl = null;
        this._results = [];
        this._open = false;
        this._selectedIndex = 0;
        this._initialized = false;
    },

    open(mode = 'actions') {
        this.init();

        this._mode = normalizeMode(mode);
        this._open = true;

        this._overlay.classList.add('open');
        this._overlay.setAttribute('aria-hidden', 'false');
        this._applyLocaleStrings();
        this._inputEl.value = '';

        this._selectedIndex = 0;
        this._results = [];
        this._renderResults(this._t('command_palette.start_typing', {}, 'Start typing to search...'));
        this._scheduleRefresh(0);

        requestAnimationFrame(() => {
            this._inputEl.focus();
            this._inputEl.select();
        });
    },

    close() {
        if (!this._initialized) return;
        this._open = false;
        this._overlay.classList.remove('open');
        this._overlay.setAttribute('aria-hidden', 'true');
    },

    toggle(mode = 'actions') {
        const nextMode = normalizeMode(mode);
        if (!this._open) {
            this.open(nextMode);
            return;
        }
        if (this._mode !== nextMode) {
            this.open(nextMode);
            return;
        }
        this.close();
    },

    registerCommands(commands, options = {}) {
        this.init();
        const list = Array.isArray(commands) ? commands : [commands];
        const source = String(options.source || `custom-${++this._setCounter}`);
        const defaultMode = options.mode === 'files' ? 'files' : 'actions';
        const normalized = list
            .map((entry, index) => this._normalizeRegisteredCommand(entry, source, index, defaultMode))
            .filter(Boolean);

        if (normalized.length === 0) {
            return () => {};
        }

        const setId = `${source}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        this._customCommandSets.set(setId, normalized);
        this._scheduleRefresh(0);

        return () => {
            this._customCommandSets.delete(setId);
            this._scheduleRefresh(0);
        };
    },

    _normalizeRegisteredCommand(entry, source, index, defaultMode) {
        if (!entry || typeof entry !== 'object') return null;
        const title = String(entry.title || entry.name || '').trim();
        const action = typeof entry.action === 'function'
            ? entry.action
            : (typeof entry.run === 'function' ? entry.run : null);
        if (!title || !action) return null;

        const mode = entry.mode === 'files' ? 'files' : (entry.mode === 'both' ? 'both' : defaultMode);
        const id = String(entry.id || `${source}:${index}:${title.toLowerCase().replace(/\s+/g, '-')}`);
        const defaultSubtitle = this._t('command_palette.custom_command_subtitle', {}, 'Custom Command');
        return {
            id,
            type: String(entry.type || 'custom'),
            title,
            subtitle: String(entry.subtitle || entry.description || defaultSubtitle),
            keywords: String(entry.keywords || ''),
            icon: sanitizeIcon(entry.icon || ''),
            mode,
            action
        };
    },

    _buildUi() {
        const overlay = document.createElement('div');
        overlay.id = 'command-palette-overlay';
        overlay.className = 'command-palette-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        overlay.innerHTML = `
            <div class="command-palette-shell" role="dialog" aria-modal="true" aria-label="${escapeHtml(this._t('command_palette.title', {}, 'Command Palette'))}">
                <div class="command-palette-header">
                    <div class="command-palette-title" id="command-palette-title">${escapeHtml(this._t('command_palette.title', {}, 'Command Palette'))}</div>
                    <div class="command-palette-close-hint">${escapeHtml(this._t('command_palette.close_hint', {}, 'Esc to close'))}</div>
                </div>
                <div class="command-palette-input-wrap">
                    <input
                        id="command-palette-input"
                        class="command-palette-input"
                        type="text"
                        autocomplete="off"
                        spellcheck="false"
                        placeholder="${escapeHtml(this._t('command_palette.placeholder_action', {}, 'Type a command...'))}"
                        aria-label="${escapeHtml(this._t('command_palette.input_aria', {}, 'Command palette input'))}"
                    />
                </div>
                <div class="command-palette-results" id="command-palette-results" role="listbox" aria-label="${escapeHtml(this._t('command_palette.results_aria', {}, 'Command results'))}"></div>
                <div class="command-palette-footer" id="command-palette-footer">${escapeHtml(this._t('command_palette.footer_nav_hint', {}, 'Enter to run - Up/Down to navigate'))}</div>
            </div>
        `;

        document.body.appendChild(overlay);
        this._overlay = overlay;
        this._panel = overlay.querySelector('.command-palette-shell');
        this._titleEl = overlay.querySelector('#command-palette-title');
        this._closeHintEl = overlay.querySelector('.command-palette-close-hint');
        this._inputEl = overlay.querySelector('#command-palette-input');
        this._resultsEl = overlay.querySelector('#command-palette-results');
        this._footerEl = overlay.querySelector('#command-palette-footer');
        this._applyLocaleStrings();
    },

    _applyLocaleStrings() {
        const fileMode = this._mode === 'files';
        const title = fileMode
            ? this._t('command_palette.file_title', {}, 'File Palette')
            : this._t('command_palette.title', {}, 'Command Palette');

        if (this._panel) {
            this._panel.setAttribute('aria-label', title);
        }
        if (this._titleEl) {
            this._titleEl.textContent = title;
        }
        if (this._closeHintEl) {
            this._closeHintEl.textContent = this._t('command_palette.close_hint', {}, 'Esc to close');
        }
        if (this._inputEl) {
            this._inputEl.placeholder = fileMode
                ? this._t('command_palette.placeholder_files', {}, 'Type to find files...')
                : this._t('command_palette.placeholder_action', {}, 'Type a command...');
            this._inputEl.setAttribute(
                'aria-label',
                this._t('command_palette.input_aria', {}, 'Command palette input')
            );
        }
        if (this._resultsEl) {
            this._resultsEl.setAttribute(
                'aria-label',
                this._t('command_palette.results_aria', {}, 'Command results')
            );
        }
        if (this._footerEl && !this._results.length) {
            this._footerEl.textContent = this._t(
                'command_palette.footer_nav_hint',
                {},
                'Enter to run - Up/Down to navigate'
            );
        }
    },

    _bindUiEvents() {
        this._overlay.addEventListener('mousedown', (event) => {
            if (event.target === this._overlay) {
                this.close();
            }
        });

        this._inputEl.addEventListener('input', () => {
            this._scheduleRefresh(0);
        });

        this._inputEl.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.close();
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this._moveSelection(1);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this._moveSelection(-1);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                this._executeSelected();
            }
        });

        this._resultsEl.addEventListener('mousemove', (event) => {
            const item = event.target.closest('.command-palette-item');
            if (!item) return;
            const index = Number(item.dataset.index);
            if (!Number.isInteger(index)) return;
            if (index === this._selectedIndex) return;
            this._selectedIndex = index;
            this._syncSelection();
        });

        this._resultsEl.addEventListener('click', (event) => {
            const item = event.target.closest('.command-palette-item');
            if (!item) return;
            const index = Number(item.dataset.index);
            if (!Number.isInteger(index)) return;
            this._selectedIndex = index;
            this._executeSelected();
        });
    },

    _bindSystemEvents() {
        if (!window.EphemeraEvents?.on) return;

        const events = [
            'window:opened',
            'window:closed',
            'window:minimized',
            'window:focused',
            'workspace:changed',
            'app:installed',
            'app:uninstalled',
            'app:ephemeral-removed'
        ];

        events.forEach((eventName) => {
            this._subscriptions.push(
                window.EphemeraEvents.on(eventName, () => {
                    this._scheduleRefresh(0);
                })
            );
        });

        this._subscriptions.push(
            window.EphemeraEvents.on('i18n:changed', () => {
                this._applyLocaleStrings();
                this._scheduleRefresh(0);
            })
        );
    },

    _installGlobalRegistrationHooks() {
        const register = (commands, options = {}) => this.registerCommands(commands, options);
        window.EphemeraPaletteRegister = register;
        window.EphemeraCommandPaletteRegister = register;
        window.EphemerapalettRegister = register;
    },

    _scheduleRefresh(delay = 0) {
        if (!this._open) return;
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        this._refreshTimer = setTimeout(() => {
            this._refreshTimer = null;
            this._refreshResults().catch((err) => {
                if (import.meta.env?.DEV) {
                    console.warn('[CommandPalette] Refresh failed:', err);
                }
            });
        }, delay);
    },

    async _refreshResults() {
        if (!this._open) return;
        const query = normalizeText(this._inputEl.value);
        if (this._mode === 'files') {
            await this._refreshFileResults(query);
            return;
        }
        this._refreshActionResults(query);
    },

    _refreshActionResults(query) {
        const commands = this._collectActionCommands();
        const ranked = this._rankCommands(commands, query).slice(0, MAX_RENDERED_RESULTS);
        const emptyMessage = query
            ? this._t('command_palette.no_matching_commands', {}, 'No matching commands')
            : this._t('command_palette.type_to_search_commands', {}, 'Type to search commands');
        this._renderResults(emptyMessage, ranked);
    },

    async _refreshFileResults(query) {
        const requestId = ++this._searchSeq;
        const baseCommands = this._collectCoreFileCommands().concat(this._collectCustomCommands('files'));

        if (!query) {
            const ranked = this._rankCommands(baseCommands, '').slice(0, MAX_RENDERED_RESULTS);
            this._renderResults(this._t('command_palette.type_to_search_files', {}, 'Type to search files'), ranked);
            return;
        }

        this._renderResults(this._t('command_palette.searching_files', {}, 'Searching files...'), []);

        let files = [];
        if (window.EphemeraFS?.search) {
            try {
                files = await window.EphemeraFS.search(query);
            } catch (_err) {
                files = [];
            }
        }

        if (requestId !== this._searchSeq) return;

        const fileCommands = Array.isArray(files)
            ? files.slice(0, 120).map((file) => this._toFileCommand(file)).filter(Boolean)
            : [];
        const ranked = this._rankCommands(baseCommands.concat(fileCommands), query)
            .slice(0, MAX_RENDERED_RESULTS);
        this._renderResults(this._t('command_palette.no_matching_files', {}, 'No matching files'), ranked);
    },

    _rankCommands(commands, query) {
        const normalizedQuery = normalizeText(query);
        const unique = new Map();
        commands.forEach((command) => {
            if (!command || !command.id || typeof command.action !== 'function') return;
            if (unique.has(command.id)) return;
            unique.set(command.id, command);
        });

        const ranked = [];
        unique.forEach((command) => {
            let score = 0;
            if (normalizedQuery) {
                score = this._scoreQuery(command, normalizedQuery);
                if (score < 0) return;
            }

            const usageBoost = Number(this._usage[command.id] || 0) * 3;
            const recentIndex = this._recent.indexOf(command.id);
            const recencyBoost = recentIndex >= 0 ? Math.max(0, 24 - (recentIndex * 2)) : 0;
            const priority = Number(command.priority || 0);

            ranked.push({
                ...command,
                _score: score + usageBoost + recencyBoost + priority
            });
        });

        ranked.sort((a, b) => {
            if (b._score !== a._score) return b._score - a._score;
            return String(a.title).localeCompare(String(b.title));
        });

        return ranked;
    },

    _scoreQuery(command, query) {
        const title = normalizeText(command.title);
        const subtitle = normalizeText(command.subtitle);
        const keywords = normalizeText(command.keywords);

        const fields = [title, subtitle, keywords].filter(Boolean);
        if (fields.length === 0) return -1;

        let best = -1;
        fields.forEach((field, index) => {
            const containsIndex = field.indexOf(query);
            if (containsIndex >= 0) {
                const containsScore = 220 - (containsIndex * 2) - (index * 12);
                best = Math.max(best, containsScore);
            }
            const fuzzyScore = this._fuzzySubsequenceScore(field, query);
            if (fuzzyScore >= 0) {
                best = Math.max(best, fuzzyScore - (index * 8));
            }
        });

        return best;
    },

    _fuzzySubsequenceScore(text, query) {
        if (!text || !query) return -1;
        let score = 0;
        let cursor = -1;
        for (let i = 0; i < query.length; i++) {
            const char = query[i];
            const found = text.indexOf(char, cursor + 1);
            if (found === -1) return -1;
            score += 8;
            if (found === cursor + 1) score += 10;
            if (found === 0) score += 12;
            cursor = found;
        }
        score -= Math.max(0, text.length - query.length) * 0.4;
        return score;
    },

    _renderResults(emptyMessage, rankedResults = []) {
        this._results = Array.isArray(rankedResults) ? rankedResults : [];
        this._selectedIndex = this._results.length > 0
            ? Math.max(0, Math.min(this._selectedIndex, this._results.length - 1))
            : 0;

        if (this._results.length === 0) {
            this._resultsEl.innerHTML = `<div class="command-palette-empty">${escapeHtml(emptyMessage)}</div>`;
            this._footerEl.textContent = this._mode === 'files'
                ? this._t('command_palette.footer_shortcuts_files_first', {}, 'Ctrl+P for files - Ctrl+Shift+P for actions')
                : this._t('command_palette.footer_shortcuts_actions_first', {}, 'Ctrl+Shift+P for actions - Ctrl+P for files');
            return;
        }

        const rowsHtml = this._results.map((command, index) => {
            const selected = index === this._selectedIndex;
            const icon = command.icon || this._defaultIconForType(command.type);
            return `
                <div
                    class="command-palette-item ${selected ? 'selected' : ''}"
                    data-index="${index}"
                    role="option"
                    aria-selected="${selected ? 'true' : 'false'}"
                >
                    <div class="command-palette-item-icon" aria-hidden="true">${icon}</div>
                    <div class="command-palette-item-text">
                        <div class="command-palette-item-title">${escapeHtml(command.title)}</div>
                        <div class="command-palette-item-subtitle">${escapeHtml(command.subtitle || '')}</div>
                    </div>
                    <div class="command-palette-item-type">${escapeHtml(command.type || 'command')}</div>
                </div>
            `;
        }).join('');

        this._resultsEl.innerHTML = rowsHtml;
        const resultCount = this._results.length;
        this._footerEl.textContent = resultCount === 1
            ? this._t('command_palette.result_count', { count: resultCount }, `${resultCount} result - Enter to run`)
            : this._t('command_palette.results_count', { count: resultCount }, `${resultCount} results - Enter to run`);
    },

    _defaultIconForType(type) {
        const name = String(type || '').toLowerCase();
        if (name === 'file') {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>';
        }
        if (name === 'window') {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><line x1="3" y1="8" x2="21" y2="8"/></svg>';
        }
        if (name === 'setting') {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h.1a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>';
        }
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 9-9 9-9-9 9-9z"/><path d="M8 12h8"/></svg>';
    },

    _moveSelection(delta) {
        if (!this._results.length) return;
        const count = this._results.length;
        this._selectedIndex = (this._selectedIndex + delta + count) % count;
        this._syncSelection();
    },

    _syncSelection() {
        const nodes = this._resultsEl.querySelectorAll('.command-palette-item');
        nodes.forEach((node, index) => {
            const selected = index === this._selectedIndex;
            node.classList.toggle('selected', selected);
            node.setAttribute('aria-selected', selected ? 'true' : 'false');
            if (selected) {
                node.scrollIntoView({ block: 'nearest' });
            }
        });
    },

    _executeSelected() {
        if (!this._results.length) return;
        const selected = this._results[this._selectedIndex];
        if (!selected || typeof selected.action !== 'function') return;

        this._recordCommandExecution(selected.id);
        this.close();

        try {
            selected.action();
        } catch (err) {
            console.error('[CommandPalette] Command execution failed:', err);
            if (window.EphemeraNotifications?.error) {
                window.EphemeraNotifications.error(
                    this._t('command_palette.command_failed_title', {}, 'Command Failed'),
                    err?.message || this._t('command_palette.command_failed_body', {}, 'Unable to execute command.')
                );
            }
        }
    },

    _recordCommandExecution(commandId) {
        if (!commandId) return;
        const id = String(commandId);
        this._usage[id] = Number(this._usage[id] || 0) + 1;

        this._recent = this._recent.filter((entry) => entry !== id);
        this._recent.unshift(id);
        this._recent = this._recent.slice(0, MAX_RECENT_COMMANDS);

        localStorage.setItem(PALETTE_USAGE_KEY, JSON.stringify(this._usage));
        localStorage.setItem(PALETTE_RECENT_KEY, JSON.stringify(this._recent));
    },

    _collectActionCommands() {
        return []
            .concat(this._collectCoreActionCommands())
            .concat(this._collectSettingsCommands())
            .concat(this._collectAppCommands())
            .concat(this._collectWindowCommands())
            .concat(this._collectCustomCommands('actions'));
    },

    _collectCoreActionCommands() {
        const openApp = (id, options = {}) => () => window.EphemeraWM?.open?.(id, options);
        const core = [
            {
                id: 'action:open-files',
                type: 'action',
                title: this._t('command_palette.open_files', {}, 'Open Files'),
                subtitle: this._t('command_palette.open_file_manager', {}, 'Launch file manager'),
                keywords: 'explorer documents directories',
                icon: sanitizeIcon(window.EphemeraApps?.get?.('files')?.icon),
                action: openApp('files')
            },
            {
                id: 'action:open-terminal',
                type: 'action',
                title: this._t('command_palette.open_terminal', {}, 'Open Terminal'),
                subtitle: this._t('command_palette.launch_command_line', {}, 'Launch command line'),
                keywords: 'shell cli command',
                icon: sanitizeIcon(window.EphemeraApps?.get?.('terminal')?.icon),
                action: openApp('terminal')
            },
            {
                id: 'action:open-code',
                type: 'action',
                title: this._t('command_palette.open_code_editor', {}, 'Open Code Editor'),
                subtitle: this._t('command_palette.launch_developer_editor', {}, 'Launch developer editor'),
                keywords: 'code editor ide source',
                icon: sanitizeIcon(window.EphemeraApps?.get?.('code')?.icon),
                action: openApp('code')
            },
            {
                id: 'action:open-browser',
                type: 'action',
                title: this._t('command_palette.open_browser', {}, 'Open Browser'),
                subtitle: this._t('command_palette.launch_web_browser', {}, 'Launch web browser'),
                keywords: 'web internet',
                icon: sanitizeIcon(window.EphemeraApps?.get?.('browser')?.icon),
                action: openApp('browser')
            },
            {
                id: 'action:open-settings',
                type: 'action',
                title: this._t('command_palette.open_settings', {}, 'Open Settings'),
                subtitle: this._t('command_palette.system_preferences', {}, 'System preferences'),
                keywords: 'preferences configure options',
                icon: sanitizeIcon(window.EphemeraApps?.get?.('settings')?.icon),
                action: openApp('settings')
            },
            {
                id: 'action:open-help',
                type: 'action',
                title: this._t('command_palette.open_help', {}, 'Open Help'),
                subtitle: this._t('command_palette.guides_and_shortcuts', {}, 'Guides and shortcuts'),
                keywords: 'manual docs support',
                icon: sanitizeIcon(window.EphemeraApps?.get?.('help')?.icon),
                action: openApp('help')
            },
            {
                id: 'action:open-appmanager',
                type: 'action',
                title: this._t('command_palette.open_app_manager', {}, 'Open App Manager'),
                subtitle: this._t('command_palette.manage_installed_apps', {}, 'Manage installed apps'),
                keywords: 'apps marketplace community',
                icon: sanitizeIcon(window.EphemeraApps?.get?.('appmanager')?.icon),
                action: openApp('appmanager')
            },
            {
                id: 'action:cascade-windows',
                type: 'action',
                title: this._t('command_palette.cascade_windows', {}, 'Cascade Windows'),
                subtitle: this._t('command_palette.arrange_windows_cascade', {}, 'Arrange open windows in a cascade'),
                keywords: 'layout arrange',
                action: () => window.EphemeraWM?.cascadeAll?.()
            },
            {
                id: 'action:tile-windows',
                type: 'action',
                title: this._t('command_palette.tile_windows', {}, 'Tile Windows'),
                subtitle: this._t('command_palette.arrange_windows_grid', {}, 'Arrange open windows in a grid'),
                keywords: 'layout arrange split',
                action: () => window.EphemeraWM?.tileAll?.()
            },
            {
                id: 'action:lock-session',
                type: 'action',
                title: this._t('command_palette.lock_session', {}, 'Lock Session'),
                subtitle: this._t('command_palette.require_password_continue', {}, 'Require password to continue'),
                keywords: 'security lock',
                action: () => window.EphemeraSession?.lock?.()
            },
            {
                id: 'action:logout-session',
                type: 'action',
                title: this._t('command_palette.log_out', {}, 'Log Out'),
                subtitle: this._t('command_palette.sign_out_current_profile', {}, 'Sign out of current profile'),
                keywords: 'logout sign out',
                action: () => window.EphemeraSession?.logout?.()
            },
            {
                id: 'action:sync-now',
                type: 'action',
                title: this._t('command_palette.sync_now', {}, 'Sync Now'),
                subtitle: this._t('command_palette.run_cloud_sync_now', {}, 'Run cloud sync immediately'),
                keywords: 'sync backup cloud',
                action: () => window.EphemeraSyncManager?.syncAll?.()
            }
        ];

        for (let index = 0; index < 4; index++) {
            core.push({
                id: `action:workspace-${index + 1}`,
                type: 'action',
                title: this._t('command_palette.switch_workspace', { index: index + 1 }, `Switch to Workspace ${index + 1}`),
                subtitle: this._t('command_palette.desktop_workspace_switcher', {}, 'Desktop workspace switcher'),
                keywords: `workspace desktop ${index + 1}`,
                action: () => window.EphemeraBoot?.switchWorkspace?.(index)
            });
        }

        return core;
    },

    _collectSettingsCommands() {
        return SETTINGS_SECTIONS.map((section) => ({
            id: `setting:${section.id}`,
            type: 'setting',
            title: this._t(
                'command_palette.settings_jump',
                { section: this._t(section.titleKey, {}, section.title) },
                `Settings: ${section.title}`
            ),
            subtitle: this._t('command_palette.jump_settings_section', {}, 'Jump to settings section'),
            keywords: `settings ${section.keywords}`,
            icon: this._defaultIconForType('setting'),
            action: () => this._openSettingsSection(section.id)
        }));
    },

    _openSettingsSection(sectionId) {
        const windows = window.EphemeraWM?.getWindowsByApp?.('settings') || [];
        if (windows.length > 0) {
            const targetWindow = windows[windows.length - 1];
            window.EphemeraWM?.focusWindow?.(targetWindow.id);
            window.EphemeraEvents?.emit?.('settings:navigate', {
                windowId: targetWindow.id,
                section: sectionId
            });
            return;
        }
        window.EphemeraWM?.open?.('settings', { section: sectionId });
    },

    _collectAppCommands() {
        const apps = window.EphemeraApps?.getAll?.() || [];
        return apps
            .slice()
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
            .map((app) => ({
                id: `app:open:${app.id}`,
                type: 'app',
                title: this._t('command_palette.app_open', { name: app.name }, `Open ${app.name}`),
                subtitle: app.category
                    ? this._t(
                        'command_palette.application_with_category',
                        { category: app.category },
                        `Application - ${app.category}`
                    )
                    : this._t('command_palette.application_without_category', {}, 'Application'),
                keywords: `${app.id || ''} ${app.category || ''}`,
                icon: sanitizeIcon(app.icon),
                action: () => window.EphemeraWM?.open?.(app.id)
            }));
    },

    _collectWindowCommands() {
        const windows = window.EphemeraState?.windows || [];
        return windows
            .slice()
            .reverse()
            .map((win) => {
                const appName = win?.app?.name || win?.appId || this._t('window.window_fallback_name', {}, 'Window');
                const isMinimized = win?.element?.classList?.contains?.('minimized');
                const subtitle = isMinimized
                    ? this._t('command_palette.window_subtitle_minimized', { id: win.id }, `Window #${win.id} (minimized)`)
                    : this._t('command_palette.window_subtitle', { id: win.id }, `Window #${win.id}`);
                return {
                    id: `window:focus:${win.id}`,
                    type: 'window',
                    title: this._t('command_palette.switch_to_window', { name: appName }, `Switch to ${appName}`),
                    subtitle,
                    keywords: `${appName} ${win.appId || ''} window`,
                    icon: sanitizeIcon(win?.app?.icon) || this._defaultIconForType('window'),
                    action: () => {
                        if (win?.element?.classList?.contains?.('minimized')) {
                            win.element.classList.remove('minimized');
                        }
                        window.EphemeraWM?.focusWindow?.(win.id);
                    }
                };
            });
    },

    _collectCoreFileCommands() {
        return [{
            id: 'file:open-files-app',
            type: 'file',
            title: this._t('command_palette.browse_files', {}, 'Browse Files'),
            subtitle: this._t('command_palette.open_file_manager', {}, 'Open file manager'),
            keywords: 'files explorer folders',
            icon: sanitizeIcon(window.EphemeraApps?.get?.('files')?.icon) || this._defaultIconForType('file'),
            action: () => window.EphemeraWM?.open?.('files')
        }];
    },

    _collectCustomCommands(mode) {
        const targetMode = normalizeMode(mode);
        const out = [];
        this._customCommandSets.forEach((commands) => {
            commands.forEach((command) => {
                if (command.mode === 'both' || command.mode === targetMode) {
                    out.push(command);
                }
            });
        });
        return out;
    },

    _toFileCommand(file) {
        if (!file || !file.path || !file.name) return null;
        const isDirectory = file.type === 'directory';
        const path = String(file.path);
        const name = String(file.name);
        const subtitle = path;
        const icon = sanitizeIcon(
            window.EphemeraFS?.getIcon?.(file)
            || this._defaultIconForType('file')
        );

        return {
            id: `file:${path}`,
            type: 'file',
            title: name,
            subtitle,
            keywords: `${path} ${isDirectory ? 'directory folder' : 'file'}`,
            icon,
            action: () => {
                if (isDirectory) {
                    window.EphemeraWM?.open?.('files', { startPath: path });
                    return;
                }

                if (window.EphemeraFileAssoc?.openFile) {
                    window.EphemeraFileAssoc.openFile(path);
                    return;
                }

                const isText = window.EphemeraFS?.isTextFile?.(path);
                if (isText) {
                    window.EphemeraWM?.open?.('notepad', { filePath: path });
                    return;
                }

                const parent = window.EphemeraFS?.getParentDir
                    ? window.EphemeraFS.getParentDir(path)
                    : path.split('/').slice(0, -1).join('/') || '/';
                window.EphemeraWM?.open?.('files', { startPath: parent });
            }
        };
    },

    _resetForTests() {
        this.destroy();
        this._usage = {};
        this._recent = [];
        this._customCommandSets = new Map();
        this._setCounter = 0;
        this._searchSeq = 0;
        localStorage.removeItem(PALETTE_USAGE_KEY);
        localStorage.removeItem(PALETTE_RECENT_KEY);
    }
};

window.EphemeraCommandPalette = EphemeraCommandPalette;

export default EphemeraCommandPalette;
