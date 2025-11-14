/* FILE: 04-core-code/ui/views/search-tab-s2-view.js */
// [MODIFIED] (Tweak 1) Removed unused _updateStatusBar helper.

import { EVENTS, DOM_IDS } from '../../config/constants.js';
import * as uiActions from '../../actions/ui-actions.js';
import * as quoteActions from '../../actions/quote-actions.js';

/**
 * @fileoverview A new sub-view dedicated to managing all logic
 * within the S2 (Results) tab of the search dialog.
 */
export class SearchTabS2View {
    constructor({ eventAggregator, stateService }) {
        if (!eventAggregator || !stateService) {
            throw new Error("SearchTabS2View requires an eventAggregator and stateService.");
        }
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;

        // 1. 快取 S2 的 DOM 元素
        // 由於 DOM 元素在 show() 之前可能不存在，我們將在 initialize() 中快取
        this.elements = {
            resultsList: null,
            resultsMessage: null,
            previewContent: null,
            loadBtn: null,
            // [REMOVED] Tweak 1: S2View 不再需要 statusBar
            // statusBar: null, 
        };

        this.boundHandlers = [];
        this.subscriptions = [];

        this.quotesMap = new Map();
        this.selectedQuoteData = null;

        console.log("SearchTabS2View Initialized.");
    }

    /**
     * Helper to add and store event listeners for easy removal.
     */
    _addListener(element, event, handler) {
        if (!element) return;
        const boundHandler = handler.bind(this);
        this.boundHandlers.push({ element, event, handler: boundHandler });
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
        this.boundHandlers.forEach(({ element, event, handler }) => {
            if (element) {
                element.removeEventListener(event, handler);
            }
        });
        this.boundHandlers = [];

        this.subscriptions.forEach(({ eventName, handler }) => {
            this.eventAggregator.unsubscribe(eventName, handler);
        });
        this.subscriptions = [];

        // [FIX] 重置 elements 快取
        this.elements = {
            resultsList: null, resultsMessage: null, previewContent: null,
            loadBtn: null, statusBar: null
        };
        // console.log("SearchTabS2View destroyed."); // 減少 console 噪音
    }

    _cacheElements() {
        // 快取 DOM，僅在尚未快取時執行
        if (this.elements.resultsList) return;

        this.elements = {
            resultsList: document.getElementById(DOM_IDS.SEARCH_RESULTS_LIST),
            resultsMessage: document.getElementById(DOM_IDS.SEARCH_RESULTS_MESSAGE),
            previewContent: document.getElementById(DOM_IDS.SEARCH_PREVIEW_CONTENT),
            loadBtn: document.getElementById(DOM_IDS.SEARCH_DIALOG_LOAD_BTN),
            // [REMOVED] Tweak 1: S2View 不再快取 statusBar
            // statusBar: document.getElementById(DOM_IDS.SEARCH_STATUS_BAR),
        };
    }

    /**
     * 2. 綁定事件監聽器
     */
    initialize() {
        // [NEW] 確保 DOM 元素已被快取
        this._cacheElements();

        // 監聽來自管理員的 "搜尋成功" 事件
        this._subscribe(EVENTS.SEARCH_RESULTS_SUCCESSFUL, this._renderResultsList);

        // 綁定結果列表的點擊事件
        this._addListener(this.elements.resultsList, 'click', this._onResultItemClick);

        // 綁定 "Load Selected" 按鈕的點擊事件
        this._addListener(this.elements.loadBtn, 'click', this._onLoadClick);
    }

    // --- 邏輯從 search-dialog-component.js 移轉過來 ---

    _renderResultsList(quotes) {
        // 儲存完整資料
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

        if (this.elements.resultsList) {
            this.elements.resultsList.innerHTML = html;
        }

        // 重置預覽窗格
        this._showPreviewMessage('Select a quote from the results list to see a preview.');
        if (this.elements.loadBtn) {
            this.elements.loadBtn.disabled = true;
        }
        this.selectedQuoteData = null;
    }

    _onResultItemClick(event) {
        const itemElement = event.target.closest('.search-result-item');
        if (!itemElement) return;

        const quoteId = itemElement.dataset.quoteId;
        const quoteData = this.quotesMap.get(quoteId);

        if (!quoteData) {
            this._showPreviewMessage('Error: Could not find quote data to preview.');
            return;
        }

        // 1. 突顯選中項目
        this.elements.resultsList.querySelectorAll('.search-result-item').forEach(el => {
            el.classList.toggle('is-selected', el.dataset.quoteId === quoteId);
        });

        // 2. 儲存資料
        this.selectedQuoteData = quoteData;

        // 3. 渲染預覽
        this._renderPreview(quoteData);

        // 4. 啟用 "Load" 按鈕
        if (this.elements.loadBtn) {
            this.elements.loadBtn.disabled = false;
        }
    }

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
        if (this.elements.previewContent) {
            this.elements.previewContent.innerHTML = html;
        }
    }

    _onLoadClick() {
        if (!this.selectedQuoteData) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Please select a quote from the list first.',
                type: 'error'
            });
            return;
        }

        console.log(`S2View: Loading quote: ${this.selectedQuoteData.quoteId}`);

        // --- 複製 WorkflowService._dispatchLoadActions 的邏輯 ---
        // 1. 設定新的 quote data
        this.stateService.dispatch(quoteActions.setQuoteData(this.selectedQuoteData));

        // 2. 重置 UI 狀態
        this.stateService.dispatch(uiActions.resetUi());

        // 3. 還原 F1 Snapshot
        if (this.selectedQuoteData.f1Snapshot) {
            this.stateService.dispatch(
                uiActions.restoreF1Snapshot(this.selectedQuoteData.f1Snapshot)
            );
        }

        // 4. 還原 F2 Snapshot
        if (this.selectedQuoteData.f2Snapshot) {
            this.stateService.dispatch(
                uiActions.restoreF2Snapshot(this.selectedQuoteData.f2Snapshot)
            );
        }

        // 5. 標記總和為過期並通知
        this.stateService.dispatch(uiActions.setSumOutdated(true));
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: `Successfully loaded quote ${this.selectedQuoteData.quoteId}`,
        });

        // 6. S2View 不應該知道如何關閉對話方塊。
        // 我們發布一個事件，請求管理員關閉。
        this.eventAggregator.publish(EVENTS.USER_REQUESTED_CLOSE_SEARCH_DIALOG);
    }

    // --- UI 輔助方法 (移轉過來) ---
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

    // [REMOVED] Tweak 1: 移除 S2View 中的 _updateStatusBar
    /*
    _updateStatusBar(message) {
        if (this.elements.statusBar) {
            this.elements.statusBar.textContent = message;
        }
    }
    */
}