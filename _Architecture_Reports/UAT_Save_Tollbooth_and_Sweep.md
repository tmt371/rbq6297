# Save-First Tollbooth & UAT Bug Sweep Audit

**Date**: 2026-03-12  
**Directive**: v3.14 — The "Save-First" Tollbooth & UAT Bug Sweep  
**Files Modified**: 
- `04-core-code/ui/views/f3-quote-prep-view.js`
- `04-core-code/services/quote-persistence-service.js`
- `04-core-code/services/quote-generator-service.js`

---

## 1. The Save-First Tollbooth (F3 UI Lock)
**File:** `f3-quote-prep-view.js`

To prevent the generation of financial documents on completely unsaved ("ghost") quotes, a new tollbooth function `_enforceSaveTollbooth()` was implemented.
This function checks `this.quoteData.quoteId`. If the ID does not exist, it publishes a `warning` notification and halts execution. 

This tollbooth was injected directly into the `click` event listeners for the GTH, Overdue, and Receipt buttons, as well as the central `_smartFinancialRoute()` dispatcher used by the Quote and Invoice buttons.

## 2. Eradication of Legacy Receipt Prompt
**File:** `f3-quote-prep-view.js`

The legacy method `_showReceiptModal()` contained an obsolete 2024-era HTML `prompt` dialog that intercepted the F3 Receipt button click. 
This was entirely stripped out. Clicking the Receipt button now cleanly routes the request:
`this._smartFinancialRoute('receipt');`
This ensures all F3 buttons follow the exact same modern routing pathway to the `WorkflowService`.

## 3. GST Mathematical Correction (Ledger Fallback)
**File:** `quote-persistence-service.js` 

When initializing the ledger via `handleRegisterPayment`, the system falls back to real-time UI values if `f2Snapshot.grandTotal` is missing. The old fallback logic forgot to include the 10% GST on top of the `newOffer`.
The logic was updated to strictly enforce accurate math:
`const currentGrandTotal = quoteData.f2Snapshot?.grandTotal || currentState.ui?.f2?.grandTotal || (currentState.ui?.f2?.newOffer ? currentState.ui.f2.newOffer * 1.1 : 0);` 

## 4. Restoration of PDF Date Labels
**File:** `quote-generator-service.js`

Directive v3.13 eradicated the DOM mutation that forced the balance to $0.00, but in doing so, it also stripped the dynamic Date labels.
The date label logic was surgically restored for Deposit types only, without mutating any specific numerical values from the ledger:
```javascript
// [DIRECTIVE-v3.14] Restore PDF Date Labels (Labels ONLY)
if (receiptData && receiptData.type) {
    if (receiptData.type === 'Deposit' && depLabel) {
        depLabel.innerText = 'Deposit Paid ' + formattedDate;
    }
}
```
