// File: 04-core-code/ui/views/drive-accessories-view.js
// [MODIFIED] (Phase 3.4c) Batch Override, Global UI Lock, Smart Reset

import { EVENTS } from '../../config/constants.js';
import * as uiActions from '../../actions/ui-actions.js';
import * as quoteActions from '../../actions/quote-actions.js';

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the Drive/Accessories tab.
 */
export class DriveAccessoriesView {
    // [MODIFIED] (Phase 3.4c) Added k3TabComponent injection for batch UI toggling
    constructor({ stateService, eventAggregator, k3TabComponent }) {
        this.stateService = stateService;
        this.eventAggregator = eventAggregator;
        this.k3TabComponent = k3TabComponent;

        // [NEW] (Phase 3.4c) Batch state
        this.activeBatchMode = null; // 'winder' or 'motor' when in batch mode
        this.k3Snapshot = null;      // Deep copy of items array for rollback

        console.log("DriveAccessoriesView Initialized.");
    }

    _getState() {
        return this.stateService.getState();
    }

    _getItems() {
        const { quoteData } = this._getState();
        return quoteData.products[quoteData.currentProduct].items;
    }

    _getCurrentProductType() {
        const { quoteData } = this._getState();
        return quoteData.currentProduct;
    }

    _setDriveView() {
        this.stateService.dispatch(uiActions.setVisibleColumns(['sequence', 'fabricTypeDisplay', 'location', 'winder', 'motor']));
    }

    _setHardwareView() {
        this.stateService.dispatch(uiActions.setVisibleColumns(['sequence', 'fabricTypeDisplay', 'location', 'dual', 'chain']));
    }

    activate() {
        this._setDriveView();
    }

    // [MODIFIED] (Phase 3.4b) Cleaned up: only Winder and Motor modes
    async handleModeChange({ mode }) {
        this._setDriveView();
        const { ui } = this._getState();
        const currentMode = ui.driveAccessoryMode;
        const newMode = currentMode === mode ? null : mode;

        await this.stateService.dispatch(uiActions.setDriveAccessoryMode(newMode));

        if (newMode) {
            const message = this._getHintMessage(newMode);
            await this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message });
        }
    }

    async handleTableCellClick({ rowIndex, column }) {
        // [MODIFIED] (Phase 3.4c) Batch mode bypasses confirmation dialogs
        if (this.activeBatchMode) {
            await this._batchOverrideCell(rowIndex, column);
            return;
        }

        const { ui } = this._getState();
        const { driveAccessoryMode, dualChainMode } = ui;

        // --- [NEW] K5 Dual/Chain handling ---
        if (column === 'dual' && dualChainMode === 'dual') {
            const items = this._getItems();
            if (rowIndex === items.length - 1) return; // isLastRow
            const item = items[rowIndex];
            if (!item) return;

            const newValue = item.dual === 'D' ? '' : 'D';
            this.stateService.dispatch(quoteActions.updateItemProperty(rowIndex, 'dual', newValue));
            this.stateService.dispatch(uiActions.setF1DualDistribution(null, null));
            return;
        }

        if (column === 'chain' && dualChainMode === 'chain') {
            const items = this._getItems();
            if (rowIndex === items.length - 1) return; // isLastRow
            const item = items[rowIndex];
            if (!item) return;

            this.stateService.dispatch(uiActions.setTargetCell({ rowIndex, column: 'chain' }));
            setTimeout(() => {
                const inputBox = document.getElementById('k5-input-display');
                if (inputBox) {
                    inputBox.focus();
                    inputBox.select();
                }
            }, 50);
            return;
        }
        // --- End K5 Dual/Chain ---

        if (!driveAccessoryMode || (column !== 'winder' && column !== 'motor')) return;

        const item = this._getItems()[rowIndex];
        if (!item) return;

        const isActivatingWinder = driveAccessoryMode === 'winder' && column === 'winder';
        const isActivatingMotor = driveAccessoryMode === 'motor' && column === 'motor';

        if (isActivatingWinder) {
            if (item.motor) {
                await this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
                    message: 'This blind is set to Motor. Are you sure you want to change it to HD Winder?',
                    layout: [
                        [
                            { type: 'button', text: 'Confirm', callback: () => this._toggleWinder(rowIndex, true) },
                            { type: 'button', text: 'Cancel', className: 'secondary', callback: () => { } }
                        ]
                    ]
                });
            } else {
                await this._toggleWinder(rowIndex, false);
            }
        } else if (isActivatingMotor) {
            if (item.winder) {
                await this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
                    message: 'This blind is set to HD Winder. Are you sure you want to change it to Motor?',
                    layout: [
                        [
                            { type: 'button', text: 'Confirm', callback: () => this._toggleMotor(rowIndex, true) },
                            { type: 'button', text: 'Cancel', className: 'secondary', callback: () => { } }
                        ]
                    ]
                });
            } else {
                await this._toggleMotor(rowIndex, false);
            }
        }
    }

    // [MODIFIED] (Phase 3.4b) Smart zero-warning interception
    async handleCounterChange({ accessory, direction, value }) {
        this._setDriveView();
        const { ui } = this._getState();
        const counts = {
            remote: ui.driveRemoteCount,
            charger: ui.driveChargerCount,
            cord: ui.driveCordCount
        };
        let currentCount = counts[accessory];

        let newCount;
        if (direction === 'set') {
            newCount = Math.max(0, value ?? 0);
        } else {
            newCount = direction === 'add' ? currentCount + 1 : Math.max(0, currentCount - 1);
        }

        // Zero-warning interception for Remote and Charger
        if (newCount === 0 && (accessory === 'remote' || accessory === 'charger')) {
            const items = this._getItems();
            const totalMotors = items.filter(item => !!item.motor).length;
            if (totalMotors > 0) {
                const accessoryName = accessory === 'remote' ? 'Remote' : 'Charger';
                await this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
                    message: `This order has ${totalMotors} motor(s) configured. Are you sure you want to set ${accessoryName} quantity to 0?`,
                    layout: [
                        [
                            {
                                type: 'button', text: 'Confirm (Set to 0)', callback: () => {
                                    this.stateService.dispatch(uiActions.setDriveAccessoryCount(accessory, 0));
                                }
                            },
                            {
                                type: 'button', text: 'Cancel', className: 'secondary', callback: () => {
                                    this.stateService.dispatch(uiActions.setDriveAccessoryCount(accessory, 1));
                                }
                            }
                        ]
                    ]
                });
                return;
            }
        }

        await this.stateService.dispatch(uiActions.setDriveAccessoryCount(accessory, newCount));
    }

    async _toggleWinder(rowIndex) {
        const item = this._getItems()[rowIndex];
        const newValue = item.winder ? '' : 'HD';
        await this.stateService.dispatch(quoteActions.updateWinderMotorProperty(rowIndex, 'winder', newValue));
    }

    // [MODIFIED] (Phase 3.4b + 3.4c) Auto-fill on motor add, Smart Reset on last motor removal
    async _toggleMotor(rowIndex) {
        const item = this._getItems()[rowIndex];
        const isAddingMotor = !item.motor;
        const newValue = isAddingMotor ? 'Motor' : '';
        await this.stateService.dispatch(quoteActions.updateWinderMotorProperty(rowIndex, 'motor', newValue));

        const { ui } = this._getState();
        const items = this._getItems();
        const totalMotors = items.filter(i => !!i.motor).length;

        if (isAddingMotor) {
            // Auto-fill: set Remote/Charger to 1 if they are 0 when motor added
            if (totalMotors > 0) {
                if ((ui.driveRemoteCount ?? 0) === 0) {
                    await this.stateService.dispatch(uiActions.setDriveAccessoryCount('remote', 1));
                }
                if ((ui.driveChargerCount ?? 0) === 0) {
                    await this.stateService.dispatch(uiActions.setDriveAccessoryCount('charger', 1));
                }
            }
        } else {
            // [NEW] (Phase 3.4c) Smart Reset: when last motor removed, auto-zero Remote/Charger
            if (totalMotors === 0) {
                if ((ui.driveRemoteCount ?? 0) > 0) {
                    await this.stateService.dispatch(uiActions.setDriveAccessoryCount('remote', 0));
                }
                if ((ui.driveChargerCount ?? 0) > 0) {
                    await this.stateService.dispatch(uiActions.setDriveAccessoryCount('charger', 0));
                }
            }
        }
    }

    // ====================================================================
    // [NEW] (Phase 3.4c) BATCH OVERRIDE SYSTEM
    // ====================================================================

    /**
     * Starts batch mode: snapshots current items, switches UI to Confirm/Cancel.
     * During batch mode, table cell clicks bypass confirmation dialogs.
     */
    async startBatchMode({ type }) {
        this._setDriveView();
        // 1. Snapshot: deep copy all items for rollback
        const items = this._getItems();
        this.k3Snapshot = JSON.parse(JSON.stringify(items));

        // 2. Set active batch mode
        this.activeBatchMode = type; // 'winder' or 'motor'

        // 3. Toggle UI: hide Batch button, show Confirm/Cancel
        if (this.k3TabComponent) {
            this.k3TabComponent.setBatchUIState(type, true);
        }

        // 4. Show notification
        const label = type === 'winder' ? 'Winder (HD)' : 'Motor';
        await this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: `Batch ${label} mode active. Click any cell in the ${type} column to toggle. Press ✔ to confirm or ✘ to cancel.`
        });

        console.log(`[K3 Batch] Started batch mode: ${type}. Snapshot saved (${items.length} items).`);
    }

    /**
     * Batch override: directly toggles the cell without confirmation dialogs.
     */
    async _batchOverrideCell(rowIndex, column) {
        const batchType = this.activeBatchMode;

        // Only allow clicks on the matching column
        if (column !== batchType) return;

        const item = this._getItems()[rowIndex];
        if (!item) return;

        if (batchType === 'winder') {
            // Force set to HD, clear motor if present (no confirmation)
            const newValue = item.winder ? '' : 'HD';
            if (item.motor && newValue === 'HD') {
                // Clear motor first, then set winder
                await this.stateService.dispatch(quoteActions.updateWinderMotorProperty(rowIndex, 'motor', ''));
            }
            await this.stateService.dispatch(quoteActions.updateWinderMotorProperty(rowIndex, 'winder', newValue));
        } else if (batchType === 'motor') {
            // Force set to Motor, clear winder if present (no confirmation)
            const newValue = item.motor ? '' : 'Motor';
            if (item.winder && newValue === 'Motor') {
                // Clear winder first, then set motor
                await this.stateService.dispatch(quoteActions.updateWinderMotorProperty(rowIndex, 'winder', ''));
            }
            await this.stateService.dispatch(quoteActions.updateWinderMotorProperty(rowIndex, 'motor', newValue));
        }
    }

    /**
     * Confirms batch: clears snapshot, resets UI, runs auto-fill/smart-reset.
     */
    async confirmBatch({ type }) {
        console.log(`[K3 Batch] Confirmed batch: ${type}. Snapshot cleared.`);

        // Clear batch state
        this.activeBatchMode = null;
        this.k3Snapshot = null;

        // Reset UI
        if (this.k3TabComponent) {
            this.k3TabComponent.setBatchUIState(type, false);
        }

        // Run auto-fill / smart reset based on final motor count
        const { ui } = this._getState();
        const items = this._getItems();
        const totalMotors = items.filter(i => !!i.motor).length;

        if (totalMotors > 0) {
            // Auto-fill Remote/Charger if they are 0
            if ((ui.driveRemoteCount ?? 0) === 0) {
                await this.stateService.dispatch(uiActions.setDriveAccessoryCount('remote', 1));
            }
            if ((ui.driveChargerCount ?? 0) === 0) {
                await this.stateService.dispatch(uiActions.setDriveAccessoryCount('charger', 1));
            }
        } else {
            // Smart Reset: no motors → zero out Remote/Charger
            if ((ui.driveRemoteCount ?? 0) > 0) {
                await this.stateService.dispatch(uiActions.setDriveAccessoryCount('remote', 0));
            }
            if ((ui.driveChargerCount ?? 0) > 0) {
                await this.stateService.dispatch(uiActions.setDriveAccessoryCount('charger', 0));
            }
        }

        await this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: `Batch ${type} confirmed. Accessory counts updated.`
        });
    }

    /**
     * Cancels batch: restores items from snapshot (full undo), resets UI.
     */
    async cancelBatch({ type }) {
        console.log(`[K3 Batch] Cancelled batch: ${type}. Restoring snapshot...`);

        if (this.k3Snapshot) {
            // Restore each item's winder/motor from snapshot
            const items = this._getItems();
            for (let i = 0; i < items.length; i++) {
                const snapshotItem = this.k3Snapshot[i];
                if (!snapshotItem) continue;

                const currentItem = items[i];
                // Only restore winder/motor fields that changed
                if (currentItem.winder !== snapshotItem.winder) {
                    await this.stateService.dispatch(
                        quoteActions.updateWinderMotorProperty(i, 'winder', snapshotItem.winder || '')
                    );
                }
                if (currentItem.motor !== snapshotItem.motor) {
                    await this.stateService.dispatch(
                        quoteActions.updateWinderMotorProperty(i, 'motor', snapshotItem.motor || '')
                    );
                }
            }
        }

        // Clear batch state
        this.activeBatchMode = null;
        this.k3Snapshot = null;

        // Reset UI
        if (this.k3TabComponent) {
            this.k3TabComponent.setBatchUIState(type, false);
        }

        await this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: `Batch ${type} cancelled. All changes have been reverted.`
        });
    }

    _getHintMessage(mode) {
        const hints = {
            winder: 'Click a cell under the Winder column to set HD.',
            motor: 'Click a cell under the Motor column to set Motor.',
            remote: 'Enter the quantity of remotes in the input field below.',
            charger: 'Enter the quantity of chargers in the input field below.',
            cord: 'Enter the quantity of extension cords in the input field below.'
        };
        return hints[mode] || 'Please make your selection.';
    }
    // ====================================================================
    // [NEW] K5 (Hardware) Logic Migrated from DualChainView
    // ====================================================================

    async handleDualChainModeChange({ mode }) {
        this._setHardwareView();
        const { ui } = this._getState();
        const currentMode = ui.dualChainMode;
        const newMode = currentMode === mode ? null : mode;

        if (currentMode === 'dual') {
            const isValid = this._validateDualSelection();
            if (!isValid) return;
        }

        await this.stateService.dispatch(uiActions.setDualChainMode(newMode));

        if (!newMode) {
            await this.stateService.dispatch(uiActions.setTargetCell(null));
            await this.stateService.dispatch(uiActions.clearDualChainInputValue());
        }
    }

    _validateDualSelection() {
        const items = this._getItems();
        const selectedIndexes = items.reduce((acc, item, index) => {
            if (item.dual === 'D') acc.push(index);
            return acc;
        }, []);
        const dualCount = selectedIndexes.length;

        if (dualCount > 0 && dualCount % 2 !== 0) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'The total count of Dual Brackets (D) must be an even number. Please correct the selection.',
                type: 'error'
            });
            return false;
        }

        for (let i = 0; i < dualCount; i += 2) {
            if (selectedIndexes[i + 1] !== selectedIndexes[i] + 1) {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: 'Dual blinds must be paired adjacently.',
                    type: 'error'
                });
                return false;
            }
        }
        return true;
    }

    async handleChainEnterPressed({ value }) {
        const { ui } = this._getState();
        const { targetCell: currentTarget } = ui;
        if (!currentTarget) return;

        const valueAsNumber = Number(value);
        if (value !== '' && (!Number.isInteger(valueAsNumber) || valueAsNumber <= 0)) {
            await this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Only positive integers are allowed.',
                type: 'error'
            });
            return;
        }

        const valueToSave = value === '' ? null : valueAsNumber;
        await this.stateService.dispatch(quoteActions.updateItemProperty(currentTarget.rowIndex, currentTarget.column, valueToSave));

        await this.stateService.dispatch(uiActions.setDualChainMode(null));
        await this.stateService.dispatch(uiActions.setTargetCell(null));
        await this.stateService.dispatch(uiActions.clearDualChainInputValue());
    }
}