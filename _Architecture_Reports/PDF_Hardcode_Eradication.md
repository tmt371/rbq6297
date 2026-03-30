# PDF Hardcode Eradication Audit

**Date**: 2026-03-12  
**Directive**: v3.13 — Eradicate PDF Hardcoding & Secure Ledger Total  
**Files Modified**: 
- `04-core-code/services/quote-generator-service.js`
- `04-core-code/services/quote-persistence-service.js`

---

## 1. Eradication of PDF Hardcoding (Target 1)
**File:** `04-core-code/services/quote-generator-service.js`

The diagnostic probe discovered that the PDF engine was forcefully mutating the DOM to set the balance label to `Balance Paid {Date}` and the amount specifically to `$0.00` whenever a "Balance" payment was issued. This bypassed the live ledger completely.

### Surgical Deletion
The entire innerText mutation block for `receiptData.type === 'Deposit'` and `receiptData.type === 'Balance'` was deleted.

**Code Removed**:
```javascript
if (receiptData.type === 'Deposit') {
    // Scenario A: Deposit
    if (depLabel) depLabel.innerText = `Deposit Paid ${formattedDate}`;
    if (depVal) depVal.innerText = `$${receiptData.amount.toFixed(2)}`;

    // Recalculate Balance
    const gTotal = templateData.summaryData ? (templateData.summaryData.grandTotal || 0) : 0;
    const newBalance = gTotal - receiptData.amount;
    if (balLabel) balLabel.innerText = 'Balance'; // Keep it clean
    if (balVal) balVal.innerText = `$${newBalance.toFixed(2)}`;
} else if (receiptData.type === 'Balance') {
    // Scenario B: Balance
    if (depLabel) depLabel.innerText = 'Deposit Paid';
    // Deposit value remains unchanged

    if (balLabel) balLabel.innerText = `Balance Paid ${formattedDate}`;
    if (balVal) balVal.innerText = `$${receiptData.amount.toFixed(2)}`; // ⚠️ The $0.00 Culprit
}
```

The PDF will now rely exclusively on `templateData.deposit` and `templateData.balance` seamlessly mapped from `liveLedger` in earlier directives.

---

## 2. Securing Ledger Initialization Fallback (Target 2)
**File:** `04-core-code/services/quote-persistence-service.js`

To prevent the ledger from initializing a $0 Grand Total when a quote hasn't been saved yet (which resulted in an empty `f2Snapshot`), we implemented a synchronous fallback direct to the UI calculation state.

### Code Alteration
**From**:
```javascript
const currentGrandTotal = quoteData.f2Snapshot?.grandTotal || 0; 
```

**To**:
```javascript
// [DIRECTIVE-v3.13] Secure Ledger Initialization
const currentGrandTotal = quoteData.f2Snapshot?.grandTotal || currentState.ui?.f2?.newOffer || 0; 
```

By falling back to `currentState.ui?.f2?.newOffer`, the F4 panel is guaranteed to extract the exact real-time price the user is currently looking at in the UI before committing it to the base ledger ID.
