/* FILE: 04-core-code/ui/tabs/k2-tab/k2-tab-component.js */
// [MODIFIED] (Stage 9 Phase 3 - Constants) Replaced magic strings with LOGIC_CODES to fix button state bug.

import { LOGIC_CODES } from '../../../config/business-constants.js'; // [NEW]

/**
 * @fileoverview [NEW] A dedicated component for managing and rendering the K2 (Fabric) tab UI,
 * specifically the active/disabled states of its buttons.
 */
export class K2TabComponent {
    constructor() {
        // Cache all DOM elements for K2 in the constructor.
        this.ncButton = document.getElementById('btn-focus-fabric');
        this.lfButton = document.getElementById('btn-light-filter');
        this.lfdButton = document.getElementById('btn-lf-del');
        this.ssetButton = document.getElementById('btn-k2-sset');

        console.log("K2TabComponent Initialized.");
    }

    render(uiState) {
        if (!this.ncButton) return; // Guard clause if elements aren't ready

        const { activeEditMode } = uiState;

        // [MODIFIED] Use constants for mode checks
        const isLFMode = activeEditMode === LOGIC_CODES.MODE_LF;
        const isLFDMode = activeEditMode === LOGIC_CODES.MODE_LF_DEL;
        const isSSetMode = activeEditMode === LOGIC_CODES.MODE_SSET;

        // Is *any* K2 mode active?
        const isK2ModeActive = isLFMode || isLFDMode || isSSetMode;

        // Is *another* panel mode active (like K1, K3, K4, K5)?
        // If activeEditMode is not null AND it's not one of our K2 modes, it must be another panel.
        const isOtherPanelModeActive = activeEditMode !== null && !isK2ModeActive;

        // Handle LF Button (New Active State)
        this.lfButton.classList.toggle('active', isLFMode);
        // Disabled if: Another K2 mode is active OR Another Panel mode is active
        this.lfButton.disabled = (isK2ModeActive && !isLFMode) || isOtherPanelModeActive;

        // Handle LFD Button (Existing Active State)
        this.lfdButton.classList.toggle('active', isLFDMode);
        this.lfdButton.disabled = (isK2ModeActive && !isLFDMode) || isOtherPanelModeActive;

        // Handle SSet Button (New Active State) [NEW] (v6294 SSet)
        this.ssetButton.classList.toggle('active', isSSetMode);
        this.ssetButton.disabled = (isK2ModeActive && !isSSetMode) || isOtherPanelModeActive;

        // Handle N&C Button (Disabled only)
        this.ncButton.disabled = isK2ModeActive || isOtherPanelModeActive;
    }
}