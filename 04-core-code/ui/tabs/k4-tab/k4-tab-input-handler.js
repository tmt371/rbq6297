// File: 04-core-code/ui/tabs/k4-tab/k4-tab-input-handler.js

import { EVENTS } from '../../../config/constants.js';

/**
 * @fileoverview A dedicated input handler for all user interactions
 * within the K4 (Drive/Accessories) tab.
 */
export class K4TabInputHandler {
    constructor({ eventAggregator }) {
        this.eventAggregator = eventAggregator;

        // [NEW] (v6298-fix-4) Store bound handlers
        this.boundHandlers = [];

        console.log("K4TabInputHandler Initialized.");
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
        console.log("K4TabInputHandler destroyed.");
    }


    initialize() {
        // This logic was moved from LeftPanelInputHandler's _setupK5Inputs
        // [MODIFIED] Renamed function from setupK5... to setupK4...
        const setupK4ModeButton = (buttonId, mode) => {
            const button = document.getElementById(buttonId);
            if (button) {
                // [REFACTOR] Removed special handling for the remote button.
                // It now fires a standard 'driveModeChanged' event, same as other accessory buttons.
                // [MODIFIED] (v6298-fix-4) Use helper
                this._addListener(button, 'click', () => {
                    this.eventAggregator.publish(EVENTS.DRIVE_MODE_CHANGED, { mode });
                });
            }
        };
        // [MODIFIED] Corrected all IDs from 'btn-k5-' to 'btn-k4-'
        setupK4ModeButton('btn-k4-winder', 'winder');
        setupK4ModeButton('btn-k4-motor', 'motor');
        setupK4ModeButton('btn-k4-remote', 'remote');
        setupK4ModeButton('btn-k4-charger', 'charger');
        setupK4ModeButton('btn-k4-3m-cord', 'cord');

        // [MODIFIED] Renamed function from setupK5... to setupK4...
        const setupK4CounterButton = (buttonId, accessory, direction) => {
            const button = document.getElementById(buttonId);
            if (button) {
                // [MODIFIED] (v6298-fix-4) Use helper
                this._addListener(button, 'click', () => {
                    this.eventAggregator.publish(EVENTS.ACCESSORY_COUNTER_CHANGED, { accessory, direction });
                });
            }
        };
        // [MODIFIED] Corrected all IDs from 'btn-k5-' to 'btn-k4-'
        setupK4CounterButton('btn-k4-remote-add', 'remote', 'add');
        setupK4CounterButton('btn-k4-remote-subtract', 'remote', 'subtract');
        setupK4CounterButton('btn-k4-charger-add', 'charger', 'add');
        setupK4CounterButton('btn-k4-charger-subtract', 'charger', 'subtract');
        setupK4CounterButton('btn-k4-cord-add', 'cord', 'add');
        setupK4CounterButton('btn-k4-cord-subtract', 'cord', 'subtract');
    }
}