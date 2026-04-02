/* FILE: 04-core-code/services/workflow-service.js */

import { initialState } from '../config/initial-state.js';
import { EVENTS, DOM_IDS } from '../config/constants.js';
import * as uiActions from '../actions/ui-actions.js';
import * as quoteActions from '../actions/quote-actions.js';
import { paths } from '../config/paths.js';
import {
    loadQuoteFromCloud,
    searchQuotesAdvanced, 
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
        authService, 
        quotePersistenceService 
    }) {
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.fileService = fileService; 
        this.calculationService = calculationService;
        this.productFactory = productFactory;
        this.detailConfigView = detailConfigView;
        this.quoteGeneratorService = quoteGeneratorService; 
        this.authService = authService; 
        this.quotePersistenceService = quotePersistenceService; 
        this.quotePreviewComponent = null; 

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

    // [NEW] 方案 B: 使用隱藏 Iframe 進行背景下載
    async handleGenerateWorkOrder(isSilent = false) {
        try {
            const { quoteData, ui } = this.stateService.getState();

            const finalHtml =
                await this.quoteGeneratorService.generateWorkOrderHtml(
                    quoteData,
                    ui
                );

            if (finalHtml) {
                if (isSilent) {
                    // [NEW] Phase II.6b: Silent Download Strategy (Plan B)
                    this._downloadPdfSilently(finalHtml);
                } else {
                    // [MODIFIED] Phase II.6d: Modern Blob URL Preview Strategy
                    // Resolves parser-blocking warnings and "View Page Source" issues.
                    const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                }
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

    // [NEW] Phase II.6b: 安裝工單處理程序
    async handleGenerateInstallationWorksheet(isSilent = false) {
        try {
            const { quoteData } = this.stateService.getState();
            const currentProductKey = quoteData.currentProduct;

            const finalHtml = await this.quoteGeneratorService.generateInstallationWorksheetHtml(
                quoteData,
                currentProductKey
            );

            if (finalHtml) {
                if (isSilent) {
                    // [NEW] Phase II.6b: Silent Download Strategy (Plan B)
                    this._downloadPdfSilently(finalHtml);
                } else {
                    // [MODIFIED] Phase II.6d: Modern Blob URL Preview Strategy
                    // Resolves parser-blocking warnings and "View Page Source" issues.
                    const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                }
            } else {
                throw new Error('QuoteGeneratorService did not return Installation Worksheet HTML.');
            }
        } catch (error) {
            console.error('Error generating installation worksheet:', error);
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Failed to generate installation worksheet.',
                type: 'error',
            });
        }
    }

    // [NEW] Phase II.6c: 一鍵雙開 (工廠 + 安裝) - 靜默後台下載模式
    async handleGenerateBothWorksheets() {
        // [FIX] Using silent downloader via iframes to bypass popup blockers
        await this.handleGenerateWorkOrder(true);
        await this.handleGenerateInstallationWorksheet(true);
    }

    async handlePrintableQuoteRequest(documentType = 'Quotation', receiptData = null) {
        try {
            const { quoteData, ui } = this.stateService.getState();
            
            let liveLedger = null;
            if (this.quotePersistenceService && quoteData.quoteId) {
                liveLedger = await this.quotePersistenceService.getLiveLedger(quoteData.quoteId);
            }

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
            const { quoteData, ui } = this.stateService.getState();

            const finalHtml =
                await this.quoteGeneratorService.generateGmailQuoteHtml(
                    quoteData,
                    ui,
                    quoteData
                );

            if (finalHtml) {
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

    handleF1TabActivation() {
        const { quoteData } = this.stateService.getState();
        const productStrategy =
            this.productFactory.getProductStrategy(quoteData.currentProduct);

        if (!productStrategy) {
            console.warn("⚠️ [WorkflowService] No strategy found, skipping F1 activation.");
            return;
        }

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
            this._dispatchLoadActions(result.data, result.message);
        } else {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: result.message,
                type: 'error',
            });
        }
    }

    handleSearchDialogRequest() {
        this.eventAggregator.publish(EVENTS.SHOW_SEARCH_DIALOG);
    }

    _dispatchLoadActions(data, message) {
        this.stateService.dispatch(quoteActions.setQuoteData(data));
        this.stateService.dispatch(uiActions.resetUi());

        if (data.f1Snapshot) {
            this.stateService.dispatch(
                uiActions.restoreF1Snapshot(data.f1Snapshot)
            );
        }

        if (data.f2Snapshot) {
            this.stateService.dispatch(
                uiActions.restoreF2Snapshot(data.f2Snapshot)
            );
        }

        this.stateService.dispatch(uiActions.setSumOutdated(true));
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: message,
        });
    }

    handleFileLoad({ fileName, content }) {
        const result = this.fileService.parseFileContent(fileName, content);
        if (result.success) {
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
            gridTemplateColumns: '1fr 1fr', 
            layout: [
                [
                    {
                        type: 'button',
                        text: 'A. Cancel Order',
                        className: 'secondary',
                        callback: () => {
                            this._handleCancelOrderFlow();
                            return true; 
                        }
                    },
                    {
                        type: 'button',
                        text: 'B. Correct Data',
                        className: 'primary-confirm-button',
                        callback: () => {
                            this.stateService.dispatch(uiActions.setCorrectionMode(true));
                            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                                message: 'Correction Mode Enabled. Edit data and click SET to finalize changes.',
                                type: 'info'
                            });
                            return true; 
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
        setTimeout(() => {
            this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
                message: 'Are you sure you want to CANCEL this order? This action is irreversible.',
                layout: [
                    [
                        { type: 'text', text: 'Reason:', className: 'dialog-label' },
                        { type: 'input', id: DOM_IDS.DIALOG_INPUT_CANCEL_REASON, placeholder: 'e.g., Customer changed mind', autofocus: true }
                    ],
                    [
                        {
                            type: 'button',
                            text: 'Confirm Cancellation',
                            className: 'primary-confirm-button btn-danger', 
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
                                    return false; 
                                }

                                this.eventAggregator.publish(EVENTS.USER_REQUESTED_EXECUTE_CANCELLATION, { cancelReason: reason });
                                return true;
                            }
                        },
                        { type: 'button', text: 'Back', className: 'secondary', colspan: 2, callback: () => { return true; } }
                    ]
                ]
            });
        }, 100); 
    }

    /**
     * [DIRECTIVE-v3.52] Silent Background Downloader (Plan B - Syntax-Safe Edition)
     * Renders HTML in a hidden off-screen iframe and triggers its download button from the parent.
     * This avoids buggy script character injection and bypasses popup blockers.
     * @param {string} htmlString - The complete HTML content of the document.
     * @private
     */
    _downloadPdfSilently(htmlString) {
        if (!htmlString) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.top = '-9999px';
        iframe.style.width = '210mm';
        iframe.style.height = '297mm';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        const idoc = iframe.contentWindow.document;
        idoc.open();
        idoc.write(htmlString);
        idoc.close();

        // Wait for the iframe to render and PDF scripts to initialize
        setTimeout(() => {
            try {
                const btn = idoc.querySelector('#btn-download-pdf') || idoc.querySelector('button');
                if (btn) {
                    btn.click();
                }
            } catch (err) {
                console.error('Silent download trigger failed:', err);
            }
            
            // Cleanup the memory after the download triggers
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 8000);
        }, 1500);
    }
}
