// File: 04-core-code/ui/search-dialog-component.js
// [NEW] (v6298-F4-Search) This new component manages the advanced search UI.

import { EVENTS, DOM_IDS } from '../config/constants.js';
// [NEW] (v6298-F4-Search) Import new advanced search function and state actions
import { searchQuotesAdvanced } from '../services/online-storage-service.js';
import * as uiActions from '../actions/ui-actions.js';
import * as quoteActions from '../actions/quote-actions.js';

export class SearchDialogComponent {
    constructor({ containerElement, eventAggregator, stateService, authService }) {
        if (!containerElement || !eventAggregator || !stateService || !authService) {
            throw new Error("SearchDialogComponent requires container, eventAggregator, stateService, and authService.");
        }

        this.container = containerElement;
        this.eventAggregator = eventAggregator;
        // [NEW] Store injected services
        this.stateService = stateService;
        this.authService = authService;

        this.box = this.container.querySelector('.search-dialog-box');
        this.selectedQuoteData = null; // Store data of the selected quote for loading

        // Cache all UI elements
        this.elements = {
            closeBtn: this.container.querySelector(`#${DOM_IDS.SEARCH_DIALOG_CLOSE_BTN}`),
            searchBtn: this.container.querySelector(`#${DOM_IDS.SEARCH_DIALOG_SEARCH_BTN}`),
            loadBtn: this.container.querySelector(`#${DOM_IDS.SEARCH_DIALOG_LOAD_BTN}`),
            // [NEW] Cache filter inputs
            filters: {
                name: this.container.querySelector(`#${DOM_IDS.SEARCH_FILTER_NAME}`),
                phone: this.container.querySelector(`#${DOM_IDS.SEARCH_FILTER_PHONE}`),
                email: this.container.querySelector(`#${DOM_IDS.SEARCH_FILTER_EMAIL}`),
                postcode: this.container.querySelector(`#${DOM_IDS.SEARCH_FILTER_POSTCODE}`),
                year: this.container.querySelector(`#${DOM_IDS.SEARCH_FILTER_YEAR}`),
                month: this.container.querySelector(`#${DOM_IDS.SEARCH_FILTER_MONTH}`),
                hasMotor: this.container.querySelector(`#${DOM_IDS.SEARCH_FILTER_HAS_MOTOR}`),
            },
            // [NEW] Cache dynamic areas
            resultsList: this.container.querySelector(`#${DOM_IDS.SEARCH_RESULTS_LIST}`),
            resultsMessage: this.container.querySelector(`#${DOM_IDS.SEARCH_RESULTS_MESSAGE}`),
            previewContent: this.container.querySelector(`#${DOM_IDS.SEARCH_PREVIEW_CONTENT}`),
            statusBar: this.container.querySelector(`#${DOM_IDS.SEARCH_STATUS_BAR}`),
        };

        // Store subscriptions and listeners for destruction
        this.subscriptions = [];
        this.boundListeners = new Map();

        this.initialize();
        console.log("SearchDialogComponent Initialized.");
    }

    /**
     * Helper to add and store event listeners for easy removal.
     */
    _addListener(element, event, handler) {
        if (!element) return;
        const boundHandler = handler.bind(this);
        this.boundListeners.set(handler, { element, event, boundHandler });
        element.addEventListener(event, boundHandler);
    }

    /**
     * Helper to subscribe to the event aggregator and store the reference.
     */
    _subscribe(eventName, handler) {
        const boundHandler = handler.bind(this);
        this.subscriptions.push({ eventName, handler: boundHandler });
        this.eventAggregator.subscribe(eventName, boundHandler);
    }

    /**
     * Destroys all event listeners and subscriptions.
     */
    destroy() {
        this.subscriptions.forEach(({ eventName, handler }) => {
            this.eventAggregator.unsubscribe(eventName, handler);
        });
        this.subscriptions = [];

        this.boundListeners.forEach(({ element, event, boundHandler }) => {
            if (element) {
                element.removeEventListener(event, boundHandler);
            }
        });
        this.boundListeners.clear();
        console.log("SearchDialogComponent destroyed.");
    }

    initialize() {
        // --- Subscribe to global events ---
        this._subscribe(EVENTS.SHOW_SEARCH_DIALOG, this.show);

        // --- Bind internal UI element events ---
        this._addListener(this.elements.closeBtn, 'click', this.hide);
        this._addListener(this.container, 'click', this._onOverlayClick);
        this._addListener(this.elements.searchBtn, 'click', this._onSearchClick);
        this._addListener(this.elements.loadBtn, 'click', this._onLoadClick);

        // [NEW] Add listener for the results list (event delegation)
        this._addListener(this.elements.resultsList, 'click', this._onResultItemClick);

        // [NEW] Add Enter key listener to all filter inputs
        Object.values(this.elements.filters).forEach(input => {
            this._addListener(input, 'keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._onSearchClick();
                }
            });
        });
    }

    show() {
        this._resetSearch(); // Reset to a clean state every time it's opened
        this.container.classList.remove('is-hidden');
        this.stateService.dispatch(uiActions.setModalActive(true)); // [NEW] Lock background app
        setTimeout(() => this.elements.filters.name.focus(), 50);
    }

    hide() {
        this.container.classList.add('is-hidden');
        this.stateService.dispatch(uiActions.setModalActive(false)); // [NEW] Unlock background app
    }

    // [NEW] Resets the search dialog to its initial state
    _resetSearch() {
        // [MODIFIED] (v6298-F4-Search-Fix) Clear all 7 filter fields
        this.elements.filters.name.value = '';
        this.elements.filters.phone.value = '';
        this.elements.filters.email.value = '';
        this.elements.filters.postcode.value = '';
        this.elements.filters.year.value = '';
        this.elements.filters.month.value = '';
        this.elements.filters.hasMotor.value = ''; // [MODIFIED]

        // Reset dynamic content
        this.elements.resultsList.innerHTML = '';
        this._showMessage(this.elements.resultsMessage, 'Please enter search criteria and press "Search".');
        this._showPreviewMessage('Select a quote from the results list to see a preview.');
        this._updateStatusBar('');
        // Disable load button
        this.elements.loadBtn.disabled = true;
        this.selectedQuoteData = null;
    }

    _onOverlayClick(event) {
        // Close if the click is on the dark overlay (the container)
        // but not on its child (the dialog box).
        if (event.target === this.container) {
            this.hide();
        }
    }

    // [MODIFIED] (v6298-F4-Search) Implement search logic
    async _onSearchClick() {
        const uid = this.authService.currentUser?.uid;
        if (!uid) {
            this._showMessage(this.elements.resultsMessage, 'Error: You are not logged in.');
            return;
        }

        // 1. Collect all filter values
        const filters = {
            name: this.elements.filters.name.value.trim(),
            phone: this.elements.filters.phone.value.trim(),
            email: this.elements.filters.email.value.trim().toLowerCase(),
            postcode: this.elements.filters.postcode.value.trim(),
            year: parseInt(this.elements.filters.year.value, 10) || null,
            month: parseInt(this.elements.filters.month.value, 10) || null,
        };
        // [MODIFIED] (v6298-F4-Search) Convert "true" / "false" strings to booleans
        const motorFilter = this.elements.filters.hasMotor.value;
        if (motorFilter === 'true') {
            filters.hasMotor = true;
        } else if (motorFilter === 'false') {
            filters.hasMotor = false;
        }

        // Simple validation
        if (Object.values(filters).every(v => !v && v !== false)) {
            this._showMessage(this.elements.resultsMessage, 'Please enter at least one search criteria.');
            return;
        }

        // 2. Execute Search
        this._updateStatusBar('Searching...');
        this.elements.searchBtn.disabled = true;
        this.elements.resultsList.innerHTML = '';
        this._showPreviewMessage('Loading...');

        const result = await searchQuotesAdvanced(uid, filters);

        this.elements.searchBtn.disabled = false;
        this._updateStatusBar(result.message);

        // 3. Handle Results
        if (result.success) {
            if (result.data.length > 0) {
                this._renderResultsList(result.data);
            } else {
                this._showMessage(this.elements.resultsMessage, 'No quotes found matching that criteria.');
            }
        } else if (result.needsIndex) {
            // Firestore Indexing Error
            this._showMessage(this.elements.resultsMessage, 'A database index is required. Please check the console (F12) for a link to create it.');
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Index required. Link logged to console.',
                type: 'error'
            });
        } else {
            // Other errors
            this._showMessage(this.elements.resultsMessage, `Error: ${result.message}`);
        }
    }

    // [NEW] Renders the list of search results
    _renderResultsList(quotes) {
        // Store the full data in memory
        this.quotesMap = new Map(quotes.map(q => [q.quoteId, q]));

        const html = quotes.map(quote => {
            const customer = quote.customer || {};
            const date = quote.issueDate || 'No Date';
            return `
                <div class="search-result-item" data-quote-id="${quote.quoteId}">
                    <strong>${quote.quoteId}</strong>
                    <small>${date} - ${customer.name || 'No Name'}</small>
                    <small>${customer.phone || customer.email || 'No Contact'}</small>
                </div>
            `;
        }).join('');
        this.elements.resultsList.innerHTML = html;
    }

    // [NEW] Handles clicking on an item in the results list
    _onResultItemClick(event) {
        const itemElement = event.target.closest('.search-result-item');
        if (!itemElement) return;

        const quoteId = itemElement.dataset.quoteId;
        const quoteData = this.quotesMap.get(quoteId);

        if (!quoteData) {
            this._showPreviewMessage('Error: Could not find quote data to preview.');
            return;
        }

        // 1. Highlight selected item
        this.elements.resultsList.querySelectorAll('.search-result-item').forEach(el => {
            el.classList.toggle('is-selected', el.dataset.quoteId === quoteId);
        });

        // 2. Store data for loading
        this.selectedQuoteData = quoteData;

        // 3. Render preview
        this._renderPreview(quoteData);

        // 4. Enable Load button
        this.elements.loadBtn.disabled = false;
    }

    // [NEW] Renders the preview pane for a selected quote
    _renderPreview(quote) {
        const customer = quote.customer || {};
        const metadata = quote.metadata || {};
        const f2 = quote.f2Snapshot || {};

        const renderField = (label, value, className = '') => {
            if (!value && value !== 0) return '';
            return `<div class="preview-label">${label}</div><div class="preview-value ${className}">${value}</div>`;
        };

        const html = `
            ${renderField('Quote ID', quote.quoteId, 'preview-value-quoteid')}
            ${renderField('Status', quote.status)}
            ${renderField('Issue Date', quote.issueDate)}
            ${renderField('Customer', customer.name)}
            ${renderField('Phone', customer.phone)}
            ${renderField('Email', customer.email)}
            ${renderField('Postcode', customer.postcode)}
            ${renderField('Address', customer.address)}
            ${renderField('Has Motor', metadata.hasMotor ? 'Yes' : 'No')}
            ${renderField('Grand Total', f2.grandTotal ? `$${f2.grandTotal.toFixed(2)}` : 'N/A')}
            ${renderField('Balance', f2.balance ? `$${f2.balance.toFixed(2)}` : 'N/A')}
        `;
        this.elements.previewContent.innerHTML = html;
    }

    // [MODIFIED] (v6298-F4-Search) Implement load logic
    _onLoadClick() {
        if (!this.selectedQuoteData) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Please select a quote from the list first.',
                type: 'error'
            });
            return;
        }

        console.log(`Loading quote: ${this.selectedQuoteData.quoteId}`);

        // --- Replicate the logic from WorkflowService._dispatchLoadActions ---
        // 1. Set the new quote data
        this.stateService.dispatch(quoteActions.setQuoteData(this.selectedQuoteData));

        // 2. Reset the UI state to match the new data
        this.stateService.dispatch(uiActions.resetUi());

        // 3. Restore F1 Snapshot
        if (this.selectedQuoteData.f1Snapshot) {
            this.stateService.dispatch(
                uiActions.restoreF1Snapshot(this.selectedQuoteData.f1Snapshot)
            );
        }

        // 4. Restore F2 Snapshot
        if (this.selectedQuoteData.f2Snapshot) {
            this.stateService.dispatch(
                uiActions.restoreF2Snapshot(this.selectedQuoteData.f2Snapshot)
            );
        }

        // 5. Mark sum as outdated and notify user
        this.stateService.dispatch(uiActions.setSumOutdated(true));
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: `Successfully loaded quote ${this.selectedQuoteData.quoteId}`,
        });

        // 6. Close the dialog
        this.hide();
    }

    // --- [NEW] UI Helper Methods ---
    _showMessage(element, message) {
        if (element) {
            element.innerHTML = `<div class="search-results-message">${message}</div>`;
        }
    }

    _showPreviewMessage(message) {
        if (this.elements.previewContent) {
            this.elements.previewContent.innerHTML = `<div class="search-results-message">${message}</div>`;
        }
    }

    _updateStatusBar(message) {
        if (this.elements.statusBar) {
            this.elements.statusBar.textContent = message;
        }
    }
}