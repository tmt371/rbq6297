/* FILE: 04-core-code/ui/views/f1-cost-view.js */
// [MODIFIED] (v6297) 移除本地 F1 成本計算邏輯，改為呼叫 calculationService.calculateF1Costs
// [MODIFIED] (F1 Motor Split) Added W-Motor display cache, render logic, and handleMotorDistribution dialog.

import { EVENTS, DOM_IDS } from '../../config/constants.js';
import * as uiActions from '../../actions/ui-actions.js';

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the F1 (Cost) tab.
 */
export class F1CostView {
    constructor({ panelElement, eventAggregator, calculationService, stateService }) {
        this.panelElement = panelElement;
        this.eventAggregator = eventAggregator;
        this.calculationService = calculationService;
        this.stateService = stateService; // [NEW] Injected dependency

        // [NEW] (v6298-fix-5) Store bound handlers
        this.boundHandlers = [];

        this._cacheF1Elements();
        this._initializeF1Listeners();
        console.log("F1CostView Initialized.");
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
        console.log("F1CostView destroyed.");
    }

    _cacheF1Elements() {
        const query = (id) => this.panelElement.querySelector(id);
        this.f1 = {
            inputs: {
                'discount': query(`#${DOM_IDS.F1_RB_DISCOUNT_INPUT}`),
                'wifihub': query('#f1-qty-wifihub'), // [NEW] (v6295)
            },
            displays: {
                qty: {
                    'winder': query(`#${DOM_IDS.F1_QTY_WINDER}`),
                    'motor': query(`#${DOM_IDS.F1_QTY_MOTOR}`),
                    'w-motor': query(`#${DOM_IDS.F1_QTY_W_MOTOR}`), // [NEW] (F1 Motor Split)
                    'remote-1ch': query(`#${DOM_IDS.F1_QTY_REMOTE_1CH}`),
                    'remote-16ch': query(`#${DOM_IDS.F1_QTY_REMOTE_16CH}`),
                    'charger': query(`#${DOM_IDS.F1_QTY_CHARGER}`),
                    '3m-cord': query(`#${DOM_IDS.F1_QTY_3M_CORD}`),
                    'dual-combo': query(`#${DOM_IDS.F1_QTY_DUAL_COMBO}`),
                    'slim': query(`#${DOM_IDS.F1_QTY_SLIM}`),
                },
                price: {
                    'winder': query(`#${DOM_IDS.F1_PRICE_WINDER}`),
                    'motor': query(`#${DOM_IDS.F1_PRICE_MOTOR}`),
                    'w-motor': query(`#${DOM_IDS.F1_PRICE_W_MOTOR}`), // [NEW] (F1 Motor Split)
                    'remote-1ch': query(`#${DOM_IDS.F1_PRICE_REMOTE_1CH}`),
                    'remote-16ch': query(`#${DOM_IDS.F1_PRICE_REMOTE_16CH}`),
                    'charger': query(`#${DOM_IDS.F1_PRICE_CHARGER}`),
                    '3m-cord': query(`#${DOM_IDS.F1_PRICE_3M_CORD}`),
                    'dual-combo': query(`#${DOM_IDS.F1_PRICE_DUAL_COMBO}`),
                    'slim': query(`#${DOM_IDS.F1_PRICE_SLIM}`),
                    'wifihub': query('#f1-price-wifihub'), // [NEW] (v6295)
                    'total': query(`#${DOM_IDS.F1_PRICE_TOTAL}`),
                    'rb-retail': query(`#${DOM_IDS.F1_RB_RETAIL}`),
                    'rb-price': query(`#${DOM_IDS.F1_RB_PRICE}`),
                    'sub-total': query(`#${DOM_IDS.F1_SUB_TOTAL}`),
                    'gst': query(`#${DOM_IDS.F1_GST}`),
                    'final-total': query(`#${DOM_IDS.F1_FINAL_TOTAL}`),
                }
            }
        };
    }

    _initializeF1Listeners() {
        const remote1chQtyDiv = this.f1.displays.qty['remote-1ch'];
        // [MODIFIED] (v6298-fix-5) Use helper
        this._addListener(remote1chQtyDiv, 'click', this.handleRemoteDistribution);

        const slimQtyDiv = this.f1.displays.qty['slim'];
        // [MODIFIED] (v6298-fix-5) Use helper
        this._addListener(slimQtyDiv, 'click', this.handleDualDistribution);

        // [NEW] (F1 Motor Split) Listener for W-Motor distribution
        const wMotorQtyDiv = this.f1.displays.qty['w-motor'];
        this._addListener(wMotorQtyDiv, 'click', this.handleMotorDistribution);


        const discountInput = this.f1.inputs['discount'];
        // [MODIFIED] (v6298-fix-5) Use helper
        this._addListener(discountInput, 'input', this._onDiscountInput);
        this._addListener(discountInput, 'keydown', this._onInputKeydown);

        // [NEW] (v6295) Add listener for Wifi input
        const wifiInput = this.f1.inputs['wifihub'];
        // [MODIFIED] (v6298-fix-5) Use helper
        this._addListener(wifiInput, 'input', this._onWifiInput);
        this._addListener(wifiInput, 'keydown', this._onInputKeydown);
    }

    // [NEW] (v6298-fix-5) Extracted handlers
    _onDiscountInput(event) {
        const percentage = parseFloat(event.target.value) || 0;
        this.eventAggregator.publish(EVENTS.F1_DISCOUNT_CHANGED, { percentage });
    }

    _onWifiInput(event) {
        const quantity = parseFloat(event.target.value) || 0;
        // Dispatch the new action to update state
        this.stateService.dispatch(uiActions.setF1WifiQty(quantity));
    }

    _onInputKeydown(event) {
        if (event.key === 'Enter') {
            event.target.blur();
        }
    }


    render(state) {
        if (!this.f1 || !state || !state.quoteData || !state.ui) return;

        const { quoteData, ui } = state;
        const formatPrice = (price) => (typeof price === 'number' && price > 0 ? `$${price.toFixed(2)}` : '');
        const formatDisplay = (value) => (value !== null && value !== undefined) ? value : '';

        // --- [NEW] (第 7 次編修) ---
        // 1. 從 CalculationService 獲取 F1 成本的數據
        const f1Costs = this.calculationService.calculateF1Costs(quoteData, ui);
        // --- [END NEW] ---


        // --- [MODIFIED] (F1 Motor Split) Update Render Logic ---

        // --- Component Cost Display ---
        if (this.f1.displays.qty.winder) this.f1.displays.qty.winder.textContent = f1Costs.qtys.winder;
        if (this.f1.displays.price.winder) this.f1.displays.price.winder.textContent = formatPrice(f1Costs.winderCost);

        // [MODIFIED] Motor (B-Motor)
        // Using b_motor Qty and Cost from calculation service
        if (this.f1.displays.qty.motor) this.f1.displays.qty.motor.textContent = f1Costs.qtys.b_motor;
        if (this.f1.displays.price.motor) this.f1.displays.price.motor.textContent = formatPrice(f1Costs.bMotorCost);

        // [NEW] W-Motor
        if (this.f1.displays.qty['w-motor']) this.f1.displays.qty['w-motor'].textContent = f1Costs.qtys.w_motor;
        if (this.f1.displays.price['w-motor']) this.f1.displays.price['w-motor'].textContent = formatPrice(f1Costs.wMotorCost);


        if (this.f1.displays.qty['remote-1ch']) this.f1.displays.qty['remote-1ch'].textContent = f1Costs.qtys.remote1ch;
        if (this.f1.displays.price['remote-1ch']) this.f1.displays.price['remote-1ch'].textContent = formatPrice(f1Costs.remote1chCost);

        if (this.f1.displays.qty['remote-16ch']) this.f1.displays.qty['remote-16ch'].textContent = f1Costs.qtys.remote16ch;
        if (this.f1.displays.price['remote-16ch']) this.f1.displays.price['remote-16ch'].textContent = formatPrice(f1Costs.remote16chCost);

        if (this.f1.displays.qty.charger) this.f1.displays.qty.charger.textContent = f1Costs.qtys.charger;
        if (this.f1.displays.price.charger) this.f1.displays.price.charger.textContent = formatPrice(f1Costs.chargerCost);

        if (this.f1.displays.qty['3m-cord']) this.f1.displays.qty['3m-cord'].textContent = f1Costs.qtys.cord;
        if (this.f1.displays.price['3m-cord']) this.f1.displays.price['3m-cord'].textContent = formatPrice(f1Costs.cordCost);

        if (this.f1.displays.qty['dual-combo']) this.f1.displays.qty['dual-combo'].textContent = f1Costs.qtys.combo;
        if (this.f1.displays.price['dual-combo']) this.f1.displays.price['dual-combo'].textContent = formatPrice(f1Costs.dualComboCost);

        if (this.f1.displays.qty.slim) this.f1.displays.qty.slim.textContent = f1Costs.qtys.slim;
        if (this.f1.displays.price.slim) this.f1.displays.price.slim.textContent = formatPrice(f1Costs.slimCost);

        if (this.f1.inputs.wifihub && document.activeElement !== this.f1.inputs.wifihub) {
            this.f1.inputs.wifihub.value = formatDisplay(f1Costs.qtys.wifi) || '';
        }
        if (this.f1.displays.price.wifihub) {
            this.f1.displays.price.wifihub.textContent = formatPrice(f1Costs.wifiCost);
        }

        if (this.f1.displays.price.total) this.f1.displays.price.total.textContent = formatPrice(f1Costs.componentTotal);
        // --- [END MODIFIED] ---


        // --- RB Pricing Calculation ---
        const retailTotal = quoteData.products.rollerBlind.summary.totalSum || 0;
        const discountPercentage = ui.f1.discountPercentage || 0;
        const rbPrice = retailTotal * (1 - (discountPercentage / 100));

        if (this.f1.displays.price['rb-retail']) this.f1.displays.price['rb-retail'].textContent = formatPrice(retailTotal);
        if (this.f1.inputs.discount && document.activeElement !== this.f1.inputs.discount) {
            this.f1.inputs.discount.value = formatDisplay(discountPercentage) || '';
        }
        if (this.f1.displays.price['rb-price']) this.f1.displays.price['rb-price'].textContent = formatPrice(rbPrice);

        // --- Final Summary Calculation ---
        // [MODIFIED] (第 7 次編修) 使用來自 f1Costs 的 componentTotal
        const subTotal = f1Costs.componentTotal + rbPrice;
        const gst = subTotal * 0.10;
        const finalTotal = subTotal + gst;

        // [NEW] (F1/F2 Refactor Phase 2) Dispatch the calculated totals to the central state
        this.stateService.dispatch(uiActions.setF1CostTotals(subTotal, finalTotal));
        if (this.f1.displays.price['sub-total']) this.f1.displays.price['sub-total'].textContent = formatPrice(subTotal);
        if (this.f1.displays.price.gst) this.f1.displays.price.gst.textContent = formatPrice(gst);
        if (this.f1.displays.price['final-total']) this.f1.displays.price['final-total'].textContent = formatPrice(finalTotal);
    }

    activate() {
        this.eventAggregator.publish(EVENTS.F1_TAB_ACTIVATED);

        // [MODIFIED] (v6294) (第 12 次編修)
        // 恢復 F1 標籤的自動對焦功能，使其與 F2 標籤的行為一致
        // if (!window.matchMedia("(max-width: 600px)").matches) {
        setTimeout(() => {
            const discountInput = this.f1.inputs.discount;
            if (discountInput) {
                discountInput.focus();
                discountInput.select();
            }
        }, 50); // A small delay ensures the element is visible and focusable.
        // }
    }

    // --- [NEW] Methods migrated from WorkflowService ---

    handleRemoteDistribution() {
        const { ui } = this.stateService.getState();
        const totalRemoteCount = ui.driveRemoteCount || 0;

        // [FIX] (v6295-fix) Read remote quantities directly from state
        const initial1ch = ui.f1.remote_1ch_qty || 0;
        const initial16ch = ui.f1.remote_16ch_qty || 0;

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `Total remotes: ${totalRemoteCount}. Please distribute them.`,
            layout: [
                [
                    { type: 'text', text: '1-Ch Qty:', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_1CH, value: initial1ch },
                    { type: 'text', text: '16-Ch Qty:', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_16CH, value: initial16ch }
                ],
                [
                    {
                        type: 'button',
                        text: 'Confirm',
                        className: 'primary-confirm-button',
                        colspan: 2,
                        callback: () => {
                            const qty1ch = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_1CH).value, 10);
                            const qty16ch = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_16CH).value, 10);

                            if (isNaN(qty1ch) || isNaN(qty16ch) || qty1ch < 0 || qty16ch < 0) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Quantities must be positive numbers.', type: 'error' });
                                return false;
                            }

                            if (qty1ch + qty16ch !== totalRemoteCount) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                                    message: `Total must equal ${totalRemoteCount}. Current total: ${qty1ch + qty16ch}.`,
                                    type: 'error'
                                });
                                return false;
                            }

                            this.stateService.dispatch(uiActions.setF1RemoteDistribution(qty1ch, qty16ch));
                            return true;
                        }
                    },
                    { type: 'button', text: 'Cancel', className: 'secondary', colspan: 2, callback: () => { } }
                ]
            ],
            onOpen: () => {
                const input1ch = document.getElementById(DOM_IDS.DIALOG_INPUT_1CH);
                const input16ch = document.getElementById(DOM_IDS.DIALOG_INPUT_16CH);

                input1ch.addEventListener('input', () => {
                    const qty1ch = parseInt(input1ch.value, 10);
                    if (!isNaN(qty1ch) && qty1ch >= 0 && qty1ch <= totalRemoteCount) {
                        input16ch.value = totalRemoteCount - qty1ch;
                    }
                });
                input16ch.addEventListener('input', () => {
                    const qty16ch = parseInt(input16ch.value, 10);
                    if (!isNaN(qty16ch) && qty16ch >= 0 && qty16ch <= totalRemoteCount) {
                        input1ch.value = totalRemoteCount - qty16ch;
                    }
                });

                setTimeout(() => {
                    input1ch.focus();
                    input1ch.select();
                }, 0);
            },
            closeOnOverlayClick: false
        });
    }

    handleDualDistribution() {
        const { quoteData, ui } = this.stateService.getState();
        const items = quoteData.products[quoteData.currentProduct].items;
        const totalDualPairs = Math.floor(items.filter(item => item.dual === 'D').length / 2);

        const initialCombo = (ui.f1.dual_combo_qty === null) ? totalDualPairs : ui.f1.dual_combo_qty;
        const initialSlim = (ui.f1.dual_slim_qty === null) ? 0 : ui.f1.dual_slim_qty;

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `Total Dual pairs: ${totalDualPairs}. Please distribute them.`,
            layout: [
                [
                    { type: 'text', text: 'Combo Qty:', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_COMBO, value: initialCombo },
                    { type: 'text', text: 'Slim Qty:', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_SLIM, value: initialSlim }
                ],
                [
                    {
                        type: 'button',
                        text: 'Confirm',
                        className: 'primary-confirm-button',
                        colspan: 2,
                        callback: () => {
                            const qtyCombo = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_COMBO).value, 10);
                            const qtySlim = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_SLIM).value, 10);

                            if (isNaN(qtyCombo) || isNaN(qtySlim) || qtyCombo < 0 || qtySlim < 0) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Quantities must be positive numbers.', type: 'error' });
                                return false;
                            }

                            if (qtyCombo + qtySlim !== totalDualPairs) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                                    message: `Total must equal ${totalDualPairs}. Current total: ${qtyCombo + qtySlim}.`,
                                    type: 'error'
                                });
                                return false;
                            }

                            this.stateService.dispatch(uiActions.setF1DualDistribution(qtyCombo, qtySlim));
                            return true;
                        }
                    },
                    { type: 'button', text: 'Cancel', className: 'secondary', colspan: 2, callback: () => { } }
                ]
            ],
            onOpen: () => {
                const inputCombo = document.getElementById(DOM_IDS.DIALOG_INPUT_COMBO);
                const inputSlim = document.getElementById(DOM_IDS.DIALOG_INPUT_SLIM);
                inputSlim.addEventListener('input', () => {
                    const qtySlim = parseInt(inputSlim.value, 10);
                    if (!isNaN(qtySlim) && qtySlim >= 0 && qtySlim <= totalDualPairs) {
                        inputCombo.value = totalDualPairs - qtySlim;
                    }
                });
                inputCombo.addEventListener('input', () => {
                    const qtyCombo = parseInt(inputCombo.value, 10);
                    if (!isNaN(qtyCombo) && qtyCombo >= 0 && qtyCombo <= totalDualPairs) {
                        inputSlim.value = totalDualPairs - qtyCombo;
                    }
                });
                setTimeout(() => {
                    inputSlim.focus();
                    inputSlim.select();
                }, 0);
            },
            closeOnOverlayClick: false
        });
    }

    // [NEW] (F1 Motor Split) Handle Motor Distribution Dialog
    handleMotorDistribution() {
        const { quoteData, ui } = this.stateService.getState();
        // Calculate total motor quantity from items (Truth source)
        const items = quoteData.products[quoteData.currentProduct].items;
        const totalMotorQty = items.filter(item => !!item.motor).length;

        // Get current W-Motor quantity from state (default 0)
        const currentWQty = ui.f1.w_motor_qty || 0;
        const currentBQty = totalMotorQty - currentWQty;

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `Total motor qty : ${totalMotorQty}. Please distribute them.`,
            layout: [
                [
                    { type: 'text', text: 'Battery-motor qty', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_BATTERY, value: currentBQty, inputType: 'number', disableEnterConfirm: true } // Read-only/Auto-calc typically, but input type for consistency
                ],
                [
                    { type: 'text', text: 'Wired-motor qty', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_WIRED, value: currentWQty, inputType: 'number' }
                ],
                [
                    {
                        type: 'button',
                        text: 'Confirm',
                        className: 'primary-confirm-button',
                        colspan: 1,
                        callback: () => {
                            const wQty = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_WIRED).value, 10);

                            if (isNaN(wQty) || wQty < 0) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Quantities must be positive numbers.', type: 'error' });
                                return false;
                            }

                            if (wQty > totalMotorQty) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                                    message: `Wired motor qty cannot exceed total (${totalMotorQty}).`,
                                    type: 'error'
                                });
                                return false;
                            }

                            // Dispatch action to set W-Motor quantity. B-Motor is derived.
                            this.stateService.dispatch(uiActions.setF1MotorDistribution(wQty));
                            return true;
                        }
                    },
                    { type: 'button', text: 'Cancel', className: 'secondary', colspan: 1, callback: () => { } }
                ]
            ],
            onOpen: () => {
                const inputB = document.getElementById(DOM_IDS.DIALOG_INPUT_BATTERY);
                const inputW = document.getElementById(DOM_IDS.DIALOG_INPUT_WIRED);

                // Make Battery input read-only visually or functional logic to auto-update
                // The requirement says: "User inputs W-motor... program automatically displays B-motor"
                // So inputB should be essentially read-only or auto-calculated.

                inputW.addEventListener('input', () => {
                    const wVal = parseInt(inputW.value, 10);
                    if (!isNaN(wVal) && wVal >= 0 && wVal <= totalMotorQty) {
                        inputB.value = totalMotorQty - wVal;
                    }
                });

                // If user tries to edit Battery, update Wired
                inputB.addEventListener('input', () => {
                    const bVal = parseInt(inputB.value, 10);
                    if (!isNaN(bVal) && bVal >= 0 && bVal <= totalMotorQty) {
                        inputW.value = totalMotorQty - bVal;
                    }
                });

                setTimeout(() => {
                    inputW.focus();
                    inputW.select();
                }, 50);
            },
            closeOnOverlayClick: false
        });
    }
}