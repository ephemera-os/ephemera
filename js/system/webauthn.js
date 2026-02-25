function base64UrlEncode(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
    if (!value || typeof value !== 'string') return null;
    const padded = value.replace(/-/g, '+').replace(/_/g, '/')
        + '==='.slice((value.length + 3) % 4);
    try {
        const binary = atob(padded);
        const out = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            out[i] = binary.charCodeAt(i);
        }
        return out;
    } catch (_err) {
        return null;
    }
}

function randomChallenge(size = 32) {
    const challenge = new Uint8Array(size);
    crypto.getRandomValues(challenge);
    return challenge;
}

function normalizePasskeys(profile) {
    if (!profile || !Array.isArray(profile.passkeys)) return [];
    return profile.passkeys
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
            ...entry,
            credentialId: String(entry.credentialId || ''),
            id: String(entry.id || entry.credentialId || '')
        }))
        .filter((entry) => entry.credentialId.length > 0);
}

const EphemeraWebAuthn = {
    RP_NAME: 'Ephemera',
    DEFAULT_TIMEOUT: 60_000,

    isSupported() {
        return !!(
            window.PublicKeyCredential
            && window.navigator?.credentials?.create
            && window.navigator?.credentials?.get
        );
    },

    async isPlatformAuthenticatorAvailable() {
        if (!this.isSupported()) return false;
        if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
            return true;
        }
        try {
            return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch (_err) {
            return false;
        }
    },

    toBase64Url(bytes) {
        return base64UrlEncode(bytes);
    },

    fromBase64Url(value) {
        return base64UrlDecode(value);
    },

    _toAllowCredentials(profile) {
        return normalizePasskeys(profile)
            .map((passkey) => {
                const id = this.fromBase64Url(passkey.credentialId);
                if (!id) return null;
                return {
                    type: 'public-key',
                    id,
                    transports: Array.isArray(passkey.transports) ? passkey.transports : undefined
                };
            })
            .filter(Boolean);
    },

    _profileUserId(profile) {
        const raw = String(profile?.id || profile?.name || 'ephemera-user');
        return new TextEncoder().encode(raw);
    },

    _rpId() {
        return window.location?.hostname || 'localhost';
    },

    async registerCredential(profile, options = {}) {
        if (!this.isSupported()) {
            return { success: false, error: 'Passkeys are not supported in this browser' };
        }
        if (!profile || (!profile.id && !profile.name)) {
            return { success: false, error: 'Profile is required for passkey registration' };
        }

        const excludeCredentials = this._toAllowCredentials(profile);
        const challenge = randomChallenge(32);

        const publicKey = {
            rp: {
                name: this.RP_NAME,
                id: this._rpId()
            },
            user: {
                id: this._profileUserId(profile),
                name: String(profile.name || profile.id),
                displayName: String(profile.name || profile.id)
            },
            challenge,
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 }
            ],
            authenticatorSelection: {
                userVerification: 'preferred',
                residentKey: 'preferred'
            },
            timeout: Number(options.timeout) || this.DEFAULT_TIMEOUT,
            attestation: 'none',
            excludeCredentials
        };

        try {
            const credential = await navigator.credentials.create({ publicKey });
            if (!credential || !credential.rawId) {
                return { success: false, error: 'Passkey registration was cancelled' };
            }

            const credentialId = this.toBase64Url(new Uint8Array(credential.rawId));
            const transports = typeof credential.response?.getTransports === 'function'
                ? credential.response.getTransports()
                : [];

            return {
                success: true,
                credential: {
                    id: String(credential.id || credentialId),
                    credentialId,
                    transports: Array.isArray(transports) ? transports : [],
                    createdAt: Date.now(),
                    label: String(options.label || '')
                }
            };
        } catch (error) {
            const name = error?.name || 'Error';
            if (name === 'NotAllowedError') {
                return { success: false, error: 'Passkey registration was cancelled' };
            }
            if (name === 'InvalidStateError') {
                return { success: false, error: 'This passkey is already registered for the profile' };
            }
            return { success: false, error: error?.message || 'Passkey registration failed' };
        }
    },

    async authenticate(profile, options = {}) {
        if (!this.isSupported()) {
            return { success: false, error: 'Passkeys are not supported in this browser' };
        }
        const allowCredentials = this._toAllowCredentials(profile);
        if (allowCredentials.length === 0) {
            return { success: false, error: 'No passkeys are registered for this profile' };
        }

        const challenge = randomChallenge(32);
        const publicKey = {
            challenge,
            allowCredentials,
            userVerification: 'preferred',
            timeout: Number(options.timeout) || this.DEFAULT_TIMEOUT,
            rpId: this._rpId()
        };

        try {
            const assertion = await navigator.credentials.get({ publicKey });
            if (!assertion || !assertion.rawId) {
                return { success: false, error: 'Passkey authentication was cancelled' };
            }

            const credentialId = this.toBase64Url(new Uint8Array(assertion.rawId));
            const passkey = normalizePasskeys(profile).find((entry) => (
                entry.credentialId === credentialId || entry.id === assertion.id
            ));

            if (!passkey) {
                return { success: false, error: 'Passkey does not match this profile' };
            }

            return {
                success: true,
                credentialId,
                assertion,
                passkey
            };
        } catch (error) {
            const name = error?.name || 'Error';
            if (name === 'NotAllowedError') {
                return { success: false, error: 'Passkey authentication was cancelled' };
            }
            return { success: false, error: error?.message || 'Passkey authentication failed' };
        }
    }
};

window.EphemeraWebAuthn = EphemeraWebAuthn;
export default EphemeraWebAuthn;
