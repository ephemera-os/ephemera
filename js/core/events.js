// @ts-check

/**
 * @callback EphemeraEventCallback
 * @param {unknown} data
 * @returns {void}
 */

const EphemeraEvents = {
    /** @type {Map<string, EphemeraEventCallback[]>} */
    listeners: new Map(),
    
    /**
     * @param {string} event
     * @param {EphemeraEventCallback} callback
     * @returns {() => void}
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.push(callback);
        }
        return () => this.off(event, callback);
    },
    
    /**
     * @param {string} event
     * @param {EphemeraEventCallback} callback
     * @returns {void}
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event);
        if (!callbacks) return;
        const index = callbacks.indexOf(callback);
        if (index > -1) callbacks.splice(index, 1);
    },
    
    /**
     * @param {string} event
     * @param {unknown} data
     * @returns {void}
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (!callbacks) return;
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error(`Event handler error for ${event}:`, e);
            }
        });
    },
    
    /**
     * @param {string} event
     * @param {EphemeraEventCallback} callback
     * @returns {void}
     */
    once(event, callback) {
        /** @type {EphemeraEventCallback} */
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
};

window.EphemeraEvents = EphemeraEvents;
