// @ts-check

import DOMPurify from 'dompurify';

/** @typedef {import('dompurify').Config} DOMPurifyConfig */

const EphemeraSanitize = {
    /**
     * @param {unknown} str
     * @returns {string}
     */
    escapeHtml(str) {
        if (typeof str !== 'string') return String(str);
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    /**
     * @param {unknown} str
     * @returns {string}
     */
    escapeAttr(str) {
        if (typeof str !== 'string') return String(str);
        return str.replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    /**
     * @param {string} dirty
     * @param {DOMPurifyConfig} [options]
     * @returns {string}
     */
    sanitizeHtml(dirty, options = {}) {
        /** @type {DOMPurifyConfig} */
        const defaultConfig = {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
                'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img', 'span', 'div', 'sup', 'sub'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'title', 'target', 'rel', 'loading'],
            ALLOW_DATA_ATTR: false,
            ADD_ATTR: ['target'],
        };
        const config = { ...defaultConfig, ...options };
        return DOMPurify.sanitize(dirty, config);
    },

    /**
     * @param {unknown} url
     * @returns {string}
     */
    sanitizeUrl(url) {
        if (typeof url !== 'string') return '';
        const trimmed = url.trim().toLowerCase();
        if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
            return '';
        }
        return url;
    },

    /**
     * @template {(...args: unknown[]) => unknown} T
     * @param {T} fn
     * @param {number} ms
     * @returns {(...args: Parameters<T>) => void}
     */
    debounce(fn, ms) {
        /** @type {number | undefined} */
        let timer;
        return function (...args) {
            if (timer !== undefined) {
                window.clearTimeout(timer);
            }
            timer = window.setTimeout(() => fn.apply(this, args), ms);
        };
    },

    /**
     * @template {(...args: unknown[]) => unknown} T
     * @param {T} fn
     * @param {number} ms
     * @returns {(...args: Parameters<T>) => ReturnType<T> | undefined}
     */
    throttle(fn, ms) {
        let last = 0;
        return function (...args) {
            const now = Date.now();
            if (now - last >= ms) {
                last = now;
                return fn.apply(this, args);
            }
        };
    }
};

window.EphemeraSanitize = EphemeraSanitize;
export default EphemeraSanitize;
