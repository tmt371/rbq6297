/* FILE: 04-core-code/ui/views/fabric-config-view.js */
// [MODIFIED] (Stage 9 Phase 3 - Constants) Replaced magic strings with FABRIC_CODES and LOGIC_CODES.

import { EVENTS, DOM_IDS } from '../../config/constants.js';
import * as uiActions from '../../actions/ui-actions.js';
import * as quoteActions from '../../actions/quote-actions.js';
import { FABRIC_CODES, LOGIC_CODES } from '../../config/business-constants.js'; // [NEW]
import { FabricNCDialog } from './dialogs/fabric-nc-dialog.js';
import { FabricLFDialog } from './dialogs/fabric-lf-dialog.js';
import { FabricSSetDialog } from './dialogs/fabric-sset-dialog.js';

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the Fabric configuration.
 */
export class FabricConfigView {
    constructor({ stateService, eventAggregator }) {
        this.stateService = stateService;
        this.eventAggregator = eventAggregator;

        this.indexesToExcludeFromBatchUpdate = new Set();

        // [NEW] (Phase 15.2) Array to store subscriptions for clean teardown
        this.eventSubscriptions = [];

        const deps = {
            stateService: this.stateService,
            eventAggregator: this.eventAggregator,
            getItemsFunc: () => this._getItems(),
            getStateFunc: () => this._getState(),
            exitAllK2ModesFunc: () => this._exitAllK2Modes()
        };
        this.ncDialog = new FabricNCDialog(deps);
        this.lfDialog = new FabricLFDialog(deps);
        this.ssetDialog = new FabricSSetDialog(deps);

        this.eventSubscriptions.push(this.eventAggregator.subscribe(EVENTS.USER_REQUESTED_NC_DIALOG, () => this.ncDialog.handleNCDialogRequest()));
        this.eventSubscriptions.push(this.eventAggregator.subscribe(EVENTS.USER_REQUESTED_LF_DIALOG, () => this.lfDialog.show()));
        this.eventSubscriptions.push(this.eventAggregator.subscribe(EVENTS.USER_REQUESTED_SSET_DIALOG, () => this.ssetDialog.show()));

        console.log("FabricConfigView Initialized.");
    }

    /**
     * [NEW] Phase 15.2: Teardown method to prevent memory leaks from ghost subscriptions.
     */
    destroy() {
        if (this.eventSubscriptions && this.eventSubscriptions.length > 0) {
            this.eventSubscriptions.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') unsubscribe();
            });
            this.eventSubscriptions = [];
        }
    }

    _getState() {
        return this.stateService.getState();
    }

    _getItems() {
        const { quoteData } = this._getState();
        return quoteData.products[quoteData.currentProduct].items;
    }

    async handleFocusModeRequest() {
        await this._exitAllK2Modes();
    }

    async handleSequenceCellClick({ rowIndex }) {
        const { activeEditMode } = this._getState().ui;
        const item = this._getItems()[rowIndex];
        if (!item || (item.width === null && item.height === null)) return;

        // [MODIFIED] Use constants for mode checks
        if (activeEditMode === LOGIC_CODES.MODE_LF_DEL) {
            const { lfModifiedRowIndexes } = this._getState().quoteData.uiMetadata;
            if (!lfModifiedRowIndexes.includes(rowIndex)) {
                await this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Only items with a Light-Filter setting (pink background) can be selected for deletion.', type: 'error' });
                return;
            }
            await this.stateService.dispatch(uiActions.toggleLFSelection(rowIndex));

        } else if (activeEditMode === LOGIC_CODES.MODE_LF || activeEditMode === LOGIC_CODES.MODE_SSET) {
            await this.stateService.dispatch(uiActions.toggleMultiSelectSelection(rowIndex));
        }
    }

    async handleModeToggle({ mode }) {
        // [NEW] (Phase 3.5a-Fix) Switch to Fabric View columns when any K2 mode is activated
        this.stateService.dispatch(uiActions.setVisibleColumns(['sequence', 'fabricTypeDisplay', 'fabric', 'color']));

        // [MODIFIED] Compare against constant values (which match the button ID parts or event data)
        if (mode === LOGIC_CODES.MODE_LF) {
            await this._handleLFModeToggle();
        } else if (mode === LOGIC_CODES.MODE_LF_DEL) {
            await this._handleLFDModeToggle();
        } else if (mode === LOGIC_CODES.MODE_SSET) {
            await this._handleSSetModeToggle();
        }
    }

    async _handleLFModeToggle() {
        const { activeEditMode } = this._getState().ui;

        // [MODIFIED] Use constant
        if (activeEditMode === LOGIC_CODES.MODE_LF) {
            const { multiSelectSelectedIndexes } = this._getState().ui;

            if (multiSelectSelectedIndexes.length === 0) {
                await this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'LF mode cancelled. No items selected.' });
                await this._exitAllK2Modes();
                return;
            }

            this.lfDialog.show();

        } else {
            const items = this._getItems();
            // [MODIFIED] Use FABRIC_CODES constants
            const eligibleTypes = [FABRIC_CODES.B2, FABRIC_CODES.B3, FABRIC_CODES.B4];
            const hasEligibleItems = items.some(item =>
                item.width && item.height && eligibleTypes.includes(item.fabricType)
            );

            if (!hasEligibleItems) {
                await this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'LF is only applicable for B2, B3, and B4 items.' });
                return;
            }

            await this._exitAllK2Modes();
            // [MODIFIED] Dispatch constant value
            await this.stateService.dispatch(uiActions.setActiveEditMode(LOGIC_CODES.MODE_LF));
            await this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Please select items from the main table.' });
        }
    }

    _handleLFDModeToggle() {
        const { activeEditMode } = this._getState().ui;

        // [MODIFIED] Use constant
        if (activeEditMode === LOGIC_CODES.MODE_LF_DEL) {
            const { lfSelectedRowIndexes } = this._getState().ui;
            if (lfSelectedRowIndexes.length > 0) {
                this.stateService.dispatch(quoteActions.removeLFProperties(lfSelectedRowIndexes));
                this.stateService.dispatch(quoteActions.removeLFModifiedRows(lfSelectedRowIndexes));
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Light-Filter settings have been cleared.' });
            }
            this._exitAllK2Modes();
        } else {
            this._exitAllK2Modes();
            // [MODIFIED] Dispatch constant value
            this.stateService.dispatch(uiActions.setActiveEditMode(LOGIC_CODES.MODE_LF_DEL));
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Please select the roller blinds for which you want to cancel the Light-Filter fabric setting. After selection, click the LF-Del button again.' });
        }
    }

    _handleSSetModeToggle() {
        const { activeEditMode } = this._getState().ui;

        // [MODIFIED] Use constant
        if (activeEditMode === LOGIC_CODES.MODE_SSET) {
            const { multiSelectSelectedIndexes } = this._getState().ui;

            if (multiSelectSelectedIndexes.length === 0) {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'SSet mode cancelled. No items selected.' });
                this._exitAllK2Modes();
                return;
            }

            this.ssetDialog.show();

        } else {
            this._exitAllK2Modes();
            // [MODIFIED] Dispatch constant value
            this.stateService.dispatch(uiActions.setActiveEditMode(LOGIC_CODES.MODE_SSET));
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Please select items from the main table.' });
        }
    }

    async _exitAllK2Modes() {
        await this.stateService.dispatch(uiActions.setActiveEditMode(null));
        await this.stateService.dispatch(uiActions.clearMultiSelectSelection());
        await this.stateService.dispatch(uiActions.clearLFSelection());
        this.indexesToExcludeFromBatchUpdate.clear();
        this._updatePanelInputsState();
    }

    _updatePanelInputsState() {
        // (Original content removed as it depended on fabricBatchTable which is gone)
        // This method is now effectively a no-op or cleanup.
    }

    activate() {
        // [MODIFIED] (Phase 3.5a-Fix) Removed setVisibleColumns — column switching is now
        // handled dynamically by button clicks (handleModeToggle / handleNCDialogRequest).
        // This prevents Fabric columns from overriding Location columns on K1 tab activation.
        this._exitAllK2Modes();
    }
}