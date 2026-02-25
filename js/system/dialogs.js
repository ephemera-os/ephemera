const EphemeraDialog = {
    overlay: null,
    container: null,
    _activeDialogCleanup: null,
    
    init() {
        if (this.overlay) return;
        
        this.overlay = document.createElement('div');
        this.overlay.id = 'dialog-overlay';
        this.overlay.innerHTML = `
            <style>
                #dialog-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    display: none;
                    align-items: center;
                    justify-content: center;
                    z-index: 100000;
                    backdrop-filter: blur(4px);
                }
                #dialog-overlay.open { display: flex; }
                .dialog-box {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                    min-width: 320px;
                    max-width: 480px;
                    animation: dialogIn 0.2s ease-out;
                }
                @keyframes dialogIn {
                    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .dialog-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border);
                }
                .dialog-header svg {
                    width: 24px;
                    height: 24px;
                    flex-shrink: 0;
                }
                .dialog-header svg.info { color: #00a8ff; }
                .dialog-header svg.success { color: var(--accent); }
                .dialog-header svg.warning { color: var(--warning); }
                .dialog-header svg.error { color: var(--danger); }
                .dialog-header svg.question { color: #a855f7; }
                .dialog-title {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--fg-primary);
                }
                .dialog-content {
                    padding: 20px;
                    color: var(--fg-secondary);
                    font-size: 0.9rem;
                    line-height: 1.5;
                }
                .dialog-content p { margin: 0 0 12px; }
                .dialog-content p:last-child { margin-bottom: 0; }
                .dialog-input {
                    width: 100%;
                    padding: 10px 12px;
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-sm);
                    color: var(--fg-primary);
                    font-size: 0.9rem;
                    margin-top: 12px;
                    outline: none;
                }
                .dialog-input:focus {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 2px var(--accent-glow);
                }
                .dialog-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding: 16px 20px;
                    border-top: 1px solid var(--border);
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
                }
                .dialog-btn {
                    padding: 8px 20px;
                    border-radius: var(--radius-sm);
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                    border: 1px solid var(--border);
                    background: var(--bg-tertiary);
                    color: var(--fg-secondary);
                    transition: all 0.15s;
                }
                .dialog-btn:hover {
                    background: var(--bg-secondary);
                    color: var(--fg-primary);
                }
                .dialog-btn.primary {
                    background: var(--accent);
                    border-color: var(--accent);
                    color: var(--accent-contrast);
                }
                .dialog-btn.primary:hover {
                    background: var(--accent-hover);
                }
                .dialog-btn.danger {
                    background: var(--danger);
                    border-color: var(--danger);
                    color: var(--danger-contrast);
                }
                .dialog-btn.danger:hover {
                    filter: brightness(1.1);
                }
            </style>
            <div class="dialog-box" id="dialog-box"></div>
        `;
        document.body.appendChild(this.overlay);
        this.container = document.getElementById('dialog-box');
    },
    
    icons: {
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="info"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="success"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="warning"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="error"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        question: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="question"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
    },
    
    show(options) {
        this.init();

        if (typeof this._activeDialogCleanup === 'function') {
            this._activeDialogCleanup();
            this._activeDialogCleanup = null;
        }
        
        const { title, message, icon = 'info', input = null, buttons = [{ label: 'OK', primary: true }] } = options;
        const safeTitle = EphemeraSanitize.escapeHtml(title || '');
        const safeMessage = EphemeraSanitize.escapeHtml(message || '');
        const titleId = 'dialog-title';
        const messageId = 'dialog-message';
        
        let inputHtml = '';
        if (input) {
            inputHtml = `<input type="${EphemeraSanitize.escapeAttr(input.type || 'text')}" class="dialog-input" id="dialog-input" placeholder="${EphemeraSanitize.escapeAttr(input.placeholder || '')}" value="${EphemeraSanitize.escapeAttr(input.value || '')}">`;
        }
        
        this.container.innerHTML = `
            <div class="dialog-header">
                ${this.icons[icon] || this.icons.info}
                <span class="dialog-title" id="${titleId}">${safeTitle}</span>
            </div>
            <div class="dialog-content">
                <p id="${messageId}">${safeMessage}</p>
                ${inputHtml}
            </div>
            <div class="dialog-actions">
                ${buttons.map((btn, i) => {
                    const classes = ['dialog-btn'];
                    if (btn.primary) classes.push('primary');
                    if (btn.danger) classes.push('danger');
                    return `<button type="button" class="${classes.join(' ')}" data-index="${i}">${btn.label}</button>`;
                }).join('')}
            </div>
        `;
        
        this.container.setAttribute('role', 'alertdialog');
        this.container.setAttribute('aria-modal', 'true');
        this.container.setAttribute('aria-labelledby', titleId);
        this.container.setAttribute('aria-describedby', messageId);

        return new Promise((resolve) => {
            const previousFocus = document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            const inputEl = document.getElementById('dialog-input');
            const allBtns = Array.from(this.container.querySelectorAll('.dialog-btn'));
            const cancelValue = (() => {
                const cancelBtn = buttons.find((btn) => !btn.primary && !btn.danger);
                return cancelBtn?.value !== undefined ? cancelBtn.value : false;
            })();
            let settled = false;

            const getFocusable = () => {
                return Array.from(this.container.querySelectorAll([
                    'button:not([disabled])',
                    'input:not([disabled])',
                    'select:not([disabled])',
                    'textarea:not([disabled])',
                    '[tabindex]:not([tabindex="-1"])'
                ].join(',')));
            };

            const restoreFocus = () => {
                if (previousFocus?.isConnected) {
                    previousFocus.focus();
                }
            };

            const cleanup = () => {
                document.removeEventListener('keydown', trapKeyHandler, true);
                this._activeDialogCleanup = null;
            };

            const finish = (value, options = {}) => {
                if (settled) return;
                settled = true;
                cleanup();
                this.close();
                resolve(value);
                if (options.deferFocusRestore === true) {
                    setTimeout(restoreFocus, 0);
                } else {
                    restoreFocus();
                }
            };

            const activateButton = (index, options = {}) => {
                const safeIndex = Number.isInteger(index) ? index : 0;
                const selected = buttons[safeIndex] || buttons[0];
                const result = selected?.value !== undefined ? selected.value : true;
                if (input && result) {
                    finish(inputEl?.value ?? '', options);
                } else {
                    finish(result, options);
                }
            };

            const trapKeyHandler = (e) => {
                if (!this.overlay.classList.contains('open')) return;

                if (e.key === 'Escape') {
                    e.preventDefault();
                    finish(cancelValue);
                    return;
                }

                if (e.key === 'Tab') {
                    const focusable = getFocusable();
                    if (focusable.length === 0) return;
                    const first = focusable[0];
                    const last = focusable[focusable.length - 1];
                    if (e.shiftKey) {
                        if (document.activeElement === first) {
                            e.preventDefault();
                            last.focus();
                        }
                    } else {
                        if (document.activeElement === last) {
                            e.preventDefault();
                            first.focus();
                        }
                    }
                }
            };

            this._activeDialogCleanup = cleanup;
            document.addEventListener('keydown', trapKeyHandler, true);

            if (inputEl) {
                setTimeout(() => inputEl.focus(), 50);
                inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        // Keep Enter submission local to the dialog to avoid retriggering the invoking button.
                        e.preventDefault();
                        e.stopPropagation();
                        const primaryBtn = this.container.querySelector('.dialog-btn.primary');
                        const primaryIndex = Number.parseInt(primaryBtn?.dataset?.index || '0', 10);
                        activateButton(Number.isFinite(primaryIndex) ? primaryIndex : 0, { deferFocusRestore: true });
                    }
                });
            } else {
                // Focus the primary button (or first button)
                const primaryBtn = this.container.querySelector('.dialog-btn.primary') || allBtns[0];
                if (primaryBtn) setTimeout(() => primaryBtn.focus(), 50);
            }

            allBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const index = Number.parseInt(btn.dataset.index, 10);
                    activateButton(index);
                });
            });

            this.overlay.classList.add('open');
        });
    },
    
    close() {
        if (this.overlay) {
            this.overlay.classList.remove('open');
        }
        if (typeof this._activeDialogCleanup === 'function') {
            this._activeDialogCleanup();
            this._activeDialogCleanup = null;
        }
    },
    
    alert(message, title = 'Notice') {
        return this.show({
            title,
            message,
            icon: 'info',
            buttons: [{ label: 'OK', primary: true }]
        });
    },
    
    success(message, title = 'Success') {
        return this.show({
            title,
            message,
            icon: 'success',
            buttons: [{ label: 'OK', primary: true }]
        });
    },
    
    error(message, title = 'Error') {
        return this.show({
            title,
            message,
            icon: 'error',
            buttons: [{ label: 'OK', primary: true }]
        });
    },
    
    warning(message, title = 'Warning') {
        return this.show({
            title,
            message,
            icon: 'warning',
            buttons: [{ label: 'OK', primary: true }]
        });
    },
    
    confirm(message, title = 'Confirm', dangerous = false) {
        return this.show({
            title,
            message,
            icon: 'question',
            buttons: [
                { label: 'Cancel', value: false },
                { label: 'Confirm', primary: !dangerous, danger: dangerous, value: true }
            ]
        });
    },
    
    prompt(message, defaultValue = '', title = 'Input', placeholder = '') {
        return this.show({
            title,
            message,
            icon: 'info',
            input: { value: defaultValue, placeholder },
            buttons: [
                { label: 'Cancel', value: false },
                { label: 'OK', primary: true, value: true }
            ]
        });
    }
};

window.EphemeraDialog = EphemeraDialog;
