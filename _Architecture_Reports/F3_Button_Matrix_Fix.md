# F3 Button Visibility Matrix Fix

**Date**: 2026-03-12  
**Directive**: v3.8 — F3 Financial Button Visibility Matrix  
**File Modified**: `04-core-code/ui/views/f3-quote-prep-view.js`

---

## 1. Target Mapping

| Cached Ref | DOM ID | `DOM_IDS` Constant |
|---|---|---|
| `this.f3.buttons.addQuote` | `btn-add-quote` | `BTN_ADD_QUOTE` |
| `this.f3.buttons.btnGth` | `btn-gth` | `BTN_GTH` |
| `this.f3.buttons.addInvoice` | `btn-add-invoice` | `BTN_ADD_INVOICE` |
| `this.f3.buttons.addReceipt` | `btn-add-receipt` | `BTN_ADD_RECEIPT` |
| `this.f3.buttons.addOverdue` | `btn-add-overdue` | `BTN_ADD_OVERDUE` |

**Lifecycle hook**: `render(state)` — called on every state change by `RightPanelComponent`. `_updateButtonStates(quoteData.status)` is appended as the final call.

---

## 2. FSM Button Matrix

| Status | Quote | GTH | Invoice | Receipt | Overdue |
|---|:---:|:---:|:---:|:---:|:---:|
| *No status (new unsaved)* | ✗ | ✗ | ✗ | ✗ | ✗ |
| A. Saved (Draft) | ✅ | ✅ | ✗ | ✗ | ✗ |
| B. Quoted | ✅ | ✅ | ✅ | ✗ | ✗ |
| C. Order Confirmed | ✗ | ✗ | ✅ | ✅ | ✗ |
| D–J (Deposit → Invoice) | ✗ | ✗ | ✅ | ✅ | ✗ |
| K. Overdue | ✗ | ✗ | ✗ | ✅ | ✅ |
| L. Closed (Paid) | ✗ | ✗ | ✗ | ✅ | ✗ |
| Y. On Hold / X. Cancelled | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## 3. Methods Added

### `_updateButtonStates(status)`
Evaluates status string using `.includes()` against the human-readable `QUOTE_STATUS` display values. Uses an ordered `if/else if` chain to determine which buttons should be enabled.

### `_applyButtonStates(quote, gth, invoice, receipt, overdue)`
Writes `.disabled` on each cached button ref. All assignments are inside `if (btn)` guards so a missing DOM node will not throw.

---

## 4. Verification

- Exemption from global CSS lock (`#f3-content` has `pointer-events: auto`) — ✅ (DIRECTIVE-v3.7 already applied)
- Button matrix fires on every state update via `render()` — ✅
- No JS interaction with `lockedStates` or `isCorrectionMode` — ✅ Matrix is purely FSM-driven
