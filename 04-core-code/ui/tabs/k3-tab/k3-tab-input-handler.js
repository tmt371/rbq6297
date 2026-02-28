// File: 04-core-code/ui/tabs/k3-tab/k3-tab-input-handler.js
// [MODIFIED] (Phase 3.4c) K3 UI: Batch button events + number input events

import { EVENTS } from '../../../config/constants.js';

/**
 * @fileoverview A dedicated input handler for all user interactions
 * within the K3 (Drive/Accessories) tab.
 */
export class K3TabInputHandler {
    constructor({ eventAggregator }) {
        this.eventAggregator = eventAggregator;
        this.boundHandlers = [];

        // [NEW] K5 element refs for handlers
        this.k5Input = document.getElementById('k5-input-display');

        console.log("K3TabInputHandler Initialized.");
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
        console.log("K3TabInputHandler destroyed.");
    }

    initialize() {
        // --- Mode buttons: only Winder and Motor ---
        const setupK3ModeButton = (buttonId, mode) => {
            const button = document.getElementById(buttonId);
            if (button) {
                this._addListener(button, 'click', () => {
                    this.eventAggregator.publish(EVENTS.DRIVE_MODE_CHANGED, { mode });
                });
            }
        };
        setupK3ModeButton('btn-k3-winder', 'winder');
        setupK3ModeButton('btn-k3-motor', 'motor');

        // --- Number input change events ---
        const setupK3NumberInput = (inputId, accessory) => {
            const input = document.getElementById(inputId);
            if (input) {
                this._addListener(input, 'change', () => {
                    const newValue = Math.max(0, parseInt(input.value, 10) || 0);
                    input.value = newValue;
                    this.eventAggregator.publish(EVENTS.ACCESSORY_COUNTER_CHANGED, {
                        accessory,
                        direction: 'set',
                        value: newValue
                    });
                });
            }
        };
        setupK3NumberInput('input-k3-remote', 'remote');
        setupK3NumberInput('input-k3-charger', 'charger');
        setupK3NumberInput('input-k3-3mcord', 'cord');

        // --- [NEW] (Phase 3.4c) Batch button events ---
        const batchTypes = ['winder', 'motor'];
        batchTypes.forEach(type => {
            const container = document.getElementById(`batch-${type}`);
            if (!container) return;

            const startBtn = container.querySelector('.batch-start');
            const confirmBtn = container.querySelector('.batch-confirm-btn');
            const cancelBtn = container.querySelector('.batch-cancel-btn');

            if (startBtn) {
                this._addListener(startBtn, 'click', () => {
                    this.eventAggregator.publish(EVENTS.K3_BATCH_START, { type });
                });
            }
            if (confirmBtn) {
                this._addListener(confirmBtn, 'click', () => {
                    this.eventAggregator.publish(EVENTS.K3_BATCH_CONFIRM, { type });
                });
            }
            if (cancelBtn) {
                this._addListener(cancelBtn, 'click', () => {
                    this.eventAggregator.publish(EVENTS.K3_BATCH_CANCEL, { type });
                });
            }
        });

        // --- [NEW] K5 (Hardware) button events ---
        const setupK5Button = (buttonId, mode) => {
            const button = document.getElementById(buttonId);
            if (button) {
                this._addListener(button, 'click', () => {
                    this.eventAggregator.publish(EVENTS.DUAL_CHAIN_MODE_CHANGED, { mode });
                });
            }
        };
        setupK5Button('btn-k5-dual', 'dual');
        setupK5Button('btn-k5-chain', 'chain');

        if (this.k5Input) {
            this._addListener(this.k5Input, 'keydown', this._onK5InputKeydown);
        }
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