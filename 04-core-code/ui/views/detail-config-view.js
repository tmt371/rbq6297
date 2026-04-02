/* FILE: 04-core-code/ui/views/detail-config-view.js */
// [MODIFIED] (Stage 9 Phase 3 - Constants) Replaced magic strings with LOGIC_CODES to fix LF-DEL selection bug.

/**
 * @fileoverview A "Manager" view that delegates logic to specific sub-views for each tab.
 */

import * as uiActions from '../../actions/ui-actions.js';
import { EVENTS } from '../../config/constants.js';
import { LOGIC_CODES, FABRIC_CODES } from '../../config/business-constants.js'; // [NEW]

export class DetailConfigView {
    constructor({
        stateService,
        eventAggregator,
        // Sub-views are injected here
        k1LocationView,
        fabricConfigView,
        k2OptionsView,
        driveAccessoriesView
    }) {
        this.stateService = stateService;
        this.eventAggregator = eventAggregator;

        // Store instances of sub-views
        this.k1View = k1LocationView;
        this.fabricView = fabricConfigView;
        this.k2View = k2OptionsView;
        this.driveAccessoriesView = driveAccessoriesView;

        console.log("DetailConfigView Refactored as a Manager View.");
    }

    /**
     * [NEW] Phase 15.2: Safely destroy all managed sub-views to prevent memory leaks.
     */
    destroy() {
        if (this.k1View && typeof this.k1View.destroy === 'function') {
            this.k1View.destroy();
        }
        if (this.fabricView && typeof this.fabricView.destroy === 'function') {
            this.fabricView.destroy();
        }
        if (this.k2View && typeof this.k2View.destroy === 'function') {
            this.k2View.destroy();
        }
        if (this.driveAccessoriesView && typeof this.driveAccessoriesView.destroy === 'function') {
            this.driveAccessoriesView.destroy();
        }
    }

    activateTab(tabId) {
        this.stateService.dispatch({ type: 'ui/setActiveTab', payload: { tabId } });

        switch (tabId) {
            case 'k1-tab':
                this.k1View.activate();
                this.fabricView.activate(); // [MODIFIED] (Phase 3.5a/3.6b) K2 Fabric now lives in K1
                break;
            // [REMOVED] (Phase 3.5a) 'k2-tab' case removed — K2 merged into K1
            case 'k2-tab':
                this.k2View.activate();
                break;
            case 'k3-tab':
                this.driveAccessoriesView.activate();
                break;
            // [REMOVED] (Phase 3.5b) K5 merged into K3
            default:
                break;
        }
    }

    // --- Event Handlers that delegate to sub-views ---

    handleFocusModeRequest({ column }) {
        if (column === 'location') {
            this.k1View.handleFocusModeRequest();
            return;
        }
    }

    async handleLocationInputEnter({ value }) {
        await this.k1View.handleLocationInputEnter({ value });
    }

    async handleSequenceCellClick({ rowIndex }) {
        const state = this.stateService.getState();
        const { ui, quoteData } = state;
        const { activeEditMode } = ui;

        // [NEW] (Phase 16) Strict Per-Click Validation for Light-Filter Mode
        // Ensure every click is validated before highlighting or state mutation.
        if (activeEditMode === LOGIC_CODES.MODE_LF) {
            const items = quoteData.products[quoteData.currentProduct].items;
            const item = items[rowIndex];
            const eligibleFabricTypes = [FABRIC_CODES.B2, FABRIC_CODES.B3, FABRIC_CODES.B4];

            if (!item || !eligibleFabricTypes.includes(item.fabricType)) {
                await this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: "Invalid fabric. Only B2, B3, B4 can be selected for Light Filter.",
                    type: "error"
                });
                return; // HALT selection immediately
            }
        }

        // [MODIFIED] Use LOGIC_CODES constants to match the state set by K2FabricView
        // This fixes the bug where LF-DEL mode ('LFD') was not recognized.
        if (activeEditMode === LOGIC_CODES.MODE_LF_DEL ||
            activeEditMode === LOGIC_CODES.MODE_LF ||
            activeEditMode === LOGIC_CODES.MODE_SSET) {

            await this.fabricView.handleSequenceCellClick({ rowIndex });
        } else {
            // [NEW] DEFAULT BEHAVIOR (for new LF/SSet flows):
            // Use the main multi-select action (pink highlight)
            // This allows the user to select rows *before* clicking the LF button.
            await this.stateService.dispatch(uiActions.toggleMultiSelectSelection(rowIndex));
        }
    }

    // [NEW] (v6294) Handle the new K2 mode toggle event
    async handleModeToggle({ mode }) {
        await this.fabricView.handleModeToggle({ mode });
    }

    async handleToggleK2EditMode() {
        await this.k2View.handleToggleK2EditMode();
    }

    async handleBatchCycle({ column }) {
        await this.k2View.handleBatchCycle({ column });
    }

    // [MODIFIED] (Phase 3 Patch) 加上 async/await 修補 Promise 鏈結斷層
    async handleDualChainModeChange({ mode }) {
        await this.driveAccessoriesView.handleDualChainModeChange({ mode });
    }

    // [MODIFIED] (Phase 3 Patch) 加上 async/await 修補 Promise 鏈結斷層
    async handleChainEnterPressed({ value }) {
        await this.driveAccessoriesView.handleChainEnterPressed({ value });
    }

    // [MODIFIED] (Phase 3 Patch) 加上 async/await 修補 Promise 鏈結斷層
    async handleDriveModeChange({ mode }) {
        await this.driveAccessoriesView.handleModeChange({ mode });
    }

    // [MODIFIED] (Phase 3.4b) Pass full data object to preserve 'value' from number inputs
    async handleAccessoryCounterChange(data) {
        await this.driveAccessoriesView.handleCounterChange(data);
    }

    // [NEW] (Phase 3.4c) K3 Batch delegates
    async handleK3BatchStart(data) {
        await this.driveAccessoriesView.startBatchMode(data);
    }

    async handleK3BatchConfirm(data) {
        await this.driveAccessoriesView.confirmBatch(data);
    }

    async handleK3BatchCancel(data) {
        await this.driveAccessoriesView.cancelBatch(data);
    }

    async handleTableCellClick({ rowIndex, column }) {
        const { ui } = this.stateService.getState();
        const { activeEditMode, dualChainMode, driveAccessoryMode } = ui;

        // [MODIFIED] (Phase 3.4c) Also route when in activeBatchMode
        if (driveAccessoryMode || this.driveAccessoriesView.activeBatchMode) {
            await this.driveAccessoriesView.handleTableCellClick({ rowIndex, column });
            return;
        }

        if (activeEditMode === 'K1') {
            await this.k1View.handleTableCellClick({ rowIndex });
            return;
        }

        if (activeEditMode === 'K2') {
            await this.k2View.handleTableCellClick({ rowIndex, column });
            return;
        }

        if (dualChainMode) {
            await this.driveAccessoriesView.handleTableCellClick({ rowIndex, column });
            return;
        }
    }
}