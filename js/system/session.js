const EphemeraSession = {
    SESSION_TIMEOUT: 30 * 60 * 1000,
    WARNING_THRESHOLD: 2 * 60 * 1000,
    
    masterKey: null,
    user: null,
    expiresAt: null,
    locked: false,
    
    _inactivityTimer: null,
    _warningTimer: null,
    _lastActivity: null,
    _onLockCallbacks: [],
    _onUnlockCallbacks: [],
    _onExpireCallbacks: [],

    init() {
        this._lastActivity = Date.now();
        this._startInactivityTimer();
        this._setupActivityListeners();
        
        console.info('[EphemeraSession] Initialized');
    },

    _loadStoredProfiles() {
        try {
            const raw = localStorage.getItem('ephemeraProfiles');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_err) {
            return [];
        }
    },

    _findStoredProfile() {
        const profiles = this._loadStoredProfiles();
        if (!this.user) return null;
        return profiles.find((profile) => (
            profile
            && (
                (profile.id && this.user.id && profile.id === this.user.id)
                || profile.name === this.user.name
            )
        )) || null;
    },

    async _deriveSessionKey(storedCredentials, options = {}) {
        if (!window.EphemeraCrypto || !storedCredentials) {
            return null;
        }

        const seedMode = storedCredentials.sessionKeyMode === 'seed'
            && storedCredentials.sessionKeySeed
            && storedCredentials.sessionKeySalt;
        if (seedMode) {
            return window.EphemeraCrypto.deriveKey(
                storedCredentials.sessionKeySeed,
                storedCredentials.sessionKeySalt
            );
        }

        const password = options.password;
        if (!password) return null;
        const salt = storedCredentials.hash?.salt || window.EphemeraCrypto.generateSalt();
        return window.EphemeraCrypto.deriveKey(password, salt);
    },

    _applyUnlockedState(storedCredentials) {
        this.user = {
            id: storedCredentials.id || storedCredentials.name,
            name: storedCredentials.name,
            avatar: storedCredentials.avatar,
            salt: storedCredentials.hash?.salt || storedCredentials.sessionKeySalt || null
        };

        this.expiresAt = Date.now() + this.SESSION_TIMEOUT;
        this.locked = false;
        this._lastActivity = Date.now();

        this._scheduleExpiration();
        this._startInactivityTimer();

        this._onUnlockCallbacks.forEach(cb => {
            try { cb(this.user); } catch (e) { console.error('[EphemeraSession] Unlock callback error:', e); }
        });

        if (window.EphemeraTelemetry) {
            window.EphemeraTelemetry.setUser(this.user);
        }
    },

    async unlock(password, storedCredentials) {
        if (!password || !storedCredentials) {
            return { success: false, error: 'Invalid credentials' };
        }

        const hasHash = !!storedCredentials.hash;
        const isValid = hasHash
            ? await window.EphemeraCrypto.verifyPassword(password, storedCredentials.hash)
            : true;
        
        if (!isValid) {
            return { success: false, error: 'Incorrect password' };
        }

        const key = await this._deriveSessionKey(storedCredentials, { password });
        if (!key) {
            return { success: false, error: 'Failed to derive session key' };
        }

        this.masterKey = key;
        this._applyUnlockedState(storedCredentials);
        
        console.info('[EphemeraSession] Session unlocked for:', this.user.name);
        return { success: true };
    },

    async unlockWithPasskey(storedCredentials, authResult) {
        if (!storedCredentials || !authResult?.credentialId) {
            return { success: false, error: 'Invalid passkey credentials' };
        }

        const passkeys = Array.isArray(storedCredentials.passkeys)
            ? storedCredentials.passkeys
            : [];
        const matchingPasskey = passkeys.find((entry) => (
            entry
            && (
                entry.credentialId === authResult.credentialId
                || entry.id === authResult.credentialId
                || entry.id === authResult.passkey?.id
            )
        ));
        if (!matchingPasskey) {
            return { success: false, error: 'Passkey does not match this profile' };
        }

        if (storedCredentials.sessionKeyMode !== 'seed') {
            return { success: false, error: 'Passkey unlock is not available for legacy profiles. Please unlock with password first.' };
        }

        const key = await this._deriveSessionKey(storedCredentials, {});
        if (!key) {
            return { success: false, error: 'Failed to derive session key from passkey profile' };
        }

        this.masterKey = key;
        this._applyUnlockedState(storedCredentials);

        console.info('[EphemeraSession] Session unlocked with passkey for:', this.user.name);
        return { success: true };
    },

    lock() {
        this.masterKey = null;
        this.locked = true;
        
        clearTimeout(this._inactivityTimer);
        clearTimeout(this._warningTimer);
        
        this._onLockCallbacks.forEach(cb => {
            try { cb(); } catch (e) { console.error('[EphemeraSession] Lock callback error:', e); }
        });
        
        console.info('[EphemeraSession] Session locked');
        this._showLockScreen();
    },

    logout() {
        this.masterKey = null;
        this.user = null;
        this.expiresAt = null;
        this.locked = false;
        
        clearTimeout(this._inactivityTimer);
        clearTimeout(this._warningTimer);
        
        this._onLockCallbacks.forEach(cb => {
            try { cb(); } catch (e) { console.error('[EphemeraSession] Lock callback error:', e); }
        });
        
        if (window.EphemeraTelemetry) {
            window.EphemeraTelemetry.setUser(null);
        }
        
        console.info('[EphemeraSession] Session logged out');
        
        if (window.location) {
            window.location.reload();
        }
    },

    isUnlocked() {
        return this.masterKey !== null && !this.locked && (!this.expiresAt || this.expiresAt > Date.now());
    },

    isLocked() {
        return this.locked || this.masterKey === null;
    },

    isExpired() {
        return this.expiresAt !== null && this.expiresAt <= Date.now();
    },

    getMasterKey() {
        if (!this.isUnlocked()) {
            return null;
        }
        return this.masterKey;
    },

    getUser() {
        return this.user;
    },

    extend() {
        if (!this.isUnlocked()) return false;
        
        this.expiresAt = Date.now() + this.SESSION_TIMEOUT;
        this._lastActivity = Date.now();
        this._scheduleExpiration();
        this._startInactivityTimer();
        
        return true;
    },

    getTimeRemaining() {
        if (!this.expiresAt) return 0;
        return Math.max(0, this.expiresAt - Date.now());
    },

    onLock(callback) {
        if (typeof callback === 'function') {
            this._onLockCallbacks.push(callback);
        }
    },

    onUnlock(callback) {
        if (typeof callback === 'function') {
            this._onUnlockCallbacks.push(callback);
        }
    },

    onExpire(callback) {
        if (typeof callback === 'function') {
            this._onExpireCallbacks.push(callback);
        }
    },

    _scheduleExpiration() {
        const remaining = this.getTimeRemaining();
        if (remaining <= 0) {
            this._handleExpiration();
            return;
        }

        setTimeout(() => {
            if (this.isExpired()) {
                this._handleExpiration();
            }
        }, remaining);
    },

    _handleExpiration() {
        console.info('[EphemeraSession] Session expired');
        
        this._onExpireCallbacks.forEach(cb => {
            try { cb(); } catch (e) { console.error('[EphemeraSession] Expire callback error:', e); }
        });
        
        this.lock();
    },

    _startInactivityTimer() {
        clearTimeout(this._inactivityTimer);
        clearTimeout(this._warningTimer);
        
        const warningTime = this.SESSION_TIMEOUT - this.WARNING_THRESHOLD;
        
        this._warningTimer = setTimeout(() => {
            if (this.isUnlocked()) {
                this._showWarning();
            }
        }, warningTime);
        
        this._inactivityTimer = setTimeout(() => {
            if (this.isUnlocked()) {
                this.lock();
            }
        }, this.SESSION_TIMEOUT);
    },

    _resetInactivityTimer() {
        this._lastActivity = Date.now();
        this._startInactivityTimer();
    },

    _setupActivityListeners() {
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
        
        const handler = () => {
            if (this.isUnlocked()) {
                this._resetInactivityTimer();
            }
        };
        
        events.forEach(event => {
            document.addEventListener(event, handler, { passive: true });
        });
    },

    _showWarning() {
        const remainingMs = this.getTimeRemaining();
        const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 1000 / 60));
        const message = `Your session will lock in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'} due to inactivity.`;

        const extendSession = () => {
            const extended = this.extend();
            if (extended && window.EphemeraNotifications?.success) {
                window.EphemeraNotifications.success(
                    'Session Extended',
                    'Your session timeout has been refreshed.'
                );
            }
            return extended;
        };

        const warningId = window.EphemeraNotifications?.warning?.(
            'Session Timeout',
            message,
            {
                duration: 0,
                actions: [
                    {
                        label: 'Stay Signed In',
                        primary: true,
                        onClick: () => {
                            extendSession();
                        }
                    }
                ]
            }
        );
        if (warningId !== null && warningId !== undefined) return;

        if (window.EphemeraDialog?.show) {
            window.EphemeraDialog.show({
                title: 'Session Timeout',
                message,
                icon: 'warning',
                buttons: [
                    { label: 'Lock Now', value: false },
                    { label: 'Stay Signed In', primary: true, value: true }
                ]
            }).then((staySignedIn) => {
                if (staySignedIn) {
                    extendSession();
                }
            }).catch(() => {
                // Ignore dialog failures and keep session timing behavior intact.
            });
        }
    },

    _getCurrentProfileForLockScreen() {
        const profile = this._findStoredProfile();
        if (!profile) return null;
        return {
            ...profile,
            id: profile.id || this.user?.id
        };
    },

    _showLockScreen() {
        let lockScreen = document.getElementById('session-lock-screen');
        
        if (!lockScreen) {
            lockScreen = document.createElement('div');
            lockScreen.id = 'session-lock-screen';
            lockScreen.style.cssText = `
                position: fixed;
                inset: 0;
                z-index: 999999;
                background: rgba(10, 10, 15, 0.98);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: 'Space Grotesk', sans-serif;
                color: #e8e8f0;
            `;
            document.body.appendChild(lockScreen);
        }
        
        const userName = this.user?.name || 'User';
        const avatar = this.user?.avatar;
        const avatarHTML = window.EphemeraLogin ? window.EphemeraLogin.getAvatarHTML(avatar, 80) : '<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#00d4aa,#00a8ff);"></div>';
        const profile = this._getCurrentProfileForLockScreen();
        const passkeyAvailable = !!(
            profile
            && Array.isArray(profile.passkeys)
            && profile.passkeys.length > 0
            && window.EphemeraWebAuthn?.isSupported?.()
        );
        
        lockScreen.innerHTML = `
            <div style="text-align: center; max-width: 400px;">
                ${avatarHTML}
                <h2 style="font-size: 1.5rem; margin-top: 20px; margin-bottom: 10px;">Session Locked</h2>
                <p style="color: #9898a8; margin-bottom: 30px;">Welcome back, ${window.EphemeraSanitize ? window.EphemeraSanitize.escapeHtml(userName) : userName}</p>
                
                <input type="password" id="lock-password" placeholder="Enter your password"
                    style="width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #e8e8f0; font-size: 1rem; outline: none; margin-bottom: 16px; box-sizing: border-box;">
                
                <div id="lock-error" style="color: #ff4d6a; margin-bottom: 16px; min-height: 20px;"></div>
                
                <button id="lock-unlock-btn" style="width: 100%; padding: 12px; background: #00d4aa; border: none; border-radius: 8px; color: #0a0a0f; font-size: 1rem; font-weight: 600; cursor: pointer;">
                    Unlock
                </button>
                ${passkeyAvailable ? `
                    <button id="lock-passkey-btn" style="width: 100%; margin-top: 10px; padding: 12px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: #e8e8f0; font-size: 0.95rem; cursor: pointer;">
                        Unlock with Passkey
                    </button>
                ` : ''}
                
                <button id="lock-logout-btn" style="margin-top: 16px; background: none; border: none; color: #9898a8; cursor: pointer; font-size: 0.9rem;">
                    Sign out
                </button>
            </div>
        `;
        
        lockScreen.style.display = 'flex';
        
        const passwordInput = lockScreen.querySelector('#lock-password');
        const unlockBtn = lockScreen.querySelector('#lock-unlock-btn');
        const passkeyBtn = lockScreen.querySelector('#lock-passkey-btn');
        const logoutBtn = lockScreen.querySelector('#lock-logout-btn');
        const errorEl = lockScreen.querySelector('#lock-error');
        
        const handleUnlock = async () => {
            const password = passwordInput.value;
            
            if (!password) {
                errorEl.textContent = 'Please enter your password';
                return;
            }
            
            unlockBtn.disabled = true;
            unlockBtn.textContent = 'Unlocking...';
            if (passkeyBtn) passkeyBtn.disabled = true;
            
            try {
                const activeProfile = this._getCurrentProfileForLockScreen();
                if (!activeProfile) {
                    throw new Error('Profile not found');
                }
                
                const result = await this.unlock(password, activeProfile);
                
                if (result.success) {
                    lockScreen.style.display = 'none';
                } else {
                    errorEl.textContent = result.error;
                    passwordInput.value = '';
                    unlockBtn.disabled = false;
                    unlockBtn.textContent = 'Unlock';
                    if (passkeyBtn) passkeyBtn.disabled = false;
                }
            } catch (e) {
                errorEl.textContent = 'Failed to unlock';
                unlockBtn.disabled = false;
                unlockBtn.textContent = 'Unlock';
                if (passkeyBtn) passkeyBtn.disabled = false;
            }
        };

        const handlePasskeyUnlock = async () => {
            if (!window.EphemeraWebAuthn?.authenticate) return;
            const activeProfile = this._getCurrentProfileForLockScreen();
            if (!activeProfile) {
                errorEl.textContent = 'Profile not found';
                return;
            }

            unlockBtn.disabled = true;
            if (passkeyBtn) {
                passkeyBtn.disabled = true;
                passkeyBtn.textContent = 'Waiting for passkey...';
            }
            errorEl.textContent = '';

            try {
                const auth = await window.EphemeraWebAuthn.authenticate(activeProfile);
                if (!auth.success) {
                    errorEl.textContent = auth.error || 'Passkey authentication failed';
                    return;
                }

                const result = await this.unlockWithPasskey(activeProfile, auth);
                if (result.success) {
                    lockScreen.style.display = 'none';
                } else {
                    errorEl.textContent = result.error || 'Failed to unlock with passkey';
                }
            } catch (_err) {
                errorEl.textContent = 'Failed to unlock with passkey';
            } finally {
                unlockBtn.disabled = false;
                unlockBtn.textContent = 'Unlock';
                if (passkeyBtn) {
                    passkeyBtn.disabled = false;
                    passkeyBtn.textContent = 'Unlock with Passkey';
                }
            }
        };
        
        unlockBtn.addEventListener('click', handleUnlock);
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleUnlock();
        });
        if (passkeyBtn) {
            passkeyBtn.addEventListener('click', handlePasskeyUnlock);
        }
        logoutBtn.addEventListener('click', () => this.logout());
        
        setTimeout(() => passwordInput.focus(), 100);
    }
};

window.EphemeraSession = EphemeraSession;
export default EphemeraSession;
