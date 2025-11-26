/* FILE: 04-core-code/ui/views/f2-summary-view.js */

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

        this.f2InputSequence = [
            'f2-b13-delivery-qty',
            'f2-b14-install-qty',
            'f2-b15-removal-qty',
            'f2-b17-mul-times',
            'f2-b18-discount',
            'new-offer',
            'f2-deposit'
        ];

        this.boundHandlers = [];

        this._cacheF2Elements();
        this._initializeF2Listeners();
        console.log("F2SummaryView Initialized.");
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
            b10_wifiQty: query('f2-b10-wifi-qty'),
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
            f2_17_pre_sum: query('f2-17-pre-sum'),
            b21_rbProfit: query('f2-b21-rb-profit'),

            b22_sumprice: query('f2-b22-sumprice'),
            new_offer: query('new-offer'),
            label_gst: query('f2-label-gst'),
            b24_gst: query('f2-b24-gst'),
            grand_total: query('grand-total'),

            b25_netprofit: query('f2-b25-netprofit'),

            deposit: query('f2-deposit'),
            balance: query('f2-balance'),
        };
    }

    _initializeF2Listeners() {
        const setupF2InputListener = (inputElement) => {
            if (inputElement) {
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
                this._addListener(el, 'click', () => {
                    this.handleToggleFeeExclusion({ feeType: type });
                });
            }
        });

        if (this.f2.label_gst) {
            this._addListener(this.f2.label_gst, 'click', this.handleToggleGstExclusion);
        }
    }

    render(state) {
        if (!this.f2 || !state || !state.ui.f2) return;

        const f2State = state.ui.f2;
        const productSummary = state.quoteData.products[state.quoteData.currentProduct]?.summary;
        const accessories = productSummary?.accessories || {};

        const formatIntegerCurrency = (value) => (typeof value === 'number') ? `$${value.toFixed(0)}` : '$';
        const formatDecimalCurrency = (value) => (typeof value === 'number') ? `$${value.toFixed(2)}` : '$';
        const formatValue = (value) => (value !== null && value !== undefined) ? value : '';

        const winderPrice = accessories.winderCostSum || 0;
        const dualPrice = accessories.dualCostSum || 0;

        const motorPrice = f2State.motorPrice || 0;

        const remotePrice = accessories.remoteCostSum || 0;
        const chargerPrice = accessories.chargerCostSum || 0;
        const cordPrice = accessories.cordCostSum || 0;

        if (this.f2.b2_winderPrice) this.f2.b2_winderPrice.textContent = formatIntegerCurrency(winderPrice);
        if (this.f2.b3_dualPrice) this.f2.b3_dualPrice.textContent = formatIntegerCurrency(dualPrice);
        if (this.f2.b6_motorPrice) this.f2.b6_motorPrice.textContent = formatIntegerCurrency(motorPrice);
        if (this.f2.b7_remotePrice) this.f2.b7_remotePrice.textContent = formatIntegerCurrency(remotePrice);
        if (this.f2.b8_chargerPrice) this.f2.b8_chargerPrice.textContent = formatIntegerCurrency(chargerPrice);
        if (this.f2.b9_cordPrice) this.f2.b9_cordPrice.textContent = formatIntegerCurrency(cordPrice);

        const wifiQty = state.ui.f1.wifi_qty || 0;
        const wifiSum = wifiQty * 300;

        const deliveryFee = f2State.deliveryFee || 0;
        const installFee = f2State.installFee || 0;
        const removalFee = f2State.removalFee || 0;
        const acceSum = winderPrice + dualPrice;

        const eAcceSum = motorPrice + remotePrice + chargerPrice + cordPrice + wifiSum;

        const surchargeFee =
            (f2State.deliveryFeeExcluded ? 0 : deliveryFee) +
            (f2State.installFeeExcluded ? 0 : installFee) +
            (f2State.removalFeeExcluded ? 0 : removalFee);

        if (this.f2.b4_acceSum) this.f2.b4_acceSum.textContent = formatIntegerCurrency(acceSum);
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

        if (this.f2.b22_sumprice) this.f2.b22_sumprice.textContent = formatDecimalCurrency(f2State.sumPrice);
        if (this.f2.f2_17_pre_sum) this.f2.f2_17_pre_sum.textContent = formatDecimalCurrency(f2State.f2_17_pre_sum);
        if (this.f2.b24_gst) this.f2.b24_gst.textContent = formatDecimalCurrency(f2State.gst);
        if (this.f2.grand_total) this.f2.grand_total.textContent = formatDecimalCurrency(f2State.grandTotal);
        if (this.f2.b25_netprofit) this.f2.b25_netprofit.textContent = formatDecimalCurrency(f2State.netProfit);

        if (this.f2.b13_deliveryQty && document.activeElement !== this.f2.b13_deliveryQty) this.f2.b13_deliveryQty.value = formatValue(f2State.deliveryQty);
        if (this.f2.b14_installQty && document.activeElement !== this.f2.b14_installQty) this.f2.b14_installQty.value = formatValue(f2State.installQty);
        if (this.f2.b15_removalQty && document.activeElement !== this.f2.b15_removalQty) this.f2.b15_removalQty.value = formatValue(f2State.removalQty);
        if (this.f2.b17_mulTimes && document.activeElement !== this.f2.b17_mulTimes) this.f2.b17_mulTimes.value = formatValue(f2State.mulTimes);
        if (this.f2.b18_discount && document.activeElement !== this.f2.b18_discount) this.f2.b18_discount.value = formatValue(f2State.discount);

        if (this.f2.new_offer && document.activeElement !== this.f2.new_offer) {
            const newOfferValue = (f2State.newOffer !== null && f2State.newOffer !== undefined) ? f2State.newOffer : f2State.sumPrice;
            this.f2.new_offer.value = formatValue(newOfferValue);
        }

        if (this.f2.deposit && document.activeElement !== this.f2.deposit) {
            this.f2.deposit.value = formatValue(f2State.deposit);
        }

        if (this.f2.balance) this.f2.balance.value = (f2State.balance !== null && f2State.balance !== undefined) ? f2State.balance.toFixed(2) : '';

        if (this.f2.c13_deliveryFee) this.f2.c13_deliveryFee.classList.toggle('is-excluded', f2State.deliveryFeeExcluded);
        if (this.f2.c14_installFee) this.f2.c14_installFee.classList.toggle('is-excluded', f2State.installFeeExcluded);
        if (this.f2.c15_removalFee) this.f2.c15_removalFee.classList.toggle('is-excluded', f2State.removalFeeExcluded);

        if (this.f2.label_gst) this.f2.label_gst.classList.toggle('is-excluded', f2State.gstExcluded);
        if (this.f2.b24_gst) this.f2.b24_gst.classList.toggle('is-excluded', f2State.gstExcluded);
    }

    activate() {
        const { quoteData, ui } = this.stateService.getState();
        const productStrategy = this.calculationService.productFactory.getProductStrategy(quoteData.currentProduct);
        const { updatedQuoteData } = this.calculationService.calculateAndSum(quoteData, productStrategy);

        this.stateService.dispatch(quoteActions.setQuoteData(updatedQuoteData));

        if (ui.f2.installQty === null) {
            const items = updatedQuoteData.products[updatedQuoteData.currentProduct].items;
            const defaultInstallQty = items.length > 0 ? items.length - 1 : 0;
            if (defaultInstallQty >= 0) {
                this.stateService.dispatch(uiActions.setF2Value('installQty', defaultInstallQty));
            }
        }

        this._calculateF2Summary();

        this.eventAggregator.publish(EVENTS.FOCUS_ELEMENT, { elementId: 'f2-b13-delivery-qty' });
    }

    handleToggleFeeExclusion({ feeType }) {
        this.stateService.dispatch(uiActions.toggleF2FeeExclusion(feeType));
        this._calculateF2Summary();
    }

    handleToggleGstExclusion() {
        this.stateService.dispatch(uiActions.toggleGstExclusion());
        this._calculateF2Summary();
    }

    handleF2ValueChange({ id, value }) {
        const numericValue = value === '' ? null : parseFloat(value);
        let keyToUpdate = null;

        switch (id) {
            case 'f2-b13-delivery-qty': keyToUpdate = 'deliveryQty'; break;
            case 'f2-b14-install-qty': keyToUpdate = 'installQty'; break;
            case 'f2-b15-removal-qty': keyToUpdate = 'removalQty'; break;
            case 'f2-b17-mul-times': keyToUpdate = 'mulTimes'; break;
            case 'f2-b18-discount': keyToUpdate = 'discount'; break;
            case 'new-offer': keyToUpdate = 'newOffer'; break;
            case 'f2-deposit': keyToUpdate = 'deposit'; break;
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

        this.stateService.dispatch(uiActions.setF2Value('f2_17_pre_sum', summaryValues.f2_17_pre_sum));
        this.stateService.dispatch(uiActions.setF2Value('sumPrice', summaryValues.sumPrice));

        this.stateService.dispatch(uiActions.setF2Value('gst', summaryValues.new_gst));

        this.stateService.dispatch(uiActions.setF2Value('grandTotal', summaryValues.grandTotal));
        this.stateService.dispatch(uiActions.setF2Value('netProfit', summaryValues.netProfit));

        this.stateService.dispatch(uiActions.setF2Value('taxExclusiveTotal', summaryValues.taxExclusiveTotal));

        this.stateService.dispatch(uiActions.setF2MotorPrice(summaryValues.calculatedMotorPrice));

        const currentGrandTotal = summaryValues.grandTotal || 0;
        const previousGrandTotalInState = ui.f2.grandTotal;
        const grandTotalChanged = currentGrandTotal !== previousGrandTotalInState;

        const autoDeposit = Math.ceil(Math.ceil(currentGrandTotal / 2) / 10) * 10;
        const currentDepositInState = ui.f2.deposit;

        let finalDeposit;
        if (grandTotalChanged) {
            finalDeposit = autoDeposit;
        } else {
            finalDeposit = (currentDepositInState !== null && currentDepositInState !== undefined) ? currentDepositInState : autoDeposit;
        }

        const rawBalance = currentGrandTotal - finalDeposit;
        const finalBalance = Math.ceil(rawBalance * 100) / 100;

        this.stateService.dispatch(uiActions.setF2Value('deposit', finalDeposit));
        this.stateService.dispatch(uiActions.setF2Value('balance', finalBalance));
    }
}