// File: 04-core-code/services/state-service.js

import { EVENTS } from '../config/constants.js';
import { createRootReducer } from '../reducers/root-reducer.js';

/**
 * @fileoverview Service for managing the entire application state.
 * Acts as the single source of truth.
 * State should be read from here, and all updates must be dispatched through this service.
 */
export class StateService {
    /**
     * @param {object} dependencies - The service dependencies.
     */
    constructor({ initialState, eventAggregator, productFactory, configManager }) {
        this._state = initialState;
        this.eventAggregator = eventAggregator;
        this.reducer = createRootReducer({ productFactory, configManager });
        
        // [NEW] (Phase E) Optimization members
        this._lastState = null;
        this._cachedClone = null;
        this._renderDebounceTimer = null;

        console.log("StateService (Performance Refactored) Initialized.");
    }

    /**
     * Returns a deep clone of the current state.
     * [MODIFIED] (Phase E) Uses state-clone caching to reduce structuredClone overhead.
     * @returns {object} A deep clone of the current application state.
     */
    getState() {
        // [NEW] Caching optimization: return same clone if state reference hasn't changed
        if (this._state === this._lastState && this._cachedClone) {
            return this._cachedClone;
        }

        this._lastState = this._state;
        this._cachedClone = structuredClone(this._state);
        return this._cachedClone;
    }

    /**
     * Dispatches an action to the reducer to update the state.
     * [MODIFIED] (Phase E) Implements debounced publication (16ms frame-batching).
     * @param {object} action The action object describing the state change.
     */
    async dispatch(action) {
        const newState = this.reducer(this._state, action);

        // Only update if the state reference has actually changed (Reducer Pattern)
        if (newState !== this._state) {
            this._state = newState;
            this._schedulePublish();
        }
    }

    /**
     * [NEW] Phase E: Micro-task batching for re-renders.
     * Prevents INTERNAL_STATE_UPDATED from firing 10 times in one frame during rapid entry.
     */
    _schedulePublish() {
        if (this._renderDebounceTimer) return;

        // requestAnimationFrame naturally batches updates to the monitor's refresh rate (~16.6ms)
        this._renderDebounceTimer = requestAnimationFrame(async () => {
            this._renderDebounceTimer = null;
            await this.eventAggregator.publish(EVENTS.INTERNAL_STATE_UPDATED, this._state);
        });
    }
}