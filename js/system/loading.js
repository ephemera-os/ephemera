/**
 * EphemeraLoading - Standard loading indicators for async operations
 */

const EphemeraLoading = {
    // Minimum time before showing spinner (avoid flash for fast ops)
    MIN_DELAY: 300,

    /**
     * Create a spinner element
     * @param {string} size - 'sm', 'md', or 'lg'
     * @returns {HTMLElement}
     */
    createSpinner(size = 'md') {
        const spinner = document.createElement('div');
        spinner.className = `ephemera-spinner ephemera-spinner-${size}`;
        spinner.setAttribute('aria-label', 'Loading...');
        spinner.setAttribute('role', 'status');
        return spinner;
    },

    /**
     * Create a skeleton loader for content placeholders
     * @param {object} options - Skeleton options
     * @returns {string} HTML string
     */
    createSkeleton(options = {}) {
        const { lines = 3, lineHeight = 16, avatar = false, card = false } = options;

        let html = '<div class="ephemera-skeleton" aria-hidden="true">';

        if (avatar) {
            html += '<div class="ephemera-skeleton-avatar"></div>';
        }

        if (card) {
            html += '<div class="ephemera-skeleton-card"></div>';
        }

        for (let i = 0; i < lines; i++) {
            const width = i === lines - 1 ? '60%' : '100%';
            html += `<div class="ephemera-skeleton-line" style="height:${lineHeight}px;width:${width}"></div>`;
        }

        html += '</div>';
        return html;
    },

    /**
     * Show loading overlay on an element
     * @param {HTMLElement|string} target - Element or selector
     * @param {object} options - Options
     * @returns {function} Function to hide the overlay
     */
    showOverlay(target, options = {}) {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el) return () => {};

        const { message = 'Loading...', size = 'md' } = options;
        const position = getComputedStyle(el).position;

        if (position === 'static') {
            el.style.position = 'relative';
        }

        const overlay = document.createElement('div');
        overlay.className = 'ephemera-loading-overlay';
        overlay.innerHTML = `
            <div class="ephemera-loading-content">
                ${this.createSpinner(size).outerHTML}
                <span class="ephemera-loading-message">${message}</span>
            </div>
        `;

        el.appendChild(overlay);

        return () => {
            overlay.remove();
            if (position === 'static') {
                el.style.position = '';
            }
        };
    },

    /**
     * Wrap an async function with automatic loading state
     * @param {HTMLElement|string} target - Element to show loading on
     * @param {function} asyncFn - Async function to execute
     * @param {object} options - Options
     * @returns {Promise} Result of asyncFn
     */
    async withLoading(target, asyncFn, options = {}) {
        const { message = 'Loading...', minDelay = this.MIN_DELAY } = options;
        let hideLoading = null;
        let timeoutId = null;

        // Delay showing spinner to avoid flash for fast operations
        timeoutId = setTimeout(() => {
            hideLoading = this.showOverlay(target, { message });
        }, minDelay);

        try {
            const result = await asyncFn();
            return result;
        } finally {
            clearTimeout(timeoutId);
            if (hideLoading) {
                hideLoading();
            }
        }
    },

    /**
     * Create a button that shows loading state while async action runs
     * @param {HTMLElement} button - Button element
     * @param {function} asyncFn - Async function to execute on click
     */
    bindLoadingButton(button, asyncFn) {
        const originalContent = button.innerHTML;

        button.addEventListener('click', async () => {
            if (button.disabled) return;

            button.disabled = true;
            button.innerHTML = `${this.createSpinner('sm').outerHTML} Loading...`;

            try {
                await asyncFn();
            } finally {
                button.disabled = false;
                button.innerHTML = originalContent;
            }
        });
    },

    /**
     * Inject loading CSS styles into the document
     */
    injectStyles() {
        if (document.getElementById('ephemera-loading-styles')) return;

        const style = document.createElement('style');
        style.id = 'ephemera-loading-styles';
        style.textContent = `
            .ephemera-spinner {
                border: 2px solid var(--border, rgba(255,255,255,0.1));
                border-top-color: var(--accent, #00d4aa);
                border-radius: 50%;
                animation: ephemera-spin 0.8s linear infinite;
            }

            .ephemera-spinner-sm { width: 16px; height: 16px; border-width: 2px; }
            .ephemera-spinner-md { width: 24px; height: 24px; border-width: 3px; }
            .ephemera-spinner-lg { width: 40px; height: 40px; border-width: 4px; }

            @keyframes ephemera-spin {
                to { transform: rotate(360deg); }
            }

            .ephemera-skeleton {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .ephemera-skeleton-line,
            .ephemera-skeleton-avatar,
            .ephemera-skeleton-card {
                background: linear-gradient(
                    90deg,
                    var(--bg-tertiary, #1a1a25) 25%,
                    var(--bg-secondary, #12121a) 50%,
                    var(--bg-tertiary, #1a1a25) 75%
                );
                background-size: 200% 100%;
                animation: ephemera-shimmer 1.5s infinite;
                border-radius: var(--radius-sm, 6px);
            }

            .ephemera-skeleton-line { width: 100%; }
            .ephemera-skeleton-avatar { width: 40px; height: 40px; border-radius: 50%; }
            .ephemera-skeleton-card { height: 120px; }

            @keyframes ephemera-shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }

            .ephemera-loading-overlay {
                position: absolute;
                inset: 0;
                background: var(--glass, rgba(10, 10, 15, 0.85));
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100;
                border-radius: inherit;
            }

            .ephemera-loading-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
            }

            .ephemera-loading-message {
                color: var(--fg-secondary, #9898a8);
                font-size: 0.9rem;
            }
        `;
        document.head.appendChild(style);
    },

    init() {
        this.injectStyles();
    }
};

window.EphemeraLoading = EphemeraLoading;
export default EphemeraLoading;
