import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventsMock, sessionStorageMock } from './setup.js';
import EphemeraCrypto from '../js/core/crypto.js';

// Attach EphemeraCrypto to window (session/login use window.EphemeraCrypto)
window.EphemeraCrypto = EphemeraCrypto;

// EphemeraValidate mock
window.EphemeraValidate = {
    isValidPassword: vi.fn((pw) => {
        const valid = pw && pw.length >= 12;
        return {
            valid,
            strength: pw && pw.length >= 16 ? 4 : pw && pw.length >= 12 ? 3 : 1,
            errors: valid ? [] : ['Password must be at least 12 characters']
        };
    })
};

// EphemeraTelemetry mock
window.EphemeraTelemetry = {
    setUser: vi.fn(),
    addBreadcrumb: vi.fn(),
    captureException: vi.fn()
};

// EphemeraWebAuthn mock
window.EphemeraWebAuthn = {
    isSupported: vi.fn(() => true),
    isPlatformAuthenticatorAvailable: vi.fn(async () => true),
    registerCredential: vi.fn(async () => ({
        success: true,
        credential: {
            id: 'cred-default',
            credentialId: 'cred-default',
            transports: ['internal'],
            createdAt: Date.now()
        }
    })),
    authenticate: vi.fn(async () => ({
        success: true,
        credentialId: 'cred-default',
        passkey: { id: 'cred-default', credentialId: 'cred-default' }
    }))
};

import EphemeraSession from '../js/system/session.js';
import EphemeraLogin from '../js/system/login.js';

function mockWindowReload() {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadMock },
        writable: true,
        configurable: true
    });
    return reloadMock;
}

// --- EphemeraSession Tests ---

describe('EphemeraSession', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        EphemeraSession.masterKey = null;
        EphemeraSession.user = null;
        EphemeraSession.expiresAt = null;
        EphemeraSession.locked = false;
        EphemeraSession._onLockCallbacks = [];
        EphemeraSession._onUnlockCallbacks = [];
        EphemeraSession._onExpireCallbacks = [];
        clearTimeout(EphemeraSession._inactivityTimer);
        clearTimeout(EphemeraSession._warningTimer);
        mockWindowReload();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('isUnlocked / isLocked', () => {
        it('should be locked by default', () => {
            expect(EphemeraSession.isUnlocked()).toBe(false);
            expect(EphemeraSession.isLocked()).toBe(true);
        });

        it('should be unlocked when masterKey set and not locked', () => {
            EphemeraSession.masterKey = { type: 'secret' };
            EphemeraSession.locked = false;
            EphemeraSession.expiresAt = Date.now() + 100000;
            expect(EphemeraSession.isUnlocked()).toBe(true);
            expect(EphemeraSession.isLocked()).toBe(false);
        });

        it('should be locked when locked flag is true', () => {
            EphemeraSession.masterKey = { type: 'secret' };
            EphemeraSession.locked = true;
            expect(EphemeraSession.isUnlocked()).toBe(false);
            expect(EphemeraSession.isLocked()).toBe(true);
        });
    });

    describe('isExpired', () => {
        it('should not be expired when no expiresAt', () => {
            expect(EphemeraSession.isExpired()).toBe(false);
        });

        it('should not be expired when expiresAt is in the future', () => {
            EphemeraSession.expiresAt = Date.now() + 60000;
            expect(EphemeraSession.isExpired()).toBe(false);
        });

        it('should be expired when expiresAt is in the past', () => {
            EphemeraSession.expiresAt = Date.now() - 1;
            expect(EphemeraSession.isExpired()).toBe(true);
        });
    });

    describe('getMasterKey', () => {
        it('should return null when locked', () => {
            expect(EphemeraSession.getMasterKey()).toBeNull();
        });

        it('should return key when unlocked', () => {
            const key = { type: 'secret' };
            EphemeraSession.masterKey = key;
            EphemeraSession.locked = false;
            EphemeraSession.expiresAt = Date.now() + 100000;
            expect(EphemeraSession.getMasterKey()).toBe(key);
        });
    });

    describe('getUser', () => {
        it('should return null by default', () => {
            expect(EphemeraSession.getUser()).toBeNull();
        });

        it('should return user when set', () => {
            EphemeraSession.user = { id: '1', name: 'TestUser' };
            expect(EphemeraSession.getUser()).toEqual({ id: '1', name: 'TestUser' });
        });
    });

    describe('unlock', () => {
        it('should fail with invalid credentials', async () => {
            const result = await EphemeraSession.unlock(null, null);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid credentials');
        });

        it('should fail with empty password', async () => {
            const result = await EphemeraSession.unlock('', { hash: {} });
            expect(result.success).toBe(false);
        });

        it('should succeed with valid credentials', async () => {
            const password = 'testpassword123';
            const hashResult = await EphemeraCrypto.hashPassword(password);

            const result = await EphemeraSession.unlock(password, {
                id: 'test-user',
                name: 'Test User',
                avatar: { id: 'gradient1', colors: ['#00d4aa', '#00a8ff'] },
                hash: hashResult
            });

            expect(result.success).toBe(true);
            expect(EphemeraSession.user.name).toBe('Test User');
            expect(EphemeraSession.masterKey).not.toBeNull();
            expect(EphemeraSession.locked).toBe(false);
        });

        it('should fire onUnlock callbacks', async () => {
            const callback = vi.fn();
            EphemeraSession.onUnlock(callback);

            const password = 'testpassword123';
            const hashResult = await EphemeraCrypto.hashPassword(password);
            await EphemeraSession.unlock(password, {
                id: 'test',
                name: 'Test',
                hash: hashResult
            });

            expect(callback).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test' }));
        });

        it('should set expiresAt to SESSION_TIMEOUT from now', async () => {
            const password = 'testpassword123';
            const hashResult = await EphemeraCrypto.hashPassword(password);
            const before = Date.now();

            await EphemeraSession.unlock(password, {
                id: 'test',
                name: 'Test',
                hash: hashResult
            });

            expect(EphemeraSession.expiresAt).toBeGreaterThanOrEqual(before + EphemeraSession.SESSION_TIMEOUT);
        });
    });

    describe('unlockWithPasskey', () => {
        it('should unlock seed-mode profile with matching passkey', async () => {
            const salt = EphemeraCrypto.generateSalt();
            const profile = {
                id: 'seed-user',
                name: 'Seed User',
                sessionKeyMode: 'seed',
                sessionKeySeed: 'seed-secret-token',
                sessionKeySalt: salt,
                passkeys: [{ id: 'cred-seed', credentialId: 'cred-seed' }]
            };

            const result = await EphemeraSession.unlockWithPasskey(profile, {
                credentialId: 'cred-seed'
            });

            expect(result.success).toBe(true);
            expect(EphemeraSession.user).toEqual(expect.objectContaining({ id: 'seed-user', name: 'Seed User' }));
            expect(EphemeraSession.masterKey).not.toBeNull();
        });

        it('should reject passkey unlock for legacy profiles', async () => {
            const profile = {
                id: 'legacy-user',
                name: 'Legacy User',
                passkeys: [{ id: 'cred-legacy', credentialId: 'cred-legacy' }]
            };

            const result = await EphemeraSession.unlockWithPasskey(profile, {
                credentialId: 'cred-legacy'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('legacy profiles');
        });
    });

    describe('lock', () => {
        it('should clear masterKey and set locked', () => {
            EphemeraSession.masterKey = { type: 'secret' };
            EphemeraSession.locked = false;
            EphemeraSession.lock();

            expect(EphemeraSession.masterKey).toBeNull();
            expect(EphemeraSession.locked).toBe(true);
        });

        it('should fire onLock callbacks', () => {
            const callback = vi.fn();
            EphemeraSession.onLock(callback);
            EphemeraSession.lock();

            expect(callback).toHaveBeenCalled();
        });
    });

    describe('logout', () => {
        it('should clear all session state', () => {
            EphemeraSession.masterKey = { type: 'secret' };
            EphemeraSession.user = { id: '1', name: 'User' };
            EphemeraSession.expiresAt = Date.now() + 100000;

            EphemeraSession.logout();

            expect(EphemeraSession.masterKey).toBeNull();
            expect(EphemeraSession.user).toBeNull();
            expect(EphemeraSession.expiresAt).toBeNull();
            expect(EphemeraSession.locked).toBe(false);
        });

        it('should fire onLock callbacks', () => {
            const callback = vi.fn();
            EphemeraSession.onLock(callback);
            EphemeraSession.logout();
            expect(callback).toHaveBeenCalled();
        });

        it('should reload the page', () => {
            const reloadMock = mockWindowReload();
            EphemeraSession.logout();
            expect(reloadMock).toHaveBeenCalled();
        });
    });

    describe('extend', () => {
        it('should return false when locked', () => {
            expect(EphemeraSession.extend()).toBe(false);
        });

        it('should extend session timeout when unlocked', () => {
            EphemeraSession.masterKey = { type: 'secret' };
            EphemeraSession.locked = false;
            EphemeraSession.expiresAt = Date.now() + 1000;

            const before = Date.now();
            const result = EphemeraSession.extend();

            expect(result).toBe(true);
            expect(EphemeraSession.expiresAt).toBeGreaterThanOrEqual(before + EphemeraSession.SESSION_TIMEOUT);
        });
    });

    describe('getTimeRemaining', () => {
        it('should return 0 when no expiresAt', () => {
            expect(EphemeraSession.getTimeRemaining()).toBe(0);
        });

        it('should return remaining time', () => {
            EphemeraSession.expiresAt = Date.now() + 60000;
            const remaining = EphemeraSession.getTimeRemaining();
            expect(remaining).toBeGreaterThan(0);
            expect(remaining).toBeLessThanOrEqual(60000);
        });

        it('should return 0 when expired', () => {
            EphemeraSession.expiresAt = Date.now() - 1;
            expect(EphemeraSession.getTimeRemaining()).toBe(0);
        });
    });

    describe('timeout warning', () => {
        it('should warn 2 minutes before inactivity lock', () => {
            expect(EphemeraSession.WARNING_THRESHOLD).toBe(2 * 60 * 1000);
        });

        it('should show warning action that extends session and avoids original lock deadline', () => {
            const lockSpy = vi.spyOn(EphemeraSession, 'lock');

            EphemeraSession.masterKey = { type: 'secret' };
            EphemeraSession.locked = false;
            EphemeraSession.expiresAt = Date.now() + EphemeraSession.SESSION_TIMEOUT;

            EphemeraSession._startInactivityTimer();
            vi.advanceTimersByTime(EphemeraSession.SESSION_TIMEOUT - EphemeraSession.WARNING_THRESHOLD);

            expect(window.EphemeraNotifications.warning).toHaveBeenCalledTimes(1);
            const warningOptions = window.EphemeraNotifications.warning.mock.calls[0][2];
            expect(warningOptions.duration).toBe(0);
            expect(Array.isArray(warningOptions.actions)).toBe(true);
            expect(warningOptions.actions[0].label).toBe('Stay Signed In');

            warningOptions.actions[0].onClick();
            expect(window.EphemeraNotifications.success).toHaveBeenCalledWith(
                'Session Extended',
                'Your session timeout has been refreshed.'
            );
            expect(EphemeraSession.getTimeRemaining()).toBeGreaterThan(EphemeraSession.SESSION_TIMEOUT - 1000);

            // The original timeout should not lock the session after extension.
            vi.advanceTimersByTime(EphemeraSession.WARNING_THRESHOLD + 1000);
            expect(lockSpy).not.toHaveBeenCalled();
            lockSpy.mockRestore();
        });

        it('should fallback to dialog when notifications are unavailable', async () => {
            window.EphemeraNotifications.warning.mockReturnValueOnce(null);
            window.EphemeraDialog = {
                show: vi.fn(() => Promise.resolve(true))
            };

            EphemeraSession._showWarning();
            await Promise.resolve();
            await Promise.resolve();

            expect(window.EphemeraDialog.show).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Session Timeout',
                icon: 'warning'
            }));
            delete window.EphemeraDialog;
        });
    });

    describe('callback registration', () => {
        it('should register onLock callback', () => {
            const fn = () => {};
            EphemeraSession.onLock(fn);
            expect(EphemeraSession._onLockCallbacks).toContain(fn);
        });

        it('should register onUnlock callback', () => {
            const fn = () => {};
            EphemeraSession.onUnlock(fn);
            expect(EphemeraSession._onUnlockCallbacks).toContain(fn);
        });

        it('should register onExpire callback', () => {
            const fn = () => {};
            EphemeraSession.onExpire(fn);
            expect(EphemeraSession._onExpireCallbacks).toContain(fn);
        });

        it('should ignore non-function callbacks', () => {
            EphemeraSession.onLock('not a function');
            expect(EphemeraSession._onLockCallbacks.length).toBe(0);
        });
    });
});

// --- EphemeraLogin Tests ---

describe('EphemeraLogin', () => {
    beforeEach(() => {
        EphemeraLogin._profiles = null;
        EphemeraLogin._failedAttempts = {};
        localStorage.clear();
        sessionStorage.clear();
        vi.clearAllMocks();
    });

    describe('hasProfiles', () => {
        it('should return false when no profiles', () => {
            expect(EphemeraLogin.hasProfiles()).toBeFalsy();
        });

        it('should return true when profiles exist', () => {
            EphemeraLogin._profiles = [{ name: 'User1' }];
            expect(EphemeraLogin.hasProfiles()).toBe(true);
        });
    });

    describe('createProfile', () => {
        it('should create a new profile with hashed password', async () => {
            const profile = await EphemeraLogin.createProfile('TestUser', 'securepassword123');

            expect(profile.name).toBe('TestUser');
            expect(profile.id).toBeTruthy();
            expect(profile.hash).toBeDefined();
            expect(profile.avatar).toBeDefined();
            expect(profile.createdAt).toBeTypeOf('number');
        });

        it('should provision seed-based session key material', async () => {
            const profile = await EphemeraLogin.createProfile('SeedUser', 'securepassword123');

            expect(profile.sessionKeyMode).toBe('seed');
            expect(typeof profile.sessionKeySeed).toBe('string');
            expect(typeof profile.sessionKeySalt).toBe('string');
            expect(Array.isArray(profile.passkeys)).toBe(true);
        });

        it('should save profile to localStorage', async () => {
            await EphemeraLogin.createProfile('TestUser', 'securepassword123');
            const saved = JSON.parse(localStorage.getItem('ephemeraProfiles'));
            expect(saved.length).toBe(1);
            expect(saved[0].name).toBe('TestUser');
        });

        it('should reject duplicate profile names (case insensitive)', async () => {
            await EphemeraLogin.createProfile('TestUser', 'securepassword123');
            await expect(EphemeraLogin.createProfile('testuser', 'anotherpassword123'))
                .rejects.toThrow('already exists');
        });

        it('should reject short passwords', async () => {
            await expect(EphemeraLogin.createProfile('User', 'short'))
                .rejects.toThrow('at least 12 characters');
        });

        it('should reject empty name', async () => {
            await expect(EphemeraLogin.createProfile('', 'securepassword123'))
                .rejects.toThrow('required');
        });

        it('should reject name over 32 characters', async () => {
            const longName = 'a'.repeat(33);
            await expect(EphemeraLogin.createProfile(longName, 'securepassword123'))
                .rejects.toThrow('between 1 and 32');
        });

        it('should register passkey during profile creation when requested', async () => {
            window.EphemeraWebAuthn.registerCredential.mockResolvedValueOnce({
                success: true,
                credential: {
                    id: 'cred-profile',
                    credentialId: 'cred-profile',
                    transports: ['internal'],
                    createdAt: Date.now()
                }
            });

            const profile = await EphemeraLogin.createProfile('PasskeyUser', 'securepassword123', null, {
                registerPasskey: true
            });

            expect(window.EphemeraWebAuthn.registerCredential).toHaveBeenCalled();
            expect(profile.passkeys.length).toBe(1);
            expect(profile.passkeys[0].credentialId).toBe('cred-profile');
        });

        it('should accept custom avatar', async () => {
            const avatar = { id: 'cat', emoji: '🐱', colors: null };
            const profile = await EphemeraLogin.createProfile('CatUser', 'securepassword123', avatar);
            expect(profile.avatar.id).toBe('cat');
        });
    });

    describe('registerPasskey', () => {
        it('should register a passkey for an existing profile', async () => {
            const profile = await EphemeraLogin.createProfile('PasskeyOwner', 'securepassword123');

            window.EphemeraWebAuthn.registerCredential.mockResolvedValueOnce({
                success: true,
                credential: {
                    id: 'cred-owner-1',
                    credentialId: 'cred-owner-1',
                    transports: ['internal'],
                    createdAt: Date.now()
                }
            });

            const result = await EphemeraLogin.registerPasskey(profile.id);

            expect(result.success).toBe(true);
            expect(EphemeraLogin._profiles[0].passkeys.length).toBe(1);
        });

        it('should reject duplicate passkey registration', async () => {
            const profile = await EphemeraLogin.createProfile('DupOwner', 'securepassword123');
            profile.passkeys.push({ id: 'dup-cred', credentialId: 'dup-cred' });

            window.EphemeraWebAuthn.registerCredential.mockResolvedValueOnce({
                success: true,
                credential: {
                    id: 'dup-cred',
                    credentialId: 'dup-cred',
                    transports: ['internal'],
                    createdAt: Date.now()
                }
            });

            const result = await EphemeraLogin.registerPasskey(profile.id);

            expect(result.success).toBe(false);
            expect(result.error).toContain('already registered');
        });
    });

    describe('getProfiles', () => {
        it('should return empty array when no profiles', () => {
            expect(EphemeraLogin.getProfiles()).toEqual([]);
        });

        it('should return sanitized profile info', async () => {
            await EphemeraLogin.createProfile('User1', 'securepassword123');
            const profiles = EphemeraLogin.getProfiles();

            expect(profiles.length).toBe(1);
            expect(profiles[0].name).toBe('User1');
            expect(profiles[0].hasPassword).toBe(true);
            expect(profiles[0]).not.toHaveProperty('hash');
            expect(profiles[0]).not.toHaveProperty('password');
        });
    });

    describe('removeProfile', () => {
        it('should remove a profile', async () => {
            await EphemeraLogin.createProfile('User1', 'securepassword123');
            await EphemeraLogin.createProfile('User2', 'securepassword456');
            expect(EphemeraLogin.getProfiles().length).toBe(2);

            EphemeraLogin.removeProfile('User1');
            expect(EphemeraLogin.getProfiles().length).toBe(1);
            expect(EphemeraLogin.getProfiles()[0].name).toBe('User2');
        });

        it('should do nothing if profile does not exist', () => {
            EphemeraLogin._profiles = [{ name: 'Keep' }];
            EphemeraLogin.removeProfile('Nonexistent');
            expect(EphemeraLogin._profiles.length).toBe(1);
        });
    });

    describe('updatePassword', () => {
        it('should update password for existing profile', async () => {
            await EphemeraLogin.createProfile('User1', 'securepassword123');
            const result = await EphemeraLogin.updatePassword('User1', 'newpassword123456');
            expect(result).toBe(true);
        });

        it('should return false for nonexistent profile', async () => {
            const result = await EphemeraLogin.updatePassword('Nonexistent', 'newpassword123456');
            expect(result).toBe(false);
        });
    });

    describe('getAvatarHTML', () => {
        it('should return gradient avatar HTML', () => {
            const html = EphemeraLogin.getAvatarHTML({ colors: ['#ff0', '#0ff'] }, 48);
            expect(html).toContain('48px');
            expect(html).toContain('#ff0');
            expect(html).toContain('border-radius:50%');
        });

        it('should return emoji avatar HTML', () => {
            const html = EphemeraLogin.getAvatarHTML({ emoji: '🐱' }, 64);
            expect(html).toContain('🐱');
            expect(html).toContain('64px');
        });

        it('should use default avatar when null', () => {
            const html = EphemeraLogin.getAvatarHTML(null, 32);
            expect(html).toContain('32px');
        });
    });

    describe('lockout system', () => {
        it('should start with no failed attempts', () => {
            expect(EphemeraLogin._getFailedAttempts('TestUser')).toBe(0);
        });

        it('should record failed attempts', () => {
            EphemeraLogin._recordFailedAttempt('TestUser');
            expect(EphemeraLogin._getFailedAttempts('TestUser')).toBe(1);
            EphemeraLogin._recordFailedAttempt('TestUser');
            expect(EphemeraLogin._getFailedAttempts('TestUser')).toBe(2);
        });

        it('should clear failed attempts', () => {
            EphemeraLogin._recordFailedAttempt('TestUser');
            EphemeraLogin._recordFailedAttempt('TestUser');
            EphemeraLogin._clearFailedAttempts('TestUser');
            expect(EphemeraLogin._getFailedAttempts('TestUser')).toBe(0);
        });

        it('should lock account after MAX_LOGIN_ATTEMPTS', () => {
            for (let i = 0; i < EphemeraLogin.MAX_LOGIN_ATTEMPTS; i++) {
                EphemeraLogin._recordFailedAttempt('TestUser');
            }
            EphemeraLogin._lockAccount('TestUser');
            const info = EphemeraLogin._getLockoutInfo('TestUser');
            expect(info.locked).toBe(true);
            expect(info.remainingMinutes).toBeGreaterThan(0);
        });

        it('should not be locked initially', () => {
            const info = EphemeraLogin._getLockoutInfo('TestUser');
            expect(info.locked).toBe(false);
        });
    });

    describe('init', () => {
        it('should load profiles from localStorage', () => {
            const profiles = [{ name: 'Saved', hash: {}, avatar: { id: 'cat', emoji: '🐱' } }];
            localStorage.setItem('ephemeraProfiles', JSON.stringify(profiles));

            EphemeraLogin.init();
            expect(EphemeraLogin.hasProfiles()).toBe(true);
            expect(EphemeraLogin._profiles[0].name).toBe('Saved');
        });

        it('should handle invalid JSON gracefully', () => {
            localStorage.setItem('ephemeraProfiles', 'invalid json');
            EphemeraLogin.init();
            expect(EphemeraLogin._profiles).toBeNull();
        });

        it('should handle missing profiles', () => {
            EphemeraLogin.init();
            expect(EphemeraLogin._profiles).toBeNull();
        });
    });

    describe('_verifyPassword', () => {
        it('should verify hashed password', async () => {
            const password = 'securepassword123';
            const hash = await EphemeraCrypto.hashPassword(password);
            const result = await EphemeraLogin._verifyPassword(password, { hash });
            expect(result).toBe(true);
        });

        it('should verify legacy plaintext password', async () => {
            const result = await EphemeraLogin._verifyPassword('mypassword', { password: 'mypassword' });
            expect(result).toBe(true);
        });

        it('should reject wrong plaintext password', async () => {
            const result = await EphemeraLogin._verifyPassword('wrong', { password: 'correct' });
            expect(result).toBe(false);
        });

        it('should return true when no password set', async () => {
            const result = await EphemeraLogin._verifyPassword('anything', {});
            expect(result).toBe(true);
        });
    });
});
