import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { mockIDB, stateMock, sessionMock } from './setup.js';
import EphemeraStorage from '../js/core/storage.js';
import EphemeraCrypto from '../js/core/crypto.js';
import EphemeraLogin from '../js/system/login.js';
import EphemeraDataManagement from '../js/system/data-management.js';
import EphemeraNetwork from '../js/system/network.js';
import '../js/system/filesystem.js';

const EphemeraFS = window.EphemeraFS;

window.EphemeraCrypto = EphemeraCrypto;
window.EphemeraValidate = window.EphemeraValidate || {
    isValidPassword: (password) => ({
        valid: !!password && password.length >= 12,
        strength: password && password.length >= 16 ? 4 : 3,
        errors: password && password.length >= 12 ? [] : ['Password must be at least 12 characters']
    })
};

window.EphemeraTelemetry = window.EphemeraTelemetry || {};
window.EphemeraTelemetry.setUser = window.EphemeraTelemetry.setUser || vi.fn();
window.EphemeraTelemetry.addBreadcrumb = window.EphemeraTelemetry.addBreadcrumb || vi.fn();

async function initStorage(profileId = 'smoke') {
    mockIDB._reset();
    EphemeraStorage.db = null;
    EphemeraStorage.profileId = profileId;
    EphemeraStorage.dbName = `EphemeraFS_${profileId}`;
    EphemeraStorage._writeQueue.pending = [];
    EphemeraStorage._writeQueue.isProcessing = false;
    await EphemeraStorage.init(profileId);
}

describe('Quick Smoke: Critical Flows', () => {
    beforeEach(async () => {
        sessionMock._setUnlocked(true, { type: 'secret' });
        stateMock._reset();
        localStorage.clear();
        sessionStorage.clear();
        global.fetch.mockReset();
        EphemeraLogin._profiles = null;
        EphemeraNetwork._resetProxyHealth();
        await initStorage();
        await EphemeraFS.init(stateMock.user.homeDir);
    });

    it('multi-profile isolation: separate home directories and FS roots are used', async () => {
        const profileA = await EphemeraLogin.createProfile('Alice', 'alice_secure_password_123');
        const profileB = await EphemeraLogin.createProfile('Bob', 'bob_secure_password_12345');

        expect(profileA.homeDir).toMatch(/^\/home\//);
        expect(profileB.homeDir).toMatch(/^\/home\//);
        expect(profileA.homeDir).not.toBe(profileB.homeDir);

        const overlayStub = { remove: vi.fn() };
        const resolveStub = vi.fn();

        await EphemeraLogin._loginWithProfile(profileA, overlayStub, resolveStub);
        expect(window.EphemeraState.user.homeDir).toBe(profileA.homeDir);
        await EphemeraFS.init(profileA.homeDir);
        expect(EphemeraDataManagement._getHomeDir()).toBe(profileA.homeDir);
        await EphemeraFS.writeFile(`${profileA.homeDir}/Documents/alice.txt`, 'alice-data');

        await EphemeraLogin._loginWithProfile(profileB, overlayStub, resolveStub);
        expect(window.EphemeraState.user.homeDir).toBe(profileB.homeDir);
        await EphemeraFS.init(profileB.homeDir);
        expect(EphemeraDataManagement._getHomeDir()).toBe(profileB.homeDir);
        await EphemeraFS.writeFile(`${profileB.homeDir}/Documents/bob.txt`, 'bob-data');

        expect(await EphemeraFS.exists(`${profileA.homeDir}/Documents/alice.txt`)).toBe(true);
        expect(await EphemeraFS.exists(`${profileB.homeDir}/Documents/bob.txt`)).toBe(true);
        expect(EphemeraFS.getTrashDir()).toBe(`${profileB.homeDir}/.trash`);
    });

    it('browser proxy behavior: default proxy uses failover, custom proxy fails once with custom error', async () => {
        const targetUrl = 'https://example.com/page?q=1';

        window.EphemeraState.settings.proxyEnabled = true;
        window.EphemeraState.settings.proxyUrl = 'https://api.allorigins.win/raw?url=';

        expect(EphemeraNetwork._hasCustomProxyConfigured()).toBe(false);

        global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(EphemeraNetwork.fetch(targetUrl)).rejects.toThrow(/All CORS proxies failed to respond/);
        expect(global.fetch).toHaveBeenCalledTimes(3);

        const firstAttemptUrl = String(global.fetch.mock.calls[0][0]);
        expect(firstAttemptUrl).toContain('allorigins.win/raw?url=');

        global.fetch.mockReset();
        window.EphemeraState.settings.proxyUrl = 'https://proxy.internal/fetch?u={url}';

        expect(EphemeraNetwork._hasCustomProxyConfigured()).toBe(true);

        global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(EphemeraNetwork.fetch(targetUrl)).rejects.toThrow(/Custom proxy failed to respond/);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(String(global.fetch.mock.calls[0][0])).toBe(
            'https://proxy.internal/fetch?u=' + encodeURIComponent(targetUrl)
        );
    });

    it('editor save shortcut scope: Ctrl/Cmd+S guard checks active code window and event target', () => {
        const testFilePath = fileURLToPath(import.meta.url);
        const repoRoot = path.resolve(path.dirname(testFilePath), '..');
        const codeSource = readFileSync(path.join(repoRoot, 'js/apps/code.js'), 'utf8');

        expect(codeSource).toContain("if (!(e.ctrlKey || e.metaKey) || key !== 's') return;");
        expect(codeSource).toContain('if (!windowEl || !windowEl.contains(e.target)) return;');
        expect(codeSource).toContain('if (window.EphemeraState?.activeWindowId !== windowId) return;');
        expect(codeSource).toContain('lifecycle.addListener(document, \'keydown\', ctrlSHandler);');
    });
});
