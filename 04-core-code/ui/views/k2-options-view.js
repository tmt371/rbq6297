/* FILE: 04-core-code/ui/views/k2-options-view.js */
// [MODIFIED] (Stage 9 Phase 3 - Constants) Replaced magic strings for Over/OI/LR sequences with MOUNT_TYPES.

import * as uiActions from '../../actions/ui-actions.js';
import * as quoteActions from '../../actions/quote-actions.js';
import { MOUNT_TYPES } from '../../config/business-constants.js'; // [NEW]
import { EVENTS } from '../../config/constants.js'; // [NEW]

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the K2 (Options) tab.
 */
export class K2OptionsView {
    constructor({ stateService, eventAggregator, publishStateChangeCallback }) {
        this.stateService = stateService;
        this.eventAggregator = eventAggregator;
        this.publish = publishStateChangeCallback;
        console.log("K2OptionsView Initialized.");
    }

    _getState() {
        return this.stateService.getState();
    }

    _getItems() {
        const { quoteData } = this._getState();
        return quoteData.products[quoteData.currentProduct].items;
    }

    /**
     * Toggles the K2 editing mode on or off.
     */
    async handleToggleK2EditMode() {
        const { ui } = this._getState();
        const currentMode = ui.activeEditMode;
        const newMode = currentMode === 'K2' ? null : 'K2';
        await this.stateService.dispatch(uiActions.setActiveEditMode(newMode));
    }

    /**
     * Handles batch cycling for a given property (over, oi, lr).
     * @param {object} data - The event data containing the column to cycle.
     */
    async handleBatchCycle({ column }) {
        const items = this._getItems();
        if (items.length === 0 || !items[0]) return;

        // [MODIFIED] Use constants for sequences
        const BATCH_CYCLE_SEQUENCES = {
            over: [MOUNT_TYPES.ROLL_OVER, MOUNT_TYPES.ROLL_UNDER], // ['O', '']
            oi: [MOUNT_TYPES.IN_RECESS, MOUNT_TYPES.FACE_FIX],    // ['IN', 'OUT']
            lr: [MOUNT_TYPES.CONTROL_LEFT, MOUNT_TYPES.CONTROL_RIGHT] // ['L', 'R']
        };
        const sequence = BATCH_CYCLE_SEQUENCES[column];
        if (!sequence) return;

        const firstItemValue = items[0][column] || '';
        const currentIndex = sequence.indexOf(firstItemValue);
        const nextIndex = (currentIndex === -1) ? 0 : (currentIndex + 1) % sequence.length;
        const nextValue = sequence[nextIndex];

        // --- [NEW] Snapshot & Undo Toast ---
        // 1. Store a deep copy snapshot before any changes
        const snapshot = JSON.parse(JSON.stringify(items));

        // 2. Perform the actual dispatch for the batch cycle update
        await this.stateService.dispatch(quoteActions.batchUpdateProperty(column, nextValue));

        // 3. Render the Toast with Undo capabilities
        if (this.eventAggregator) {
            const columnDisplayNames = {
                over: 'Roll Direction',
                oi: 'I/O',
                lr: 'L/R'
            };
            const colName = columnDisplayNames[column] || column;

            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: `Batch updated ${colName}.`,
                type: 'info',
                action: {
                    label: '[Undo]',
                    callback: () => {
                        this.stateService.dispatch(quoteActions.restoreK2Snapshot(snapshot));
                    }
                }
            });
        }
    }

    /**
     * Handles clicks on individual table cells in the K2 columns.
     * @param {object} data - The event data { rowIndex, column }.
     */
    async handleTableCellClick({ rowIndex, column }) {
        await this.stateService.dispatch(uiActions.setActiveCell(rowIndex, column));
        await this.stateService.dispatch(quoteActions.cycleK2Property(rowIndex, column));

        // Briefly highlight the cell by setting and then clearing the active cell state
        setTimeout(async () => {
            await this.stateService.dispatch(uiActions.setActiveCell(null, null));
        }, 150);
    }

    /**
     * This method is called by the main DetailConfigView when the K2 tab becomes active.
     */
    activate() {
        this.stateService.dispatch(uiActions.setVisibleColumns(['sequence', 'fabricTypeDisplay', 'location', 'over', 'oi', 'lr']));
    }
}