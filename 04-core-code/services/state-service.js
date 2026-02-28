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
        // [MODIFIED] Pass dependencies to the createRootReducer function.
        this.reducer = createRootReducer({ productFactory, configManager });
        console.log("StateService Finalized and refactored for Reducer pattern.");
    }

    /**
     * Returns a deep clone of the current state.
     * [MODIFIED] (Phase 11.2a) Returns structuredClone to prevent direct mutation of the SSOT.
     * All state changes MUST go through dispatch().
     * @returns {object} A deep clone of the current application state.
     */
    getState() {
        return structuredClone(this._state);
    }

    /**
     * Dispatches an action to the reducer to update the state.
     * @param {object} action The action object describing the state change.
     */
    async dispatch(action) {
        const newState = this.reducer(this._state, action);

        // Only update and publish if the state has actually changed.
        if (newState !== this._state) {
            this._state = newState;
            await this.eventAggregator.publish(EVENTS.INTERNAL_STATE_UPDATED, this._state);
        }
    }
}