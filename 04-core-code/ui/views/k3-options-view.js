/* FILE: 04-core-code/ui/views/k3-options-view.js */
// [MODIFIED] (Stage 9 Phase 3 - Constants) Replaced magic strings for Over/OI/LR sequences with MOUNT_TYPES.

import * as uiActions from '../../actions/ui-actions.js';
import * as quoteActions from '../../actions/quote-actions.js';
import { MOUNT_TYPES } from '../../config/business-constants.js'; // [NEW]

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the K3 (Options) tab.
 */
export class K3OptionsView {
    constructor({ stateService, publishStateChangeCallback }) {
        this.stateService = stateService;
        this.publish = publishStateChangeCallback;
        console.log("K3OptionsView Initialized.");
    }

    _getState() {
        return this.stateService.getState();
    }

    _getItems() {
        const { quoteData } = this._getState();
        return quoteData.products[quoteData.currentProduct].items;
    }

    /**
     * Toggles the K3 editing mode on or off.
     */
    handleToggleK3EditMode() {
        const { ui } = this._getState();
        const currentMode = ui.activeEditMode;
        const newMode = currentMode === 'K3' ? null : 'K3';
        this.stateService.dispatch(uiActions.setActiveEditMode(newMode));
    }

    /**
     * Handles batch cycling for a given property (over, oi, lr).
     * @param {object} data - The event data containing the column to cycle.
     */
    handleBatchCycle({ column }) {
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

        this.stateService.dispatch(quoteActions.batchUpdateProperty(column, nextValue));
    }

    /**
     * Handles clicks on individual table cells in the K3 columns.
     * @param {object} data - The event data { rowIndex, column }.
     */
    handleTableCellClick({ rowIndex, column }) {
        this.stateService.dispatch(uiActions.setActiveCell(rowIndex, column));
        this.stateService.dispatch(quoteActions.cycleK3Property(rowIndex, column));

        // Briefly highlight the cell by setting and then clearing the active cell state
        setTimeout(() => {
            this.stateService.dispatch(uiActions.setActiveCell(null, null));
        }, 150);
    }

    /**
     * This method is called by the main DetailConfigView when the K3 tab becomes active.
     */
    activate() {
        this.stateService.dispatch(uiActions.setVisibleColumns(['sequence', 'fabricTypeDisplay', 'location', 'over', 'oi', 'lr']));
    }
}