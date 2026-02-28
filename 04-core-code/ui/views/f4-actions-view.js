/* FILE: 04-core-code/ui/views/f4-actions-view.js */
// [MODIFIED] (Phase 1) Added new "Generate Work Order" button.
// [MODIFIED] (Phase 11) Added Re-Login button handler.
// [MODIFIED] (F4 Status Phase 2) Added logic for status dropdown and update button.
// [MODIFIED] (F4 Status Phase 3) Bound update button to USER_REQUESTED_UPDATE_STATUS event.
// [MODIFIED] (Correction Flow Phase 1) Added Cancel/Correct button logic.
// [MODIFIED] (Correction Flow Fix) Added SET/Exit buttons and Correction Mode UI logic.
// [MODIFIED] (Correction Flow Phase 5) Implemented Locking UI Logic (Disable Save/SaveAs when locked).
// [MODIFIED] (v6299 Gen-Xls) Added logic for Gen-Xls button.

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
        // [NEW] Phase 8.1: RBAC — disable Admin button for non-admin users
        this._checkAdminPermission();
        console.log('F4ActionsView Initialized.');
    }

    // [NEW] Phase 8.1: RBAC Permission Check for Admin Button
    async _checkAdminPermission() {
        try {
            const { auth } = await import('../../config/firebase-config.js');
            const user = auth.currentUser;
            if (user) {
                const tokenResult = await user.getIdTokenResult();
                const role = tokenResult.claims.role;
                if (role !== 'admin') {
                    // Lock the admin button for non-admin users
                    if (this.f4.btnAdminEntry) {
                        this.f4.btnAdminEntry.disabled = true;
                        this.f4.btnAdminEntry.style.opacity = '0.5';
                        this.f4.btnAdminEntry.style.cursor = 'not-allowed';
                        this.f4.btnAdminEntry.title = 'Admin access required';
                    }
                    console.log("🔒 [RBAC] User lacks 'admin' role. Admin button disabled.");
                } else {
                    console.log("🔓 [RBAC] Admin role confirmed. Admin button enabled.");
                }
            }
        } catch (err) {
            console.warn("⚠️ [RBAC] Permission check failed, Admin button stays enabled.", err.message);
        }
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
            btnAdminEntry: query('#f4-btn-admin-entry'), // [NEW] (Phase 4.11)

            buttons: {
                'f1-key-save': query('#f1-key-save'),
                'f4-key-save-as-new': query('#f4-key-save-as-new'),
                'f4-key-generate-work-order': query('#f4-key-generate-work-order'),
                'f4-key-generate-xls': query(`#${DOM_IDS.F4_BTN_GENERATE_XLS}`), // [NEW] (v6299 Gen-Xls)
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
        // [REFACTOR] (Phase 4.7g-1) Universal Event Delegation for F4
        this._addListener(this.panelElement, 'click', (event) => {
            // 尋找被點擊的按鈕（支持透過 ID 識別）
            const btn = event.target.closest('button');
            if (!btn) return;

            const actionId = btn.id;
            console.log(`🖱️ [F4 Delegate Click] Action ID: ${actionId}`);

            // [CRITICAL FIX] (Phase 4.8a) Exempt tab buttons
            if (btn.classList.contains('tab-button') || (actionId && actionId.includes('-tab'))) {
                return;
            }

            if (btn.disabled || !actionId) return;

            // [MODIFIED] (Phase 4.8a) Split exit to force unlock
            if (actionId === 'f4-btn-correction-exit') {
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_EXIT_CORRECTION_MODE);
                // [FORCE] 防止鎖定殘留
                this.eventAggregator.publish('STATE_DISPATCH', { type: 'ui/setIsProcessing', payload: { isProcessing: false } });
                return;
            }

            const buttonEventMap = {
                'f1-key-save': EVENTS.USER_REQUESTED_SAVE,
                'f4-key-save-as-new': EVENTS.USER_REQUESTED_SAVE_AS_NEW_VERSION,
                'f4-key-generate-work-order': EVENTS.USER_REQUESTED_GENERATE_WORK_ORDER,
                [`${DOM_IDS.F4_BTN_GENERATE_XLS}`]: EVENTS.USER_REQUESTED_GENERATE_EXCEL,
                'f1-key-export': EVENTS.USER_REQUESTED_EXPORT_CSV,
                'f1-key-load': EVENTS.USER_REQUESTED_LOAD,
                [`${DOM_IDS.F4_BTN_SEARCH_DIALOG}`]: EVENTS.USER_REQUESTED_SEARCH_DIALOG,
                'f1-key-reset': EVENTS.USER_REQUESTED_RESET,
                [`${DOM_IDS.F4_BTN_RELOGIN}`]: EVENTS.USER_REQUESTED_RELOGIN,
                'f4-btn-cancel-correct': EVENTS.USER_REQUESTED_CANCEL_CORRECT,
                'f4-btn-correction-set': EVENTS.USER_REQUESTED_SAVE
            };

            if (buttonEventMap[actionId]) {
                this.eventAggregator.publish(buttonEventMap[actionId]);
            } else if (actionId === 'f4-status-update-btn') {
                const newStatus = this.f4.statusDropdown ? this.f4.statusDropdown.value : null;
                if (newStatus) {
                    this.eventAggregator.publish(EVENTS.USER_REQUESTED_UPDATE_STATUS, { newStatus });
                }
            } else if (actionId === DOM_IDS.F4_BTN_LOGOUT) {
                if (this.authService) {
                    this.authService.logout();
                } else {
                    console.error("AuthService not available in F4ActionsView.");
                }
            } else if (actionId === 'f4-btn-admin-entry') {
                // [MODIFIED] (Phase 4.10c) Official Admin Portal Launch
                console.log("🚀 [Admin Portal] Launching Database Management...");
                window.open('admin.html', '_blank');
            }
        });

        // Ensure "Load File" text is correct
        const loadBtn = this.f4.buttons['f1-key-load'];
        if (loadBtn) {
            loadBtn.textContent = 'Load File';
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

        // Helper to set button state (disabled)
        const setButtonState = (btnId, isDisabled) => {
            const btn = this.f4.buttons[btnId];
            if (btn) {
                btn.disabled = isDisabled;
            }
        };

        // --- 1. CORRECTION MODE (Priority High) ---
        if (isCorrectionMode) {
            // Show Correction Controls (SET / Exit)
            if (this.f4.correctionControls) {
                this.f4.correctionControls.classList.remove('is-hidden');
            }

            // Disable ALL Standard File Operations (Exempt Load/Search)
            const allFileOps = [
                'f1-key-save',
                'f4-key-save-as-new',
                'f1-key-export',
                'f4-key-generate-xls' // [NEW] (v6299 Gen-Xls) Disable Gen-Xls in Correction Mode
            ];
            allFileOps.forEach(id => setButtonState(id, true));

            // Disable Status Controls
            this.f4.statusDropdown.disabled = true;
            this.f4.statusUpdateButton.disabled = true;
            if (this.f4.cancelCorrectButton) {
                this.f4.cancelCorrectButton.disabled = true;
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
        // [MODIFIED] (v6299 Gen-Xls) Added generate-xls to reset list
        ['f1-key-save', 'f4-key-save-as-new', 'f1-key-export', 'f1-key-load', 'f4-key-load-cloud', 'f4-key-generate-xls'].forEach(id => setButtonState(id, false));

        // Apply Lock: Disable Save and Save As if locked
        if (isLocked) {
            setButtonState('f1-key-save', true);
            setButtonState('f4-key-save-as-new', true);
            // Note: Export, Load, and Search remain enabled for navigation/viewing.
        }

        // [MODIFIED] (Phase 4.7g) Remove opacity styling and inline disable reset if it overrides logic
        // 確保搜尋與載入功能不受鎖定影響
        const managementButtons = [
            this.f4.buttons['f1-key-load'],
            this.f4.buttons['f1-key-reset'],
            this.f4.buttons['f4-key-load-cloud']
        ];
        managementButtons.forEach(btn => { if (btn) btn.disabled = false; });

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

        // [FORCE EXEMPTION] Phase 4.8a
        // 管理類按鈕永遠不准被禁用，以確保用戶隨時有逃生出口
        const adminButtons = [
            this.f4.cancelCorrectButton,
            this.f4.buttons['f1-key-reset'],
            this.f4.buttons['f1-key-load'],
            this.f4.buttons['f4-key-load-cloud'],
            this.f4.btnAdminEntry // [NEW] Phase 4.11
        ];

        adminButtons.forEach(btn => {
            if (btn) {
                btn.disabled = false;
                btn.style.pointerEvents = 'auto'; // 確保雙重保障
                btn.style.opacity = '1';
                btn.title = "Administrative Action (Always Available)";
            }
        });
    }
}
