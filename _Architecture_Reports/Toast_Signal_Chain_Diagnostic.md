# Toast Notification Signal Trace Diagnostic (Read-Only)

**Date**: 2026-03-12  
**Directive**: v3.19 — Toast Notification Signal Trace  

---

## Agent 1: Event String Verification
**Target Files**: `04-core-code/config/constants.js` and `04-core-code/ui/views/f3-quote-prep-view.js`

- **String Mapping**: The constant `EVENTS.SHOW_NOTIFICATION` maps perfectly to the literal string `'userRequestedShowNotification'` (Line 27 in `constants.js`).
- **F3 Origin Call**: The Tollbooth guard legitimately utilizes this exact constant:
  ```javascript
  this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { 
      type: 'warning', 
      message: 'Please click SAVE first to generate a Quote ID before printing documents.' 
  });
  ```
**Conclusion**: The origin broadcast string is technically correct and free of typos.

---

## Agent 2: Subscription Audit
**Target File**: `04-core-code/ui/notification-component.js`

- **Subscription Status**: The `NotificationComponent` actively subscribes to the correct constant.
  ```javascript
  this._subscribe(EVENTS.SHOW_NOTIFICATION, (data) => this.show(data));
  ```
- **Type Filtering Logic**: The `show({ message, type = 'info', action = null })` method executes unconditionally. There are no state locks (`isLocked`), conditional exceptions, or hard filters blocking notifications. 
- **Type Handling**: The only conditional logic for styling is `if (type === 'error') { toast.classList.add('error'); }`. Thus, a `'warning'` type will simply render as the default `'info'` toast style. It should NOT be invisible on this basis alone.

---

## Agent 3: Event Bus Instantiation Check
**Target Files**: `04-core-code/app-context.js` and `04-core-code/ui/ui-manager.js`

- **Singleton Registry**: In `app-context.js` (Line 58), a single `new EventAggregator()` is instantiated, registered as `'eventAggregator'`, and systematically passed down to `StateService`, `AppController`, `RightPanelComponent`, and ultimately `UIManager`.
- **UI Manager Distribution**: Inside `UIManager`'s constructor, `this.eventAggregator` is injected into the `<NotificationComponent>` (Line 81):
  ```javascript
  this.notificationComponent = new NotificationComponent({
      containerElement: document.getElementById(DOM_IDS.TOAST_CONTAINER),
      eventAggregator: this.eventAggregator
  });
  ```
- **F3 Distribution**: Similarly, `app-context.js` passes the aggregator to `RightPanelComponent`, which then builds `F3QuotePrepView` using that very same bus.
**Conclusion**: Both the sender (F3) and receiver (Notification) are communicating on the exact same singleton instance.

---

## 🔎 Final Assessment (Architectural Inference)
Because the Event String, Subscriptions, and Bus Instances are flawlessly intact, and there are NO logic gate filters for notifications, the absence of the typical "Yellow Toast" is likely an optical/CSS illusion or DOM injection issue. 

Primary suspects:
1. **Container Absence**: `document.getElementById('toast-container')` might be missing or commented out from the `index.html`.
2. **CSS Z-Index / Display**: The `.toast-container` might be buried under the Left Panel / F4 overlays, or it has `display: none` applied during an F-Panel expansion.
3. **Type Mis-styling**: Providing `type: 'warning'` without a corresponding CSS class might cause it to render as white-on-white text, masking its appearance.
