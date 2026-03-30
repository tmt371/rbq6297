# Sync Flow Audit Report: F-Panel State Synchronization Diagnostic

## 1. F2 Subscription Architecture
The audit of `app-controller.js` and `f2-summary-view.js` reveals a "Pull-based" rather than a "Push-based" synchronization model for F2 quantities.

- **Trigger Mechanism**: `AppController` listens for `INTERNAL_STATE_UPDATED` and broadcasts `STATE_CHANGED`. The `RightPanelComponent` receives this and calls `F2SummaryView.render(state)`.
- **Rendering Logic**: In [f2-summary-view.js:L297](file:///c:/rbq6297/04-core-code/ui/views/f2-summary-view.js#L297), the view simply maps `f2State.installQty` (the value stored in the UI reducer) to the input field.
- **The Gap**: Unlike F1, there is no background observer in `AppController` that monitors changes to the product item count and updates the F2 quantities automatically. F2 essentially "remembers" whatever value was last set in its state.

## 2. Lifecycle Re-entry Check (The "Null Guard" Trap)
Tracing the transition from F1 to F2 highlights a critical logic flaw in the tab activation sequence:

- **Data Hydration**: [f2-summary-view.js:L360-368](file:///c:/rbq6297/04-core-code/ui/views/f2-summary-view.js#L360-368)
  ```javascript
  if (ui.f2.installQty === null) {
      const items = updatedQuoteData.products[updatedQuoteData.currentProduct].items;
      const defaultInstallQty = items.length > 0 ? items.length - 1 : 0;
      if (defaultInstallQty >= 0) {
          this.stateService.dispatch(uiActions.setF2Value('installQty', defaultInstallQty));
      }
  }
  ```
- **Stale Cache Issue**: The `installQty === null` check prevents the view from re-calculating the default count if a value has *already* been established. 
- **Scenario**: 
  1. User adds 1 item. 
  2. User visits F2. `installQty` becomes 1.
  3. User goes back to Main Table, adds another item (total 2).
  4. User returns to F2. The check `if (installQty === null)` fails (it is 1), so the code skips the logic that would have updated it to 2.
- **Result**: F2 pulls "stale" data from the global state service because the re-hydration logic is guarded by a one-time-only null check.

## 3. Component Comparison (F1 vs F2)
The difference in behavior between the two panels is due to their architectural "Observer" patterns:

| Feature | F1 (Cost View) | F2 (Summary View) |
| :--- | :--- | :--- |
| **Reactive Trigger** | Listens to `PRICES_UPDATED` globally in `AppController`. | Only reacts to manual tab clicks or values in `ui.f2`. |
| **Data Source** | Dynamically derived from `quoteData` via `updateF1Cache()` on every activation. | Persistently stored in `ui.f2`; only defaults once. |
| **Input Capture** | Dispatches to state on every input. | Reads from **DOM elements** in `_calculateF2Summary()`. |

**Identified Missing Link**:
F2 lacks a "Dynamic Recalculation" block in its `activate()` method. While F1 calls `this.updateF1Cache()` every time the tab is selected, F2 uses a "Null-Restricted" initialization that freezes values once they are first touched.

---
> [!IMPORTANT]
> To fix this in a future phase, the `if (ui.f2.installQty === null)` guard should be removed or replaced with a "Freshness" check, and F2 should likely have a global observer similar to F1's motor-price sync.

任務完成
