import { beforeEach, describe, expect, it, vi } from 'vitest';

let appDefs = {};
let storageMap = new Map();

function createLifecycleStub() {
    return {
        addListener(target, type, handler, options) {
            target.addEventListener(type, handler, options);
            return handler;
        },
        addInterval(id) { return id; },
        addTimeout(id) { return id; },
        addSubscription(unsub) { return unsub; },
        destroy() {}
    };
}

async function flushAsync(iterations = 5) {
    for (let i = 0; i < iterations; i++) {
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

describe('Password Vault recovery flow', () => {
    beforeEach(async () => {
        vi.resetModules();
        appDefs = {};
        storageMap = new Map();
        document.body.innerHTML = '';

        window.EphemeraApps = {
            register: vi.fn((app) => {
                appDefs[app.id] = app;
                return app;
            })
        };
        global.EphemeraApps = window.EphemeraApps;

        window.createAppLifecycle = createLifecycleStub;
        global.createAppLifecycle = createLifecycleStub;

        window.EphemeraSanitize = {
            escapeHtml: (value) => String(value),
            escapeAttr: (value) => String(value)
        };
        global.EphemeraSanitize = window.EphemeraSanitize;

        window.EphemeraStorage = {
            get: vi.fn(async (_store, key) => storageMap.get(key) || null),
            put: vi.fn(async (_store, value) => {
                storageMap.set(value.key, value);
            }),
            delete: vi.fn(async (_store, key) => {
                storageMap.delete(key);
            })
        };
        global.EphemeraStorage = window.EphemeraStorage;

        window.EphemeraCrypto = {
            hashPassword: vi.fn(async (password) => `hash:${password}`),
            verifyPassword: vi.fn(async (password, hash) => hash === `hash:${password}`),
            encryptWithPassword: vi.fn(async (value) => ({ ciphertext: String(value) })),
            decryptWithPassword: vi.fn(async (value) => value?.ciphertext ?? value)
        };
        global.EphemeraCrypto = window.EphemeraCrypto;

        window.EphemeraDialog = {
            confirm: vi.fn(async () => true),
            prompt: vi.fn(async () => 'ERASE')
        };
        global.EphemeraDialog = window.EphemeraDialog;

        window.EphemeraNotifications = {
            success: vi.fn(),
            error: vi.fn(),
            warning: vi.fn(),
            info: vi.fn()
        };
        global.EphemeraNotifications = window.EphemeraNotifications;

        await import('../js/apps/passwordmanager.js');
    });

    it('allows erasing existing vault and returns to create-password mode', async () => {
        storageMap.set('ephemera_vault_key_hash', {
            key: 'ephemera_vault_key_hash',
            hash: 'hash:old-password'
        });
        storageMap.set('ephemera_password_vault', {
            key: 'ephemera_password_vault',
            entries: [{ id: 'pw_1', title: 'Old', username: 'u', password: { ciphertext: 'x' } }]
        });

        const view = appDefs.passwordmanager.content('91');
        document.body.innerHTML = `<div class="window-content">${view.html}</div>`;
        await view.init();

        const resetBtn = document.getElementById('vault-reset-btn-91');
        expect(resetBtn).toBeTruthy();
        expect(resetBtn.style.display).toBe('inline-block');

        resetBtn.click();
        await flushAsync(20);

        expect(window.EphemeraDialog.confirm).toHaveBeenCalledTimes(1);
        expect(window.EphemeraDialog.prompt).toHaveBeenCalledTimes(1);
        expect(window.EphemeraStorage.delete).toHaveBeenCalledWith('metadata', 'ephemera_password_vault');
        expect(window.EphemeraStorage.delete).toHaveBeenCalledWith('metadata', 'ephemera_vault_key_hash');

        const title = document.getElementById('vault-lock-title-91');
        const unlockBtn = document.getElementById('vault-unlock-btn-91');
        expect(title.textContent).toBe('Create Master Password');
        expect(unlockBtn.textContent).toBe('Create Vault');
        expect(resetBtn.style.display).toBe('none');
        expect(window.EphemeraNotifications.success).toHaveBeenCalledWith(
            'Vault Reset',
            'You can now create a new master password.'
        );
    });

    it('does not erase vault when confirmation phrase is incorrect', async () => {
        storageMap.set('ephemera_vault_key_hash', {
            key: 'ephemera_vault_key_hash',
            hash: 'hash:old-password'
        });
        window.EphemeraDialog.prompt.mockResolvedValue('NOPE');

        const view = appDefs.passwordmanager.content('92');
        document.body.innerHTML = `<div class="window-content">${view.html}</div>`;
        await view.init();

        const resetBtn = document.getElementById('vault-reset-btn-92');
        resetBtn.click();
        await flushAsync(20);

        expect(window.EphemeraStorage.delete).not.toHaveBeenCalled();
        expect(window.EphemeraNotifications.info).toHaveBeenCalledWith(
            'Vault Reset Cancelled',
            'Confirmation phrase did not match.'
        );
    });

    it('requires confirmation password when creating a new vault', async () => {
        const view = appDefs.passwordmanager.content('93');
        document.body.innerHTML = `<div class="window-content">${view.html}</div>`;
        await view.init();

        const masterInput = document.getElementById('vault-master-input-93');
        const confirmInput = document.getElementById('vault-master-confirm-input-93');
        const unlockBtn = document.getElementById('vault-unlock-btn-93');
        const lockError = document.getElementById('vault-lock-error-93');
        const lockScreen = document.getElementById('vault-lock-93');

        expect(confirmInput).toBeTruthy();
        expect(document.getElementById('vault-confirm-field-93').style.display).toBe('block');

        masterInput.value = 'correct-horse-battery';
        confirmInput.value = 'wrong-confirmation';
        unlockBtn.click();
        await flushAsync(10);

        expect(lockError.textContent).toBe('Passwords do not match');
        expect(storageMap.get('ephemera_vault_key_hash')).toBeUndefined();
        expect(lockScreen.classList.contains('hidden')).toBe(false);

        confirmInput.value = 'correct-horse-battery';
        unlockBtn.click();
        await flushAsync(10);

        expect(storageMap.get('ephemera_vault_key_hash')?.hash).toBe('hash:correct-horse-battery');
        expect(lockScreen.classList.contains('hidden')).toBe(true);
    });

    it('toggles master-password visibility from the lock screen reveal button', async () => {
        const view = appDefs.passwordmanager.content('94');
        document.body.innerHTML = `<div class="window-content">${view.html}</div>`;
        await view.init();

        const masterInput = document.getElementById('vault-master-input-94');
        const confirmInput = document.getElementById('vault-master-confirm-input-94');
        const toggleMasterBtn = document.getElementById('vault-toggle-master-94');
        const toggleConfirmBtn = document.getElementById('vault-toggle-confirm-94');

        expect(masterInput.type).toBe('password');
        expect(confirmInput.type).toBe('password');
        expect(toggleMasterBtn).toBeTruthy();
        expect(toggleConfirmBtn).toBeTruthy();

        toggleMasterBtn.click();
        expect(masterInput.type).toBe('text');
        expect(confirmInput.type).toBe('text');
        expect(toggleMasterBtn.title).toBe('Hide password');

        toggleConfirmBtn.click();
        expect(masterInput.type).toBe('password');
        expect(confirmInput.type).toBe('password');
        expect(toggleMasterBtn.title).toBe('Show password');
        expect(toggleMasterBtn.isConnected).toBe(true);
    });
});
