/* FILE: 04-core-code/ui/views/f2-summary-view.js */
// [MODIFIED] (Tweak 1) Implemented forced ceiling rounding for f2-balance.
// [MODIFIED] (F1 Motor Split Fix) Render logic now recalculates motor price based on B/W split.

import { EVENTS } from '../../config/constants.js';
import * as uiActions from '../../actions/ui-actions.js';
import * as quoteActions from '../../actions/quote-actions.js';

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the F2 (Summary) tab.
 */
export class F2SummaryView {
    constructor({ panelElement, eventAggregator, stateService, calculationService }) {
        this.panelElement = panelElement;
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.calculationService = calculationService;

        // [MODIFIED] (v6295) Updated to new 7-step focus order (removed wifi)
        this.f2InputSequence = [
            // 'f2-b10-wifi-qty', // [REMOVED] (v6295)
            'f2-b13-delivery-qty',
            'f2-b14-install-qty',
            'f2-b15-removal-qty',
            'f2-b17-mul-times',
            'f2-b18-discount',
            'new-offer',
            'f2-deposit' // 'f2-balance' is readonly, so no focus
        ];

        // [NEW] (v6298-fix-5) Store bound handlers
        this.boundHandlers = [];

        this._cacheF2Elements();
        this._initializeF2Listeners();
        console.log("F2SummaryView Initialized.");
    }

    /**
     * [NEW] (v6298-fix-5) Helper to add and store listeners
     */
    _addListener(element, event, handler) {
        if (!element) return;
        const boundHandler = handler.bind(this);
        this.boundHandlers.push({ element, event, handler: boundHandler });
        element.addEventListener(event, boundHandler);
    }

    /**
     * [NEW] (v6298-fix-5) Destroys all event listeners
     */
    destroy() {
        this.boundHandlers.forEach(({ element, event, handler }) => {
            if (element) {
                element.removeEventListener(event, handler);
            }
        });
        this.boundHandlers = [];
        console.log("F2SummaryView destroyed.");
    }

    _cacheF2Elements() {
        const query = (id) => this.panelElement.querySelector(`#${id}`);
        this.f2 = {
            b2_winderPrice: query('f2-b2-winder-price'),
            b3_dualPrice: query('f2-b3-dual-price'),

            b4_acceSum: query('f2-b4-acce-sum'),
            b6_motorPrice: query('f2-b6-motor-price'),
            b7_remotePrice: query('f2-b7-remote-price'),
            b8_chargerPrice: query('f2-b8-charger-price'),
            b9_cordPrice: query('f2-b9-cord-price'),
            b10_wifiQty: query('f2-b10-wifi-qty'), // [MODIFIED] (v6295) This is now a div
            // c10_wifiSum: query('f2-c10-wifi-sum'), // [REMOVED] (v6295)
            b11_eAcceSum: query('f2-b11-e-acce-sum'),

            b13_deliveryQty: query('f2-b13-delivery-qty'),
            c13_deliveryFee: query('f2-c13-delivery-fee'),
            b14_installQty: query('f2-b14-install-qty'),
            c14_installFee: query('f2-c14-install-fee'),
            b15_removalQty: query('f2-b15-removal-qty'),
            c15_removalFee: query('f2-c15-removal-fee'),
            b16_surchargeFee: query('f2-b16-surcharge-fee'),

            a17_totalSum: query('f2-a17-total-sum'),
            b17_mulTimes: query('f2-b17-mul-times'),
            c17_1stRbPrice: query('f2-c17-1st-rb-price'),
            b18_discount: query('f2-b18-discount'),
            b19_disRbPrice: query('f2-b19-dis-rb-price'),
            b20_singleprofit: query('f2-b20-singleprofit'),
            f2_17_pre_sum: query('f2-17-pre-sum'), // [MODIFIED]
            b21_rbProfit: query('f2-b21-rb-profit'),

            b22_sumprice: query('f2-b22-sumprice'),
            // [REMOVED] b23_sumprofit: query('f2-b23-sumprofit'),
            new_offer: query('new-offer'), // [MODIFIED]
            label_gst: query('f2-label-gst'), // [NEW] (Phase 2)
            b24_gst: query('f2-b24-gst'),
            grand_total: query('grand-total'), // [MODIFIED]

            b25_netprofit: query('f2-b25-netprofit'),

            // [NEW] v6290 Deposit/Balance
            deposit: query('f2-deposit'),
            balance: query('f2-balance'),
        };
    }

    _initializeF2Listeners() {
        const setupF2InputListener = (inputElement) => {
            if (inputElement) {
                // [MODIFIED] (v6298-fix-5) Use helper
                this._addListener(inputElement, 'change', (event) => {
                    this.handleF2ValueChange({ id: event.target.id, value: event.target.value });
                });

                this._addListener(inputElement, 'keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        this.focusNextF2Input(event.target.id);
                    }
                });
            }
        };

        // [MODIFIED] (v6294) Use the new sequence array to apply listeners
        this.f2InputSequence.forEach(inputId => {
            const inputElement = this.f2[inputId.replace(/-/g, '_')] || document.getElementById(inputId);
            setupF2InputListener(inputElement);
        });

        const feeCells = [
            { el: this.f2.c13_deliveryFee, type: 'delivery' },
            { el: this.f2.c14_installFee, type: 'install' },
            { el: this.f2.c15_removalFee, type: 'removal' }
        ];
        feeCells.forEach(({ el, type }) => {
            if (el) {
                // [MODIFIED] (v6298-fix-5) Use helper
                this._addListener(el, 'click', () => {
                    this.handleToggleFeeExclusion({ feeType: type });
                });
            }
        });

        // [NEW] (Phase 2) Add listener for GST toggle
        if (this.f2.label_gst) {
            // [MODIFIED] (v6298-fix-5) Use helper
            this._addListener(this.f2.label_gst, 'click', this.handleToggleGstExclusion);
        }
    }

    render(state) {
        // [FIX] (Phase 13) Strengthen guard clause
        if (!this.f2 || !state || !state.ui.f2) return;

        const f2State = state.ui.f2;
        const productSummary = state.quoteData.products[state.quoteData.currentProduct]?.summary;
        const accessories = productSummary?.accessories || {};
        // [NEW] Need items for motor calculation
        const items = state.quoteData.products[state.quoteData.currentProduct]?.items || [];

        const formatIntegerCurrency = (value) => (typeof value === 'number') ? `$${value.toFixed(0)}` : '$';
        const formatDecimalCurrency = (value) => (typeof value === 'number') ? `$${value.toFixed(2)}` : '$';
        const formatValue = (value) => (value !== null && value !== undefined) ? value : '';

        const winderPrice = accessories.winderCostSum || 0;
        const dualPrice = accessories.dualCostSum || 0;

        // --- [MODIFIED] (F1 Motor Split Fix) Recalculate Motor Price ---
        // Don't rely on accessories.motorCostSum which K4 calculates blindly as $250/unit.
        const totalMotorQty = items.filter(item => !!item.motor).length;
        let wMotorQty = state.ui.f1.w_motor_qty || 0;
        // Clamp W
        if (wMotorQty > totalMotorQty) wMotorQty = totalMotorQty;
        const bMotorQty = totalMotorQty - wMotorQty;

        // Calculate: (B * 250) + (W * 200)
        const motorPrice = (bMotorQty * 250) + (wMotorQty * 200);
        // --- [END MODIFIED] ---

        const remotePrice = accessories.remoteCostSum || 0;
        const chargerPrice = accessories.chargerCostSum || 0;
        const cordPrice = accessories.cordCostSum || 0;

        // [MODIFIED] (v6298-fix-5) Add checks for element existence
        if (this.f2.b2_winderPrice) this.f2.b2_winderPrice.textContent = formatIntegerCurrency(winderPrice);
        if (this.f2.b3_dualPrice) this.f2.b3_dualPrice.textContent = formatIntegerCurrency(dualPrice);
        if (this.f2.b6_motorPrice) this.f2.b6_motorPrice.textContent = formatIntegerCurrency(motorPrice); // [FIX] Uses local calc
        if (this.f2.b7_remotePrice) this.f2.b7_remotePrice.textContent = formatIntegerCurrency(remotePrice);
        if (this.f2.b8_chargerPrice) this.f2.b8_chargerPrice.textContent = formatIntegerCurrency(chargerPrice);
        if (this.f2.b9_cordPrice) this.f2.b9_cordPrice.textContent = formatIntegerCurrency(cordPrice);

        // [MODIFIED] (v6295) Get Wifi Qty from F1 state and calculate price
        const wifiQty = state.ui.f1.wifi_qty || 0;
        const wifiSum = wifiQty * 300; // Use $300 sale price

        const deliveryFee = f2State.deliveryFee || 0;
        const installFee = f2State.installFee || 0;
        const removalFee = f2State.removalFee || 0;
        const acceSum = winderPrice + dualPrice;

        // [MODIFIED] Use the corrected motorPrice
        const eAcceSum = motorPrice + remotePrice + chargerPrice + cordPrice + wifiSum;

        const surchargeFee =
            (f2State.deliveryFeeExcluded ? 0 : deliveryFee) +
            (f2State.installFeeExcluded ? 0 : installFee) +
            (f2State.removalFeeExcluded ? 0 : removalFee);

        if (this.f2.b4_acceSum) this.f2.b4_acceSum.textContent = formatIntegerCurrency(acceSum);
        // [MODIFIED] (v6295) Render new wifiSum to the b10 div
        if (this.f2.b10_wifiQty) this.f2.b10_wifiQty.textContent = formatIntegerCurrency(wifiSum);
        if (this.f2.b11_eAcceSum) this.f2.b11_eAcceSum.textContent = formatIntegerCurrency(eAcceSum);
        if (this.f2.c13_deliveryFee) this.f2.c13_deliveryFee.textContent = formatIntegerCurrency(deliveryFee);
        if (this.f2.c14_installFee) this.f2.c14_installFee.textContent = formatIntegerCurrency(installFee);
        if (this.f2.c15_removalFee) this.f2.c15_removalFee.textContent = formatIntegerCurrency(removalFee);
        if (this.f2.b16_surchargeFee) this.f2.b16_surchargeFee.textContent = formatIntegerCurrency(surchargeFee);

        if (this.f2.a17_totalSum) this.f2.a17_totalSum.textContent = formatValue(f2State.totalSumForRbTime);
        if (this.f2.c17_1stRbPrice) this.f2.c17_1stRbPrice.textContent = formatDecimalCurrency(f2State.firstRbPrice);
        if (this.f2.b19_disRbPrice) this.f2.b19_disRbPrice.textContent = formatDecimalCurrency(f2State.disRbPrice);
        if (this.f2.b20_singleprofit) this.f2.b20_singleprofit.textContent = formatDecimalCurrency(f2State.singleprofit);
        if (this.f2.b21_rbProfit) this.f2.b21_rbProfit.textContent = formatDecimalCurrency(f2State.rbProfit);

        // [MODIFIED] (Phase 8) Use the correct state keys defined in initial-state.js
        if (this.f2.b22_sumprice) this.f2.b22_sumprice.textContent = formatDecimalCurrency(f2State.sumPrice);
        if (this.f2.f2_17_pre_sum) this.f2.f2_17_pre_sum.textContent = formatDecimalCurrency(f2State.f2_17_pre_sum);
        if (this.f2.b24_gst) this.f2.b24_gst.textContent = formatDecimalCurrency(f2State.gst);
        if (this.f2.grand_total) this.f2.grand_total.textContent = formatDecimalCurrency(f2State.grandTotal);
        if (this.f2.b25_netprofit) this.f2.b25_netprofit.textContent = formatDecimalCurrency(f2State.netProfit);

        // --- Render Inputs ---
        // [REMOVED] (v6295) Wifi input is no longer rendered
        // if (document.activeElement !== this.f2.b10_wifiQty) this.f2.b10_wifiQty.value = formatValue(f2State.wifiQty);
        if (this.f2.b13_deliveryQty && document.activeElement !== this.f2.b13_deliveryQty) this.f2.b13_deliveryQty.value = formatValue(f2State.deliveryQty);
        if (this.f2.b14_installQty && document.activeElement !== this.f2.b14_installQty) this.f2.b14_installQty.value = formatValue(f2State.installQty);
        if (this.f2.b15_removalQty && document.activeElement !== this.f2.b15_removalQty) this.f2.b15_removalQty.value = formatValue(f2State.removalQty);
        if (this.f2.b17_mulTimes && document.activeElement !== this.f2.b17_mulTimes) this.f2.b17_mulTimes.value = formatValue(f2State.mulTimes);
        if (this.f2.b18_discount && document.activeElement !== this.f2.b18_discount) this.f2.b18_discount.value = formatValue(f2State.discount);

        // [MODIFIED] (Phase 9) `newOffer` input now defaults to `sumPrice` if null
        if (this.f2.new_offer && document.activeElement !== this.f2.new_offer) {
            const newOfferValue = (f2State.newOffer !== null && f2State.newOffer !== undefined) ? f2State.newOffer : f2State.sumPrice;
            this.f2.new_offer.value = formatValue(newOfferValue);
        }

        // [NEW] v6290 Render Deposit and Balance
        if (this.f2.deposit && document.activeElement !== this.f2.deposit) {
            this.f2.deposit.value = formatValue(f2State.deposit);
        }
        // Balance is read-only, so no need to check activeElement
        // [MODIFIED] Tweak 1: 使用 toFixed(2) 確ä?顯示?ä?小數
        if (this.f2.balance) this.f2.balance.value = (f2State.balance !== null && f2State.balance !== undefined) ? f2State.balance.toFixed(2) : '';


        if (this.f2.c13_deliveryFee) this.f2.c13_deliveryFee.classList.toggle('is-excluded', f2State.deliveryFeeExcluded);
        if (this.f2.c14_installFee) this.f2.c14_installFee.classList.toggle('is-excluded', f2State.installFeeExcluded);
        if (this.f2.c15_removalFee) this.f2.c15_removalFee.classList.toggle('is-excluded', f2State.removalFeeExcluded);

        // [NEW] (Phase 2) Toggle GST exclusion styles
        if (this.f2.label_gst) this.f2.label_gst.classList.toggle('is-excluded', f2State.gstExcluded);
        if (this.f2.b24_gst) this.f2.b24_gst.classList.toggle('is-excluded', f2State.gstExcluded);
    }

    activate() {
        // [REFACTORED] The view is now responsible for ensuring its data is fresh upon activation.
        const { quoteData, ui } = this.stateService.getState();
        const productStrategy = this.calculationService.productFactory.getProductStrategy(quoteData.currentProduct);
        const { updatedQuoteData } = this.calculationService.calculateAndSum(quoteData, productStrategy);

        this.stateService.dispatch(quoteActions.setQuoteData(updatedQuoteData));
        // [NEW] (Phase 12) Auto-populate install Qty if it's null
        if (ui.f2.installQty === null) {
            // We use updatedQuoteData.products... to get the most current item list

            const items = updatedQuoteData.products[updatedQuoteData.currentProduct].items;
            const defaultInstallQty = items.length > 0 ? items.length - 1 : 0;
            if (defaultInstallQty >= 0) {
                this.stateService.dispatch(uiActions.setF2Value('installQty', defaultInstallQty));
            }
        }

        this._calculateF2Summary();

        // [MODIFIED] (v6295) Change focus to delivery Qty on all devices
        this.eventAggregator.publish(EVENTS.FOCUS_ELEMENT, { elementId: 'f2-b13-delivery-qty' });
    }

    // --- [NEW] Methods migrated from WorkflowService ---
    handleToggleFeeExclusion({ feeType }) {
        this.stateService.dispatch(uiActions.toggleF2FeeExclusion(feeType));
        this._calculateF2Summary();
    }

    // [NEW] (Phase 2)
    handleToggleGstExclusion() {
        this.stateService.dispatch(uiActions.toggleGstExclusion());
        this._calculateF2Summary();
    }

    handleF2ValueChange({ id, value }) {
        const numericValue = value === '' ? null : parseFloat(value);
        let keyToUpdate = null;

        switch (id) {
            // case 'f2-b10-wifi-qty': keyToUpdate = 'wifiQty'; break; // [REMOVED] (v6295)
            case 'f2-b13-delivery-qty': keyToUpdate = 'deliveryQty'; break;
            case 'f2-b14-install-qty': keyToUpdate = 'installQty'; break;
            case 'f2-b15-removal-qty': keyToUpdate = 'removalQty'; break;
            case 'f2-b17-mul-times': keyToUpdate = 'mulTimes'; break;
            case 'f2-b18-discount': keyToUpdate = 'discount'; break;
            case 'new-offer': keyToUpdate = 'newOffer'; break; // [NEW]
            case 'f2-deposit': keyToUpdate = 'deposit'; break; // [NEW] v6290
        }

        if (keyToUpdate) {
            this.stateService.dispatch(uiActions.setF2Value(keyToUpdate, numericValue));
            this._calculateF2Summary();
        }
    }

    focusNextF2Input(currentId) {
        const currentIndex = this.f2InputSequence.indexOf(currentId);
        if (currentIndex > -1 && currentIndex < this.f2InputSequence.length - 1) {
            const nextElementId = this.f2InputSequence[currentIndex + 1];
            this.eventAggregator.publish(EVENTS.FOCUS_ELEMENT, { elementId: nextElementId });
        } else {
            const currentElement = document.getElementById(currentId);
            currentElement?.blur();
        }
    }

    _calculateF2Summary() {
        const { quoteData, ui } = this.stateService.getState();
        const summaryValues = this.calculationService.calculateF2Summary(quoteData, ui);

        // [FIX] (Phase 8) Explicitly dispatch ALL values from calculation service
        // to their corresponding state keys. This removes all ambiguity and
        // fixes the logic error from previous edits.

        // Old compatible values
        this.stateService.dispatch(uiActions.setF2Value('totalSumForRbTime', summaryValues.totalSumForRbTime));
        this.stateService.dispatch(uiActions.setF2Value('wifiSum', summaryValues.wifiSum));
        this.stateService.dispatch(uiActions.setF2Value('deliveryFee', summaryValues.deliveryFee));
        this.stateService.dispatch(uiActions.setF2Value('installFee', summaryValues.installFee));
        this.stateService.dispatch(uiActions.setF2Value('removalFee', summaryValues.removalFee));
        this.stateService.dispatch(uiActions.setF2Value('acceSum', summaryValues.acceSum));
        this.stateService.dispatch(uiActions.setF2Value('eAcceSum', summaryValues.eAcceSum));
        this.stateService.dispatch(uiActions.setF2Value('firstRbPrice', summaryValues.firstRbPrice));
        this.stateService.dispatch(uiActions.setF2Value('disRbPrice', summaryValues.disRbPrice));
        this.stateService.dispatch(uiActions.setF2Value('rbProfit', summaryValues.rbProfit));
        this.stateService.dispatch(uiActions.setF2Value('singleprofit', summaryValues.singleprofit));
        this.stateService.dispatch(uiActions.setF2Value('mulTimes', summaryValues.mulTimes));

        // New (Phase 2+) values
        this.stateService.dispatch(uiActions.setF2Value('f2_17_pre_sum', summaryValues.f2_17_pre_sum));
        this.stateService.dispatch(uiActions.setF2Value('sumPrice', summaryValues.sumPrice));

        // [MODIFIED] (Phase 10) DO NOT dispatch newOffer.
        // `newOffer` state is ONLY set by user input via `handleF2ValueChange`.
        // We let the `render` function read `summaryValues.newOffer` if `f2State.newOffer` is null.

        this.stateService.dispatch(uiActions.setF2Value('gst', summaryValues.new_gst)); // Dispatch new_gst to 'gst' state

        this.stateService.dispatch(uiActions.setF2Value('grandTotal', summaryValues.grandTotal));
        this.stateService.dispatch(uiActions.setF2Value('netProfit', summaryValues.netProfit));

        // [NEW] (Accounting V2 Phase 2) Dispatch taxExclusiveTotal
        this.stateService.dispatch(uiActions.setF2Value('taxExclusiveTotal', summaryValues.taxExclusiveTotal));

        // [NEW] v6290 Calculate and dispatch Deposit and Balance
        const currentGrandTotal = summaryValues.grandTotal || 0;
        const previousGrandTotalInState = ui.f2.grandTotal;
        const grandTotalChanged = currentGrandTotal !== previousGrandTotalInState;

        const autoDeposit = Math.ceil(Math.ceil(currentGrandTotal / 2) / 10) * 10;
        const currentDepositInState = ui.f2.deposit;

        let finalDeposit;
        if (grandTotalChanged) {
            // Rule 3C: grandTotal changed, force recalculation
            finalDeposit = autoDeposit;
        } else {
            // grandTotal did not change. Keep user's value if it exists, otherwise use auto-calc.
            finalDeposit = (currentDepositInState !== null && currentDepositInState !== undefined) ? currentDepositInState : autoDeposit;
        }

        // Rule 4: Balance = grandTotal - deposit
        const rawBalance = currentGrandTotal - finalDeposit;

        // [NEW] Tweak 1: Force ceiling rounding to 2 decimal places
        // 1. Multiply by 100 to get cents (e.g., 600.1331 -> 60013.31)
        // 2. Use Math.ceil() to force round up (e.g., 60013.31 -> 60014)
        // 3. Divide by 100 to get dollars (e.g., 60014 -> 600.14)
        const finalBalance = Math.ceil(rawBalance * 100) / 100;

        this.stateService.dispatch(uiActions.setF2Value('deposit', finalDeposit));
        this.stateService.dispatch(uiActions.setF2Value('balance', finalBalance));

        // [REMOVED] The faulty for...in loop is now gone.
    }
}