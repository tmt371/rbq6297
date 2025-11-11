// File: 04-core-code/ui/tabs/k3-tab/k3-tab-input-handler.js

import { EVENTS } from '../../../config/constants.js';

/**
 * @fileoverview A dedicated input handler for all user interactions
 * within the K3 (Options) tab.
 */
export class K3TabInputHandler {
    constructor({ eventAggregator }) {
        this.eventAggregator = eventAggregator;

        // [NEW] (v6298-fix-4) Store element references
        this.editButton = document.getElementById('btn-k3-edit');
        this.batchCycleButtons = [
            { id: 'btn-batch-cycle-over', column: 'over' },
            { id: 'btn-batch-cycle-oi', column: 'oi' },
            { id: 'btn-batch-cycle-lr', column: 'lr' }
        ];

        // [NEW] (v6298-fix-4) Store bound handlers
        this.boundHandlers = [];

        console.log("K3TabInputHandler Initialized.");
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
        console.log("K3TabInputHandler destroyed.");
    }


    initialize() {
        // [MODIFIED] (v6298-fix-4) Use helper
        this._addListener(this.editButton, 'click', this._onEditClick);

        this.batchCycleButtons.forEach(({ id, column }) => {
            const button = document.getElementById(id);
            if (button) {
                // Create a specific handler for each button
                const handler = () => {
                    this.eventAggregator.publish(EVENTS.USER_REQUESTED_BATCH_CYCLE, { column });
                };
                this._addListener(button, 'click', handler);
            }
        });
    }

    // [NEW] (v6298-fix-4) Extracted handlers
    _onEditClick() {
        this.eventAggregator.publish(EVENTS.USER_TOGGLED_K3_EDIT_MODE);
    }
}