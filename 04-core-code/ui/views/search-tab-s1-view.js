/* FILE: 04-core-code/ui/views/search-tab-s1-view.js */
// [NEW] 階段 3：S1 (篩選器) 子視圖

import { EVENTS, DOM_IDS } from '../../config/constants.js';

/**
 * @fileoverview A new sub-view dedicated to managing all logic
 * within the S1 (Filters) tab of the search dialog.
 */
export class SearchTabS1View {
    constructor({ eventAggregator }) {
        if (!eventAggregator) {
            throw new Error("SearchTabS1View requires an eventAggregator.");
        }
        this.eventAggregator = eventAggregator;

        // [NEW] (v6298-fix-5) Store bound handlers
        this.boundHandlers = [];

        // 1. 快取所有 S1 的 DOM 元素
        // 由於 DOM 元素在 show() 之前可能不存在，我們將在 initialize() 中快取
        this.elements = {
            searchBtn: null,
            filters: {
                name: null,
                phone: null,
                email: null,
                postcode: null,
                year: null,
                month: null,
                hasMotor: null,
            }
        };

        console.log("SearchTabS1View Initialized.");
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
        // [FIX] 重置 elements 快取，以便下次 initialize
        this.elements = {
            searchBtn: null,
            filters: {
                name: null, phone: null, email: null, postcode: null,
                year: null, month: null, hasMotor: null
            }
        };
        // console.log("SearchTabS1View destroyed."); // 減少 console 噪音
    }

    _cacheElements() {
        // 快取 DOM，僅在尚未快取時執行
        if (this.elements.searchBtn) return;

        this.elements = {
            searchBtn: document.getElementById(DOM_IDS.SEARCH_DIALOG_SEARCH_BTN),
            filters: {
                name: document.getElementById(DOM_IDS.SEARCH_FILTER_NAME),
                phone: document.getElementById(DOM_IDS.SEARCH_FILTER_PHONE),
                email: document.getElementById(DOM_IDS.SEARCH_FILTER_EMAIL),
                postcode: document.getElementById(DOM_IDS.SEARCH_FILTER_POSTCODE),
                year: document.getElementById(DOM_IDS.SEARCH_FILTER_YEAR),
                month: document.getElementById(DOM_IDS.SEARCH_FILTER_MONTH),
                hasMotor: document.getElementById(DOM_IDS.SEARCH_FILTER_HAS_MOTOR),
            }
        };
    }

    /**
     * 2. 綁定事件監聽器
     */
    initialize() {
        // [NEW] 確保 DOM 元素已被快取
        this._cacheElements();

        // 綁定 "Search" 按鈕
        this._addListener(this.elements.searchBtn, 'click', this._onSearchClick);

        // 為所有篩選器綁定 Enter 鍵
        Object.values(this.elements.filters).forEach(input => {
            this._addListener(input, 'keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._onSearchClick();
                }
            });
        });
    }

    /**
     * 3. 蒐集篩選條件並發布事件
     */
    _onSearchClick() {
        // 蒐集所有篩選器的值
        const filters = {
            name: this.elements.filters.name.value.trim(),
            phone: this.elements.filters.phone.value.trim(),
            email: this.elements.filters.email.value.trim().toLowerCase(),
            postcode: this.elements.filters.postcode.value.trim(),
            year: parseInt(this.elements.filters.year.value, 10) || null,
            month: parseInt(this.elements.filters.month.value, 10) || null,
        };

        // 轉換 "true" / "false" 字串為布林值
        const motorFilter = this.elements.filters.hasMotor.value;
        if (motorFilter === 'true') {
            filters.hasMotor = true;
        } else if (motorFilter === 'false') {
            filters.hasMotor = false;
        }

        // 發布事件，將篩選條件交給管理員 (SearchDialogComponent)
        this.eventAggregator.publish(EVENTS.USER_REQUESTED_EXECUTE_SEARCH, { filters });
    }

    /**
     * 4. (可選) 在頁籤切換到 S1 時，自動 focus
     */
    activate() {
        // [NEW] 確保 DOM 元素已被快取
        this._cacheElements();
        setTimeout(() => {
            this.elements.filters.name?.focus();
        }, 50); // 延遲以確保元素可見
    }
}