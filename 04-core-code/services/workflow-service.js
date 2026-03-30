/* FILE: 04-core-code/services/workflow-service.js */

import { initialState } from '../config/initial-state.js';
import { EVENTS, DOM_IDS } from '../config/constants.js';
import * as uiActions from '../actions/ui-actions.js';
import * as quoteActions from '../actions/quote-actions.js';
import { paths } from '../config/paths.js';
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
        quotePersistenceService // [DIRECTIVE-v3.9] Inject
    }) {
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.fileService = fileService; // [MODIFIED] (v6297 ?жш║л) ?╢ц?ф┐оцнгя╝Ъф???fileService
        this.calculationService = calculationService;
        this.productFactory = productFactory;
        this.detailConfigView = detailConfigView;
        this.quoteGeneratorService = quoteGeneratorService; // [NEW] Store the injected service
        this.authService = authService; // [NEW] (v6297) Store authService
        this.quotePersistenceService = quotePersistenceService; // [DIRECTIVE-v3.9] Store
        this.quotePreviewComponent = null; // Will be set by AppContext

        console.log('WorkflowService Initialized.');
    }

    setQuotePreviewComponent(component) {
        this.quotePreviewComponent = component;
    }

    /**
     * [DIRECTIVE-v3.27] Service-Layer Tollbooth (migrated from F3QuotePrepView).
     * Validates that a quote has been saved (has a quoteId) before financial documents
     * are generated. Publishing from the Service layer ensures async delivery, which
     * matches the timing of the successful "Save Success" toast.
     * @param {object} quoteData - The current quoteData from state.
     * @returns {boolean} - `true` if valid, `false` if blocked.
     */
    validateQuoteStateForAction(quoteData) {
        if (!quoteData || !quoteData.quoteId) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                type: 'warning',
                message: 'Please click SAVE first to generate a Quote ID before printing documents.'
            });
            return false;
        }
        return true;
    }

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
                this.eventAggregator.publish(EVENTS.OPEN_DOCUMENT_WINDOW, { url });
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

    async handlePrintableQuoteRequest(documentType = 'Quotation', receiptData = null) {
        try {
            // [MODIFIED] Get state. f3Data (from DOM) is no longer needed.
            const { quoteData, ui } = this.stateService.getState();
            
            // [DIRECTIVE-v3.9] Fetch Live Ledger before generating payload
            let liveLedger = null;
            if (this.quotePersistenceService && quoteData.quoteId) {
                liveLedger = await this.quotePersistenceService.getLiveLedger(quoteData.quoteId);
            }

            // [REFACTORED] Delegate the entire HTML generation process to the new service.
            // [MODIFIED] Pass the live quoteData object as the f3Data parameter.
            // [FIX] Added 'await' to resolve the Promise returned by the async function.
            // [NEW] Passing liveLedger to map single source of truth financials
            const finalHtml =
                await this.quoteGeneratorService.generateQuoteHtml(
                    quoteData,
                    ui,
                    quoteData,
                    documentType,
                    receiptData,
                    liveLedger
                );

            if (finalHtml) {
                // this.eventAggregator.publish(EVENTS.SHOW_QUOTE_PREVIEW, finalHtml);

                const blob = new Blob([finalHtml], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                this.eventAggregator.publish(EVENTS.OPEN_DOCUMENT_WINDOW, { url });
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
                this.eventAggregator.publish(EVENTS.OPEN_DOCUMENT_WINDOW, { url });
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

    // [MODIFIED] Phase 9.0: Uses cached strategy from singleton factory
    handleF1TabActivation() {
        const { quoteData } = this.stateService.getState();
        const productStrategy =
            this.productFactory.getProductStrategy(quoteData.currentProduct);

        if (!productStrategy) {
            console.warn("⚠️ [WorkflowService] No strategy found, skipping F1 activation.");
            return;
        }

        // Strategy is now a singleton — no redundant re-initialization
        const { updatedQuoteData } =
            this.calculationService.calculateAndSum(quoteData, productStrategy);

        this.stateService.dispatch(quoteActions.setQuoteData(updatedQuoteData));
    }

    handleNavigationToDetailView() {
        const { ui } = this.stateService.getState();
        if (ui.currentView === 'QUICK_QUOTE') {
            this.stateService.dispatch(
                uiActions.setCurrentView('DETAIL_CONFIG')
            );

            if (ui.driveAccessoryMode !== null || ui.dualChainMode !== null) {
                this.detailConfigView.activateTab('k3-tab');
            } else if (ui.activeEditMode === 'K2') {
                this.detailConfigView.activateTab('k2-tab');
            } else if (ui.activeEditMode !== null) {
                this.detailConfigView.activateTab('k1-tab');
            } else {
                this.detailConfigView.activateTab(ui.activeTabId || 'k1-tab');
            }
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

    // [MODIFIED v6285 Phase 5] Logic migrated from quick-quote-view.js and updated.
    handleReset() {
        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: 'This will clear all data. Are you sure?',
            layout: [
                [
                    {
                        type: 'button',
                        text: 'Yes, Clear All Data',
                        className: 'primary-confirm-button btn-danger',
                        colspan: 1,
                        callback: () => {
                            this.stateService.dispatch(quoteActions.resetQuoteData());
                            this.stateService.dispatch(uiActions.resetUi());
                            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                                message: 'Quote has been reset.',
                            });
                            return true;
                        }
                    },
                    { type: 'button', text: 'Cancel', className: 'secondary', colspan: 1, callback: () => { return true; } }
                ]
            ]
        });
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

    handleSearchDialogRequest() {
        // [OLD]
        // this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, { ... });
        // [NEW]
        this.eventAggregator.publish(EVENTS.SHOW_SEARCH_DIALOG);
    }

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

    _handleCancelOrderFlow() {
        // [FIX] Use setTimeout to ensure the previous dialog is fully closed and DOM is cleared
        // before attempting to open the new confirmation dialog.
        setTimeout(() => {
            this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
                message: 'Are you sure you want to CANCEL this order? This action is irreversible.',
                layout: [
                    [
                        { type: 'text', text: 'Reason:', className: 'dialog-label' },
                        // [MODIFIED] Added autofocus property so DialogComponent handles it
                        { type: 'input', id: DOM_IDS.DIALOG_INPUT_CANCEL_REASON, placeholder: 'e.g., Customer changed mind', autofocus: true }
                    ],
                    [
                        {
                            type: 'button',
                            text: 'Confirm Cancellation',
                            className: 'primary-confirm-button btn-danger', // Use danger style if available, else default
                            colspan: 2,
                            callback: (inputValues) => {
                                const reason = inputValues && inputValues[DOM_IDS.DIALOG_INPUT_CANCEL_REASON]
                                    ? inputValues[DOM_IDS.DIALOG_INPUT_CANCEL_REASON].trim()
                                    : '';

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
                ]
            });
        }, 100); // 100ms delay should be sufficient
    }
}
