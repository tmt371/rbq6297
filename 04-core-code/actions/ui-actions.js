// File: 04-core-code/actions/ui-actions.js
// [MODIFIED] (Correction Flow Phase 2) Added setCorrectionMode.
// [MODIFIED] (F1 Motor Split) Added setF1MotorDistribution.

/**
 * @fileoverview Action creators for all UI-related state changes.
 */

import { UI_ACTION_TYPES } from '../config/action-types.js';

// --- View & Navigation ---
export const setCurrentView = (viewName) => ({
    type: UI_ACTION_TYPES.SET_CURRENT_VIEW,
    payload: { viewName },
});

export const setVisibleColumns = (columns) => ({
    type: UI_ACTION_TYPES.SET_VISIBLE_COLUMNS,
    payload: { columns },
});

export const setActiveTab = (tabId) => ({

    type: UI_ACTION_TYPES.SET_ACTIVE_TAB,
    payload: { tabId },
});

// --- Input & Selection ---
export const setActiveCell = (rowIndex, column) => ({
    type: UI_ACTION_TYPES.SET_ACTIVE_CELL,
    payload: { rowIndex, column },
});

export const setInputValue = (value) => ({
    type: UI_ACTION_TYPES.SET_INPUT_VALUE,
    payload: { value },
});

export const appendInputValue = (key) => ({
    type: UI_ACTION_TYPES.APPEND_INPUT_VALUE,
    payload: { key },
});

export const deleteLastInputChar
    = () => ({
        type: UI_ACTION_TYPES.DELETE_LAST_INPUT_CHAR,
    });

export const clearInputValue = () => ({
    type: UI_ACTION_TYPES.CLEAR_INPUT_VALUE,
});

export const toggleMultiSelectMode = () => ({
    type: UI_ACTION_TYPES.TOGGLE_MULTI_SELECT_MODE,
});

export const toggleMultiSelectSelection = (rowIndex) => ({
    type: UI_ACTION_TYPES.TOGGLE_MULTI_SELECT_SELECTION,
    payload: { rowIndex },
});
export const clearMultiSelectSelection = () => ({
    type: UI_ACTION_TYPES.CLEAR_MULTI_SELECT_SELECTION,
});


// --- Left Panel Edit Modes ---
export const setActiveEditMode = (mode) => ({

    type: UI_ACTION_TYPES.SET_ACTIVE_EDIT_MODE,
    payload: { mode },
});

export const setTargetCell = (cell) => ({
    type: UI_ACTION_TYPES.SET_TARGET_CELL,
    payload: { cell },
});

export const setLocationInputValue = (value) => ({
    type: UI_ACTION_TYPES.SET_LOCATION_INPUT_VALUE,
    payload: { value },
});

// --- K2 (Fabric/LF) State ---
export const toggleLFSelection = (rowIndex) => ({
    type: UI_ACTION_TYPES.TOGGLE_LF_SELECTION,
    payload: { rowIndex },
});

export const clearLFSelection = () => ({

    type: UI_ACTION_TYPES.CLEAR_LF_SELECTION,
});

// [REMOVED] (Phase 3) K2 (SSet) State
// export const toggleSSetSelection = (rowIndex) => ({
//     type: UI_ACTION_TYPES.TOGGLE_SSET_SELECTION,
//     payload: { rowIndex },
// });
// 
// export const clearSSetSelection = () => ({
//     type: UI_ACTION_TYPES.CLEAR_SSET_SELECTION,
// });


// --- K4 & K5 State ---
export const setDualChainMode = (mode) => ({
    type: UI_ACTION_TYPES.SET_DUAL_CHAIN_MODE,
    payload: { mode },
});

export const setDriveAccessoryMode = (mode) => ({
    type: UI_ACTION_TYPES.SET_DRIVE_ACCESSORY_MODE,
    payload: { mode },
});

export const setDriveAccessoryCount = (accessory, count) => ({
    type: UI_ACTION_TYPES.SET_DRIVE_ACCESSORY_COUNT,
    payload: { accessory, count },
});

export const setDriveAccessoryTotalPrice = (accessory, price) => ({

    type: UI_ACTION_TYPES.SET_DRIVE_ACCESSORY_TOTAL_PRICE,
    payload: { accessory, price },
});

export const setDriveGrandTotal = (price) => ({
    type: UI_ACTION_TYPES.SET_DRIVE_GRAND_TOTAL,
    payload: { price },
});

// --- [FIX] Add new action creators for K5 view ---
export const setDualPrice = (price) => ({
    type: UI_ACTION_TYPES.SET_DUAL_PRICE,
    payload: { price },
});

export const clearDualChainInputValue = () => ({
    type: UI_ACTION_TYPES.CLEAR_DUAL_CHAIN_INPUT_VALUE,
});

export const setSummaryWinderPrice = (price) => ({

    type: UI_ACTION_TYPES.SET_SUMMARY_WINDER_PRICE,
    payload: { price },
});

export const setSummaryMotorPrice = (price) => ({
    type: UI_ACTION_TYPES.SET_SUMMARY_MOTOR_PRICE,
    payload: { price },
});

export const setSummaryRemotePrice = (price) => ({
    type: UI_ACTION_TYPES.SET_SUMMARY_REMOTE_PRICE,
    payload: { price },
});

export const setSummaryChargerPrice = (price) => ({
    type: UI_ACTION_TYPES.SET_SUMMARY_CHARGER_PRICE,
    payload: { price },
});

export const setSummaryCordPrice = (price) => ({

    type: UI_ACTION_TYPES.SET_SUMMARY_CORD_PRICE,
    payload: { price },
});

export const setSummaryAccessoriesTotal = (price) => ({
    type: UI_ACTION_TYPES.SET_SUMMARY_ACCESSORIES_TOTAL,
    payload: { price },
});


// --- F1 Financial Overview State ---
export const setF1RemoteDistribution = (qty1, qty16) => ({
    type: UI_ACTION_TYPES.SET_F1_REMOTE_DISTRIBUTION,
    payload: { qty1, qty16 },
});

export const setF1DualDistribution = (comboQty, slimQty) => ({
    type: UI_ACTION_TYPES.SET_F1_DUAL_DISTRIBUTION,
    payload: { comboQty, slimQty },
});

// [NEW] (F1 Motor Split) Action to update W-Motor quantity
export const setF1MotorDistribution = (wQty) => ({
    type: UI_ACTION_TYPES.SET_F1_MOTOR_DISTRIBUTION,
    payload: { wQty },
});

export const setF1DiscountPercentage = (percentage) => ({
    type: UI_ACTION_TYPES.SET_F1_DISCOUNT_PERCENTAGE,
    payload: { percentage },
});

// [NEW] (F1/F2 Refactor Phase 1) Add action creator for F1 cost totals
export const setF1CostTotals = (subTotal, finalTotal) => ({
    type: UI_ACTION_TYPES.SET_F1_COST_TOTALS,
    payload: { subTotal, finalTotal },
});

// [NEW] (v6295) Add action creator for F1 Wifi Qty
export const setF1WifiQty = (quantity) => ({
    type: UI_ACTION_TYPES.SET_F1_WIFI_QTY,
    payload: { quantity },
});

// --- F2 State ---
export const setF2Value = (key, value) => ({
    type: UI_ACTION_TYPES.SET_F2_VALUE,
    payload: { key, value },
});

export const toggleF2FeeExclusion = (feeType) => ({
    type: UI_ACTION_TYPES.TOGGLE_F2_FEE_EXCLUSION,
    payload: { feeType },
});

// [NEW] (Phase 2)
export const toggleGstExclusion = () => ({
    type: UI_ACTION_TYPES.TOGGLE_GST_EXCLUSION,
});

// --- Global UI State ---
export const setSumOutdated = (isOutdated) => ({
    type: UI_ACTION_TYPES.SET_SUM_OUTDATED,
    payload: { isOutdated },
});

export
    const resetUi = () => ({
        type: UI_ACTION_TYPES.RESET_UI,
    });

// [NEW] Add modal lock action creator
export const setModalActive = (isActive) => ({
    type: UI_ACTION_TYPES.SET_MODAL_ACTIVE,
    payload: { isActive },
});

// [NEW] (Correction Flow Phase 2) Set correction mode
export const setCorrectionMode = (isCorrectionMode) => ({
    type: UI_ACTION_TYPES.SET_CORRECTION_MODE,
    payload: { isCorrectionMode },
});

// [NEW v6285 Phase 4] Action creator for restoring F1 state
export const restoreF1Snapshot = (snapshotData) => ({
    type: UI_ACTION_TYPES.RESTORE_F1_SNAPSHOT,
    payload: snapshotData,
});

// [NEW] (v6295) Add action creator for restoring F2 state
export const restoreF2Snapshot = (snapshotData) => ({
    type: UI_ACTION_TYPES.RESTORE_F2_SNAPSHOT,
    payload: snapshotData,
});