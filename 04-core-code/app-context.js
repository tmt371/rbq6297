/* FILE: 04-core-code/app-context.js */

import { EventAggregator } from './event-aggregator.js';
import { ConfigManager } from './config-manager.js';
import { AppController } from './app-controller.js';
import { ProductFactory } from './strategies/product-factory.js';
import { StateService } from './services/state-service.js';
import { CalculationService } from './services/calculation-service.js';
import { FocusService } from './services/focus-service.js';
import { FileService } from './services/file-service.js';
import { WorkflowService } from './services/workflow-service.js';
import { QuoteGeneratorService } from './services/quote-generator-service.js';
import { AuthService } from './services/auth-service.js';
import { ExcelExportService } from './services/excel-export-service.js';
import { DataPreparationService } from './services/data-preparation-service.js';
import { QuotePersistenceService } from './services/quote-persistence-service.js';
import { RightPanelComponent } from './ui/right-panel-component.js';
import { QuickQuoteView } from './ui/views/quick-quote-view.js';
import { DetailConfigView } from './ui/views/detail-config-view.js';
import { K1LocationView } from './ui/views/k1-location-view.js';
import { K2FabricView } from './ui/views/k2-fabric-view.js';
import { K3OptionsView } from './ui/views/k3-options-view.js';
import { DualChainView } from './ui/views/dual-chain-view.js';
import { DriveAccessoriesView } from './ui/views/drive-accessories-view.js';
import { initialState } from './config/initial-state.js';
import { LeftPanelTabManager } from './ui/left-panel-tab-manager.js';
import { DOM_IDS } from './config/constants.js';
import { SearchDialogComponent } from './ui/search-dialog-component.js';
import { SearchTabS1View } from './ui/views/search-tab-s1-view.js';
import { SearchTabS2View } from './ui/views/search-tab-s2-view.js';
import { WorkOrderStrategy } from './services/generators/work-order-strategy.js';
import { OriginalQuoteStrategy } from './services/generators/original-quote-strategy.js';
import { GthQuoteStrategy } from './services/generators/gth-quote-strategy.js';
import { K1TabInputHandler } from './ui/tabs/k1-tab/k1-tab-input-handler.js';
import { K1TabComponent } from './ui/tabs/k1-tab/k1-tab-component.js';
import { K2TabInputHandler } from './ui/tabs/k2-tab/k2-tab-input-handler.js';
import { K2TabComponent } from './ui/tabs/k2-tab/k2-tab-component.js';
import { K3TabInputHandler } from './ui/tabs/k3-tab/k3-tab-input-handler.js';
import { K3TabComponent } from './ui/tabs/k3-tab/k3-tab-component.js';
import { K4TabInputHandler } from './ui/tabs/k4-tab/k4-tab-input-handler.js';
import { K4TabComponent } from './ui/tabs/k4-tab/k4-tab-component.js';
import { K5TabInputHandler } from './ui/tabs/k5-tab/k5-tab-input-handler.js';
import { K5TabComponent } from './ui/tabs/k5-tab/k5-tab-component.js';

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
     * 註冊一個依賴項實例。
     * @param {string} name - 依賴項名稱 (key)
     * @param {object} instance - 實例化後的物件
     */
    register(name, instance) {
        this.instances[name] = instance;
    }

    /**
     * 獲取已註冊的依賴項實例。
     * @param {string} name - 依賴項名稱
     * @returns {object} - 實例物件
     */
    get(name) {
        const instance = this.instances[name];
        if (!instance) {
            throw new Error(`Instance '${name}' not found.`);
        }
        return instance;
    }

    initialize(startingQuoteData = null) {
        const eventAggregator = new EventAggregator();
        this.register('eventAggregator', eventAggregator);

        const authService = new AuthService(eventAggregator);
        this.register('authService', authService);

        const configManager = new ConfigManager(eventAggregator);
        this.register('configManager', configManager);

        const dataPreparationService = new DataPreparationService({ configManager });
        this.register('dataPreparationService', dataPreparationService);

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
        this.register('calculationService', calculationService);

        const fileService = new FileService({ productFactory });
        this.register('fileService', fileService);

        const focusService = new FocusService({
            stateService
        });
        this.register('focusService', focusService);

        const excelExportService = new ExcelExportService({
            configManager,
            calculationService,
            dataPreparationService
        });
        this.register('excelExportService', excelExportService);
    }

    initializeUIComponents() {
        const eventAggregator = this.get('eventAggregator');
        const calculationService = this.get('calculationService');
        const stateService = this.get('stateService');
        const authService = this.get('authService');
        const excelExportService = this.get('excelExportService');
        const dataPreparationService = this.get('dataPreparationService');
        const configManager = this.get('configManager');
        const productFactory = this.get('productFactory');
        const fileService = this.get('fileService');
        const focusService = this.get('focusService'); // [FIXED] Missing dependency restored

        const leftPanelElement = document.getElementById(DOM_IDS.LEFT_PANEL);
        const leftPanelTabManager = new LeftPanelTabManager(leftPanelElement, eventAggregator);
        this.register('leftPanelTabManager', leftPanelTabManager);

        const k1TabInputHandler = new K1TabInputHandler({ eventAggregator });
        this.register('k1TabInputHandler', k1TabInputHandler);
        const k1TabComponent = new K1TabComponent();
        this.register('k1TabComponent', k1TabComponent);

        const k2TabInputHandler = new K2TabInputHandler({ eventAggregator });
        this.register('k2TabInputHandler', k2TabInputHandler);
        const k2TabComponent = new K2TabComponent();
        this.register('k2TabComponent', k2TabComponent);

        const k3TabInputHandler = new K3TabInputHandler({ eventAggregator });
        this.register('k3TabInputHandler', k3TabInputHandler);
        const k3TabComponent = new K3TabComponent();
        this.register('k3TabComponent', k3TabComponent);

        const k4TabInputHandler = new K4TabInputHandler({ eventAggregator });
        this.register('k4TabInputHandler', k4TabInputHandler);
        const k4TabComponent = new K4TabComponent();
        this.register('k4TabComponent', k4TabComponent);

        const k5TabInputHandler = new K5TabInputHandler({ eventAggregator });
        this.register('k5TabInputHandler', k5TabInputHandler);
        const k5TabComponent = new K5TabComponent();
        this.register('k5TabComponent', k5TabComponent);

        const workOrderStrategy = new WorkOrderStrategy({
            configManager,
            dataPreparationService
        });
        this.register('workOrderStrategy', workOrderStrategy);

        const originalQuoteStrategy = new OriginalQuoteStrategy();
        this.register('originalQuoteStrategy', originalQuoteStrategy);

        const gthQuoteStrategy = new GthQuoteStrategy();
        this.register('gthQuoteStrategy', gthQuoteStrategy);

        const quotePersistenceService = new QuotePersistenceService({
            eventAggregator,
            stateService,
            fileService,
            authService,
            calculationService,
            configManager,
            productFactory,
            excelExportService
        });
        this.register('quotePersistenceService', quotePersistenceService);

        const quoteGeneratorService = new QuoteGeneratorService({
            calculationService,
            workOrderStrategy,
            originalQuoteStrategy,
            gthQuoteStrategy
        });
        this.register('quoteGeneratorService', quoteGeneratorService);

        const rightPanelElement = document.getElementById('function-panel');

        const rightPanelComponent = new RightPanelComponent({
            panelElement: rightPanelElement,
            eventAggregator,
            stateService,
            calculationService,
            authService
        });
        this.register('rightPanelComponent', rightPanelComponent);

        const k1LocationView = new K1LocationView({ stateService });
        const k2FabricView = new K2FabricView({
            stateService,
            eventAggregator
        });
        const k3OptionsView = new K3OptionsView({ stateService });
        const dualChainView = new DualChainView({ stateService, calculationService, eventAggregator });
        const driveAccessoriesView = new DriveAccessoriesView({ stateService, calculationService, eventAggregator });

        const detailConfigView = new DetailConfigView({
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
            fileService,
            calculationService,
            productFactory,
            detailConfigView,
            quoteGeneratorService,
            authService
        });
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
            detailConfigView,
            quotePersistenceService
        });
        this.register('appController', appController);

        const s1View = new SearchTabS1View({ eventAggregator });
        this.register('s1View', s1View);

        const s2View = new SearchTabS2View({ eventAggregator, stateService });
        this.register('s2View', s2View);

        const searchDialogComponent = new SearchDialogComponent({
            containerElement: document.getElementById(DOM_IDS.SEARCH_DIALOG_CONTAINER),
            eventAggregator,
            stateService,
            authService,
            s1View: s1View,
            s2View: s2View
        });
        this.register('searchDialogComponent', searchDialogComponent);

        leftPanelTabManager.initialize();
        k1TabInputHandler.initialize();
        k2TabInputHandler.initialize();
        k3TabInputHandler.initialize();
        k4TabInputHandler.initialize();
        k5TabInputHandler.initialize();
    }
}