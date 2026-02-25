EphemeraApps.register({
    id: 'help',
    name: 'Help',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    width: 700,
    height: 550,
    category: 'system',
    singleton: true,
    content: (_windowId) => {
        const homeDir = EphemeraFS.homeDir || EphemeraState?.user?.homeDir || '/home/user';
        return {
            html: `
                <style>
                    .help-container { display:flex;height:100%; }
                    .help-sidebar { width:180px;background:var(--bg-secondary);border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0; }
                    .help-nav-item { padding:12px 16px;cursor:pointer;font-size:0.85rem;color:var(--fg-secondary);border-left:3px solid transparent;transition:all 0.15s; }
                    .help-nav-item:hover { background:rgba(255,255,255,0.05);color:var(--fg-primary); }
                    .help-nav-item.active { background:rgba(0,212,170,0.1);border-left-color:var(--accent);color:var(--accent); }
                    .help-content { flex:1;overflow-y:auto;padding:24px; }
                    .help-section { display:none; }
                    .help-section.active { display:block; }
                    .help-section h2 { font-size:1.4rem;color:var(--fg-primary);margin:0 0 20px;padding-bottom:12px;border-bottom:1px solid var(--border); }
                    .help-section h3 { font-size:1.1rem;color:var(--fg-primary);margin:24px 0 12px; }
                    .help-section p { color:var(--fg-secondary);line-height:1.7;margin:0 0 16px; }
                    .help-section ul { margin:0 0 16px 20px;color:var(--fg-secondary); }
                    .help-section li { margin:8px 0;line-height:1.6; }
                    .shortcut-table { width:100%;border-collapse:collapse;margin:16px 0; }
                    .shortcut-table th,.shortcut-table td { padding:10px 12px;text-align:left;border-bottom:1px solid var(--border); }
                    .shortcut-table th { background:var(--bg-secondary);color:var(--fg-primary);font-weight:500; }
                    .shortcut-table td { color:var(--fg-secondary); }
                    .shortcut-table code { background:var(--bg-tertiary);padding:3px 8px;border-radius:4px;font-size:0.8rem;color:var(--accent); }
                    .app-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin:16px 0; }
                    .app-card { padding:16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);text-align:center; }
                    .app-card svg { width:32px;height:32px;margin-bottom:8px;color:var(--accent); }
                    .app-card h4 { font-size:0.85rem;color:var(--fg-primary);margin:0 0 4px; }
                    .app-card p { font-size:0.75rem;color:var(--fg-muted);margin:0; }
                    .info-box { background:rgba(0,212,170,0.1);border:1px solid rgba(0,212,170,0.3);border-radius:var(--radius-md);padding:16px;margin:16px 0; }
                    .info-box h4 { color:var(--accent);margin:0 0 8px;font-size:0.9rem; }
                    .info-box p { margin:0;color:var(--fg-secondary);font-size:0.85rem; }
                    .warning-box { background:rgba(255,184,77,0.1);border:1px solid rgba(255,184,77,0.3);border-radius:var(--radius-md);padding:16px;margin:16px 0; }
                    .warning-box h4 { color:var(--warning);margin:0 0 8px;font-size:0.9rem; }
                    .warning-box p { margin:0;color:var(--fg-secondary);font-size:0.85rem; }
                </style>
                <div class="help-container">
                    <div class="help-sidebar">
                        <div class="help-nav-item active" data-section="getting-started">Getting Started</div>
                        <div class="help-nav-item" data-section="shortcuts">Keyboard Shortcuts</div>
                        <div class="help-nav-item" data-section="apps">App Reference</div>
                        <div class="help-nav-item" data-section="files">Files & Data</div>
                        <div class="help-nav-item" data-section="privacy">Privacy & Security</div>
                        <div class="help-nav-item" data-section="troubleshooting">Troubleshooting</div>
                    </div>
                    <div class="help-content">
                        <div class="help-section active" id="help-getting-started">
                            <h2>Getting Started</h2>
                            <p>Welcome to Ephemera, your browser-based operating system. This guide will help you get up and running quickly.</p>

                            <h3>What is Ephemera?</h3>
                            <p>Ephemera is a virtual desktop environment that runs entirely in your browser. It includes:</p>
                            <ul>
                                <li>A virtual file system with persistent storage</li>
                                <li>32 built-in applications for productivity, development, and entertainment</li>
                                <li>AI integration for code assistance and chat</li>
                                <li>A secure, encrypted environment for your data</li>
                                <li>Multiple workspaces for organizing your workflow</li>
                            </ul>

                            <h3>First Steps</h3>
                            <ol>
                                <li><strong>Sign In:</strong> Create a profile with a password to encrypt your data</li>
                                <li><strong>Explore Apps:</strong> Click the Start button or press Win/Cmd+Space</li>
                                <li><strong>Check Files:</strong> Open the Files app to see your virtual documents</li>
                                <li><strong>Customize:</strong> Open Settings to change your wallpaper and preferences</li>
                            </ol>

                            <div class="info-box">
                                <h4>Pro Tip</h4>
                                <p>Press <code>Ctrl + 1-4</code> to switch workspaces, <code>Ctrl + Shift + 1-4</code> to move the active window, and <code>Super/Cmd + Tab</code> for overview.</p>
                            </div>
                        </div>

                        <div class="help-section" id="help-shortcuts">
                            <h2>Keyboard Shortcuts</h2>

                            <h3>System Shortcuts</h3>
                            <table class="shortcut-table">
                                <tr><th>Shortcut</th><th>Action</th></tr>
                                <tr><td><code>Win/Cmd + Space</code></td><td>Open search</td></tr>
                                <tr><td><code>Ctrl + 1-4</code></td><td>Switch workspace</td></tr>
                                <tr><td><code>Ctrl + Shift + 1-4</code></td><td>Move active window to workspace</td></tr>
                                <tr><td><code>Super/Cmd + Tab</code></td><td>Workspace overview</td></tr>
                                <tr><td><code>Ctrl + W</code></td><td>Close window</td></tr>
                                <tr><td><code>Ctrl + Tab</code></td><td>Cycle windows</td></tr>
                                <tr><td><code>F11</code></td><td>Maximize window</td></tr>
                                <tr><td><code>Escape</code></td><td>Close modal/menu</td></tr>
                            </table>

                            <h3>Quick Launch</h3>
                            <table class="shortcut-table">
                                <tr><th>Shortcut</th><th>Action</th></tr>
                                <tr><td><code>Ctrl + Shift + T</code></td><td>Open Terminal</td></tr>
                                <tr><td><code>Ctrl + Shift + E</code></td><td>Open Files</td></tr>
                                <tr><td><code>Ctrl + Shift + P</code></td><td>Open Command Palette</td></tr>
                                <tr><td><code>Ctrl + P</code></td><td>Open File Palette</td></tr>
                                <tr><td><code>Ctrl + Shift + C</code></td><td>Open Code Editor</td></tr>
                                <tr><td><code>Ctrl + Shift + B</code></td><td>Open Browser</td></tr>
                            </table>

                            <h3>Text Editing</h3>
                            <table class="shortcut-table">
                                <tr><th>Shortcut</th><th>Action</th></tr>
                                <tr><td><code>Ctrl + S</code></td><td>Save file</td></tr>
                                <tr><td><code>Ctrl + Z</code></td><td>Undo</td></tr>
                                <tr><td><code>Ctrl + Shift + Z</code></td><td>Redo</td></tr>
                                <tr><td><code>Ctrl + F</code></td><td>Find</td></tr>
                            </table>
                        </div>

                        <div class="help-section" id="help-apps">
                            <h2>App Reference</h2>

                            <h3>System Apps</h3>
                            <div class="app-grid">
                                <div class="app-card">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                                    <h4>Files</h4>
                                    <p>Browse & manage files</p>
                                </div>
                                <div class="app-card">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                                    <h4>Code Editor</h4>
                                    <p>Write code with AI help</p>
                                </div>
                                <div class="app-card">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                                    <h4>Terminal</h4>
                                    <p>Command line interface</p>
                                </div>
                                <div class="app-card">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24"/></svg>
                                    <h4>Settings</h4>
                                    <p>System preferences</p>
                                </div>
                            </div>

                            <h3>Productivity Apps</h3>
                            <div class="app-grid">
                                <div class="app-card">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
                                    <h4>Notepad</h4>
                                    <p>Quick text editor</p>
                                </div>
                                <div class="app-card">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                                    <h4>Password Vault</h4>
                                    <p>Secure password storage</p>
                                </div>
                                <div class="app-card">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
                                    <h4>Markdown in Code</h4>
                                    <p>Edit .md with live preview</p>
                                </div>
                                <div class="app-card">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                    <h4>Calendar</h4>
                                    <p>Schedule & events</p>
                                </div>
                            </div>

                            <h3>AI Features</h3>
                            <p>The <strong>AI Chat</strong> app and <strong>Code Editor</strong> include AI assistance powered by OpenRouter. Configure your API key in Settings to enable these features.</p>
                        </div>

                        <div class="help-section" id="help-files">
                            <h2>Files & Data Management</h2>

                            <h3>Virtual File System</h3>
                            <p>Your files are stored in a virtual file system backed by IndexedDB. Data persists between sessions and is encrypted when you're signed in.</p>

                            <h3>File Locations</h3>
                            <table class="shortcut-table">
                                <tr><th>Path</th><th>Contents</th></tr>
                                <tr><td><code>${homeDir}/</code></td><td>Your home directory</td></tr>
                                <tr><td><code>${homeDir}/Documents/</code></td><td>Documents</td></tr>
                                <tr><td><code>${homeDir}/Downloads/</code></td><td>Downloaded files</td></tr>
                                <tr><td><code>${homeDir}/apps/</code></td><td>Custom applications</td></tr>
                                <tr><td><code>${homeDir}/.trash/</code></td><td>Deleted files</td></tr>
                            </table>

                            <h3>Data Export</h3>
                            <p>To backup your data:</p>
                            <ol>
                                <li>Open <strong>Settings</strong></li>
                                <li>Go to the <strong>Data</strong> tab</li>
                                <li>Click <strong>Export All Data</strong></li>
                                <li>Save the JSON file to your computer</li>
                            </ol>

                            <h3>Data Import</h3>
                            <p>To restore from backup:</p>
                            <ol>
                                <li>Open <strong>Settings</strong></li>
                                <li>Go to the <strong>Data</strong> tab</li>
                                <li>Click <strong>Import Data</strong></li>
                                <li>Select your backup JSON file</li>
                            </ol>

                            <div class="warning-box">
                                <h4>Important</h4>
                                <p>Data is stored in your browser's IndexedDB. Clearing browser data will delete your files. Export regularly!</p>
                            </div>
                        </div>

                        <div class="help-section" id="help-privacy">
                            <h2>Privacy & Security</h2>

                            <h3>Data Storage</h3>
                            <p>All your data is stored locally in your browser using IndexedDB. Nothing is sent to external servers except:</p>
                            <ul>
                                <li>AI API requests (when configured) to OpenRouter</li>
                                <li>Web requests through CORS proxies (when enabled)</li>
                            </ul>

                            <h3>Encryption</h3>
                            <p>When you create a profile with a password:</p>
                            <ul>
                                <li>Your password is hashed using Argon2id</li>
                                <li>A master key is derived for encryption</li>
                                <li>File contents and sensitive settings are encrypted</li>
                                <li>Data remains encrypted when you're logged out</li>
                            </ul>

                            <h3>Session Security</h3>
                            <ul>
                                <li>Sessions timeout after configurable inactivity</li>
                                <li>Password manager auto-locks on focus loss</li>
                                <li>Multiple failed login attempts trigger lockout</li>
                            </ul>

                            <h3>CORS Proxies</h3>
                            <p>When browsing external websites, requests may go through public CORS proxies. These proxies may log requests. For sensitive browsing, consider:</p>
                            <ul>
                                <li>Using a custom proxy you control</li>
                                <li>Disabling the proxy for direct requests</li>
                            </ul>

                            <h3>What We Don't Do</h3>
                            <ul>
                                <li>No tracking or analytics beyond optional error reporting</li>
                                <li>No cookies beyond session management</li>
                                <li>No data sent to third parties without your action</li>
                            </ul>
                        </div>

                        <div class="help-section" id="help-troubleshooting">
                            <h2>Troubleshooting</h2>

                            <h3>Common Issues</h3>

                            <h4>App won't open</h4>
                            <ul>
                                <li>Try refreshing the page (F5)</li>
                                <li>Check browser console for errors (F12)</li>
                                <li>Clear browser cache and reload</li>
                            </ul>

                            <h4>Files disappeared</h4>
                            <ul>
                                <li>Check if you're signed in to the correct profile</li>
                                <li>Check the trash folder in Files app</li>
                                <li>Try importing from a backup</li>
                            </ul>

                            <h4>AI features not working</h4>
                            <ul>
                                <li>Add an AI provider API key in Settings</li>
                                <li>Check your internet connection</li>
                                <li>Verify the key is valid for your selected provider</li>
                            </ul>

                            <h4>CORS errors in Browser app</h4>
                            <ul>
                                <li>Enable the CORS proxy in Settings</li>
                                <li>Try a different proxy URL</li>
                                <li>Some sites block all proxy access</li>
                            </ul>

                            <h4>Slow performance</h4>
                            <ul>
                                <li>Close unused windows</li>
                                <li>Clear terminal history in Terminal app</li>
                                <li>Restart your browser</li>
                            </ul>

                            <h4>Forgot password</h4>
                            <div class="warning-box">
                                <h4>Important</h4>
                                <p>Passwords cannot be recovered. You'll need to create a new profile, but your old encrypted data will be inaccessible.</p>
                            </div>

                            <h3>Getting More Help</h3>
                            <p>If you encounter issues not covered here:</p>
                            <ul>
                                <li>Report bugs on the project's GitHub issues page</li>
                                <li>Check the PROGRAMMERS_GUIDE.md for technical details</li>
                                <li>Review browser console logs for error messages</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const navItems = document.querySelectorAll('.help-nav-item');
                const sections = document.querySelectorAll('.help-section');

                navItems.forEach(item => {
                    lifecycle.addListener(item, 'click', () => {
                        const sectionId = item.dataset.section;

                        navItems.forEach(n => n.classList.remove('active'));
                        item.classList.add('active');

                        sections.forEach(s => s.classList.remove('active'));
                        document.getElementById(`help-${sectionId}`).classList.add('active');
                    });
                });

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
