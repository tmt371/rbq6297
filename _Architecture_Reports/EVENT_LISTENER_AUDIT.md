# Event Listener Lifecycle & Memory Leak Audit Report

## 1. Event Binding Audit
**Implementation Pattern in Sub-Views:**
- The views (`f1-cost-view.js`, `f2-summary-view.js`, `f4-actions-view.js`) enforce a unified, robust setup. They do not use naked `addEventListener` calls. Instead, they proxy calls through an internal `_addListener(element, event, handler)` method.
- This method specifically binds `this` to the handler and pushes the reference payload `{ element, event, handler }` into a local `this.boundHandlers` array.
- **Teardown Capability:** Every audited view has a corresponding `destroy()` method that successfully iterates over `this.boundHandlers` and executes `removeEventListener`, clearing the array afterwards.

**Tab Manager Lifecycle (`RightPanelComponent.js`):**
- **The Core Issue:** While the views are fully capable of destroying their own listeners, `RightPanelComponent` completely ignores this capability during tab switching. 
- In `setActiveTab(tabId)`, the manager lazily instantiates the View classes (`new F1CostView(...)`) and stores them inside a `this.views` dictionary. 
- When switching between tabs, the previous `activeView` is **never deactivated nor destroyed**. The manager simply reassigns the `this.activeView` pointer and applies CSS (`.active`) to hide/show the HTML contents. 
- `RightPanelComponent` only invokes `view.destroy()` deep inside its own global `.destroy()` method, meaning listeners accumulate and remain active on hidden tabs for the entire lifespan of the user's session.

## 2. Memory Leak Potential
- **EventAggregator Status:** *SAFE.* Despite the lack of unmounting, the F1, F2, and F4 views solely use `this.eventAggregator.publish(...)` to broadcast actions out. They do not actively `subscribe` to the Event Aggregator. Because they are not registering persistent callback functions to the global bus, they bypass the most common JavaScript memory leak (Zombie Subscribers).
- **DOM Listener Leaks:** *MINOR/MODERATE.* Because the F-series HTML DOM elements are persistent (simply hidden via CSS rather than deleted from the DOM), the event listeners tied to them do not point to orphaned/garbage-collected DOM nodes. However, any global listeners (e.g., if one were tied to `document` or `window`) would execute in the background. Note: `f4-actions-view.js` injects a global `window.toggleF4Accordion` function statically, which bypasses class encapsulation but doesn't recursively compound.

## 3. Reconstruction Strategy
To formalize the architecture and prevent background processing conflicts (like hidden tabs validating inputs or capturing global hotkeys), the `RightPanelComponent` needs a proper State Machine lifecycle mapping.

**Proposed Solution: The Mount/Unmount Pattern**
In `RightPanelComponent.js`'s `setActiveTab(...)` method, inject a cleanup transition before instantiating/activating the next tab:

```javascript
// Step 1: Graceful sleep for the outgoing view
if (this.activeView) {
    if (typeof this.activeView.deactivate === 'function') {
        this.activeView.deactivate(); // Suspend animations/polling if applicable
    }
    // Optional: Only call destroy() if you want to aggressively free memory, 
    // requiring you to re-run `new F1CostView()` when they revisit.
}

// Step 2: Switch context
this.activeView = this.views[tabId];

// Step 3: Awaken the incoming view
if (this.activeView && typeof this.activeView.activate === 'function') {
    this.activeView.activate();
}
```
Currently, `activate()` is only used to auto-focus inputs or populate calculation caches upon entering a tab, but adding a complementary `deactivate()` would fully seal the MVC lifecycle architecture.
