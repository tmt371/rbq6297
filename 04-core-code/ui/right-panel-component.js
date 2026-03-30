// File: 04-core-code/ui/right-panel-component.js

import { DOM_IDS } from '../config/constants.js';
import { paths } from '../config/paths.js'; // [NEW] Import paths for dynamic loading

/**
 * @fileoverview A container/manager component for the Right Panel.
 * Its sole responsibility is to manage the lifecycle of its sub-views (F1, F2, F3, F4)
 * and delegate rendering tasks to the currently active sub-view.
 * [MODIFIED] This component now dynamically loads (lazy loads) views on demand.
 */
export class RightPanelComponent {
    constructor({ panelElement, eventAggregator, stateService, calculationService, authService, quotePersistenceService, workflowService }) { // [DIRECTIVE-v3.27] Added workflowService
        if (!panelElement || !eventAggregator || !stateService || !calculationService || !authService) {
            throw new Error("Panel element, event aggregator, stateService, calculationService, and authService are required for RightPanelComponent.");
        }
        this.panelElement = panelElement;
        this.eventAggregator = eventAggregator;
        this.stateService = stateService; // [NEW] Store injected service
        this.calculationService = calculationService; // [NEW] Store injected service
        this.authService = authService; // [NEW] (v6298) Store injected service
        this.quotePersistenceService = quotePersistenceService || null; // [Scheme B] For F3 live ledger
        this.workflowService = workflowService || null; // [DIRECTIVE-v3.27] For Service-Layer Tollbooth
        this.state = null;

        // [MODIFIED] Views are no longer pre-injected. They will be loaded on demand.
        this.views = {};
        this.activeView = null; // Default active view

        this.tabContainer = this.panelElement.querySelector('.tab-container');
        this.tabButtons = this.panelElement.querySelectorAll('.tab-button');
        this.tabContents = this.panelElement.querySelectorAll('.tab-content');

        // [NEW] (v6298-fix-5) Store bound handler
        this.boundTabClickHandler = this._onTabClick.bind(this);

        this.initialize();
        console.log("RightPanelComponent (Refactored as a Lazy-Loading Manager) Initialized.");
    }

    initialize() {
        if (this.tabContainer) {
            // [MODIFIED] (v6298-fix-5) Use helper
            this.tabContainer.addEventListener('click', this.boundTabClickHandler);
        }
    }

    /**
     * [NEW] (v6298-fix-5) Destroys all event listeners and instantiated views.
     */
    destroy() {
        if (this.tabContainer) {
            this.tabContainer.removeEventListener('click', this.boundTabClickHandler);
        }

        // Destroy all dynamically loaded views that were instantiated
        for (const viewKey in this.views) {
            if (this.views[viewKey] && typeof this.views[viewKey].destroy === 'function') {
                this.views[viewKey].destroy();
            }
        }
        this.views = {};
        this.activeView = null;
        console.log("RightPanelComponent destroyed.");
    }

    _onTabClick(event) {
        const target = event.target.closest('.tab-button');
        if (target && !target.disabled) {
            this.setActiveTab(target.id);
        }
    }


    render(state) {
        this.state = state; // Cache the latest state

        // Only render the currently active sub-view for performance.
        if (this.activeView && typeof this.activeView.render === 'function') {
            this.activeView.render(state);
        }
    }

    // [MODIFIED] Method is now async to support dynamic import()
    async setActiveTab(tabId) {
        const targetContentId = document.getElementById(tabId)?.dataset.tabTarget;
        if (!targetContentId) return;

        this.tabButtons.forEach(button => {
            button.classList.toggle('active', button.id === tabId);
        });

        this.tabContents.forEach(content => {
            content.classList.toggle('active', `#${content.id}` === targetContentId);
        });

        // --- [NEW] (Refactor - Lazy Load) ---
        // Check if the view for this tab has been loaded yet.
        if (!this.views[tabId]) {
            // If not, dynamically import and instantiate it.
            try {
                switch (tabId) {
                    case 'f1-tab': {
                        const { F1CostView } = await import('./views/f1-cost-view.js');
                        this.views[tabId] = new F1CostView({
                            panelElement: this.panelElement,
                            eventAggregator: this.eventAggregator,
                            calculationService: this.calculationService,
                            stateService: this.stateService
                        });
                        break;
                    }
                    case 'f2-tab': {
                        const { F2SummaryView } = await import('./views/f2-summary-view.js');
                        this.views[tabId] = new F2SummaryView({
                            panelElement: this.panelElement,
                            eventAggregator: this.eventAggregator,
                            stateService: this.stateService,
                            calculationService: this.calculationService
                        });
                        break;
                    }
                    case 'f3-tab': {
                        const { F3QuotePrepView } = await import('./views/f3-quote-prep-view.js');
                        this.views[tabId] = new F3QuotePrepView({
                            panelElement: this.panelElement,
                            eventAggregator: this.eventAggregator,
                            stateService: this.stateService,
                            quotePersistenceService: this.quotePersistenceService, // [Scheme B]
                            workflowService: this.workflowService // [DIRECTIVE-v3.27]
                        });
                        break;
                    }
                    case 'f4-tab': {
                        // [NEW] Dynamically load F4 HTML first
                        const f4Container = this.panelElement.querySelector('#f4-content');
                        if (f4Container && !f4Container.innerHTML.trim()) {
                            try {
                                const response = await fetch('./04-core-code/ui/partials/f4-panel.html');
                                if (response.ok) {
                                    f4Container.innerHTML = await response.text();
                                } else {
                                    console.error("Failed to lazy-load f4-panel.html:", response.statusText);
                                }
                            } catch (err) {
                                console.error("Error fetching f4-panel.html:", err);
                            }
                        }

                        const { F4ActionsView } = await import('./views/f4-actions-view.js');
                        this.views[tabId] = new F4ActionsView({
                            panelElement: this.panelElement,
                            eventAggregator: this.eventAggregator,
                            authService: this.authService // [NEW] (v6298) Pass auth service
                        });
                        break;
                    }
                }
            } catch (err) {
                console.error(`Failed to lazy-load view for ${tabId}:`, err);
                return; // Stop execution if loading failed
            }
        }
        // --- End of Lazy Load Logic ---

        // [NEW] (Lifecycle Management) Deactivate the outgoing view before switching
        if (this.activeView && typeof this.activeView.deactivate === 'function') {
            console.log(`[Lifecycle] Deactivating previous view: ${this.activeView.constructor.name}`);
            this.activeView.deactivate();
        }

        this.activeView = this.views[tabId];

        // Call the activate method on the new active view, if it exists.
        // This is useful for one-time actions when a tab is selected.
        if (this.activeView && typeof this.activeView.activate === 'function') {
            this.activeView.activate();
        }

        // [NEW] (F4 Status Phase 2) Ensure F4 view renders its status UI when activated
        if (tabId === 'f4-tab' && this.activeView && typeof this.activeView.render === 'function' && this.state) {
            this.activeView.render(this.state);
        }
    }
}