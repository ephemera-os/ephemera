const EphemeraPWA = {
    VISIT_COUNT_KEY: 'ephemera:pwa:visits',
    INSTALL_DISMISSED_KEY: 'ephemera:pwa:dismissed',
    INSTALL_MODAL_SHOWN_KEY: 'ephemera:pwa:modal-shown',
    INSTALLED_KEY: 'ephemera:pwa:installed',
    POST_INSTALL_SPLASH_KEY: 'ephemera:pwa:post-install-splash',
    _initialized: false,
    _handlers: [],
    _sessionModalDismissed: false,
    _sessionBannerDismissed: false,
    _deferredPromptEvent: null,
    _visitCount: 0,
    _bannerEl: null,
    _modalEl: null,
    _overlayEl: null,

    async init() {
        if (this._initialized) return;
        this._initialized = true;

        this._visitCount = this.incrementVisitCount();
        this.ensureUI();
        this.attachGlobalListeners();
        this.attachUIListeners();

        await this.maybeShowPostInstallSplash();
        this.syncUIState();
    },

    destroy() {
        this._handlers.forEach(({ target, type, handler, options }) => {
            try {
                target.removeEventListener(type, handler, options);
            } catch (_e) {
                // Ignore teardown failure.
            }
        });
        this._handlers = [];
        this._initialized = false;
        this._deferredPromptEvent = null;
        this._sessionModalDismissed = false;
        this._sessionBannerDismissed = false;

        this._bannerEl?.remove();
        this._modalEl?.remove();
        this._overlayEl?.remove();
        this._bannerEl = null;
        this._modalEl = null;
        this._overlayEl = null;
    },

    _resetForTests() {
        this.destroy();
    },

    attachGlobalListeners() {
        const onBeforeInstallPrompt = (event) => {
            event.preventDefault();
            this._deferredPromptEvent = event;
            this.syncUIState();
        };

        const onAppInstalled = () => {
            this.markInstalled();
            this.hideBanner();
            this.hideModal();
            if (window.EphemeraNotifications) {
                EphemeraNotifications.success('Installed', 'Ephemera is now installed.');
            }
        };

        const onEscape = (event) => {
            if (event.key === 'Escape' && this.isModalOpen()) {
                this.closeModalForSession();
            }
        };

        this.addHandler(window, 'beforeinstallprompt', onBeforeInstallPrompt);
        this.addHandler(window, 'appinstalled', onAppInstalled);
        this.addHandler(document, 'keydown', onEscape);
    },

    attachUIListeners() {
        if (!this._bannerEl || !this._modalEl) return;

        const bannerInstall = this._bannerEl.querySelector('[data-action="install"]');
        const bannerDismiss = this._bannerEl.querySelector('[data-action="dismiss"]');
        const bannerDetails = this._bannerEl.querySelector('[data-action="details"]');

        const modalInstall = this._modalEl.querySelector('[data-action="install"]');
        const modalLater = this._modalEl.querySelector('[data-action="later"]');

        const onBannerInstall = async () => {
            await this.requestInstall('banner');
        };
        const onBannerDismiss = () => {
            this.dismissInstallPrompt();
        };
        const onBannerDetails = () => {
            this.openModal();
        };
        const onModalInstall = async () => {
            await this.requestInstall('modal');
        };
        const onModalLater = () => {
            this.closeModalForSession();
        };
        const onOverlayClick = (event) => {
            if (event.target === this._overlayEl) {
                this.closeModalForSession();
            }
        };

        this.addHandler(bannerInstall, 'click', onBannerInstall);
        this.addHandler(bannerDismiss, 'click', onBannerDismiss);
        this.addHandler(bannerDetails, 'click', onBannerDetails);
        this.addHandler(modalInstall, 'click', onModalInstall);
        this.addHandler(modalLater, 'click', onModalLater);
        this.addHandler(this._overlayEl, 'click', onOverlayClick);
    },

    addHandler(target, type, handler, options) {
        if (!target) return;
        target.addEventListener(type, handler, options);
        this._handlers.push({ target, type, handler, options });
    },

    ensureUI() {
        let banner = document.getElementById('pwa-install-banner');
        if (!banner) {
            banner = document.createElement('aside');
            banner.id = 'pwa-install-banner';
            banner.setAttribute('aria-live', 'polite');
            banner.innerHTML = `
                <div class="pwa-banner-content">
                    <div class="pwa-banner-title">Install Ephemera</div>
                    <div class="pwa-banner-subtitle">Fast launch, offline mode, and app-like feel.</div>
                </div>
                <div class="pwa-banner-actions">
                    <button class="btn btn-sm" type="button" data-action="details">Why install?</button>
                    <button class="btn btn-sm primary" type="button" data-action="install">Install</button>
                    <button class="btn btn-sm" type="button" data-action="dismiss" aria-label="Dismiss install prompt">Later</button>
                </div>
            `;
            document.body.appendChild(banner);
        }

        let overlay = document.getElementById('pwa-install-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pwa-install-overlay';
            overlay.innerHTML = `
                <section id="pwa-install-modal" role="dialog" aria-modal="true" aria-label="Install Ephemera">
                    <header class="pwa-modal-header">
                        <h2>Install Ephemera</h2>
                        <p>Get a native-feeling desktop experience.</p>
                    </header>
                    <div class="pwa-modal-features">
                        <div class="pwa-feature-card">
                            <strong>Instant Launch</strong>
                            <span>Open directly from your home screen or app launcher.</span>
                        </div>
                        <div class="pwa-feature-card">
                            <strong>Offline Access</strong>
                            <span>Keep working even when the network is unstable.</span>
                        </div>
                        <div class="pwa-feature-card">
                            <strong>Dedicated Window</strong>
                            <span>No browser chrome, just your workspace.</span>
                        </div>
                    </div>
                    <footer class="pwa-modal-actions">
                        <button class="btn" type="button" data-action="later">Maybe Later</button>
                        <button class="btn primary" type="button" data-action="install">Install Ephemera</button>
                    </footer>
                </section>
            `;
            document.body.appendChild(overlay);
        }

        this._bannerEl = banner;
        this._overlayEl = overlay;
        this._modalEl = document.getElementById('pwa-install-modal');
    },

    incrementVisitCount() {
        const existing = parseInt(localStorage.getItem(this.VISIT_COUNT_KEY) || '0', 10);
        const next = Number.isFinite(existing) ? existing + 1 : 1;
        localStorage.setItem(this.VISIT_COUNT_KEY, String(next));
        return next;
    },

    isStandalone() {
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
        if (window.navigator?.standalone === true) return true;
        if (document.referrer && document.referrer.startsWith('android-app://')) return true;
        return false;
    },

    isInstalled() {
        if (this.isStandalone()) return true;
        return localStorage.getItem(this.INSTALLED_KEY) === '1';
    },

    isDismissed() {
        return localStorage.getItem(this.INSTALL_DISMISSED_KEY) === '1';
    },

    shouldAutoOpenModal() {
        const hasShownModal = localStorage.getItem(this.INSTALL_MODAL_SHOWN_KEY) === '1';
        return this._visitCount >= 2 && !hasShownModal && !this._sessionModalDismissed && !this.isDismissed();
    },

    hasInstallPrompt() {
        return !!this._deferredPromptEvent;
    },

    isInstallEligible() {
        return this.hasInstallPrompt() && !this.isInstalled() && !this.isStandalone();
    },

    syncUIState() {
        if (!this.isInstallEligible()) {
            this.hideBanner();
            this.hideModal();
            return;
        }

        if (this.shouldAutoOpenModal()) {
            localStorage.setItem(this.INSTALL_MODAL_SHOWN_KEY, '1');
            this.openModal();
            return;
        }

        if (!this.isModalOpen() && !this._sessionBannerDismissed && !this.isDismissed()) {
            this.showBanner();
        }
    },

    showBanner() {
        if (!this._bannerEl) return;
        this._bannerEl.classList.add('open');
    },

    hideBanner() {
        this._bannerEl?.classList.remove('open');
    },

    openModal() {
        if (!this._overlayEl) return;
        this.hideBanner();
        this._overlayEl.classList.add('open');
    },

    hideModal() {
        this._overlayEl?.classList.remove('open');
    },

    closeModalForSession() {
        this._sessionModalDismissed = true;
        this.hideModal();
        if (!this.isDismissed() && this.isInstallEligible()) {
            this.showBanner();
        }
    },

    isModalOpen() {
        return this._overlayEl?.classList.contains('open') ?? false;
    },

    dismissInstallPrompt() {
        this._sessionBannerDismissed = true;
        localStorage.setItem(this.INSTALL_DISMISSED_KEY, '1');
        this.hideBanner();
        this.hideModal();
    },

    async requestInstall(source = 'banner') {
        if (!this._deferredPromptEvent) return false;

        try {
            const promptEvent = this._deferredPromptEvent;
            await promptEvent.prompt();
            const outcome = await promptEvent.userChoice;

            if (outcome?.outcome === 'accepted') {
                this.markInstalled();
                this.hideBanner();
                this.hideModal();
                if (window.EphemeraTelemetry) {
                    EphemeraTelemetry.addBreadcrumb({
                        category: 'pwa',
                        message: `install accepted from ${source}`,
                        level: 'info'
                    });
                }
                return true;
            }

            if (window.EphemeraTelemetry) {
                EphemeraTelemetry.addBreadcrumb({
                    category: 'pwa',
                    message: `install dismissed from ${source}`,
                    level: 'info'
                });
            }
            return false;
        } catch (err) {
            console.warn('[EphemeraPWA] Install prompt failed:', err);
            return false;
        } finally {
            // Browser may invalidate the prompt event after use.
            this._deferredPromptEvent = null;
            this.syncUIState();
        }
    },

    markInstalled() {
        localStorage.setItem(this.INSTALLED_KEY, '1');
        localStorage.setItem(this.POST_INSTALL_SPLASH_KEY, '1');
        localStorage.removeItem(this.INSTALL_DISMISSED_KEY);
    },

    async maybeShowPostInstallSplash() {
        if (!this.isStandalone()) return;
        if (localStorage.getItem(this.POST_INSTALL_SPLASH_KEY) !== '1') return;

        const splash = document.createElement('div');
        splash.id = 'pwa-post-install-splash';
        splash.innerHTML = `
            <div class="pwa-splash-shell">
                <div class="pwa-splash-logo">Ephemera</div>
                <div class="pwa-splash-subtitle">Preparing your workspace</div>
                <div class="pwa-splash-loader"><span></span></div>
            </div>
        `;
        document.body.appendChild(splash);

        await new Promise(resolve => setTimeout(resolve, 1000));
        splash.classList.add('hide');
        await new Promise(resolve => setTimeout(resolve, 260));
        splash.remove();
        localStorage.removeItem(this.POST_INSTALL_SPLASH_KEY);
    }
};

window.EphemeraPWA = EphemeraPWA;
