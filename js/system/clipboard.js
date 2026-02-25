const EphemeraClipboard = {
    _internal: '',
    _filePath: null,
    _fileOp: null,
    _data: null,
    _type: 'text',

    async copy(text) {
        this._internal = text;
        this._data = { text };
        this._type = 'text';
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            console.warn('[Clipboard] Browser API failed, using internal:', e.message);
        }
        if (window.EphemeraEvents) {
            EphemeraEvents.emit('clipboard:copy', { type: 'text', data: text });
        }
    },

    async paste() {
        try {
            return await navigator.clipboard.readText();
        } catch (e) {
            return this._internal;
        }
    },

    copyFile(path, operation = 'copy') {
        this._filePath = path;
        this._fileOp = operation;
        this._data = { path, operation };
        this._type = 'file';
        if (window.EphemeraEvents) {
            EphemeraEvents.emit('clipboard:copy', { type: 'file', path, operation });
        }
    },

    cutFile(path) {
        this.copyFile(path, 'cut');
    },

    async pasteFile(destDir) {
        if (!this._filePath) return null;
        const name = EphemeraFS.getBasename(this._filePath);
        const destPath = EphemeraFS.normalizePath(destDir + '/' + name);

        if (this._fileOp === 'cut') {
            await EphemeraFS.move(this._filePath, destPath);
            this._filePath = null;
            this._fileOp = null;
        } else {
            await EphemeraFS.copy(this._filePath, destPath);
        }
        if (window.EphemeraEvents) {
            EphemeraEvents.emit('clipboard:paste', { type: 'file', path: destPath });
        }
        return destPath;
    },

    copyStructured(data, type = 'structured') {
        this._data = data;
        this._type = type;
        if (data.text) {
            this._internal = data.text;
            try {
                navigator.clipboard.writeText(data.text);
            } catch (e) { /* internal fallback */ }
        }
        if (window.EphemeraEvents) {
            EphemeraEvents.emit('clipboard:copy', { type, data });
        }
    },

    getStructured() {
        return { type: this._type, data: this._data };
    },

    getType() {
        return this._type;
    },

    hasFile() {
        return !!this._filePath;
    },

    hasData() {
        return this._data !== null;
    },

    getFileOp() {
        return this._fileOp;
    },

    clear() {
        this._internal = '';
        this._filePath = null;
        this._fileOp = null;
        this._data = null;
        this._type = 'text';
    }
};

window.EphemeraClipboard = EphemeraClipboard;
