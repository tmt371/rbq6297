// /04-core-code/ui/notification-component.js

import { EVENTS } from '../config/constants.js';

/**
 * @fileoverview A dedicated component for managing and displaying toast notifications.
 */
export class NotificationComponent {
    /**
     * @param {HTMLElement} containerElement The element to which notifications will be appended.
     * @param {EventAggregator} eventAggregator The application's event bus.
     */
    constructor({ containerElement, eventAggregator }) {
        if (!containerElement || !eventAggregator) {
            throw new Error("Container element and event aggregator are required for NotificationComponent.");
        }
        this.container = containerElement;
        this.eventAggregator = eventAggregator;

        // [NEW] (v6298-fix) Store subscriptions for destruction
        this.subscriptions = [];

        this.initialize();
        console.log("NotificationComponent Initialized.");
    }

    initialize() {
        // [MODIFIED] (v6298-fix) Use subscription helper
        this._subscribe(EVENTS.SHOW_NOTIFICATION, (data) => this.show(data));
    }

    /**
     * [NEW] (v6298-fix) Helper to subscribe and store references
     */
    _subscribe(eventName, handler) {
        const boundHandler = handler.bind(this);
        this.subscriptions.push({ eventName, handler: boundHandler });
        this.eventAggregator.subscribe(eventName, boundHandler);
    }

    /**
     * [NEW] (v6298-fix) Destroys all event subscriptions.
     */
    destroy() {
        this.subscriptions.forEach(({ eventName, handler }) => {
            this.eventAggregator.unsubscribe(eventName, handler);
        });
        this.subscriptions = [];
        console.log("NotificationComponent destroyed.");
    }

    /**
     * Creates and displays a toast notification.
     * @param {object} data The notification data { message, type, action }.
     */
    show({ message, type = 'info', action = null }) {
        console.log("🍞 [TOAST INK] 1. show() invoked with message:", message);
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        // Use an inner span for the text message
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        toast.appendChild(messageSpan);

        // [NEW] Add optional action button (e.g., Undo)
        if (action && action.label && typeof action.callback === 'function') {
            const actionBtn = document.createElement('button');
            actionBtn.className = 'toast-action-btn';
            actionBtn.textContent = action.label;
            actionBtn.onclick = () => {
                action.callback();
                toast.remove(); // Remove immediately after action
            };
            toast.appendChild(actionBtn);
            // Optionally prevent auto-hide when there's an action, or keep it. We'll keep auto-hide.
        }

        if (type === 'error') {
            toast.classList.add('error');
        }

        console.log("🍞 [TOAST INK] 2. Container Reference exists?", !!this.container);
        this.container.appendChild(toast);
        console.log("🍞 [TOAST INK] 3. toast appended to DOM. Current Children count:", this.container.children.length);

        // The animation defined in CSS will handle the fade out.
        // We just need to remove the element from the DOM after the animation is complete.
        setTimeout(() => {
            toast.remove();
            console.log("🍞 [TOAST INK] 4. toast removed via setTimeout.");
        }, 5000); // Should match the animation duration in style.css
    }
}