const EphemeraGestures = {
    TABLET_MIN_WIDTH: 768,
    TABLET_MAX_WIDTH: 1024,
    EDGE_THRESHOLD: 28,
    EDGE_SWIPE_DISTANCE: 88,
    LONG_PRESS_MS: 520,
    LONG_PRESS_MOVE_TOLERANCE: 12,
    PINCH_THRESHOLD: 0.06,
    _initialized: false,
    _cleanupFns: [],
    _windowGesture: null,
    _edgeSwipe: null,
    _longPress: null,
    _longPressTimer: null,

    init() {
        if (this._initialized) return;
        this._initialized = true;

        const windowsContainer = document.getElementById('windows-container');
        const desktop = document.getElementById('desktop');
        if (!windowsContainer || !desktop) return;

        const onWindowPointerDown = (e) => this.onWindowPointerDown(e);
        const onWindowPointerMove = (e) => this.onWindowPointerMove(e);
        const onWindowPointerUp = (e) => this.onWindowPointerUp(e);

        windowsContainer.addEventListener('pointerdown', onWindowPointerDown);
        windowsContainer.addEventListener('pointermove', onWindowPointerMove);
        windowsContainer.addEventListener('pointerup', onWindowPointerUp);
        windowsContainer.addEventListener('pointercancel', onWindowPointerUp);
        this._cleanupFns.push(() => windowsContainer.removeEventListener('pointerdown', onWindowPointerDown));
        this._cleanupFns.push(() => windowsContainer.removeEventListener('pointermove', onWindowPointerMove));
        this._cleanupFns.push(() => windowsContainer.removeEventListener('pointerup', onWindowPointerUp));
        this._cleanupFns.push(() => windowsContainer.removeEventListener('pointercancel', onWindowPointerUp));

        const onDocPointerDown = (e) => this.onDocumentPointerDown(e);
        const onDocPointerMove = (e) => this.onDocumentPointerMove(e);
        const onDocPointerUp = (e) => this.onDocumentPointerUp(e);

        document.addEventListener('pointerdown', onDocPointerDown, { passive: true });
        document.addEventListener('pointermove', onDocPointerMove, { passive: true });
        document.addEventListener('pointerup', onDocPointerUp, { passive: true });
        document.addEventListener('pointercancel', onDocPointerUp, { passive: true });
        this._cleanupFns.push(() => document.removeEventListener('pointerdown', onDocPointerDown));
        this._cleanupFns.push(() => document.removeEventListener('pointermove', onDocPointerMove));
        this._cleanupFns.push(() => document.removeEventListener('pointerup', onDocPointerUp));
        this._cleanupFns.push(() => document.removeEventListener('pointercancel', onDocPointerUp));

        const onDesktopPointerDown = (e) => this.onDesktopPointerDown(e);
        const onDesktopPointerMove = (e) => this.onDesktopPointerMove(e);
        const onDesktopPointerUp = (e) => this.onDesktopPointerUp(e);

        desktop.addEventListener('pointerdown', onDesktopPointerDown, { passive: true });
        desktop.addEventListener('pointermove', onDesktopPointerMove, { passive: true });
        desktop.addEventListener('pointerup', onDesktopPointerUp, { passive: true });
        desktop.addEventListener('pointercancel', onDesktopPointerUp, { passive: true });
        this._cleanupFns.push(() => desktop.removeEventListener('pointerdown', onDesktopPointerDown));
        this._cleanupFns.push(() => desktop.removeEventListener('pointermove', onDesktopPointerMove));
        this._cleanupFns.push(() => desktop.removeEventListener('pointerup', onDesktopPointerUp));
        this._cleanupFns.push(() => desktop.removeEventListener('pointercancel', onDesktopPointerUp));
    },

    destroy() {
        this._initialized = false;
        this.cancelLongPress();
        this._edgeSwipe = null;
        this._windowGesture = null;
        this._cleanupFns.forEach(fn => {
            try {
                fn();
            } catch (_e) {
                // Ignore cleanup failures.
            }
        });
        this._cleanupFns = [];
    },

    isTabletMode() {
        const width = window.innerWidth;
        const shellMode = EphemeraState?.shellMode || document.body?.dataset?.shellMode;
        if (shellMode !== 'desktop') return false;
        return width >= this.TABLET_MIN_WIDTH && width < this.TABLET_MAX_WIDTH;
    },

    supportsTouchGesture(event) {
        const pointerType = event.pointerType;
        if (!pointerType) return false;
        return pointerType === 'touch' || pointerType === 'pen';
    },

    onWindowPointerDown(event) {
        if (!this.isTabletMode() || !this.supportsTouchGesture(event)) return;

        const header = event.target.closest('.window-header');
        const windowEl = header?.closest('.window');
        if (!header || !windowEl) return;
        if (windowEl.classList.contains('maximized') || windowEl.classList.contains('minimized')) return;

        const windowId = this.getWindowId(windowEl);
        if (windowId === null) return;

        if (!this._windowGesture || this._windowGesture.windowId !== windowId) {
            this._windowGesture = {
                windowId,
                windowEl,
                pointers: new Map(),
                startRect: this.readWindowRect(windowEl),
                startMidpoint: null,
                startDistance: null
            };
        }

        this._windowGesture.pointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY
        });
        this.maybeInitializeWindowGesture();
    },

    onWindowPointerMove(event) {
        if (!this._windowGesture || !this.isTabletMode() || !this.supportsTouchGesture(event)) return;
        if (!this._windowGesture.pointers.has(event.pointerId)) return;

        this._windowGesture.pointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY
        });

        const points = [...this._windowGesture.pointers.values()];
        if (points.length < 2) return;

        const [p1, p2] = points;
        const distance = this.distance(p1, p2);
        const midpoint = this.midpoint(p1, p2);
        if (!this._windowGesture.startDistance || !this._windowGesture.startMidpoint) return;

        const startRect = this._windowGesture.startRect;
        const scale = distance / this._windowGesture.startDistance;
        const dx = midpoint.x - this._windowGesture.startMidpoint.x;
        const dy = midpoint.y - this._windowGesture.startMidpoint.y;

        if (Math.abs(scale - 1) > this.PINCH_THRESHOLD) {
            this.applyPinchResize(startRect, scale, dx, dy);
        } else {
            this.applyTwoFingerDrag(startRect, dx, dy);
        }
    },

    onWindowPointerUp(event) {
        if (!this._windowGesture) return;
        this._windowGesture.pointers.delete(event.pointerId);
        if (this._windowGesture.pointers.size < 2) {
            this._windowGesture = null;
        }
    },

    maybeInitializeWindowGesture() {
        if (!this._windowGesture) return;
        const points = [...this._windowGesture.pointers.values()];
        if (points.length < 2) return;

        const [p1, p2] = points;
        this._windowGesture.startRect = this.readWindowRect(this._windowGesture.windowEl);
        this._windowGesture.startMidpoint = this.midpoint(p1, p2);
        this._windowGesture.startDistance = Math.max(1, this.distance(p1, p2));
    },

    readWindowRect(windowEl) {
        const width = parseFloat(windowEl.style.width) || windowEl.offsetWidth || 600;
        const height = parseFloat(windowEl.style.height) || windowEl.offsetHeight || 400;
        const left = parseFloat(windowEl.style.left) || windowEl.offsetLeft || 0;
        const top = parseFloat(windowEl.style.top) || windowEl.offsetTop || 0;
        return { left, top, width, height };
    },

    applyPinchResize(startRect, scale, dx, dy) {
        const windowEl = this._windowGesture?.windowEl;
        if (!windowEl) return;

        const maxWidth = Math.max(320, window.innerWidth - 24);
        const maxHeight = Math.max(260, window.innerHeight - 80);
        const minWidth = 280;
        const minHeight = 220;

        const nextWidth = this.clamp(startRect.width * scale, minWidth, maxWidth);
        const nextHeight = this.clamp(startRect.height * scale, minHeight, maxHeight);
        const centeredLeft = startRect.left - (nextWidth - startRect.width) / 2 + dx;
        const centeredTop = startRect.top - (nextHeight - startRect.height) / 2 + dy;

        const left = this.clamp(centeredLeft, 0, Math.max(0, window.innerWidth - 110));
        const top = this.clamp(centeredTop, 0, Math.max(0, window.innerHeight - 130));

        windowEl.style.width = `${nextWidth}px`;
        windowEl.style.height = `${nextHeight}px`;
        windowEl.style.left = `${left}px`;
        windowEl.style.top = `${top}px`;
        windowEl.classList.remove('snapped-left', 'snapped-right', 'snapped-tl', 'snapped-tr', 'snapped-bl', 'snapped-br');
    },

    applyTwoFingerDrag(startRect, dx, dy) {
        const windowEl = this._windowGesture?.windowEl;
        if (!windowEl) return;

        const left = this.clamp(startRect.left + dx, 0, Math.max(0, window.innerWidth - 110));
        const top = this.clamp(startRect.top + dy, 0, Math.max(0, window.innerHeight - 130));

        windowEl.style.left = `${left}px`;
        windowEl.style.top = `${top}px`;
    },

    onDocumentPointerDown(event) {
        if (!this.isTabletMode() || !this.supportsTouchGesture(event)) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.window') || target?.closest('#context-menu')) return;

        const x = event.clientX;
        const y = event.clientY;
        if (x <= this.EDGE_THRESHOLD) {
            this._edgeSwipe = {
                edge: 'left',
                pointerId: event.pointerId,
                startX: x,
                startY: y,
                triggered: false
            };
        } else if (x >= window.innerWidth - this.EDGE_THRESHOLD) {
            this._edgeSwipe = {
                edge: 'right',
                pointerId: event.pointerId,
                startX: x,
                startY: y,
                triggered: false
            };
        }
    },

    onDocumentPointerMove(event) {
        if (!this._edgeSwipe || event.pointerId !== this._edgeSwipe.pointerId) return;

        const dx = event.clientX - this._edgeSwipe.startX;
        const dy = Math.abs(event.clientY - this._edgeSwipe.startY);
        if (dy > 64) {
            this._edgeSwipe = null;
            return;
        }

        if (!this._edgeSwipe.triggered && this._edgeSwipe.edge === 'left' && dx >= this.EDGE_SWIPE_DISTANCE) {
            this._edgeSwipe.triggered = true;
            this.switchWorkspaceBy(1);
        }
        if (!this._edgeSwipe.triggered && this._edgeSwipe.edge === 'right' && dx <= -this.EDGE_SWIPE_DISTANCE) {
            this._edgeSwipe.triggered = true;
            this.openAppDrawer();
        }
    },

    onDocumentPointerUp(event) {
        if (this._edgeSwipe && event.pointerId === this._edgeSwipe.pointerId) {
            this._edgeSwipe = null;
        }
    },

    switchWorkspaceBy(delta) {
        if (!window.EphemeraBoot || typeof EphemeraBoot.switchWorkspace !== 'function') return;

        const total = Array.isArray(EphemeraState?.workspaces) && EphemeraState.workspaces.length > 0
            ? EphemeraState.workspaces.length
            : 4;
        const current = Number(EphemeraState?.currentWorkspace || 0);
        const next = (current + delta + total) % total;
        EphemeraBoot.switchWorkspace(next);
    },

    openAppDrawer() {
        const startMenu = document.getElementById('start-menu');
        const startBtn = document.getElementById('start-btn');
        if (!startMenu || !startBtn) return;
        startMenu.classList.add('open');
        startBtn.setAttribute('aria-expanded', 'true');
    },

    onDesktopPointerDown(event) {
        if (!this.isTabletMode() || !this.supportsTouchGesture(event)) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.window') || target?.closest('#context-menu')) return;

        this.cancelLongPress();
        this._longPress = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            triggered: false
        };

        this._longPressTimer = setTimeout(() => {
            if (!this._longPress || this._longPress.triggered) return;
            this._longPress.triggered = true;
            this.showDesktopContextMenu(this._longPress.x, this._longPress.y);
        }, this.LONG_PRESS_MS);
    },

    onDesktopPointerMove(event) {
        if (!this._longPress || event.pointerId !== this._longPress.pointerId) return;
        if (this._longPress.triggered) return;

        const movedX = Math.abs(event.clientX - this._longPress.x);
        const movedY = Math.abs(event.clientY - this._longPress.y);
        if (movedX > this.LONG_PRESS_MOVE_TOLERANCE || movedY > this.LONG_PRESS_MOVE_TOLERANCE) {
            this.cancelLongPress();
        }
    },

    onDesktopPointerUp(event) {
        if (!this._longPress || event.pointerId !== this._longPress.pointerId) return;
        this.cancelLongPress();
    },

    cancelLongPress() {
        if (this._longPressTimer) {
            clearTimeout(this._longPressTimer);
            this._longPressTimer = null;
        }
        this._longPress = null;
    },

    showDesktopContextMenu(clientX, clientY) {
        const menu = document.getElementById('context-menu');
        if (!menu) return;

        menu.style.display = 'block';
        menu.style.left = '0px';
        menu.style.top = '0px';

        const rect = menu.getBoundingClientRect();
        const left = this.clamp(clientX, 8, Math.max(8, window.innerWidth - rect.width - 8));
        const top = this.clamp(clientY, 8, Math.max(8, window.innerHeight - rect.height - 8));
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;

        const firstItem = menu.querySelector('.context-item');
        if (firstItem) firstItem.focus();
    },

    getWindowId(windowEl) {
        if (!windowEl || !windowEl.id || !windowEl.id.startsWith('window-')) return null;
        const idValue = Number(windowEl.id.slice('window-'.length));
        return Number.isFinite(idValue) ? idValue : null;
    },

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    },

    midpoint(p1, p2) {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        };
    }
};

window.EphemeraGestures = EphemeraGestures;
