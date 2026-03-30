# Major Architectural Risk Report

**Date**: 2026-03-28  
**Scope**: `04-core-code/` — Services, Reducers, State Management, Persistence, UI Views

---

## 1. Service-Layer Isolation (Decoupling)

### Circular Dependencies
- **No hard circular imports detected.** Dependency flow is top-down: `main.js` → `AppContext` → Services → Config. Services reference each other only via constructor injection (DI), not `import`.
- **Soft circular risk**: `WorkflowService` holds references to both `CalculationService` and `QuotePersistenceService`. If either service were ever modified to call back into `WorkflowService`, a hidden cycle would emerge. Currently safe, but the coupling surface is wide (8 injected dependencies).

### DOM Coupling in Services
- **`CalculationService`**: Clean. No DOM access. Accepts a `domValues = {}` parameter in `calculateF2Summary()`, but these are plain numeric values passed in by the caller — not direct DOM queries. Safe for headless/test environments.
- **`WorkflowService`**: **RISK — uses `window.open()` directly** (lines 83, 129, 164) for opening generated HTML in new tabs. This would crash in a Node.js test runner or server-side rendering context.
- **`QuoteGeneratorService`**: Uses `new DOMParser()` (line 245) for post-render HTML mutations. This is a browser-only API. Any future server-side PDF generation (e.g., Puppeteer pipeline) would need this refactored.
- **`main.js` (App bootstrap)**: Heavily DOM-coupled (`document.getElementById` everywhere). Expected for a bootstrap file but means initialization logic is untestable without a full browser environment.

---

## 2. State Management Robustness

### State Tree Size
- The global state tree (`initial-state.js`, 231 lines) is **moderately large but manageable**. It contains two root branches: `ui` (~143 properties across nested objects) and `quoteData` (~87 properties). 
- **Risk area**: `ui.f2` alone contains 25+ keys. As features grow, this flat namespace will become increasingly difficult to reason about. No sub-reducer currently handles `f2` in isolation.

### Race Conditions
- **`StateService.dispatch()` is `async`** (line 37 of `state-service.js`). It publishes `INTERNAL_STATE_UPDATED` via the EventAggregator, which uses `Promise.allSettled`. Multiple rapid dispatches (e.g., user typing quickly into F2 fields while F1 recalculates) could cause **stale-state reads**: a subscriber reading `getState()` mid-pipeline may see an intermediate snapshot, not the final settled state.
- **`structuredClone` on every `getState()` call** (line 30): Defensive but expensive. With 15+ items in the products array and frequent render cycles, this deep clone can become a performance bottleneck. No memoization or selector pattern exists to short-circuit unnecessary re-renders.
- **No dispatch queue or batching**: If two event handlers both call `dispatch()` in the same microtask, each triggers a full re-render. There is no `batchDispatch()` equivalent.

---

## 3. Persistence Layer Scalability

### Single-User Lock-In
- **`saveQuoteToCloud()`** in `online-storage-service.js` (line 32) uses `setDoc(doc(db, 'quotes', quoteData.quoteId), quoteData)` — a **full document overwrite**. In a multi-user environment, if User A and User B both load the same quote and save concurrently, the last write wins with **zero conflict detection**. There are no Firestore transactions, optimistic locking, or version counters.
- **`handleRegisterPayment()`** in `quote-persistence-service.js` (line 285) uses `setDoc(..., { merge: true })` with `arrayUnion` for payments. This is actually **multi-user safe** for appending payments — Firestore's `arrayUnion` is atomic. However, the `totalAmount` field written alongside it is derived from local state, not the server document. If two users register payments simultaneously, the `totalAmount` could be overwritten with a stale value.

### Ledger ID Fragility
- **`_getBaseLedgerId()`** uses a regex heuristic to strip version suffixes (`-A`, `-B`, `-v2`). If a quoteId ever contains a trailing single uppercase letter that is NOT a version marker (e.g., a customer initial), the ledger would be miskeyed, orphaning payment data.

---

## 4. UI Extensibility

### Product-Type Coupling
- **`quick-quote-view.js`** (line 19): Hardcodes `this.currentProduct = 'rollerBlind'`. No dynamic product selection exists in the UI.
- **`f1-cost-view.js`** (line 342): Directly accesses `quoteData.products.rollerBlind.summary.totalSum` — bypassing the `currentProduct` key entirely. Adding a second product type would require modifying this accessor.
- **`initial-state.js`**: The `products` object uses `[PRODUCT_TYPES.ROLLER_BLIND]` as its only key. The item schema (`width`, `height`, `fabricType`, `winder`, `motor`, `dual`, `chain`) is entirely roller-blind-specific. A "Curtain" product would need a completely different item shape.
- **`quote-reducer.js`**: All item mutation logic (insert/delete/clear/update) operates on the generic `productKey` from state — this is **correctly abstracted** and would support a second product type without modification.
- **`fabric-config-view.js`** (750+ lines): Tightly coupled to the roller blind fabric selection UX. Cannot be reused for curtain fabric selection without a major refactor.

### Extensibility Difficulty Rating
Adding a new product category (e.g., Curtains) would require changes across **at minimum 8 files**:
1. `business-constants.js` — New `PRODUCT_TYPES` entry
2. `initial-state.js` — New product branch with curtain-specific item schema
3. A new `CurtainStrategy` class implementing `calculatePrice()` and `getInitialItemData()`
4. `ProductFactory` — Register the new strategy
5. `quick-quote-view.js` — Product selector UI
6. `f1-cost-view.js` — Remove hardcoded `rollerBlind` accessor
7. `calculation-service.js` — Verify all accessory logic is product-agnostic
8. New K-tab views for curtain-specific configuration

**Estimated effort**: Medium-High. The Strategy pattern is in place, but the UI layer assumes a single product type throughout.

---

## Summary of Top 5 Risks (Prioritized)

| # | Risk | Severity | Impact Area |
|---|------|----------|-------------|
| 1 | `setDoc` full-overwrite with no conflict detection | **High** | Multi-user data loss |
| 2 | `window.open()` / `DOMParser` in service layer | **Medium** | Testability, server-side rendering |
| 3 | Rapid async dispatch race conditions (no batching) | **Medium** | UI consistency under load |
| 4 | Hardcoded `rollerBlind` product key in views | **Medium** | Product extensibility |
| 5 | `structuredClone` on every `getState()` call | **Low** | Performance at scale |

任務完成
