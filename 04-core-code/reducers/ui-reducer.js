// File: 04-core-code/reducers/ui-reducer.js
// [MODIFIED] (Correction Flow Phase 2) Added SET_CORRECTION_MODE handler.
// [MODIFIED] (F1 Motor Split) Added SET_F1_MOTOR_DISTRIBUTION handler and snapshot restoration.
// [MODIFIED] (Phase 3.2) Added quantity conservation (守恆) logic to K3/F1 handlers.

import { UI_ACTION_TYPES } from '../config/action-types.js';
import { initialState } from '../config/initial-state.js';

export function uiReducer(state, action) {
    switch (action.type) {

        case UI_ACTION_TYPES.SET_CURRENT_VIEW:
            return { ...state, currentView: action.payload.viewName };
        case UI_ACTION_TYPES.SET_VISIBLE_COLUMNS:
            return { ...state, visibleColumns: action.payload.columns };
        case UI_ACTION_TYPES.SET_ACTIVE_TAB:
            return { ...state, activeTabId: action.payload.tabId };
        case UI_ACTION_TYPES.SET_ACTIVE_CELL:
            return { ...state, activeCell: action.payload, inputMode: action.payload.column };
        case UI_ACTION_TYPES.SET_INPUT_VALUE:
            return { ...state, inputValue: String(action.payload.value || '') };
        case UI_ACTION_TYPES.APPEND_INPUT_VALUE:
            return { ...state, inputValue: state.inputValue + action.payload.key };
        case UI_ACTION_TYPES.DELETE_LAST_INPUT_CHAR:
            return { ...state, inputValue: state.inputValue.slice(0, -1) };
        case UI_ACTION_TYPES.CLEAR_INPUT_VALUE:
            return { ...state, inputValue: '' };
        case UI_ACTION_TYPES.TOGGLE_MULTI_SELECT_MODE: {
            const isEnteringMode = !state.isMultiSelectMode;
            const newSelectedIndexes = isEnteringMode && state.selectedRowIndex !== null ? [state.selectedRowIndex] : [];
            return { ...state, isMultiSelectMode: isEnteringMode, multiSelectSelectedIndexes: newSelectedIndexes, selectedRowIndex: null };
        }
        case UI_ACTION_TYPES.TOGGLE_MULTI_SELECT_SELECTION: {
            const selectedIndexes = new Set(state.multiSelectSelectedIndexes);
            if (selectedIndexes.has(action.payload.rowIndex)) {
                selectedIndexes.delete(action.payload.rowIndex);
            } else {
                selectedIndexes.add(action.payload.rowIndex);
            }
            return { ...state, multiSelectSelectedIndexes: Array.from(selectedIndexes) };
        }
        case UI_ACTION_TYPES.CLEAR_MULTI_SELECT_SELECTION:
            return { ...state, multiSelectSelectedIndexes: [] };
        case UI_ACTION_TYPES.SET_ACTIVE_EDIT_MODE:
            return { ...state, activeEditMode: action.payload.mode };
        case UI_ACTION_TYPES.SET_TARGET_CELL:
            return { ...state, targetCell: action.payload.cell };
        case UI_ACTION_TYPES.SET_LOCATION_INPUT_VALUE:
            return { ...state, locationInputValue: action.payload.value };
        case UI_ACTION_TYPES.TOGGLE_LF_SELECTION: {
            const selectedIndexes = new Set(state.lfSelectedRowIndexes);
            if (selectedIndexes.has(action.payload.rowIndex)) {
                selectedIndexes.delete(action.payload.rowIndex);
            } else {
                selectedIndexes.add(action.payload.rowIndex);
            }
            return { ...state, lfSelectedRowIndexes: Array.from(selectedIndexes) };
        }
        case UI_ACTION_TYPES.CLEAR_LF_SELECTION:
            return { ...state, lfSelectedRowIndexes: [] };

        // [REMOVED] (Phase 3) K2 (SSet) State Reducers
        // case UI_ACTION_TYPES.TOGGLE_SSET_SELECTION: { ... }
        // case UI_ACTION_TYPES.CLEAR_SSET_SELECTION:
        //     return { ...state, sSetSelectedRowIndexes: [] };


        case UI_ACTION_TYPES.SET_DUAL_CHAIN_MODE:
            return { ...state, dualChainMode: action.payload.mode };
        case UI_ACTION_TYPES.SET_DRIVE_ACCESSORY_MODE:
            return { ...state, driveAccessoryMode: action.payload.mode };
        case UI_ACTION_TYPES.SET_DRIVE_ACCESSORY_COUNT: {
            const { accessory, count } = action.payload;
            const newUi = { ...state };
            if (count >= 0) {
                switch (accessory) {
                    case 'remote': {
                        newUi.driveRemoteCount = count;
                        // [MODIFIED] (Phase 3.25) 向下擠壓守恆：優先保留 1ch，餘數灌給 16ch
                        let r1 = state.f1.remote_1ch_qty || 0;
                        if (r1 > count) r1 = count;
                        const r16 = count - r1;
                        newUi.f1 = { ...state.f1, remote_1ch_qty: r1, remote_16ch_qty: r16 };
                        break;
                    }
                    case 'charger': newUi.driveChargerCount = count; break;
                    case 'cord': newUi.driveCordCount = count; break;
                }
            }
            return newUi;
        }
        case UI_ACTION_TYPES.SET_DRIVE_ACCESSORY_TOTAL_PRICE: {
            const { accessory, price } = action.payload;
            const newUi = { ...state };
            switch (accessory) {
                case 'winder': newUi.driveWinderTotalPrice = price; break;
                case 'motor': newUi.driveMotorTotalPrice = price; break;
                case 'remote': newUi.driveRemoteTotalPrice = price; break;
                case 'charger': newUi.driveChargerTotalPrice = price; break;
                case 'cord': newUi.driveCordTotalPrice = price; break;
            }
            return newUi;
        }
        case UI_ACTION_TYPES.SET_DRIVE_GRAND_TOTAL:
            return { ...state, driveGrandTotal: action.payload.price };
        case UI_ACTION_TYPES.SET_DUAL_PRICE:
            return { ...state, dualPrice: action.payload.price };
        case UI_ACTION_TYPES.CLEAR_DUAL_CHAIN_INPUT_VALUE:
            return { ...state, dualChainInputValue: '' };
        case UI_ACTION_TYPES.SET_SUMMARY_WINDER_PRICE:
            return { ...state, summaryWinderPrice: action.payload.price };
        case UI_ACTION_TYPES.SET_SUMMARY_MOTOR_PRICE:
            return { ...state, summaryMotorPrice: action.payload.price };
        case UI_ACTION_TYPES.SET_SUMMARY_REMOTE_PRICE:
            return { ...state, summaryRemotePrice: action.payload.price };
        case UI_ACTION_TYPES.SET_SUMMARY_CHARGER_PRICE:
            return { ...state, summaryChargerPrice: action.payload.price };
        case UI_ACTION_TYPES.SET_SUMMARY_CORD_PRICE:
            return { ...state, summaryCordPrice: action.payload.price };
        case UI_ACTION_TYPES.SET_SUMMARY_ACCESSORIES_TOTAL:
            return { ...state, summaryAccessoriesTotal: action.payload.price };
        case UI_ACTION_TYPES.SET_F1_REMOTE_DISTRIBUTION: {
            // [MODIFIED] (Phase 3.2) 蹹蹹板守恆：確保 1ch + 16ch = driveRemoteCount
            const totalRemote = state.driveRemoteCount || 0;
            let new16 = Math.max(0, action.payload.qty16 || 0);
            if (new16 > totalRemote) new16 = totalRemote;
            const new1 = totalRemote - new16;
            return { ...state, f1: { ...state.f1, remote_1ch_qty: new1, remote_16ch_qty: new16 } };
        }
        case UI_ACTION_TYPES.SET_F1_DUAL_DISTRIBUTION: {
            // [MODIFIED] (Phase 3.2) 蹹蹹板守恆：確保 combo + slim = 總雙層數
            // 總數由 payload 提供 (F1 計算時傳入)，或從現有分配加總推導
            const totalDual = (action.payload.comboQty || 0) + (action.payload.slimQty || 0);
            let newSlim = Math.max(0, action.payload.slimQty || 0);
            if (newSlim > totalDual) newSlim = totalDual;
            const newCombo = totalDual - newSlim;
            return { ...state, f1: { ...state.f1, dual_combo_qty: newCombo, dual_slim_qty: newSlim } };
        }

        // [MODIFIED] (Phase 3.2) Motor 蹹蹹板守恆：確保 w_motor_qty 不超過 caller 傳入的總數
        // 總馬達數來自 items (非 state)，由 caller 另行 clamp，此處只確保 >= 0
        case UI_ACTION_TYPES.SET_F1_MOTOR_DISTRIBUTION:
            return { ...state, f1: { ...state.f1, w_motor_qty: Math.max(0, action.payload.wQty || 0) } };

        case UI_ACTION_TYPES.SET_F1_DISCOUNT_PERCENTAGE:
            return { ...state, f1: { ...state.f1, discountPercentage: action.payload.percentage } };

        // [MODIFIED] (F1/F2 Refactor Phase 2 FIX) Handle setting F1 cost totals
        case UI_ACTION_TYPES.SET_F1_COST_TOTALS:
            // [FIX] Add check to prevent infinite render loop
            if (state.f1.f1_subTotal === action.payload.subTotal &&
                state.f1.f1_finalTotal === action.payload.finalTotal) {
                return state; // No change, break the loop
            }
            return {
                ...state,
                f1: {
                    ...state.f1,
                    f1_subTotal: action.payload.subTotal,
                    f1_finalTotal: action.payload.finalTotal
                }
            };

        case UI_ACTION_TYPES.SET_F1_WIFI_QTY: // [NEW] (v6295)
            return { ...state, f1: { ...state.f1, wifi_qty: action.payload.quantity } };

        case UI_ACTION_TYPES.SET_F1_CACHED_COSTS:
            return { ...state, f1: { ...state.f1, cachedCosts: action.payload.costs } };

        // [NEW] (Phase 3.3b) Brand selection handler
        case UI_ACTION_TYPES.SET_F1_BRAND: {
            const { field, value } = action.payload;
            if (['motorBrand', 'remoteBrand', 'wifiBrand'].includes(field)) {
                return { ...state, f1: { ...state.f1, [field]: value } };
            }
            return state;
        }

        case UI_ACTION_TYPES.SET_F2_VALUE: {
            const { key, value } = action.payload;
            return { 
                ...state, 
                f2: { 
                    ...state.f2, 
                    [key]: value 
                } 
            };
        }
        case UI_ACTION_TYPES.TOGGLE_F2_FEE_EXCLUSION: {
            const key = `${action.payload.feeType}FeeExcluded`;
            if (state.f2.hasOwnProperty(key)) {
                return { ...state, f2: { ...state.f2, [key]: !state.f2[key] } };
            }
            return state;
        }
        // [NEW] (Phase 2)
        case UI_ACTION_TYPES.TOGGLE_GST_EXCLUSION: {
            return { ...state, f2: { ...state.f2, gstExcluded: !state.f2.gstExcluded } };
        }
        case UI_ACTION_TYPES.SET_SUM_OUTDATED:
            return { ...state, isSumOutdated: action.payload.isOutdated };
        case UI_ACTION_TYPES.RESET_UI:
            return JSON.parse(JSON.stringify(initialState.ui));

        // [NEW] Add modal lock reducer case
        case UI_ACTION_TYPES.SET_MODAL_ACTIVE:
            if (state.isModalActive === action.payload.isActive) {
                return state; // No change
            }
            return { ...state, isModalActive: action.payload.isActive };

        // [NEW] Global processing flag
        case UI_ACTION_TYPES.SET_IS_PROCESSING:
            return { ...state, isProcessing: action.payload.isProcessing };

        // [NEW] (Correction Flow Phase 2) Set correction mode
        case UI_ACTION_TYPES.SET_CORRECTION_MODE:
            return { ...state, isCorrectionMode: action.payload.isCorrectionMode };

        // [NEW v6285 Phase 4] Restore F1 state from snapshot
        case UI_ACTION_TYPES.RESTORE_F1_SNAPSHOT: {
            const snapshot = action.payload;

            const newF1State = { ...state.f1 };

            // Restore financial/distribution values to ui.f1
            if (snapshot.discountPercentage !== null && snapshot.discountPercentage !== undefined) {
                newF1State.discountPercentage = snapshot.discountPercentage;
            }
            if (snapshot.remote_1ch_qty !== null && snapshot.remote_1ch_qty !== undefined) {
                newF1State.remote_1ch_qty = snapshot.remote_1ch_qty;
            }
            if (snapshot.remote_16ch_qty !== null && snapshot.remote_16ch_qty !== undefined) {
                newF1State.remote_16ch_qty = snapshot.remote_16ch_qty;
            }
            if (snapshot.dual_combo_qty !== null && snapshot.dual_combo_qty !== undefined) {
                newF1State.dual_combo_qty = snapshot.dual_combo_qty;
            }
            if (snapshot.dual_slim_qty !== null && snapshot.dual_slim_qty !== undefined) {
                newF1State.dual_slim_qty = snapshot.dual_slim_qty;
            }
            // [FIX] (v6295-fix) Add missing wifi_qty restore logic
            if (snapshot.wifi_qty !== null && snapshot.wifi_qty !== undefined) {
                newF1State.wifi_qty = snapshot.wifi_qty;
            }
            // [NEW] (F1 Motor Split) Restore W-Motor quantity
            if (snapshot.w_motor_qty !== null && snapshot.w_motor_qty !== undefined) {
                newF1State.w_motor_qty = snapshot.w_motor_qty;
            }

            const newState = { ...state, f1: newF1State };

            // Restore K3 accessory counts to ui root
            if (snapshot.charger_qty !== null && snapshot.charger_qty !== undefined) {
                newState.driveChargerCount = snapshot.charger_qty;
            }
            if (snapshot.cord_qty !== null && snapshot.cord_qty !== undefined) {
                newState.driveCordCount = snapshot.cord_qty;
            }


            // Restore total remote count for K3 display
            // We must use the values we just set in newF1State
            const remote1ch = newF1State.remote_1ch_qty || 0;
            const remote16ch = newF1State.remote_16ch_qty || 0;
            newState.driveRemoteCount = remote1ch + remote16ch;

            return newState;
        }

        // [NEW] (v6295) Restore F2 state from snapshot
        case UI_ACTION_TYPES.RESTORE_F2_SNAPSHOT: {
            // Overwrite state.f2 with the values from the snapshot,
            // keeping any existing f2 properties that aren't in the snapshot (like lastSyncedSubtotal)
            return { ...state, f2: { ...state.f2, ...action.payload } };
        }

        default:
            return state;
    }
}