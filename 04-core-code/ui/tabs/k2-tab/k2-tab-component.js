// File: 04-core-code/ui/tabs/k2-tab/k2-tab-component.js

/**
 * @fileoverview A dedicated component for managing and rendering the K2 (Options) tab UI.
 */
export class K2TabComponent {
    constructor() {
        // Cache all DOM elements for K2 in the constructor.
        this.k2EditButton = document.getElementById('btn-k2-edit');
        this.k2OverButton = document.getElementById('btn-batch-cycle-over');
        this.k2OiButton = document.getElementById('btn-batch-cycle-oi');
        this.k2LrButton = document.getElementById('btn-batch-cycle-lr');
        
        console.log("K2TabComponent Initialized.");
    }

    render(uiState) {
        const { activeEditMode } = uiState;

        // --- K2 Button Active/Disabled States ---
        const isK2EditMode = activeEditMode === 'K2';
        if (this.k2EditButton) {
            this.k2EditButton.classList.toggle('active', isK2EditMode);
            this.k2EditButton.disabled = activeEditMode !== null && !isK2EditMode;
        }
        
        const k2SubButtonsDisabled = !isK2EditMode;
        if (this.k2OverButton) this.k2OverButton.disabled = k2SubButtonsDisabled;
        if (this.k2OiButton) this.k2OiButton.disabled = k2SubButtonsDisabled;
        if (this.k2LrButton) this.k2LrButton.disabled = k2SubButtonsDisabled;
    }
}