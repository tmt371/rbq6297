# PDF Data Flow & Architectural Diagnostic Report

This report summarizes the findings of the "PDF Data Leak & Header Mismatch Audit" conducted on 2026-03-29.

## 1. THE HEADER GATEKEEPER: Mismatched Intent
The persistence of the "RECEIPT" header even when "Add Invoice" is clicked is triggered by the **Smart Routing** interceptor in the UI layer.

- **Trigger Source**: `f3-quote-prep-view.js` (Lines 304–314).
- **Failure Logic**: The method `_smartFinancialRoute(intent)` performs a ledger check. If any payment (`totalPaid > 0`) is detected, it overrides the user's intent:
  - **User Click**: "Add Invoice" (intent='invoice').
  - **System Logic**: `if (totalPaid > 0) { publish(EVENTS.USER_REQUESTED_PRINTABLE_RECEIPT) }`.
- **Service Layer Impact**: `quote-generator-service.js` (Line 160) receives "Receipt" as the `documentType`.
- **Result**: The header correctly follows the event it is given, which is currently being forced to "Receipt" by the UI controller.

## 2. NUMERIC LEAK DETECTION: The 'OF' Field Float
The 'Our Offer' (OF) field is leaking raw binary float values (e.g., `189.19999999999996`) due to a bypass of the Phase I.1 DOM-mutation layer.

- **Variable name causing leak**: `templateData.ourOffer` (derived from `newOfferValue` in `calculation-service.js`).
- **Technical Cause**:
  1. `calculation-service.js` (Line 690) returns `newOfferValue` as a raw float.
  2. The PDF template (HTML) contains the specific placeholder `{{ourOffer}}`.
  3. `quote-generator-service.js` (Line 211) uses `populateTemplate`, which replaces placeholders with raw numbers **before** the DOM Parser executes.
  4. The DOM Parser mutation (Line 295) targets row labels like "Subtotal", "GST", "Total", or "Balance". If the row label in the template is "Our Offer", it fails to match either label or value for re-formatting.
- **Result**: The browser renders the raw binary string instead of a 2-decimal formatted currency.

## 3. PAYMENT DATA STRUCTURE AUDIT
The `payments` array is extracted in `calculation-service.js` (Line 593/604) and passed to the template.

- **Sample Data Object**:
  ```json
  [
    { "amount": 1250, "date": "2026-03-28" },
    { "amount": 500,  "date": "2026-03-29" }
  ]
  ```
- **Sync Status**: Confirming that amounts are raw numbers. Dates are stored as `YYYY-MM-DD` strings. No pre-formatting (e.g., `$1,250.00`) is applied in the calculation service.

## 4. NOTE INJECTION FEASIBILITY
- **Rendering Logic**: Current notes are rendered via `generalNotes` in `calculation-service.js` (Line 694).
- **Insertion Point**: Prepending to the `generalNotes` string block before the final return in `getQuoteTemplateData`.
- **Proposed Logic**: 
  ```javascript
  const paymentHistoryHeader = "PAYMENT HISTORY:\n" + payments.map(p => `• Paid ${p.date}: $${p.amount.toFixed(2)}`).join('\n');
  return {
    ...
    generalNotes: (paymentHistoryHeader + '\n\n' + (liveQuoteData.generalNotes || '')).replace(/\n/g, '<br>')
  };
  ```

---
**任務完成**
