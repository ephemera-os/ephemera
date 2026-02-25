import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const taskbarCss = readFileSync(resolve(process.cwd(), 'css/taskbar.css'), 'utf8');
const desktopCss = readFileSync(resolve(process.cwd(), 'css/desktop.css'), 'utf8');
const windowsCss = readFileSync(resolve(process.cwd(), 'css/windows.css'), 'utf8');
const coreCss = readFileSync(resolve(process.cwd(), 'css/core.css'), 'utf8');

describe('Zoom-safe desktop layout (200% readiness)', () => {
    it('keeps taskbar app strip horizontally scrollable instead of overflowing viewport', () => {
        expect(taskbarCss).toMatch(/#taskbar-apps\s*\{[\s\S]*overflow-x:\s*auto;/);
        expect(taskbarCss).toMatch(/#taskbar-apps\s*\{[\s\S]*min-width:\s*0;/);
        expect(taskbarCss).toMatch(/#taskbar-apps::\-webkit-scrollbar\s*\{[\s\S]*display:\s*none;/);
    });

    it('clamps start menu and search box widths to viewport space', () => {
        expect(taskbarCss).toMatch(/#start-menu\s*\{[\s\S]*width:\s*min\(340px,\s*calc\(100vw - 24px\)\);/);
        expect(desktopCss).toMatch(/#search-box\s*\{[\s\S]*width:\s*min\(500px,\s*calc\(100vw - 24px\)\);/);
        expect(desktopCss).toMatch(/#context-menu\s*\{[\s\S]*max-width:\s*calc\(100vw - 16px\);/);
    });

    it('constrains windows and long titles within viewport bounds', () => {
        expect(windowsCss).toMatch(/\.window\s*\{[\s\S]*max-width:\s*calc\(100vw - 12px\);/);
        expect(windowsCss).toMatch(/\.window-title\s*\{[\s\S]*text-overflow:\s*ellipsis;/);
        expect(windowsCss).toMatch(/\.window-title\s*\{[\s\S]*white-space:\s*nowrap;/);
    });

    it('applies tablet-sized enlargements only to coarse pointers', () => {
        expect(coreCss).toContain('@media (max-width: 1023px) and (min-width: 768px) and (pointer: coarse)');
        expect(taskbarCss).toContain('@media (max-width: 1023px) and (min-width: 768px) and (pointer: coarse)');
        expect(desktopCss).toContain('@media (max-width: 1023px) and (min-width: 768px) and (pointer: coarse)');
        expect(windowsCss).toContain('@media (max-width: 1023px) and (min-width: 768px) and (pointer: coarse)');
    });

    it('includes compact fine-pointer fallbacks for narrow desktop viewports', () => {
        expect(taskbarCss).toContain('@media (max-width: 1023px) and (min-width: 768px) and (pointer: fine)');
        expect(desktopCss).toContain('@media (max-width: 1023px) and (min-width: 768px) and (pointer: fine)');
        expect(windowsCss).toContain('@media (max-width: 1023px) and (min-width: 768px) and (pointer: fine)');
    });
});
