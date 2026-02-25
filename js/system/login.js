const EphemeraLogin = {
    _profiles: null,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000,
    _failedAttempts: {},
    SESSION_KEY_MODE_SEED: 'seed',

    AVATARS: [
        { id: 'gradient1', colors: ['#00d4aa', '#00a8ff'], emoji: null },
        { id: 'gradient2', colors: ['#ff6b6b', '#feca57'], emoji: null },
        { id: 'gradient3', colors: ['#a55eea', '#5f27cd'], emoji: null },
        { id: 'gradient4', colors: ['#ff9ff3', '#f368e0'], emoji: null },
        { id: 'gradient5', colors: ['#54a0ff', '#2e86de'], emoji: null },
        { id: 'cat', colors: null, emoji: '🐱' },
        { id: 'dog', colors: null, emoji: '🐕' },
        { id: 'fox', colors: null, emoji: '🦊' },
        { id: 'panda', colors: null, emoji: '🐼' },
        { id: 'koala', colors: null, emoji: '🐨' },
        { id: 'owl', colors: null, emoji: '🦉' },
        { id: 'penguin', colors: null, emoji: '🐧' },
        { id: 'rocket', colors: null, emoji: '🚀' },
        { id: 'star', colors: null, emoji: '⭐' },
        { id: 'fire', colors: null, emoji: '🔥' },
        { id: 'gem', colors: null, emoji: '💎' }
    ],

    init() {
        const saved = localStorage.getItem('ephemeraProfiles');
        if (saved) {
            try {
                this._profiles = JSON.parse(saved);
                this._migrateOldPasswords();
            } catch (e) {
                console.error('[EphemeraLogin] Failed to load profiles:', e);
                this._profiles = null;
            }
        }
    },

    async _migrateOldPasswords() {
        if (!this._profiles) return;
        
        let needsSave = false;
        
        for (const profile of this._profiles) {
            if (!profile.id) {
                profile.id = this._generateProfileId(profile.name);
                needsSave = true;
            }
            if (!profile.homeDir) {
                profile.homeDir = this._getProfileHomeDir(profile);
                needsSave = true;
            }
            if (profile.password && !profile.hash) {
                const hashResult = await window.EphemeraCrypto.hashPassword(profile.password);
                profile.hash = hashResult;
                delete profile.password;
                needsSave = true;
            }
            if (!profile.avatar) {
                profile.avatar = this.AVATARS[Math.floor(Math.random() * this.AVATARS.length)];
                needsSave = true;
            }
            if (!Array.isArray(profile.passkeys)) {
                profile.passkeys = [];
                needsSave = true;
            }
            if (profile.sessionKeySeed && profile.sessionKeySalt && !profile.sessionKeyMode) {
                profile.sessionKeyMode = this.SESSION_KEY_MODE_SEED;
                needsSave = true;
            }
        }
        
        if (needsSave) {
            this._saveProfiles();
        }
    },

    _generateProfileId(seed = 'profile') {
        const safeSeed = String(seed || 'profile')
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '')
            .slice(0, 12) || 'profile';
        const randomPart = Math.random().toString(36).slice(2, 10);
        const timePart = Date.now().toString(36);
        return `${safeSeed}_${timePart}_${randomPart}`;
    },

    _getProfileHomeDir(profileOrId) {
        const id = typeof profileOrId === 'string' ? profileOrId : profileOrId?.id;
        const safeId = String(id || 'user')
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '')
            .slice(0, 48) || 'user';
        return `/home/${safeId}`;
    },

    _saveProfiles() {
        try {
            localStorage.setItem('ephemeraProfiles', JSON.stringify(this._profiles));
        } catch (e) {
            console.error('[EphemeraLogin] Failed to save profiles:', e);
        }
    },

    _findProfile(profileRef) {
        if (!profileRef || !Array.isArray(this._profiles)) return null;
        const id = typeof profileRef === 'string'
            ? profileRef
            : (profileRef.id || profileRef.name);
        if (!id) return null;
        return this._profiles.find((profile) => (
            profile
            && (
                profile.id === id
                || profile.name === id
            )
        )) || null;
    },

    _hasPasskeys(profile) {
        return !!(profile && Array.isArray(profile.passkeys) && profile.passkeys.length > 0);
    },

    async canUsePasskeys() {
        if (!window.EphemeraWebAuthn?.isSupported) return false;
        if (!window.EphemeraWebAuthn.isSupported()) return false;
        if (!window.EphemeraWebAuthn.isPlatformAuthenticatorAvailable) return true;
        return window.EphemeraWebAuthn.isPlatformAuthenticatorAvailable();
    },

    async registerPasskey(profileRef, options = {}) {
        const profile = this._findProfile(profileRef);
        if (!profile) {
            return { success: false, error: 'Profile not found' };
        }
        if (!window.EphemeraWebAuthn?.registerCredential) {
            return { success: false, error: 'Passkey module is unavailable' };
        }

        const result = await window.EphemeraWebAuthn.registerCredential(profile, options);
        if (!result.success || !result.credential) {
            return result;
        }

        if (!Array.isArray(profile.passkeys)) {
            profile.passkeys = [];
        }

        const exists = profile.passkeys.some((entry) => (
            entry
            && (
                entry.credentialId === result.credential.credentialId
                || entry.id === result.credential.id
            )
        ));
        if (exists) {
            return { success: false, error: 'This passkey is already registered for the profile' };
        }

        profile.passkeys.push(result.credential);
        this._saveProfiles();
        return { success: true, credential: result.credential };
    },

    touchPasskey(profileRef, credentialId) {
        const profile = this._findProfile(profileRef);
        if (!profile || !credentialId || !Array.isArray(profile.passkeys)) return;
        const passkey = profile.passkeys.find((entry) => (
            entry
            && (
                entry.credentialId === credentialId
                || entry.id === credentialId
            )
        ));
        if (!passkey) return;
        passkey.lastUsedAt = Date.now();
        this._saveProfiles();
    },

    hasProfiles() {
        return this._profiles && this._profiles.length > 0;
    },

    _completeBootLoginMetric(screen) {
        const span = window.__ephemeraBootToLoginSpan;
        if (!span || !window.EphemeraPerformance?.end) return;
        window.EphemeraPerformance.end(span, { screen: String(screen || 'login-screen') });
        window.__ephemeraBootToLoginSpan = null;
    },

    getAvatarHTML(avatar, size = 64) {
        if (!avatar) {
            avatar = this.AVATARS[0];
        }
        
        if (avatar.emoji) {
            return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:${size * 0.5}px;">
                ${avatar.emoji}
            </div>`;
        }
        
        const colors = avatar.colors || ['#00d4aa', '#00a8ff'];
        return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${colors[0]},${colors[1]});display:flex;align-items:center;justify-content:center;">
        </div>`;
    },

    show() {
        return new Promise(async (resolve) => {
            const overlay = document.createElement('div');
            overlay.id = 'login-screen';
            overlay.style.cssText = `position:fixed;inset:0;z-index:200000;background:#0a0a0f;
                display:flex;flex-direction:column;align-items:center;justify-content:center;
                font-family:'Space Grotesk',sans-serif;color:#e8e8f0;`;

            if (!this.hasProfiles()) {
                overlay.innerHTML = `
                    <h1 style="font-size:2.5rem;background:linear-gradient(135deg,#00d4aa,#00a8ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px;">Ephemera</h1>
                    <p style="color:#9898a8;margin-bottom:28px;font-size:0.9rem;max-width:420px;text-align:center;line-height:1.5;">
                        Create a new local profile, or import an existing encrypted profile export.
                    </p>
                    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                        <button id="create-profile-btn" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:14px 28px;color:#e8e8f0;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;gap:8px;transition:all 0.2s;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Create New Account
                        </button>
                        <input type="file" id="import-profile-file" accept=".ephx" style="display:none;">
                        <button id="import-profile-btn" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:14px 28px;color:#e8e8f0;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;gap:8px;transition:all 0.2s;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            Import Profile
                        </button>
                    </div>
                `;

                document.body.appendChild(overlay);
                this._completeBootLoginMetric('login-screen');

                const createBtn = overlay.querySelector('#create-profile-btn');
                const importBtn = overlay.querySelector('#import-profile-btn');
                const importInput = overlay.querySelector('#import-profile-file');

                createBtn?.addEventListener('click', async () => {
                    const result = await this.showCreateProfileDialog(overlay);
                    if (result?.profile && result.password) {
                        if (window.EphemeraSession) {
                            const unlockResult = await window.EphemeraSession.unlock(result.password, result.profile);
                            if (!unlockResult.success) {
                                window.EphemeraNotifications?.error?.('Unlock Failed', unlockResult.error || 'Unable to unlock new profile.');
                                return;
                            }
                        }
                        await this._loginWithProfile(result.profile, overlay, resolve);
                    }
                });

                importBtn?.addEventListener('click', () => importInput?.click());
                importInput?.addEventListener('change', async (e) => {
                    const file = e.target?.files?.[0];
                    try {
                        if (file && window.EphemeraDataManagement?.importProfile) {
                            await window.EphemeraDataManagement.importProfile(file);
                        }
                    } finally {
                        if (importInput) importInput.value = '';
                    }
                });

                return;
            }

            const profiles = this._profiles;
            const passkeysSupported = await this.canUsePasskeys();
            overlay.innerHTML = `
                <h1 style="font-size:2.5rem;background:linear-gradient(135deg,#00d4aa,#00a8ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px;">Ephemera</h1>
                <p style="color:#9898a8;margin-bottom:40px;font-size:0.9rem;">Select your profile to continue</p>
                <div id="profiles-grid" style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;max-width:600px;margin-bottom:30px;">
                    ${profiles.map((p, i) => `
                        <div class="login-profile" data-index="${i}" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px 30px;
                            background:rgba(255,255,255,0.05);border:2px solid transparent;border-radius:16px;cursor:pointer;transition:all 0.2s;min-width:100px;">
                            ${this.getAvatarHTML(p.avatar, 64)}
                            <span style="font-size:0.95rem;font-weight:500;">${window.EphemeraSanitize ? window.EphemeraSanitize.escapeHtml(p.name) : p.name}</span>
                            ${this._hasPasskeys(p) ? '<span style="font-size:0.72rem;color:#74e3c9;">Passkey enabled</span>' : ''}
                        </div>
                    `).join('')}
                </div>
                <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                    <button id="create-profile-btn" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:14px 28px;color:#e8e8f0;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;gap:8px;transition:all 0.2s;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Create New Account
                    </button>
                    <input type="file" id="import-profile-file" accept=".ephx" style="display:none;">
                    <button id="import-profile-btn" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:14px 28px;color:#e8e8f0;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;gap:8px;transition:all 0.2s;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Import Profile
                    </button>
                </div>
                <div id="login-password-area" style="display:none;text-align:center;margin-top:20px;">
                    <p id="selected-profile-name" style="font-size:1.1rem;margin-bottom:16px;color:#e8e8f0;"></p>
                    <input type="password" id="login-password" placeholder="Enter password..."
                        style="padding:12px 18px;width:280px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
                        border-radius:10px;color:#e8e8f0;font-size:1rem;outline:none;text-align:center;" autocomplete="current-password">
                    <div id="login-error" style="color:#ff4d6a;font-size:0.85rem;margin-top:10px;min-height:24px;"></div>
                    <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;">
                        <button id="login-back" style="padding:10px 24px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#9898a8;font-size:0.9rem;cursor:pointer;">Back</button>
                        <button id="login-unlock" style="padding:10px 32px;background:#00d4aa;border:none;border-radius:8px;color:#0a0a0f;font-size:0.9rem;cursor:pointer;font-weight:600;">Unlock</button>
                    </div>
                    ${passkeysSupported ? `
                        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px;">
                            <button id="login-passkey" style="padding:10px 18px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#e8e8f0;font-size:0.85rem;cursor:pointer;display:none;">
                                Use Passkey
                            </button>
                            <button id="login-add-passkey" style="padding:10px 18px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#cfd4de;font-size:0.82rem;cursor:pointer;display:none;">
                                Add Passkey Device
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;

            document.body.appendChild(overlay);
            this._completeBootLoginMetric('login-screen');

            let selectedProfile = null;
            const pwArea = overlay.querySelector('#login-password-area');
            const pwInput = overlay.querySelector('#login-password');
            const errorEl = overlay.querySelector('#login-error');
            const profilesGrid = overlay.querySelector('#profiles-grid');
            const createBtn = overlay.querySelector('#create-profile-btn');
            const importBtn = overlay.querySelector('#import-profile-btn');
            const importInput = overlay.querySelector('#import-profile-file');
            const profileNameEl = overlay.querySelector('#selected-profile-name');
            const unlockBtn = overlay.querySelector('#login-unlock');
            const backBtn = overlay.querySelector('#login-back');
            const passkeyBtn = overlay.querySelector('#login-passkey');
            const addPasskeyBtn = overlay.querySelector('#login-add-passkey');

            const showPasswordInput = (profile) => {
                selectedProfile = profile;
                profilesGrid.style.display = 'none';
                createBtn.style.display = 'none';
                if (importBtn) importBtn.style.display = 'none';
                pwArea.style.display = 'block';
                profileNameEl.textContent = `Welcome, ${profile.name}`;
                pwInput.value = '';
                pwInput.focus();
                errorEl.textContent = '';
                if (passkeyBtn) {
                    passkeyBtn.style.display = this._hasPasskeys(profile) ? 'inline-block' : 'none';
                    passkeyBtn.disabled = false;
                    passkeyBtn.textContent = 'Use Passkey';
                }
                if (addPasskeyBtn) {
                    addPasskeyBtn.style.display = 'inline-block';
                    addPasskeyBtn.disabled = false;
                    addPasskeyBtn.textContent = 'Add Passkey Device';
                }
            };

            const hidePasswordInput = () => {
                selectedProfile = null;
                profilesGrid.style.display = 'flex';
                createBtn.style.display = 'flex';
                if (importBtn) importBtn.style.display = 'flex';
                pwArea.style.display = 'none';
                overlay.querySelectorAll('.login-profile').forEach(p => p.style.borderColor = 'transparent');
                if (passkeyBtn) {
                    passkeyBtn.style.display = 'none';
                }
                if (addPasskeyBtn) {
                    addPasskeyBtn.style.display = 'none';
                }
            };

            overlay.querySelectorAll('.login-profile').forEach((el, i) => {
                el.addEventListener('click', () => {
                    const profile = profiles[i];
                    
                    const lockoutInfo = this._getLockoutInfo(profile.name);
                    if (lockoutInfo.locked) {
                        if (window.EphemeraNotifications) {
                            window.EphemeraNotifications.error('Account Locked', `Try again in ${lockoutInfo.remainingMinutes} minutes.`);
                        }
                        return;
                    }
                    
                    showPasswordInput(profile);
                });
            });

            createBtn.addEventListener('click', async () => {
                const result = await this.showCreateProfileDialog(overlay);
                if (result?.profile && result.password) {
                    if (window.EphemeraSession) {
                        const unlockResult = await window.EphemeraSession.unlock(result.password, result.profile);
                        if (!unlockResult.success) {
                            errorEl.textContent = unlockResult.error || 'Unable to unlock new profile';
                            return;
                        }
                    }
                    await this._loginWithProfile(result.profile, overlay, resolve);
                }
            });

            importBtn?.addEventListener('click', () => importInput?.click());
            importInput?.addEventListener('change', async (e) => {
                const file = e.target?.files?.[0];
                try {
                    if (file && window.EphemeraDataManagement?.importProfile) {
                        await window.EphemeraDataManagement.importProfile(file);
                    }
                } finally {
                    if (importInput) importInput.value = '';
                }
            });

            const handleUnlock = async () => {
                const password = pwInput.value;
                
                if (!password) {
                    errorEl.textContent = 'Please enter your password';
                    return;
                }
                
                const lockoutInfo = this._getLockoutInfo(selectedProfile.name);
                if (lockoutInfo.locked) {
                    errorEl.textContent = `Account locked. Try again in ${lockoutInfo.remainingMinutes} minutes.`;
                    return;
                }

                unlockBtn.disabled = true;
                unlockBtn.textContent = 'Verifying...';
                if (passkeyBtn) passkeyBtn.disabled = true;
                errorEl.textContent = '';
                errorEl.style.color = '#ff4d6a';

                try {
                    const isValid = await this._verifyPassword(password, selectedProfile);
                    
                    if (isValid) {
                        this._clearFailedAttempts(selectedProfile.name);
                        
                        if (window.EphemeraSession) {
                            const unlockResult = await window.EphemeraSession.unlock(password, selectedProfile);
                            if (!unlockResult.success) {
                                errorEl.textContent = unlockResult.error || 'Unable to unlock profile';
                                return;
                            }
                        }
                        
                        await this._loginWithProfile(selectedProfile, overlay, resolve);
                    } else {
                        this._recordFailedAttempt(selectedProfile.name);
                        
                        const attempts = this._getFailedAttempts(selectedProfile.name);
                        const remaining = this.MAX_LOGIN_ATTEMPTS - attempts;
                        
                        if (remaining <= 0) {
                            this._lockAccount(selectedProfile.name);
                            errorEl.textContent = 'Account locked. Try again in 15 minutes.';
                        } else {
                            errorEl.textContent = `Incorrect password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`;
                        }
                        
                        pwInput.value = '';
                        pwInput.style.borderColor = '#ff4d6a';
                        setTimeout(() => { 
                            pwInput.style.borderColor = 'rgba(255,255,255,0.15)'; 
                        }, 2000);
                    }
                } catch (e) {
                    console.error('[EphemeraLogin] Verification error:', e);
                    errorEl.textContent = 'An error occurred. Please try again.';
                } finally {
                    unlockBtn.disabled = false;
                    unlockBtn.textContent = 'Unlock';
                    if (passkeyBtn) passkeyBtn.disabled = false;
                }
            };

            const handlePasskeyUnlock = async () => {
                if (!selectedProfile || !window.EphemeraWebAuthn?.authenticate) return;

                const lockoutInfo = this._getLockoutInfo(selectedProfile.name);
                if (lockoutInfo.locked) {
                    errorEl.textContent = `Account locked. Try again in ${lockoutInfo.remainingMinutes} minutes.`;
                    return;
                }

                unlockBtn.disabled = true;
                if (passkeyBtn) {
                    passkeyBtn.disabled = true;
                    passkeyBtn.textContent = 'Waiting for passkey...';
                }
                errorEl.textContent = '';
                errorEl.style.color = '#ff4d6a';

                try {
                    const auth = await window.EphemeraWebAuthn.authenticate(selectedProfile);
                    if (!auth.success) {
                        errorEl.textContent = auth.error || 'Passkey authentication failed';
                        return;
                    }

                    if (window.EphemeraSession?.unlockWithPasskey) {
                        const unlockResult = await window.EphemeraSession.unlockWithPasskey(selectedProfile, auth);
                        if (!unlockResult.success) {
                            errorEl.textContent = unlockResult.error || 'Unable to unlock with passkey';
                            return;
                        }
                    }

                    this._clearFailedAttempts(selectedProfile.name);
                    this.touchPasskey(selectedProfile, auth.credentialId);
                    await this._loginWithProfile(selectedProfile, overlay, resolve);
                } catch (e) {
                    console.error('[EphemeraLogin] Passkey unlock error:', e);
                    errorEl.textContent = 'Failed to unlock with passkey';
                } finally {
                    unlockBtn.disabled = false;
                    if (passkeyBtn) {
                        passkeyBtn.disabled = false;
                        passkeyBtn.textContent = 'Use Passkey';
                    }
                }
            };

            const handleAddPasskey = async () => {
                if (!selectedProfile) return;
                const password = pwInput.value;
                if (!password) {
                    errorEl.textContent = 'Enter your password first to register a new passkey.';
                    return;
                }

                const isValid = await this._verifyPassword(password, selectedProfile);
                if (!isValid) {
                    errorEl.textContent = 'Incorrect password. Enter the correct password before adding a passkey.';
                    errorEl.style.color = '#ff4d6a';
                    return;
                }

                unlockBtn.disabled = true;
                if (passkeyBtn) passkeyBtn.disabled = true;
                if (addPasskeyBtn) {
                    addPasskeyBtn.disabled = true;
                    addPasskeyBtn.textContent = 'Registering passkey...';
                }
                errorEl.textContent = '';
                errorEl.style.color = '#ff4d6a';

                try {
                    const result = await this.registerPasskey(selectedProfile, {
                        label: `${selectedProfile.name} Device ${Date.now()}`
                    });
                    if (!result.success) {
                        errorEl.textContent = result.error || 'Failed to register passkey';
                        return;
                    }
                    errorEl.style.color = '#74e3c9';
                    errorEl.textContent = 'Passkey registered successfully.';
                    if (passkeyBtn) passkeyBtn.style.display = 'inline-block';
                } finally {
                    unlockBtn.disabled = false;
                    if (passkeyBtn) passkeyBtn.disabled = false;
                    if (addPasskeyBtn) {
                        addPasskeyBtn.disabled = false;
                        addPasskeyBtn.textContent = 'Add Passkey Device';
                    }
                    setTimeout(() => {
                        if (!errorEl.textContent) return;
                        errorEl.style.color = '#ff4d6a';
                    }, 1200);
                }
            };

            unlockBtn.addEventListener('click', handleUnlock);
            if (passkeyBtn) {
                passkeyBtn.addEventListener('click', handlePasskeyUnlock);
            }
            if (addPasskeyBtn) {
                addPasskeyBtn.addEventListener('click', handleAddPasskey);
            }
            backBtn.addEventListener('click', hidePasswordInput);
            pwInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleUnlock();
            });
        });
    },

    async _verifyPassword(password, profile) {
        if (profile.hash) {
            return await window.EphemeraCrypto.verifyPassword(password, profile.hash);
        }
        if (profile.password) {
            return password === profile.password;
        }
        return true;
    },

    async _loginWithProfile(profile, overlay, resolve) {
        if (window.EphemeraState) {
            const profileId = profile.id || this._generateProfileId(profile.name);
            profile.id = profileId;
            profile.homeDir = profile.homeDir || this._getProfileHomeDir(profileId);
            window.EphemeraState.user.name = profile.name;
            window.EphemeraState.user.id = profileId;
            window.EphemeraState.user.avatar = profile.avatar;
            window.EphemeraState.user.homeDir = profile.homeDir;
            window.EphemeraState.save();
            this._saveProfiles();
        }
        
        if (window.EphemeraTelemetry) {
            window.EphemeraTelemetry.setUser({ id: profile.id, name: profile.name });
            window.EphemeraTelemetry.addBreadcrumb({
                category: 'auth',
                message: 'User logged in',
                level: 'info'
            });
        }
        
        overlay.remove();
        resolve(true);
    },

    _getFailedAttempts(profileName) {
        const key = `login_attempts:${profileName}`;
        const data = sessionStorage.getItem(key);
        if (!data) return 0;
        
        try {
            const parsed = JSON.parse(data);
            if (Date.now() - parsed.timestamp > this.LOCKOUT_DURATION) {
                sessionStorage.removeItem(key);
                return 0;
            }
            return parsed.count;
        } catch {
            return 0;
        }
    },

    _recordFailedAttempt(profileName) {
        const key = `login_attempts:${profileName}`;
        const current = this._getFailedAttempts(profileName);
        sessionStorage.setItem(key, JSON.stringify({
            count: current + 1,
            timestamp: Date.now()
        }));
    },

    _clearFailedAttempts(profileName) {
        sessionStorage.removeItem(`login_attempts:${profileName}`);
    },

    _lockAccount(profileName) {
        const key = `login_locked:${profileName}`;
        sessionStorage.setItem(key, JSON.stringify({
            locked: true,
            timestamp: Date.now()
        }));
    },

    _getLockoutInfo(profileName) {
        const key = `login_locked:${profileName}`;
        const data = sessionStorage.getItem(key);
        
        if (!data) {
            return { locked: false };
        }
        
        try {
            const parsed = JSON.parse(data);
            const elapsed = Date.now() - parsed.timestamp;
            
            if (elapsed > this.LOCKOUT_DURATION) {
                sessionStorage.removeItem(key);
                return { locked: false };
            }
            
            const remainingMs = this.LOCKOUT_DURATION - elapsed;
            const remainingMinutes = Math.ceil(remainingMs / 60000);
            
            return { locked: true, remainingMinutes };
        } catch {
            return { locked: false };
        }
    },

    async createProfile(name, password, avatar, options = {}) {
        if (!name || typeof name !== 'string') {
            throw new Error('Profile name is required');
        }
        
        if (name.length < 1 || name.length > 32) {
            throw new Error('Profile name must be between 1 and 32 characters');
        }
        
        if (this._profiles && this._profiles.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            throw new Error('Profile with this name already exists');
        }

        if (!password || password.length < 12) {
            throw new Error('Password must be at least 12 characters');
        }
        
        if (!this._profiles) this._profiles = [];
        
        const profileId = this._generateProfileId(name);
        const profile = {
            id: profileId,
            name: name.trim(),
            avatar: avatar || this.AVATARS[Math.floor(Math.random() * this.AVATARS.length)],
            homeDir: this._getProfileHomeDir(profileId),
            createdAt: Date.now(),
            passkeys: []
        };
        
        if (window.EphemeraValidate) {
            const validation = window.EphemeraValidate.isValidPassword(password);
            if (!validation.valid) {
                throw new Error(validation.errors[0]);
            }
        }
        
        if (window.EphemeraCrypto) {
            profile.hash = await window.EphemeraCrypto.hashPassword(password);
            profile.sessionKeyMode = this.SESSION_KEY_MODE_SEED;
            profile.sessionKeySeed = window.EphemeraCrypto.generateToken();
            profile.sessionKeySalt = window.EphemeraCrypto.generateSalt();
        }
        
        this._profiles.push(profile);
        this._saveProfiles();

        if (options.registerPasskey) {
            const passkeyResult = await this.registerPasskey(profile, {
                label: options.passkeyLabel || 'Primary Passkey'
            });
            if (!passkeyResult.success && options.requirePasskey) {
                this._profiles = this._profiles.filter((entry) => entry.id !== profile.id);
                this._saveProfiles();
                throw new Error(passkeyResult.error || 'Failed to register passkey');
            }
        }
        
        if (window.EphemeraTelemetry) {
            window.EphemeraTelemetry.addBreadcrumb({
                category: 'auth',
                message: 'Profile created',
                level: 'info'
            });
        }
        
        return profile;
    },

    async updatePassword(name, newPassword) {
        if (!this._profiles) return false;
        
        const profile = this._profiles.find(p => p.name === name);
        if (!profile) return false;
        
        if (newPassword) {
            if (window.EphemeraValidate) {
                const validation = window.EphemeraValidate.isValidPassword(newPassword);
                if (!validation.valid) {
                    throw new Error(validation.errors[0]);
                }
            }
            
            if (window.EphemeraCrypto) {
                profile.hash = await window.EphemeraCrypto.hashPassword(newPassword);
                delete profile.password;
            }
        } else {
            delete profile.hash;
            delete profile.password;
        }
        
        this._saveProfiles();
        return true;
    },

    removeProfile(name) {
        if (!this._profiles) return;
        this._profiles = this._profiles.filter(p => p.name !== name);
        this._saveProfiles();
        
        if (window.EphemeraTelemetry) {
            window.EphemeraTelemetry.addBreadcrumb({
                category: 'auth',
                message: 'Profile removed',
                level: 'info'
            });
        }
    },

    getProfiles() {
        return (this._profiles || []).map(p => ({
            name: p.name,
            avatar: p.avatar,
            hasPassword: !!(p.hash || p.password),
            hasPasskey: this._hasPasskeys(p),
            createdAt: p.createdAt
        }));
    },

    getCurrentProfile() {
        const userName = window.EphemeraState?.user?.name;
        if (!userName || !this._profiles) return null;
        return this._profiles.find(p => p.name === userName);
    },

    showCreateProfileDialog(_parentOverlay = null) {
        return new Promise(async (resolve) => {
            const overlay = document.createElement('div');
            overlay.id = 'create-profile-dialog';
            overlay.style.cssText = `position:fixed;inset:0;z-index:200001;background:rgba(10,10,15,0.98);
                display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;color:#e8e8f0;`;
            
            const avatarGridHTML = this.AVATARS.map((av, i) => `
                <div class="avatar-option" data-index="${i}" style="width:48px;height:48px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:all 0.2s;display:flex;align-items:center;justify-content:center;${av.emoji ? 'background:rgba(255,255,255,0.1);font-size:24px;' : `background:linear-gradient(135deg,${av.colors[0]},${av.colors[1]});`}">
                    ${av.emoji || ''}
                </div>
            `).join('');
            const passkeyOptionSupported = await this.canUsePasskeys();
            
            overlay.innerHTML = `
                <div style="background:#12121a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;width:100%;max-width:440px;">
                    <h2 style="font-size:1.4rem;margin-bottom:8px;text-align:center;">Create Account</h2>
                    <p style="color:#9898a8;font-size:0.85rem;text-align:center;margin-bottom:24px;">Set up your secure local profile</p>
                    
                    <div style="margin-bottom:20px;">
                        <label style="display:block;font-size:0.85rem;color:#9898a8;margin-bottom:8px;">Choose Avatar</label>
                        <div id="avatar-grid" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
                            ${avatarGridHTML}
                        </div>
                    </div>
                    
                    <div style="margin-bottom:16px;">
                        <label style="display:block;font-size:0.85rem;color:#9898a8;margin-bottom:8px;">Username</label>
                        <input type="text" id="profile-name" placeholder="Enter your name"
                            style="width:100%;padding:12px 14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
                            border-radius:10px;color:#e8e8f0;font-size:0.95rem;outline:none;box-sizing:border-box;">
                        <div id="profile-name-warning" style="margin-top:8px;font-size:0.75rem;color:#ffb84d;min-height:16px;"></div>
                    </div>
                    
                    <div style="margin-bottom:16px;">
                        <label style="display:block;font-size:0.85rem;color:#9898a8;margin-bottom:8px;">Password</label>
                        <input type="password" id="profile-password" placeholder="At least 12 characters"
                            style="width:100%;padding:12px 14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
                            border-radius:10px;color:#e8e8f0;font-size:0.95rem;outline:none;box-sizing:border-box;" autocomplete="new-password">
                        <div id="password-strength" style="margin-top:8px;font-size:0.75rem;"></div>
                    </div>
                    
                    <div style="margin-bottom:20px;">
                        <label style="display:block;font-size:0.85rem;color:#9898a8;margin-bottom:8px;">Confirm Password</label>
                        <input type="password" id="profile-password-confirm" placeholder="Confirm your password"
                            style="width:100%;padding:12px 14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
                            border-radius:10px;color:#e8e8f0;font-size:0.95rem;outline:none;box-sizing:border-box;" autocomplete="new-password">
                    </div>
                    ${passkeyOptionSupported ? `
                        <label style="display:flex;align-items:flex-start;gap:10px;margin-bottom:20px;cursor:pointer;">
                            <input type="checkbox" id="profile-passkey-enabled" checked style="margin-top:2px;">
                            <span style="font-size:0.82rem;color:#c7c7d4;line-height:1.4;">
                                Register a passkey for biometric or device unlock (Face ID, Touch ID, Windows Hello).
                                You can still use your password as fallback.
                            </span>
                        </label>
                    ` : ''}
                    
                    <div id="profile-error" style="color:#ff4d6a;font-size:0.85rem;margin-bottom:16px;min-height:20px;text-align:center;"></div>
                    
                    <div style="display:flex;gap:12px;">
                        <button id="profile-cancel" style="flex:1;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);
                            border-radius:10px;color:#9898a8;font-size:0.95rem;cursor:pointer;">Cancel</button>
                        <button id="profile-create" style="flex:1;padding:12px;background:#00d4aa;border:none;border-radius:10px;color:#0a0a0f;
                            font-size:0.95rem;font-weight:600;cursor:pointer;">Create Account</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            this._completeBootLoginMetric('create-profile-dialog');
            
            const nameInput = overlay.querySelector('#profile-name');
            const passwordInput = overlay.querySelector('#profile-password');
            const confirmInput = overlay.querySelector('#profile-password-confirm');
            const errorEl = overlay.querySelector('#profile-error');
            const strengthEl = overlay.querySelector('#password-strength');
            const nameWarningEl = overlay.querySelector('#profile-name-warning');
            const cancelBtn = overlay.querySelector('#profile-cancel');
            const createBtn = overlay.querySelector('#profile-create');
            const avatarOptions = overlay.querySelectorAll('.avatar-option');
            const passkeyCheckbox = overlay.querySelector('#profile-passkey-enabled');

            let selectedAvatar = this.AVATARS[0];

            avatarOptions.forEach(opt => {
                opt.addEventListener('click', () => {
                    avatarOptions.forEach(o => o.style.borderColor = 'transparent');
                    opt.style.borderColor = '#00d4aa';
                    selectedAvatar = this.AVATARS[parseInt(opt.dataset.index)];
                });
            });

            avatarOptions[0].style.borderColor = '#00d4aa';

            const updateNameWarning = () => {
                if (!nameInput.value.trim() || !window.EphemeraStorage?.validateProfileId) {
                    nameWarningEl.textContent = '';
                    return;
                }

                const validation = window.EphemeraStorage.validateProfileId(nameInput.value);
                if (validation.warning) {
                    nameWarningEl.textContent = validation.warning;
                } else {
                    nameWarningEl.textContent = '';
                }
            };

            nameInput.addEventListener('input', updateNameWarning);
            
            const updateStrength = () => {
                if (!window.EphemeraValidate || !passwordInput.value) {
                    strengthEl.textContent = '';
                    return;
                }
                
                const validation = window.EphemeraValidate.isValidPassword(passwordInput.value);
                const strengthTexts = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
                const strengthColors = ['#ff4d6a', '#ff8866', '#ffb84d', '#4ade80', '#00d4aa'];
                
                strengthEl.innerHTML = `Password strength: <span style="color:${strengthColors[validation.strength]}">${strengthTexts[validation.strength]}</span>`;
            };
            
            passwordInput.addEventListener('input', updateStrength);
            
            const handleCreate = async () => {
                const name = nameInput.value.trim();
                const password = passwordInput.value;
                const confirm = confirmInput.value;
                
                if (!name) {
                    errorEl.textContent = 'Please enter a username';
                    return;
                }
                
                if (!password) {
                    errorEl.textContent = 'Please enter a password';
                    return;
                }
                
                if (password.length < 12) {
                    errorEl.textContent = 'Password must be at least 12 characters';
                    return;
                }
                
                if (password !== confirm) {
                    errorEl.textContent = 'Passwords do not match';
                    return;
                }
                
                createBtn.disabled = true;
                createBtn.textContent = 'Creating...';
                errorEl.textContent = '';
                
                try {
                    const profile = await this.createProfile(name, password, selectedAvatar, {
                        registerPasskey: passkeyCheckbox?.checked === true,
                        passkeyLabel: `${name}'s Passkey`,
                        requirePasskey: false
                    });
                    overlay.remove();
                    resolve({ profile, password });
                } catch (e) {
                    errorEl.textContent = e.message;
                    createBtn.disabled = false;
                    createBtn.textContent = 'Create Account';
                }
            };
            
            createBtn.addEventListener('click', handleCreate);
            cancelBtn.addEventListener('click', () => {
                overlay.remove();
                resolve(null);
            });
            
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') passwordInput.focus();
            });
            passwordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') confirmInput.focus();
            });
            confirmInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleCreate();
            });
            
            setTimeout(() => nameInput.focus(), 100);
        });
    },

    logout() {
        if (window.EphemeraSession) {
            window.EphemeraSession.logout();
        }
    }
};

window.EphemeraLogin = EphemeraLogin;
export default EphemeraLogin;
