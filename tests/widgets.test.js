import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../js/system/widgets.js';

describe('EphemeraWidgets', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="desktop">
                <canvas id="wallpaper-canvas"></canvas>
                <div id="desktop-icons"></div>
            </div>
        `;

        localStorage.clear();

        window.EphemeraEvents = { emit: vi.fn() };
        window.EphemeraSanitize = {
            escapeHtml: (value) => String(value),
            escapeAttr: (value) => String(value)
        };
        window.EphemeraState = window.EphemeraState || { windows: [] };
        window.EphemeraState.windows = [];
        window.EphemeraApps = { runUserApp: vi.fn() };

        window.EphemeraWidgets._widgets = [];
        window.EphemeraWidgets._container = null;
        window.EphemeraWidgets._widgetDefinitions = new Map();
        window.EphemeraWidgets._extensionWidgetTypes = new Map();
        window.EphemeraWidgets._builtinsRegistered = false;
    });

    it('initializes widget layer between wallpaper and desktop icons', () => {
        window.EphemeraWidgets.init();

        const container = document.getElementById('widgets-container');
        const icons = document.getElementById('desktop-icons');
        expect(container).toBeTruthy();
        expect(container.nextElementSibling).toBe(icons);
        expect(container.style.zIndex).toBe('3');

        const widgetTypes = window.EphemeraWidgets.listAvailableWidgets().map((entry) => entry.type);
        expect(widgetTypes).toContain('clock');
        expect(widgetTypes).toContain('weather');
        expect(widgetTypes).toContain('calendar');
        expect(widgetTypes).toContain('stickynote');
        expect(widgetTypes).toContain('sysinfo');
        expect(widgetTypes).toContain('rss');
    });

    it('registers extension widgets and runs code through app runtime when added', () => {
        window.EphemeraWidgets.init();

        const widgetType = window.EphemeraWidgets.registerExtensionWidget(
            'com.community.widget',
            {
                id: 'com.community.widget',
                name: 'Community Widget',
                type: 'widget',
                widget: {
                    type: 'community-widget',
                    name: 'Community Widget'
                }
            },
            'container.innerHTML = "<div>ok</div>";'
        );
        expect(widgetType).toBe('community-widget');

        const id = window.EphemeraWidgets.add('community-widget', { x: 12, y: 16 });
        expect(id).toBeTruthy();
        expect(window.EphemeraApps.runUserApp).toHaveBeenCalledTimes(1);

        expect(window.EphemeraWidgets.unregisterExtensionWidget('com.community.widget')).toBe(true);
        const availableTypes = window.EphemeraWidgets.listAvailableWidgets().map((entry) => entry.type);
        expect(availableTypes).not.toContain('community-widget');
        expect(window.EphemeraWidgets.getWidgets().some((entry) => entry.type === 'community-widget')).toBe(false);
    });

    it('closes calendar widget without throwing and removes it from layout', () => {
        window.EphemeraWidgets.init();

        const id = window.EphemeraWidgets.add('calendar', { x: 24, y: 24 });
        expect(id).toBeTruthy();
        expect(window.EphemeraWidgets.getWidgets().some((entry) => entry.id === id)).toBe(true);

        const el = document.getElementById(id);
        expect(el).toBeTruthy();

        const closeBtn = el.querySelector('.widget-close');
        expect(closeBtn).toBeTruthy();
        closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(document.getElementById(id)).toBeNull();
        expect(window.EphemeraWidgets.getWidgets().some((entry) => entry.id === id)).toBe(false);
    });
});
