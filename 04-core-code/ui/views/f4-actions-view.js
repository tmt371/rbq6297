/* FILE: 04-core-code/ui/views/f4-actions-view.js */
import { EVENTS, DOM_IDS } from '../../config/constants.js';
import { QUOTE_STATUS, ROLE_STATUS_PERMISSIONS, STATE_TRANSITIONS, normalizeQuoteStatus } from '../../config/status-config.js';

export class F4ActionsView {
    constructor({ panelElement, eventAggregator, authService }) {
        this.panelElement = panelElement;
        this.eventAggregator = eventAggregator;
        this.authService = authService;
        this.boundHandlers = [];
        this.subscriptions = []; // [NEW] EventAggregator registry
        this.currentState = null;

        this._cacheF4Elements();
        // [MOVED] Initialization of listeners is now dynamically managed in activate()
        this._checkAdminPermission();
        console.log('F4ActionsView Initialized (with Fixed Metadata Tollbooth).');
    }

    async _checkAdminPermission() {
        try {
            const { auth } = await import('../../config/firebase-config.js');
            const user = auth.currentUser;
            if (user) {
                const tokenResult = await user.getIdTokenResult();
                this.currentUserRole = tokenResult.claims.role;

                if (this.currentUserRole !== 'admin') {
                    if (this.f4.btnAdminEntry) {
                        this.f4.btnAdminEntry.disabled = true;
                        this.f4.btnAdminEntry.title = 'Admin access required';
                    }
                }
            }
        } catch (err) {
            console.warn("⚠️ [RBAC] Permission check failed.", err.message);
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
            if (element) element.removeEventListener(event, handler);
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
            btnAdminEntry: query('#f4-btn-admin-entry'),

            paymentPanel: query('#f4-payment-modal'), // The actual modal overlay
            btnOpenPaymentModal: query('#f4-btn-open-payment-modal'),
            btnCancelPaymentModal: query('#f4-btn-cancel-payment'),
            paymentAmount: query('#f4-payment-amount'),
            paymentDate: query('#f4-payment-date'),
            paymentMethod: query('#f4-payment-method'),
            btnRegisterPayment: query('#f4-btn-register-payment'),

            // [NEW] Production Center Modal
            prodCenterModal: query('#f4-production-center-modal'),
            btnGenFactoryOrder: query('#f4-btn-gen-factory-order'),
            btnGenInstallWorksheet: query('#f4-btn-gen-install-worksheet'),
            btnGenBothWorksheets: query('#f4-btn-gen-both-worksheets'),
            btnCloseProdCenter: query('#f4-btn-close-prod-center'),

            // [NEW] Load Options Modal
            loadOptionsModal: query('#f4-load-options-modal'),
            btnMenuLoadCsv: query('#menu-load-csv'),
            btnMenuOpenCamera: query('#menu-open-camera'),
            btnMenuOpenOcr: query('#menu-open-ocr'),
            btnCloseLoadModal: query('#f4-btn-close-load-modal'),

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
                'hidden-ocr-file-input': query('#hidden-ocr-file-input'),
            },
        };
    }

    _initializeF4Listeners() {
        this._addListener(this.panelElement, 'click', (event) => {
            const btn = event.target.closest('button');
            if (!btn || btn.disabled) return;

            const actionId = btn.id;
            if (btn.classList.contains('tab-button') || (actionId && actionId.includes('-tab'))) return;

            if (actionId === 'f4-btn-correction-exit') {
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_EXIT_CORRECTION_MODE);
                this.eventAggregator.publish('STATE_DISPATCH', { type: 'ui/setIsProcessing', payload: { isProcessing: false } });
                return;
            }

            const buttonEventMap = {
                'f1-key-save': EVENTS.USER_REQUESTED_SAVE,
                'f4-key-save-as-new': EVENTS.USER_REQUESTED_SAVE_AS_NEW_VERSION,
                [`${DOM_IDS.F4_BTN_GENERATE_XLS}`]: EVENTS.USER_REQUESTED_GENERATE_EXCEL,
                'f1-key-export': EVENTS.USER_REQUESTED_EXPORT_CSV,
                'menu-load-csv': EVENTS.USER_REQUESTED_LOAD,
                [`${DOM_IDS.F4_BTN_SEARCH_DIALOG}`]: EVENTS.USER_REQUESTED_SEARCH_DIALOG,
                'f1-key-reset': EVENTS.USER_REQUESTED_RESET,
                [`${DOM_IDS.F4_BTN_RELOGIN}`]: EVENTS.USER_REQUESTED_RELOGIN,
                'f4-btn-cancel-correct': EVENTS.USER_REQUESTED_CANCEL_CORRECT,
                'f4-btn-correction-set': EVENTS.USER_REQUESTED_SAVE
            };

            if (buttonEventMap[actionId]) {
                this.eventAggregator.publish(buttonEventMap[actionId]);
                // Close load modal if it was a menu action
                if (actionId === 'menu-load-csv' && this.f4.loadOptionsModal) {
                    this.f4.loadOptionsModal.style.display = 'none';
                }
            } else if (actionId === 'f1-key-load') {
                if (this.f4.loadOptionsModal) {
                    this.f4.loadOptionsModal.style.display = 'flex';
                }
            } else if (actionId === 'f4-btn-close-load-modal') {
                if (this.f4.loadOptionsModal) {
                    this.f4.loadOptionsModal.style.display = 'none';
                }
            } else if (actionId === 'menu-open-camera') {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { type: 'info', message: 'Camera module placeholder' });
                if (this.f4.loadOptionsModal) this.f4.loadOptionsModal.style.display = 'none';
            } else if (actionId === 'f4-key-generate-work-order') {
                if (this.f4.prodCenterModal) {
                    this.f4.prodCenterModal.style.display = 'flex';
                }
            } else if (actionId === 'f4-btn-gen-factory-order') {
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_GENERATE_WORK_ORDER);
                if (this.f4.prodCenterModal) this.f4.prodCenterModal.style.display = 'none';
            } else if (actionId === 'f4-btn-gen-install-worksheet') {
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_GENERATE_INSTALLATION_WORKSHEET);
                if (this.f4.prodCenterModal) this.f4.prodCenterModal.style.display = 'none';
            } else if (actionId === 'f4-btn-gen-both-worksheets') {
                this.eventAggregator.publish(EVENTS.USER_REQUESTED_GENERATE_BOTH_WORKSHEETS);
                if (this.f4.prodCenterModal) this.f4.prodCenterModal.style.display = 'none';
            } else if (actionId === 'f4-btn-close-prod-center') {
                if (this.f4.prodCenterModal) this.f4.prodCenterModal.style.display = 'none';
            } else if (actionId === 'f4-status-update-btn') {
                const newStatus = this.f4.statusDropdown ? this.f4.statusDropdown.value : null;
                if (newStatus) {
                    if (newStatus === QUOTE_STATUS.L_CLOSED) {
                        const metadata = this.currentState?.quoteData?.metadata || {};
                        const payments = Array.isArray(metadata.payments) ? metadata.payments : [];
                        const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                        const quoteTotal = parseFloat(this.currentState?.ui?.f2?.grandTotal || this.currentState?.quoteData?.f2Snapshot?.grandTotal || 0);

                        if (totalPaid < quoteTotal) {
                            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                                type: 'warning',
                                message: `❌ Action Blocked: Full payment required to close order. (Paid: $${totalPaid}, Total: $${quoteTotal})`
                            });
                            if (this.currentState && this.currentState.quoteData) {
                                this.f4.statusDropdown.value = this.currentState.quoteData.status || QUOTE_STATUS.A_SAVED;
                            }
                            return;
                        }
                    }

                    if (newStatus === QUOTE_STATUS.D_DEPOSIT_PAID) {
                        const metadata = this.currentState?.quoteData?.metadata || {};
                        const hasPayments = Array.isArray(metadata.payments) && metadata.payments.length > 0;
                        if (!hasPayments) {
                            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { type: 'info', message: 'Payment required before moving to "Deposit Paid".' });
                            if (this.f4.paymentPanel) {
                                this.f4.paymentPanel.style.display = 'flex';
                                this.f4.paymentPanel.dataset.context = newStatus;
                            }
                            return;
                        }
                    }
                    this.eventAggregator.publish(EVENTS.USER_REQUESTED_UPDATE_STATUS, { newStatus });
                }
            } else if (actionId === 'f4-btn-open-payment-modal') {
                if (this.f4.paymentPanel) {
                    this.f4.paymentPanel.style.display = 'flex';
                    this.f4.paymentPanel.dataset.context = 'manual';
                }
            } else if (actionId === 'f4-btn-cancel-payment') {
                if (this.f4.paymentPanel) {
                    this.f4.paymentPanel.style.display = 'none';
                    if (this.f4.paymentPanel.dataset.context !== 'manual' && this.currentState && this.currentState.quoteData) {
                        if (this.f4.statusDropdown) {
                            this.f4.statusDropdown.value = this.currentState.quoteData.status || QUOTE_STATUS.A_SAVED;
                        }
                    }
                    this.f4.paymentPanel.dataset.context = '';
                }
            } else if (actionId === 'f4-btn-register-payment') {
                const parsedAmount = parseFloat(this.f4.paymentAmount ? this.f4.paymentAmount.value : null);
                const methodInput = this.f4.paymentMethod ? this.f4.paymentMethod.value : null;
                const dateInput = this.f4.paymentDate ? this.f4.paymentDate.value : null;

                if (parsedAmount && methodInput) {
                    this.eventAggregator.publish(EVENTS.USER_REQUESTED_REGISTER_PAYMENT, {
                        amount: parsedAmount,
                        method: methodInput,
                        date: dateInput || new Date().toISOString().split('T')[0]
                    });

                    if (this.f4.paymentPanel) {
                        const context = this.f4.paymentPanel.dataset.context;
                        this.f4.paymentPanel.style.display = 'none';
                        this.f4.paymentPanel.dataset.context = '';
                        if (context && context !== 'manual') {
                            this.eventAggregator.publish(EVENTS.USER_REQUESTED_UPDATE_STATUS, { newStatus: context });
                        }
                    }
                    if (this.f4.paymentAmount) this.f4.paymentAmount.value = '';
                } else {
                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { type: 'warning', message: 'Please enter a valid amount and select a method.' });
                }
            } else if (actionId === DOM_IDS.F4_BTN_LOGOUT) {
                if (this.authService) this.authService.logout();
            } else if (actionId === 'f4-btn-admin-entry') {
                window.open('admin/admin.html', '_blank');
            }
        });

        // Device Detection Logic
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
        if (this.f4.btnMenuOpenCamera && !isMobile) {
            this.f4.btnMenuOpenCamera.disabled = true;
            this.f4.btnMenuOpenCamera.textContent = '📷 Camera (Mobile/Tablet Only)';
            this.f4.btnMenuOpenCamera.style.opacity = '0.5';
            this.f4.btnMenuOpenCamera.style.cursor = 'not-allowed';
        }

        // [NEW] Bulletproof OCR Delegation (Step 1.2.1 Fix)
        this._addListener(document, 'click', (e) => {
            const ocrBtn = e.target.closest('#menu-open-ocr');
            if (ocrBtn) {
                e.preventDefault();
                console.log('✅ [OCR] Open OCR button clicked! Triggering file picker...');
                const fileInput = document.getElementById('hidden-ocr-file-input');
                if (fileInput) {
                    fileInput.click();
                    // Also close the Load Options Modal manually if delegation picked it up
                    const modal = document.getElementById('f4-load-options-modal');
                    if (modal) modal.style.display = 'none';
                } else {
                    console.error('❌ [OCR] ERROR: hidden-ocr-file-input not found in DOM!');
                }
            }
        });

        // [NEW] OCR Springboard Listener (Step 1.2.1 Fix)
        this._addListener(document, 'change', (event) => {
            if (event.target && event.target.id === 'hidden-ocr-file-input') {
                const file = event.target.files[0];
                if (!file) {
                    console.warn('⚠️ [OCR] No file selected.');
                    return;
                }

                console.log('✅ [OCR] File selected, loading to Cropper...');
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    // Reset input so selecting the same file again triggers 'change'
                    event.target.value = ''; 
                    
                    console.log('✅ [OCR] File read successfully, publishing event...');
                    this.eventAggregator.publish(EVENTS.USER_REQUESTED_OCR, { imageUrl: dataUrl });
                };
                reader.onerror = (error) => {
                    console.error('❌ [OCR] FileReader error:', error);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    render(state) {
        this.currentState = state;

        if (!this.f4.statusDropdown) return;

        const { quoteId, status } = state.quoteData;
        const { isCorrectionMode } = state.ui;
        const isNewQuote = !quoteId;

        const allControls = [
            this.f4.statusDropdown, this.f4.statusUpdateButton, this.f4.cancelCorrectButton,
            this.f4.btnCorrectionSet, this.f4.btnCorrectionExit, this.f4.btnAdminEntry,
            this.f4.btnOpenPaymentModal, this.f4.btnCancelPaymentModal, this.f4.paymentAmount, this.f4.paymentDate, this.f4.paymentMethod, this.f4.btnRegisterPayment,
            ...Object.values(this.f4.buttons)
        ];

        allControls.forEach(el => { if (el) el.disabled = false; });

        if (this.f4.correctionControls) {
            this.f4.correctionControls.classList.toggle('is-hidden', !isCorrectionMode);
        }

        if (isCorrectionMode) {
            const disabledIdsInCorrection = ['f1-key-save', 'f4-key-save-as-new', 'f1-key-export', 'f4-key-generate-xls', 'f4-key-generate-work-order'];
            disabledIdsInCorrection.forEach(id => { if (this.f4.buttons[id]) this.f4.buttons[id].disabled = true; });

            this.f4.statusDropdown.disabled = true;
            this.f4.statusUpdateButton.disabled = true;
            if (this.f4.cancelCorrectButton) this.f4.cancelCorrectButton.disabled = true;
            if (this.f4.btnOpenPaymentModal) this.f4.btnOpenPaymentModal.disabled = true;
            if (this.f4.btnRegisterPayment) this.f4.btnRegisterPayment.disabled = true;

            this.f4.statusDropdown.value = status || QUOTE_STATUS.A_SAVED;
        } else {
            if (this.f4.btnCorrectionSet) this.f4.btnCorrectionSet.disabled = true;
            if (this.f4.btnCorrectionExit) this.f4.btnCorrectionExit.disabled = true;

            const lockedStates = [
                QUOTE_STATUS.C_CONFIRMED, QUOTE_STATUS.D_DEPOSIT_PAID,
                QUOTE_STATUS.E_TO_FACTORY, QUOTE_STATUS.F_PRODUCTION, QUOTE_STATUS.G_READY_PICKUP,
                QUOTE_STATUS.H_DELIVERED, QUOTE_STATUS.I_COMPLETED, QUOTE_STATUS.J_INVOICED,
                QUOTE_STATUS.K_OVERDUE, QUOTE_STATUS.L_CLOSED, QUOTE_STATUS.Y_ON_HOLD, QUOTE_STATUS.X_CANCELLED
            ];

            if (lockedStates.includes(status)) {
                if (this.f4.buttons['f1-key-save']) this.f4.buttons['f1-key-save'].disabled = true;
                if (this.f4.buttons['f4-key-save-as-new']) this.f4.buttons['f4-key-save-as-new'].disabled = true;
            } else if (status === QUOTE_STATUS.B_QUOTED) {
                // [LIFECYCLE UNLOCK] B_QUOTED allows versioning but blocks overwrites.
                if (this.f4.buttons['f1-key-save']) this.f4.buttons['f1-key-save'].disabled = true;
                if (this.f4.buttons['f4-key-save-as-new']) this.f4.buttons['f4-key-save-as-new'].disabled = false;
            }

            const readOnlyStatusStates = [QUOTE_STATUS.J_INVOICED, QUOTE_STATUS.K_OVERDUE, QUOTE_STATUS.L_CLOSED, QUOTE_STATUS.X_CANCELLED];
            const isStatusReadOnly = readOnlyStatusStates.includes(status);
            const hasGodMode = this.currentUserRole === 'admin';

            // Admin can bypass the read-only UI lock to progress states like J_INVOICED -> L_CLOSED
            const isControlsDisabled = isNewQuote || (isStatusReadOnly && !hasGodMode);

            this.f4.statusDropdown.disabled = isControlsDisabled;
            this.f4.statusUpdateButton.disabled = isControlsDisabled;

            if (this.f4.btnOpenPaymentModal) {
                // 如果是新單，不能收款
                this.f4.btnOpenPaymentModal.disabled = isNewQuote;
                if (this.f4.paymentAmount) this.f4.paymentAmount.disabled = isNewQuote;
                if (this.f4.paymentDate) this.f4.paymentDate.disabled = isNewQuote;
                if (this.f4.paymentMethod) this.f4.paymentMethod.disabled = isNewQuote;
                if (this.f4.btnRegisterPayment) this.f4.btnRegisterPayment.disabled = isNewQuote;
            }

            this.f4.statusDropdown.innerHTML = '';
            const userRole = this.currentUserRole === 'admin' ? 'admin' : 'sales';
            const allowedKeys = (typeof ROLE_STATUS_PERMISSIONS !== 'undefined' && ROLE_STATUS_PERMISSIONS[userRole])
                ? ROLE_STATUS_PERMISSIONS[userRole]
                : Object.keys(QUOTE_STATUS);

            const effectiveStatus = normalizeQuoteStatus(status);
            const allowedTransitions = (typeof STATE_TRANSITIONS !== 'undefined' && STATE_TRANSITIONS[effectiveStatus])
                ? STATE_TRANSITIONS[effectiveStatus]
                : [];

            Object.entries(QUOTE_STATUS).forEach(([key, displayValue]) => {
                const option = document.createElement('option');
                option.value = displayValue;
                option.textContent = displayValue;

                // 1. Check RBAC (Role-based general permission for this status)
                const isAllowedByRole = allowedKeys.includes(key);

                // 2. Check FSM (Is this a legal step from the current status?)
                const isLegalTransition = (displayValue === effectiveStatus) || allowedTransitions.includes(displayValue);

                // 3. Strict Application: Must pass both, NO Admin bypass for FSM sequence
                if (!isAllowedByRole || !isLegalTransition) {
                    option.disabled = true;
                    option.style.color = '#999';
                }
                this.f4.statusDropdown.appendChild(option);
            });

            this.f4.statusDropdown.value = status || QUOTE_STATUS.A_SAVED;
        }

        allControls.forEach(el => {
            if (el) {
                if (el.disabled) {
                    el.style.pointerEvents = 'none';
                    el.style.opacity = '0.5';
                } else {
                    el.style.pointerEvents = 'auto';
                    el.style.opacity = '1';
                }
            }
        });

        if (this.f4.btnAdminEntry && this.currentUserRole !== 'admin') {
            this.f4.btnAdminEntry.disabled = true;
            this.f4.btnAdminEntry.style.pointerEvents = 'none';
            this.f4.btnAdminEntry.style.opacity = '0.5';
        }

        const accordionHeaders = this.panelElement.querySelectorAll('.f4-accordion-header');
        accordionHeaders.forEach(header => {
            header.style.pointerEvents = 'auto';
            header.style.cursor = 'pointer';
        });
    }

    activate() {
        // [NEW] (Deactivate Pattern) Dynamically re-bind all listeners upon activation
        this._initializeF4Listeners();
    }
}

window.toggleF4Accordion = function (headerElement) {
    if (headerElement && headerElement.parentElement) {
        headerElement.parentElement.classList.toggle('collapsed');
    }
};