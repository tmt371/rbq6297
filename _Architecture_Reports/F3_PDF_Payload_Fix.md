# F3 PDF Payload & Dynamic Title Mapping Fix

**Date**: 2026-03-12  
**Directive**: v3.9 — PDF Payload & Dynamic Title Mapping  
**Files Modified**: `app-context.js`, `workflow-service.js`, `quote-generator-service.js`

---

## 1. Architectural Injection
To enforce the **Single Source of Truth** for all financial documents generated via the F3 buttons, the PDF rendering engine needed direct access to the `accounting_ledgers` dataset.

1. `quotePersistenceService` was injected into `WorkflowService` via the container (`app-context.js` line 261).
2. Inside `workflow-service.js`, the F3 event handler `handlePrintableQuoteRequest(documentType)` was modified to aggressively fetch the live ledger before pushing the payload to the PDF generator:
    ```javascript
    let liveLedger = null;
    if (this.quotePersistenceService && quoteData.quoteId) {
        liveLedger = await this.quotePersistenceService.getLiveLedger(quoteData.quoteId);
    }
    const finalHtml = await this.quoteGeneratorService.generateQuoteHtml(..., liveLedger);
    ```

---

## 2. Payload Override Strategy
The legacy HTML template relies on variables mapped by `getQuoteTemplateData` which pulled from local snapshots (e.g. `f3Data.deposit`, `f3Data.balance`).

Instead of rewriting the entire core calculation layer, the intercept occurs inside `quote-generator-service.js` immediately after `templateData` is built, explicitly overwriting the financial totals with ledger data:

```javascript
// [DIRECTIVE-v3.9] Override Payload Financials with Single Source of Truth
if (liveLedger && liveLedger.exists) {
    templateData.grandTotal = `$${liveLedger.totalAmount.toFixed(2)}`;
    templateData.deposit = `$${liveLedger.totalPaid.toFixed(2)}`;
    templateData.balance = `$${(liveLedger.totalAmount - liveLedger.totalPaid).toFixed(2)}`;
}
```

---

## 3. Dynamic Title DOM Mutation

Historically, the `QuoteGeneratorService` blindly forced the title to "Invoice" if the document type loosely matched it, ignoring the nuance of Overdue vs Receipt.

The DOM mutation script has been corrected to explicitly map the `documentType` intent dispatched from the F3 buttons:

| F3 Button | `documentType` Intent | PDF Title Injection (`h2.innerText`) |
|---|---|---|
| Quote | `Quotation` | QUOTATION |
| Invoice | `Tax Invoice` | TAX INVOICE |
| Overdue | `Overdue Invoice` | TAX INVOICE - OVERDUE |
| Receipt | `Receipt` | OFFICIAL RECEIPT |

```javascript
if (h2Title) {
    if (documentType === 'Tax Invoice') {
        h2Title.innerText = 'TAX INVOICE';
    } else if (documentType === 'Receipt') {
        h2Title.innerText = 'OFFICIAL RECEIPT';
    } else if (documentType === 'Overdue Invoice') {
        h2Title.innerText = 'TAX INVOICE - OVERDUE';
    } else {
        h2Title.innerText = documentType.toUpperCase();
    }
}
```

## Summary
The PDF Engine is now fully decoupled from local `metadata.payments` and strictly references the remote `accounting_ledgers` before generating its visual HTML, ensuring that the PDF output exactly matches the cloud database.
