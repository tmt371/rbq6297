/* FILE: 04-core-code/ui/search-dialog-component.js */
// [MODIFIED] (v6298-F4-Search) This component manages the advanced search UI.
// [MODIFIED] (Tweak 1) Removed statusBar updates, replaced with Toast notifications.
// [MODIFIED] (Tweak 2) Added ReDo button logic.

import { EVENTS, DOM_IDS } from '../config/constants.js';
// [NEW] (v6298-F4-Search) Import new advanced search function and state actions
import { searchQuotesAdvanced } from '../services/online-storage-service.js';
import * as uiActions from '../actions/ui-actions.js';
import * as quoteActions from '../actions/quote-actions.js';
// [REMOVED] 階段 4：不再需要 import S1/S2，它們由 app-context 注入

export class SearchDialogComponent {
    constructor({ containerElement, eventAggregator, stateService, authService, s1View, s2View }) { // [MODIFIED] 階段 4：接收 s1View, s2View
        if (!containerElement || !eventAggregator || !stateService || !authService) {
            throw new Error("SearchDialogComponent requires container, eventAggregator, stateService, and authService.");
        }
        // [MODIFIED] 階段 4：s1View 和 s2View 也是必要的
        if (!s1View || !s2View) {
            throw new Error("SearchDialogComponent requires s1View and s2View.");
        }

        this.container = containerElement;
        this.eventAggregator = eventAggregator;
        // [NEW] Store injected services
        this.stateService = stateService;
        this.authService = authService;

        // [NEW] 階段 4：儲存子視圖實例
        this.s1View = s1View;
        this.s2View = s2View;

        this.box = this.container.querySelector('.search-dialog-box');

        // [REMOVED] 階段 3：S2 邏輯已移至 S2View
        // this.selectedQuoteData = null; 

        // [MODIFIED] 階段 3：快取 DOM 元素 (大幅簡化)
        // 只快取管理員自身需要的元素
        this.elements = {
            closeBtn: this.container.querySelector(`#${DOM_IDS.SEARCH_DIALOG_CLOSE_BTN}`),
            // [REMOVED] Tweak 1: 不再快取 statusBar
            // statusBar: this.container.querySelector(`#${DOM_IDS.SEARCH_STATUS_BAR}`),

            // [NEW] Tweak 2: 快取 ReDo 按鈕
            redoBtn: this.container.querySelector('#search-dialog-redo-btn'),

            // --- 頁籤管理 DOM ---
            tabContainer: this.container.querySelector('.search-tab-nav'),
            tabButtons: {
                s1: this.container.querySelector('#search-tab-s1'),
                s2: this.container.querySelector('#search-tab-s2'),
            },
            tabContents: {
                s1: this.container.querySelector('#s1-content'),
                s2: this.container.querySelector('#s2-content'),
            }
            // --- [REMOVED] S1 (filters) 和 S2 (resultsList, previewContent, loadBtn) 的 DOM 快取 ---
        };

        // Store subscriptions and listeners for destruction
        this.subscriptions = [];
        this.boundListeners = new Map();

        // [MODIFIED] 階段 4：(關鍵修復) 在 constructor 中呼叫 initialize()
        this.initialize();
        console.log("SearchDialogComponent Refactored as Manager.");
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

    /**
     * [MODIFIED] 階段 4：
     * 此 initialize 現在只綁定管理員自身的事件。
     */
    initialize() {
        // --- Subscribe to global events ---
        // (關鍵修復) 綁定 SHOW_SEARCH_DIALOG 事件
        this._subscribe(EVENTS.SHOW_SEARCH_DIALOG, this.show);

        // --- [NEW] 階段 3：監聽來自 S1View 的搜尋請求 ---
        this._subscribe(EVENTS.USER_REQUESTED_EXECUTE_SEARCH, this._onExecuteSearch);

        // [NEW] 階段 3：監聽來自 S2View 的關閉請求 (從 S2View 的 _onLoadClick 過來)
        this._subscribe(EVENTS.USER_REQUESTED_CLOSE_SEARCH_DIALOG, this.hide);

        // --- Bind internal UI element events ---
        this._addListener(this.elements.closeBtn, 'click', this.hide);
        this._addListener(this.container, 'click', this._onOverlayClick);

        // --- [NEW] Tweak 2: 綁定 ReDo 按鈕事件 ---
        this._addListener(this.elements.redoBtn, 'click', this._onReDoClick);

        // --- [REMOVED] 階段 3：S1 (searchBtn) 和 S2 (loadBtn, resultsList) 的監聽器 ---

        // --- 頁籤切換 (階段 2 邏輯保留) ---
        this._addListener(this.elements.tabButtons.s1, 'click', () => this._switchTab('search-tab-s1'));
        this._addListener(this.elements.tabButtons.s2, 'click', () => this._switchTab('search-tab-s2'));
    }

    // --- [RETAINED] 階段 2：頁籤切換邏輯 ---
    /**
     * 處理 S1/S2 頁籤按鈕和內容窗格之間的 active class 切換
     * @param {string} tabId - 要切換到的頁籤 ID (例如 'search-tab-s1')
     */
    _switchTab(tabId) {
        // 處理按鈕
        Object.values(this.elements.tabButtons).forEach(button => {
            if (button) {
                button.classList.toggle('active', button.id === tabId);
            }
        });

        // 處理內容窗格
        if (this.elements.tabContents.s1) {
            this.elements.tabContents.s1.classList.toggle('active', tabId === 'search-tab-s1');
        }
        if (this.elements.tabContents.s2) {
            this.elements.tabContents.s2.classList.toggle('active', tabId === 'search-tab-s2');
        }

        // [NEW] 階段 4：(可選) S1 focus 邏輯
        if (tabId === 'search-tab-s1' && typeof this.s1View?.activate === 'function') {
            this.s1View.activate();
        }
    }


    show() {
        // [MODIFIED] 階段 4：注入 S1/S2 View 後，在這裡初始化它們
        if (this.s1View && typeof this.s1View.initialize === 'function') {
            this.s1View.initialize();
        }
        if (this.s2View && typeof this.s2View.initialize === 'function') {
            this.s2View.initialize();
        }

        this._resetSearch(); // Reset to a clean state every time it's opened
        this.container.classList.remove('is-hidden');
        this.stateService.dispatch(uiActions.setModalActive(true)); // [NEW] Lock background app

        // [MODIFIED] 階段 4：Focus 邏輯現在交給 S1View
        if (typeof this.s1View?.activate === 'function') {
            this.s1View.activate();
        }
    }

    hide() {
        this.container.classList.add('is-hidden');
        this.stateService.dispatch(uiActions.setModalActive(false)); // [NEW] Unlock background app

        // [NEW] 階段 4：銷毀 S1/S2 View 的監聽器
        if (this.s1View && typeof this.s1View.destroy === 'function') {
            this.s1View.destroy();
        }
        if (this.s2View && typeof this.s2View.destroy === 'function') {
            this.s2View.destroy();
        }
    }

    // [MODIFIED] 階段 3：_resetSearch 大幅簡化
    _resetSearch() {
        // [REMOVED] Tweak 1: 移除 _updateStatusBar

        // 確保 S1 頁籤永遠是預設值
        this._switchTab('search-tab-s1');
    }

    _onOverlayClick(event) {
        if (event.target === this.container) {
            this.hide();
        }
    }

    // --- [NEW] Tweak 2: ReDo 按鈕邏輯 ---
    _onReDoClick() {
        // 切換回 S1
        this._switchTab('search-tab-s1');

        // S1View 已經被注入，呼叫它的 activate 方法來 focus
        if (typeof this.s1View?.activate === 'function') {
            this.s1View.activate();
        }
    }

    // --- [NEW] 階段 3：_onExecuteSearch (取代 _onSearchClick) ---
    /**
     * 監聽 S1View 發出的 USER_REQUESTED_EXECUTE_SEARCH 事件
     * @param {object} data - 包含 { filters } 的物件
     */
    async _onExecuteSearch({ filters }) {
        const uid = this.authService.currentUser?.uid;
        if (!uid) {
            // [MODIFIED] Tweak 1: 改為土司
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Error: You are not logged in.',
                type: 'error'
            });
            return;
        }

        // 簡單驗證 (雖然 S1View 也做了)
        if (Object.values(filters).every(v => !v && v !== false)) {
            // [MODIFIED] Tweak 1: 改為土司
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Please enter at least one search criteria.',
                type: 'error'
            });
            return;
        }

        // 2. 執行搜尋
        // [MODIFIED] Tweak 1: 改為土司
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: 'Searching...',
            type: 'info'
        });

        const result = await searchQuotesAdvanced(uid, filters);

        // [MODIFIED] Tweak 1: 移除 statusBar 更新
        // this._updateStatusBar(result.message);

        // 3. 處理結果
        if (result.success) {
            // [NEW] Tweak 1: 發布土司訊息
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: result.message, // "Found X quotes." or "No quotes found..."
                type: 'info'
            });

            // [MODIFIED] 階段 3：
            // A. 將結果數據發布給 S2View
            this.eventAggregator.publish(EVENTS.SEARCH_RESULTS_SUCCESSFUL, result.data);

            // B. 自動切換到 S2 頁籤
            this._switchTab('search-tab-s2');

        } else if (result.needsIndex) {
            // 索引錯誤
            // [MODIFIED] Tweak 1: 改為土司
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Index required. Link logged to console.',
                type: 'error'
            });
        } else {
            // 其他錯誤
            // [MODIFIED] Tweak 1: 改為土司
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: `Error: ${result.message}`,
                type: 'error'
            });
        }
    }


    // --- [REMOVED] 階段 3：S2 的所有邏輯已移至 S2View ---

    // --- [REMOVED] Tweak 1：_updateStatusBar 已不再需要 ---
}