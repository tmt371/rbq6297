// File: 04-core-code/ui/views/f4-actions-view.js

import { EVENTS, DOM_IDS } from '../../config/constants.js';

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the F4 (Actions) tab.
 */
export class F4ActionsView {
    constructor({ panelElement, eventAggregator, authService }) { // [MODIFIED] (v6298) Added authService
        this.panelElement = panelElement;
        this.eventAggregator = eventAggregator;
        this.authService = authService; // [NEW] (v6298) Store authService

        this._cacheF4Elements();
        this._initializeF4Listeners();
        console.log('F4ActionsView Initialized.');
    }

    _cacheF4Elements() {
        const query = (id) => this.panelElement.querySelector(id);
        this.f4 = {
            buttons: {
                'f1-key-save': query('#f1-key-save'),
                'f1-key-export': query('#f1-key-export'),
                'f1-key-load': query('#f1-key-load'),
                'f4-key-load-cloud': query(`#${DOM_IDS.F4_BTN_SEARCH_DIALOG}`), // [MODIFIED] Old ID no longer exists, new ID used
                'f4-key-logout': query(`#${DOM_IDS.F4_BTN_LOGOUT}`), // [NEW]
                'f1-key-reset': query('#f1-key-reset'),
            },
        };
    }

    _initializeF4Listeners() {
        // [MODIFIED] Add new event for cloud load, search dialog, and logout
        const buttonEventMap = {
            'f1-key-save': EVENTS.USER_REQUESTED_SAVE,
            'f1-key-export': EVENTS.USER_REQUESTED_EXPORT_CSV,
            'f1-key-load': EVENTS.USER_REQUESTED_LOAD,
            'f4-key-load-cloud': EVENTS.USER_REQUESTED_SEARCH_DIALOG, // [MODIFIED] (v6298) This button now triggers the search dialog
            'f1-key-reset': EVENTS.USER_REQUESTED_RESET,
        };

        for (const [id, eventName] of Object.entries(buttonEventMap)) {
            const button = this.f4.buttons[id];
            if (button) {
                // [MODIFIED] Update text for the local load button
                if (id === 'f1-key-load') {
                    button.textContent = 'Load File';
                }
                button.addEventListener(
                    'click',
                    () => this.eventAggregator.publish(eventName)
                );
            }
        }

        // [NEW] (v6298) Specific listener for Logout button
        const logoutButton = this.f4.buttons['f4-key-logout'];
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                if (this.authService) {
                    this.authService.logout();
                } else {
                    console.error("AuthService not available in F4ActionsView.");
                }
            });
        }
    }

    // This view is static and doesn't require render or activate methods.
}