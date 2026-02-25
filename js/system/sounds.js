const EphemeraSounds = {
    _ctx: null,
    _enabled: true,

    init() {
        this._enabled = EphemeraState.settings.sounds !== false;
        EphemeraEvents.on('setting:changed', ({ key, value }) => {
            if (key === 'sounds') this._enabled = value;
        });
    },

    _getCtx() {
        if (!this._ctx) {
            try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
        }
        return this._ctx;
    },

    _tone(freq, duration, type = 'sine', volume = 0.15) {
        if (!this._enabled) return;
        const ctx = this._getCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    },

    windowOpen() {
        this._tone(440, 0.12, 'sine', 0.1);
        setTimeout(() => this._tone(660, 0.12, 'sine', 0.1), 60);
    },

    windowClose() {
        this._tone(660, 0.12, 'sine', 0.1);
        setTimeout(() => this._tone(440, 0.12, 'sine', 0.1), 60);
    },

    notification() {
        this._tone(880, 0.08, 'sine', 0.08);
        setTimeout(() => this._tone(1100, 0.08, 'sine', 0.08), 80);
        setTimeout(() => this._tone(880, 0.1, 'sine', 0.08), 160);
    },

    error() {
        this._tone(220, 0.2, 'sawtooth', 0.08);
        setTimeout(() => this._tone(180, 0.25, 'sawtooth', 0.08), 150);
    },

    click() {
        this._tone(1000, 0.03, 'square', 0.05);
    }
};

window.EphemeraSounds = EphemeraSounds;
