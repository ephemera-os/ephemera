const EphemeraNotifications = {
    container: null,
    queue: [],
    maxVisible: 3,
    
    init() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.setAttribute('role', 'log');
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-label', 'Notifications');
        this.container.style.cssText = `
            position: fixed;
            top: 60px;
            right: 12px;
            width: 320px;
            z-index: 9800;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
        `;
        document.body.appendChild(this.container);
    },
    
    show(options) {
        options = options || {};
        if (!EphemeraState.settings.notifications) return null;
        
        const notification = {
            id: Date.now(),
            title: options.title || 'Notification',
            message: options.message || '',
            type: options.type || 'info',
            icon: options.icon,
            duration: options.duration ?? 5000,
            onClick: options.onClick,
            onClose: options.onClose,
            actions: options.actions || []
        };
        
        this.queue.push(notification);
        this.render(notification);
        this.updateBadge();
        
        EphemeraEvents.emit('notification:shown', notification);
        return notification.id;
    },
    
    render(notification) {
        const escapeHtml = window.EphemeraSanitize?.escapeHtml
            ? window.EphemeraSanitize.escapeHtml.bind(window.EphemeraSanitize)
            : (value) => String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

        const safeTitle = escapeHtml(notification.title || 'Notification');
        const safeMessage = escapeHtml(notification.message || '').replace(/\n/g, '<br>');
        const el = document.createElement('div');
        el.className = 'notification';
        el.dataset.id = notification.id;
        el.style.cssText = `
            background: var(--glass);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: 14px 16px;
            pointer-events: auto;
            cursor: pointer;
            box-shadow: var(--window-shadow);
            animation: notificationSlide 0.3s ease;
            border-left: 3px solid ${this.getTypeColor(notification.type)};
        `;
        
        // Prevent icon HTML injection by always using trusted built-in icons.
        const icon = this.getTypeIcon(notification.type);
        
        el.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:12px;">
                <div style="flex-shrink:0;opacity:0.8;">${icon}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:500;font-size:0.9rem;margin-bottom:4px;">${safeTitle}</div>
                    <div style="font-size:0.8rem;color:var(--fg-secondary);line-height:1.4;">${safeMessage}</div>
                    ${notification.actions.length ? `
                        <div style="display:flex;gap:8px;margin-top:10px;">
                            ${notification.actions.map((action, i) => `
                                <button class="notif-action" data-action="${i}" style="
                                    padding:5px 12px;
                                    font-size:0.75rem;
                                    background:${action.primary ? 'var(--accent)' : 'var(--bg-tertiary)'};
                                    color:${action.primary ? 'var(--accent-contrast)' : 'var(--fg-primary)'};
                                    border:none;
                                    border-radius:var(--radius-sm);
                                    cursor:pointer;
                                ">${escapeHtml(action.label || 'Action')}</button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <button class="notif-close" style="
                    background:none;
                    border:none;
                    color:var(--fg-muted);
                    cursor:pointer;
                    padding:2px;
                    font-size:1.2rem;
                    line-height:1;
                ">×</button>
            </div>
        `;
        
        const closeBtn = el.querySelector('.notif-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dismiss(notification.id);
        });
        
        if (notification.onClick) {
            el.addEventListener('click', (e) => {
                if (!e.target.classList.contains('notif-action') && !e.target.classList.contains('notif-close')) {
                    notification.onClick();
                    this.dismiss(notification.id);
                }
            });
        }
        
        notification.actions.forEach((action, i) => {
            const btn = el.querySelector(`[data-action="${i}"]`);
            if (btn && action.onClick) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    action.onClick();
                    this.dismiss(notification.id);
                });
            }
        });
        
        this.container.appendChild(el);
        
        if (notification.duration > 0) {
            setTimeout(() => this.dismiss(notification.id), notification.duration);
        }
        
        while (this.container.children.length > this.maxVisible) {
            const oldest = this.container.firstChild;
            if (oldest) this.dismiss(parseInt(oldest.dataset.id));
        }
    },
    
    dismiss(notificationId) {
        const el = this.container.querySelector(`[data-id="${notificationId}"]`);
        if (el) {
            el.style.animation = 'notificationSlideOut 0.2s ease forwards';
            setTimeout(() => el.remove(), 200);
        }
        
        const idx = this.queue.findIndex(n => n.id === notificationId);
        if (idx > -1) {
            const notification = this.queue[idx];
            this.queue.splice(idx, 1);
            if (notification.onClose) notification.onClose();
        }
        
        this.updateBadge();
        EphemeraEvents.emit('notification:dismissed', { id: notificationId });
    },
    
    dismissAll() {
        this.queue.forEach(n => this.dismiss(n.id));
    },
    
    updateBadge() {
        const bell = document.getElementById('notification-bell');
        if (bell) {
            bell.classList.toggle('has-notifications', this.queue.length > 0);
            const badge = bell.querySelector('.badge');
            if (badge) badge.style.display = this.queue.length > 0 ? 'block' : 'none';
        }
    },
    
    getTypeColor(type) {
        const colors = {
            info: 'var(--accent)',
            success: '#4dff88',
            warning: 'var(--warning)',
            error: 'var(--danger)'
        };
        return colors[type] || colors.info;
    },
    
    getTypeIcon(type) {
        const icons = {
            info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
            success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
        };
        return icons[type] || icons.info;
    },
    
    info(title, message, options = {}) {
        return this.show({ title, message, type: 'info', ...options });
    },
    
    success(title, message, options = {}) {
        return this.show({ title, message, type: 'success', ...options });
    },
    
    warning(title, message, options = {}) {
        return this.show({ title, message, type: 'warning', ...options });
    },
    
    error(title, message, options = {}) {
        return this.show({ title, message, type: 'error', ...options });
    }
};

const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes notificationSlide {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes notificationSlideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(notificationStyles);

window.EphemeraNotifications = EphemeraNotifications;
