import en from '../i18n/en.js';
import fr from '../i18n/fr.js';
import de from '../i18n/de.js';
import es from '../i18n/es.js';
import zh from '../i18n/zh.js';
import ar from '../i18n/ar.js';
import ja from '../i18n/ja.js';

const LOCALES = {
    en,
    fr,
    de,
    es,
    zh,
    ar,
    ja
};

function getByPath(source, path) {
    const segments = String(path || '').split('.').filter(Boolean);
    let node = source;
    for (const segment of segments) {
        if (!node || typeof node !== 'object' || !(segment in node)) {
            return undefined;
        }
        node = node[segment];
    }
    return node;
}

function formatMessage(template, params = {}) {
    const raw = String(template ?? '');
    return raw.replace(/\{([a-zA-Z0-9_]+)\}/g, (_all, key) => {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            return String(params[key]);
        }
        return '';
    });
}

const EphemeraI18n = {
    _initialized: false,
    _settingUnsubscribe: null,
    _localeStorageKey: 'ephemera_locale',
    locale: 'en',
    fallbackLocale: 'en',

    init() {
        if (this._initialized) {
            this.applyDocumentLocale();
            return this;
        }
        this._initialized = true;

        const preferred = window.EphemeraState?.settings?.locale
            || localStorage.getItem(this._localeStorageKey)
            || navigator.language
            || this.fallbackLocale;
        this.setLocale(preferred, { persist: false, emit: false, apply: true });

        if (window.EphemeraEvents?.on) {
            this._settingUnsubscribe = window.EphemeraEvents.on('setting:changed', ({ key, value }) => {
                if (key !== 'locale') return;
                const normalized = this.normalizeLocale(value);
                if (normalized === this.locale) return;
                this.setLocale(normalized, { persist: false, emit: true, apply: true });
            });
        }

        return this;
    },

    destroy() {
        if (typeof this._settingUnsubscribe === 'function') {
            this._settingUnsubscribe();
        }
        this._settingUnsubscribe = null;
        this._initialized = false;
    },

    normalizeLocale(locale) {
        if (!locale) return this.fallbackLocale;
        const raw = String(locale).trim().toLowerCase();
        if (LOCALES[raw]) return raw;
        const base = raw.split(/[-_]/)[0];
        if (LOCALES[base]) return base;
        return this.fallbackLocale;
    },

    getAvailableLocales() {
        return Object.keys(LOCALES).map((code) => ({
            code,
            name: LOCALES[code]?._meta?.name || code,
            nativeName: LOCALES[code]?._meta?.nativeName || code,
            rtl: LOCALES[code]?._meta?.rtl === true
        }));
    },

    getLocale() {
        return this.locale;
    },

    isRtl(locale = this.locale) {
        const normalized = this.normalizeLocale(locale);
        return LOCALES[normalized]?._meta?.rtl === true;
    },

    has(key, locale = this.locale) {
        const normalized = this.normalizeLocale(locale);
        const value = getByPath(LOCALES[normalized], key);
        return typeof value === 'string';
    },

    t(key, params = {}, fallback = '') {
        const primary = getByPath(LOCALES[this.locale], key);
        const secondary = getByPath(LOCALES[this.fallbackLocale], key);
        const resolved = typeof primary === 'string'
            ? primary
            : (typeof secondary === 'string' ? secondary : fallback || String(key || ''));
        return formatMessage(resolved, params);
    },

    setLocale(locale, options = {}) {
        const normalized = this.normalizeLocale(locale);
        const persist = options.persist !== false;
        const emit = options.emit !== false;
        const apply = options.apply !== false;

        this.locale = normalized;

        if (persist) {
            localStorage.setItem(this._localeStorageKey, normalized);
            if (window.EphemeraState?.settings?.locale !== normalized && typeof window.EphemeraState?.updateSetting === 'function') {
                window.EphemeraState.updateSetting('locale', normalized);
            }
        }

        if (apply) {
            this.applyDocumentLocale();
        }

        if (emit && window.EphemeraEvents?.emit) {
            window.EphemeraEvents.emit('i18n:changed', {
                locale: normalized,
                dir: this.isRtl(normalized) ? 'rtl' : 'ltr'
            });
        }

        return normalized;
    },

    applyDocumentLocale() {
        const root = document.documentElement;
        root.lang = this.locale;
        root.setAttribute('dir', this.isRtl() ? 'rtl' : 'ltr');
        this.translateDom(document);
    },

    translateDom(root = document) {
        const scope = root || document;

        scope.querySelectorAll?.('[data-i18n]').forEach((element) => {
            const key = element.getAttribute('data-i18n');
            if (!key) return;
            const fallback = element.getAttribute('data-i18n-fallback') || element.textContent || '';
            element.textContent = this.t(key, {}, fallback);
        });

        scope.querySelectorAll?.('[data-i18n-placeholder]').forEach((element) => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (!key) return;
            const fallback = element.getAttribute('placeholder') || '';
            element.setAttribute('placeholder', this.t(key, {}, fallback));
        });

        scope.querySelectorAll?.('[data-i18n-title]').forEach((element) => {
            const key = element.getAttribute('data-i18n-title');
            if (!key) return;
            const fallback = element.getAttribute('title') || '';
            element.setAttribute('title', this.t(key, {}, fallback));
        });

        scope.querySelectorAll?.('[data-i18n-aria-label]').forEach((element) => {
            const key = element.getAttribute('data-i18n-aria-label');
            if (!key) return;
            const fallback = element.getAttribute('aria-label') || '';
            element.setAttribute('aria-label', this.t(key, {}, fallback));
        });
    }
};

window.EphemeraI18n = EphemeraI18n;
export default EphemeraI18n;
