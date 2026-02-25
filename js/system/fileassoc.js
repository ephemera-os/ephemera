const EphemeraFileAssoc = {
    _map: new Map(),

    init() {
        this.register(['txt', 'log', 'yml', 'yaml', 'ini', 'cfg', 'sh', 'bat'], 'notepad');
        // md files now use code editor with markdown preview
        this.register(['md', 'js', 'json', 'html', 'css', 'xml', 'svg'], 'code');
        this.register(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'], 'imageviewer');
        this.register(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'], 'musicplayer');
    },

    register(extensions, appId) {
        const exts = Array.isArray(extensions) ? extensions : [extensions];
        exts.forEach(ext => this._map.set(ext.toLowerCase(), appId));
    },

    getApp(path) {
        const ext = EphemeraFS.getExtension(path);
        return this._map.get(ext) || null;
    },

    openFile(path) {
        const appId = this.getApp(path);
        if (appId) {
            EphemeraWM.open(appId, { filePath: path });
        } else if (EphemeraFS.isTextFile(path)) {
            EphemeraWM.open('notepad', { filePath: path });
        } else {
            EphemeraNotifications.warning('No app registered for this file type.');
        }
    },

    getAll() {
        const result = {};
        this._map.forEach((appId, ext) => {
            if (!result[appId]) result[appId] = [];
            result[appId].push(ext);
        });
        return result;
    }
};

window.EphemeraFileAssoc = EphemeraFileAssoc;
