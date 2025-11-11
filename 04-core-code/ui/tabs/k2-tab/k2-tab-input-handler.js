// File: 04-core-code/ui/tabs/k2-tab/k2-tab-input-handler.js

import { EVENTS, DOM_IDS } from '../../../config/constants.js';

/**
 * @fileoverview A dedicated input handler for all user interactions
 * within the K2 (Fabric) tab.
 */
export class K2TabInputHandler {
    constructor({ eventAggregator }) {
        this.eventAggregator = eventAggregator;

        // [NEW] (v6298-fix-4) Store element references
        this.fabricButton = document.getElementById('btn-focus-fabric');
        this.lfButton = document.getElementById('btn-light-filter');
        this.lfDelButton = document.getElementById('btn-lf-del');
        this.sSetButton = document.getElementById('btn-k2-sset');

        // [NEW] (v6298-fix-4) Store bound handlers
        this.boundHandlers = [];

        console.log("K2TabInputHandler Initialized.");
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
        console.log("K2TabInputHandler destroyed.");
    }

    initialize() {
        // [MODIFIED] (v6298-fix-4) Use helper
        this._addListener(this.fabricButton, 'click', this._onFabricClick);
        this._addListener(this.lfButton, 'click', this._onLFFClick);
        this._addListener(this.lfDelButton, 'click', this._onLFDClick);
        this._addListener(this.sSetButton, 'click', this._onSSetClick);

        // [REMOVED] (Phase 3 Cleanup) Obsolete listeners for the deleted table
    }

    // [NEW] (v6298-fix-4) Extracted handlers
    _onFabricClick() {
        this.eventAggregator.publish(EVENTS.USER_REQUESTED_NC_DIALOG);
    }

    _onLFFClick() {
        this.eventAggregator.publish(EVENTS.USER_TOGGLED_K2_MODE, { mode: 'LF' });
    }

    _onLFDClick() {
        this.eventAggregator.publish(EVENTS.USER_TOGGLED_K2_MODE, { mode: 'LFD' });
    }

    _onSSetClick() {
        this.eventAggregator.publish(EVENTS.USER_TOGGLED_K2_MODE, { mode: 'SSet' });
    }
}