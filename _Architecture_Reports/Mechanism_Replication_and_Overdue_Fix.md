# Mechanism Replication & Overdue Label Fix

**Date**: 2026-03-12  
**Directive**: v3.27 — Replicating Successful Toast Mechanism & Overdue Label Fix  

---

## ✅ Agent 1: Service-Layer Tollbooth Migration

**File**: `04-core-code/services/workflow-service.js`

Added the new `validateQuoteStateForAction(quoteData)` method:
```javascript
validateQuoteStateForAction(quoteData) {
    if (!quoteData || !quoteData.quoteId) {
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            type: 'warning',
            message: 'Please click SAVE first to generate a Quote ID before printing documents.'
        });
        return false;
    }
    return true;
}
```

This mirrors the **Save Success** pattern exactly — a service-owned `eventAggregator.publish` that fires from the JavaScript task queue, not entangled in a UI click event.

---

## ✅ Agent 2a: F3 View Rewiring

**File**: `04-core-code/ui/views/f3-quote-prep-view.js`

- `workflowService` injected into constructor.
- All 4 button listeners (`addQuote`, `btnGth`, `addOverdue`, `addReceipt`) now call `this.workflowService.validateQuoteStateForAction(quoteData)`.
- `_smartFinancialRoute` also delegates to the new service method.
- `_enforceSaveTollbooth()` **deleted** from the view.
- All `[TOAST INK]` and `[F3-REF]` debug logs **removed**.

**DI Chain Updated**:
- `AppContext` → `RightPanelComponent` → lazy-loaded `F3QuotePrepView` → `WorkflowService.validateQuoteStateForAction()`

---

## ✅ Agent 2b: Overdue Label Fix

**File**: `04-core-code/services/quote-generator-service.js`

Extended the deposit label mutation to cover the `'Balance'` receipt type (used by fully-paid invoices and overdue):
```javascript
if (receiptData.type === 'Deposit' && depLabel) {
    depLabel.innerText = 'Deposit Paid ' + formattedDate;
} else if (receiptData.type === 'Balance' && depLabel) {
    depLabel.innerText = 'Deposit Paid ' + formattedDate;
}
```

---

## ✅ Agent 3: Validation

| Check | Status |
|---|---|
| All debug logs removed | ✅ |
| `_enforceSaveTollbooth` removed from View | ✅ |
| `validateQuoteStateForAction` added to Service | ✅ |
| DI chain: AppContext → RightPanel → F3 → WorkflowService | ✅ |
| `workflowService` registered before `rightPanelComponent` | ✅ |
| Overdue/Balance deposit label now shows date | ✅ |

✅ [代理三稽核報告] 攔截警告機制已成功移植至服務層（比照儲存成功機制），Overdue 單據日期標籤已修正。請總架構師進行最終驗收。
