const EphemeraShortcuts = {
    _registry: new Map(),
    _enabled: true,
    _initialized: false,
    _keyHandler: null,

    init() {
        if (this._initialized) return;
        this._initialized = true;

        this._keyHandler = (e) => {
            if (!this._enabled) return;
            const combo = this._buildCombo(e);
            const handler = this._registry.get(combo);
            if (handler) {
                e.preventDefault();
                e.stopPropagation();
                try { handler(e); } catch (err) { console.error('[Shortcuts]', err); }
            }
        };
        document.addEventListener('keydown', this._keyHandler);

        this.register('ctrl+w', () => {
            if (EphemeraState.activeWindowId != null) EphemeraWM.close(EphemeraState.activeWindowId);
        });
        this.register('ctrl+tab', () => {
            const wins = EphemeraState.windows.filter(w => !w.element.classList.contains('minimized'));
            if (wins.length < 2) return;
            const idx = wins.findIndex(w => w.id === EphemeraState.activeWindowId);
            const next = wins[(idx + 1) % wins.length];
            EphemeraWM.focusWindow(next.id);
        });
        this.register('f11', () => {
            if (EphemeraState.activeWindowId != null) EphemeraWM.toggleMaximize(EphemeraState.activeWindowId);
        });
        this.register('ctrl+shift+t', () => EphemeraWM.open('terminal'));
        this.register('ctrl+shift+e', () => EphemeraWM.open('files'));
        this.register('ctrl+shift+p', () => window.EphemeraCommandPalette?.toggle?.('actions'));
        this.register('meta+shift+p', () => window.EphemeraCommandPalette?.toggle?.('actions'));
        this.register('ctrl+p', () => window.EphemeraCommandPalette?.toggle?.('files'));
        this.register('meta+p', () => window.EphemeraCommandPalette?.toggle?.('files'));
        this.register('alt+space', () => window.EphemeraAIAssistant?.toggle?.());
        this.register('meta+space', () => window.EphemeraAIAssistant?.toggle?.());
        this.register('meta', () => {
            toggleStartMenu(!document.getElementById('start-menu').classList.contains('open'));
        });
        for (let index = 1; index <= 4; index++) {
            this.register(`ctrl+${index}`, () => {
                window.EphemeraBoot?.switchWorkspace?.(index - 1);
            });
            this.register(`ctrl+shift+${index}`, () => {
                const activeWindowId = Number(EphemeraState.activeWindowId);
                if (!Number.isInteger(activeWindowId)) return;
                window.EphemeraWM?.moveToWorkspace?.(activeWindowId, index - 1, { switchTo: true });
            });
        }
        this.register('meta+tab', () => {
            window.EphemeraBoot?.toggleWorkspaceOverview?.();
        });
    },

    register(combo, handler) {
        this._registry.set(combo.toLowerCase(), handler);
        return () => this._registry.delete(combo.toLowerCase());
    },

    unregister(combo) {
        this._registry.delete(combo.toLowerCase());
    },

    destroy() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        this._initialized = false;
    },

    _buildCombo(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        if (e.metaKey && e.key !== 'Meta') parts.push('meta');
        let key = e.key.toLowerCase();
        if (key === 'control' || key === 'shift' || key === 'alt') return '';
        if (key === 'meta') { return 'meta'; }
        if (key === ' ') key = 'space';
        if (key === 'arrowleft') key = 'left';
        if (key === 'arrowright') key = 'right';
        if (key === 'arrowup') key = 'up';
        if (key === 'arrowdown') key = 'down';
        if (key === 'tab') key = 'tab';
        parts.push(key);
        return parts.join('+');
    },

    _resetForTests() {
        this.destroy();
        this._registry = new Map();
        this._enabled = true;
    }
};

window.EphemeraShortcuts = EphemeraShortcuts;
