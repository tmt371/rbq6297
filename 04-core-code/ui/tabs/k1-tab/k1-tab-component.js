// File: 04-core-code/ui/tabs/k1-tab/k1-tab-component.js
// [MODIFIED] (Phase 3.5a) Merged K2 Fabric render logic into K1

import { DOM_IDS } from '../../../config/constants.js';
import { LOGIC_CODES } from '../../../config/business-constants.js';

/**
 * @fileoverview A dedicated component for managing and rendering the K1 (Location + Fabric) tab UI.
 */
export class K1TabComponent {
    constructor() {
        // --- K1 Location elements ---
        this.locationButton = document.getElementById('btn-focus-location');
        this.locationInput = document.getElementById(DOM_IDS.LOCATION_INPUT_BOX);

        // --- K2 Fabric elements (migrated from K2TabComponent) ---
        this.ncButton = document.getElementById('btn-focus-fabric');
        this.lfButton = document.getElementById('btn-light-filter');
        this.lfdButton = document.getElementById('btn-lf-del');
        this.ssetButton = document.getElementById('btn-k2-sset');

        console.log("K1TabComponent Initialized (Location + Fabric).");
    }

    render(uiState) {
        const { activeEditMode, locationInputValue, driveAccessoryMode, dualChainMode } = uiState;

        // --- K1 Location Input State ---
        if (this.locationInput) {
            const isLocationActive = activeEditMode === 'K1';
            this.locationInput.disabled = !isLocationActive;
            this.locationInput.classList.toggle('active', isLocationActive);
            if (this.locationInput.value !== locationInputValue) {
                this.locationInput.value = locationInputValue;
            }
        }

        if (this.locationButton) {
            this.locationButton.classList.toggle('active', activeEditMode === 'K1');
            const isAnyOtherFlowActive = (activeEditMode !== null && activeEditMode !== 'K1') || driveAccessoryMode !== null || dualChainMode !== null;
            this.locationButton.disabled = isAnyOtherFlowActive;
        }

        // --- K2 Fabric Button States (migrated from K2TabComponent) ---
        if (!this.ncButton) return;

        const isLFMode = activeEditMode === LOGIC_CODES.MODE_LF;
        const isLFDMode = activeEditMode === LOGIC_CODES.MODE_LF_DEL;
        const isSSetMode = activeEditMode === LOGIC_CODES.MODE_SSET;

        const isK2ModeActive = isLFMode || isLFDMode || isSSetMode;
        const isOtherPanelModeActive = (activeEditMode !== null && !isK2ModeActive) || driveAccessoryMode !== null || dualChainMode !== null;

        // LF Button
        this.lfButton.classList.toggle('active', isLFMode);
        this.lfButton.disabled = (isK2ModeActive && !isLFMode) || isOtherPanelModeActive;

        // LFD Button
        this.lfdButton.classList.toggle('active', isLFDMode);
        this.lfdButton.disabled = (isK2ModeActive && !isLFDMode) || isOtherPanelModeActive;

        // SSet Button
        this.ssetButton.classList.toggle('active', isSSetMode);
        this.ssetButton.disabled = (isK2ModeActive && !isSSetMode) || isOtherPanelModeActive;

        // N&C Button
        this.ncButton.disabled = isK2ModeActive || isOtherPanelModeActive;
    }
}