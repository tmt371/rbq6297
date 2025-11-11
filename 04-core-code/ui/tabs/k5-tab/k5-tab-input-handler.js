// File: 04-core-code/ui/tabs/k5-tab/k5-tab-input-handler.js

import { EVENTS } from '../../../config/constants.js';

/**
 * @fileoverview A dedicated input handler for all user interactions
 * within the K5 (Dual/Chain & Summary) tab.
 */
export class K5TabInputHandler {
    constructor({ eventAggregator }) {
        this.eventAggregator = eventAggregator;

        // [NEW] (v6298-fix-4) Store element references
        this.k5DualButton = document.getElementById('btn-k5-dual');
        this.k5ChainButton = document.getElementById('btn-k5-chain');
        this.k5Input = document.getElementById('k5-input-display');

        // [NEW] (v6298-fix-4) Store bound handlers
        this.boundHandlers = [];

        console.log("K5TabInputHandler Initialized.");
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
        console.log("K5TabInputHandler destroyed.");
    }


    initialize() {
        // This logic was moved from LeftPanelInputHandler's _setupK4Inputs
        // [MODIFIED] Renamed function from setupK4... to setupK5...
        const setupK5Button = (buttonId, mode) => {
            const button = document.getElementById(buttonId);
            if (button) {
                // [MODIFIED] (v6298-fix-4) Use helper
                this._addListener(button, 'click', () => {
                    this.eventAggregator.publish(EVENTS.DUAL_CHAIN_MODE_CHANGED, { mode });
                });
            }
        };
        // [MODIFIED] Corrected IDs from 'btn-k4-' to 'btn-k5-'
        setupK5Button('btn-k5-dual', 'dual');
        setupK5Button('btn-k5-chain', 'chain');

        // [MODIFIED] (v6298-fix-4) Use helper
        this._addListener(this.k5Input, 'keydown', this._onK5InputKeydown);
    }

    _onK5InputKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.eventAggregator.publish(EVENTS.CHAIN_ENTER_PRESSED, {
                value: event.target.value
            });
        }
    }
}