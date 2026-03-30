# Payment Lifecycle & PDF Template Diagnostic

**Date**: 2026-03-12  
**Directive**: v3.12 — Payment Lifecycle & PDF Template Diagnostic (Read-Only)  

---

## 1. The Save/Payment Tollbooth (`f4-actions-view.js`)

**Question:** Is there any validation that blocks the user from opening the payment modal or submitting a payment if the quote has NEVER been saved to Firestore?

**Answer:** YES. The F4 UI contains a strict `isNewQuote` tollbooth that evaluates whether `quoteId` exists. If `isNewQuote` is true, all payment-related buttons and inputs are explicitly disabled via DOM manipulation.

*Proof from `f4-actions-view.js` (Lines 272-283):*
```javascript
const isNewQuote = !quoteData.quoteId;
const isControlsDisabled = isNewQuote || (isStatusReadOnly && !hasGodMode);
// ...
if (this.f4.btnOpenPaymentModal) {
    this.f4.btnOpenPaymentModal.disabled = isNewQuote;
}
if (this.f4.paymentAmount) this.f4.paymentAmount.disabled = isNewQuote;
if (this.f4.paymentDate) this.f4.paymentDate.disabled = isNewQuote;
if (this.f4.paymentMethod) this.f4.paymentMethod.disabled = isNewQuote;
if (this.f4.btnRegisterPayment) this.f4.btnRegisterPayment.disabled = isNewQuote;
```
*Conclusion*: It is impossible for a user to trigger `handleRegisterPayment` on a ghost quote (a quote that hasn't been saved at least once to get an ID).

---

## 2. Live Total Amount Fetching

**Question:** If `quoteData.f2Snapshot` is empty, what is the most reliable, synchronous method/function call to get the current live Grand Total directly from the application state or calculation engine?

**Answer:** `calculationService.calculateF2Summary(quoteData, uiState).grandTotal` or reading `uiState.f2.newOffer` directly from the `stateService`.

*Proof from `calculation-service.js` (Lines 405, 539, 547):*
The `CalculationService` provides a synchronous method `calculateF2Summary` that evaluates all UI parameters (subtotals, discounts, delivery fees) in real-time without relying on the snapshot. 
```javascript
// The exact mechanism:
const newOffer = (f2State.newOffer !== null && f2State.newOffer !== undefined) ? Number(f2State.newOffer) : sumPrice;
const grandTotal = newOffer + actual_gst; 
```

Furthermore, the Redux-like `stateService` actively maintains this live value:
```javascript
const currentState = this.stateService.getState();
const currentGrandTotal = currentState.ui.f2.newOffer || 0; // The simplest synchronous read
```

---

## 3. PDF Template String Mapping

**Question:** Find exactly where the text "balance paid" and the date are concatenated in the template. Why would the system output a string like `balance paid 12/3/26 $0`? 

**Answer:** The string is NOT in the HTML template file (`quote-template-final.html`). It is dynamically injected via a DOM Mutation script inside `quote-generator-service.js` AFTER the placeholders (`{{deposit}}`, `{{balance}}`) have been populated.

*Proof from `quote-generator-service.js` (Lines 295-300):*
When the user selects "Balance" as the payment type in the modal, the `receiptData.type === 'Balance'` block executes:

```javascript
} else if (receiptData.type === 'Balance') {
    // Scenario B: Balance
    if (depLabel) depLabel.innerText = 'Deposit Paid';
    // Deposit value remains unchanged

    if (balLabel) balLabel.innerText = `Balance Paid ${formattedDate}`;
    if (balVal) balVal.innerText = `$0.00`; // ⚠️ HARDCODED BUG
}
```

*The Root Cause of "balance paid 12/3/26 $0":*
1. **The Label**: The script manually queries the `balanceTr` and overrides the innerText of the `.summary-label` with `` `Balance Paid ${formattedDate}` ``.
2. **The Value**: The script **hardcodes** the `.summary-value` to `$0.00`. It assumes that if a user is paying the "Balance", the resulting balance mathematically *must* be $0. Therefore, the PDF renders `Balance Paid 12/3/26` in the left column, and `$0.00` in the right column.

*Conclusion*: The $0 is a hardcoded UI assumption for "Balance" receipts, not a calculation error from the `f2Snapshot`.
