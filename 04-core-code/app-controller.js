/* FILE: 04-core-code/app-controller.js */
// [MODIFIED] (v6297 瘦身) 階段 2：注入 quotePersistenceService 並重新路由 F4 事件。

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
        quotePersistenceService // [NEW] (v6297 瘦身) 注入新服務
    }) {
        this.eventAggregator = eventAggregator;
        this.stateService = stateService; // Still needed for _getFullState and _handleAutoSave
        this.quickQuoteView = quickQuoteView;
        this.detailConfigView = detailConfigView;
        this.workflowService = workflowService;
        this.quotePersistenceService = quotePersistenceService; // [NEW] (v6297 瘦身) 儲存新服務

        this.autoSaveTimerId = null;
        this.subscriptions = []; // [NEW] (v6298-fix-4) Store subscriptions
        console.log(
            'AppController (Refactored with grouped subscriptions) Initialized.'
        );
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

    initialize() {
        this._subscribeQuickQuoteEvents();
        this._subscribeDetailViewEvents();
        this._subscribeGlobalEvents();
        this._subscribeF1Events();
        this._subscribeF3Events();
        this._subscribeF4Events(); // [MODIFIED] Add F4 subscription group

        // This is the core of the reactive state update.
        // Any service that updates the state via StateService will trigger this,
        // which in turn re-renders the UI.
        // [MODIFIED] (v6298-fix-4) Use helper
        this._subscribe(
            EVENTS.INTERNAL_STATE_UPDATED,
            (newState) => {
                this.eventAggregator.publish(EVENTS.STATE_CHANGED, newState);
            }
        );

        this._startAutoSave();
    }

    _subscribeQuickQuoteEvents() {
        const delegate = (handlerName, ...args) =>
            this.quickQuoteView[handlerName](...args);

        // [MODIFIED] (v6298-fix-4) Use helper for all subscriptions
        this._subscribe(EVENTS.NUMERIC_KEY_PRESSED, (data) =>
            delegate('handleNumericKeyPress', data)
        );
        this._subscribe(
            EVENTS.USER_REQUESTED_INSERT_ROW,
            () => delegate('handleInsertRow')
        );
        this._subscribe(
            EVENTS.USER_REQUESTED_DELETE_ROW,
            () => delegate('handleDeleteRow')
        );
        // [MOVED] USER_REQUESTED_SAVE moved to _subscribeF4Events
        // [MOVED] USER_REQUESTED_EXPORT_CSV moved to _subscribeF4Events
        // [MOVED] USER_REQUESTED_RESET moved to _subscribeF4Events
        this._subscribe(
            EVENTS.USER_REQUESTED_CLEAR_ROW,
            () => delegate('handleClearRow')
        );
        this._subscribe(
            EVENTS.USER_MOVED_ACTIVE_CELL,
            (data) => delegate('handleMoveActiveCell', data)
        );
        this._subscribe(
            EVENTS.USER_REQUESTED_CYCLE_TYPE,
            () => delegate('handleCycleType')
        );
        this._subscribe(
            EVENTS.USER_REQUESTED_CALCULATE_AND_SUM,
            () => delegate('handleCalculateAndSum')
        );
        this._subscribe(
            EVENTS.USER_TOGGLED_MULTI_SELECT_MODE,
            () => delegate('handleToggleMultiSelectMode')
        );
        this._subscribe(
            EVENTS.USER_REQUESTED_MULTI_TYPE_SET,
            () => delegate('handleMultiTypeSet')
        );
        this._subscribe(
            EVENTS.TYPE_CELL_LONG_PRESSED,
            (data) => delegate('handleTypeCellLongPress', data)
        );
        this._subscribe(
            EVENTS.TYPE_BUTTON_LONG_PRESSED,
            (data) => delegate('handleTypeButtonLongPress', data)
        );
        this._subscribe(
            EVENTS.USER_REQUESTED_SAVE_THEN_LOAD,
            () => delegate('handleSaveThenLoad')
        );
    }

    _subscribeDetailViewEvents() {
        const delegate = (handlerName, data) => {
            const { ui } = this.stateService.getState();
            if (ui.currentView === 'DETAIL_CONFIG') {
                this.detailConfigView[handlerName](data);
            }
        };
        this._subscribe(EVENTS.TABLE_CELL_CLICKED, (data) => {
            const { ui } = this.stateService.getState();
            if (ui.currentView === 'QUICK_QUOTE') {
                this.quickQuoteView.handleTableCellClick(data);
            } else {
                this.detailConfigView.handleTableCellClick(data);
            }
        });
        this._subscribe(EVENTS.SEQUENCE_CELL_CLICKED, (data) => {
            const { ui } = this.stateService.getState();
            if (ui.currentView === 'QUICK_QUOTE') {
                this.quickQuoteView.handleSequenceCellClick(data);
            } else {
                this.detailConfigView.handleSequenceCellClick(data);
            }
        });

        // Detail Config View Specific Events
        this._subscribe(
            EVENTS.USER_REQUESTED_FOCUS_MODE,
            (data) => delegate('handleFocusModeRequest', data)
        );
        // [REMOVED] (Phase 3 Cleanup) Obsolete panel events
        // this._subscribe(EVENTS.PANEL_INPUT_ENTER_PRESSED, (data) => delegate('handlePanelInputEnter', data));
        // this._subscribe(EVENTS.PANEL_INPUT_BLURRED, (data) => delegate('handlePanelInputBlur', data));
        this._subscribe(
            EVENTS.LOCATION_INPUT_ENTER_PRESSED,
            (data) => delegate('handleLocationInputEnter', data)
        );
        // [NEW] (v6294) Add subscription for K2 mode toggle
        this._subscribe(
            EVENTS.USER_TOGGLED_K2_MODE,
            (data) => delegate('handleModeToggle', data)
        );
        // [REMOVED] (Phase 3 Cleanup) Obsolete K2 mode events
        // this._subscribe(EVENTS.USER_REQUESTED_LF_EDIT_MODE, () => delegate('handleLFEditRequest'));
        this._subscribe(
            EVENTS.USER_REQUESTED_LF_DELETE_MODE,
            () => delegate('handleLFDeleteRequest')
        );
        // this._subscribe(EVENTS.USER_REQUESTED_SSET_MODE, () => delegate('handleSSetRequest'));
        this._subscribe(
            EVENTS.USER_TOGGLED_K3_EDIT_MODE,
            () => delegate('handleToggleK3EditMode')
        );
        this._subscribe(
            EVENTS.USER_REQUESTED_BATCH_CYCLE,
            (data) => delegate('handleBatchCycle', data)
        );

        this._subscribe(
            EVENTS.DUAL_CHAIN_MODE_CHANGED,
            (data) => delegate('handleDualChainModeChange', data)
        );
        this._subscribe(
            EVENTS.CHAIN_ENTER_PRESSED,
            (data) => delegate('handleChainEnterPressed', data)
        );
        this._subscribe(
            EVENTS.DRIVE_MODE_CHANGED,
            (data) => delegate('handleDriveModeChange', data)
        );
        this._subscribe(
            EVENTS.ACCESSORY_COUNTER_CHANGED,
            (data) => delegate('handleAccessoryCounterChange', data)
        );
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

    // [NEW] Centralized subscription for all F4 actions, delegating to WorkflowService.
    _subscribeF4Events() {
        // [MODIFIED] (v6297 瘦身) 階段 2：重新路由 SAVE 事件
        this._subscribe(EVENTS.USER_REQUESTED_SAVE, () =>
            this.quotePersistenceService.handleSaveToFile()
        );
        // [MODIFIED] (v6297 瘦身) 階段 2：重新路由 SAVE_AS_NEW_VERSION 事件
        this._subscribe(EVENTS.USER_REQUESTED_SAVE_AS_NEW_VERSION, () =>
            this.quotePersistenceService.handleSaveAsNewVersion()
        );
        // [NEW] ?段 1: 綁å?工單事件 (此事件仍由 workflowService 處理)
        this._subscribe(EVENTS.USER_REQUESTED_GENERATE_WORK_ORDER, () =>
            this.workflowService.handleGenerateWorkOrder()
        );
        // [MODIFIED] (v6297 瘦身) 階段 2：重新路由 EXPORT_CSV 事件
        this._subscribe(EVENTS.USER_REQUESTED_EXPORT_CSV, () =>
            this.quotePersistenceService.handleExportCSV()
        );
        // (此事件仍由 workflowService 處理)
        this._subscribe(EVENTS.USER_REQUESTED_LOAD, () =>
            this.workflowService.handleUserRequestedLoad()
        );
        // [NEW] (Bug Fix) Add the missing subscription for the old cloud load event (which will now fail)
        this._subscribe(
            EVENTS.USER_REQUESTED_LOAD_FROM_CLOUD,
            () => this.workflowService.handleLoadFromCloud()
        );
        // [NEW] (v6298) Add subscription for the new search dialog event
        this._subscribe(
            EVENTS.USER_REQUESTED_SEARCH_DIALOG,
            () => this.workflowService.handleSearchDialogRequest()
        );
        // (此事件仍由 workflowService 處理)
        this._subscribe(EVENTS.USER_REQUESTED_RESET, () =>
            this.workflowService.handleReset()
        );
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