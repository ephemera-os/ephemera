EphemeraApps.register({
    id: 'passwordmanager',
    name: 'Password Vault',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
    width: 700,
    height: 550,
    category: 'utility',
    singleton: true,
    content: (windowId) => {
        return {
            html: `
                <style>
                    .vault-container { display:flex;flex-direction:column;height:100%; }
                    .vault-header { display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border); }
                    .vault-header h2 { margin:0;font-size:1.1rem;color:var(--fg-primary);display:flex;align-items:center;gap:8px; }
                    .vault-header-actions { display:flex;gap:8px; }
                    .vault-header button { padding:8px 14px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.8rem; }
                    .vault-header button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .vault-header button.primary { background:var(--accent);color:#fff;border-color:var(--accent); }
                    .vault-search { padding:12px 16px;background:var(--bg-primary);border-bottom:1px solid var(--border); }
                    .vault-search input { width:100%;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-md);font-family:inherit;font-size:0.9rem; }
                    .vault-search input:focus { outline:none;border-color:var(--accent); }
                    .vault-list { flex:1;overflow-y:auto;padding:8px; }
                    .vault-item { display:flex;align-items:center;padding:12px 16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:8px;cursor:pointer;transition:all 0.15s; }
                    .vault-item:hover { border-color:var(--accent); }
                    .vault-item-icon { width:40px;height:40px;background:var(--bg-tertiary);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;margin-right:12px;font-size:1.2rem; }
                    .vault-item-info { flex:1;overflow:hidden; }
                    .vault-item-title { font-weight:500;color:var(--fg-primary);margin-bottom:4px; }
                    .vault-item-username { font-size:0.8rem;color:var(--fg-muted); }
                    .vault-item-actions { display:flex;gap:6px;opacity:0;transition:opacity 0.15s; }
                    .vault-item:hover .vault-item-actions { opacity:1; }
                    .vault-item-actions button { padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:0.75rem;color:var(--fg-secondary); }
                    .vault-item-actions button:hover { background:var(--accent);color:#fff;border-color:var(--accent); }
                    .vault-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--fg-muted);text-align:center;padding:40px; }
                    .vault-empty svg { width:64px;height:64px;opacity:0.3;margin-bottom:16px; }
                    .vault-empty h3 { color:var(--fg-secondary);margin-bottom:8px; }
                    .vault-modal-overlay { position:absolute;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:100; }
                    .vault-modal-overlay.active { display:flex; }
                    .vault-modal { background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;width:420px;max-width:90%; }
                    .vault-modal h3 { margin:0 0 20px;color:var(--fg-primary); }
                    .vault-modal-field { margin-bottom:16px; }
                    .vault-modal-field label { display:block;margin-bottom:6px;font-size:0.8rem;color:var(--fg-secondary); }
                    .vault-modal-field input,.vault-modal-field textarea { width:100%;padding:10px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-family:inherit;font-size:0.9rem; }
                    .vault-modal-field input:focus,.vault-modal-field textarea:focus { outline:none;border-color:var(--accent); }
                    .vault-modal-field .password-wrapper { display:flex;gap:8px; }
                    .vault-modal-field .password-wrapper input { flex:1; }
                    .vault-modal-field .password-wrapper button { padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-secondary); }
                    .vault-modal-field .password-wrapper button:hover { color:var(--fg-primary); }
                    .vault-password-generator { background:var(--bg-tertiary);padding:12px;border-radius:var(--radius-sm);margin-top:8px; }
                    .vault-password-generator .generated-password { font-family:'JetBrains Mono',monospace;font-size:0.9rem;color:var(--accent);margin-bottom:10px;word-break:break-all; }
                    .vault-password-generator .options { display:flex;gap:12px;flex-wrap:wrap; }
                    .vault-password-generator .options label { display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--fg-secondary);cursor:pointer; }
                    .vault-password-generator .options input { width:auto; }
                    .vault-modal-actions { display:flex;gap:10px;justify-content:flex-end;margin-top:20px; }
                    .vault-modal-actions button { padding:10px 20px;border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.85rem; }
                    .vault-modal-actions .btn-primary { background:var(--accent);border:none;color:#fff; }
                    .vault-modal-actions .btn-secondary { background:transparent;border:1px solid var(--border);color:var(--fg-secondary); }
                    .vault-strength { height:4px;background:var(--bg-tertiary);border-radius:2px;margin-top:8px;overflow:hidden; }
                    .vault-strength-bar { height:100%;transition:width 0.3s,background 0.3s; }
                    .vault-strength-bar.weak { background:#ef4444;width:25%; }
                    .vault-strength-bar.fair { background:#f59e0b;width:50%; }
                    .vault-strength-bar.good { background:#22c55e;width:75%; }
                    .vault-strength-bar.strong { background:#00d4aa;width:100%; }
                    .vault-categories { display:flex;gap:8px;padding:8px 16px;background:var(--bg-primary);border-bottom:1px solid var(--border);overflow-x:auto; }
                    .vault-category { padding:6px 14px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-lg);cursor:pointer;font-size:0.8rem;color:var(--fg-muted);white-space:nowrap;transition:all 0.15s; }
                    .vault-category:hover { color:var(--fg-primary); }
                    .vault-category.active { background:var(--accent);color:#fff;border-color:var(--accent); }
                    .vault-lock-screen { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:var(--bg-primary);padding:40px;text-align:center; }
                    .vault-lock-screen.hidden { display:none; }
                    .vault-lock-icon { width:80px;height:80px;margin-bottom:24px;opacity:0.6; }
                    .vault-lock-screen h3 { color:var(--fg-primary);margin:0 0 8px;font-size:1.2rem; }
                    .vault-lock-screen p { color:var(--fg-muted);margin:0 0 24px;font-size:0.9rem; }
                    .vault-lock-field { width:280px;margin-bottom:10px; }
                    .vault-lock-input-wrap { display:flex;align-items:center;gap:8px; }
                    .vault-lock-input { flex:1;min-width:0;padding:12px 16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--fg-primary);font-family:inherit;font-size:1rem;text-align:left; }
                    .vault-lock-toggle { width:42px;height:42px;display:inline-flex;align-items:center;justify-content:center;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--fg-secondary);cursor:pointer;font-size:1rem; }
                    .vault-lock-toggle:hover { color:var(--fg-primary); }
                    .vault-lock-input:focus { outline:none;border-color:var(--accent); }
                    .vault-lock-input::-ms-reveal,.vault-lock-input::-ms-clear { display:none; }
                    .vault-lock-btn { padding:12px 32px;background:var(--accent);border:none;border-radius:var(--radius-md);color:#fff;font-family:inherit;font-size:0.95rem;cursor:pointer; }
                    .vault-lock-btn:hover { opacity:0.9; }
                    .vault-lock-error { color:#ef4444;font-size:0.85rem;margin-bottom:12px;min-height:20px; }
                    .vault-reset-btn { margin-top:12px;background:none;border:none;color:var(--fg-muted);font-size:0.8rem;cursor:pointer;text-decoration:underline; }
                    .vault-reset-btn:hover { color:var(--fg-primary); }
                    .vault-content-wrapper { display:flex;flex-direction:column;height:100%; }
                    .vault-content-wrapper.hidden { display:none; }
                    .vault-loading { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;color:var(--fg-muted); }
                    .vault-loading-spinner { width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:vault-spin 0.8s linear infinite;margin-bottom:16px; }
                    @keyframes vault-spin { to { transform:rotate(360deg); } }
                </style>
                <div class="vault-container">
                    <div class="vault-lock-screen" id="vault-lock-${windowId}">
                        <svg class="vault-lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1"/></svg>
                        <h3 id="vault-lock-title-${windowId}">Unlock Vault</h3>
                        <p id="vault-lock-desc-${windowId}">Enter your master password to access your passwords</p>
                        <div class="vault-lock-field">
                            <div class="vault-lock-input-wrap">
                                <input type="password" class="vault-lock-input" id="vault-master-input-${windowId}" placeholder="Master password" autocomplete="new-password">
                                <button class="vault-lock-toggle" id="vault-toggle-master-${windowId}" type="button" title="Show password">&#128065;&#65039;</button>
                            </div>
                        </div>
                        <div class="vault-lock-field" id="vault-confirm-field-${windowId}" style="display:none;">
                            <div class="vault-lock-input-wrap">
                                <input type="password" class="vault-lock-input" id="vault-master-confirm-input-${windowId}" placeholder="Confirm master password" autocomplete="new-password">
                                <button class="vault-lock-toggle" id="vault-toggle-confirm-${windowId}" type="button" title="Show password">&#128065;&#65039;</button>
                            </div>
                        </div>
                        <div class="vault-lock-error" id="vault-lock-error-${windowId}"></div>
                        <button class="vault-lock-btn" id="vault-unlock-btn-${windowId}">Unlock</button>
                        <button class="vault-reset-btn" id="vault-reset-btn-${windowId}" type="button">Forgot password? Erase vault and start over</button>
                    </div>
                    <div class="vault-content-wrapper hidden" id="vault-content-${windowId}">
                    <div class="vault-header">
                        <h2>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                            Password Vault
                        </h2>
                        <div class="vault-header-actions">
                            <button id="vault-lock-btn-${windowId}" title="Lock Vault">🔒</button>
                            <button id="vault-export-${windowId}">Export</button>
                            <button id="vault-import-${windowId}">Import</button>
                            <button class="primary" id="vault-add-${windowId}">+ Add Entry</button>
                        </div>
                    </div>
                    <div class="vault-search">
                        <input type="text" id="vault-search-${windowId}" placeholder="Search passwords...">
                    </div>
                    <div class="vault-categories" id="vault-categories-${windowId}">
                        <div class="vault-category active" data-cat="all">All</div>
                        <div class="vault-category" data-cat="social">Social</div>
                        <div class="vault-category" data-cat="work">Work</div>
                        <div class="vault-category" data-cat="finance">Finance</div>
                        <div class="vault-category" data-cat="shopping">Shopping</div>
                        <div class="vault-category" data-cat="other">Other</div>
                    </div>
                    <div class="vault-list" id="vault-list-${windowId}">
                        <div class="vault-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                            <h3>No passwords yet</h3>
                            <p>Add your first password entry to get started</p>
                        </div>
                    </div>
                    <div class="vault-modal-overlay" id="vault-modal-${windowId}">
                        <div class="vault-modal">
                            <h3 id="vault-modal-title-${windowId}">Add Entry</h3>
                            <div class="vault-modal-field">
                                <label>Title</label>
                                <input type="text" id="vault-input-title-${windowId}" placeholder="e.g., GitHub Account">
                            </div>
                            <div class="vault-modal-field">
                                <label>Website URL</label>
                                <input type="url" id="vault-input-url-${windowId}" placeholder="https://example.com">
                            </div>
                            <div class="vault-modal-field">
                                <label>Username / Email</label>
                                <input type="text" id="vault-input-username-${windowId}" placeholder="username@email.com">
                            </div>
                            <div class="vault-modal-field">
                                <label>Password</label>
                                <div class="password-wrapper">
                                    <input type="password" id="vault-input-password-${windowId}" placeholder="Enter password">
                                    <button id="vault-toggle-pw-${windowId}" title="Show/Hide">👁️</button>
                                    <button id="vault-generate-${windowId}" title="Generate">🎲</button>
                                </div>
                                <div class="vault-strength"><div class="vault-strength-bar" id="vault-strength-${windowId}"></div></div>
                            </div>
                            <div class="vault-modal-field">
                                <label>Category</label>
                                <select id="vault-input-category-${windowId}" style="width:100%;padding:10px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-family:inherit;">
                                    <option value="other">Other</option>
                                    <option value="social">Social</option>
                                    <option value="work">Work</option>
                                    <option value="finance">Finance</option>
                                    <option value="shopping">Shopping</option>
                                </select>
                            </div>
                            <div class="vault-modal-field">
                                <label>Notes (optional)</label>
                                <textarea id="vault-input-notes-${windowId}" rows="2" placeholder="Additional notes..."></textarea>
                            </div>
                            <div class="vault-modal-actions">
                                <button class="btn-secondary" id="vault-modal-cancel-${windowId}">Cancel</button>
                                <button class="btn-primary" id="vault-modal-save-${windowId}">Save</button>
                            </div>
                        </div>
                    </div>
                    </div>
                    <input type="file" id="vault-file-input-${windowId}" accept=".json" style="display:none;">
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();

                const listEl = document.getElementById(`vault-list-${windowId}`);
                const searchInput = document.getElementById(`vault-search-${windowId}`);
                const modal = document.getElementById(`vault-modal-${windowId}`);
                const modalTitle = document.getElementById(`vault-modal-title-${windowId}`);
                const addBtn = document.getElementById(`vault-add-${windowId}`);
                const exportBtn = document.getElementById(`vault-export-${windowId}`);
                const importBtn = document.getElementById(`vault-import-${windowId}`);
                const fileInput = document.getElementById(`vault-file-input-${windowId}`);
                const categoriesEl = document.getElementById(`vault-categories-${windowId}`);
                const lockScreen = document.getElementById(`vault-lock-${windowId}`);
                const lockTitle = document.getElementById(`vault-lock-title-${windowId}`);
                const lockDesc = document.getElementById(`vault-lock-desc-${windowId}`);
                const masterInput = document.getElementById(`vault-master-input-${windowId}`);
                const masterConfirmInput = document.getElementById(`vault-master-confirm-input-${windowId}`);
                const confirmField = document.getElementById(`vault-confirm-field-${windowId}`);
                const lockError = document.getElementById(`vault-lock-error-${windowId}`);
                const unlockBtn = document.getElementById(`vault-unlock-btn-${windowId}`);
                const resetBtn = document.getElementById(`vault-reset-btn-${windowId}`);
                const toggleMasterBtn = document.getElementById(`vault-toggle-master-${windowId}`);
                const toggleConfirmBtn = document.getElementById(`vault-toggle-confirm-${windowId}`);
                const contentWrapper = document.getElementById(`vault-content-${windowId}`);
                const lockBtn = document.getElementById(`vault-lock-btn-${windowId}`);

                const STORAGE_KEY = 'ephemera_password_vault';
                const MASTER_KEY_STORAGE = 'ephemera_vault_key_hash';

                let entries = [];
                let editingId = null;
                let currentCategory = 'all';
                let masterPassword = null;
                let isVaultUnlocked = false;
                let isLoading = false;
                let autoLockTimer = null;
                let lockPasswordsVisible = false;
                const AUTO_LOCK_DELAY = 60000; // 60 seconds

                const inputTitle = document.getElementById(`vault-input-title-${windowId}`);
                const inputUrl = document.getElementById(`vault-input-url-${windowId}`);
                const inputUsername = document.getElementById(`vault-input-username-${windowId}`);
                const inputPassword = document.getElementById(`vault-input-password-${windowId}`);
                const inputCategory = document.getElementById(`vault-input-category-${windowId}`);
                const inputNotes = document.getElementById(`vault-input-notes-${windowId}`);
                const strengthBar = document.getElementById(`vault-strength-${windowId}`);

                async function getMasterPasswordHash() {
                    const stored = await EphemeraStorage.get('metadata', MASTER_KEY_STORAGE);
                    return stored?.hash || null;
                }

                async function setMasterPasswordHash(hash) {
                    await EphemeraStorage.put('metadata', { key: MASTER_KEY_STORAGE, hash, created: Date.now() });
                }

                async function loadEntries() {
                    if (!isVaultUnlocked || !masterPassword) {
                        render();
                        return;
                    }
                    isLoading = true;
                    render();
                    const stored = await EphemeraStorage.get('metadata', STORAGE_KEY);
                    if (stored?.entries) {
                        try {
                            const decryptedEntries = await Promise.all(stored.entries.map(async (e) => {
                                let decryptedPassword = e.password;
                                if (EphemeraCrypto && e.password && typeof e.password === 'object' && e.password.ciphertext) {
                                    decryptedPassword = await EphemeraCrypto.decryptWithPassword(e.password, masterPassword);
                                }
                                return { ...e, password: decryptedPassword };
                            }));
                            entries = decryptedEntries;
                        } catch (err) {
                            console.error('[PasswordVault] Failed to decrypt entries:', err);
                            entries = [];
                        }
                    }
                    isLoading = false;
                    render();
                }

                async function saveEntries() {
                    if (!masterPassword) return;
                    const encryptedEntries = await Promise.all(entries.map(async (e) => {
                        let encryptedPassword = e.password;
                        if (EphemeraCrypto) {
                            encryptedPassword = await EphemeraCrypto.encryptWithPassword(e.password, masterPassword);
                        }
                        return { ...e, password: encryptedPassword };
                    }));
                    await EphemeraStorage.put('metadata', { key: STORAGE_KEY, entries: encryptedEntries, updated: Date.now() });
                }

                function generateId() {
                    return 'pw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                }

                function generatePassword(length = 16, options = {}) {
                    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    const lower = 'abcdefghijklmnopqrstuvwxyz';
                    const numbers = '0123456789';
                    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
                    
                    let chars = lower;
                    if (options.upper) chars += upper;
                    if (options.numbers) chars += numbers;
                    if (options.symbols) chars += symbols;
                    
                    let password = '';
                    for (let i = 0; i < length; i++) {
                        password += chars[Math.floor(Math.random() * chars.length)];
                    }
                    return password;
                }

                function checkStrength(password) {
                    let score = 0;
                    if (password.length >= 8) score++;
                    if (password.length >= 12) score++;
                    if (password.length >= 16) score++;
                    if (/[A-Z]/.test(password)) score++;
                    if (/[0-9]/.test(password)) score++;
                    if (/[^A-Za-z0-9]/.test(password)) score++;
                    
                    if (score <= 2) return 'weak';
                    if (score <= 4) return 'fair';
                    if (score <= 5) return 'good';
                    return 'strong';
                }

                function updateStrength() {
                    const strength = checkStrength(inputPassword.value);
                    strengthBar.className = 'vault-strength-bar ' + strength;
                }

                function getCategoryIcon(category) {
                    const icons = {
                        social: '👥',
                        work: '💼',
                        finance: '💰',
                        shopping: '🛒',
                        other: '🔑'
                    };
                    return icons[category] || icons.other;
                }

                function formatRelativeTime(timestamp) {
                    if (!timestamp) return '';
                    const now = Date.now();
                    const diff = now - timestamp;
                    const seconds = Math.floor(diff / 1000);
                    const minutes = Math.floor(seconds / 60);
                    const hours = Math.floor(minutes / 60);
                    const days = Math.floor(hours / 24);

                    if (seconds < 60) return 'just now';
                    if (minutes < 60) return `${minutes}m ago`;
                    if (hours < 24) return `${hours}h ago`;
                    if (days < 7) return `${days}d ago`;
                    return new Date(timestamp).toLocaleDateString();
                }

                function render() {
                    if (isLoading) {
                        listEl.innerHTML = `
                            <div class="vault-loading">
                                <div class="vault-loading-spinner"></div>
                                <span>Decrypting entries...</span>
                            </div>
                        `;
                        return;
                    }

                    const search = searchInput.value.toLowerCase();
                    const filtered = entries.filter(e => {
                        const matchesSearch = e.title.toLowerCase().includes(search) ||
                            e.username.toLowerCase().includes(search) ||
                            e.url?.toLowerCase().includes(search);
                        const matchesCategory = currentCategory === 'all' || e.category === currentCategory;
                        return matchesSearch && matchesCategory;
                    });

                    if (filtered.length === 0) {
                        listEl.innerHTML = `
                            <div class="vault-empty">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                                <h3>${entries.length === 0 ? 'No passwords yet' : 'No matches found'}</h3>
                                <p>${entries.length === 0 ? 'Add your first password entry to get started' : 'Try a different search term'}</p>
                            </div>
                        `;
                        return;
                    }

                    listEl.innerHTML = filtered.map(e => `
                        <div class="vault-item" data-id="${e.id}">
                            <div class="vault-item-icon">${getCategoryIcon(e.category)}</div>
                            <div class="vault-item-info">
                                <div class="vault-item-title">${EphemeraSanitize.escapeHtml(e.title)}</div>
                                <div class="vault-item-username">${EphemeraSanitize.escapeHtml(e.username)}${e.lastCopied ? ` <span style="opacity:0.6">• copied ${formatRelativeTime(e.lastCopied)}</span>` : ''}</div>
                            </div>
                            <div class="vault-item-actions">
                                <button data-action="copy-user" title="Copy Username">User</button>
                                <button data-action="copy-pw" title="Copy Password">Copy</button>
                                <button data-action="edit" title="Edit">Edit</button>
                                <button data-action="delete" title="Delete">🗑️</button>
                            </div>
                        </div>
                    `).join('');

                    listEl.querySelectorAll('.vault-item').forEach(item => {
                        const id = item.dataset.id;
                        const entry = entries.find(e => e.id === id);

                        item.querySelectorAll('button').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const action = btn.dataset.action;
                                if (action === 'copy-user') {
                                    navigator.clipboard.writeText(entry.username);
                                    EphemeraNotifications.success('Copied', 'Username copied to clipboard');
                                } else if (action === 'copy-pw') {
                                    navigator.clipboard.writeText(entry.password);
                                    // Update lastCopied timestamp
                                    const idx = entries.findIndex(ent => ent.id === entry.id);
                                    if (idx !== -1) {
                                        entries[idx].lastCopied = Date.now();
                                        saveEntries();
                                    }
                                    EphemeraNotifications.success('Copied', 'Password copied to clipboard');
                                } else if (action === 'edit') {
                                    openEditModal(entry);
                                } else if (action === 'delete') {
                                    deleteEntry(id);
                                }
                            });
                        });
                    });
                }

                function openModal(entry = null) {
                    editingId = entry?.id || null;
                    modalTitle.textContent = entry ? 'Edit Entry' : 'Add Entry';
                    inputTitle.value = entry?.title || '';
                    inputUrl.value = entry?.url || '';
                    inputUsername.value = entry?.username || '';
                    inputPassword.value = entry?.password || '';
                    inputCategory.value = entry?.category || 'other';
                    inputNotes.value = entry?.notes || '';
                    updateStrength();
                    modal.classList.add('active');
                    inputTitle.focus();
                }

                function openEditModal(entry) {
                    openModal(entry);
                }

                function closeModal() {
                    modal.classList.remove('active');
                    editingId = null;
                }

                async function saveEntry() {
                    const title = inputTitle.value.trim();
                    const username = inputUsername.value.trim();
                    const password = inputPassword.value;

                    if (!title || !username || !password) {
                        EphemeraNotifications.error('Error', 'Title, username, and password are required');
                        return;
                    }

                    const entry = {
                        id: editingId || generateId(),
                        title,
                        url: inputUrl.value.trim(),
                        username,
                        password,
                        category: inputCategory.value,
                        notes: inputNotes.value.trim(),
                        createdAt: editingId ? entries.find(e => e.id === editingId)?.createdAt : Date.now(),
                        updatedAt: Date.now()
                    };

                    if (editingId) {
                        const idx = entries.findIndex(e => e.id === editingId);
                        if (idx !== -1) entries[idx] = entry;
                    } else {
                        entries.push(entry);
                    }

                    await saveEntries();
                    closeModal();
                    render();
                    EphemeraNotifications.success('Saved', `"${title}" has been saved.`);
                }

                async function deleteEntry(id) {
                    const entry = entries.find(e => e.id === id);
                    if (!entry) return;
                    const confirmed = await window.EphemeraDialog?.confirm?.(
                        `Delete "${entry.title}"? This cannot be undone.`,
                        'Delete Entry',
                        true
                    );
                    if (!confirmed) return;
                    entries = entries.filter(e => e.id !== id);
                    await saveEntries();
                    render();
                }

                function exportVault() {
                    const data = JSON.stringify(entries, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'password_vault_export.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    EphemeraNotifications.success('Exported', 'Password vault exported successfully');
                }

                function importVault(e) {
                    const file = e.target.files[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        try {
                            const imported = JSON.parse(ev.target.result);
                            if (Array.isArray(imported)) {
                                const count = imported.length;
                                const confirmed = await window.EphemeraDialog?.confirm?.(
                                    `Import ${count} entries? This will add to your existing vault.`,
                                    'Import Vault Entries'
                                );
                                if (!confirmed) return;
                                entries = [...entries, ...imported.map(e => ({ ...e, id: generateId() }))];
                                await saveEntries();
                                render();
                                EphemeraNotifications.success('Imported', `${count} entries imported`);
                            }
                        } catch {
                            EphemeraNotifications.error('Error', 'Invalid import file format');
                        }
                    };
                    reader.readAsText(file);
                    fileInput.value = '';
                }

                lifecycle.addListener(addBtn, 'click', () => openModal());
                lifecycle.addListener(document.getElementById(`vault-modal-cancel-${windowId}`), 'click', closeModal);
                lifecycle.addListener(document.getElementById(`vault-modal-save-${windowId}`), 'click', saveEntry);
                lifecycle.addListener(exportBtn, 'click', exportVault);
                lifecycle.addListener(importBtn, 'click', () => fileInput.click());
                lifecycle.addListener(fileInput, 'change', importVault);

                lifecycle.addListener(document.getElementById(`vault-toggle-pw-${windowId}`), 'click', () => {
                    inputPassword.type = inputPassword.type === 'password' ? 'text' : 'password';
                });

                lifecycle.addListener(document.getElementById(`vault-generate-${windowId}`), 'click', () => {
                    inputPassword.value = generatePassword(16, { upper: true, numbers: true, symbols: true });
                    inputPassword.type = 'text';
                    updateStrength();
                });

                lifecycle.addListener(inputPassword, 'input', updateStrength);

                lifecycle.addListener(searchInput, 'input', render);

                categoriesEl.querySelectorAll('.vault-category').forEach(cat => {
                    lifecycle.addListener(cat, 'click', () => {
                        categoriesEl.querySelectorAll('.vault-category').forEach(c => c.classList.remove('active'));
                        cat.classList.add('active');
                        currentCategory = cat.dataset.cat;
                        render();
                    });
                });

                lifecycle.addListener(modal, 'click', (e) => {
                    if (e.target === modal) closeModal();
                });

                function setLockPasswordsVisible(visible) {
                    lockPasswordsVisible = visible === true;
                    const type = lockPasswordsVisible ? 'text' : 'password';
                    masterInput.type = type;
                    if (masterConfirmInput) {
                        masterConfirmInput.type = type;
                    }
                    const title = lockPasswordsVisible ? 'Hide password' : 'Show password';
                    if (toggleMasterBtn) toggleMasterBtn.title = title;
                    if (toggleConfirmBtn) toggleConfirmBtn.title = title;
                }

                function showLockScreen(isNew) {
                    lockScreen.classList.remove('hidden');
                    contentWrapper.classList.add('hidden');
                    masterInput.value = '';
                    if (masterConfirmInput) {
                        masterConfirmInput.value = '';
                    }
                    lockError.textContent = '';
                    if (confirmField) {
                        confirmField.style.display = isNew ? 'block' : 'none';
                    }
                    setLockPasswordsVisible(false);
                    if (isNew) {
                        lockTitle.textContent = 'Create Master Password';
                        lockDesc.textContent = 'Choose a strong password to protect your vault';
                        unlockBtn.textContent = 'Create Vault';
                        if (resetBtn) resetBtn.style.display = 'none';
                    } else {
                        lockTitle.textContent = 'Unlock Vault';
                        lockDesc.textContent = 'Enter your master password to access your passwords';
                        unlockBtn.textContent = 'Unlock';
                        if (resetBtn) resetBtn.style.display = 'inline-block';
                    }
                    masterInput.focus();
                }

                function hideLockScreen() {
                    lockScreen.classList.add('hidden');
                    contentWrapper.classList.remove('hidden');
                }

                async function handleUnlock() {
                    const password = masterInput.value;
                    if (!password) {
                        lockError.textContent = 'Please enter a password';
                        masterInput.focus();
                        return;
                    }
                    if (password.length < 6) {
                        lockError.textContent = 'Password must be at least 6 characters';
                        masterInput.focus();
                        return;
                    }

                    const existingHash = await getMasterPasswordHash();
                    
                    if (existingHash) {
                        const isValid = await EphemeraCrypto.verifyPassword(password, existingHash);
                        if (!isValid) {
                            lockError.textContent = 'Incorrect password';
                            masterInput.value = '';
                            masterInput.focus();
                            return;
                        }
                    } else {
                        const confirmation = masterConfirmInput?.value || '';
                        if (!confirmation) {
                            lockError.textContent = 'Please confirm your password';
                            masterConfirmInput?.focus();
                            return;
                        }
                        if (confirmation !== password) {
                            lockError.textContent = 'Passwords do not match';
                            masterConfirmInput.value = '';
                            masterConfirmInput?.focus();
                            return;
                        }
                        const newHash = await EphemeraCrypto.hashPassword(password);
                        await setMasterPasswordHash(newHash);
                    }

                    masterPassword = password;
                    isVaultUnlocked = true;
                    hideLockScreen();
                    await loadEntries();
                }

                async function resetVaultAndStartOver() {
                    const hasMaster = await getMasterPasswordHash();
                    if (!hasMaster) {
                        showLockScreen(true);
                        return;
                    }

                    const confirmed = await window.EphemeraDialog?.confirm?.(
                        'This will permanently delete all vault entries and the current master password. This cannot be undone.',
                        'Erase Vault',
                        true
                    );
                    if (!confirmed) return;

                    if (window.EphemeraDialog?.prompt) {
                        const phrase = await window.EphemeraDialog.prompt(
                            'Type ERASE to confirm vault reset.',
                            '',
                            'Final Confirmation',
                            'ERASE'
                        );
                        if (phrase !== 'ERASE') {
                            EphemeraNotifications.info('Vault Reset Cancelled', 'Confirmation phrase did not match.');
                            return;
                        }
                    }

                    await EphemeraStorage.delete('metadata', STORAGE_KEY);
                    await EphemeraStorage.delete('metadata', MASTER_KEY_STORAGE);

                    entries = [];
                    masterPassword = null;
                    isVaultUnlocked = false;
                    editingId = null;
                    currentCategory = 'all';
                    searchInput.value = '';
                    categoriesEl.querySelectorAll('.vault-category').forEach((cat) => {
                        cat.classList.toggle('active', cat.dataset.cat === 'all');
                    });
                    stopAutoLockTimer();
                    closeModal();
                    render();
                    showLockScreen(true);
                    EphemeraNotifications.success('Vault Reset', 'You can now create a new master password.');
                }

                function lockVault() {
                    masterPassword = null;
                    isVaultUnlocked = false;
                    entries = [];
                    stopAutoLockTimer();
                    showLockScreen(false);
                    render();
                }

                function startAutoLockTimer() {
                    if (autoLockTimer) clearTimeout(autoLockTimer);
                    autoLockTimer = setTimeout(() => {
                        if (isVaultUnlocked) {
                            lockVault();
                            EphemeraNotifications.info('Vault Locked', 'Password vault locked due to inactivity');
                        }
                    }, AUTO_LOCK_DELAY);
                }

                function stopAutoLockTimer() {
                    if (autoLockTimer) {
                        clearTimeout(autoLockTimer);
                        autoLockTimer = null;
                    }
                }

                function resetAutoLockTimer() {
                    if (isVaultUnlocked) {
                        startAutoLockTimer();
                    }
                }

                // Auto-lock on window visibility change
                const handleVisibilityChange = () => {
                    if (document.hidden) {
                        startAutoLockTimer();
                    } else {
                        stopAutoLockTimer();
                    }
                };

                lifecycle.addListener(document, 'visibilitychange', handleVisibilityChange);

                // Reset timer on user activity
                const activityEvents = ['mousedown', 'keydown', 'touchstart'];
                const handleActivity = () => resetAutoLockTimer();
                activityEvents.forEach(event => {
                    lifecycle.addListener(document, event, handleActivity, { passive: true });
                });

                lifecycle.addListener(unlockBtn, 'click', handleUnlock);
                lifecycle.addListener(masterInput, 'keydown', (e) => {
                    if (e.key === 'Enter') handleUnlock();
                });
                if (masterConfirmInput) {
                    lifecycle.addListener(masterConfirmInput, 'keydown', (e) => {
                        if (e.key === 'Enter') handleUnlock();
                    });
                }
                lifecycle.addListener(toggleMasterBtn, 'click', () => setLockPasswordsVisible(!lockPasswordsVisible));
                if (toggleConfirmBtn) {
                    lifecycle.addListener(toggleConfirmBtn, 'click', () => setLockPasswordsVisible(!lockPasswordsVisible));
                }
                lifecycle.addListener(resetBtn, 'click', resetVaultAndStartOver);
                lifecycle.addListener(lockBtn, 'click', lockVault);

                const hasExistingHash = await getMasterPasswordHash();
                showLockScreen(!hasExistingHash);

                // Return destroy method for cleanup
                return {
                    destroy: () => {
                        stopAutoLockTimer();
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
