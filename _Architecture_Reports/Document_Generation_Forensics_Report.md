# Document Generation Forensics Report

**Date**: 2026-03-12  
**Directive**: v3.31 — Document Generation Forensics & Audit (Deep Study)  
**Status**: READ-ONLY. No functional code was changed.

---

## Phase 1: Event-to-Service Mapping (Full Flowchart)

### The Complete Data Path

```
[User clicks F3 Button]
        │
        ▼
[F3QuotePrepView listener]
 → Calls workflowService.validateQuoteStateForAction(quoteData)
 → If blocked: publish EVENTS.SHOW_NOTIFICATION (warning) → STOP
 → If valid: calls _smartFinancialRoute(intent) OR publishes direct event
        │
        ▼
[_smartFinancialRoute(intent)] ← for 'quote', 'invoice', 'receipt'
 → Fetches liveLedger from quotePersistenceService.getLiveLedger(quoteId)
 → Routes based on ledger state:
   • intent='quote' OR no quoteId → EVENTS.USER_REQUESTED_PRINTABLE_QUOTE
   • no ledger / $0 paid           → EVENTS.USER_REQUESTED_PRINTABLE_INVOICE  
   • partial payment               → EVENTS.USER_REQUESTED_PRINTABLE_RECEIPT {type:'Deposit'}
   • fully paid                    → EVENTS.USER_REQUESTED_PRINTABLE_RECEIPT {type:'Balance'}
 •  addOverdue button              → EVENTS.USER_REQUESTED_PRINTABLE_OVERDUE (direct, bypasses _smartFinancialRoute)
        │
        ▼
[EventAggregator.publish()]
        │
        ▼
[AppController._subscribeF3Events()] ← routing table:
 • USER_REQUESTED_PRINTABLE_QUOTE   → workflowService.handlePrintableQuoteRequest('Quotation')
 • USER_REQUESTED_PRINTABLE_INVOICE → workflowService.handlePrintableQuoteRequest('Tax Invoice')
 • USER_REQUESTED_PRINTABLE_RECEIPT → workflowService.handlePrintableQuoteRequest('Receipt', receiptData)
 • USER_REQUESTED_PRINTABLE_OVERDUE → workflowService.handlePrintableQuoteRequest('Overdue Invoice')
 • USER_REQUESTED_GMAIL_QUOTE       → workflowService.handleGmailQuoteRequest()
        │
        ▼
[WorkflowService.handlePrintableQuoteRequest(documentType, receiptData)]
 → Gets { quoteData, ui } from stateService.getState()   ← ⚠️ READS STALE ui.f2 HERE
 → Fetches liveLedger = quotePersistenceService.getLiveLedger(quoteId)
 → Calls quoteGeneratorService.generateQuoteHtml(quoteData, ui, quoteData, documentType, receiptData, liveLedger)
        │
        ▼
[QuoteGeneratorService.generateQuoteHtml()]
 → Step A: calculationService.getQuoteTemplateData(quoteData, ui, ...) ← BUILDS FROM ui.f2
 → Step B: if (liveLedger && liveLedger.exists): OVERRIDE 5 fields    ← MAY NOT FIRE
 → Renders HTML template with templateData
```

> **No intermediate step modifies `quoteData`** — it flows unchanged from state through to the generator.

---

## Phase 2: Data Source Autopsy

### Source of Truth for Each Financial Field

| Field | Where it's set in `getQuoteTemplateData` | Value Source |
|---|---|---|
| `subtotal` | `summaryData.sumPrice` | F2 calculation from products |
| `ourOffer` | `ui.f2.newOffer` (if set) OR `summaryData.sumPrice` | **Stale F2 UI state** |
| `gst` | `summaryData.new_gst` | F2 calculation |
| `grandTotal` | `summaryData.grandTotal` (newOffer + actual GST) | F2 calculation |
| `deposit` | `ui.f2.deposit` | **Stale F2 UI state** |
| `balance` | `ui.f2.balance` | **Stale F2 UI state** |

### The liveLedger Override (After v3.29)

```javascript
if (liveLedger && liveLedger.exists) {
    const total = liveLedger.totalAmount;
    const gst   = total / 11;
    const offer = total - gst;
    templateData.ourOffer   = `$${offer.toFixed(2)}`;   // ✅ NOW OVERRIDDEN
    templateData.gst        = `$${gst.toFixed(2)}`;     // ✅ NOW OVERRIDDEN
    templateData.grandTotal = `$${total.toFixed(2)}`;   // ✅ NOW OVERRIDDEN
    templateData.deposit    = `$${liveLedger.totalPaid.toFixed(2)}`;
    templateData.balance    = `$${(total - liveLedger.totalPaid).toFixed(2)}`;
}
```

### The $110 / $55 Root Cause Explained

The discrepancy originates from **two competing sources of truth** for financial data:

| Source | Value | Where used |
|---|---|---|
| `ui.f2.newOffer` (stale state) | `$100` (old session) | `ourOffer`, `gst`, `grandTotal` BEFORE override |
| `liveLedger.totalAmount` (Firestore) | `$55` (actual) | `grandTotal`, `deposit`, `balance` AFTER override |

**The exact code fork (before v3.29)**:
- `getQuoteTemplateData()` runs first → sets `ourOffer = $100`, `gst = $10`, `grandTotal = $110`
- The liveLedger block then **only patches `grandTotal`, `deposit`, `balance`**
- Result: `ourOffer` remains `$100`, `gst` remains `$10`, but `grandTotal` becomes `$55`
- This creates an **internally inconsistent document** where the top rows ($100 + $10 = $110) don't add up to the bottom row ($55)

**Why „Quotation" documents were unaffected**: `_smartFinancialRoute('quote')` returns early before fetching the ledger — it publishes `USER_REQUESTED_PRINTABLE_QUOTE` directly without a liveLedger. So `getQuoteTemplateData` values are the only source, and they are at least internally consistent.

### When Does the liveLedger Override Fire?

The override fires **only if**:
1. `liveLedger !== null` — i.e., `handlePrintableQuoteRequest` succeeded in fetching from Firestore
2. `liveLedger.exists === true` — i.e., a ledger document was found for this `quoteId`

For Quotation documents, `liveLedger` is passed as `null` from WorkflowService since no ledger is fetched. For Invoice/Receipt/Overdue, it fetches the ledger and passes it — which is where the override runs.

---

## Phase 3: Forensics Synthesis — Comparison Table

### Per-Document Data Source Comparison (After v3.29)

| Document | liveLedger Fetched? | Override Fires? | `ourOffer` Source | `grandTotal` Source | `deposit` Source |
|---|---|---|---|---|---|
| **QUO (Quotation)** | ❌ No — bypasses route | ❌ No | `ui.f2.newOffer` (stale) | `ui.f2` calculation | `ui.f2.deposit` |
| **INV (Tax Invoice)** | ✅ Yes | ✅ If exists | `liveLedger` derived | `liveLedger.totalAmount` | `liveLedger.totalPaid` |
| **REC (Receipt)** | ✅ Yes (via `_smartFinancialRoute`) | ✅ If exists | `liveLedger` derived | `liveLedger.totalAmount` | `liveLedger.totalPaid` |
| **OVR (Overdue Invoice)** | ✅ Yes | ✅ If exists | `liveLedger` derived | `liveLedger.totalAmount` | `liveLedger.totalPaid` |

### Residual Risk After v3.29

- For **Quotation (QUO)**: `ui.f2.newOffer` may still be stale — but this is intentional, as QUO is a pre-save draft that shouldn't reference a ledger.
- For **Invoice/Receipt/Overdue**: The v3.29 fix correctly synchronizes all 5 fields from `liveLedger`. The only remaining risk is if `liveLedger.exists === false` (e.g., the ledger hasn't been bootstrapped), in which case all 5 fields fall back to stale `ui.f2` values.

✅ [代理三稽核報告] F3 單據生成全路徑溯源完畢。完整「架構偵查報告」已儲存於 _Architecture_Reports/Document_Generation_Forensics_Report.md，內含 $110 數據異常的根源分析。
