/* FILE: 04-core-code/ui/views/detail-config-view.js */
// [MODIFIED] (Stage 9 Phase 3 - Constants) Replaced magic strings with LOGIC_CODES to fix LF-DEL selection bug.

/**
 * @fileoverview A "Manager" view that delegates logic to specific sub-views for each tab.
 */

import * as uiActions from '../../actions/ui-actions.js';
import { EVENTS } from '../../config/constants.js';
import { LOGIC_CODES } from '../../config/business-constants.js'; // [NEW]

export class DetailConfigView {
    constructor({
        stateService,
        eventAggregator,
        // Sub-views are injected here
        k1LocationView,
        k2FabricView,
        k3OptionsView,
        driveAccessoriesView,
        dualChainView
    }) {
        this.stateService = stateService;
        this.eventAggregator = eventAggregator;

        // Store instances of sub-views
        this.k1View = k1LocationView;
        this.k2View = k2FabricView;
        this.k3View = k3OptionsView;
        this.driveAccessoriesView = driveAccessoriesView;
        this.dualChainView = dualChainView;

        console.log("DetailConfigView Refactored as a Manager View.");
    }

    activateTab(tabId) {
        this.stateService.dispatch({ type: 'ui/setActiveTab', payload: { tabId } });

        switch (tabId) {
            case 'k1-tab':
                this.k1View.activate();
                break;
            case 'k2-tab':
                this.k2View.activate();
                break;
            case 'k3-tab':
                this.k3View.activate();
                break;
            case 'k4-tab':
                this.driveAccessoriesView.activate();
                break;
            case 'k5-tab':
                this.dualChainView.activate();
                break;
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

    handleLocationInputEnter({ value }) {
        this.k1View.handleLocationInputEnter({ value });
    }

    handleSequenceCellClick({ rowIndex }) {
        const { ui } = this.stateService.getState();
        const { activeEditMode } = ui;

        // [MODIFIED] Use LOGIC_CODES constants to match the state set by K2FabricView
        // This fixes the bug where LF-DEL mode ('LFD') was not recognized.
        if (activeEditMode === LOGIC_CODES.MODE_LF_DEL ||
            activeEditMode === LOGIC_CODES.MODE_LF ||
            activeEditMode === LOGIC_CODES.MODE_SSET) {

            this.k2View.handleSequenceCellClick({ rowIndex });
        } else {
            // [NEW] DEFAULT BEHAVIOR (for new LF/SSet flows):
            // Use the main multi-select action (pink highlight)
            // This allows the user to select rows *before* clicking the LF button.
            this.stateService.dispatch(uiActions.toggleMultiSelectSelection(rowIndex));
        }
    }

    // [NEW] (v6294) Handle the new K2 mode toggle event
    handleModeToggle({ mode }) {
        this.k2View.handleModeToggle({ mode });
    }

    handleToggleK3EditMode() {
        this.k3View.handleToggleK3EditMode();
    }

    handleBatchCycle({ column }) {
        this.k3View.handleBatchCycle({ column });
    }

    handleDualChainModeChange({ mode }) {
        this.dualChainView.handleModeChange({ mode });
    }

    handleChainEnterPressed({ value }) {
        this.dualChainView.handleChainEnterPressed({ value });
    }

    handleDriveModeChange({ mode }) {
        this.driveAccessoriesView.handleModeChange({ mode });
    }

    handleAccessoryCounterChange({ accessory, direction }) {
        this.driveAccessoriesView.handleCounterChange({ accessory, direction });
    }

    handleTableCellClick({ rowIndex, column }) {
        const { ui } = this.stateService.getState();
        const { activeEditMode, dualChainMode, driveAccessoryMode } = ui;

        if (driveAccessoryMode) {
            this.driveAccessoriesView.handleTableCellClick({ rowIndex, column });
            return;
        }

        if (activeEditMode === 'K1') {
            this.k1View.handleTableCellClick({ rowIndex });
            return;
        }

        if (activeEditMode === 'K3') {
            this.k3View.handleTableCellClick({ rowIndex, column });
            return;
        }

        if (dualChainMode) {
            this.dualChainView.handleTableCellClick({ rowIndex, column });
            return;
        }
    }
}