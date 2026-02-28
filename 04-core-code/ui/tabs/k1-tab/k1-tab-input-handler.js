// File: 04-core-code/ui/tabs/k1-tab/k1-tab-input-handler.js
// [MODIFIED] (Phase 3.5a) Merged K2 Fabric event handlers into K1

import { EVENTS, DOM_IDS } from '../../../config/constants.js';
import { LOGIC_CODES } from '../../../config/business-constants.js';

/**
 * @fileoverview A dedicated input handler for all user interactions
 * within the K1 (Location + Fabric) tab.
 */
export class K1TabInputHandler {
    constructor({ eventAggregator }) {
        this.eventAggregator = eventAggregator;
        this.appController = null; // Injected by AppContext after appController is created

        // --- K1 Location elements ---
        this.locationButton = document.getElementById('btn-focus-location');
        this.locationInput = document.getElementById(DOM_IDS.LOCATION_INPUT_BOX);

        // --- K2 Fabric elements (migrated) ---
        this.fabricButton = document.getElementById('btn-focus-fabric');
        this.lfButton = document.getElementById('btn-light-filter');
        this.lfDelButton = document.getElementById('btn-lf-del');
        this.sSetButton = document.getElementById('btn-k2-sset');

        this.boundHandlers = [];

        console.log("K1TabInputHandler Initialized (Location + Fabric).");
    }

    _addListener(element, event, handler) {
        if (!element) return;
        const boundHandler = handler.bind(this);
        this.boundHandlers.push({ element, event, handler: boundHandler });
        element.addEventListener(event, boundHandler);
    }

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
        // --- K1 Location events ---
        this._addListener(this.locationButton, 'click', (e) => this._onLocationButtonClick(e));
        this._addListener(this.locationInput, 'keydown', (e) => this._onLocationInputKeydown(e));

        // --- K2 Fabric events (migrated) ---
        this._addListener(this.fabricButton, 'click', (e) => this._onFabricClick(e));
        this._addListener(this.lfButton, 'click', (e) => this._onLFClick(e));
        this._addListener(this.lfDelButton, 'click', (e) => this._onLFDClick(e));
        this._addListener(this.sSetButton, 'click', (e) => this._onSSetClick(e));
    }

    // --- K1 Location handlers ---
    _onLocationButtonClick() {
        this.eventAggregator.publish(EVENTS.USER_REQUESTED_FOCUS_MODE, { column: 'location' });
    }

    async _onLocationInputKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const value = event.target.value;
            await this.appController.executeWithStateLock(async () => {
                await this.eventAggregator.publish(EVENTS.LOCATION_INPUT_ENTER_PRESSED, {
                    value
                });
            });
        }
    }

    // --- K2 Fabric handlers (migrated) ---
    _onFabricClick() {
        this.eventAggregator.publish(EVENTS.USER_REQUESTED_NC_DIALOG);
    }

    _onLFClick() {
        this.eventAggregator.publish(EVENTS.USER_TOGGLED_K2_MODE, { mode: LOGIC_CODES.MODE_LF });
    }

    _onLFDClick() {
        this.eventAggregator.publish(EVENTS.USER_TOGGLED_K2_MODE, { mode: LOGIC_CODES.MODE_LF_DEL });
    }

    _onSSetClick() {
        this.eventAggregator.publish(EVENTS.USER_TOGGLED_K2_MODE, { mode: LOGIC_CODES.MODE_SSET });
    }
}