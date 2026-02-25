import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../js/system/webauthn.js';

const EphemeraWebAuthn = window.EphemeraWebAuthn;

function setCredentialMocks({ createImpl, getImpl } = {}) {
    const create = vi.fn(createImpl || (async () => ({
        id: 'cred-default',
        rawId: new Uint8Array([1, 2, 3]).buffer,
        response: {
            getTransports: () => ['internal']
        }
    })));
    const get = vi.fn(getImpl || (async () => ({
        id: 'cred-default',
        rawId: new Uint8Array([1, 2, 3]).buffer,
        response: {}
    })));

    Object.defineProperty(window, 'PublicKeyCredential', {
        value: {
            isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(async () => true)
        },
        configurable: true,
        writable: true
    });
    Object.defineProperty(navigator, 'credentials', {
        value: { create, get },
        configurable: true
    });

    return { create, get };
}

describe('EphemeraWebAuthn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setCredentialMocks();
    });

    it('detects support when public key credential APIs exist', () => {
        expect(EphemeraWebAuthn.isSupported()).toBe(true);
    });

    it('registers a credential and returns normalized passkey info', async () => {
        const profile = {
            id: 'user_1',
            name: 'User One',
            passkeys: []
        };

        const result = await EphemeraWebAuthn.registerCredential(profile);

        expect(result.success).toBe(true);
        expect(result.credential).toEqual(expect.objectContaining({
            id: 'cred-default',
            credentialId: 'AQID'
        }));
        expect(result.credential.transports).toEqual(['internal']);
    });

    it('authenticates with a registered credential', async () => {
        const profile = {
            id: 'user_2',
            name: 'User Two',
            passkeys: [{ id: 'cred-default', credentialId: 'AQID' }]
        };

        const result = await EphemeraWebAuthn.authenticate(profile);

        expect(result.success).toBe(true);
        expect(result.credentialId).toBe('AQID');
    });

    it('returns an error when no passkeys are registered for profile auth', async () => {
        const profile = {
            id: 'user_3',
            name: 'User Three',
            passkeys: []
        };

        const result = await EphemeraWebAuthn.authenticate(profile);

        expect(result.success).toBe(false);
        expect(result.error).toContain('No passkeys');
    });
});
