const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const EphemeraMotion = {
    _initialized: false,
    _mediaQueryList: null,
    _changeHandler: null,
    _reduced: false,

    _applyRuntimeState(reduced, emit = false) {
        const isReduced = reduced === true;
        this._reduced = isReduced;

        if (document.documentElement) {
            document.documentElement.classList.toggle('reduced-motion', isReduced);
            document.documentElement.setAttribute('data-reduced-motion', isReduced ? 'true' : 'false');
        }
        if (document.body) {
            document.body.classList.toggle('reduced-motion', isReduced);
            document.body.setAttribute('data-reduced-motion', isReduced ? 'true' : 'false');
        }

        if (emit && window.EphemeraEvents?.emit) {
            window.EphemeraEvents.emit('motion:changed', { reduced: isReduced });
        }
    },

    init() {
        if (this._initialized) return;
        this._initialized = true;

        if (typeof window.matchMedia !== 'function') {
            this._applyRuntimeState(false, false);
            return;
        }

        this._mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
        this._applyRuntimeState(Boolean(this._mediaQueryList.matches), false);

        this._changeHandler = (event) => {
            this._applyRuntimeState(Boolean(event?.matches), true);
        };

        if (typeof this._mediaQueryList.addEventListener === 'function') {
            this._mediaQueryList.addEventListener('change', this._changeHandler);
        } else if (typeof this._mediaQueryList.addListener === 'function') {
            this._mediaQueryList.addListener(this._changeHandler);
        }
    },

    isReducedMotion() {
        if (!this._initialized) {
            this.init();
        }
        return this._reduced === true;
    },

    prefersReducedMotion() {
        return this.isReducedMotion();
    },

    destroy() {
        if (this._mediaQueryList && this._changeHandler) {
            if (typeof this._mediaQueryList.removeEventListener === 'function') {
                this._mediaQueryList.removeEventListener('change', this._changeHandler);
            } else if (typeof this._mediaQueryList.removeListener === 'function') {
                this._mediaQueryList.removeListener(this._changeHandler);
            }
        }

        this._changeHandler = null;
        this._mediaQueryList = null;
        this._initialized = false;
    },

    _resetForTests() {
        this.destroy();
        this._reduced = false;

        if (document.documentElement) {
            document.documentElement.classList.remove('reduced-motion');
            document.documentElement.removeAttribute('data-reduced-motion');
        }
        if (document.body) {
            document.body.classList.remove('reduced-motion');
            document.body.removeAttribute('data-reduced-motion');
        }
    }
};

window.EphemeraMotion = EphemeraMotion;
EphemeraMotion.init();

export default EphemeraMotion;
