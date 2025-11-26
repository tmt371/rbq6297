/* FILE: 04-core-code/ui/search-dialog-component.js */
// [MODIFIED] (v6298-F4-Search) This component manages the advanced search UI.
// [MODIFIED] (Tweak 1) Removed statusBar updates, replaced with Toast notifications.
// [MODIFIED] (Tweak 2) Added ReDo button logic.
// [MODIFIED] (Final Cleanup) Added memory leak prevention in destroy().

import { EVENTS, DOM_IDS } from '../config/constants.js';
// [NEW] (v6298-F4-Search) Import new advanced search function and state actions
import { searchQuotesAdvanced } from '../services/online-storage-service.js';
import * as uiActions from '../actions/ui-actions.js';
import * as quoteActions from '../actions/quote-actions.js';
// [REMOVED] ?Оцо╡ 4я╝Ъф??Нщ?шж?import S1/S2я╝Мх??СчФ▒ app-context ц│ихЕе

export class SearchDialogComponent {
    constructor({ containerElement, eventAggregator, stateService, authService, s1View, s2View }) { // [MODIFIED] ?Оцо╡ 4я╝ЪцОе??s1View, s2View
        if (!containerElement || !eventAggregator || !stateService || !authService) {
            throw new Error("SearchDialogComponent requires container, eventAggregator, stateService, and authService.");
        }
        // [MODIFIED] ?Оцо╡ 4я╝Ъs1View ??s2View ф╣ЯцШпх┐Еш???
        if (!s1View || !s2View) {
            throw new Error("SearchDialogComponent requires s1View and s2View.");
        }

        this.container = containerElement;
        this.eventAggregator = eventAggregator;
        // [NEW] Store injected services
        this.stateService = stateService;
        this.authService = authService;

        // [NEW] ?Оцо╡ 4я╝ЪхД▓хнШх?шжЦх?хпжф?
        this.s1View = s1View;
        this.s2View = s2View;

        this.box = this.container.querySelector('.search-dialog-box');

        // [REMOVED] ?Оцо╡ 3я╝ЪS2 ?Пш╝пх╖▓чз╗??S2View
        // this.selectedQuoteData = null; 

        // [MODIFIED] ?Оцо╡ 3я╝Ъх┐л??DOM ?Гч? (хдзх?ч░бх?)
        // ?кх┐л?Цчоб?ЖхУб?кш║л?АшжБч??Гч?
        this.elements = {
            closeBtn: this.container.querySelector(`#${DOM_IDS.SEARCH_DIALOG_CLOSE_BTN}`),
            // [REMOVED] Tweak 1: ф╕Нх?х┐лх? statusBar
            // statusBar: this.container.querySelector(`#${DOM_IDS.SEARCH_STATUS_BAR}`),

            // [NEW] Tweak 2: х┐лх? ReDo ?Йщ?
            redoBtn: this.container.querySelector('#search-dialog-redo-btn'),

            // --- ?Бч▒дчобч? DOM ---
            tabContainer: this.container.querySelector('.search-tab-nav'),
            tabButtons: {
                s1: this.container.querySelector('#search-tab-s1'),
                s2: this.container.querySelector('#search-tab-s2'),
            },
            tabContents: {
                s1: this.container.querySelector('#s1-content'),
                s2: this.container.querySelector('#s2-content'),
            }
            // --- [REMOVED] S1 (filters) ??S2 (resultsList, previewContent, loadBtn) ??DOM х┐лх? ---
        };

        // Store subscriptions and listeners for destruction
        this.subscriptions = [];
        this.boundListeners = new Map();

        // [MODIFIED] ?Оцо╡ 4я╝??ЬщН╡ф┐ох╛й) ??constructor ф╕нхС╝??initialize()
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

        // [NEW] (Final Cleanup) Explicitly release sub-views to prevent memory leaks
        this.s1View = null;
        this.s2View = null;

        console.log("SearchDialogComponent destroyed.");
    }

    /**
     * [MODIFIED] ?Оцо╡ 4я╝?
     * цн?initialize ?╛хЬи?кч?хоЪчоб?ЖхУб?кш║л?Дф?ф╗╢уА?
     */
    initialize() {
        // --- Subscribe to global events ---
        // (?ЬщН╡ф┐ох╛й) ч╢Бх? SHOW_SEARCH_DIALOG ф║Лф╗╢
        this._subscribe(EVENTS.SHOW_SEARCH_DIALOG, this.show);

        // --- [NEW] ?Оцо╡ 3я╝ЪчЫг?╜ф???S1View ?Дц?х░Лш?ц▒?---
        this._subscribe(EVENTS.USER_REQUESTED_EXECUTE_SEARCH, this._onExecuteSearch);

        // [NEW] ?Оцо╡ 3я╝ЪчЫг?╜ф???S2View ?Дщ??Йш?ц▒?(х╛?S2View ??_onLoadClick ?Оф?)
        this._subscribe(EVENTS.USER_REQUESTED_CLOSE_SEARCH_DIALOG, this.hide);

        // --- Bind internal UI element events ---
        this._addListener(this.elements.closeBtn, 'click', this.hide);
        this._addListener(this.container, 'click', this._onOverlayClick);

        // --- [NEW] Tweak 2: ч╢Бх? ReDo ?Йщ?ф║Лф╗╢ ---
        this._addListener(this.elements.redoBtn, 'click', this._onReDoClick);

        // --- [REMOVED] ?Оцо╡ 3я╝ЪS1 (searchBtn) ??S2 (loadBtn, resultsList) ?ДчЫг?╜хЩи ---

        // --- ?Бч▒д?Зц? (?Оцо╡ 2 ?Пш╝пф┐Эч?) ---
        this._addListener(this.elements.tabButtons.s1, 'click', () => this._switchTab('search-tab-s1'));
        this._addListener(this.elements.tabButtons.s2, 'click', () => this._switchTab('search-tab-s2'));
    }

    // --- [RETAINED] ?Оцо╡ 2я╝Ъщ?ч▒дх??Ыщ?ш╝?---
    /**
     * ?Хч? S1/S2 ?Бч▒д?Йщ??МхЕзхо╣ч??╝ф??Уч? active class ?Зц?
     * @param {string} tabId - шжБх??ЫхИ░?Дщ?ч▒?ID (ф╛Лх? 'search-tab-s1')
     */
    _switchTab(tabId) {
        // ?Хч??Йщ?
        Object.values(this.elements.tabButtons).forEach(button => {
            if (button) {
                button.classList.toggle('active', button.id === tabId);
            }
        });

        // ?Хч??зхо╣чкЧца╝
        if (this.elements.tabContents.s1) {
            this.elements.tabContents.s1.classList.toggle('active', tabId === 'search-tab-s1');
        }
        if (this.elements.tabContents.s2) {
            this.elements.tabContents.s2.classList.toggle('active', tabId === 'search-tab-s2');
        }

        // [NEW] ?Оцо╡ 4я╝??пщБ╕) S1 focus ?Пш╝п
        if (tabId === 'search-tab-s1' && typeof this.s1View?.activate === 'function') {
            this.s1View.activate();
        }
    }


    show() {
        // [MODIFIED] ?Оцо╡ 4я╝Ъц│и??S1/S2 View х╛Мя??ищАЩшгб?Эх??Цх???
        if (this.s1View && typeof this.s1View.initialize === 'function') {
            this.s1View.initialize();
        }
        if (this.s2View && typeof this.s2View.initialize === 'function') {
            this.s2View.initialize();
        }

        this._resetSearch(); // Reset to a clean state every time it's opened
        this.container.classList.remove('is-hidden');
        this.stateService.dispatch(uiActions.setModalActive(true)); // [NEW] Lock background app

        // [MODIFIED] ?Оцо╡ 4я╝ЪFocus ?Пш╝п?╛хЬиф║дч╡ж S1View
        if (typeof this.s1View?.activate === 'function') {
            this.s1View.activate();
        }
    }

    hide() {
        this.container.classList.add('is-hidden');
        this.stateService.dispatch(uiActions.setModalActive(false)); // [NEW] Unlock background app

        // [NEW] ?Оцо╡ 4я╝ЪщК╖цпА S1/S2 View ?ДчЫг?╜хЩи
        if (this.s1View && typeof this.s1View.destroy === 'function') {
            this.s1View.destroy();
        }
        if (this.s2View && typeof this.s2View.destroy === 'function') {
            this.s2View.destroy();
        }
    }

    // [MODIFIED] ?Оцо╡ 3я╝Ъ_resetSearch хдзх?ч░бх?
    _resetSearch() {
        // [REMOVED] Tweak 1: чз╗щЩд _updateStatusBar

        // [NEW] Tweak 1: (ReDo ?Пш╝п) ц╕Ечй║ S1 чпйщБ╕??
        if (this.s1View && typeof this.s1View.clearFilters === 'function') {
            this.s1View.clearFilters();
        }

        // чв║ф? S1 ?Бч▒дц░╕щ??пщ?шинхА?
        this._switchTab('search-tab-s1');
    }

    _onOverlayClick(event) {
        if (event.target === this.container) {
            this.hide();
        }
    }

    // --- [NEW] Tweak 2: ReDo ?Йщ??Пш╝п ---
    _onReDoClick() {
        // [MODIFIED] Tweak 1: ?их??Ых??╝хПл _resetSearch ф╛Жц?чй║ц?ф╜?
        this._resetSearch();

        // ?Зц???S1 (х╖▓хЬи _resetSearch ф╕нх???
        // this._switchTab('search-tab-s1');

        // S1View х╖▓ч?швлц│и?ея??╝хПлхоГч? activate ?╣ц?ф╛?focus
        if (typeof this.s1View?.activate === 'function') {
            this.s1View.activate();
        }
    }

    // --- [NEW] ?Оцо╡ 3я╝Ъ_onExecuteSearch (?Цф╗г _onSearchClick) ---
    /**
     * ??Б╜ S1View ?╝хЗ║??USER_REQUESTED_EXECUTE_SEARCH ф║Лф╗╢
     * @param {object} data - ?ЕхРл { filters } ?ДчЙйф╗?
     */
    async _onExecuteSearch({ filters }) {
        const uid = this.authService.currentUser?.uid;
        if (!uid) {
            // [MODIFIED] Tweak 1: ?╣чВ║?ЯхП╕
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Error: You are not logged in.',
                type: 'error'
            });
            return;
        }

        // ч░бхЦощйЧш? (?ЦчД╢ S1View ф╣Ях?ф║?
        if (Object.values(filters).every(v => !v && v !== false)) {
            // [MODIFIED] Tweak 1: ?╣чВ║?ЯхП╕
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Please enter at least one search criteria.',
                type: 'error'
            });
            return;
        }

        // 2. ?╖ш??Ьх?
        // [REMOVED] Tweak 4: чз╗щЩд "Searching..." ?ЯхП╕
        // this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
        //     message: 'Searching...',
        //     type: 'info'
        // });

        const result = await searchQuotesAdvanced(uid, filters);

        // [REMOVED] Tweak 1: чз╗щЩд statusBar ?┤цЦ░

        // 3. ?Хч?ч╡Рц?
        if (result.success) {
            // [MODIFIED] Tweak 4: ?╣ц??пхРж?Йш??Щщбпчд║ф??Мш???
            const message = result.data.length > 0 ? `Found ${result.data.length} quotes.` : 'Not found.';
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: message,
                type: 'info'
            });

            // [MODIFIED] ?Оцо╡ 3я╝?
            // A. х░Зч??ЬцХ╕?ЪчЩ╝х╕Гч╡ж S2View
            this.eventAggregator.publish(EVENTS.SEARCH_RESULTS_SUCCESSFUL, result.data);

            // B. ?кх??Зц???S2 ?Бч▒д
            this._switchTab('search-tab-s2');

        } else if (result.needsIndex) {
            // ч┤вх??пшкд
            // [MODIFIED] Tweak 1: ?╣чВ║?ЯхП╕
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Index required. Link logged to console.',
                type: 'error'
            });
        } else {
            // ?╢ф??пшкд
            // [MODIFIED] Tweak 1: ?╣чВ║?ЯхП╕
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: `Error: ${result.message}`,
                type: 'error'
            });
        }
    }


    // --- [REMOVED] ?Оцо╡ 3я╝ЪS2 ?Дц??Йщ?ш╝пх╖▓чз╗шЗ│ S2View ---

    // --- [REMOVED] Tweak 1я╝Ъ_updateStatusBar х╖▓ф??Нщ?шж?---
}