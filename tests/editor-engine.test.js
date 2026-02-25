import '../js/system/editor-engine.js';

describe('EphemeraEditorEngine', () => {
    const engine = window.EphemeraEditorEngine;

    beforeEach(() => {
        window.EphemeraState.settings.editorEngine = 'cm5';
        engine.setPreferredBackend('cm5', { persist: false });
    });

    it('is registered on window with CM5 metadata', () => {
        expect(engine).toBeTruthy();
        const metadata = engine.getMetadata();
        expect(metadata.backend).toBe('cm5');
        expect(metadata.id).toBe('cm5');
        expect(window.CodeMirror).toBeTruthy();
    });

    it('resolves known modes from path or extension', () => {
        expect(engine.resolveModeForPath('/home/user/main.js')).toBe('javascript');
        expect(engine.resolveModeForPath('index.html')).toBe('htmlmixed');
        expect(engine.resolveModeForPath('.md')).toBe('markdown');
        expect(engine.resolveModeForPath('xml')).toBe('xml');
        expect(engine.resolveModeForPath('/home/user/file.unknown')).toBe('text');
    });

    it('returns default options merged with overrides', () => {
        const options = engine.getDefaultOptions({
            mode: 'javascript',
            lineNumbers: false
        });

        expect(options.mode).toBe('javascript');
        expect(options.lineNumbers).toBe(false);
        expect(Array.isArray(options.gutters)).toBe(true);
        expect(options.gutters).toContain('CodeMirror-linenumbers');
    });

    it('exposes backend catalog with cm5 and cm6 available', () => {
        const backends = engine.getAvailableBackends();
        const cm5 = backends.find((entry) => entry.id === 'cm5');
        const cm6 = backends.find((entry) => entry.id === 'cm6');

        expect(cm5).toBeTruthy();
        expect(cm5.available).toBe(true);
        expect(cm6).toBeTruthy();
        expect(cm6.available).toBe(true);
    });

    it('activates cm6 when requested', () => {
        const selected = engine.setPreferredBackend('cm6', { persist: false });
        const metadata = engine.getMetadata();

        expect(selected).toBe('cm6');
        expect(metadata.id).toBe('cm6');
        expect(metadata.requested).toBe('cm6');
        expect(window.EphemeraState.settings.editorEngine).toBe('cm6');
    });

    it('falls back to cm5 when an unknown backend is requested', () => {
        const selected = engine.setPreferredBackend('unknown-editor', { persist: false });
        const metadata = engine.getMetadata();

        expect(selected).toBe('cm5');
        expect(metadata.id).toBe('cm5');
        expect(metadata.requested).toBe('unknown-editor');
    });

    it('provides CM5-compatible editing APIs on cm6 backend', () => {
        engine.setPreferredBackend('cm6', { persist: false });
        const textarea = document.createElement('textarea');
        textarea.value = 'hello';
        document.body.appendChild(textarea);

        const editor = engine.createEditor(textarea, {
            mode: 'javascript',
            gutters: ['CodeMirror-linenumbers', 'git-diff-gutter']
        });

        let changeCount = 0;
        let cursorCount = 0;
        editor.on('change', () => changeCount++);
        editor.on('cursorActivity', () => cursorCount++);

        expect(editor.getValue()).toBe('hello');
        editor.replaceRange(' world', { line: 0, ch: 5 });
        expect(editor.getValue()).toBe('hello world');
        expect(changeCount).toBeGreaterThan(0);

        const doc = editor.getDoc();
        const cursor = editor.getCursor();
        expect(cursor.line).toBe(0);
        expect(typeof cursor.ch).toBe('number');

        const index = doc.indexFromPos({ line: 0, ch: 3 });
        const pos = doc.posFromIndex(index);
        expect(index).toBe(3);
        expect(pos).toEqual({ line: 0, ch: 3 });

        doc.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 5 });
        expect(editor.somethingSelected()).toBe(true);
        expect(editor.getSelection()).toBe('hello');
        editor.replaceSelection('hi');
        expect(editor.getValue()).toBe('hi world');

        const bookmark = doc.setBookmark({ line: 0, ch: 1 }, { widget: document.createElement('span') });
        const marked = doc.markText({ line: 0, ch: 0 }, { line: 0, ch: 2 }, { className: 'test-mark' });
        bookmark.clear();
        marked.clear();

        const marker = document.createElement('span');
        marker.className = 'git-diff-marker added';
        editor.setGutterMarker(0, 'git-diff-gutter', marker);
        editor.setGutterMarker(0, 'git-diff-gutter', null);
        expect(editor.lineCount()).toBe(1);
        expect(cursorCount).toBeGreaterThan(0);

        editor.destroy();
        textarea.remove();
    });
});
