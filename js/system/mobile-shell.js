const EphemeraMobileShell = {
    _initialized: false,
    _clockInterval: null,
    _gestureStart: null,
    _cleanupFns: [],
    shellEl: null,
    appGridEl: null,
    clockEl: null,
    homeBtn: null,
    backBtn: null,
    appsBtn: null,

    init() {
        if (this._initialized) return;
        this._initialized = true;

        document.body.classList.add('mobile-shell-mode');
        this.ensureStructure();
        this.renderAppGrid();
        this.attachEvents();
        this.updateClock();
        this._clockInterval = setInterval(() => this.updateClock(), 1000);
        this.updateActiveState();
    },

    destroy() {
        this._initialized = false;
        if (this._clockInterval) {
            clearInterval(this._clockInterval);
            this._clockInterval = null;
        }
        this._gestureStart = null;
        this._cleanupFns.forEach(fn => {
            try {
                fn();
            } catch (_e) {
                // Ignore cleanup failures.
            }
        });
        this._cleanupFns = [];
    },

    ensureStructure() {
        let shell = document.getElementById('mobile-shell');
        if (!shell) {
            shell = document.createElement('section');
            shell.id = 'mobile-shell';
            shell.setAttribute('aria-label', 'Mobile Shell');
            shell.innerHTML = `
                <div class="mobile-shell-backdrop" aria-hidden="true"></div>
                <header class="mobile-shell-header">
                    <div class="mobile-shell-brand">Ephemera</div>
                    <div id="mobile-shell-clock" class="mobile-shell-clock" aria-live="polite"></div>
                </header>
                <div class="mobile-shell-content">
                    <div id="mobile-app-grid" class="mobile-app-grid" role="grid" aria-label="Applications"></div>
                </div>
                <nav id="mobile-bottom-nav" role="toolbar" aria-label="Mobile Navigation">
                    <button id="mobile-nav-home" type="button" aria-label="Go Home">Home</button>
                    <button id="mobile-nav-back" type="button" aria-label="Back">Back</button>
                    <button id="mobile-nav-apps" type="button" aria-label="Show Apps">Apps</button>
                </nav>
            `;
            document.body.appendChild(shell);
        }

        this.shellEl = shell;
        this.appGridEl = shell.querySelector('#mobile-app-grid');
        this.clockEl = shell.querySelector('#mobile-shell-clock');
        this.homeBtn = shell.querySelector('#mobile-nav-home');
        this.backBtn = shell.querySelector('#mobile-nav-back');
        this.appsBtn = shell.querySelector('#mobile-nav-apps');
    },

    renderAppGrid() {
        if (!this.appGridEl || !window.EphemeraApps) return;

        const apps = EphemeraApps.getAll()
            .filter(app => app.category !== 'hidden')
            .sort((a, b) => String(a.name).localeCompare(String(b.name)));

        this.appGridEl.innerHTML = '';
        for (const app of apps) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mobile-app-button';
            button.dataset.appId = app.id;
            button.setAttribute('role', 'gridcell');
            button.setAttribute('aria-label', `Open ${app.name}`);

            const icon = document.createElement('div');
            icon.className = 'mobile-app-icon';
            icon.innerHTML = app.icon || '';

            const label = document.createElement('span');
            label.className = 'mobile-app-name';
            label.textContent = app.name;

            button.appendChild(icon);
            button.appendChild(label);
            button.addEventListener('click', () => this.openApp(app.id));
            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.openApp(app.id);
                }
            });
            this.appGridEl.appendChild(button);
        }
    },

    attachEvents() {
        const registerCleanup = (maybeCleanup) => {
            if (typeof maybeCleanup === 'function') {
                this._cleanupFns.push(maybeCleanup);
            }
        };

        const onHomeClick = () => { void this.goHome(); };
        const onBackClick = () => { void this.closeTopWindow(); };
        const onAppsClick = () => {
            this.renderAppGrid();
            void this.goHome();
        };

        this.homeBtn.addEventListener('click', onHomeClick);
        this.backBtn.addEventListener('click', onBackClick);
        this.appsBtn.addEventListener('click', onAppsClick);
        this._cleanupFns.push(() => this.homeBtn?.removeEventListener('click', onHomeClick));
        this._cleanupFns.push(() => this.backBtn?.removeEventListener('click', onBackClick));
        this._cleanupFns.push(() => this.appsBtn?.removeEventListener('click', onAppsClick));

        const onPointerDown = (e) => {
            this._gestureStart = {
                x: e.clientX,
                y: e.clientY,
                at: Date.now()
            };
        };
        const onPointerUp = (e) => {
            if (!this._gestureStart || !this.hasOpenWindows()) return;
            const start = this._gestureStart;
            this._gestureStart = null;

            const dx = e.clientX - start.x;
            const dy = Math.abs(e.clientY - start.y);
            const dt = Date.now() - start.at;

            if (start.x <= 24 && dx >= 72 && dy <= 60 && dt <= 750) {
                void this.closeTopWindow();
            }
        };
        document.addEventListener('pointerdown', onPointerDown, { passive: true });
        document.addEventListener('pointerup', onPointerUp, { passive: true });
        this._cleanupFns.push(() => document.removeEventListener('pointerdown', onPointerDown));
        this._cleanupFns.push(() => document.removeEventListener('pointerup', onPointerUp));

        registerCleanup(window.EphemeraEvents?.on?.('window:opened', () => this.updateActiveState()));
        registerCleanup(window.EphemeraEvents?.on?.('window:closed', () => this.updateActiveState()));
        registerCleanup(window.EphemeraEvents?.on?.('window:focused', () => this.updateActiveState()));
        registerCleanup(window.EphemeraEvents?.on?.('window:minimized', () => this.updateActiveState()));
        registerCleanup(window.EphemeraEvents?.on?.('app:installed', () => this.renderAppGrid()));
        registerCleanup(window.EphemeraEvents?.on?.('app:uninstalled', () => this.renderAppGrid()));
    },

    openApp(appId) {
        if (!window.EphemeraWM) return null;
        return EphemeraWM.open(appId, { mobileFullscreen: true });
    },

    hasOpenWindows() {
        return Array.isArray(EphemeraState?.windows) && EphemeraState.windows.length > 0;
    },

    async closeTopWindow() {
        if (!window.EphemeraWM || !this.hasOpenWindows()) {
            this.updateActiveState();
            return false;
        }

        const activeId = EphemeraState.activeWindowId;
        const fallbackId = EphemeraState.windows[EphemeraState.windows.length - 1]?.id;
        const targetId = activeId ?? fallbackId;
        if (targetId === undefined || targetId === null) return false;

        const before = EphemeraState.windows.length;
        await EphemeraWM.close(targetId);
        this.updateActiveState();
        return EphemeraState.windows.length < before;
    },

    async goHome() {
        if (!window.EphemeraWM || !this.hasOpenWindows()) {
            this.updateActiveState();
            return;
        }

        const ids = EphemeraState.windows.map(win => win.id).reverse();
        for (const windowId of ids) {
            const before = EphemeraState.windows.length;
            await EphemeraWM.close(windowId);
            if (EphemeraState.windows.length === before) {
                break;
            }
        }
        this.updateActiveState();
    },

    updateClock() {
        if (!this.clockEl) return;
        const now = new Date();
        this.clockEl.textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    updateActiveState() {
        const hasWindows = this.hasOpenWindows();
        document.body.classList.toggle('app-active', hasWindows);
        this.backBtn.disabled = !hasWindows;
        this.backBtn.setAttribute('aria-disabled', String(!hasWindows));
    }
};

window.EphemeraMobileShell = EphemeraMobileShell;
