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
    }) {
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.fileService = fileService;
        this.calculationService = calculationService;
        this.productFactory = productFactory;
        this.detailConfigView = detailConfigView;
        this.quoteGeneratorService = quoteGeneratorService;
        this.authService = authService;
        this.quotePreviewComponent = null;

        console.log('WorkflowService Initialized.');
    }

    setQuotePreviewComponent(component) {
        this.quotePreviewComponent = component;
    }

    async handleGenerateWorkOrder() {
        try {
            const { quoteData, ui } = this.stateService.getState();

            const finalHtml =
                await this.quoteGeneratorService.generateWorkOrderHtml(
                    quoteData,
                    ui
                );

            if (finalHtml) {
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
            const { quoteData, ui } = this.stateService.getState();

            const finalHtml =
                await this.quoteGeneratorService.generateQuoteHtml(
                    quoteData,
                    ui,
                    quoteData
                );

            if (finalHtml) {
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

    handleF1TabActivation() {
        const { quoteData } = this.stateService.getState();
        const productStrategy =
            this.productFactory.getProductStrategy(quoteData.currentProduct);
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
                        { type: 'input', id: DOM_IDS.DIALOG_INPUT_CANCEL_REASON, placeholder: 'e.g., Customer changed mind' }
                    ],
                    [
                        {
                            type: 'button',
                            text: 'Confirm Cancellation',
                            className: 'primary-confirm-button btn-danger',
                            colspan: 2,
                            callback: () => {
                                const reasonInput = document.getElementById(DOM_IDS.DIALOG_INPUT_CANCEL_REASON);
                                const reason = reasonInput ? reasonInput.value.trim() : '';

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
                ],
                onOpen: () => {
                    setTimeout(() => {
                        const input = document.getElementById(DOM_IDS.DIALOG_INPUT_CANCEL_REASON);
                        if (input) input.focus();
                    }, 50);
                }
            });
        }, 100);
    }
}