/* FILE: 04-core-code/ui/views/f4-actions-view.js */

import { EVENTS, DOM_IDS } from '../../config/constants.js';
import { QUOTE_STATUS } from '../../config/status-config.js';

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the F4 (Actions) tab.
 */
export class F4ActionsView {
    constructor({ panelElement, eventAggregator, authService }) {
        this.panelElement = panelElement;
        this.eventAggregator = eventAggregator;
        this.authService = authService;

        this.boundHandlers = [];

        this._cacheF4Elements();
        this._initializeF4Listeners();
        console.log('F4ActionsView Initialized.');
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
        console.log("F4ActionsView destroyed.");
    }


    _cacheF4Elements() {
        const query = (id) => this.panelElement.querySelector(id);
        this.f4 = {
            statusDropdown: query('#f4-status-dropdown'),
            statusUpdateButton: query('#f4-status-update-btn'),
            cancelCorrectButton: query('#f4-btn-cancel-correct'),
            correctionControls: query('#f4-correction-controls'),
            btnCorrectionSet: query('#f4-btn-correction-set'),
            btnCorrectionExit: query('#f4-btn-correction-exit'),

            buttons: {
                'f1-key-save': query('#f1-key-save'),
                'f4-key-save-as-new': query('#f4-key-save-as-new'),
                'f4-key-generate-work-order': query('#f4-key-generate-work-order'),
                'f4-key-generate-xls': query(`#${DOM_IDS.F4_BTN_GENERATE_XLS}`),
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
            'f4-key-generate-xls': EVENTS.USER_REQUESTED_GENERATE_EXCEL,
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

        if (this.f4.statusUpdateButton) {
            this._addListener(this.f4.statusUpdateButton, 'click', () => {
                const newStatus = this.f4.statusDropdown.value;
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_UPDATE_STATUS, { newStatus });
            });
        }

        if (this.f4.cancelCorrectButton) {
            this._addListener(this.f4.cancelCorrectButton, 'click', () => {
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_CANCEL_CORRECT);
            });
        }

        if (this.f4.btnCorrectionSet) {
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

    render(state) {
        if (!this.f4.statusDropdown) return;

        const { quoteId, status } = state.quoteData;
        const { isCorrectionMode } = state.ui;
        const isNewQuote = !quoteId;

        const setButtonState = (btnId, isDisabled) => {
            const btn = this.f4.buttons[btnId];
            if (btn) {
                btn.disabled = isDisabled;
                btn.style.opacity = isDisabled ? '0.3' : '1';
            }
        };

        // --- 1. CORRECTION MODE (Priority High) ---
        if (isCorrectionMode) {
            if (this.f4.correctionControls) {
                this.f4.correctionControls.classList.remove('is-hidden');
            }

            const allFileOps = [
                'f1-key-save',
                'f4-key-save-as-new',
                'f1-key-export',
                'f1-key-load',
                'f4-key-load-cloud',
                'f4-key-generate-xls'
            ];
            allFileOps.forEach(id => setButtonState(id, true));

            this.f4.statusDropdown.disabled = true;
            this.f4.statusUpdateButton.disabled = true;
            if (this.f4.cancelCorrectButton) {
                this.f4.cancelCorrectButton.disabled = true;
                this.f4.cancelCorrectButton.style.opacity = '0.3';
            }

            this.f4.statusDropdown.value = status || QUOTE_STATUS.A_ARCHIVED;
            return;
        }

        // --- 2. STANDARD MODE (Not Correction) ---

        if (this.f4.correctionControls) {
            this.f4.correctionControls.classList.add('is-hidden');
        }

        // Locking Logic
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

        ['f1-key-save', 'f4-key-save-as-new', 'f1-key-export', 'f1-key-load', 'f4-key-load-cloud', 'f4-key-generate-xls'].forEach(id => setButtonState(id, false));

        if (isLocked) {
            setButtonState('f1-key-save', true);
            setButtonState('f4-key-save-as-new', true);
        }

        // Status Controls Logic
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

        if (this.f4.statusDropdown.options.length === 0) {
            for (const [key, text] of Object.entries(QUOTE_STATUS)) {
                const option = document.createElement('option');
                option.value = text;
                option.textContent = text;

                if (readOnlyStatusStates.includes(text)) {
                    option.style.background = "#eee";
                    option.style.fontStyle = "italic";
                }
                this.f4.statusDropdown.appendChild(option);
            }
        }

        this.f4.statusDropdown.value = status || QUOTE_STATUS.A_ARCHIVED;

        // Cancel/Correct Button Logic
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