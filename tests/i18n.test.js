import { beforeEach, describe, expect, it } from 'vitest';
import { eventsMock, localStorageMock, stateMock } from './setup.js';

import '../js/system/i18n.js';

const EphemeraI18n = window.EphemeraI18n;

describe('EphemeraI18n', () => {
    beforeEach(() => {
        eventsMock._reset();
        localStorageMock._reset();
        stateMock._reset();
        document.body.innerHTML = '';
        document.documentElement.lang = 'en';
        document.documentElement.setAttribute('dir', 'ltr');
        EphemeraI18n.destroy();
        EphemeraI18n.setLocale('en', { persist: false, emit: false, apply: false });
    });

    it('initializes from state locale and applies document lang/dir', () => {
        stateMock.settings.locale = 'fr';

        EphemeraI18n.init();

        expect(EphemeraI18n.getLocale()).toBe('fr');
        expect(document.documentElement.lang).toBe('fr');
        expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    });

    it('falls back to english for missing locale keys', () => {
        EphemeraI18n.init();
        EphemeraI18n.setLocale('fr', { persist: false, emit: false, apply: false });

        expect(EphemeraI18n.t('command_palette.launch_command_line')).toBe('Launch command line');
        expect(EphemeraI18n.t('missing.key', { name: 'A' }, 'Hello {name}')).toBe('Hello A');
    });

    it('setLocale persists, updates state, emits event, and handles rtl locales', () => {
        EphemeraI18n.init();
        stateMock.updateSetting.mockClear();
        eventsMock.emit.mockClear();

        const applied = EphemeraI18n.setLocale('ar');

        expect(applied).toBe('ar');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('ephemera_locale', 'ar');
        expect(stateMock.updateSetting).toHaveBeenCalledWith('locale', 'ar');
        expect(eventsMock.emit).toHaveBeenCalledWith('i18n:changed', expect.objectContaining({
            locale: 'ar',
            dir: 'rtl'
        }));
        expect(document.documentElement.lang).toBe('ar');
        expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    });

    it('translates text and attribute targets in a DOM subtree', () => {
        EphemeraI18n.init();
        EphemeraI18n.setLocale('en', { persist: false, emit: false, apply: false });

        const root = document.createElement('div');
        root.innerHTML = `
            <span data-i18n="desktop.context.refresh">x</span>
            <input data-i18n-placeholder="desktop.search_placeholder" placeholder="x" />
            <button data-i18n-title="common.close" title="x"></button>
            <div data-i18n-aria-label="desktop.search" aria-label="x"></div>
        `;

        EphemeraI18n.translateDom(root);

        expect(root.querySelector('[data-i18n]').textContent).toBe('Refresh');
        expect(root.querySelector('[data-i18n-placeholder]').getAttribute('placeholder')).toBe('Search apps, files, commands...');
        expect(root.querySelector('[data-i18n-title]').getAttribute('title')).toBe('Close');
        expect(root.querySelector('[data-i18n-aria-label]').getAttribute('aria-label')).toBe('Search');
    });
});
