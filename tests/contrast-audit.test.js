import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function toRgb(color) {
    const value = String(color || '').trim().toLowerCase();
    if (!value) {
        throw new Error('Empty color value');
    }

    if (value.startsWith('#')) {
        let hex = value.slice(1);
        if (hex.length === 3) {
            hex = hex.split('').map((char) => char + char).join('');
        }
        if (hex.length !== 6) {
            throw new Error(`Unsupported hex color: ${value}`);
        }
        const num = Number.parseInt(hex, 16);
        return [
            (num >> 16) & 255,
            (num >> 8) & 255,
            num & 255
        ];
    }

    const match = value.match(/^rgba?\(([^)]+)\)$/);
    if (match) {
        const [r, g, b] = match[1].split(',').slice(0, 3).map((part) => Number.parseFloat(part.trim()));
        return [r, g, b];
    }

    throw new Error(`Unsupported color format: ${value}`);
}

function luminance(rgb) {
    const [r, g, b] = rgb.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
    });

    return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

function contrastRatio(foreground, background) {
    const l1 = luminance(toRgb(foreground));
    const l2 = luminance(toRgb(background));
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

describe('Core contrast audit (WCAG AA)', () => {
    let styleEl;

    const getVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const expectContrast = (fgVar, bgVar, min = 4.5) => {
        const ratio = contrastRatio(getVar(fgVar), getVar(bgVar));
        expect(ratio).toBeGreaterThanOrEqual(min);
    };

    beforeAll(() => {
        const css = readFileSync(resolve(process.cwd(), 'css/core.css'), 'utf8');
        styleEl = document.createElement('style');
        styleEl.setAttribute('data-test-style', 'core-contrast-audit');
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    });

    afterAll(() => {
        styleEl?.remove();
    });

    beforeEach(() => {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.removeAttribute('data-high-contrast');
        document.documentElement.classList.remove('high-contrast');
        document.body.classList.remove('high-contrast');
    });

    it('meets AA ratios for dark theme semantic tokens', () => {
        expectContrast('--fg-primary', '--bg-primary');
        expectContrast('--fg-secondary', '--bg-primary');
        expectContrast('--fg-muted', '--bg-primary');
        expectContrast('--accent', '--bg-primary');
        expectContrast('--danger', '--bg-primary');
        expectContrast('--warning', '--bg-primary');
        expectContrast('--accent-contrast', '--accent');
        expectContrast('--danger-contrast', '--danger');
        expectContrast('--warning-contrast', '--warning');
    });

    it('meets AA ratios for light theme semantic tokens', () => {
        document.documentElement.setAttribute('data-theme', 'light');

        expectContrast('--fg-primary', '--bg-primary');
        expectContrast('--fg-secondary', '--bg-primary');
        expectContrast('--fg-muted', '--bg-primary');
        expectContrast('--accent', '--bg-primary');
        expectContrast('--danger', '--bg-primary');
        expectContrast('--warning', '--bg-primary');
        expectContrast('--accent-contrast', '--accent');
        expectContrast('--danger-contrast', '--danger');
        expectContrast('--warning-contrast', '--warning');
    });

    it('meets AA ratios for high-contrast semantic tokens', () => {
        document.documentElement.setAttribute('data-high-contrast', 'true');
        document.documentElement.classList.add('high-contrast');
        document.body.classList.add('high-contrast');

        expectContrast('--fg-primary', '--bg-primary');
        expectContrast('--fg-secondary', '--bg-primary');
        expectContrast('--fg-muted', '--bg-primary');
        expectContrast('--accent', '--bg-primary');
        expectContrast('--danger', '--bg-primary');
        expectContrast('--warning', '--bg-primary');
        expectContrast('--accent-contrast', '--accent');
        expectContrast('--danger-contrast', '--danger');
        expectContrast('--warning-contrast', '--warning');
    });
});
