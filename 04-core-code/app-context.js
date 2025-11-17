/* FILE: 04-core-code/app-context.js */
// [MODIFIED] (v6297 瘦身) 階段 1：Import 並註冊新的 QuotePersistenceService。
// [SELF-CORRECTION] 依賴 `fileService` 仍被保留在 `workflowService` 中，因為 `handleFileLoad` 仍由 `workflowService` 處理。

/**
 * @description
 * AppContext ?此?用程å??「ä?賴注?容?€?DI Container)??
 * 它ç??責?「建立」並註å??€?æ???(Services) ??UI ?件 (Components)??
 * 1. 建ç? Services (例å? StateService, CalculationService)??
 * 2. 建ç? UI Components (例å? QuickQuoteView, RightPanelComponent)??
 * 3. 將這ä?實ä? (instances) 保å??ä??中央登記表 (this.instances) 中€?
 *
 * ?種模å??好??(依賴注入):
 * - ?解?」ï??件不é?要知?「å?何」建立「其他ä?賴」€?
 * 例å?，`AppController` 不é?¦?`new WorkflowService()`，只?要å? AppContext?è?求」已經å??ç? `workflowService` 實ä???
 * - ?可測試?」ï??進è??å?測試?ï??們可以è??地?模?€?mock) 並替??AppContext 中ç??實?å???
 * - ?é?中管?」ï??€?物件ç?建ç??輯?é?中在此ï?便於管ç??維護€?
 *
 * Example:
 * `main.js` (組è?»? ??AppContext 請æ?建ç?好ç??€?零»?(Services, Components)¼?
 * ?å?將這ä??件 (例å? `quickQuoteView`, `appController`) 交給 `UIManager` (總æ??? ?ç?裝å?渲æ??面??
 * */
export class AppContext {
    constructor() {
        this.instances = {};
    }

    /**
     * 註å?一?實例到容器中€?
     * @param {string} name - 實ä??唯一?稱 (key)
     * @param {object} instance - 要註?ç?實ä???
     */
    register(name, instance) {
        this.instances[name] =
            instance;
    }

    /**
     * 從容?中?å?一?實例€?
     * @param {string} name - 要å?得ç?實ä??稱??
     * @returns {object} - 註å??實例€?
     */
    get(name) {
        const instance = this.instances[name];
        if (!instance) {
            throw new Error(`Instance '${name}' not found.`);
        }
        return instance;
    }

    initialize(startingQuoteData = null) {

        // [MODIFIED] This method now only initializes non-UI services and controllers.
        const eventAggregator = new EventAggregator();
        this.register('eventAggregator', eventAggregator);

        // [NEW] (v6297) Initialize Auth Service first
        const authService = new AuthService(eventAggregator);
        this.register('authService', authService);

        const configManager = new ConfigManager(eventAggregator);
        this.register('configManager', configManager);

        const productFactory = new ProductFactory({ configManager });
        this.register('productFactory', productFactory);

        let initialStateWithData = JSON.parse(JSON.stringify(initialState));
        if (startingQuoteData) {
            initialStateWithData.quoteData = startingQuoteData;
        }

        const stateService = new StateService({
            initialState: initialStateWithData,
            eventAggregator,
            productFactory,
            configManager
        });
        this.register('stateService', stateService);

        const calculationService = new CalculationService({
            stateService,
            productFactory,
            configManager
        });
        this.register('calculationService',
            calculationService);
        const fileService = new FileService({ productFactory });
        this.register('fileService', fileService);

        const focusService = new FocusService({
            stateService
        });
        this.register('focusService', focusService);
    }

    initializeUIComponents() {
        // [NEW] This method initializes all UI-dependent components.
        // It must be called AFTER the HTML partials are loaded.
        const eventAggregator = this.get('eventAggregator');
        const calculationService = this.get('calculationService');
        const stateService = this.get('stateService');
        const configManager = this.get('configManager');
        const productFactory = this.get('productFactory');
        const focusService = this.get('focusService');
        const fileService = this.get('fileService');
        const authService = this.get('authService'); // [NEW] (v6297) Get AuthService

        // --- [NEW] Instantiate LeftPanelTabManager (Phase 6 Refactor) ---
        const leftPanelElement = document.getElementById(DOM_IDS.LEFT_PANEL);
        const leftPanelTabManager = new LeftPanelTabManager(leftPanelElement, eventAggregator);
        this.register('leftPanelTabManager', leftPanelTabManager);

        // --- [NEW] Instantiate K1 Tab Components (Phase 1 Refactor) ---
        const k1TabInputHandler = new K1TabInputHandler({ eventAggregator });
        this.register('k1TabInputHandler', k1TabInputHandler);
        const k1TabComponent = new K1TabComponent();
        this.register('k1TabComponent', k1TabComponent);

        // --- [NEW] Instantiate K2 Tab Components (Phase 5 Refactor) ---
        const k2TabInputHandler = new K2TabInputHandler({ eventAggregator });
        this.register('k2TabInputHandler', k2TabInputHandler);
        // [NEW] (v6294) Instantiate the new K2 component
        const k2TabComponent = new K2TabComponent();
        this.register('k2TabComponent', k2TabComponent);

        // --- [NEW] Instantiate K3 Tab Components (Phase 2 Refactor) ---
        const k3TabInputHandler = new K3TabInputHandler({ eventAggregator });
        this.register('k3TabInputHandler', k3TabInputHandler);
        const k3TabComponent = new K3TabComponent();
        this.register('k3TabComponent', k3TabComponent);

        // --- [NEW] Instantiate K4 Tab Components (Phase 4 Refactor) ---
        const k4TabInputHandler = new K4TabInputHandler({ eventAggregator });
        this.register('k4TabInputHandler', k4TabInputHandler);
        const k4TabComponent = new K4TabComponent();
        this.register('k4TabComponent', k4TabComponent);

        // --- [NEW] Instantiate K5 Tab Components (Phase 3 Refactor) ---
        const k5TabInputHandler = new K5TabInputHandler({ eventAggregator });
        this.register('k5TabInputHandler', k5TabInputHandler);
        const k5TabComponent = new K5TabComponent();
        this.register('k5TabComponent', k5TabComponent);

        // --- [NEW] (?段 2) 實ä??新??Generator 策略 ---
        const workOrderStrategy = new WorkOrderStrategy();
        this.register('workOrderStrategy', workOrderStrategy);

        // [NEW] (?段 3) 實ä??å?表ç???
        const originalQuoteStrategy = new OriginalQuoteStrategy();
        this.register('originalQuoteStrategy', originalQuoteStrategy);

        // [NEW] (?段 4) 實ä???GTH 策略
        const gthQuoteStrategy = new GthQuoteStrategy();
        this.register('gthQuoteStrategy', gthQuoteStrategy);


        // [NEW] (v6297 瘦身) 階段 1：實例化 QuotePersistenceService
        const quotePersistenceService = new QuotePersistenceService({
            eventAggregator,
            stateService,
            fileService,
            authService,
            calculationService,
            configManager,
            productFactory
        });
        this.register('quotePersistenceService', quotePersistenceService);


        // --- [NEW] Instantiate the new QuoteGeneratorService ---
        // [MODIFIED] (?段 4) 注入?€??strategy
        const quoteGeneratorService = new QuoteGeneratorService({
            calculationService,
            workOrderStrategy,
            originalQuoteStrategy,
            gthQuoteStrategy // [NEW]
        });
        this.register('quoteGeneratorService', quoteGeneratorService);

        // --- [REMOVED] (Refactor - Lazy Load) Instantiate Right Panel Sub-Views ---
        // const rightPanelElement = document.getElementById('function-panel');
        // const f1View = new F1CostView(...);
        // const f2View = new F2SummaryView(...);
        // const f3View = new F3QuotePrepView(...);
        // const f4View = new F4ActionsView(...);
        const rightPanelElement = document.getElementById('function-panel'); // [NEW] Still need this


        // --- Instantiate Main RightPanelComponent Manager ---
        // [MODIFIED] (Refactor - Lazy Load)
        // Removed f1View-f4View dependencies.
        // Injected services (stateService, calculationService) so the component
        // can dynamically instantiate views itself.
        // [MODIFIED] (v6298) Injected authService
        const rightPanelComponent = new RightPanelComponent({
            panelElement: rightPanelElement,
            eventAggregator,
            stateService,
            calculationService,
            authService // [NEW] (v6298) Pass auth service for F4
            // f1View, // [REMOVED]
            // f2View, // [REMOVED]
            // f3View, // [REMOVED]
            // f4View  // [REMOVED]
        });
        this.register('rightPanelComponent', rightPanelComponent);

        // --- [REMOVED] Quote Preview Component instantiation ---


        // --- Instantiate Main Left Panel Views ---
        const k1LocationView = new K1LocationView({ stateService });
        // --- [REMOVED] (Phase 3 Cleanup) Get K2 DOM elements for injection
        // const fabricBatchTable = document.getElementById(DOM_IDS.FABRIC_BATCH_TABLE);
        const k2FabricView = new K2FabricView({
            stateService,
            eventAggregator
            // [REMOVED] (Phase 3 Cleanup) fabricBatchTable
        });
        const k3OptionsView = new K3OptionsView({ stateService });
        const dualChainView = new DualChainView({ stateService, calculationService, eventAggregator });
        const driveAccessoriesView = new DriveAccessoriesView({ stateService, calculationService, eventAggregator });

        // --- [MODIFIED] Removed obsolete publishStateChangeCallback from DetailConfigView dependencies ---
        const detailConfigView
            = new DetailConfigView({
                stateService,
                eventAggregator,
                k1LocationView,
                k2FabricView,
                k3OptionsView,
                dualChainView,
                driveAccessoriesView
            });
        this.register('detailConfigView', detailConfigView);

        const workflowService = new WorkflowService({
            eventAggregator,
            stateService,
            fileService, // [MODIFIED] (v6297 瘦身) 自我修正：保留 fileService，因為 handleFileLoad 仍在此服務中
            calculationService,
            productFactory,
            detailConfigView,
            quoteGeneratorService, // [NEW] Inject the new service
            authService // [NEW] (v6297) Inject AuthService

        });
        // [REMOVED]
        this.register('workflowService', workflowService);

        const quickQuoteView = new QuickQuoteView({
            stateService,
            calculationService,
            focusService,
            fileService,
            eventAggregator,
            productFactory,
            configManager
        });
        this.register('quickQuoteView', quickQuoteView);

        const appController = new AppController({
            eventAggregator,
            stateService,
            workflowService,
            quickQuoteView,
            detailConfigView
            // [MODIFIED] (v6297 瘦身) 階段 2 將在此處注入 quotePersistenceService
        });
        this.register('appController', appController);

        // --- [NEW] (v6298-F4-Search) Instantiate the Search Dialog Component ---
        // --- [NEW] ?段 4：實例å? S1/S2 子è???---
        const s1View = new SearchTabS1View({ eventAggregator });
        this.register('s1View', s1View);

        const s2View = new SearchTabS2View({ eventAggregator, stateService });
        this.register('s2View', s2View);

        // --- [MODIFIED] ?段 4：å? S1/S2 子è??注?管?員 ---
        const searchDialogComponent = new SearchDialogComponent({
            containerElement: document.getElementById(DOM_IDS.SEARCH_DIALOG_CONTAINER),
            eventAggregator,
            // [MODIFIED] (v6298-F4-Search) Inject required services
            stateService,
            authService,
            // [NEW] ?段 4 注入
            s1View: s1View,
            s2View: s2View
        });
        this.register('searchDialogComponent', searchDialogComponent);
        // --- [END NEW] ---

        // [NEW] Initialize LeftPanelTabManager (Phase 6 Refactor)
        leftPanelTabManager.initialize();
        // [NEW] Initialize K1 Input Handler (Phase 1 Refactor)
        k1TabInputHandler.initialize();
        // [NEW] Initialize K2 Input Handler (Phase 5 Refactor)
        k2TabInputHandler.initialize();
        // [NEW] Initialize K3 Input Handler (Phase 2 Refactor)
        k3TabInputHandler.initialize();
        // [NEW] Initialize K4 Input Handler (Phase 4 Refactor)
        k4TabInputHandler.initialize();
        // [NEW] Initialize K5 Input Handler (Phase 3 Refactor)
        k5TabInputHandler.initialize();
    }
}

// Import all necessary classes
import { EventAggregator } from './event-aggregator.js';
import { ConfigManager } from './config-manager.js';
import { AppController } from './app-controller.js';
import { ProductFactory } from './strategies/product-factory.js';
import { StateService } from './services/state-service.js';
import { CalculationService } from './services/calculation-service.js';
import { FocusService } from './services/focus-service.js';
import { FileService } from './services/file-service.js';
import { WorkflowService } from './services/workflow-service.js';
import { QuoteGeneratorService } from './services/quote-generator-service.js'; // [NEW]
import { AuthService } from './services/auth-service.js'; // [NEW] (v6297)
// [NEW] (v6297 瘦身) 階段 1：Import 新服務
import { QuotePersistenceService } from './services/quote-persistence-service.js';
import { RightPanelComponent } from './ui/right-panel-component.js';
import { QuickQuoteView } from './ui/views/quick-quote-view.js';
import { DetailConfigView } from './ui/views/detail-config-view.js';
import {
    K1LocationView
} from './ui/views/k1-location-view.js';
import { K2FabricView } from './ui/views/k2-fabric-view.js';
import { K3OptionsView } from './ui/views/k3-options-view.js';
import { DualChainView } from './ui/views/dual-chain-view.js';
import { DriveAccessoriesView } from './ui/views/drive-accessories-view.js';
import { initialState } from './config/initial-state.js';
// [REMOVED] (Refactor - Lazy Load) Static imports for F1-F4 views
// import { F1CostView } from './ui/views/f1-cost-view.js';
// import { F2SummaryView } from './ui/views/f2-summary-view.js';
// import { F3QuotePrepView } from './ui/views/f3-quote-prep-view.js';
// import { F4ActionsView } from './ui/views/f4-actions-view.js';
import { LeftPanelTabManager } from './ui/left-panel-tab-manager.js'; // [MODIFIED]
import { DOM_IDS } from './config/constants.js'; // [MODIFIED]
// [NEW] (v6298-F4-Search) Import the new search dialog component
import { SearchDialogComponent } from './ui/search-dialog-component.js';
// [NEW] ?段 4：Import S1/S2 子è???
import { SearchTabS1View } from './ui/views/search-tab-s1-view.js';
import { SearchTabS2View } from './ui/views/search-tab-s2-view.js';
// [NEW] (?段 2) Import the new generator strategy
import { WorkOrderStrategy } from './services/generators/work-order-strategy.js';
// [NEW] (?段 3) Import the new generator strategy
import { OriginalQuoteStrategy } from './services/generators/original-quote-strategy.js';
// [NEW] (?段 4) Import the new generator strategy
import { GthQuoteStrategy } from './services/generators/gth-quote-strategy.js';


// [NEW IMPORTS]
import { K1TabInputHandler } from './ui/tabs/k1-tab/k1-tab-input-handler.js';
import { K1TabComponent } from './ui/tabs/k1-tab/k1-tab-component.js';
import { K2TabInputHandler } from './ui/tabs/k2-tab/k2-tab-input-handler.js'; // [NEW]
import { K2TabComponent } from './ui/tabs/k2-tab/k2-tab-component.js'; // [NEW] (v6g294)
import { K3TabInputHandler } from './ui/tabs/k3-tab/k3-tab-input-handler.js';
import { K3TabComponent } from './ui/tabs/k3-tab/k3-tab-component.js';
import { K4TabInputHandler } from './ui/tabs/k4-tab/k4-tab-input-handler.js';
import { K4TabComponent } from './ui/tabs/k4-tab/k4-tab-component.js';
import { K5TabInputHandler } from './ui/tabs/k5-tab/k5-tab-input-handler.js';
// [MODIFIED] (HOTFIX) Corrected typo from kSort-of-blue.js
import { K5TabComponent } from './ui/tabs/k5-tab/k5-tab-component.js';