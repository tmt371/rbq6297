# PDF Data Corruption Audit

**Date**: 2026-03-12  
**Directive**: v3.28 — Error Cleanup & Data Payload Sniffing  

---

## ✅ Agent 1: Crash Fix

**File**: `04-core-code/ui/views/f3-quote-prep-view.js` (line 531)

The `activate()` method contained a legacy `btn.onclick` block from Directive v3.18 that directly called the now-deleted `_enforceSaveTollbooth()`.

**Fix Applied**:
```javascript
// OLD (crashing):
if (!this._enforceSaveTollbooth()) return;

// NEW (service-layer):
const { quoteData } = this.stateService.getState();
if (!this.workflowService.validateQuoteStateForAction(quoteData)) return;
```

---

## ✅ Agent 2: PDF Payload Sniffer Deployed

**File**: `04-core-code/services/quote-generator-service.js` in `generateQuoteHtml()`

The following logs fire before any template rendering:
```
🕵️ [PDF-SNIFFER] quoteData             → Full quote state
🕵️ [PDF-SNIFFER] ui.f2 state           → newOffer, deposit, balance, grandTotal
🕵️ [PDF-SNIFFER] documentType          → e.g. "Tax Invoice"
🕵️ [PDF-SNIFFER] liveLedger            → totalAmount, totalPaid, balanceDue from Firestore
```

---

## ✅ Agent 3: $110 Root Cause Analysis

**Identified Suspects** from reading `getQuoteTemplateData`:

### Path 1: `ui.f2.newOffer` (Line 618)
```javascript
const newOfferValue = (ui.f2.newOffer !== null && ui.f2.newOffer !== undefined)
    ? ui.f2.newOffer
    : summaryData.sumPrice;
```
If `ui.f2.newOffer` is stale (holding an old value like `$100`) from a previous session, the PDF will show `$100` even if the ledger knows the real total is `$55`.

### Path 2: `liveLedger` Override (Lines 177-181 of quote-generator-service.js)
```javascript
if (liveLedger && liveLedger.exists) {
    templateData.grandTotal = `$${liveLedger.totalAmount.toFixed(2)}`;
    templateData.deposit = `$${liveLedger.totalPaid.toFixed(2)}`;
    templateData.balance = `$${(liveLedger.totalAmount - liveLedger.totalPaid).toFixed(2)}`;
}
```
The override only patches `grandTotal`, `deposit`, and `balance` — but **NOT** `ourOffer` or `gst`. So if `liveLedger.totalAmount = $55` but `templateData.ourOffer = $100`, the PDF will display mismatched values.

### Verdict
The `[PDF-SNIFFER]` log will reveal:
1. Is `ui.f2.newOffer` equal to `$100` or `$55`?
2. Is `liveLedger.totalAmount` equal to `$55` (correct)?
3. Is the Ledger override firing (i.e., `liveLedger.exists === true`)?

✅ [代理三稽核報告] 程式崩潰紅錯已修復，數據嗅探器已佈署。請總架構師重整後再次產單，並提供 [PDF-SNIFFER] 的完整輸出，我們要抓出 $110 是從哪冒出來的。
