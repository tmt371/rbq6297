/* FILE: 04-core-code/ui/views/f3-quote-prep-view.js */

import { EVENTS, DOM_IDS } from '../../config/constants.js';
import * as quoteActions from '../../actions/quote-actions.js';

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the F3 (Quote Prep) tab.
 */
export class F3QuotePrepView {
    constructor({ panelElement, eventAggregator, stateService }) {
        this.panelElement = panelElement;
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.userOverrodeDueDate = false;

        this.boundHandlers = [];
        this.focusOrder = [
            'quoteId', 'issueDate', 'dueDate',
            'customerFirstName', 'customerLastName',
            'customerAddress', 'customerPhone', 'customerEmail',
            'customerPostcode',
            'generalNotes', 'termsConditions',
        ];

        this._cacheF3Elements();
        this._initializeF3Listeners();
        console.log('F3QuotePrepView Initialized.');
    }

    _addListener(element, event, handler) {
        if (!element) return;
        const boundHandler = handler.bind(this);
        this.boundHandlers.push({ element, event, handler: boundHandler });
        element.addEventListener(event, boundHandler);
    }

    destroy() {
        this.boundHandlers.forEach(({ element, event, handler }) => {
            if (element) {
                element.removeEventListener(event, handler);
            }
        });
        this.boundHandlers = [];
        console.log("F3QuotePrepView destroyed.");
    }

    _formatDateToYMD(date) {
        if (!date) return '';
        try {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return '';
        }
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

                const dueDateString = this._formatDateToYMD(dueDateObj);
                this.f3.inputs.dueDate.value = dueDateString;
                this.stateService.dispatch(
                    quoteActions.updateQuoteProperty('dueDate', dueDateString)
                );
            }
        });

        if (this.f3.buttons.addQuote) {
            this._addListener(this.f3.buttons.addQuote, 'click', () => {
                this.eventAggregator.publish(
                    EVENTS.USER_REQUESTED_PRINTABLE_QUOTE
                );
            });
        }

        if (this.f3.buttons.btnGth) {
            this._addListener(this.f3.buttons.btnGth, 'click', () => {
                this.eventAggregator.publish(
                    EVENTS.USER_REQUESTED_GMAIL_QUOTE
                );
            });
        }

        this.focusOrder.forEach((key, index) => {
            const currentElement = this.f3.inputs[key];
            if (currentElement) {
                this._addListener(currentElement, 'keydown', (event) => {
                    if (
                        event.key === 'Enter' ||
                        (event.key === 'Tab' && !event.shiftKey)
                    ) {
                        if (
                            event.key === 'Tab' &&
                            currentElement.tagName === 'TEXTAREA'
                        ) {
                            return;
                        }

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
            if (
                input &&
                input.value !== value &&
                document.activeElement !== input
            ) {
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
            this.stateService.dispatch(
                quoteActions.updateQuoteProperty('quoteId', quoteId)
            );
        }

        if (!issueDateStr) {
            issueDateObj = new Date();
            issueDateStr = this._formatDateToYMD(issueDateObj);
            this.stateService.dispatch(
                quoteActions.updateQuoteProperty('issueDate', issueDateStr)
            );
        } else {
            issueDateStr = this._formatDateToYMD(
                this._parseDateFromYMD(issueDateStr)
            );
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

            const dueDateString = this._formatDateToYMD(dueDateObj);

            if (!this.userOverrodeDueDate) {
                this.stateService.dispatch(
                    quoteActions.updateQuoteProperty('dueDate', dueDateString)
                );
            }
            dueDateStr = dueDateString;
        } else {
            dueDateStr = this._formatDateToYMD(
                this._parseDateFromYMD(dueDateStr)
            );
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
        updateInput(
            this.f3.inputs.termsConditions,
            quoteData.termsConditions
        );
    }

    activate() {
        const state = this.stateService.getState();
        this.render(state);
    }
}