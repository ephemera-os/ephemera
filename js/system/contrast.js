const PREFERRED_CONTRAST_QUERY = '(prefers-contrast: more)';
const FORCED_COLORS_QUERY = '(forced-colors: active)';

const EphemeraContrast = {
    _initialized: false,
    _preferredContrastMediaQueryList: null,
    _forcedColorsMediaQueryList: null,
    _changeHandler: null,
    _highContrast: false,

    _computeHighContrast() {
        return Boolean(
            this._preferredContrastMediaQueryList?.matches ||
            this._forcedColorsMediaQueryList?.matches
        );
    },

    _applyRuntimeState(enabled, emit = false) {
        const isHighContrast = enabled === true;
        this._highContrast = isHighContrast;

        if (document.documentElement) {
            document.documentElement.classList.toggle('high-contrast', isHighContrast);
            document.documentElement.setAttribute('data-high-contrast', isHighContrast ? 'true' : 'false');
        }
        if (document.body) {
            document.body.classList.toggle('high-contrast', isHighContrast);
            document.body.setAttribute('data-high-contrast', isHighContrast ? 'true' : 'false');
        }

        if (emit && window.EphemeraEvents?.emit) {
            window.EphemeraEvents.emit('contrast:changed', { highContrast: isHighContrast });
        }
    },

    _addListener(mediaQueryList) {
        if (!mediaQueryList || !this._changeHandler) return;
        if (typeof mediaQueryList.addEventListener === 'function') {
            mediaQueryList.addEventListener('change', this._changeHandler);
        } else if (typeof mediaQueryList.addListener === 'function') {
            mediaQueryList.addListener(this._changeHandler);
        }
    },

    _removeListener(mediaQueryList) {
        if (!mediaQueryList || !this._changeHandler) return;
        if (typeof mediaQueryList.removeEventListener === 'function') {
            mediaQueryList.removeEventListener('change', this._changeHandler);
        } else if (typeof mediaQueryList.removeListener === 'function') {
            mediaQueryList.removeListener(this._changeHandler);
        }
    },

    init() {
        if (this._initialized) return;
        this._initialized = true;

        if (typeof window.matchMedia !== 'function') {
            this._applyRuntimeState(false, false);
            return;
        }

        this._preferredContrastMediaQueryList = window.matchMedia(PREFERRED_CONTRAST_QUERY);
        this._forcedColorsMediaQueryList = window.matchMedia(FORCED_COLORS_QUERY);
        this._applyRuntimeState(this._computeHighContrast(), false);

        this._changeHandler = () => {
            this._applyRuntimeState(this._computeHighContrast(), true);
        };

        this._addListener(this._preferredContrastMediaQueryList);
        this._addListener(this._forcedColorsMediaQueryList);
    },

    isHighContrast() {
        if (!this._initialized) {
            this.init();
        }
        return this._highContrast === true;
    },

    prefersHighContrast() {
        return this.isHighContrast();
    },

    destroy() {
        this._removeListener(this._preferredContrastMediaQueryList);
        this._removeListener(this._forcedColorsMediaQueryList);

        this._changeHandler = null;
        this._preferredContrastMediaQueryList = null;
        this._forcedColorsMediaQueryList = null;
        this._initialized = false;
    },

    _resetForTests() {
        this.destroy();
        this._highContrast = false;

        if (document.documentElement) {
            document.documentElement.classList.remove('high-contrast');
            document.documentElement.removeAttribute('data-high-contrast');
        }
        if (document.body) {
            document.body.classList.remove('high-contrast');
            document.body.removeAttribute('data-high-contrast');
        }
    }
};

window.EphemeraContrast = EphemeraContrast;
EphemeraContrast.init();

export default EphemeraContrast;
