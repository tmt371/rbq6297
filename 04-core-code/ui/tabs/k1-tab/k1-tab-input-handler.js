// File: 04-core-code/ui/tabs/k1-tab/k1-tab-input-handler.js

import { EVENTS, DOM_IDS } from '../../../config/constants.js';

/**
 * @fileoverview A dedicated input handler for all user interactions
 * within the K1 (Location) tab.
 */
export class K1TabInputHandler {
    constructor({ eventAggregator }) {
        this.eventAggregator = eventAggregator;

        // [NEW] (v6298-fix-4) Store element references
        this.locationButton = document.getElementById('btn-focus-location');
        this.locationInput = document.getElementById(DOM_IDS.LOCATION_INPUT_BOX);

        // [NEW] (v6298-fix-4) Store bound handlers
        this.boundHandlers = [];

        console.log("K1TabInputHandler Initialized.");
    }

    /**
     * [NEW] (v6298-fix-4) Helper to add and store listeners
     */
    _addListener(element, event, handler) {
        if (!element) return;
        const boundHandler = handler.bind(this);
        this.boundHandlers.push({ element, event, handler: boundHandler });
        element.addEventListener(event, boundHandler);
    }

    /**
     * [NEW] (v6298-fix-4) Destroys all event listeners
     */
    destroy() {
        this.boundHandlers.forEach(({ element, event, handler }) => {
            if (element) {
                element.removeEventListener(event, handler);
            }
        });
        this.boundHandlers = [];
        console.log("K1TabInputHandler destroyed.");
    }

    initialize() {
        // [MODIFIED] (v6298-fix-4) Use helper
        this._addListener(this.locationButton, 'click', this._onLocationButtonClick);
        this._addListener(this.locationInput, 'keydown', this._onLocationInputKeydown);
    }

    _onLocationButtonClick() {
        this.eventAggregator.publish(EVENTS.USER_REQUESTED_FOCUS_MODE, { column: 'location' });
    }

    _onLocationInputKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.eventAggregator.publish(EVENTS.LOCATION_INPUT_ENTER_PRESSED, {
                value: event.target.value
            });
        }
    }
}