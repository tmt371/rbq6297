/* FILE: 04-core-code/ui/views/f3-quote-prep-view.js */

import { EVENTS, DOM_IDS } from '../../config/constants.js';
import * as quoteActions from '../../actions/quote-actions.js';
import { formatDateYMD } from '../../utils/format-utils.js';

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the F3 (Quote Prep) tab.
 */
export class F3QuotePrepView {
    // [DIRECTIVE-v3.27] Added `workflowService` injection for Service-Layer Tollbooth.
    // [MODIFIED] Added `calculationService` to match current architectural needs.
    constructor({ panelElement, eventAggregator, stateService, quotePersistenceService, workflowService, calculationService, authService }) {
        this.panelElement = panelElement;
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.quotePersistenceService = quotePersistenceService;
        this.workflowService = workflowService;
        this.calculationService = calculationService; // [NEW] Injected Service
        this.authService = authService; // [NEW] (v3.45)
        this.userOverrodeDueDate = false;

        this.boundHandlers = [];
        this.subscriptions = []; // [NEW] EventAggregator registry
        this.focusOrder = [
            'quoteId', 'issueDate', 'dueDate',
            'customerFirstName', 'customerLastName',
            'customerAddress', 'customerPhone', 'customerEmail',
            'customerPostcode',
            'generalNotes', 'termsConditions',
        ];

        this._cacheF3Elements();
        // [MOVED] Initialization of listeners is now dynamically managed in activate()
        this._initF3DefaultValues(); // [NEW] (DIRECTIVE-v3.39)
        console.log('F3QuotePrepView Initialized (v3.35 Clean Logic - Header Fix).');
    }

    /**
     * [MODIFIED] Handles specific input changes and syncs to calculation service
     */
    handleInputChange(event) {
        const { value } = event.target;
        // Check if stateService and calculationService exist before calling
        if (this.stateService) {
            const currentState = this.stateService.getState();
            this.stateService.dispatch({ ...currentState, inputValue: value });
        }
        
        if (this.calculationService && typeof this.calculationService.updateGrandTotal === 'function') {
            this.calculationService.updateGrandTotal(value);
        }

        // Also update the global display helper
        if (typeof setTotalSum === 'function') {
            setTotalSum(value);
        }
    }

    _addListener(element, event, handler) {
        if (!element) return;
        const boundHandler = handler.bind(this);
        this.boundHandlers.push({ element, event, handler: boundHandler });
        element.addEventListener(event, boundHandler);
    }

    deactivate() {
        console.log(`[Lifecycle] Cleaning up listeners for ${this.constructor.name}...`);
        this.boundHandlers.forEach(({ element, event, handler }) => {
            if (element) {
                element.removeEventListener(event, handler);
            }
        });
        this.boundHandlers = [];

        // [NEW] Unsubscribe global events
        if (this.subscriptions && this.subscriptions.length > 0) {
            this.subscriptions.forEach(sub => {
                if (sub && typeof sub.dispose === 'function') sub.dispose();
            });
            this.subscriptions = [];
        }
    }

    destroy() {
        this.deactivate();
        console.log("F3QuotePrepView destroyed.");
    }

    _parseDateFromYMD(dateString) {
        if (!dateString) return null;
        try {
            const parts = dateString.split('-');
            if (parts.length === 3) {
                return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
            }
            return new Date(dateString);
        } catch (e) {
            return null;
        }
    }

    _cacheF3Elements() {
        const query = (id) => this.panelElement.querySelector(id);
        this.f3 = {
            inputs: {
                quoteId: query('#f3-quote-id'),
                issueDate: query('#f3-issue-date'),
                dueDate: query('#f3-due-date'),
                customerFirstName: query('#f3-customer-firstname'),
                customerLastName: query('#f3-customer-lastname'),
                customerAddress: query('#f3-customer-address'),
                customerPhone: query('#f3-customer-phone'),
                customerEmail: query('#f3-customer-email'),
                customerPostcode: query('#f3-customer-postcode'),
                generalNotes: query('#f3-general-notes'),
                termsConditions: query('#f3-terms-conditions'),
            },
            buttons: {
                addQuote: query(`#${DOM_IDS.BTN_ADD_QUOTE}`),
                btnGth: query(`#${DOM_IDS.BTN_GTH}`),
                addInvoice: query(`#${DOM_IDS.BTN_ADD_INVOICE}`),
                addReceipt: query(`#${DOM_IDS.BTN_ADD_RECEIPT}`),
                addOverdue: query(`#${DOM_IDS.BTN_ADD_OVERDUE}`),
            },
        };
    }

    _initializeF3Listeners() {
        if (!this.f3.inputs.issueDate) return;

        const addStateUpdateListener = (inputElement, actionCreator) => {
            if (inputElement) {
                this._addListener(inputElement, 'change', (event) => {
                    this.stateService.dispatch(
                        actionCreator(event.target.value)
                    );
                });
            }
        };

        const addCustomerUpdateListener = (inputElement, key) => {
            if (inputElement) {
                this._addListener(inputElement, 'change', (event) => {
                    this.stateService.dispatch(
                        quoteActions.updateCustomerProperty(
                            key,
                            event.target.value
                        )
                    );
                });
            }
        };

        addStateUpdateListener(this.f3.inputs.quoteId, (value) =>
            quoteActions.updateQuoteProperty('quoteId', value)
        );
        addStateUpdateListener(this.f3.inputs.generalNotes, (value) =>
            quoteActions.updateQuoteProperty('generalNotes', value)
        );
        addStateUpdateListener(this.f3.inputs.termsConditions, (value) =>
            quoteActions.updateQuoteProperty('termsConditions', value)
        );

        const handleNameChange = () => {
            const firstName = this.f3.inputs.customerFirstName.value.trim();
            const lastName = this.f3.inputs.customerLastName.value.trim();
            const fullName = `${firstName} ${lastName}`.trim();
            this.stateService.dispatch(quoteActions.updateCustomerProperty('name', fullName));
        };

        if (this.f3.inputs.customerFirstName) {
            this._addListener(this.f3.inputs.customerFirstName, 'change', (event) => {
                this.stateService.dispatch(quoteActions.updateCustomerProperty('firstName', event.target.value));
                handleNameChange();
            });
        }

        if (this.f3.inputs.customerLastName) {
            this._addListener(this.f3.inputs.customerLastName, 'change', (event) => {
                this.stateService.dispatch(quoteActions.updateCustomerProperty('lastName', event.target.value));
                handleNameChange();
            });
        }

        addCustomerUpdateListener(this.f3.inputs.customerAddress, 'address');
        addCustomerUpdateListener(this.f3.inputs.customerPhone, 'phone');
        addCustomerUpdateListener(this.f3.inputs.customerEmail, 'email');
        addCustomerUpdateListener(this.f3.inputs.customerPostcode, 'postcode');

        if (this.f3.inputs.dueDate) {
            this._addListener(this.f3.inputs.dueDate, 'input', () => {
                this.userOverrodeDueDate = true;
            });
            addStateUpdateListener(this.f3.inputs.dueDate, (value) =>
                quoteActions.updateQuoteProperty('dueDate', value)
            );
        }

        this._addListener(this.f3.inputs.issueDate, 'input', (event) => {
            const issueDateValue = event.target.value;
            this.stateService.dispatch(
                quoteActions.updateQuoteProperty('issueDate', issueDateValue)
            );
            this.userOverrodeDueDate = false;
            if (issueDateValue) {
                const issueDate = this._parseDateFromYMD(issueDateValue);
                if (!issueDate) return;
                const dueDateObj = new Date(issueDate);
                dueDateObj.setDate(dueDateObj.getDate() + 14);
                const dayOfWeek = dueDateObj.getDay();
                if (dayOfWeek === 6) {
                    dueDateObj.setDate(dueDateObj.getDate() + 2);
                } else if (dayOfWeek === 0) {
                    dueDateObj.setDate(dueDateObj.getDate() + 1);
                }
                const dueDateString = formatDateYMD(dueDateObj);
                this.f3.inputs.dueDate.value = dueDateString;
                this.stateService.dispatch(
                    quoteActions.updateQuoteProperty('dueDate', dueDateString)
                );
            }
        });

        // --- DIRECT MAPPING FOR PDF TRIGGERS (Phase I.3) ---
        // This bypasses the old 'Smart Route' logic to ensure the header matches the button clicked.

        if (this.f3.buttons.addQuote) {
            this._addListener(this.f3.buttons.addQuote, 'click', () => {
                const { quoteData } = this.stateService.getState();
                if (!this.workflowService.validateQuoteStateForAction(quoteData)) return;
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_PRINTABLE_QUOTE);
            });
        }

        if (this.f3.buttons.btnGth) {
            this._addListener(this.f3.buttons.btnGth, 'click', () => {
                const { quoteData } = this.stateService.getState();
                if (!this.workflowService.validateQuoteStateForAction(quoteData)) return;
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_GMAIL_QUOTE);
            });
        }
        
        if (this.f3.buttons.addInvoice) {
            this._addListener(this.f3.buttons.addInvoice, 'click', () => {
                const { quoteData } = this.stateService.getState();
                if (!this.workflowService.validateQuoteStateForAction(quoteData)) return;
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_PRINTABLE_INVOICE);
            });
        }

        if (this.f3.buttons.addOverdue) {
            this._addListener(this.f3.buttons.addOverdue, 'click', () => {
                const { quoteData } = this.stateService.getState();
                if (!this.workflowService.validateQuoteStateForAction(quoteData)) return;
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_PRINTABLE_OVERDUE);
            });
        }

        if (this.f3.buttons.addReceipt) {
            this._addListener(this.f3.buttons.addReceipt, 'click', () => {
                const { quoteData } = this.stateService.getState();
                if (!this.workflowService.validateQuoteStateForAction(quoteData)) return;
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_PRINTABLE_RECEIPT);
            });
        }

        this.focusOrder.forEach((key, index) => {
            const currentElement = this.f3.inputs[key];
            if (currentElement) {
                this._addListener(currentElement, 'keydown', (event) => {
                    if (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) {
                        if (event.key === 'Tab' && currentElement.tagName === 'TEXTAREA') return;
                        event.preventDefault();
                        event.stopPropagation();
                        const nextIndex = index + 1;
                        if (nextIndex < this.focusOrder.length) {
                            const nextKey = this.focusOrder[nextIndex];
                            this.f3.inputs[nextKey]?.focus();
                        } else {
                            this.f3.buttons.addQuote?.focus();
                        }
                    }
                });
            }
        });
    }

    render(state) {
        if (!this.f3.inputs.quoteId || !state) return;

        const { quoteData } = state;
        const { customer } = quoteData;

        const updateInput = (input, newValue) => {
            const value = newValue || '';
            if (input && input.value !== value && document.activeElement !== input) {
                input.value = value;
            }
        };

        let quoteId = quoteData.quoteId;
        let issueDateStr = quoteData.issueDate;
        let dueDateStr = quoteData.dueDate;
        let issueDateObj;

        if (!quoteId || quoteId.length < 14) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            quoteId = `RB${year}${month}${day}${hours}${minutes}`;
            this.stateService.dispatch(quoteActions.updateQuoteProperty('quoteId', quoteId));
        }

        if (!issueDateStr) {
            issueDateObj = new Date();
            issueDateStr = formatDateYMD(issueDateObj);
            this.stateService.dispatch(quoteActions.updateQuoteProperty('issueDate', issueDateStr));
        } else {
            issueDateObj = this._parseDateFromYMD(issueDateStr);
        }

        if (!dueDateStr || !this.userOverrodeDueDate) {
            const dueDateObj = new Date(issueDateObj);
            dueDateObj.setDate(dueDateObj.getDate() + 14);
            const dayOfWeek = dueDateObj.getDay();
            if (dayOfWeek === 6) {
                dueDateObj.setDate(dueDateObj.getDate() + 2);
            } else if (dayOfWeek === 0) {
                dueDateObj.setDate(dueDateObj.getDate() + 1);
            }
            const dueDateString = formatDateYMD(dueDateObj);
            if (!this.userOverrodeDueDate) {
                this.stateService.dispatch(quoteActions.updateQuoteProperty('dueDate', dueDateString));
            }
            dueDateStr = dueDateString;
        }

        updateInput(this.f3.inputs.quoteId, quoteId);
        updateInput(this.f3.inputs.issueDate, issueDateStr);
        updateInput(this.f3.inputs.dueDate, dueDateStr);
        updateInput(this.f3.inputs.customerFirstName, customer.firstName);
        updateInput(this.f3.inputs.customerLastName, customer.lastName);
        updateInput(this.f3.inputs.customerAddress, customer.address);
        updateInput(this.f3.inputs.customerPhone, customer.phone);
        updateInput(this.f3.inputs.customerEmail, customer.email);
        updateInput(this.f3.inputs.customerPostcode, customer.postcode);
        updateInput(this.f3.inputs.generalNotes, quoteData.generalNotes);
        updateInput(this.f3.inputs.termsConditions, quoteData.termsConditions);

        this._updateButtonStates(quoteData.status);
    }

    activate() {
        // [NEW] (Deactivate Pattern) Dynamically re-bind all listeners upon activation
        this._initializeF3Listeners();

        const state = this.stateService.getState();
        this.render(state);
    }

    _initF3DefaultValues() {
        const defaultValue = 
`1. To confirm your custom order, a 50% non-refundable deposit is required. The balance is payable on or before the installation date.
2. As all products are tailor-made for your space, we are unable to accept cancellations or offer refunds for a change of mind.
3. Ownership of the goods will transfer to you upon full payment of the invoice.
4. For any overdue payments, detailed terms regarding debt recovery procedures and associated costs can be found at: https://about:blank`;

        const currentState = this.stateService.getState();
        this.eventAggregator.publish(EVENTS.STATE_CHANGED, currentState);
        
        // Ensure textarea cached during _cacheF3Elements is updated if it exists
        if (this.f3.inputs.termsConditions) {
            this.f3.inputs.termsConditions.value = defaultValue;
        }
    }

    _updateButtonStates(status) {
        // [FIX] (v3.45) Safety block for potential TypeError if authService context is lost
        const isAdmin = (this.authService && typeof this.authService.isAdmin === 'function') 
            ? this.authService.isAdmin() 
            : false;
            
        let canQuote = false, canGth = false, canInvoice = false, canReceipt = false, canOverdue = false;

        // [MODIFIED] (v3.43 God Mode) If Admin, bypass status gating entirely.
        if (isAdmin) {
            canQuote = true;
            canGth = true;
            canInvoice = true;
            canReceipt = true;
            canOverdue = true;
        } else if (status) {
            // [FAIL-SAFE] Strict status-based gating (v3.40 logic)
            if (status.includes('A. Saved')) { canQuote = true; canGth = true; }
            else if (status.includes('B. Quoted')) { canQuote = true; canGth = true; canInvoice = true; }
            else if (status.includes('K. Overdue')) { canOverdue = true; canReceipt = true; }
            else if (status.includes('L. Closed')) { canReceipt = true; }
            else if (status.includes('Y. On Hold') || status.includes('X. Cancelled')) { /* All false */ }
            else { canInvoice = true; canReceipt = true; }
        }
        
        this._applyButtonStates(canQuote, canGth, canInvoice, canReceipt, canOverdue);
    }

    _applyButtonStates(quote, gth, invoice, receipt, overdue) {
        const b = this.f3.buttons;
        if (b.addQuote)  b.addQuote.disabled  = !quote;
        if (b.btnGth)    b.btnGth.disabled     = !gth;
        if (b.addInvoice) b.addInvoice.disabled = !invoice;
        if (b.addReceipt) b.addReceipt.disabled = !receipt;
        if (b.addOverdue) b.addOverdue.disabled = !overdue;
    }
}

/**
 * [NEW] v3.35 Alignment - UI Update Helper
 * Standard definition to prevent "undefined" errors.
 */
function setTotalSum(value) {
    const totalSumElement = document.getElementById('total-sum-value');
    if (totalSumElement) {
        totalSumElement.textContent = value || '';
    }
}
