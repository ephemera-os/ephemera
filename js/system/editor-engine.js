// Editor engine abstraction.
// Provides a CM5 backend and a CM6 backend wrapped with a CM5-style adapter.
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/addon/search/search.js';
import 'codemirror/addon/search/searchcursor.js';
import 'codemirror/addon/dialog/dialog.js';
import 'codemirror/addon/dialog/dialog.css';
import 'codemirror/addon/search/jump-to-line.js';

import { EditorState, RangeSet, StateEffect, StateField } from '@codemirror/state';
import {
    Decoration,
    EditorView,
    GutterMarker,
    WidgetType,
    gutter,
    keymap,
    lineNumbers
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, defaultHighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { xml } from '@codemirror/lang-xml';

const ENGINE_CM5 = 'cm5';
const ENGINE_CM6 = 'cm6';

const EXTENSION_MODE_MAP = {
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'javascript',
    jsx: 'javascript',
    tsx: 'javascript',
    json: 'javascript',
    html: 'htmlmixed',
    htm: 'htmlmixed',
    css: 'css',
    md: 'markdown',
    markdown: 'markdown',
    xml: 'xml'
};

const DEFAULT_OPTIONS = {
    theme: 'default',
    lineNumbers: true,
    gutters: ['CodeMirror-linenumbers', 'git-diff-gutter'],
    matchBrackets: true,
    autoCloseBrackets: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    lineWrapping: true
};

const EMPTY_DECORATIONS = Decoration.none;
const EMPTY_RANGE_SET = RangeSet.of([], true);
const CM6_SET_REMOTE_DECORATIONS = StateEffect.define();
const CM6_SET_GIT_GUTTER_MARKERS = StateEffect.define();

class Cm6DomWidget extends WidgetType {
    constructor(node) {
        super();
        this.node = node;
    }

    eq(other) {
        return other?.node === this.node;
    }

    toDOM() {
        return this.node?.cloneNode?.(true) || document.createElement('span');
    }

    ignoreEvent() {
        return true;
    }
}

class Cm6GitMarker extends GutterMarker {
    constructor(node) {
        super();
        this.node = node;
    }

    toDOM() {
        return this.node?.cloneNode?.(true) || document.createElement('span');
    }

    eq(other) {
        return other?.node === this.node;
    }
}

const cm6RemoteDecorationsField = StateField.define({
    create() {
        return EMPTY_DECORATIONS;
    },
    update(value, transaction) {
        let next = value.map(transaction.changes);
        for (const effect of transaction.effects) {
            if (effect.is(CM6_SET_REMOTE_DECORATIONS)) {
                next = effect.value || EMPTY_DECORATIONS;
            }
        }
        return next;
    },
    provide: (field) => EditorView.decorations.from(field)
});

const cm6GitMarkersField = StateField.define({
    create() {
        return new Map();
    },
    update(value, transaction) {
        let next = value;
        for (const effect of transaction.effects) {
            if (effect.is(CM6_SET_GIT_GUTTER_MARKERS)) {
                next = effect.value;
            }
        }
        return next;
    }
});

const cm6Theme = EditorView.theme({
    '&': {
        height: '100%',
        color: 'var(--fg-primary)',
        backgroundColor: 'var(--bg-primary)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '13px'
    },
    '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'inherit'
    },
    '.cm-content': {
        caretColor: 'var(--fg-primary)'
    },
    '&.cm-focused': {
        outline: 'none'
    },
    '.cm-gutters': {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRight: '1px solid var(--border)',
        color: 'var(--fg-muted)'
    },
    '.cm-gutter.git-diff-gutter': {
        width: '6px',
        minWidth: '6px'
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'rgba(255,255,255,0.03)'
    }
}, { dark: true });

function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function toLineNumber(doc, zeroBasedLine) {
    const line = Number.isFinite(zeroBasedLine) ? Math.floor(zeroBasedLine) : 0;
    return clampNumber(line + 1, 1, Math.max(1, doc.lines));
}

function toOffsetFromPos(doc, pos = {}) {
    const lineInfo = doc.line(toLineNumber(doc, Number(pos?.line)));
    const ch = Number.isFinite(pos?.ch) ? Math.floor(pos.ch) : 0;
    return clampNumber(lineInfo.from + Math.max(0, ch), lineInfo.from, lineInfo.to);
}

function toPosFromOffset(doc, offset) {
    const safe = clampNumber(Number.isFinite(offset) ? Math.floor(offset) : 0, 0, doc.length);
    const line = doc.lineAt(safe);
    return {
        line: line.number - 1,
        ch: safe - line.from
    };
}

function resolveCm6LanguageExtension(mode = '') {
    const normalized = String(mode || '').toLowerCase();
    switch (normalized) {
    case 'javascript':
        return javascript({ jsx: true, typescript: true });
    case 'htmlmixed':
    case 'html':
        return html();
    case 'css':
        return css();
    case 'markdown':
    case 'md':
        return markdown();
    case 'xml':
        return xml();
    default:
        return null;
    }
}

function normalizeCm6GutterList(gutters) {
    if (!Array.isArray(gutters)) return [];
    return gutters
        .map((item) => String(item || '').trim())
        .filter(Boolean);
}

class Cm6LegacyAdapter {
    constructor(textarea, options = {}) {
        if (!textarea) {
            throw new Error('Editor textarea element is required');
        }

        this._listeners = new Map();
        this._remoteDecorationSpecs = new Map();
        this._gitMarkers = new Map();
        this._nextDecorationId = 1;

        const parent = textarea.parentElement;
        if (!parent) {
            throw new Error('Editor textarea must be attached to the DOM');
        }

        const initialDoc = String(textarea.value || '');
        const mode = String(options.mode || 'text');
        const language = resolveCm6LanguageExtension(mode);
        const lineNumberEnabled = options.lineNumbers !== false;
        const wrappingEnabled = options.lineWrapping !== false;
        const tabSize = Number.isFinite(options.tabSize) ? Math.max(1, Math.floor(options.tabSize)) : 4;
        const indentSize = Number.isFinite(options.indentUnit) ? Math.max(1, Math.floor(options.indentUnit)) : 4;
        const gutters = normalizeCm6GutterList(options.gutters || DEFAULT_OPTIONS.gutters);
        const enableGitGutter = gutters.includes('git-diff-gutter');

        const extensions = [
            cm6RemoteDecorationsField,
            cm6GitMarkersField,
            cm6Theme,
            EditorState.tabSize.of(tabSize),
            indentUnit.of(' '.repeat(indentSize)),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            history(),
            bracketMatching(),
            highlightSelectionMatches(),
            keymap.of([
                ...defaultKeymap,
                ...historyKeymap,
                ...searchKeymap,
                indentWithTab
            ]),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    this._emit('change', this, update);
                }
                if (update.selectionSet || update.docChanged) {
                    this._emit('cursorActivity', this, update);
                }
            })
        ];

        if (lineNumberEnabled) {
            extensions.push(lineNumbers());
        }

        if (enableGitGutter) {
            extensions.push(gutter({
                class: 'git-diff-gutter',
                markers: (view) => {
                    const markerMap = view.state.field(cm6GitMarkersField, false);
                    if (!markerMap || markerMap.size === 0) return EMPTY_RANGE_SET;
                    const ranges = [];
                    markerMap.forEach((node, lineIndex) => {
                        if (!node) return;
                        const doc = view.state.doc;
                        const lineNumber = toLineNumber(doc, lineIndex);
                        const line = doc.line(lineNumber);
                        ranges.push(new Cm6GitMarker(node).range(line.from));
                    });
                    return ranges.length ? RangeSet.of(ranges, true) : EMPTY_RANGE_SET;
                },
                initialSpacer: () => {
                    const spacer = document.createElement('span');
                    spacer.className = 'git-diff-marker';
                    return new Cm6GitMarker(spacer);
                }
            }));
        }

        if (wrappingEnabled) {
            extensions.push(EditorView.lineWrapping);
        }

        if (language) {
            extensions.push(language);
        }

        this._view = new EditorView({
            state: EditorState.create({
                doc: initialDoc,
                extensions
            }),
            parent
        });

        textarea.style.display = 'none';
        this._textarea = textarea;
    }

    on(event, handler) {
        const name = String(event || '').trim();
        if (!name || typeof handler !== 'function') return;
        if (!this._listeners.has(name)) {
            this._listeners.set(name, new Set());
        }
        this._listeners.get(name).add(handler);
    }

    off(event, handler) {
        const name = String(event || '').trim();
        if (!name || typeof handler !== 'function') return;
        this._listeners.get(name)?.delete(handler);
    }

    _emit(event, ...args) {
        const handlers = this._listeners.get(event);
        if (!handlers || handlers.size === 0) return;
        handlers.forEach((handler) => {
            try {
                handler(...args);
            } catch (_error) {
                // Ignore listener errors to preserve editor behavior.
            }
        });
    }

    getValue() {
        return this._view.state.doc.toString();
    }

    setValue(value) {
        const next = String(value ?? '');
        const current = this.getValue();
        if (next === current) return;
        this._view.dispatch({
            changes: {
                from: 0,
                to: this._view.state.doc.length,
                insert: next
            },
            selection: { anchor: 0 }
        });
    }

    getCursor(which = 'head') {
        const main = this._view.state.selection.main;
        const doc = this._view.state.doc;
        if (which === 'anchor') {
            return toPosFromOffset(doc, main.anchor);
        }
        if (which === 'start') {
            return toPosFromOffset(doc, Math.min(main.anchor, main.head));
        }
        if (which === 'end') {
            return toPosFromOffset(doc, Math.max(main.anchor, main.head));
        }
        return toPosFromOffset(doc, main.head);
    }

    getSelection() {
        const main = this._view.state.selection.main;
        if (main.empty) return '';
        return this._view.state.doc.sliceString(main.from, main.to);
    }

    somethingSelected() {
        return !this._view.state.selection.main.empty;
    }

    replaceSelection(text) {
        const insert = String(text ?? '');
        const main = this._view.state.selection.main;
        const anchor = main.from + insert.length;
        this._view.dispatch({
            changes: {
                from: main.from,
                to: main.to,
                insert
            },
            selection: { anchor }
        });
    }

    replaceRange(text, fromPos, toPos = fromPos) {
        const insert = String(text ?? '');
        const doc = this._view.state.doc;
        const from = toOffsetFromPos(doc, fromPos);
        const to = toOffsetFromPos(doc, toPos);
        const start = Math.min(from, to);
        const end = Math.max(from, to);
        this._view.dispatch({
            changes: {
                from: start,
                to: end,
                insert
            },
            selection: { anchor: start + insert.length }
        });
    }

    focus() {
        this._view.focus();
    }

    refresh() {
        this._view.requestMeasure();
    }

    lineCount() {
        return this._view.state.doc.lines;
    }

    setGutterMarker(line, gutterName, markerElement) {
        if (String(gutterName || '') !== 'git-diff-gutter') return;
        const index = Number.isFinite(line) ? Math.floor(line) : 0;
        const safe = Math.max(0, index);
        if (markerElement) {
            this._gitMarkers.set(safe, markerElement);
        } else {
            this._gitMarkers.delete(safe);
        }
        this._view.dispatch({
            effects: CM6_SET_GIT_GUTTER_MARKERS.of(new Map(this._gitMarkers))
        });
    }

    _syncRemoteDecorations() {
        const doc = this._view.state.doc;
        const decorations = [];
        this._remoteDecorationSpecs.forEach((entry) => {
            if (!entry) return;
            if (entry.type === 'bookmark') {
                const offset = clampNumber(entry.offset, 0, doc.length);
                decorations.push(
                    Decoration.widget({
                        widget: new Cm6DomWidget(entry.widget),
                        side: entry.insertLeft ? -1 : 1
                    }).range(offset)
                );
                return;
            }
            if (entry.type === 'mark') {
                const from = clampNumber(entry.from, 0, doc.length);
                const to = clampNumber(entry.to, 0, doc.length);
                const start = Math.min(from, to);
                const end = Math.max(from, to);
                if (end <= start) return;
                decorations.push(
                    Decoration.mark({ class: entry.className || '' }).range(start, end)
                );
            }
        });
        this._view.dispatch({
            effects: CM6_SET_REMOTE_DECORATIONS.of(
                decorations.length ? Decoration.set(decorations, true) : EMPTY_DECORATIONS
            )
        });
    }

    _nextMarkerId() {
        const id = this._nextDecorationId;
        this._nextDecorationId += 1;
        return id;
    }

    getDoc() {
        const adapter = this;
        return {
            posFromIndex(index) {
                return toPosFromOffset(adapter._view.state.doc, Number(index) || 0);
            },
            indexFromPos(pos) {
                return toOffsetFromPos(adapter._view.state.doc, pos);
            },
            getCursor(which = 'head') {
                return adapter.getCursor(which);
            },
            setSelection(anchorPos, headPos = anchorPos) {
                const doc = adapter._view.state.doc;
                adapter._view.dispatch({
                    selection: {
                        anchor: toOffsetFromPos(doc, anchorPos),
                        head: toOffsetFromPos(doc, headPos)
                    }
                });
            },
            setBookmark(pos, options = {}) {
                const id = adapter._nextMarkerId();
                const doc = adapter._view.state.doc;
                adapter._remoteDecorationSpecs.set(id, {
                    type: 'bookmark',
                    offset: toOffsetFromPos(doc, pos),
                    widget: options.widget || document.createElement('span'),
                    insertLeft: options.insertLeft === true
                });
                adapter._syncRemoteDecorations();
                return {
                    clear() {
                        adapter._remoteDecorationSpecs.delete(id);
                        adapter._syncRemoteDecorations();
                    }
                };
            },
            markText(fromPos, toPos, options = {}) {
                const id = adapter._nextMarkerId();
                const doc = adapter._view.state.doc;
                adapter._remoteDecorationSpecs.set(id, {
                    type: 'mark',
                    from: toOffsetFromPos(doc, fromPos),
                    to: toOffsetFromPos(doc, toPos),
                    className: String(options.className || '')
                });
                adapter._syncRemoteDecorations();
                return {
                    clear() {
                        adapter._remoteDecorationSpecs.delete(id);
                        adapter._syncRemoteDecorations();
                    }
                };
            }
        };
    }

    destroy() {
        this._listeners.clear();
        this._remoteDecorationSpecs.clear();
        this._gitMarkers.clear();
        this._view.destroy();
        if (this._textarea) {
            this._textarea.style.display = '';
        }
    }

    toTextArea() {
        this.destroy();
    }
}

function getExtension(pathOrExt = '') {
    const raw = String(pathOrExt || '').trim();
    if (!raw) return '';
    if (!raw.includes('/')) {
        const bare = raw.toLowerCase();
        if (bare.startsWith('.')) return bare.slice(1);
        const dotIndex = bare.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < bare.length - 1) return bare.slice(dotIndex + 1);
        return bare;
    }
    if (window.EphemeraFS?.getExtension) {
        return String(window.EphemeraFS.getExtension(raw) || '').toLowerCase();
    }
    const idx = raw.lastIndexOf('.');
    return idx > -1 ? raw.slice(idx + 1).toLowerCase() : '';
}

function normalizeEngineId(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return ENGINE_CM5;
    if (raw === 'cm5' || raw === 'codemirror5' || raw === 'codemirror-5') return ENGINE_CM5;
    if (raw === 'cm6' || raw === 'codemirror6' || raw === 'codemirror-6') return ENGINE_CM6;
    return raw;
}

function resolveRequestedEngineId() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const fromQuery = params.get('editor-engine') || params.get('editor_engine') || params.get('editorEngine');
        if (fromQuery) return normalizeEngineId(fromQuery);
    } catch (_error) {
        // Ignore URL parsing failures.
    }
    return normalizeEngineId(window.EphemeraState?.settings?.editorEngine || ENGINE_CM5);
}

const cm5Backend = {
    id: ENGINE_CM5,
    name: 'CodeMirror 5',
    description: 'Stable editor backend',
    version: CodeMirror.version || '5.x',
    backend: 'cm5',
    available: true,
    resolveModeForPath(pathOrExt = '') {
        const ext = getExtension(pathOrExt);
        return EXTENSION_MODE_MAP[ext] || 'text';
    },
    getDefaultOptions(overrides = {}) {
        return {
            ...DEFAULT_OPTIONS,
            ...overrides
        };
    },
    createEditor(textarea, options = {}) {
        if (!textarea) {
            throw new Error('Editor textarea element is required');
        }
        const merged = this.getDefaultOptions(options);
        return CodeMirror.fromTextArea(textarea, merged);
    }
};

const cm6Backend = {
    id: ENGINE_CM6,
    name: 'CodeMirror 6',
    description: 'Modern editor backend',
    version: '6.x',
    backend: 'cm6',
    available: true,
    resolveModeForPath(pathOrExt = '') {
        const ext = getExtension(pathOrExt);
        return EXTENSION_MODE_MAP[ext] || 'text';
    },
    getDefaultOptions(overrides = {}) {
        return {
            ...DEFAULT_OPTIONS,
            ...overrides
        };
    },
    createEditor(textarea, options = {}) {
        if (!textarea) {
            throw new Error('Editor textarea element is required');
        }
        const merged = this.getDefaultOptions(options);
        return new Cm6LegacyAdapter(textarea, merged);
    }
};

function getAvailability(backend) {
    if (!backend) return { available: false, reason: 'Backend is not registered.' };
    if (typeof backend.isAvailable === 'function') {
        const result = backend.isAvailable();
        if (typeof result === 'boolean') return { available: result, reason: result ? '' : (backend.reason || 'Unavailable') };
        if (result && typeof result === 'object') {
            return {
                available: result.available !== false,
                reason: String(result.reason || '')
            };
        }
    }
    if (backend.available === false) return { available: false, reason: String(backend.reason || 'Unavailable') };
    return { available: true, reason: '' };
}

const EphemeraEditorEngine = {
    _backends: new Map([
        [cm5Backend.id, cm5Backend],
        [cm6Backend.id, cm6Backend]
    ]),
    _activeBackendId: ENGINE_CM5,
    _requestedBackendId: ENGINE_CM5,

    registerBackend(backend) {
        if (!backend || typeof backend !== 'object') {
            throw new Error('Backend definition is required');
        }
        const id = normalizeEngineId(backend.id);
        if (!id) throw new Error('Backend id is required');
        if (typeof backend.createEditor !== 'function' && backend.available !== false) {
            throw new Error(`Backend "${id}" must implement createEditor`);
        }
        const normalized = {
            ...backend,
            id,
            name: String(backend.name || id),
            backend: String(backend.backend || id)
        };
        this._backends.set(id, normalized);
        return normalized;
    },

    unregisterBackend(backendId) {
        const id = normalizeEngineId(backendId);
        if (id === ENGINE_CM5) return false;
        return this._backends.delete(id);
    },

    getAvailableBackends() {
        return Array.from(this._backends.values()).map((backend) => {
            const availability = getAvailability(backend);
            return {
                id: backend.id,
                name: backend.name,
                description: backend.description || '',
                backend: backend.backend || backend.id,
                version: backend.version || '',
                available: availability.available,
                reason: availability.reason || ''
            };
        });
    },

    _pickBackend(requestedId) {
        const normalizedRequested = normalizeEngineId(requestedId);
        const preferred = this._backends.get(normalizedRequested);
        const preferredAvailability = getAvailability(preferred);
        if (preferred && preferredAvailability.available) {
            return preferred;
        }

        const fallback = this._backends.get(ENGINE_CM5);
        const fallbackAvailability = getAvailability(fallback);
        if (fallback && fallbackAvailability.available) {
            return fallback;
        }
        return preferred || fallback || null;
    },

    _syncActiveBackend() {
        const requested = resolveRequestedEngineId();
        if (requested === this._requestedBackendId && this._backends.has(this._activeBackendId)) {
            return this._backends.get(this._activeBackendId);
        }
        this._requestedBackendId = requested;
        const backend = this._pickBackend(requested);
        this._activeBackendId = backend?.id || ENGINE_CM5;
        return backend;
    },

    getRequestedBackendId() {
        this._syncActiveBackend();
        return this._requestedBackendId;
    },

    getActiveBackend() {
        return this._syncActiveBackend();
    },

    setPreferredBackend(backendId, options = {}) {
        const normalized = normalizeEngineId(backendId || ENGINE_CM5);
        if (options.persist !== false) {
            if (window.EphemeraState?.updateSetting) {
                window.EphemeraState.updateSetting('editorEngine', normalized);
            } else if (window.EphemeraState?.settings) {
                window.EphemeraState.settings.editorEngine = normalized;
            }
        } else if (window.EphemeraState?.settings) {
            window.EphemeraState.settings.editorEngine = normalized;
        }

        this._requestedBackendId = normalized;
        const backend = this._pickBackend(normalized);
        this._activeBackendId = backend?.id || ENGINE_CM5;
        return this._activeBackendId;
    },

    resolveModeForPath(pathOrExt = '') {
        const backend = this.getActiveBackend();
        if (backend?.resolveModeForPath) {
            return backend.resolveModeForPath(pathOrExt);
        }
        return cm5Backend.resolveModeForPath(pathOrExt);
    },

    getDefaultOptions(overrides = {}) {
        const backend = this.getActiveBackend();
        if (backend?.getDefaultOptions) {
            return backend.getDefaultOptions(overrides);
        }
        return cm5Backend.getDefaultOptions(overrides);
    },

    createEditor(textarea, options = {}) {
        const backend = this.getActiveBackend();
        if (!backend || typeof backend.createEditor !== 'function') {
            throw new Error(`Editor backend "${this._activeBackendId}" is unavailable`);
        }
        return backend.createEditor(textarea, options);
    },

    getMetadata() {
        const active = this.getActiveBackend() || cm5Backend;
        return {
            id: active.id,
            name: active.name,
            version: active.version || '',
            backend: active.backend || active.id,
            requested: this._requestedBackendId,
            availableBackends: this.getAvailableBackends()
        };
    }
};

window.CodeMirror = CodeMirror;
window.EphemeraEditorEngine = EphemeraEditorEngine;

export default EphemeraEditorEngine;
