/* FILE: 04-core-code/services/workflow-service.js */
// [MODIFIED] (v6297 ?жш║л) чз╗щЩдф║Жц?ф╣Ех??Пш╝п
// [FIX] (v6297 ?жш║л) ф┐оцнгф║?handleFileLoad х┤йц╜░?пшкд
// [FIX] (v6297 ?жш║л) ф┐Эч?ф║?fileService ф╛Эш│┤я╝Мх???handleFileLoad ф╗Нщ?ф╜┐чФихоГуА?
// [MODIFIED] (Correction Flow Phase 2) Added handleCancelCorrectRequest.
// [MODIFIED] (Correction Flow Phase 4) Implemented _handleCancelOrderFlow with input dialog.
// [FIX] (Correction Flow Fix) Added setTimeout to _handleCancelOrderFlow to prevent dialog conflict.
// [MODIFIED] (v6299 Phase 4) Removed handleGenerateExcel (moved to QuotePersistenceService).
// [MODIFIED] (v6299 Phase 4) Removed excelExportService injection.

import { initialState } from '../config/initial-state.js';
import { EVENTS, DOM_IDS } from '../config/constants.js';
import * as uiActions from '../actions/ui-actions.js';
import * as quoteActions from '../actions/quote-actions.js';
import { paths } from '../config/paths.js';
// [MODIFIED] чз╗щЩдф║?saveQuoteToCloud
import {
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
        fileService, // [MODIFIED] (v6297 ?жш║л) ?╢ц?ф┐оцнгя╝Ъф???fileService
        calculationService,
        productFactory,
        detailConfigView,
        quoteGeneratorService,
        authService, // [NEW] (v6297) Inject authService
        // excelExportService // [REMOVED] (v6299 Phase 4) Moved to QuotePersistenceService
    }) {
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.fileService = fileService; // [MODIFIED] (v6297 ?жш║л) ?╢ц?ф┐оцнгя╝Ъф???fileService
        this.calculationService = calculationService;
        this.productFactory = productFactory;
        this.detailConfigView = detailConfigView;
        this.quoteGeneratorService = quoteGeneratorService; // [NEW] Store the injected service
        this.authService = authService; // [NEW] (v6297) Store authService
        // this.excelExportService = excelExportService; // [REMOVED] (v6299 Phase 4)
        this.quotePreviewComponent = null; // Will be set by AppContext

        console.log('WorkflowService Initialized.');
    }

    setQuotePreviewComponent(component) {
        this.quotePreviewComponent = component;
    }

    // [REMOVED] (v6299 Phase 4) handleGenerateExcel has been moved to QuotePersistenceService

    // [NEW] ?Оцо╡ 1: х╗║ч?х╖ехЦоц╡Бч?
    async handleGenerateWorkOrder() {
        try {
            const { quoteData, ui } = this.stateService.getState();

            // 1. (?Юх?цн? шлЛц? quoteGeneratorService ?вч? HTML
            // цндщ?цо╡я??Щц?чв║ф?ш╝ЙхЕецибцЭ┐
            const finalHtml =
                await this.quoteGeneratorService.generateWorkOrderHtml(
                    quoteData,
                    ui
                );

            if (finalHtml) {
                // 2. (?Мцне) ?Лх??░х???
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

    // [REMOVED] (v6297 ?жш║л) _getQuoteDataWithSnapshots has been moved to quote-persistence-service.js

    // [REMOVED] (v6297 ?жш║л) handleSaveToFile has been moved to quote-persistence-service.js

    // [REMOVED] (v6297 ?жш║л) handleSaveAsNewVersion has been moved to quote-persistence-service.js

    // [REMOVED] (v6297 ?жш║л) handleExportCSV has been moved to quote-persistence-service.js

    // [MODIFIED v6285 Phase 5] Logic migrated from quick-quote-view.js and updated.
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

    // [FIX] (v6297 ?жш║л) 
    // This is the function that crashed.
    // It is now clean and only contains the correct logic.
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

    // [NEW] (Correction Flow Phase 2) Handles the Cancel/Correct button click
    handleCancelCorrectRequest() {
        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: 'Please select an action for this active order:',
            gridTemplateColumns: '1fr 1fr', // Set 2 columns layout
            layout: [
                [
                    {
                        type: 'button',
                        text: 'A. Cancel Order',
                        className: 'secondary',
                        callback: () => {
                            // [MODIFIED] (Correction Flow Phase 4) Call actual cancel flow
                            this._handleCancelOrderFlow();
                            return true; // Close dialog
                        }
                    },
                    {
                        type: 'button',
                        text: 'B. Correct Data',
                        className: 'primary-confirm-button',
                        callback: () => {
                            // Enter Correction Mode
                            this.stateService.dispatch(uiActions.setCorrectionMode(true));
                            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                                message: 'Correction Mode Enabled. Edit data and click SET to finalize changes.',
                                type: 'info'
                            });
                            return true; // Close dialog
                        }
                    }
                ],
                [
                    {
                        type: 'button',
                        text: 'Exit',
                        className: 'secondary',
                        colspan: 2,
                        callback: () => { return true; }
                    }
                ]
            ]
        });
    }

    // [NEW] (Correction Flow Phase 4) Implemented Cancel logic with delay fix
    _handleCancelOrderFlow() {
        // [FIX] Use setTimeout to ensure the previous dialog is fully closed and DOM is cleared
        // before attempting to open the new confirmation dialog.
        setTimeout(() => {
            this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
                message: 'Are you sure you want to CANCEL this order? This action is irreversible.',
                layout: [
                    [
                        { type: 'text', text: 'Reason:', className: 'dialog-label' },
                        { type: 'input', id: DOM_IDS.DIALOG_INPUT_CANCEL_REASON, placeholder: 'e.g., Customer changed mind' }
                    ],
                    [
                        {
                            type: 'button',
                            text: 'Confirm Cancellation',
                            className: 'primary-confirm-button btn-danger', // Use danger style if available, else default
                            colspan: 2,
                            callback: () => {
                                const reasonInput = document.getElementById(DOM_IDS.DIALOG_INPUT_CANCEL_REASON);
                                const reason = reasonInput ? reasonInput.value.trim() : '';

                                if (!reason) {
                                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                                        message: 'Cancellation reason is required.',
                                        type: 'error'
                                    });
                                    return false; // Keep dialog open
                                }

                                // Trigger the actual cancellation logic in QuotePersistenceService
                                this.eventAggregator.publish(EVENTS.USER_REQUESTED_EXECUTE_CANCELLATION, { cancelReason: reason });
                                return true;
                            }
                        },
                        { type: 'button', text: 'Back', className: 'secondary', colspan: 2, callback: () => { return true; } }
                    ]
                ],
                onOpen: () => {
                    // Focus the input field when dialog opens
                    setTimeout(() => {
                        const input = document.getElementById(DOM_IDS.DIALOG_INPUT_CANCEL_REASON);
                        if (input) input.focus();
                    }, 50);
                }
            });
        }, 100); // 100ms delay should be sufficient
    }
}