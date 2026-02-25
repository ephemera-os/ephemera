/**
 * App Lifecycle Helper
 *
 * Utility for managing event listeners, intervals, and subscriptions
 * that need cleanup when an app window is closed.
 *
 * Usage in app init():
 *   const lifecycle = createAppLifecycle();
 *   lifecycle.addListener(document, 'keydown', handler);
 *   lifecycle.addInterval(setInterval(callback, 1000));
 *   lifecycle.addSubscription(EphemeraEvents.on('event', handler));
 *   return { destroy: lifecycle.destroy };
 */

export function createAppLifecycle() {
    const listeners = [];
    const intervals = [];
    const subscriptions = [];

    return {
        /**
         * Track an event listener for automatic cleanup.
         * @param {EventTarget} target - The target (document, window, element)
         * @param {string} type - Event type
         * @param {Function} handler - Event handler
         * @param {Object} [options] - Event listener options
         * @returns {Function} The handler for manual removal if needed
         */
        addListener(target, type, handler, options) {
            target.addEventListener(type, handler, options);
            listeners.push({ target, type, handler, options });
            return handler;
        },

        /**
         * Track an interval for automatic cleanup.
         * @param {number} intervalId - The interval ID from setInterval
         * @returns {number} The interval ID
         */
        addInterval(intervalId) {
            intervals.push(intervalId);
            return intervalId;
        },

        /**
         * Track a timeout for automatic cleanup.
         * @param {number} timeoutId - The timeout ID from setTimeout
         * @returns {number} The timeout ID
         */
        addTimeout(timeoutId) {
            intervals.push(timeoutId);
            return timeoutId;
        },

        /**
         * Track an EphemeraEvents subscription for automatic cleanup.
         * @param {Function} unsubscribe - The unsubscribe function from EphemeraEvents.on()
         * @returns {Function} The unsubscribe function
         */
        addSubscription(unsubscribe) {
            if (typeof unsubscribe === 'function') {
                subscriptions.push(unsubscribe);
            }
            return unsubscribe;
        },

        /**
         * Remove a specific listener (before destroy is called).
         * Useful for one-time listeners.
         */
        removeListener(target, type, handler) {
            const idx = listeners.findIndex(l =>
                l.target === target && l.type === type && l.handler === handler
            );
            if (idx !== -1) {
                target.removeEventListener(type, handler, listeners[idx].options);
                listeners.splice(idx, 1);
            }
        },

        /**
         * Clear a specific interval (before destroy is called).
         */
        clearInterval(intervalId) {
            const idx = intervals.indexOf(intervalId);
            if (idx !== -1) {
                clearInterval(intervalId);
                intervals.splice(idx, 1);
            }
        },

        /**
         * Destroy all tracked resources.
         * Called automatically by EphemeraWM when window closes.
         */
        destroy() {
            // Clear intervals and timeouts
            intervals.forEach(id => {
                clearInterval(id);
                clearTimeout(id);
            });
            intervals.length = 0;

            // Remove event listeners
            listeners.forEach(({ target, type, handler, options }) => {
                target.removeEventListener(type, handler, options);
            });
            listeners.length = 0;

            // Unsubscribe from events
            subscriptions.forEach(unsub => {
                try {
                    unsub();
                } catch (e) {
                    console.warn('[AppLifecycle] Subscription cleanup failed:', e);
                }
            });
            subscriptions.length = 0;
        },

        /**
         * Get counts of tracked resources (for debugging).
         */
        getStats() {
            return {
                listeners: listeners.length,
                intervals: intervals.length,
                subscriptions: subscriptions.length
            };
        }
    };
}

// Also expose globally for non-module apps
window.createAppLifecycle = createAppLifecycle;
