# FINAL AUDIT BEFORE REFIX: Data Binding Failure & Logic Deviation Report

This report analyzes the specific code paths where the previous implementation deviated from the "UI-Truth" principle and caused persistent PDF generation bugs.

## 1. THE "F2 BINDING" DISCONNECT (The Float Leak)

- **Identify why `getQuoteTemplateData` is still returning raw float results:**
  The implementation in `calculation-service.js` continued to export raw numerical values (e.g., `newOfferValue = grandTotal / 1.1` or `Number(ui.f2.newOffer)`) instead of fetching the pre-formatted string.

- **Exact code line of injection:**
  The raw float (e.g., `179.9999...`) is injected in `quote-generator-service.js` at **Line 211**:
  `finalHtml = populateTemplate(finalHtml, populatedDataWithHtml);`
  The string replacement algorithm replaces the HTML placeholder `{{ourOffer}}` with the exact raw number passed from `templateData.ourOffer` *before* the DOM Parser even executes.

- **Why the DOM parser missed it:**
  In `quote-generator-service.js` (Lines 294-304), the code checks `includes('Subtotal')`, `includes('GST')`, `includes('Total')`, and `includes('Balance')`. It **does not check for "Our Offer"**. Since the label is skipped, the raw float persists.

## 2. THE "NOTE INJECTION" BLOCKER

- **Why Payment History wasn't moved to Notes:**
  The Phase I.1 instruction was misinterpreted as updating the existing table design to hold multiple payments, rather than removing the complexity from the table and moving it entirely to the Notes field.

- **Logic forcing separate rows:**
  In `quote-generator-service.js` (Lines 314-332), there is an explicit loop actively modifying the HTML table:
  ```javascript
  if (templateData.payments && templateData.payments.length > 0) {
      templateData.payments.forEach(pay => {
          const newRow = doc.createElement('tr');
          // ... injects into table ...
      });
  }
  ```

## 3. THE "SMART ROUTE" CULPRIT (Intent Override)

- **Location of the Override:**
  In `f3-quote-prep-view.js` (Lines 304-314), the `_smartFinancialRoute(intent)` method acts as an unauthorized gatekeeper.

- **Why it ignores button IDs:**
  The view's event listeners (e.g., `btn-add-invoice`) currently call `this._smartFinancialRoute('invoice')`. However, inside this method, the intent parameter is largely ignored in favor of the ledger state:
  If `totalPaid > 0`, it overrides the user's intent:
  `this.eventAggregator.publish(EVENTS.USER_REQUESTED_PRINTABLE_RECEIPT...`
  This forces a "Receipt" event even if the user explicitly clicked "Invoice."

## 4. THE "DEPOSIT" ROW PERSISTENCE (Logic Error)

- **The Issue for QUO:**
  In Quotations ('QUO' / 'Quotation'), there are no "Payments" yet. However, the legacy placeholder was "Deposit Paid." When building a quote, the UI must show the "Deposit" (the required *future* deposit, calculated by F2). Removing the row randomly left only "Balance Due," which is illogical for a quote.

- **Proposed Fix (Universal Structure):**
  Instead of a complex DOM loop, rely on a single, dynamically labeled row.
  Use a single `uiDeposit` formatted string from `calculation-service.js`, and map the label dynamically in the generator:
  - **If `documentType` matches 'QUOTATION'**: Label = `"Deposit"` (Required Future Deposit).
  - **Otherwise (Invoice/Receipt/Statement)**: Label = `"Deposit Paid"` (Actual Paid Amount).

---
任務完成
