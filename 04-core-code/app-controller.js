/* FILE: 04-core-code/app-controller.js */
// [MODIFIED] (v6297 ?жш║л) ?Оцо╡ 2я╝Ъц│и??quotePersistenceService ф╕жщ?хоЪх? F4 ф║Лф╗╢??
// [MODIFIED] (F4 Status Phase 3) Subscribe to USER_REQUESTED_UPDATE_STATUS.
// [MODIFIED] (Correction Flow Phase 2) Subscribe to USER_REQUESTED_CANCEL_CORRECT.
// [MODIFIED] (Correction Flow Phase 4) Subscribe to USER_REQUESTED_EXECUTE_CANCELLATION.
// [MODIFIED] (Correction Flow Fix) Subscribe to USER_REQUESTED_EXIT_CORRECTION_MODE.
// [MODIFIED] (v6299 Gen-Xls) Subscribe to USER_REQUESTED_GENERATE_EXCEL.
// [MODIFIED] (v6299 Phase 4) Redirect USER_REQUESTED_GENERATE_EXCEL to quotePersistenceService.

import { EVENTS, STORAGE_KEYS } from './config/constants.js';
import * as uiActions from './actions/ui-actions.js';

const AUTOSAVE_INTERVAL_MS = 60000;
export class AppController {
    constructor({
        eventAggregator,
        stateService,
        quickQuoteView,
        detailConfigView,
        workflowService,
        quotePersistenceService, // [NEW] (v6297 ?жш║л) ц│ихЕе?Нх?
        calculationService // [NEW] Phase 4.10a
    }) {
        this.eventAggregator = eventAggregator;
        this.stateService = stateService; // Still needed for _getFullState and _handleAutoSave
        this.quickQuoteView = quickQuoteView;
        this.detailConfigView = detailConfigView;
        this.workflowService = workflowService;
        this.quotePersistenceService = quotePersistenceService; // [NEW] (v6297 ?жш║л) ?▓х??Нх?
        this.calculationService = calculationService; // [NEW] Phase 4.10a

        this.autoSaveTimerId = null;
        this._priceUpdateTimer = null; // [NEW] (Phase 4.10b) Explicit declaration
        this.subscriptions = []; // [NEW] (v6298-fix-4) Store subscriptions
        this.activeLocks = new Set(); // [NEW] Track active UI locks by reason
        console.log(
            'AppController (Refactored with grouped subscriptions) Initialized.'
        );

        // [DIAGNOSTIC] (Phase 4 診斷) 全局點擊雷達 — Capture 階段攔截
        document.addEventListener('click', (event) => {
            const target = event.target.closest('button, .panel-toggle, .k-panel-handle, .f-panel-handle, .nav-item, .numpad-handle, .tab-button') || event.target;
            const isLocked = document.body.classList.contains('global-ui-locked');

            // [MODIFIED] (Phase 4.7d) Navigation Exemption Rule
            // JS-level blocking (stopImmediatePropagation/preventDefault) has been completely removed.
            // UI interaction blocking is now handled purely by CSS pointer-events on specific content areas.
            if (isLocked) {
                const targetStr = `${target.tagName.toLowerCase()}${target.id ? '#' + target.id : ''}${target.className ? '.' + String(target.className).replace(/\s+/g, '.') : ''}`;
                // console.log(`🔍 [Lock Diagnostic] Click registered (NOT blocked) on: ${targetStr} | Time: ${performance.now()}`);
            }
        }, true);

        this.initialize();
    }

    /**
     * [NEW] (v6298-fix-4) Helper to subscribe and store the reference
     */
    _subscribe(eventName, handler) {
        const boundHandler = handler.bind(this);
        this.subscriptions.push({ eventName, handler: boundHandler });
        this.eventAggregator.subscribe(eventName, boundHandler);
    }

    /**
     * [NEW] (v6298-fix-4) Destroys all subscriptions
     */
    destroy() {
        this.subscriptions.forEach(({ eventName, handler }) => {
            this.eventAggregator.unsubscribe(eventName, handler);
        });
        this.subscriptions = [];
        clearInterval(this.autoSaveTimerId); // Stop autosave timer
        console.log("AppController destroyed.");
    }

    /**
     * [NEW] Manage UI lock state with reasons
     * Ensures UI stays locked if MULTIPLE reasons exist (e.g. Mode + Process)
     */
    _updateLock(reason, shouldLock) {
        if (shouldLock) {
            this.activeLocks.add(reason);
        } else {
            this.activeLocks.delete(reason);
        }

        const isLocked = this.activeLocks.size > 0;
        this._setUILock(isLocked);
    }

    /**
     * [MODIFIED] Phase 9.0: Deduplicates lock state — only applies + logs on actual transitions
     */
    _setUILock(locked) {
        // Phase 9.0: Skip if state hasn't changed
        if (this._lastLockState === locked) return;
        this._lastLockState = locked;

        if (locked) {
            document.body.classList.add('global-ui-locked');
            console.log(`🔒 [UI Lock] Locked | Time: ${performance.now()}`);
        } else {
            document.body.classList.remove('global-ui-locked');
            console.log(`🔓 [UI Lock] Unlocked | Time: ${performance.now()}`);
        }
    }

    // [DELETED] (Phase 3) _withUILock 已被徹底刪除，全面改用 executeWithStateLock

    /**
     * [NEW] (Phase 2 PoC) 狀態鎖樞紐
     * 嚴格的 async/await 鎖定機制，取代 _withUILock 的 setTimeout 模式。
     * 由 InputHandler 層直接呼叫，確保整條 Promise 鏈從頭到尾被 await。
     * [MODIFIED] (Phase 11.4a) Added 15s safety timeout via Promise.race to prevent permanent deadlocks.
     * @param {Function} asyncAction - 要在鎖定狀態下執行的非同步函式
     */
    async executeWithStateLock(asyncAction) {
        const LOCK_TIMEOUT_MS = 15000;
        let timeoutId;
        console.log("🔒 [狀態 1] 系統鎖定，程序啟動");
        this._setUILock(true);
        this.stateService.dispatch(uiActions.setIsProcessing(true));
        try {
            const timeoutPromise = new Promise((resolve) => {
                timeoutId = setTimeout(() => {
                    console.warn(`[AppController] ⚠️ State lock timeout exceeded (${LOCK_TIMEOUT_MS}ms). Forcing unlock.`);
                    resolve();
                }, LOCK_TIMEOUT_MS);
            });
            await Promise.race([asyncAction(), timeoutPromise]);
        } catch (error) {
            console.error("❌ 程序執行錯誤:", error);
        } finally {
            clearTimeout(timeoutId);
            this.stateService.dispatch(uiActions.setIsProcessing(false));
            this._setUILock(false);
            console.log("🔓 [狀態 0] 程序結束，系統解鎖");
        }
    }

    initialize() {
        this._subscribeQuickQuoteEvents();
        this._subscribeDetailViewEvents();
        this._subscribeGlobalEvents();
        this._subscribeF1Events();
        this._subscribeF3Events();
        this._subscribeF4Events(); // [MODIFIED] Add F4 subscription group

        // [FIX] Phase 4.10b: Hard-bind listener to window object
        window.addEventListener('PRICES_UPDATED', () => {
            console.log("📥 [AppController] PRICES_UPDATED signal received!");

            if (this._priceUpdateTimer) {
                clearTimeout(this._priceUpdateTimer);
            }

            this._priceUpdateTimer = setTimeout(() => {
                const currentState = this.stateService.getState();
                console.log("📡 [Broadcast Flow] Executing calculation with fresh state.");
                // 注入當前 quoteData 確保計算服務不崩潰
                if (this.calculationService) {
                    this.calculationService.calculateF1Costs(currentState.quoteData);
                } else {
                    console.error("❌ CalculationService not found in AppController!");
                }
            }, 500);
        });

        // This is the core of the reactive state update.
        // Any service that updates the state via StateService will trigger this,
        // which in turn re-renders the UI.
        // [MODIFIED] (v6298-fix-4) Use helper
        this._subscribe(
            EVENTS.INTERNAL_STATE_UPDATED,
            (newState) => {
                // [NEW] State-based locking observability
                // Automatically lock whenever K3/K5 Dual/Chain or Drive/Accessory mode is active
                // [MODIFIED] (Phase 4.6c) If Correction Mode is ON, force isModeActive to FALSE to prevent auto-locking
                const isModeActive = (!!newState.ui.dualChainMode || !!newState.ui.driveAccessoryMode) && !newState.ui.isCorrectionMode;
                this._updateLock('mode', isModeActive);

                // [NEW] Global Processing Observer
                // Automatically lock whenever global processing flag is true
                this._updateLock('processing', !!newState.ui.isProcessing);

                // [NEW] (Phase 5) 使用者流程禁制令
                // 當 K1~K5 任何操作模式「啟動中」時，鎖定數字盤、F盤、K盤頁籤
                const isFlowActive = !!newState.ui.activeEditMode ||
                    !!newState.ui.dualChainMode ||
                    !!newState.ui.driveAccessoryMode;
                if (isFlowActive) {
                    document.body.classList.add('flow-locked');
                } else {
                    document.body.classList.remove('flow-locked');
                }

                this.eventAggregator.publish(EVENTS.STATE_CHANGED, newState);
            }
        );

        this._startAutoSave();
    }

    // [MODIFIED] (Phase 3) 全面遷移至 executeWithStateLock
    _subscribeQuickQuoteEvents() {
        const delegate = async (handlerName, ...args) => {
            if (typeof this.quickQuoteView[handlerName] === 'function') {
                await this.quickQuoteView[handlerName](...args);
            }
        };

        this._subscribe(EVENTS.NUMERIC_KEY_PRESSED, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleNumericKeyPress', data));
        });
        this._subscribe(EVENTS.USER_REQUESTED_INSERT_ROW, async () => {
            await this.executeWithStateLock(async () => await delegate('handleInsertRow'));
        });
        this._subscribe(EVENTS.USER_REQUESTED_DELETE_ROW, async () => {
            await this.executeWithStateLock(async () => await delegate('handleDeleteRow'));
        });
        this._subscribe(EVENTS.USER_REQUESTED_CLEAR_ROW, async () => {
            await this.executeWithStateLock(async () => await delegate('handleClearRow'));
        });
        this._subscribe(EVENTS.USER_MOVED_ACTIVE_CELL, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleMoveActiveCell', data));
        });
        this._subscribe(EVENTS.USER_REQUESTED_CYCLE_TYPE, async () => {
            await this.executeWithStateLock(async () => await delegate('handleCycleType'));
        });
        this._subscribe(EVENTS.USER_REQUESTED_CALCULATE_AND_SUM, async () => {
            await this.executeWithStateLock(async () => await delegate('handleCalculateAndSum'));
        });
        this._subscribe(EVENTS.USER_TOGGLED_MULTI_SELECT_MODE, async () => {
            await this.executeWithStateLock(async () => await delegate('handleToggleMultiSelectMode'));
        });
        this._subscribe(EVENTS.USER_REQUESTED_MULTI_TYPE_SET, async () => {
            await this.executeWithStateLock(async () => await delegate('handleMultiTypeSet'));
        });
        this._subscribe(EVENTS.TYPE_CELL_LONG_PRESSED, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleTypeCellLongPress', data));
        });
        this._subscribe(EVENTS.TYPE_BUTTON_LONG_PRESSED, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleTypeButtonLongPress', data));
        });
        // [FIX] (Phase 3.3f) Was EVENTS.USER_REQUESTED_SAVE_THEN_LOAD (undefined!) → ghost subscriber
        this._subscribe(EVENTS.USER_CHOSE_SAVE_THEN_LOAD, async () => {
            await this.executeWithStateLock(async () => await delegate('handleSaveThenLoad'));
        });
    }

    // [MODIFIED] (Phase 3) 全面遷移至 executeWithStateLock
    _subscribeDetailViewEvents() {
        const delegate = async (handlerName, data) => {
            const { ui } = this.stateService.getState();
            if (ui.currentView === 'DETAIL_CONFIG') {
                if (typeof this.detailConfigView[handlerName] === 'function') {
                    await this.detailConfigView[handlerName](data);
                }
            }
        };

        this._subscribe(EVENTS.TABLE_CELL_CLICKED, async (data) => {
            await this.executeWithStateLock(async () => {
                const { ui } = this.stateService.getState();
                if (ui.currentView === 'QUICK_QUOTE') {
                    await this.quickQuoteView.handleTableCellClick(data);
                } else {
                    await this.detailConfigView.handleTableCellClick(data);
                }
            });
        });
        this._subscribe(EVENTS.SEQUENCE_CELL_CLICKED, async (data) => {
            await this.executeWithStateLock(async () => {
                const { ui } = this.stateService.getState();
                if (ui.currentView === 'QUICK_QUOTE') {
                    await this.quickQuoteView.handleSequenceCellClick(data);
                } else {
                    await this.detailConfigView.handleSequenceCellClick(data);
                }
            });
        });

        // Detail Config View Specific Events
        this._subscribe(EVENTS.USER_REQUESTED_FOCUS_MODE, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleFocusModeRequest', data));
        });
        // K1: 鎖定已由 InputHandler 層的 executeWithStateLock 負責
        this._subscribe(EVENTS.LOCATION_INPUT_ENTER_PRESSED, async (data) => {
            await delegate('handleLocationInputEnter', data);
        });
        // K2
        this._subscribe(EVENTS.USER_TOGGLED_K2_MODE, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleModeToggle', data));
        });
        this._subscribe(EVENTS.USER_REQUESTED_LF_DELETE_MODE, async () => {
            await this.executeWithStateLock(async () => await delegate('handleLFDeleteRequest'));
        });
        // K2
        this._subscribe(EVENTS.USER_TOGGLED_K2_EDIT_MODE, async () => {
            await this.executeWithStateLock(async () => await delegate('handleToggleK2EditMode'));
        });
        this._subscribe(EVENTS.USER_REQUESTED_BATCH_CYCLE, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleBatchCycle', data));
        });
        // K5 Dual/Chain
        this._subscribe(EVENTS.DUAL_CHAIN_MODE_CHANGED, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleDualChainModeChange', data));
        });
        this._subscribe(EVENTS.CHAIN_ENTER_PRESSED, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleChainEnterPressed', data));
        });
        // K3 Drive/Accessories
        this._subscribe(EVENTS.DRIVE_MODE_CHANGED, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleDriveModeChange', data));
        });
        this._subscribe(EVENTS.ACCESSORY_COUNTER_CHANGED, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleAccessoryCounterChange', data));
        });
        // [NEW] (Phase 3.4c) K3 Batch events
        this._subscribe(EVENTS.K3_BATCH_START, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleK3BatchStart', data));
        });
        this._subscribe(EVENTS.K3_BATCH_CONFIRM, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleK3BatchConfirm', data));
        });
        this._subscribe(EVENTS.K3_BATCH_CANCEL, async (data) => {
            await this.executeWithStateLock(async () => await delegate('handleK3BatchCancel', data));
        });
    }

    _subscribeGlobalEvents() {
        this._subscribe(
            EVENTS.USER_NAVIGATED_TO_DETAIL_VIEW,
            () => this.workflowService.handleNavigationToDetailView()
        );
        this._subscribe(
            EVENTS.USER_NAVIGATED_TO_QUICK_QUOTE_VIEW,
            () => this.workflowService.handleNavigationToQuickQuoteView()
        );
        this._subscribe(EVENTS.USER_SWITCHED_TAB, (data) =>
            this.workflowService.handleTabSwitch(data)
        );
        // [MOVED] USER_REQUESTED_LOAD moved to _subscribeF4Events
        this._subscribe(
            EVENTS.USER_CHOSE_LOAD_DIRECTLY,
            () => this.workflowService.handleLoadDirectly()
        );
        this._subscribe(EVENTS.FILE_LOADED, (data) =>
            this.workflowService.handleFileLoad(data)
        );
    }

    _subscribeF1Events() {
        this._subscribe(EVENTS.F1_TAB_ACTIVATED, () =>
            this.workflowService.handleF1TabActivation()
        );
        this._subscribe(
            EVENTS.F1_DISCOUNT_CHANGED,
            (data) => this.workflowService.handleF1DiscountChange(data)
        );
    }

    _subscribeF3Events() {
        this._subscribe(
            EVENTS.USER_REQUESTED_PRINTABLE_QUOTE,
            () => this.workflowService.handlePrintableQuoteRequest()
        );
        // [NEW] (Phase 4, Step 1)
        this._subscribe(
            EVENTS.USER_REQUESTED_GMAIL_QUOTE,
            () => this.workflowService.handleGmailQuoteRequest()
        );
    }

    // [MODIFIED] (Phase 3) 全面遷移至 executeWithStateLock
    _subscribeF4Events() {
        this._subscribe(EVENTS.USER_REQUESTED_SAVE, async () => {
            await this.executeWithStateLock(async () => await this.quotePersistenceService.handleSaveToFile());
        });
        this._subscribe(EVENTS.USER_REQUESTED_SAVE_AS_NEW_VERSION, async () => {
            await this.executeWithStateLock(async () => await this.quotePersistenceService.handleSaveAsNewVersion());
        });
        this._subscribe(EVENTS.USER_REQUESTED_GENERATE_WORK_ORDER, async () => {
            await this.executeWithStateLock(async () => await this.workflowService.handleGenerateWorkOrder());
        });
        this._subscribe(EVENTS.USER_REQUESTED_GENERATE_EXCEL, async () => {
            await this.executeWithStateLock(async () => await this.quotePersistenceService.handleGenerateExcel());
        });
        this._subscribe(EVENTS.USER_REQUESTED_EXPORT_CSV, async () => {
            await this.executeWithStateLock(async () => await this.quotePersistenceService.handleExportCSV());
        });
        this._subscribe(EVENTS.USER_REQUESTED_LOAD, async () => {
            await this.executeWithStateLock(async () => await this.workflowService.handleUserRequestedLoad());
        });
        this._subscribe(EVENTS.USER_REQUESTED_LOAD_FROM_CLOUD, async () => {
            await this.executeWithStateLock(async () => await this.workflowService.handleLoadFromCloud());
        });
        // 無需鎖定的事件 (純 UI 操作，不涉及計算)
        this._subscribe(EVENTS.USER_REQUESTED_SEARCH_DIALOG, () => {
            this.workflowService.handleSearchDialogRequest();
        });
        this._subscribe(EVENTS.USER_REQUESTED_RESET, () => {
            this.workflowService.handleReset();
        });
        this._subscribe(EVENTS.USER_REQUESTED_UPDATE_STATUS, async (payload) => {
            await this.executeWithStateLock(async () => await this.quotePersistenceService.handleUpdateStatus(payload));
        });
        this._subscribe(EVENTS.USER_REQUESTED_CANCEL_CORRECT, () => {
            this.workflowService.handleCancelCorrectRequest();
        });
        this._subscribe(EVENTS.USER_REQUESTED_EXECUTE_CANCELLATION, async (payload) => {
            await this.executeWithStateLock(async () => await this.quotePersistenceService.handleCancelOrder(payload));
        });
        this._subscribe(EVENTS.USER_REQUESTED_EXIT_CORRECTION_MODE, () => {
            this.stateService.dispatch(uiActions.setCorrectionMode(false));
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Exited Correction Mode.',
                type: 'info'
            });
        });
    }

    // This is a special method used by AppContext to publish state, it needs access to stateService.
    _getFullState() {
        return this.stateService.getState();
    }

    publishInitialState() {
        const initialState = this._getFullState();
        this.eventAggregator.publish(EVENTS.STATE_CHANGED, initialState);

        // [NEW] Sync inputValue with the active cell's data after initial load/restore.
        const { ui, quoteData } = initialState;
        const { activeCell } = ui;
        const currentProductKey = quoteData.currentProduct;
        const items = quoteData.products[currentProductKey].items;

        if (activeCell && items[activeCell.rowIndex]) {
            const item = items[activeCell.rowIndex];
            const value = item[activeCell.column] || '';
            // Dispatch an action to update the inputValue in the UI state
            this.stateService.dispatch(uiActions.setInputValue(value));
        }
    }

    _startAutoSave() {
        if (this.autoSaveTimerId) {
            clearInterval(this.autoSaveTimerId);
        }
        this.autoSaveTimerId = setInterval(
            () => this._handleAutoSave(),
            AUTOSAVE_INTERVAL_MS
        );
    }

    _handleAutoSave() {
        try {
            const { quoteData } = this.stateService.getState();
            const items =
                quoteData.products[quoteData.currentProduct].items;
            if (!items) return;
            const hasContent =
                items.length > 1 ||
                (items.length === 1 && (items[0].width || items[0].height));
            if (hasContent) {
                const dataToSave = JSON.stringify(quoteData);
                localStorage.setItem(STORAGE_KEYS.AUTOSAVE, dataToSave);
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }
}