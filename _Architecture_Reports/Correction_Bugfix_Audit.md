# Correction Flow Payment Duplication Bugfix Audit

**Date**: 2026-03-12  
**Source File**: `04-core-code/services/quote-persistence-service.js`  
**Directive**: v3.4 — Scheme B (Single Source of Truth)

---

## 1. Bug Description

When an order such as `Q-001` was corrected and spawned a versioned successor `Q-001-A`, the old function `handleCorrectionSave()` was:

1. Deep-cloning the entire `quoteData` object (including `metadata.payments`).
2. Setting the new quote ID to the clone payload.
3. Writing `payments` from the cloned metadata directly into a **new** `accounting_ledgers` document keyed to the new version ID (`Q-001-A`).

This caused every payment transaction to be duplicated in the `accounting_ledgers` collection — once under `Q-001` and again under `Q-001-A` — creating phantom revenue and breaking reconciliation.

---

## 2. Root Cause (Exact Code — Before Fix)

```javascript
// OLD: handleCorrectionSave — Ledger Inheritance (Bug)
if (newData.metadata && Array.isArray(newData.metadata.payments) && newData.metadata.payments.length > 0) {
    const newLedgerRef = doc(db, 'accounting_ledgers', newQuoteId); // NEW version ID — wrong!
    batch.set(newLedgerRef, { payments: newData.metadata.payments }, { merge: true }); // Blind copy — duplicates all payments!
}
```

---

## 3. Changes Applied

### A. New Helper: `_getBaseLedgerId(quoteId)`

Resolves any versioned ID back to the original Base Quote ID (the Master Ledger key).

```javascript
_getBaseLedgerId(quoteId) {
    const parts = quoteId.split('-');
    if (parts.length > 1) {
        const last = parts[parts.length - 1];
        if (/^[A-Z]$/.test(last) || /^v\d+$/.test(last)) {
            return parts.slice(0, parts.length - 1).join('-');
        }
    }
    return quoteId;
}
// 'Q-2410-001-A' → 'Q-2410-001'
// 'Q-001'        → 'Q-001' (unchanged, is already base)
```

### B. Refactored: `handleCorrectionSave()`

| Concern | Before | After |
|---|---|---|
| New quote version suffix | `-v2`, `-v3` (numeric) | `-A`, `-B`, `-C` (alphabetic) |
| Payment array cloning | Copied into new quote metadata | **Deleted** from new quote payload before saving |
| Ledger write target | New version ID (creates duplicate doc) | Base ID only, using `{ merge: true }` |
| Ledger write content | Full `payments` array (duplication) | Only `latestQuoteId`, `totalAmount`, `status`, `lastUpdated` |

```javascript
// NEW: strip payments from the new quote's metadata
if (newData.metadata) {
    delete newData.metadata.payments;  // ← Payments live solely in accounting_ledgers
}

// NEW: Update the MASTER LEDGER using Base ID only
const masterLedgerRef = doc(db, 'accounting_ledgers', baseId); // 'Q-001', not 'Q-001-A'
batch.set(masterLedgerRef, {
    latestQuoteId: newQuoteId,
    totalAmount: grandTotal,
    status: QUOTE_STATUS.A_ARCHIVED,
    lastUpdated: new Date().toISOString()
}, { merge: true }); // merge: true preserves existing payments
```

### C. Refactored: `handleRegisterPayment()`

```javascript
// OLD: const ledgerRef = doc(db, "accounting_ledgers", quoteId); // Could be 'Q-001-A'
// NEW:
const baseLedgerId = this._getBaseLedgerId(quoteId);
const ledgerRef = doc(db, "accounting_ledgers", baseLedgerId); // Always 'Q-001'
```

---

## 4. Post-Fix State

- **`accounting_ledgers/{Q-001}`**: One authoritative document holding the payments array for the entire order lifecycle.
- **`quotes/{Q-001}`**: Flagged `X_CANCELLED`.
- **`quotes/{Q-001-A}`**: New corrected order document. No payments in metadata.
- `accounting_ledgers/{Q-001-A}` will no longer be created.
