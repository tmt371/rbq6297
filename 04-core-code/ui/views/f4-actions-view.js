/* FILE: 04-core-code/ui/views/f4-actions-view.js */
// [MODIFIED] (Phase 1) Added new "Generate Work Order" button.
// [MODIFIED] (Phase 11) Added Re-Login button handler.
// [MODIFIED] (F4 Status Phase 2) Added logic for status dropdown and update button.
// [MODIFIED] (F4 Status Phase 3) Bound update button to USER_REQUESTED_UPDATE_STATUS event.

import { EVENTS, DOM_IDS } from '../../config/constants.js';
// [NEW] (F4 Status Phase 2) Import status constants
import { QUOTE_STATUS } from '../../config/status-config.js';

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the F4 (Actions) tab.
 */
export class F4ActionsView {
    constructor({ panelElement, eventAggregator, authService }) {
        this.panelElement = panelElement;
        this.eventAggregator = eventAggregator;
        this.authService = authService;

        // [NEW] (v6298-fix-5) Store bound handlers
        this.boundHandlers = [];

        this._cacheF4Elements();
        this._initializeF4Listeners();
        console.log('F4ActionsView Initialized.');
    }

    /**
     * [NEW] (v6298-fix-5) Helper to add and store listeners
     */
    _addListener(element, event, handler) {
        if (!element) return;
        const boundHandler = handler.bind(this);
        this.boundHandlers.push({ element, event, handler: boundHandler });
        element.addEventListener(event, boundHandler);
    }

    /**
     * [NEW] (v6298-fix-5) Destroys all event listeners
     */
    destroy() {
        this.boundHandlers.forEach(({ element, event, handler }) => {
            if (element) {
                element.removeEventListener(event, handler);
            }
        });
        this.boundHandlers = [];
        console.log("F4ActionsView destroyed.");
    }


    _cacheF4Elements() {
        const query = (id) => this.panelElement.querySelector(id);
        this.f4 = {
            // [NEW] (F4 Status Phase 2) Cache status elements
            statusDropdown: query('#f4-status-dropdown'),
            statusUpdateButton: query('#f4-status-update-btn'),

            buttons: {
                'f1-key-save': query('#f1-key-save'),
                'f4-key-save-as-new': query('#f4-key-save-as-new'),
                'f4-key-generate-work-order': query('#f4-key-generate-work-order'),
                'f1-key-export': query('#f1-key-export'),
                'f1-key-load': query('#f1-key-load'),
                'f4-key-load-cloud': query(`#${DOM_IDS.F4_BTN_SEARCH_DIALOG}`),
                'f4-key-logout': query(`#${DOM_IDS.F4_BTN_LOGOUT}`),
                'f4-key-relogin': query(`#${DOM_IDS.F4_BTN_RELOGIN}`),
                'f1-key-reset': query('#f1-key-reset'),
            },
        };
    }

    _initializeF4Listeners() {
        const buttonEventMap = {
            'f1-key-save': EVENTS.USER_REQUESTED_SAVE,
            'f4-key-save-as-new': EVENTS.USER_REQUESTED_SAVE_AS_NEW_VERSION,
            'f4-key-generate-work-order': EVENTS.USER_REQUESTED_GENERATE_WORK_ORDER,
            'f1-key-export': EVENTS.USER_REQUESTED_EXPORT_CSV,
            'f1-key-load': EVENTS.USER_REQUESTED_LOAD,
            'f4-key-load-cloud': EVENTS.USER_REQUESTED_SEARCH_DIALOG,
            'f1-key-reset': EVENTS.USER_REQUESTED_RESET,
            'f4-key-relogin': EVENTS.USER_REQUESTED_RELOGIN,
        };

        for (const [id, eventName] of Object.entries(buttonEventMap)) {
            const button = this.f4.buttons[id];
            if (button) {
                if (id === 'f1-key-load') {
                    button.textContent = 'Load File';
                }
                this._addListener(button, 'click', () => {
                    this.eventAggregator.publish(eventName);
                });
            }
        }

        const logoutButton = this.f4.buttons['f4-key-logout'];
        if (logoutButton) {
            this._addListener(logoutButton, 'click', () => {
                if (this.authService) {
                    this.authService.logout();
                } else {
                    console.error("AuthService not available in F4ActionsView.");
                }
            });
        }

        // [NEW] (F4 Status Phase 3) Bind Status Update Button
        if (this.f4.statusUpdateButton) {
            this._addListener(this.f4.statusUpdateButton, 'click', () => {
                const newStatus = this.f4.statusDropdown.value;
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_UPDATE_STATUS, { newStatus });
            });
        }
    }

    /**
     * [NEW] (F4 Status Phase 2) Renders the F4 tab, specifically the status dropdown.
     */
    render(state) {
        // Guard clause: if DOM elements aren't cached, return
        if (!this.f4.statusDropdown) return;

        const { quoteId, status } = state.quoteData;
        const isNewQuote = !quoteId;

        // (Tweak 2) Check for non-Sales states (ReadOnly for Sales)
        const nonSalesStates = [
            QUOTE_STATUS.D_IN_PRODUCTION,
            QUOTE_STATUS.E_READY_FOR_PICKUP,
            QUOTE_STATUS.F_PICKED_UP,
            QUOTE_STATUS.H_INVOICE_SENT,
            QUOTE_STATUS.I_INVOICE_OVERDUE
        ];
        const isReadOnlyState = nonSalesStates.includes(status);

        // 1. Disable controls if it's a new quote OR if it's in a read-only state
        const isDisabled = isNewQuote || isReadOnlyState;
        this.f4.statusDropdown.disabled = isDisabled;
        this.f4.statusUpdateButton.disabled = isDisabled;

        if (isReadOnlyState) {
            this.f4.statusUpdateButton.title = "This status is managed by Factory/Accounting and cannot be changed here.";
        } else if (isNewQuote) {
            this.f4.statusUpdateButton.title = "Please save the quote first to enable status tracking.";
        } else {
            this.f4.statusUpdateButton.title = "";
        }

        // 2. Populate options (Run once)
        if (this.f4.statusDropdown.options.length === 0) {
            for (const [key, text] of Object.entries(QUOTE_STATUS)) {
                const option = document.createElement('option');
                option.value = text; // Store "A. 已存檔"
                option.textContent = text;

                // (Tweak 2) Visually distinguish non-sales options
                if (nonSalesStates.includes(text)) {
                    option.style.background = "#eee";
                    option.style.fontStyle = "italic";
                }
                this.f4.statusDropdown.appendChild(option);
            }
        }

        // 3. Set selected value
        // Default to A if status is missing (e.g., legacy files)
        this.f4.statusDropdown.value = status || QUOTE_STATUS.A_ARCHIVED;
    }
}