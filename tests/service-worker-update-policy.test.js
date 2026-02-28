import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('service worker update policy', () => {
    it('does not auto-activate updates from install handler', () => {
        const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
        const installBlock = source.match(
            /self\.addEventListener\('install'[\s\S]*?self\.addEventListener\('activate'/
        )?.[0] || '';

        expect(installBlock).not.toContain('self.skipWaiting()');
    });

    it('gates reload-on-controllerchange behind explicit update action', () => {
        const source = readFileSync(resolve(process.cwd(), 'js/main.js'), 'utf8');

        expect(source).toContain('let reloadForServiceWorkerUpdate = false;');
        expect(source).toContain('if (!reloadForServiceWorkerUpdate || didReloadForServiceWorkerUpdate) return;');
    });
});
