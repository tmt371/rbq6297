// File: 04-core-code/ui/tabs/k3-tab/k3-tab-component.js
// [MODIFIED] (Phase 3.4d) Strict mode isolation for Batch buttons

/**
 * @fileoverview A dedicated component for managing and rendering the K3 (Drive/Accessories) tab UI.
 */
export class K3TabComponent {
    constructor() {
        // Mode buttons
        this.k3WinderButton = document.getElementById('btn-k3-winder');
        this.k3MotorButton = document.getElementById('btn-k3-motor');
        this.k3RemoteButton = document.getElementById('btn-k3-remote');
        this.k3ChargerButton = document.getElementById('btn-k3-charger');
        this.k3CordButton = document.getElementById('btn-k3-3m-cord');

        // Price display rows
        this.k3WinderDisplay = document.getElementById('k3-display-winder');
        this.k3MotorDisplay = document.getElementById('k3-display-motor');
        this.k3RemoteDisplay = document.getElementById('k3-display-remote');
        this.k3ChargerDisplay = document.getElementById('k3-display-charger');
        this.k3CordDisplay = document.getElementById('k3-display-cord');

        // Number inputs
        this.k3RemoteInput = document.getElementById('input-k3-remote');
        this.k3ChargerInput = document.getElementById('input-k3-charger');
        this.k3CordInput = document.getElementById('input-k3-3mcord');

        // Batch containers + start buttons
        this.batchWinderContainer = document.getElementById('batch-winder');
        this.batchMotorContainer = document.getElementById('batch-motor');
        this.batchWinderStartBtn = this.batchWinderContainer?.querySelector('.batch-start');
        this.batchMotorStartBtn = this.batchMotorContainer?.querySelector('.batch-start');

        // [NEW] K5 Hardware elements merged into K3
        this.k5DualButton = document.getElementById('btn-k5-dual');
        this.k5ChainButton = document.getElementById('btn-k5-chain');
        this.k5InputDisplay = document.getElementById('k5-input-display');
        this.k5DualPriceValue = document.querySelector('#k5-dual-price-display .price-value');

        console.log("K3TabComponent Initialized.");
    }

    render(uiState, quoteData) {
        const {
            driveAccessoryMode, driveRemoteCount, driveChargerCount, driveCordCount,
            driveWinderTotalPrice, driveMotorTotalPrice, driveRemoteTotalPrice, driveChargerTotalPrice, driveCordTotalPrice,
            // [NEW] K5 state props
            dualChainMode, targetCell, dualChainInputValue
        } = uiState;

        const formatPrice = (price) => (typeof price === 'number') ? `$${price.toFixed(0)}` : '';
        const isAnyFlowActive = (driveAccessoryMode !== null) || (dualChainMode !== null);

        // --- K3 Mode Button States (only Winder and Motor) ---
        const k3ModeButtons = [
            { el: this.k3WinderButton, mode: 'winder' },
            { el: this.k3MotorButton, mode: 'motor' }
        ];

        k3ModeButtons.forEach(({ el, mode }) => {
            if (el) {
                const isActive = driveAccessoryMode === mode;
                el.classList.toggle('active', isActive);
                el.disabled = isAnyFlowActive && !isActive;
            }
        });

        // --- [NEW] (Phase 3.4d) Strict Batch Button Isolation ---
        // Winder Batch: ONLY enabled when driveAccessoryMode === 'winder'
        if (this.batchWinderStartBtn) {
            this.batchWinderStartBtn.disabled = driveAccessoryMode !== 'winder';
        }
        // Motor Batch: ONLY enabled when driveAccessoryMode === 'motor'
        if (this.batchMotorStartBtn) {
            this.batchMotorStartBtn.disabled = driveAccessoryMode !== 'motor';
        }

        // --- Price displays ---
        if (this.k3WinderDisplay) this.k3WinderDisplay.value = formatPrice(driveWinderTotalPrice);
        if (this.k3MotorDisplay) this.k3MotorDisplay.value = formatPrice(driveMotorTotalPrice);
        if (this.k3RemoteDisplay) this.k3RemoteDisplay.value = formatPrice(driveRemoteTotalPrice);
        if (this.k3ChargerDisplay) this.k3ChargerDisplay.value = formatPrice(driveChargerTotalPrice);
        if (this.k3CordDisplay) this.k3CordDisplay.value = formatPrice(driveCordTotalPrice);

        // --- Sync number inputs (only if not focused) ---
        if (this.k3RemoteInput && document.activeElement !== this.k3RemoteInput) {
            this.k3RemoteInput.value = driveRemoteCount ?? 0;
        }
        if (this.k3ChargerInput && document.activeElement !== this.k3ChargerInput) {
            this.k3ChargerInput.value = driveChargerCount ?? 0;
        }
        if (this.k3CordInput && document.activeElement !== this.k3CordInput) {
            this.k3CordInput.value = driveCordCount ?? 0;
        }

        // --- Global UI Lock: disable .pro-input when any flow is active ---
        if (this.k3RemoteInput) this.k3RemoteInput.disabled = isAnyFlowActive;
        if (this.k3ChargerInput) this.k3ChargerInput.disabled = isAnyFlowActive;
        if (this.k3CordInput) this.k3CordInput.disabled = isAnyFlowActive;

        // --- [NEW] K5 (Hardware & Summary) Rendering ---
        if (quoteData) {
            const currentProductKey = quoteData.currentProduct;
            const productData = quoteData.products[currentProductKey];
            const accessoriesSummary = productData.summary.accessories || {};

            if (this.k5DualButton) {
                this.k5DualButton.classList.toggle('active', dualChainMode === 'dual');
                this.k5DualButton.disabled = isAnyFlowActive && dualChainMode !== 'dual';
            }
            if (this.k5ChainButton) {
                this.k5ChainButton.classList.toggle('active', dualChainMode === 'chain');
                this.k5ChainButton.disabled = isAnyFlowActive && dualChainMode !== 'chain';
            }

            if (this.k5InputDisplay) {
                const isChainInputActive = dualChainMode === 'chain' && targetCell && targetCell.column === 'chain';
                this.k5InputDisplay.disabled = !isChainInputActive;
                this.k5InputDisplay.classList.toggle('active', isChainInputActive);
                if (this.k5InputDisplay.value !== dualChainInputValue) this.k5InputDisplay.value = dualChainInputValue;
            }
            if (this.k5DualPriceValue) {
                const dualPrice = accessoriesSummary.dualCostSum;
                const newText = (typeof dualPrice === 'number') ? `$${dualPrice.toFixed(0)}` : '';
                if (this.k5DualPriceValue.textContent !== newText) this.k5DualPriceValue.textContent = newText;
            }
        }
    }

    // Toggle batch UI between Start / Confirm+Cancel states
    setBatchUIState(type, isActive) {
        const container = type === 'winder' ? this.batchWinderContainer : this.batchMotorContainer;
        if (!container) return;

        const startBtn = container.querySelector('.batch-start');
        const confirmGroup = container.querySelector('.batch-confirm-group');

        if (startBtn) startBtn.style.display = isActive ? 'none' : '';
        if (confirmGroup) confirmGroup.style.display = isActive ? 'flex' : 'none';
    }
}