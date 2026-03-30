# F3 Smart Financial Buttons — Live Ledger Integration

**Date**: 2026-03-12  
**Directive**: v3.5 — Scheme B Live Read  
**Files Modified**:
- `04-core-code/services/quote-persistence-service.js`
- `04-core-code/ui/views/f3-quote-prep-view.js`
- `04-core-code/ui/right-panel-component.js`
- `04-core-code/app-context.js`

---

## 1. New `getLiveLedger(quoteId)` Method

Added to `QuotePersistenceService`. Resolves the passed `quoteId` to its Base Ledger ID via `_getBaseLedgerId()`, fetches `accounting_ledgers/{baseLedgerId}` from Firestore, sums all `payments[].amount`, and returns a structured ledger object.

**Return shape**:
```js
{
  exists: true,
  totalAmount: 2200,
  payments: [...],
  totalPaid: 500,
  balanceDue: 1700
}
```

Fails gracefully — if Firestore is unavailable, returns all-zero values and logs a warning.

---

## 2. `_smartFinancialRoute(intent)` in `F3QuotePrepView`

Replaces the static event publishers for the Quote and Invoice buttons. Logic:

| Condition | Document Rendered |
|---|---|
| `intent === 'quote'` OR no quoteId | **Quotation** (`USER_REQUESTED_PRINTABLE_QUOTE`) |
| No ledger or `totalPaid === 0` | **Tax Invoice** (`USER_REQUESTED_PRINTABLE_INVOICE`) |
| `totalPaid > 0` && `balanceDue > 0` | **Tax Invoice w/ Balance Due** (via `USER_REQUESTED_PRINTABLE_RECEIPT` with `type: 'Deposit'`) |
| `balanceDue <= 0` (fully paid) | **Official Receipt** (via `USER_REQUESTED_PRINTABLE_RECEIPT` with `type: 'Balance'`) |

> **Note**: F3 no longer reads `f2Snapshot.deposit` or `metadata.payments` for financial document routing. All financial data comes exclusively from the live Firestore `accounting_ledgers` fetch.

---

## 3. Dependency Injection Chain

```
app-context.js: new RightPanelComponent({ ..., quotePersistenceService })
  → right-panel-component.js: new F3QuotePrepView({ ..., quotePersistenceService })
    → f3-quote-prep-view.js: this.quotePersistenceService.getLiveLedger(quoteId)
```
