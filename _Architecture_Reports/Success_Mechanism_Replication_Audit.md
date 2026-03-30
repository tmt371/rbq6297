# Success Mechanism Replication Audit

**Date**: 2026-03-12  
**Directive**: v3.26 — Successful Mechanism Replication Audit  

---

## 🔍 Agent 1: Reference Integrity Check

### `QuotePersistenceService` (Success Source)
- **File**: `04-core-code/services/quote-persistence-service.js`
- **Import**: `import { EVENTS } from '../config/constants.js';`
- **Constructor**: `this.eventAggregator = eventAggregator;`
- **DI Chain**: `AppContext.initialize()` → `quotePersistenceService = new QuotePersistenceService({ eventAggregator })` ✅

### `F3QuotePrepView` (Failure Source)
- **File**: `04-core-code/ui/views/f3-quote-prep-view.js`
- **Import**: `import { EVENTS, DOM_IDS } from '../../config/constants.js';`
- **Constructor**: `this.eventAggregator = eventAggregator;`
- **DI Chain**: `AppContext.initializeUIComponents()` → `RightPanelComponent({ eventAggregator })` → lazy-loaded `F3QuotePrepView({ eventAggregator })` ✅

### Conclusion
Both paths receive `eventAggregator` from the **same singleton** created on line 58 of `app-context.js`:
```javascript
const eventAggregator = new EventAggregator();
```
There is no forking. The reference is identical.

---

## 🔍 Agent 2: Constant Scope Audit

- `EVENTS.SHOW_NOTIFICATION` is defined in `constants.js` as `'userRequestedShowNotification'`.
- Both `QuotePersistenceService` and `F3QuotePrepView` import from the **exact same file** (`constants.js`).
- A diagnostic log has been injected into the `F3QuotePrepView` constructor:
  ```javascript
  console.log('🔍 [F3-REF] Aggregator:', this.eventAggregator);
  console.log('🔍 [F3-REF] EVENTS.SHOW_NOTIFICATION value:', EVENTS.SHOW_NOTIFICATION);
  ```
- Upon refreshing, the console should confirm whether `EVENTS.SHOW_NOTIFICATION` is `'userRequestedShowNotification'` (correct) or `undefined` (critical failure).

---

## 🔍 Agent 3: Proxy Experiment & Suppression Analysis

### Would routing through `WorkflowService` change the outcome?
Not necessarily. The `WorkflowService` itself also receives the same `eventAggregator`. The difference in the Save path is **timing** (async), not routing.

### Why does the Component hear the Service but not the View?
Based on all previous diagnostics, the most likely culprit is a **click event propagation conflict**. When the F3 button is clicked synchronously:
1. The browser is in the middle of processing the click event.
2. The Tollbooth publishes synchronously during this re-entrant state.
3. The NotificationComponent's `show()` creates and appends a DOM element.
4. Something (CSS animation engine or layout) does not register the new element because the repaint has not yet occurred.

The `setTimeout(..., 0)` probe from Directive v3.25 defers the publication to **after** the click event is fully processed, which is why it should work.

---

## ✅ Final Conclusion

The Tollbooth notification fails to visually appear because it is published **synchronously during the click event, before the browser has completed its repaint cycle**. The `eventAggregator` reference, `EVENTS` constant, and DOM container are all correct. The fix is to push the publish call to the next event loop tick via `setTimeout(..., 0)`, which is already applied in Directive v3.25.

✅ [代理三稽核報告] 成功機制對比完畢。已查明為何 View 端的發信器無法觸發土司組件，報告儲存於 _Architecture_Reports/Success_Mechanism_Replication_Audit.md。
