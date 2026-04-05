/* FILE: 04-core-code/app-context.js */
// [MODIFIED] (v6297 Phase 8) Import and register QuotePersistenceService.
// [SELF-CORRECTION] fileService dependency moved to workflowService as handleFileLoad logic resides there.
// [MODIFIED] (v6299 Gen-Xls) Register ExcelExportService.
// [MODIFIED] (v6299 Phase 4) Moved excelExportService injection from WorkflowService to QuotePersistenceService for architectural consistency.
// [MODIFIED] (v6299 Phase 5) Inject configManager into WorkOrderStrategy for height calculation.
// [MODIFIED] (v6297 Stage 9) Register DataPreparationService.
// [MODIFIED] (v6297 Stage 9 Phase 3) Inject dataPreparationService into ExcelExportService and WorkOrderStrategy.
import { OcrApiService } from './services/ocr-api-service.js';

/**
 * @description
 * AppContext acts as the central Dependency Injection (DI) Container for the application.
 * It is responsible for instantiating and registering all core Services and UI Components.
 *
 * Core Responsibilities:
 * 1. Initialize Services (e.g., StateService, CalculationService).
 * 2. Initialize UI Components (e.g., QuickQuoteView, RightPanelComponent).
 * 3. Store these instances in a centralized registry (this.instances) for global access.
 *
 * Key Benefits:
 * - Decoupling: Components (e.g., AppController) request dependencies rather than instantiating them.
 * - Testing: Allows for easy injection of mock services during unit testing.
 * - Order Management: Ensures components are initialized in the correct order to satisfy dependencies.
 *
 * Example Usage:
 * main.js initializes AppContext to bootstrap the app, then retrieves instances like UIManager.
 */
export class AppContext {
    constructor() {
        this.instances = {};
    }

    /**
     * 註冊一個服務或組件實例。
     * @param {string} name - 服務名稱 (key)
     * @param {object} instance - 實例化後的物件
     */
    register(name, instance) {
        this.instances[name] = instance;
    }

    /**
     * 獲取已註冊的服務實例。
     * @param {string} name - 服務名稱
     * @returns {object} - 服務實例
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
        setConfigManagerInstance(configManager); // [NEW] Set singleton instance
        this.register('configManager', configManager);

        // [NEW] (v6297 Stage 9) Initialize DataPreparationService early as it depends on ConfigManager
        // but is a core logic service used by others (potentially).
        const dataPreparationService = new DataPreparationService({ configManager });
        this.register('dataPreparationService', dataPreparationService);

        const productFactory = new ProductFactory({ configManager });
        this.register('productFactory', productFactory);

        const ocrApiService = new OcrApiService();
        this.register('ocrApiService', ocrApiService);

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
        setStateServiceInstance(stateService); // [NEW] Set singleton instance
        this.register('stateService', stateService);

        const calculationService = new CalculationService({
            stateService,
            productFactory,
            configManager
        });
        this.register('calculationService', calculationService);

        const fileService = new FileService({ productFactory });
        this.register('fileService', fileService);

        const focusService = new FocusService({
            stateService
        });
        this.register('focusService', focusService);

        // [NEW] (v6299 Gen-Xls) Initialize ExcelExportService
        // [MODIFIED] (Stage 9 Phase 3) Inject dataPreparationService
        const excelExportService = new ExcelExportService({
            configManager,
            calculationService,
            dataPreparationService // [NEW] Injected
        });
        this.register('excelExportService', excelExportService);
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
        // [NEW] (v6299 Gen-Xls) Get ExcelExportService
        const excelExportService = this.get('excelExportService');
        // [NEW] (Stage 9 Phase 3) Get DataPreparationService
        const dataPreparationService = this.get('dataPreparationService');

        // --- [NEW] Instantiate LeftPanelTabManager (Phase 6 Refactor) ---
        const leftPanelElement = document.getElementById(DOM_IDS.LEFT_PANEL);
        const leftPanelTabManager = new LeftPanelTabManager(leftPanelElement, eventAggregator);
        this.register('leftPanelTabManager', leftPanelTabManager);

        // --- [NEW] Instantiate K1 Tab Components (Phase 1 Refactor) ---
        const k1TabInputHandler = new K1TabInputHandler({ eventAggregator });
        this.register('k1TabInputHandler', k1TabInputHandler);
        const k1TabComponent = new K1TabComponent();
        this.register('k1TabComponent', k1TabComponent);

        // [REMOVED] (Phase 3.5a) K2 tab components merged into K1

        // --- [NEW] Instantiate K2 Tab Components (Phase 2 Refactor) ---
        const k2TabInputHandler = new K2TabInputHandler({ eventAggregator });
        this.register('k2TabInputHandler', k2TabInputHandler);
        const k2TabComponent = new K2TabComponent();
        this.register('k2TabComponent', k2TabComponent);

        // --- [NEW] Instantiate K3 Tab Components (Phase 4 Refactor) ---
        const k3TabInputHandler = new K3TabInputHandler({ eventAggregator });
        this.register('k3TabInputHandler', k3TabInputHandler);
        const k3TabComponent = new K3TabComponent();
        this.register('k3TabComponent', k3TabComponent);

        // [REMOVED] K5 Tab Components (Phase 3.5b)

        // --- [NEW] (階段 2) 初始化 Generator 策略 ---
        // [MODIFIED] (v6299 Phase 5) Inject configManager for Work Order Logic
        // [MODIFIED] (Stage 9 Phase 3) Inject dataPreparationService
        const workOrderStrategy = new WorkOrderStrategy({
            configManager,
            dataPreparationService // [NEW] Injected
        });
        this.register('workOrderStrategy', workOrderStrategy);

        // [NEW] (階段 3) 初始化原報表策略
        const originalQuoteStrategy = new OriginalQuoteStrategy();
        this.register('originalQuoteStrategy', originalQuoteStrategy);

        // [NEW] (階段 4) 初始化 GTH 策略
        const gthQuoteStrategy = new GthQuoteStrategy();
        this.register('gthQuoteStrategy', gthQuoteStrategy);

        // [NEW] Phase II.6b: 初始化安裝工單策略
        const installationWorksheetStrategy = new InstallationWorksheetStrategy({
            dataPreparationService
        });
        this.register('installationWorksheetStrategy', installationWorksheetStrategy);


        // [NEW] (v6297 階段 7) 初始化 QuotePersistenceService
        // [MODIFIED] (v6299 Phase 4) Inject excelExportService here for centralization
        const quotePersistenceService = new QuotePersistenceService({
            eventAggregator,
            stateService,
            fileService,
            authService,
            calculationService,
            configManager,
            productFactory,
            excelExportService // [NEW] Injected here
        });
        this.register('quotePersistenceService', quotePersistenceService);


        // --- [NEW] Instantiate the new QuoteGeneratorService ---
        // [MODIFIED] (階段 4) 注入所有 strategy
        const quoteGeneratorService = new QuoteGeneratorService({
            calculationService,
            workOrderStrategy,
            originalQuoteStrategy,
            gthQuoteStrategy,
            installationWorksheetStrategy
        });
        this.register('quoteGeneratorService', quoteGeneratorService);

        // --- [REMOVED] (Refactor - Lazy Load) Instantiate Right Panel Sub-Views ---
        // const rightPanelElement = document.getElementById('function-panel');
        // const f1View = new F1CostView(...);
        // const f2View = new F2SummaryView(...);
        // const f3View = new F3QuotePrepView(...);
        // const f4View = new F4ActionsView(...);
        const rightPanelElement = document.getElementById('function-panel'); // [NEW] Still need this
        // [DIRECTIVE-v3.27] RightPanelComponent instantiation MOVED to after WorkflowService
        // so that workflowService is defined when passed in.

        // --- [REMOVED] Quote Preview Component instantiation ---


        // --- Instantiate Main Left Panel Views ---
        const k1LocationView = new K1LocationView({ stateService });
        // --- [REMOVED] (Phase 3 Cleanup) Get K2 DOM elements for injection
        // const fabricBatchTable = document.getElementById(DOM_IDS.FABRIC_BATCH_TABLE);
        const fabricConfigView = new FabricConfigView({
            stateService, eventAggregator,
            // [REMOVED] (Phase 3 Cleanup) fabricBatchTable
        });
        const k2OptionsView = new K2OptionsView({ stateService, eventAggregator });
        // [REMOVED] K5 dualChainView (Phase 3.5b)
        const driveAccessoriesView = new DriveAccessoriesView({ stateService, eventAggregator, k3TabComponent });

        // --- [MODIFIED] Removed obsolete publishStateChangeCallback from DetailConfigView dependencies ---
        const detailConfigView = new DetailConfigView({
            stateService,
            eventAggregator,
            k1LocationView,
            fabricConfigView,
            k2OptionsView,
            driveAccessoriesView
        });
        this.register('detailConfigView', detailConfigView);

        // [MODIFIED] (v6299 Phase 4) excelExportService dependency removed from WorkflowService
        const workflowService = new WorkflowService({
            eventAggregator,
            stateService,
            fileService, // [MODIFIED] (v6297 階段 7) 保留，但主要存取邏輯移至 QuotePersistenceService
            calculationService,
            productFactory,
            detailConfigView,
            quoteGeneratorService, // [NEW] Inject the new service
            authService, // [NEW] (v6297) Inject AuthService
            quotePersistenceService // [DIRECTIVE-v3.9] Inject for live ledger fetching
            // excelExportService // [REMOVED] (v6299 Phase 4) Moved to QuotePersistenceService
        });
        // [REMOVED]
        this.register('workflowService', workflowService);

        // --- [DIRECTIVE-v3.27] Instantiate Main RightPanelComponent Manager (moved here) ---
        // Must be after WorkflowService so workflowService is defined when passed in.
        const rightPanelComponent = new RightPanelComponent({
            panelElement: rightPanelElement,
            eventAggregator,
            stateService,
            calculationService,
            authService,
            quotePersistenceService, // [Scheme B] For F3 live ledger
            workflowService // [DIRECTIVE-v3.27] For Service-Layer Tollbooth in F3
        });
        this.register('rightPanelComponent', rightPanelComponent);

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
            detailConfigView,
            quotePersistenceService, // [MODIFIED] (v6297) Injected
            calculationService // [NEW] Phase 4.10a
        });
        this.register('appController', appController);

        // [NEW] (Phase 2 PoC) 注入 appController 到 K1TabInputHandler
        // 因為 appController 在 k1TabInputHandler 之後才被建立，所以在此處注入
        k1TabInputHandler.appController = appController;

        // --- [NEW] (v6298-F4-Search) Instantiate the Search Dialog Component ---
        // --- [NEW] 階段 3：創建 S1/S2 視圖 ---
        const s1View = new SearchTabS1View({ eventAggregator });
        this.register('s1View', s1View);

        const s2View = new SearchTabS2View({ eventAggregator, stateService });
        this.register('s2View', s2View);

        // --- [MODIFIED] 階段 4：創建 Search Dialog 組件 ---
        const searchDialogComponent = new SearchDialogComponent({
            containerElement: document.getElementById(DOM_IDS.SEARCH_DIALOG_CONTAINER),
            eventAggregator,
            // [MODIFIED] (v6298-F4-Search) Inject required services
            stateService,
            authService,
            // [NEW] 階段 4 注入
            s1View: s1View,
            s2View: s2View
        });
        this.register('searchDialogComponent', searchDialogComponent);
        // --- [NEW] Step 1.1: Initialize OCR View ---
        const ocrView = new OcrView({ eventAggregator });
        this.register('ocrView', ocrView);
        // --- [END NEW] ---

        // [NEW] Initialize LeftPanelTabManager (Phase 6 Refactor)
        leftPanelTabManager.initialize();


        // k3 and k5 don't need this yet as their lock is handled via State Observer on mode change?
        // Actually, let's inject them all for consistency if they have the method, but I only updated K1-K2.

        // [NEW] Initialize K1 Input Handler (Phase 1 Refactor)
        k1TabInputHandler.initialize();
        // [REMOVED] (Phase 3.5a) K2 input handler merged into K1
        // [NEW] Initialize K2 Input Handler (Phase 2 Refactor)
        k2TabInputHandler.initialize();
        // [NEW] Initialize K3 Input Handler (Phase 4 Refactor)
        k3TabInputHandler.initialize();
        // [REMOVED] K5 Input Handler initialization (Phase 3.5b)
    }
}

// Import all necessary classes
import { EventAggregator } from './event-aggregator.js';
import { ConfigManager, setConfigManagerInstance } from './config-manager.js';
import { AppController } from './app-controller.js';
import { ProductFactory } from './strategies/product-factory.js';
import { StateService, setStateServiceInstance } from './services/state-service.js';
import { CalculationService } from './services/calculation-service.js';
import { FocusService } from './services/focus-service.js';
import { FileService } from './services/file-service.js';
import { WorkflowService } from './services/workflow-service.js';
import { QuoteGeneratorService } from './services/quote-generator-service.js'; // [NEW]
import { AuthService } from './services/auth-service.js'; // [NEW] (v6297)
import { ExcelExportService } from './services/excel-export-service.js'; // [NEW] (v6299 Gen-Xls)
import { DataPreparationService } from './services/data-preparation-service.js'; // [NEW] (v6297 Stage 9)
// [NEW] (v6297 階段 7) Import 引用
import { QuotePersistenceService } from './services/quote-persistence-service.js';
import { RightPanelComponent } from './ui/right-panel-component.js';
import { QuickQuoteView } from './ui/views/quick-quote-view.js';
import { DetailConfigView } from './ui/views/detail-config-view.js';
import { FabricConfigView } from './ui/views/fabric-config-view.js';
import {
    K1LocationView
} from './ui/views/k1-location-view.js';
import { K2OptionsView } from './ui/views/k2-options-view.js';
// [REMOVED] DualChainView import (Phase 3.5b)
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
// [NEW] Step 1.1: Import OCR View
import { OcrView } from './ui/ocr-view.js';
// [NEW] 階段 3：Import S1/S2 視圖
import { SearchTabS1View } from './ui/views/search-tab-s1-view.js';
import { SearchTabS2View } from './ui/views/search-tab-s2-view.js';
// [NEW] (階段 2) Import the new generator strategy
import { WorkOrderStrategy } from './services/generators/work-order-strategy.js';
// [NEW] (階段 3) Import the new generator strategy
import { OriginalQuoteStrategy } from './services/generators/original-quote-strategy.js';
// [NEW] (階段 4) Import the new generator strategy
import { GthQuoteStrategy } from './services/generators/gth-quote-strategy.js';
import { InstallationWorksheetStrategy } from './services/generators/installation-worksheet-strategy.js';


// [NEW IMPORTS]
import { K1TabInputHandler } from './ui/tabs/k1-tab/k1-tab-input-handler.js';
import { K1TabComponent } from './ui/tabs/k1-tab/k1-tab-component.js';
// [REMOVED] (Phase 3.5a) K2 imports merged into K1
import { K2TabInputHandler } from './ui/tabs/k2-tab/k2-tab-input-handler.js';
import { K2TabComponent } from './ui/tabs/k2-tab/k2-tab-component.js';
import { K3TabInputHandler } from './ui/tabs/k3-tab/k3-tab-input-handler.js';
import { K3TabComponent } from './ui/tabs/k3-tab/k3-tab-component.js';
// [REMOVED] K5 imports (Phase 3.5b)