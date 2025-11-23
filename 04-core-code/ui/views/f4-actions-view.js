/* FILE: 04-core-code/ui/views/f4-actions-view.js */
// [MODIFIED] (Phase 1) Added new "Generate Work Order" button.
// [MODIFIED] (Phase 11) Added Re-Login button handler.
// [MODIFIED] (F4 Status Phase 2) Added logic for status dropdown and update button.
// [MODIFIED] (F4 Status Phase 3) Bound update button to USER_REQUESTED_UPDATE_STATUS event.
// [MODIFIED] (Correction Flow Phase 1) Added Cancel/Correct button logic.
// [MODIFIED] (Correction Flow Fix) Added SET/Exit buttons and Correction Mode UI logic.
// [MODIFIED] (Correction Flow Phase 5) Implemented Locking UI Logic (Disable Save/SaveAs when locked).

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
            // [NEW] (Correction Flow Phase 1) Cache Cancel/Correct button
            cancelCorrectButton: query('#f4-btn-cancel-correct'),
            // [NEW] (Correction Flow Fix) Cache Correction Controls
            correctionControls: query('#f4-correction-controls'),
            btnCorrectionSet: query('#f4-btn-correction-set'),
            btnCorrectionExit: query('#f4-btn-correction-exit'),

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

        // [NEW] (Correction Flow Phase 1) Bind Cancel/Correct Button
        if (this.f4.cancelCorrectButton) {
            this._addListener(this.f4.cancelCorrectButton, 'click', () => {
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_CANCEL_CORRECT);
            });
        }

        // [NEW] (Correction Flow Fix) Bind SET and Exit Buttons
        if (this.f4.btnCorrectionSet) {
            // SET triggers the SAVE event. 
            // The backend (QuotePersistenceService) will detect isCorrectionMode and handle it as atomic correction.
            this._addListener(this.f4.btnCorrectionSet, 'click', () => {
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_SAVE);
            });
        }

        if (this.f4.btnCorrectionExit) {
            this._addListener(this.f4.btnCorrectionExit, 'click', () => {
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_EXIT_CORRECTION_MODE);
            });
        }
    }

    /**
     * [NEW] (F4 Status Phase 2) Renders the F4 tab, specifically the status dropdown.
     * [MODIFIED] (Correction Flow Fix) Handles Correction Mode UI state (Disabling buttons, showing SET/Exit).
     * [MODIFIED] (Correction Flow Phase 5) Handles Locked State UI (Disabling Save/SaveAs).
     */
    render(state) {
        // Guard clause: if DOM elements aren't cached, return
        if (!this.f4.statusDropdown) return;

        const { quoteId, status } = state.quoteData;
        const { isCorrectionMode } = state.ui; // [NEW] Get correction mode state
        const isNewQuote = !quoteId;

        // Helper to set button state (disabled + opacity)
        const setButtonState = (btnId, isDisabled) => {
            const btn = this.f4.buttons[btnId];
            if (btn) {
                btn.disabled = isDisabled;
                btn.style.opacity = isDisabled ? '0.3' : '1';
            }
        };

        // --- 1. CORRECTION MODE (Priority High) ---
        if (isCorrectionMode) {
            // Show Correction Controls (SET / Exit)
            if (this.f4.correctionControls) {
                this.f4.correctionControls.classList.remove('is-hidden');
            }

            // Disable ALL Standard File Operations
            const allFileOps = [
                'f1-key-save',
                'f4-key-save-as-new',
                'f1-key-export',
                'f1-key-load',
                'f4-key-load-cloud' // Search
            ];
            allFileOps.forEach(id => setButtonState(id, true));

            // Disable Status Controls
            this.f4.statusDropdown.disabled = true;
            this.f4.statusUpdateButton.disabled = true;
            if (this.f4.cancelCorrectButton) {
                this.f4.cancelCorrectButton.disabled = true;
                this.f4.cancelCorrectButton.style.opacity = '0.3';
            }

            this.f4.statusDropdown.value = status || QUOTE_STATUS.A_ARCHIVED;
            return; // Exit render
        }

        // --- 2. STANDARD MODE (Not Correction) ---

        // Ensure Correction Controls are hidden
        if (this.f4.correctionControls) {
            this.f4.correctionControls.classList.add('is-hidden');
        }

        // --- Locking Logic ---
        // If the order is "Established" (B~I, or X/J), it is considered LOCKED for editing.
        // Exception: If status is A (Saved) or new, it's unlocked.
        const lockedStates = [
            QUOTE_STATUS.B_VALID_ORDER,
            QUOTE_STATUS.C_SENT_TO_FACTORY,
            QUOTE_STATUS.D_IN_PRODUCTION,
            QUOTE_STATUS.E_READY_FOR_PICKUP,
            QUOTE_STATUS.F_PICKED_UP,
            QUOTE_STATUS.G_COMPLETED,
            QUOTE_STATUS.H_INVOICE_SENT,
            QUOTE_STATUS.I_INVOICE_OVERDUE,
            QUOTE_STATUS.X_CANCELLED,
            QUOTE_STATUS.J_CLOSED
        ];

        const isLocked = lockedStates.includes(status);

        // Reset standard buttons first (Enable all)
        ['f1-key-save', 'f4-key-save-as-new', 'f1-key-export', 'f1-key-load', 'f4-key-load-cloud'].forEach(id => setButtonState(id, false));

        // Apply Lock: Disable Save and Save As if locked
        if (isLocked) {
            setButtonState('f1-key-save', true);
            setButtonState('f4-key-save-as-new', true);
            // Note: Export, Load, and Search remain enabled for navigation/viewing.
        }

        // --- Status Controls Logic ---
        // "Read Only" states are those where even Sales shouldn't change status (D~I, X, J).
        // Sales CAN change B -> C.
        const readOnlyStatusStates = [
            QUOTE_STATUS.D_IN_PRODUCTION,
            QUOTE_STATUS.E_READY_FOR_PICKUP,
            QUOTE_STATUS.F_PICKED_UP,
            QUOTE_STATUS.H_INVOICE_SENT,
            QUOTE_STATUS.I_INVOICE_OVERDUE,
            QUOTE_STATUS.X_CANCELLED,
            QUOTE_STATUS.J_CLOSED
        ];

        const isStatusReadOnly = readOnlyStatusStates.includes(status);
        const isControlsDisabled = isNewQuote || isStatusReadOnly;

        this.f4.statusDropdown.disabled = isControlsDisabled;
        this.f4.statusUpdateButton.disabled = isControlsDisabled;

        // Populate options (Run once)
        if (this.f4.statusDropdown.options.length === 0) {
            for (const [key, text] of Object.entries(QUOTE_STATUS)) {
                const option = document.createElement('option');
                option.value = text; // Store "A. Saved"
                option.textContent = text;

                // (Tweak 2) Visually distinguish non-sales options
                if (readOnlyStatusStates.includes(text)) {
                    option.style.background = "#eee";
                    option.style.fontStyle = "italic";
                }
                this.f4.statusDropdown.appendChild(option);
            }
        }

        // Set selected value
        this.f4.statusDropdown.value = status || QUOTE_STATUS.A_ARCHIVED;

        // --- Cancel/Correct Button Logic ---
        if (this.f4.cancelCorrectButton) {
            const validCorrectionStates = [
                QUOTE_STATUS.B_VALID_ORDER,
                QUOTE_STATUS.C_SENT_TO_FACTORY,
                QUOTE_STATUS.D_IN_PRODUCTION,
                QUOTE_STATUS.E_READY_FOR_PICKUP,
                QUOTE_STATUS.F_PICKED_UP,
                QUOTE_STATUS.G_COMPLETED,
                QUOTE_STATUS.H_INVOICE_SENT,
                QUOTE_STATUS.I_INVOICE_OVERDUE
            ];

            const canCorrect = !isNewQuote && validCorrectionStates.includes(status);

            this.f4.cancelCorrectButton.disabled = !canCorrect;
            this.f4.cancelCorrectButton.style.opacity = canCorrect ? '1' : '0.3';

            if (!canCorrect) {
                if (status === QUOTE_STATUS.X_CANCELLED) {
                    this.f4.cancelCorrectButton.title = "This order is already cancelled.";
                } else if (status === QUOTE_STATUS.J_CLOSED) {
                    this.f4.cancelCorrectButton.title = "Closed orders cannot be modified.";
                } else if (status === QUOTE_STATUS.A_ARCHIVED || !status) {
                    this.f4.cancelCorrectButton.title = "Only valid orders (Status B+) can be cancelled or corrected.";
                }
            } else {
                this.f4.cancelCorrectButton.title = "Cancel order or create a correction version.";
            }
        }
    }
}