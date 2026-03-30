# Code Bloat & Efficiency Report

**Project**: RBQ6297 — Quote Generation Pipeline
**Scope**: `04-core-code/` (all services, views, utils)
**Date**: 2026-03-28
**Status**: Read-Only Audit — No code modified.

---

## Section 1: Comment & Legacy Debt

### Top 5 Files by Comment/Legacy Debt Ratio

#### 🔴 #1 — `services/workflow-service.js` (492 lines, ~21 KB)
**Debt Type**: Tombstone comments (lines marking where removed code *used to be*) with no active code remaining at those sites.

**12+ consecutive tombstone blocks identified**, e.g.:
```javascript
// Line 58:  [REMOVED] handleGenerateExcel has been moved to QuotePersistenceService
// Line 196: [REMOVED] _getF3OverrideData is no longer needed.
// Line 199: [REMOVED] Methods handleRemoteDistribution and handleDualDistribution...
// Line 219: [REMOVED] All F2-related methods have been moved to F2SummaryView.
// Line 256-262: 4 consecutive [REMOVED] blocks for functions moved to quote-persistence-service
// Line 345-349: 2 [REMOVED] blocks for search logic moved to SearchDialogComponent
```
Tombstone comments consume ~15% of the file. They mark functions that were extracted in Phases v6297–v6299 but the comments remain as placeholders.

**Active dead-commented code (still present but deactivated)**:
```javascript
// Line 140: // this.eventAggregator.publish(EVENTS.SHOW_QUOTE_PREVIEW, finalHtml);
// Line 37:  // excelExportService // [REMOVED]
// Line 48:  // this.excelExportService = excelExportService; // [REMOVED]
// Lines 345-349: Commented-out async function bodies
```

#### 🔴 #2 — `ui/ui-manager.js` (~18 KB)
**Debt Type**: High density of `[REMOVED]` annotations, including blank-line tombstones.

Key pattern observed: Entire method stubs left in place with only a comment body:
```javascript
// Line 79:  // [REMOVED] Self-instantiation of RightPanelComponent is removed.
// Line 182: // [REMOVED] (v6297) Login handler logic is now in main.js
// Line 334: // [REMOVED] (Phase 3.5a) K2 rendering merged into K1TabComponent
```
File also retains K2/K5 tab references that were merged in Phase 3.5a and 3.5b. The `[REMOVED]` markers appear in 9+ distinct locations.

#### 🟠 #3 — `ui/views/f2-summary-view.js` (~31 KB)
**Debt Type**: Mix of commented-out DOM cache lines, inline version-log comments, and inline historical annotations on practically every method.

Notable accumulation:
```javascript
// Line 23:  // 'f2-b10-wifi-qty', // [REMOVED] (v6295)
// Line 94:  // c10_wifiSum: query('f2-c10-wifi-sum'), // [REMOVED] (v6295)
// Line 120: // [REMOVED] b23_sumprofit: query('f2-b23-sumprofit'),
// Line 434: // case 'f2-b10-wifi-qty': keyToUpdate = 'wifiQty'; break; // [REMOVED]
```
The file's top 5 lines are pure version-log comments (`[MODIFIED]` annotations). Every method body is annotated with 2–5 `[MODIFIED]` or `[FIX]` markers referencing specific version numbers (v6294, v6295, v6298-fix-5).

#### 🟠 #4 — `ui/search-dialog-component.js` (~12 KB)
**Debt Type**: Highest *density* of empty tombstone lines relative to file size. 11 `[REMOVED]` blocks appear in a 312-line file, including method stubs like:
```javascript
// Line 311: // --- [REMOVED] 階段 3：S2 的所有邏輯已移至 S2View ---
// Line 313: // --- [REMOVED] Tweak 1：_updateStatusBar 已不再需要 ---
```
These are empty comment sections with no code below them, essentially documenting the *absence* of code.

#### 🟡 #5 — `services/quote-generator-service.js` (382 lines, ~18 KB)
**Debt Type**: Active formatting code that conflicts with the newly-purified architecture. After the data purification refactor in `calculation-service.js`, this file **re-applies `$` string formatting** to the raw numbers returned from `getQuoteTemplateData()`:

```javascript
// Lines 186-190 — ACTIVE CODE, but now creates a double-formatting conflict:
templateData.ourOffer  = `$${offer.toFixed(2)}`;
templateData.gst       = `$${gst.toFixed(2)}`;
templateData.grandTotal = `$${total.toFixed(2)}`;
templateData.deposit   = `$${liveLedger.totalPaid.toFixed(2)}`;
templateData.balance   = `$${(total - liveLedger.totalPaid).toFixed(2)}`;
```
This block was written when `templateData` fields were already `$`-strings. After the purification, these fields are now raw numbers — but this live-ledger override block still formats them. This is the **highest-priority active code debt** identified.

---

## Section 2: Logic Redundancy

### 2a. Currency Formatting — 4 Independent Implementations

The same `(value) => $${value.toFixed(2)}` pattern is locally defined in **4 separate files**:

| File | Function Name | Line |
|---|---|---|
| `ui/views/f1-cost-view.js` | `const formatPrice = (price) => ...` | 265 |
| `ui/views/f2-summary-view.js` | `const formatDecimalCurrency = (value) => ...` | 246 |
| `services/generators/original-quote-strategy.js` | `_formatCurrency(value)` | 17 |
| `ui/tabs/k3-tab/k3-tab-component.js` | `formatCurrency(...)` | (found in search) |

Additionally, `search-tab-s2-view.js` uses an inline template literal `\`$\${f2.grandTotal.toFixed(2)}\`` (line 193) rather than any helper at all.

**Recommendation**: All currency formatting should use `original-quote-strategy._formatCurrency()` (for strategy layer) and a shared `utils/format-utils.js` helper for View layer use.

### 2b. Date Formatting — 3 Independent Implementations

`YYYY-MM-DD` date construction is manually implemented via `padStart('0')` in **4 files**:

| File | Lines |
|---|---|
| `ui/views/f3-quote-prep-view.js` | 89–95 (`_formatDateToYMD`) + inline duplicate lines 354–357 |
| `services/quote-generator-service.js` | 280–281 (`dd`/`mm` local vars) + `formatDateShort` at line 295 + `formatDateShortLocal` at line 331 |
| `services/file-service.js` | 43–46 (timestamp construction) |
| `services/excel-export-service.js` | 417–420 (identical 4-line block to file-service.js) |

**Most egregious**: `quote-generator-service.js` contains **two separately-scoped date formatters** (`formatDateShort` on line 295, `formatDateShortLocal` on line 331) doing the same DD/MM/YY formatting, defined within the same file.

**Recommendation**: Centralize into `utils/format-utils.js` as `formatDateYMD(date)` and `formatDateShort(dateStr)`.

### 2c. "Blob Open in New Tab" Pattern — 3 Duplicates

The same blob-URL-to-new-tab pattern is repeated verbatim in `workflow-service.js` across three methods:

```javascript
// handleGenerateWorkOrder(), handlePrintableQuoteRequest(), handleGmailQuoteRequest()
const blob = new Blob([finalHtml], { type: 'text/html' });
const url = URL.createObjectURL(blob);
window.open(url, '_blank');
```

**Recommendation**: Extract into a private `_openHtmlInNewTab(html)` helper within `WorkflowService`.

### 2d. "Get State + Guard Check" Pattern — Repeated in every handler

Every handler in `workflow-service.js` independently calls `this.stateService.getState()` at the top. There is no consistent pre-check or lazy caching. This is not a critical issue but contributes to boilerplate noise.

---

## Section 3: Architectural Overweight

### Files Exceeding 500 Lines

| File | Size | Est. Lines | Status |
|---|---|---|---|
| `ui/views/fabric-config-view.js` | 33 KB | ~750 | ⚠️ Heavyweight |
| `ui/views/f1-cost-view.js` | 32 KB | ~720 | ⚠️ Heavyweight |
| `ui/views/f2-summary-view.js` | 31 KB | ~700 | ⚠️ Heavyweight |
| `services/calculation-service.js` | 36 KB | ~742 | ⚠️ Heavyweight |
| `ui/views/f3-quote-prep-view.js` | 20 KB | ~455 | 🟡 Borderline |
| `services/quote-persistence-service.js` | 20 KB | ~450 | 🟡 Borderline |
| `services/quote-generator-service.js` | 18 KB | ~382 | ✅ Acceptable |

### Split Candidates

#### `fabric-config-view.js` (~750 lines)
This is the most structurally complex view. It currently handles:
1. K2 fabric selection logic (button click handlers, color dispatch)
2. K2 dialog (fabric name/color input modal)
3. "Super Set" (SSet) fabric set management
4. Focus navigation logic (Tab/Enter traversal, `document.getElementById` calls in loops)
5. Switch-based K3-mode rendering

**Recommended split**:
- `fabric-config-view.js` — Core K2 fabric selection only
- `fabric-dialog-handler.js` — K2 dialog (modal open/close/submit)
- `sset-manager.js` — Super Set logic

#### `calculation-service.js` (~742 lines)
Currently contains 4 conceptually distinct responsibilities:
1. **Item price calculation** (`calculateAndSum`) — strategy delegation
2. **F1 cost aggregation** (`calculateF1Costs`, `calculateF1ComponentPrice`) — cost domain
3. **F2 sales summary** (`calculateF2Summary`) — sales domain
4. **Document template assembly** (`getQuoteTemplateData`) — presentation bridging

**Recommended split**:
- `calculation-service.js` — `calculateAndSum` only (pure calculation)
- `f1-cost-service.js` — F1 cost aggregation
- `f2-summary-service.js` — F2 sales and margin calculations
- Move `getQuoteTemplateData` to `quote-generator-service.js` where it is exclusively consumed

#### `f1-cost-view.js` (~720 lines)
The view contains full dialog management logic for three separate modals (Remote, Dual, Motor). Each modal dialog (~80 lines) could be a standalone component.

---

## Section 4: Performance Bottlenecks

### 4a. Repeated `document.getElementById` in `fabric-config-view.js`

The most critical anti-pattern: `document.getElementById` is called **multiple times on the same dynamic IDs** within the same event handler scope:

```javascript
// fabric-config-view.js lines 457, 461 — called 3× for same IDs:
if (document.getElementById(fNameId).value && document.getElementById(fColorId).value) { ... }
return (document.getElementById(fNameId).value && document.getElementById(fColorId).value);
```

This is repeated across three nearly-identical K2-type dialog blocks (regular, SSet-type, dialog-sset). **The pattern occurs 6+ times** in the same method with the same IDs.

### 4b. `document.getElementById('location-input-box')` — 3× in `k1-location-view.js`

```javascript
// Lines 52, 76, 102 — same element looked up from scratch each call
const locationInput = document.getElementById('location-input-box');
```

The element is not cached in constructor. Every keystroke event re-queries the DOM.

### 4c. `document.getElementById` Inside Dialog Confirm Callbacks in `f1-cost-view.js`

```javascript
// Lines 448-449, 473-474, 525-526, 550-551, 603, 628-629
const qty1ch  = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_1CH).value, 10);
const qty16ch = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_16CH).value, 10);
// ... repeated again 4 lines later for "pre-fill" logic:
const input1ch  = document.getElementById(DOM_IDS.DIALOG_INPUT_1CH);
const input16ch = document.getElementById(DOM_IDS.DIALOG_INPUT_16CH);
```

Each dialog (Remote, Dual, Motor) reads the same DOM element twice — once to read value on confirm, once to set value on open.

### 4d. `quote-generator-service.js` — Format Override After Purification (Active Bug Risk)

As documented in Section 1 #5, lines 186–190 now re-apply `$` formatting to fields that `calculation-service.js` already returns as raw numbers. This does not cause a loop but **would cause double-`$` if the live-ledger path is not taken** — or could become data-type inconsistency if fields are used numerically downstream.

---

## Prioritized Slimming List (Top 3)

| Priority | File | Est. Effort | Impact |
|---|---|---|---|
| **1** | `services/quote-generator-service.js` (lines 186–190) | 🟢 30 min | **Active conflict** with new pure-number data contract; risks double-`$` regression |
| **2** | `services/workflow-service.js` | 🟡 2 hr | Remove ~15 tombstone blocks; extract `_openHtmlInNewTab` helper; net ~80 line reduction |
| **3** | `ui/views/fabric-config-view.js` | 🔴 Half-day | Eliminate 6+ duplicate DOM queries; split 750-line monolith into 3 focused files |

### Proposed `utils/format-utils.js` (Quick Win)
A new utility module should be created with the following exports to eliminate cross-file duplication:

```javascript
// utils/format-utils.js
export const formatCurrency = (value) => ...    // replaces 4 local implementations
export const formatDateYMD = (date) => ...       // replaces 3 local implementations
export const formatDateShort = (dateStr) => ...  // replaces 2 local implementations
export const formatTimestamp = (now) => ...      // replaces file-service + excel-export duplicate blocks
```
