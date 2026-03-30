// /04_CoreCode/EventAggregator.js

/**
 * EventAggregator (Pub-Sub Event Bus)
 * Central nervous system implementing the publish-subscribe pattern.
 */
export class EventAggregator {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Event name
     * @param {Function} callback - Callback function
     */
    subscribe(eventName, callback) {
        // [NEW] (Phase 3.3f) Block undefined/null subscriptions to prevent cross-talk
        if (!eventName) {
            console.error('[EventAggregator] ERROR: Blocked attempt to subscribe to undefined/null event!', callback);
            return { dispose: () => {} }; // [MODIFIED] Return disposable object
        }
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }

        // --- [NEW] (Event Safeguard) Prevent Duplicate Subscriptions ---
        const exists = this.events[eventName].find(cb => cb === callback);
        if (exists) {
            console.warn(`[EventAggregator] Prevented duplicate subscription to event: ${eventName}`);
            return { dispose: () => this.unsubscribe(eventName, callback) };
        }

        this.events[eventName].push(callback);

        // [NEW] (Phase 15.2) Return a disposable object for easy array-based teardown
        return { dispose: () => this.unsubscribe(eventName, callback) };
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName - Event name
     * @param {Function} callback - Previously registered callback
     */
    unsubscribe(eventName, callback) {
        if (!this.events[eventName]) {
            return;
        }

        this.events[eventName] = this.events[eventName].filter(
            (cb) => cb !== callback
        );
    }

    /**
     * Publish an event
     * @param {string} eventName - Event name
     * @param {*} data - Data to pass to subscribers
     * @returns {Promise<void>}
     */
    async publish(eventName, data) {
        // [NEW] (Phase 3.3f) Block undefined/null publishes to prevent cross-talk
        if (!eventName) {
            console.error('[EventAggregator] ERROR: Blocked attempt to publish undefined/null event!', data);
            return;
        }
        if (this.events[eventName]) {
            // [MODIFIED] (Phase 11.2b) Isolate subscriber execution — one failure must not break others.
            // Wrap each callback in try-catch so a single crash doesn't kill the pipeline.
            const results = this.events[eventName].map(callback => {
                try {
                    return Promise.resolve(callback(data));
                } catch (error) {
                    console.error(`[EventAggregator] Subscriber error on '${eventName}':`, error);
                    return Promise.resolve();
                }
            });
            await Promise.allSettled(results);
        }
    }
}