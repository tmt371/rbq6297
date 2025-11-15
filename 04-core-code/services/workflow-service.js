/* FILE: 04-core-code/services/workflow-service.js */
// [MODIFIED] (階段 1) Added handleGenerateWorkOrder function.

import { initialState } from '../config/initial-state.js';
import { EVENTS, DOM_IDS } from '../config/constants.js';
import * as uiActions from '../actions/ui-actions.js';
import * as quoteActions from '../actions/quote-actions.js';
import { paths } from '../config/paths.js';
// [NEW] Import the new online storage service functions
import {
    saveQuoteToCloud,
    loadQuoteFromCloud,
    searchQuotesAdvanced, // [MODIFIED] (v6298-F4-Search) Import new function
} from './online-storage-service.js';

/**
 * @fileoverview A dedicated service for coordinating complex, multi-step user workflows.
 * This service takes complex procedural logic out of the AppController.
 */
export class WorkflowService {
    constructor({
        eventAggregator,
        stateService,
        fileService,
        calculationService,
        productFactory,
        detailConfigView,
        quoteGeneratorService,
        authService, // [NEW] (v6297) Inject authService
    }) {
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.fileService = fileService;
        this.calculationService = calculationService;
        this.productFactory = productFactory;
        this.detailConfigView = detailConfigView;
        this.quoteGeneratorService = quoteGeneratorService; // [NEW] Store the injected service
        this.authService = authService; // [NEW] (v6297) Store authService
        this.quotePreviewComponent = null; // Will be set by AppContext

        console.log('WorkflowService Initialized.');
    }

    setQuotePreviewComponent(component) {
        this.quotePreviewComponent = component;
    }

    // [NEW] 階段 1: 建立工單的工作流程
    async handleGenerateWorkOrder() {
        try {
            const { quoteData, ui } = this.stateService.getState();

            // 1. (動作) 呼叫 quoteGeneratorService 產生 HTML
            // 在此階段，此函式只會回傳基礎模板
            const finalHtml =
                await this.quoteGeneratorService.generateWorkOrderHtml(
                    quoteData,
                    ui
                );

            if (finalHtml) {
                // 2. (動作) 在新視窗中開啟
                const blob = new Blob([finalHtml], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            } else {
                throw new Error(
                    'QuoteGeneratorService did not return Work Order HTML. Templates might not be loaded.'
                );
            }
        } catch (error) {
            console.error('Error generating work order:', error);
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message:
                    'Failed to generate work order. See console for details.',
                type: 'error',
            });
        }
    }

    async handlePrintableQuoteRequest() {
        try {
            // [MODIFIED] Get state. f3Data (from DOM) is no longer needed.
            const { quoteData, ui } = this.stateService.getState();

            // [REFACTORED] Delegate the entire HTML generation process to the new service.
            // [MODIFIED] Pass the live quoteData object as the f3Data parameter.
            // [FIX] Added 'await' to resolve the Promise returned by the async function.
            const finalHtml =
                await this.quoteGeneratorService.generateQuoteHtml(
                    quoteData,
                    ui,
                    quoteData
                );

            if (finalHtml) {
                // [MODIFIED] Phase 2: Replace the old iframe event with the new window.open mechanism.
                // this.eventAggregator.publish(EVENTS.SHOW_QUOTE_PREVIEW, finalHtml);

                const blob = new Blob([finalHtml], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            } else {
                throw new Error(
                    'QuoteGeneratorService did not return HTML. Templates might not be loaded.'
                );
            }
        } catch (error) {
            console.error('Error generating printable quote:', error);
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message:
                    'Failed to generate quote preview. See console for details.',
                type: 'error',
            });
        }
    }

    // [NEW] (Phase 4, Step 2)
    async handleGmailQuoteRequest() {
        try {
            // [MODIFIED] Get state. f3Data (from DOM) is no longer needed.
            const { quoteData, ui } = this.stateService.getState();

            // Call the new service method for the GTH template
            // [MODIFIED] Pass the live quoteData object as the f3Data parameter.
            // [FIX] Added 'await' to resolve the Promise returned by the async function.
            const finalHtml =
                await this.quoteGeneratorService.generateGmailQuoteHtml(
                    quoteData,
                    ui,
                    quoteData
                );

            if (finalHtml) {
                // Open the generated HTML in a new tab
                const blob = new Blob([finalHtml], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            } else {
                throw new Error(
                    'QuoteGeneratorService did not return GTH HTML. Templates might not be loaded.'
                );
            }
        } catch (error) {
            console.error('Error generating GTH quote:', error);
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message:
                    'Failed to generate GTH preview. See console for details.',
                type: 'error',
            });
        }
    }

    // [REMOVED] _getF3OverrideData is no longer needed. State is the single source of truth.
    // _getF3OverrideData() { ... }

    // [REMOVED] Methods handleRemoteDistribution and handleDualDistribution have been moved to F1CostView.

    handleF1TabActivation() {
        const { quoteData } = this.stateService.getState();
        const productStrategy =
            this.productFactory.getProductStrategy(quoteData.currentProduct);
        const { updatedQuoteData } =
            this.calculationService.calculateAndSum(quoteData, productStrategy);

        this.stateService.dispatch(quoteActions.setQuoteData(updatedQuoteData));
    }

    // [REMOVED] All F2-related methods have been moved to F2SummaryView.

    handleNavigationToDetailView() {
        const { ui } = this.stateService.getState();
        if (ui.currentView === 'QUICK_QUOTE') {
            this.stateService.dispatch(
                uiActions.setCurrentView('DETAIL_CONFIG')
            );
            this.detailConfigView.activateTab('k1-tab');
        } else {
            this.stateService.dispatch(uiActions.setCurrentView('QUICK_QUOTE'));
            this.stateService.dispatch(
                uiActions.setVisibleColumns(initialState.ui.visibleColumns)
            );
        }
    }

    handleNavigationToQuickQuoteView() {
        this.stateService.dispatch(uiActions.setCurrentView('QUICK_QUOTE'));
        this.stateService.dispatch(
            uiActions.setVisibleColumns(initialState.ui.visibleColumns)
        );
    }

    handleTabSwitch({ tabId }) {
        this.detailConfigView.activateTab(tabId);
    }

    // [MODIFIED v6285 Phase 5] Helper function now captures ALL F1 and F3 state.
    // [MODIFIED v6292] F3 state is now read directly from quoteData state.
    // [MODIFIED v6295] Capture F1 Wifi Qty and all of F2 state.
    // [MODIFIED] (v6297) Capture ownerUid.
    _getQuoteDataWithSnapshots() {
        const { quoteData, ui } = this.stateService.getState();
        // Create a deep copy to avoid mutating the original state
        let dataWithSnapshot = JSON.parse(JSON.stringify(quoteData));

        // --- [NEW] (v6297) 0. Capture Owner UID ---
        // [FIX] Check for authService AND authService.currentUser
        if (this.authService && this.authService.currentUser) {
            dataWithSnapshot.ownerUid = this.authService.currentUser.uid;
        } else {
            console.error("WorkflowService: Cannot save. AuthService is missing or user is not logged in.");
            // We still proceed, but the ownerUid will be null.
            // Our Firestore rules (which we will update later) will block this.
        }

        // --- [NEW] (v6298-F4-Search) 1. Calculate and Capture Metadata ---
        const items = quoteData.products[quoteData.currentProduct].items;
        const hasMotor = items.some(item => !!item.motor);

        // Ensure metadata object exists (it was just added to initialState)
        if (!dataWithSnapshot.metadata) {
            dataWithSnapshot.metadata = {};
        }
        dataWithSnapshot.metadata.hasMotor = hasMotor;


        // --- 2. Capture F1 Snapshot (from Phase 4) ---
        if (dataWithSnapshot.f1Snapshot) {
            // const items =
            //     quoteData.products[quoteData.currentProduct].items;

            dataWithSnapshot.f1Snapshot.winder_qty = items.filter(
                (item) => item.winder === 'HD'
            ).length;
            dataWithSnapshot.f1Snapshot.motor_qty = items.filter(
                (item) => !!item.motor
            ).length;
            dataWithSnapshot.f1Snapshot.charger_qty =
                ui.driveChargerCount || 0;
            dataWithSnapshot.f1Snapshot.cord_qty = ui.driveCordCount || 0;

            const totalRemoteQty = ui.driveRemoteCount || 0;
            const remote1chQty = ui.f1.remote_1ch_qty;
            const remote16chQty =
                ui.f1.remote_1ch_qty === null
                    ? totalRemoteQty - remote1chQty
                    : ui.f1.remote_16ch_qty;

            const totalDualPairs = Math.floor(
                items.filter((item) => item.dual === 'D').length / 2
            );
            const comboQty =
                ui.f1.dual_combo_qty === null
                    ? totalDualPairs
                    : ui.f1.dual_combo_qty;
            const slimQty =
                ui.f1.dual_slim_qty === null ? 0 : ui.f1.dual_slim_qty;
            dataWithSnapshot.f1Snapshot.remote_1ch_qty = remote1chQty;
            dataWithSnapshot.f1Snapshot.remote_16ch_qty = remote16chQty;
            dataWithSnapshot.f1Snapshot.dual_combo_qty = comboQty;
            dataWithSnapshot.f1Snapshot.dual_slim_qty = slimQty;
            dataWithSnapshot.f1Snapshot.discountPercentage =
                ui.f1.discountPercentage;

            // [NEW] (v6295) Fix omission: Save F1 Wifi Qty
            dataWithSnapshot.f1Snapshot.wifi_qty = ui.f1.wifi_qty || 0;
        } else {
            console.error(
                'f1Snapshot object is missing from quoteData. Cannot save F1 state.'
            );
        }

        // --- 3. Capture F3 Snapshot (NEW Phase 5) ---
        // [REMOVED] No longer need to read from DOM. All data (quoteId, issueDate, customer, notes)
        // is already present in the `dataWithSnapshot` object because F3 view updates state live.
        // const getValue = (id) => document.getElementById(id)?.value || '';
        // dataWithSnapshot.quoteId = getValue('f3-quote-id');
        // ... (all other getValue calls removed)

        // --- 4. [NEW] (v6295) Capture F2 Snapshot ---
        // Save the entire F2 state object
        dataWithSnapshot.f2Snapshot = JSON.parse(JSON.stringify(ui.f2));

        // --- 5. [MODIFIED] (Tweak C) This line is intentionally *REMOVED* as per user request to separate "features" from "foundations"
        // dataWithSnapshot.creationDate = new Date().toISOString();

        return dataWithSnapshot;
    }

    // [MODIFIED v6285 Phase 5] Logic migrated from quick-quote-view.js and updated.
    // [MODIFIED] (v6298-fix-6) Added try...catch for robust cloud save.
    async handleSaveToFile() {
        const dataToSave = this._getQuoteDataWithSnapshots();

        // --- [NEW] (v6298-fix-6) Robust Firebase Save ---
        // We wrap the cloud save in a try...catch block.
        // If it fails (e.g., Ad Blocker, no permissions, no internet),
        // we log the error but *do not* stop the function.
        // This ensures the local save will *always* be attempted.
        try {
            await saveQuoteToCloud(dataToSave);
        } catch (error) {
            // saveQuoteToCloud already logs its own friendly error
            console.error("WorkflowService: Cloud save failed, but proceeding to local save.", error);
        }
        // --- [END NEW] ---

        const result = this.fileService.saveToJson(dataToSave);
        const notificationType = result.success ? 'info' : 'error';
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: result.message,
            type: notificationType,
        });
    }

    // [NEW] (Tweak A) Logic for "Save as New Version"
    async handleSaveAsNewVersion() {
        // 1. Get the current data, with all snapshots
        // [MODIFIED] Tweak C (Foundation) is *NOT* included here yet.
        const dataToSave = this._getQuoteDataWithSnapshots();

        // 2. Generate the new versioned quoteId
        const currentId = dataToSave.quoteId || `RB${new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14)}`;

        // Regex to find a version suffix like "-v2"
        const versionRegex = /-v(\d+)$/;
        const match = currentId.match(versionRegex);

        let newQuoteId;
        if (match) {
            // If it has a version (e.g., "-v2"), increment it
            const currentVersion = parseInt(match[1], 10);
            const newVersion = currentVersion + 1;
            // Replace the old suffix with the new one
            newQuoteId = currentId.replace(versionRegex, `-v${newVersion}`);
        } else {
            // If it has no version, add "-v2" (Start with v2, as v1 is the original)
            newQuoteId = `${currentId}-v2`;
        }

        // 3. Update the data object with the new ID
        dataToSave.quoteId = newQuoteId;

        // 4. Save to both cloud (new document) and local (new file)
        let cloudSaveSuccess = false;
        try {
            await saveQuoteToCloud(dataToSave);
            cloudSaveSuccess = true;
        } catch (error) {
            console.error("WorkflowService: Cloud save (new version) failed, but proceeding to local save.", error);
        }

        const localSaveResult = this.fileService.saveToJson(dataToSave);

        // 5. Dispatch to update the app's state to this new version
        this.stateService.dispatch(quoteActions.setQuoteData(dataToSave));

        // 6. Notify user
        const message = cloudSaveSuccess
            ? `New version saved as: ${newQuoteId}`
            : `New version saved locally. Cloud save failed.`;

        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: message,
            type: localSaveResult.success ? 'info' : 'error',
        });
    }

    // [MODIFIED v6285 Phase 5] Logic migrated from quick-quote-view.js and updated.
    handleExportCSV() {
        const dataToExport = this._getQuoteDataWithSnapshots();
        const result = this.fileService.exportToCsv(dataToExport);
        const notificationType = result.success ? 'info' : 'error';
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: result.message,
            type: notificationType,
        });
    }

    // [NEW & MOVED] Logic migrated from quick-quote-view.js.
    handleReset() {
        if (window.confirm('This will clear all data. Are you sure?')) {
            this.stateService.dispatch(quoteActions.resetQuoteData());
            this.stateService.dispatch(uiActions.resetUi());
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Quote has been reset.',
            });
        }
    }

    handleUserRequestedLoad() {
        const { quoteData } = this.stateService.getState();
        const productKey = quoteData.currentProduct;
        const items = quoteData.products[productKey]
            ? quoteData.products[productKey].items
            : [];
        const hasData =
            items.length > 1 ||
            (items.length === 1 && (items[0].width || items[0].height));
        if (hasData) {
            this.eventAggregator.publish(
                EVENTS.SHOW_LOAD_CONFIRMATION_DIALOG
            );
        } else {
            this.eventAggregator.publish(EVENTS.TRIGGER_FILE_LOAD);
        }
    }

    handleLoadDirectly() {
        this.eventAggregator.publish(EVENTS.TRIGGER_FILE_LOAD);
    }

    // [MODIFIED] (v6298) Refactored to be a simple loader.
    async handleLoadFromCloud(quoteId) {
        if (!quoteId || quoteId.trim() === '') {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Invalid Quote ID.',
                type: 'error',
            });
            return;
        }

        const result = await loadQuoteFromCloud(quoteId.trim());

        if (result.success) {
            // Use the exact same logic as local file load
            this._dispatchLoadActions(result.data, result.message);
        } else {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: result.message,
                type: 'error',
            });
        }
    }

    // [NEW] (v6298) Handles the new search dialog workflow
    // [MODIFIED] (v6298-F4-Search) This function now dispatches the NEW event.
    handleSearchDialogRequest() {
        // [OLD]
        // this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, { ... });
        // [NEW]
        this.eventAggregator.publish(EVENTS.SHOW_SEARCH_DIALOG);
    }

    // [REMOVED] (v6298-F4-Search) This complex logic will be moved into the new SearchDialogComponent
    // async _executeSearch(customerName) { ... }

    // [REMOVED] (v6298-F4-Search) This complex logic will be moved into the new SearchDialogComponent
    // _showSearchResultsDialog(results, message) { ... }


    // [REFACTORED] Extracted file load logic into a private helper
    _dispatchLoadActions(data, message) {
        // 1. Set the new quote data
        this.stateService.dispatch(quoteActions.setQuoteData(data));

        // 2. Reset the UI state to match the new data
        this.stateService.dispatch(uiActions.resetUi());

        // 3. [MODIFIED v6285 Phase 4] Check for an f1Snapshot in the loaded data and restore it
        if (data.f1Snapshot) {
            this.stateService.dispatch(
                uiActions.restoreF1Snapshot(data.f1Snapshot)
            );
        }

        // 4. [NEW] (v6295) Check for an f2Snapshot and restore it
        if (data.f2Snapshot) {
            this.stateService.dispatch(
                uiActions.restoreF2Snapshot(data.f2Snapshot)
            );
        }

        // 5. Mark sum as outdated and notify user
        this.stateService.dispatch(uiActions.setSumOutdated(true));
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: message,
        });
    }

    handleFileLoad({ fileName, content }) {
        const result = this.fileService.parseFileContent(fileName, content);
        if (result.success) {
            // [MODIFIED] Use the new private helper
            this._dispatchLoadActions(result.data, result.message);
        } else {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: result.message,
                type: 'error',
            });
        }
    }

    handleF1DiscountChange({ percentage }) {
        this.stateService.dispatch(
            uiActions.setF1DiscountPercentage(percentage)
        );
    }
}