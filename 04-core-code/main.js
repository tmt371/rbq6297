// File: 04-core-code/main.js

import { AppContext } from './app-context.js';
import { MigrationService } from './services/migration-service.js';
import { UIManager } from './ui/ui-manager.js';
import { InputHandler } from './ui/input-handler.js';
import { paths } from './config/paths.js';
import { EVENTS, DOM_IDS } from './config/constants.js';
// [NEW] (v6298-fix) Import reset actions
import * as uiActions from './actions/ui-actions.js';
import * as quoteActions from './actions/quote-actions.js';

class App {
    constructor() {
        this.appContext = new AppContext();
        const migrationService = new MigrationService();

        const restoredData = migrationService.loadAndMigrateData();

        // [MODIFIED] Initialize only non-UI services first.
        this.appContext.initialize(restoredData);
    }

    async _loadPartials() {
        const eventAggregator = this.appContext.get('eventAggregator');
        const loadPartial = async (url, targetElement, injectionMethod = 'append') => {
            try {
                const
                    response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${url}`);
                }
                const html = await response.text();
                if (injectionMethod === 'innerHTML') {
                    targetElement.innerHTML = html;
                } else {
                    targetElement.insertAdjacentHTML('beforeend', html);
                }
            } catch (error) {
                console.error(`Failed to load HTML partial from ${url}:`, error);
                eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: `Error: Could not load UI component from ${url}!`, type: 'error' });
            }
        };

        // [NEW] Helper function to load CSS files dynamically
        const loadCss = (url) => {
            try {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.type = 'text/css';
                link.href = url;
                document.head.appendChild(link);
            } catch (error) {
                console.error(`Failed to load CSS from ${url}:`, error);
            }
        };

        // --- [NEW] (v6297) Load Login Component ---
        const loginContainer = document.getElementById('login-container');
        if (loginContainer) {
            await loadPartial(paths.partials.loginComponent, loginContainer, 'innerHTML');
            // CSS is already loaded via style.css @import
        }

        // --- Load Main Panel Skeletons ---
        await loadPartial(paths.partials.leftPanel, document.body);

        const functionPanel = document.getElementById(DOM_IDS.FUNCTION_PANEL);
        if (functionPanel) {
            await loadPartial(paths.partials.rightPanel, functionPanel, 'innerHTML');
        }

        // --- [NEW] Load K1 Tab Bundle ---
        const k1ContentContainer =
            document.getElementById('k1-content');
        if (k1ContentContainer) {
            await loadPartial(paths.tabs.k1.html, k1ContentContainer, 'innerHTML');
            loadCss(paths.tabs.k1.css);
        }

        // --- [NEW] Load K2 Tab Bundle ---
        const k2ContentContainer = document.getElementById('k2-content');
        if (k2ContentContainer) {
            await loadPartial(paths.tabs.k2.html, k2ContentContainer, 'innerHTML');
            loadCss(paths.tabs.k2.css);
        }

        // --- [NEW] Load K3 Tab Bundle ---
        const k3ContentContainer = document.getElementById('k3-content');
        if (k3ContentContainer) {
            await loadPartial(paths.tabs.k3.html, k3ContentContainer, 'innerHTML');
            loadCss(paths.tabs.k3.css);
        }

        // --- [NEW] Load K4 Tab Bundle ---
        const k4ContentContainer = document.getElementById('k4-content');
        if (k4ContentContainer) {
            await loadPartial(paths.tabs.k4.html, k4ContentContainer, 'innerHTML');
            loadCss(paths.tabs.k4.css);
        }

        // --- [NEW] Load K5 Tab Bundle ---
        const k5ContentContainer = document.getElementById('k5-content');
        if (k5ContentContainer) {
            await loadPartial(paths.tabs.k5.html, k5ContentContainer, 'innerHTML');
            loadCss(paths.tabs.k5.css);
        }
    }

    async run() {
        console.log("Application starting...");

        // [NEW] (v6297) Get Auth Service early
        const authService = this.appContext.get('authService');
        const eventAggregator = this.appContext.get('eventAggregator');
        // [NEW] (v6298-fix) Get State Service for reset
        const stateService = this.appContext.get('stateService');

        // [NEW] (v6297) Observe auth state
        authService.observeAuthState(
            (user) => {
                // --- On User Logged In ---
                console.log(`User ${user.email} logged in. Initializing main app...`);
                // Load and initialize the main app UI ONLY after login.
                // [FIX] Check if UIManager already exists to prevent re-initialization on hot-reload
                if (!this.uiManager) {
                    this._initializeAppUI(eventAggregator);
                }
            },
            () => { // [MODIFIED] (v6298-fix) Removed 'user' param, it's null
                // --- On User Logged Out ---
                console.log("No user logged in. Showing login screen.");

                // [NEW] (v6298-fix) Reset application state and UI
                this._resetApplicationState(stateService);

                // Show login screen, hide app
                document.getElementById('login-container')?.classList.remove('is-hidden');
                document.getElementById(DOM_IDS.APP)?.classList.add('is-hidden');

                // [NEW] (v6298-fix) Force-hide panels that might be expanded
                document.getElementById(DOM_IDS.FUNCTION_PANEL)?.classList.remove('is-expanded');
                document.getElementById(DOM_IDS.LEFT_PANEL)?.classList.remove('is-expanded');

                // [NEW] (v6298-fix-2) Manually reset the login form's DOM state
                const loginButton = document.getElementById('login-button');
                const loginPassword = document.getElementById('login-password');
                const loginErrorMessage = document.getElementById('login-error-message');

                if (loginButton) {
                    loginButton.disabled = false;
                    loginButton.textContent = 'Login';
                }
                if (loginPassword) {
                    loginPassword.value = ''; // Clear password field
                }
                if (loginErrorMessage) {
                    loginErrorMessage.classList.add('is-hidden');
                    loginErrorMessage.textContent = '';
                }
            }
        );

        // Step 1: Load all HTML templates into the DOM.
        // This now loads the login-component.html as well.
        await this._loadPartials();

        // [NEW] (v6297) Initialize the login form handler *immediately* after loading partials.
        // This fixes the bug where the login button did nothing.
        this._initializeLoginHandler(authService, eventAggregator); // [MODIFIED] (v6298) Pass eventAggregator

        // [REMOVED] (v6297) We no longer initialize the UI here.
        // It will be initialized by the auth observer callback.

        console.log("Application running. Waiting for auth state...");
        document.body.classList.add('app-is-ready');
    }

    /**
     * [NEW] (v6298-fix) Resets the entire application state and destroys UI instances.
     */
    _resetApplicationState(stateService) {
        if (!stateService) return;

        // 1. Nullify instances to force re-initialization on next login
        // [MODIFIED] (v6298-fix-2) This MUST happen first to prevent the race condition.
        this.uiManager = null;
        this.inputHandler = null; // Assuming InputHandler is property of App

        // 2. Dispatch actions to reset the state to its initial value
        stateService.dispatch(quoteActions.resetQuoteData());
        stateService.dispatch(uiActions.resetUi());

        console.log("Application state and UI instances have been reset.");
    }


    /**
     * [NEW] (v6297) (FIX) This logic is moved from UIManager to main.js
     * It runs *before* authentication to make the login form interactive.
     * [MODIFIED] (v6298) Added forgot password logic.
     */
    _initializeLoginHandler(authService, eventAggregator) {
        const loginForm = document.getElementById('login-form');
        const loginButton = document.getElementById('login-button');
        const loginEmail = document.getElementById('login-email');
        const loginPassword = document.getElementById('login-password');
        const loginErrorMessage = document.getElementById('login-error-message');
        const forgotPasswordLink = document.getElementById(DOM_IDS.FORGOT_PASSWORD_LINK); // [NEW] (v6298)

        if (!loginForm || !authService) {
            console.warn("Login form or AuthService not found, login cannot be initialized.");
            return;
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            loginButton.disabled = true;
            loginButton.textContent = 'Logging in...';
            loginErrorMessage.classList.add('is-hidden');

            const email = loginEmail.value;
            const password = loginPassword.value;

            const result = await authService.login(email, password);

            if (result.success) {
                // Success! The onAuthStateChanged listener will now
                // fire and call _initializeAppUI() to show the main app.
            } else {
                // Show error message
                loginErrorMessage.textContent = result.message;
                loginErrorMessage.classList.remove('is-hidden');
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
        });

        // [NEW] (v6298) Add listener for "Forgot Password"
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', async (e) => {
                e.preventDefault();
                const email = loginEmail.value || window.prompt('Please enter your account email to receive a password reset link:');

                if (!email) {
                    eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                        message: 'Email address is required.',
                        type: 'error',
                    });
                    return;
                }

                loginErrorMessage.classList.add('is-hidden');
                const result = await authService.sendPasswordReset(email);

                if (result.success) {
                    eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                        message: result.message,
                        type: 'info',
                    });
                } else {
                    loginErrorMessage.textContent = result.message;
                    loginErrorMessage.classList.remove('is-hidden');
                }
            });
        }
    }

    /**
     * [NEW] (v6297) Encapsulated the main app UI initialization.
     * This function is called by the AuthService observer ONLY when a user is logged in.
     */
    async _initializeAppUI(eventAggregator) {
        // Step 2: Initialize all UI components now that their DOM elements exist
        // and the user is authenticated.
        this.appContext.initializeUIComponents();

        // Step 3: Get all fully initialized instances from the context.
        const calculationService = this.appContext.get('calculationService');
        const configManager = this.appContext.get('configManager');
        const appController = this.appContext.get('appController');
        const rightPanelComponent = this.appContext.get('rightPanelComponent');
        const leftPanelTabManager = this.appContext.get('leftPanelTabManager');
        const k1TabComponent = this.appContext.get('k1TabComponent');
        const k2TabComponent = this.appContext.get('k2TabComponent');
        const k3TabComponent = this.appContext.get('k3TabComponent');
        const k4TabComponent = this.appContext.get('k4TabComponent');
        const k5TabComponent = this.appContext.get('k5TabComponent');

        // [REMOVED]

        // Step 4: Initialize the main UI manager.
        this.uiManager = new UIManager({
            appElement: document.getElementById(DOM_IDS.APP),
            eventAggregator,
            calculationService,
            rightPanelComponent,
            leftPanelTabManager, // [NEW] Inject LeftPanelTabManager
            k1TabComponent, // [NEW] Inject K1 component
            k2TabComponent, // [NEW] (v6294) Inject K2 component
            k3TabComponent, // [NEW] Inject K3 component
            k4TabComponent, // [NEW] Inject K4 component
            k5TabComponent, // [NEW] Inject K5 component
            // [REMOVED] (v6297) authService is no longer needed here
            // authService: this.appContext.get('authService'),
        });

        // Step 5: Continue with the rest of the application startup.
        await configManager.initialize();

        // [MODIFIED] (v6298-fix-2) Add safety check
        eventAggregator.subscribe(EVENTS.STATE_CHANGED, (state) => {
            // Only render if the uiManager instance still exists.
            // This check will fail during logout, preventing the crash.
            if (this.uiManager) {
                this.uiManager.render(state);
            }
        });

        appController.publishInitialState();

        this.inputHandler = new InputHandler(eventAggregator);
        this.inputHandler.initialize();

        eventAggregator.subscribe(EVENTS.APP_READY, () => {
            setTimeout(() => {
                eventAggregator.publish(EVENTS.FOCUS_CELL, { rowIndex: 0, column: 'width' });
            }, 100);
        });

        eventAggregator.publish(EVENTS.APP_READY);

        // [NEW] (v6297) Show the app and hide the login screen
        document.getElementById('login-container')?.classList.add('is-hidden');
        document.getElementById(DOM_IDS.APP)?.classList.remove('is-hidden');

        console.log("Main App UI Initialized and interactive.");
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const app = new App();
    await app.run();
});