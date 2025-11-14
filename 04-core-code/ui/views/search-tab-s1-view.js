/* FILE: 04-core-code/ui/views/search-tab-s1-view.js */
// [MODIFIED] (Tweak 1) Added clearFilters().
// [MODIFIED] (Tweak 2/3) Implemented focus navigation.

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

        // [NEW] Tweak 2: 焦點順序
        this.focusOrder = [
            'name', 'phone', 'email', 'postcode', 'year', 'month', 'hasMotor', 'searchBtn'
        ];

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
     * [MODIFIED] Tweak 2 & 3: 綁定焦點導航
     */
    initialize() {
        // [NEW] 確保 DOM 元素已被快取
        this._cacheElements();

        // 綁定 "Search" 按鈕
        this._addListener(this.elements.searchBtn, 'click', this._onSearchClick);

        // [MODIFIED] Tweak 2 & 3: 為 focusOrder 中的所有元素綁定 Enter/Tab 導航
        this.focusOrder.forEach((key, index) => {
            // 取得 DOM 元素 (可能是 filter input 或 searchBtn)
            const element = this.elements.filters[key] || this.elements[key];
            if (!element) return;

            this._addListener(element, 'keydown', (e) => {
                if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
                    e.preventDefault();

                    // Tweak 3: 如果在 Search 按鈕上按 Enter，觸發點擊
                    if (key === 'searchBtn' && e.key === 'Enter') {
                        this._onSearchClick();
                        return;
                    }

                    // Tweak 2: 跳轉到下一個
                    const nextIndex = (index + 1) % this.focusOrder.length;
                    const nextKey = this.focusOrder[nextIndex];
                    const nextElement = this.elements.filters[nextKey] || this.elements[nextKey];

                    if (nextElement) {
                        nextElement.focus();
                        // Tweak 2: 全選下一個欄位的內容
                        if (typeof nextElement.select === 'function') {
                            nextElement.select();
                        }
                    }
                }
            });

            // Tweak 2: 點擊時也全選
            this._addListener(element, 'focus', (e) => {
                if (typeof e.target.select === 'function') {
                    e.target.select();
                }
            });
        });
    }

    // [NEW] Tweak 1: 清空所有篩選器
    clearFilters() {
        if (!this.elements.filters.name) {
            this._cacheElements(); // 確保元素已快取
        }
        Object.values(this.elements.filters).forEach(input => {
            if (input) {
                input.value = '';
            }
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
            this.elements.filters.name?.select(); // Tweak 2: 啟用時也全選
        }, 50); // 延遲以確保元素可見
    }
}