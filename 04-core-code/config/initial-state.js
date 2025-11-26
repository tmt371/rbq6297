/* FILE: 04-core-code/config/initial-state.js */

import { QUOTE_STATUS } from './status-config.js';
import { PRODUCT_TYPES } from './business-constants.js';

/**
 * @fileoverview Defines the initial state of the application.
 * This structure serves as the default blueprint for the entire app's data.
 */

export const initialState = {
    ui: {
        // --- SPA View Management ---
        currentView: 'QUICK_QUOTE',
        visibleColumns: ['sequence', 'width', 'height', 'TYPE', 'Price'],
        activeTabId: 'k1-tab',

        // --- Input & Selection State ---
        inputValue: '',
        inputMode: 'width',
        activeCell: { rowIndex: 0, column: 'width' },
        selectedRowIndex: null,
        isMultiSelectMode: false,
        multiSelectSelectedIndexes: [],

        // --- Left Panel Edit Modes & States ---
        activeEditMode: null,
        targetCell: null,
        locationInputValue: '',

        // --- K2 (Fabric/LF) State ---
        lfSelectedRowIndexes: [],

        // --- K5 (Dual/Chain) State ---
        dualChainMode: null,
        dualChainInputValue: '',
        dualPrice: null,

        // --- K4 (Drive/Accessories) State ---
        driveAccessoryMode: null,
        driveRemoteCount: 0,
        driveChargerCount: 0,
        driveCordCount: 0,
        driveWinderTotalPrice: null,
        driveMotorTotalPrice: null,
        driveRemoteTotalPrice: null,
        driveChargerTotalPrice: null,
        driveCordTotalPrice: null,
        driveGrandTotal: null,

        // --- K5 Summary Display State ---
        summaryWinderPrice: null,
        summaryMotorPrice: null,
        summaryRemotePrice: null,
        summaryChargerPrice: null,
        summaryCordPrice: null,
        summaryAccessoriesTotal: null,

        // --- F1 Financial Overview State ---
        f1: {
            discountPercentage: 0,
            remote_1ch_qty: 0,
            remote_16ch_qty: null,
            dual_combo_qty: null,
            dual_slim_qty: null,
            w_motor_qty: null,
            f1_subTotal: null,
            f1_finalTotal: null,
            wifi_qty: null,
        },

        // --- F2 Financial Summary State ---
        f2: {
            wifiQty: null, deliveryQty: null, installQty: null, removalQty: null,
            mulTimes: null, discount: null, wifiSum: null, deliveryFee: null,
            installFee: null, removalFee: null, deliveryFeeExcluded: false,
            installFeeExcluded: false, removalFeeExcluded: false, acceSum: null,
            eAcceSum: null, surchargeFee: null, totalSumForRbTime: null,
            firstRbPrice: null, disRbPrice: null, singleprofit: null,
            rbProfit: null,
            gst: null, netProfit: null,
            deposit: null,
            balance: null,
            newOffer: null,
            f2_17_pre_sum: null,
            sumPrice: null,
            grandTotal: null,
            gstExcluded: false,
            taxExclusiveTotal: null,
            motorPrice: null
        },

        // --- Global UI State ---
        isSumOutdated: false,
        welcomeDialogShown: false,
        isModalActive: false,
        isCorrectionMode: false
    },
    quoteData: {
        currentProduct: PRODUCT_TYPES.ROLLER_BLIND,
        products: {
            [PRODUCT_TYPES.ROLLER_BLIND]: {
                items: [
                    {
                        itemId: `item-${Date.now()}`,
                        width: null, height: null, fabricType: null, linePrice: null,
                        location: '', fabric: '', color: '', over: '',
                        oi: '', lr: '', dual: '', chain: null,
                        winder: '',
                        motor: ''
                    }
                ],
                summary: {
                    totalSum: null,
                    accessories: {
                        winder: { count: 0, price: 0 },
                        motor: { count: 0, price: 0 },
                        remote: { type: 'standard', count: 0, price: 0 },
                        charger: { count: 0, price: 0 },
                        cord3m: { count: 0, price: 0 },
                        remoteCostSum: null,
                        winderCostSum: null,
                        motorCostSum: null,
                        chargerCostSum: null,
                        cordCostSum: null,
                    }
                }
            }
        },
        uiMetadata: {
            lfModifiedRowIndexes: []
        },
        metadata: {
            hasMotor: false
        },
        quoteId: null,
        issueDate: null,
        dueDate: null,
        ownerUid: null,
        status: QUOTE_STATUS.A_ARCHIVED,
        costDiscountPercentage: 0,
        customer: {
            name: "",
            firstName: "",
            lastName: "",
            address: "",
            phone: "",
            email: "",
            postcode: ""
        },
        f1Snapshot: {
            winder_qty: null,
            motor_qty: null,
            charger_qty: null,
            cord_qty: null,
            remote_1ch_qty: null,
            remote_16ch_qty: null,
            dual_combo_qty: null,
            dual_slim_qty: null,
            w_motor_qty: null,
            discountPercentage: null,
            wifi_qty: null
        },
        f2Snapshot: {}
    }
};