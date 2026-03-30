# F4 Pipeline Rebuild & Ledger Initialization Audit

**Date**: 2026-03-12  
**Directive**: v3.11 — Scheme B Pipeline Rebuild & Ledger Initialization  
**File Modified**: `04-core-code/services/quote-persistence-service.js`

---

## 1. Problem Statement
**Issue 1: The "Not-Found" Crash**  
When an order was confirmed and a payment registered, the system attempted to simultaneously write to `accounting_ledgers` AND update the `metadata.payments` array on the `quotes` collection. This dual-write was a legacy artifact. If the active quote was a corrected version (`Q-001-A`) that hadn't been explicitly saved to the database yet, the `updateDoc` call to `quotes/Q-001-A` threw a fatal `not-found` exception.

**Issue 2: The $0 Receipt Total**  
The PDF engine (as of v3.9) calculates Receipts by reading `liveLedger.totalAmount` minus `totalPaid`. However, the ledger's `totalAmount` was never explicitly initialized when a payment was registered, leaving it as `undefined` or `0`, causing Receipts to display $0 as the Grand Total.

---

## 2. Structural Surgery (Scheme B)

The `handleRegisterPayment` method was rebuilt to enforce a strict **Single Source of Truth**.

### A. Ledger Initialization Injector
The payload now explicitly grabs the `f2Snapshot.grandTotal` from the active application state (ensuring it's the exact price the user sees) and commits it to the base ledger ID alongside the payment history.

```javascript
const currentState = this.stateService.getState();
const { quoteData } = currentState;
const currentGrandTotal = quoteData.f2Snapshot?.grandTotal || 0; 

// 🎯 INITIALIZE BASE PRICE & APPEND HISTORY
const ledgerPayload = {
    latestQuoteId: quoteData.quoteId, 
    totalAmount: currentGrandTotal,   // Forces the ledger to know the final price
    status: quoteData.status,
    lastUpdated: new Date().toISOString(),
    payments: arrayUnion(paymentRecord) 
};

await setDoc(ledgerRef, ledgerPayload, { merge: true });
```

### B. Severing the Dual-Write
The obsolete query that attempted to write payment metadata to the `quotes` database has been **permanently deleted**.
```javascript
// [REMOVED]
// const quoteRef = doc(db, "quotes", quoteId);
// await updateDoc(quoteRef, { "metadata.payments": arrayUnion(paymentRecord) });
```

---

## 3. Impact Analysis
1. **No More Crashes**: Registering a deposit on an unsaved corrected quote will now succeed smoothly, as the system only mathematically creates/updates the `accounting_ledgers/{baseId}` document using `setDoc(..., { merge: true })`.
2. **Mathematically Sound Ledger**: The ledger now accurately knows both the `totalAmount` and the `payments` array, allowing the F3 PDF Engine to generate perfect Invoices and Receipts dynamically without polling the `quotes` database.
3. **UI Reactivity Maintained**: The local Redux-style `stateService` is still updated immediately, so the F4 UI instantly reflects the new payment without needing to refresh the browser.
