/* FILE: 04-core-code/config/initial-state.js */
// [MODIFIED] (F4 Status Phase 1) Import QUOTE_STATUS
// [MODIFIED] (Correction Flow Phase 2) Added isCorrectionMode to UI state.
// [MODIFIED] (F1 Motor Split) Added w_motor_qty to ui.f1 and f1Snapshot.
// [MODIFIED] (F1 Motor Split Architecture Fix) Added motorPrice to ui.f2.
// [MODIFIED] (Stage 9 Phase 3 - Constants) Replaced magic string 'rollerBlind' with PRODUCT_TYPES.ROLLER_BLIND.

import { QUOTE_STATUS } from './status-config.js';
import { PRODUCT_TYPES } from './business-constants.js'; // [NEW]

/**
 * @fileoverview Defines the initial state of the application.
 * This structure serves as the default blueprint for the entire app's data.
 */

export const initialState = {
    ui: {
        // --- SPA View Management ---
        currentView: 'QUICK_QUOTE',
        visibleColumns: ['sequence', 'width', 'height', 'TYPE',
            'Price'],
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
        // [REMOVED] (Phase 3) Add state for SSet selection, independent of lfSelectedRowIndexes
        // sSetSelectedRowIndexes: [],

        // [REMOVED] lfModifiedRowIndexes is moved to quoteData.uiMetadata for persistence.

        // --- K5 (Dual/Chain) State ---
        dualChainMode: null,
        dualChainInputValue: '',
        dualPrice: null,


        // --- K3 (Drive/Accessories) State ---
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


        // [RESTRUCTURED] --- F1 Financial Overview State ---
        f1: {
            discountPercentage: 0,
            remote_1ch_qty: 0,
            remote_16ch_qty: 0,
            dual_combo_qty: null,
            dual_slim_qty: null,
            // [NEW] (F1 Motor Split) W-Motor (Wired) Quantity
            w_motor_qty: 0,

            // [MODIFIED] (Phase 3.3c) Brand defaults changed to 'linx'
            motorBrand: 'linx',
            remoteBrand: 'linx',
            wifiBrand: 'linx',

            // [NEW] (F1/F2 Refactor Phase 1) Add state to store F1 cost totals
            f1_subTotal: 0,
            f1_finalTotal: 0,
            wifi_qty: 0, // [NEW] (v6295) Add state for F1 Wifi Qty
            cachedCosts: null, /* Cache for pre-calculated F1 results to optimize rendering performance */
        },


        // --- F2 Financial Summary State ---
        f2: {
            // [MODIFIED] (Phase 10.4) Calibrated defaults for golden workflow
            wifiQty: 0, deliveryQty: 1, installQty: null, removalQty: 0,
            mulTimes: 1.5, discount: 10, wifiSum: 0, deliveryFee: 100,
            installFee: 0, removalFee: 0, deliveryFeeExcluded: false,
            installFeeExcluded: false, removalFeeExcluded: false, acceSum: 0,
            eAcceSum: 0, surchargeFee: 0, totalSumForRbTime: 0,
            firstRbPrice: 0, disRbPrice: 0, singleprofit: 0,
            rbProfit: 0,
            gst: 0, netProfit: 0,
            // [v6290] Add Deposit and Balance
            deposit: 0,
            balance: 0,
            isDepositManuallyEdited: false,

            newOffer: null,

            // [FIX] Add missing keys from Phase 2
            f2_17_pre_sum: 0,
            sumPrice: 0,
            grandTotal: 0,

            gstExcluded: false, // [NEW] (Phase 2)

            // [NEW] (Accounting V2 Phase 2) Store tax exclusive total for XERO
            taxExclusiveTotal: 0,

            // [NEW] (F1 Motor Split Architecture Fix) Store calculated motor price for display
            motorPrice: 0,
            // [NEW] (Phase 4.4h) Slots for accessory retail prices from calculation service
            remotePrice: 0,
            chargerPrice: 0,
            cordPrice: 0,

            // [NEW] Phase 8.1: Dynamic fee unit prices (null = use ConfigManager defaults)
            deliveryUnitPrice: null,
            installUnitPrice: null,
            removalUnitPrice: null,
            
            // [NEW] (Phase G) Subtotal Anchor for Smart Quote Linking
            lastSyncedSubtotal: null
        },

        // --- Global UI State ---
        isSumOutdated: false,
        welcomeDialogShown: false,
        isModalActive: false, // [NEW] Add modal lock state
        isProcessing: false, // [NEW] Global processing flag for UI lock

        // [NEW] (Correction Flow Phase 2) Indicates if we are correcting an existing order
        isCorrectionMode: false
    },
    quoteData: {
        // [MODIFIED] Use constant instead of 'rollerBlind'
        currentProduct: PRODUCT_TYPES.ROLLER_BLIND,
        products: {
            // [MODIFIED] Use constant as computed property key
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
                    totalSum: 0,
                    accessories: {
                        winder: { count: 0, price: 0 },
                        motor: { count: 0, price: 0 },
                        remote: { type: 'standard', count: 0, price: 0 },
                        charger: { count: 0, price: 0 },
                        cord3m: { count: 0, price: 0 },
                        remoteCostSum: 0,
                        winderCostSum: 0,
                        motorCostSum: 0,
                        chargerCostSum: 0,
                        cordCostSum: 0,
                    }
                }
            }
        },
        // [ADDED] A new container for UI-related metadata that needs to be saved.
        uiMetadata:
        {
            lfModifiedRowIndexes: []
        },

        // [NEW] (v6298-F4-Search) Add metadata container for searchable fields
        metadata: {
            hasMotor: false
        },

        quoteId: null,
        issueDate: null,
        dueDate: null,
        generalNotes: "",
        // [DIRECTIVE-v3.37] Updated to 4-point Australian commercial standard terms.
        termsConditions: "1. To confirm your custom order, a 50% non-refundable deposit is required. The balance is payable on or before the installation date.\\n2. As all products are tailor-made for your space, we are unable to accept cancellations or offer refunds for a change of mind.\\n3. Ownership of the goods will transfer to you upon full payment of the invoice.\\n4. For any overdue payments, detailed terms regarding debt recovery procedures and associated costs can be found at: https://about:blank",
        ownerUid: null, // [NEW] (v6297) Add field to store the owner's UID
        // [MODIFIED] (F4 Status Phase 1) Use constant for default status
        status: QUOTE_STATUS.A_SAVED,
        costDiscountPercentage: 0,
        customer: {
            name: "",
            // [NEW] (Accounting V2 Phase 1) Split fields
            firstName: "",
            lastName: "",
            address: "",
            phone: "",
            email: "",
            postcode: "" // [NEW] (v6298-F4-Search) Add postcode
        },
        // [MODIFIED] F1 Panel Status Snapshot (v6285 Phase 4) */
        f1Snapshot: {
            // Main component quantities (calculated)
            winder_qty: null,
            motor_qty: null,
            charger_qty: null,
            cord_qty: null,
            // Distribution quantities (from ui.f1)
            remote_1ch_qty: null,
            remote_16ch_qty: null,
            dual_combo_qty: null,
            dual_slim_qty: null,
            // [NEW] (F1 Motor Split) Snapshot W-Motor Qty
            w_motor_qty: null,

            // Financial values (from ui.f1)
            discountPercentage: null,
            wifi_qty: null // [NEW] (v6295)
        },
        // [NEW] (v6295) Add snapshot container for F2 state
        f2Snapshot: {}
    }
};