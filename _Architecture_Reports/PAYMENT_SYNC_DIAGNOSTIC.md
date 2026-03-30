# Payment Sync Flow Diagnostic Report

## 1. UI Trigger (Payment Registration)
The payment registration modal does not live in `f3-quote-prep-view.js`—it is housed in **`f4-actions-view.js`**. 
When the sales rep registers a payment, they trigger the `'f4-btn-register-payment'` button. This method:
1. Gathers the amount, date, and payment method from the DOM inputs. 
2. Publishes the `EVENTS.USER_REQUESTED_REGISTER_PAYMENT` payload across the Event Aggregator to the service layer.

## 2. Service Sync (Persistence Mechanism)
The event published by F4 is caught and handled by `handleRegisterPayment()` inside **`quote-persistence-service.js`**.
* **Immediate Cloud Persistence**: Yes, the system immediately persists the new payment. It calculates the `baseLedgerId` and uses a direct, top-level Firebase `setDoc(ledgerRef, ledgerPayload, { merge: true })` call. It intentionally *bypasses* the generic `online-storage-service.js` string-saving methods to strictly target the `accounting_ledgers` collection.
* **Local State Hydration**: After successfully awaiting the Firestore `setDoc`, the service updates the local Redux state via `quoteActions.updateQuoteProperty('metadata'...)` to immediately reactify the UI without needing a full page reload.

## 3. Data Refresh (PDF Generation)
When a user clicks **ADD INVOICE / RECEIPT** on the F3 tab:
1. It triggers `_smartFinancialRoute('receipt')` or `('invoice')`.
2. F3 actively blocks PDF generation and forces a fresh query: `await this.quotePersistenceService.getLiveLedger(quoteId)`.
3. The persistence service natively calls `getDoc()` on the Firestore `accounting_ledgers`. 
4. The resolved Live Ledger (which accumulates all partial deposits securely) dictates whether F3 fires a `USER_REQUESTED_PRINTABLE_INVOICE` or `USER_REQUESTED_PRINTABLE_RECEIPT` event, injecting the absolute latest validated totals directly into the PDF rendering pipeline. 

任務完成
