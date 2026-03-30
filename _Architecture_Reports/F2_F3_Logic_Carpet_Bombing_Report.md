# 🚨 Architecture Audit Report: F2/F3 Logic Carpet-Bombing [DIRECTIVE-v3.38] 🚨

**Auditor**: Agent 3 (Validator)
**Date**: 2026-03-19
**Status**: forensic_complete ✅

---

## 1. The "Ghost 20" Identification (Source of Truth)

The $20 Installation fee ($5 discrepancy) is **not a ghost**; it is the **hardcoded system default** that the PDF engine falls back to when it cannot find a valid UI override.

### Evidence: `04-core-code/config/f2-config.js`
```javascript
// Lines 10-11
export const f2Config = {
    unitPrices: {
        wifi: 200,
        delivery: 0,
        install: 20, // <--- THE SOURCE OF THE $20 PDF VALUE
        removal: 20  // <--- THE SOURCE OF THE $20 PDF VALUE
    }
};
```

> [!IMPORTANT]
> **Why $20?**: While `[DIRECTIVE-v3.35]` zeroed out the `delivery` fee to prevent ghost $100 charges, it left `install` and `removal` at the legacy $20 default.

---

## 2. Agent 1: F2 Lifecycle & State Audit

### Q1: Where does the $15 in the UI come from?
The UI source for $15 is **not in the static codebase**. 
- `initial-state.js` sets `installUnitPrice: null`.
- `f2-config.js` sets `install: 20`.
- **Finding**: The $15 is likely being injected from **Firestore** (as part of a loaded quote's `ui.f2` snapshot) or was manually entered in a previous session and remains in the `StateService` memory. If the UI shows $15 while the config says $20, it means the UI successfully read a "Live" or "Cached" value that the PDF engine bypassed.

### Q2: Why does `newOffer` remain null/stale?
In `04-core-code/ui/views/f2-summary-view.js`:
- `newOffer` is calculated locally in the `render` function for display purposes.
- However, the `stateService.dispatch(uiActions.setF2Value('newOffer', ...))` call is **EXPLICITLY BLOCKED** in `_calculateF2Summary` (Lines 475-477):
```javascript
// [MODIFIED] (Phase 10) DO NOT dispatch newOffer.
// `newOffer` state is ONLY set by user input via `handleF2ValueChange`.
```
- **Consequence**: The Global State's `ui.f2.newOffer` remains `null` until the user manually triggers a change (typing or hitting Enter).

### Q3: Why does the UI fail to push initial calculations?
- The `F2SummaryView._calculateF2Summary()` method correctly dispatches most values.
- **The Breakpoint**: The PDF generation in `WorkflowService.js` (Line 116) pulls `ui` directly from `stateService.getState()`. If the user is on F2 but hasn't "finalized" (blurred/entered) an input, the `ui` state passed to the generator is the **pre-input** version.

---

## 3. Agent 2: F3 [f3-group-action] Generation Audit

### Q1: Where does `add-quote` fetch the "Installation Unit Price"?
It goes through `CalculationService.getQuoteTemplateData()` (Line 564).
Inside that method, it calls `calculateF2Summary(quoteData, ui)` (Line 566).
Inside `calculateF2Summary`:
```javascript
const installUnitPrice = getValFromArgsOrDefault(domValues?.installUnitPrice, Number(f2State.installUnitPrice ?? UNIT_PRICES.install ?? 0) || 0);
```
- **The Failure**: When `add-quote` is clicked, `domValues` is empty. It checks `f2State.installUnitPrice`. If that is `null` (initial state), it falls back to `UNIT_PRICES.install` ($20 from `f2-config.js`).

### Q2: Why "Background Re-calculation" instead of reading UI?
- **Architectural Choice**: The PDF Engine is designed to be "Strategy-Driven" and self-contained. It re-runs the calculation logic to ensure the PDF reflects the data model (`quoteData`), not just the current UI "pixels".
- **The Bug**: It reads the **Global State** for fees (`f2State`), but if the UI View (`F2SummaryView`) hasn't synced its local overrides to the Global State (due to the `newOffer` block or lack of blur event), the PDF engine reverts to `f2-config.js` defaults.

---

## 4. Synthesis & The "Ghost 20" Identification

| Component | Reality (Config) | UI Truth (Loaded) | PDF Output (Ghost) |
|-----------|------------------|-------------------|--------------------|
| Install Price | $20.00 | $15.00 | **$20.00** |

### The "Ghost 20" Root Cause:
1. `f2-config.js` holds a legacy $20 default.
2. `initial-state.js` initializes `installUnitPrice` as `null`.
3. `F2SummaryView` might show $15 (from a loaded quote), but `CalculationService` (triggered by F3 buttons) defaults to $20 because it perceives the `installUnitPrice` in the provided `ui` state as `null`/missing.

### Discrepancy Map:
- **UI $15**: Comes from `quoteData.f2Snapshot` or manual override.
- **PDF $20**: Happens because `WorkflowService` triggers a "headless" recalculation using the `CalculationService`, which prioritizes `f2-config.js` defaults over a `null` global state key.

---

✅ [代理三稽核報告] F2/F3 數據電路地毯式偵測完畢。完整報告已儲存於 _Architecture_Reports/F2_F3_Logic_Carpet_Bombing_Report.md。我們已鎖定 $20 幽靈數據的源頭與 F2 狀態不同步的斷點。
