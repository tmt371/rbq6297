# Core Structural Audit Report
**Scope**: `calculation-service.js`, `config-manager.js`, `original-quote-strategy.js`, `initial-state.js`
**Date**: 2026-03-28
**Status**: Read-Only Audit — No code was modified.

---

## 1. Ghost Price Detection

### Root Cause Analysis: $100 Phantom Delivery Fee

The "$100 delivery fee" ghost price is traceable through a **three-layer fallback chain** that ultimately resolves to a hardcoded constant before Firestore data is loaded.

#### Fallback Chain (Ordered by Priority)

| Priority | Source | Value | Location |
|---|---|---|---|
| 1st | `domValues.deliveryUnitPrice` (DOM input) | User-typed value | `calculation-service.js:459` |
| 2nd | `f2State.deliveryUnitPrice` (Redux state) | Persisted user value | `calculation-service.js:459` |
| 3rd | `UNIT_PRICES.delivery` (f2Config static) | **$100** | `f2-config.js:9` |
| 4th | Hardcoded `|| 0` guard | $0 | `calculation-service.js:459` |

#### The Offending Lines

**`calculation-service.js`, Line 392–393:**
```javascript
const f2Config = this.configManager.getF2Config();
const UNIT_PRICES = f2Config.unitPrices || {};
```

**`calculation-service.js`, Line 459:**
```javascript
const rawDeliveryUnitPrice = getValFromArgsOrDefault(
    domValues?.deliveryUnitPrice,
    Number(f2State.deliveryUnitPrice ?? UNIT_PRICES.delivery ?? 0) || 0
);
```

**`f2-config.js`, Lines 7–12:**
```javascript
export const f2Config = {
    unitPrices: {
        wifi: 200,
        delivery: 100,  // ← THE GHOST PRICE SOURCE
        install: 0,
        removal: 0,
    }
};
```

#### Why $100 Appears

When a new quote is loaded and:
- The DOM input has not been typed in yet (`domValues.deliveryUnitPrice` is `undefined`)
- The Redux state `f2State.deliveryUnitPrice` is `null` (initial state value)

...the fallback resolves to `UNIT_PRICES.delivery`, which is **hardcoded as `100`** in `f2-config.js`. This file is a **static module import**, meaning it always loads even when Firestore has the actual fee values stored under `data.fees`.

The `ConfigManager.getFees()` method (line 92–94 of `config-manager.js`) returns the Firestore/JSON-loaded `fees` object, but **`getF2Config()` returns the static module** — the two systems are not connected. The correct Firestore fee value is completely bypassed.

#### Other Hardcoded Fallbacks Found

| Line | Value | Context |
|---|---|---|
| `calculation-service.js:436` | `|| 50` | `pCharger` fallback when `price-charger` not found in accessories array |
| `calculation-service.js:443` | `|| 300` | `wifiSalePrice` fallback when `wifiHub` not found in F2 summary |
| `calculation-service.js:648` | `|| 300` | `wifiSalePrice` fallback in `getQuoteTemplateData` (duplicate) |
| `config-manager.js:201` | `return 300` | `wifiHub` not found in accessories array — direct hardcoded return |
| `calculation-service.js:234` | `|| 130` | W-Motor cost fallback — bypasses ConfigManager when key `cost-w-motor-linx` not resolved |

**Summary**: There are **6 discrete hardcoded price constants** acting as silent fallbacks. The most critical is `delivery: 100` in `f2-config.js` because it is loaded statically and always wins when state is empty, even when Firestore data is available.

---

## 2. HTML Pollution Scan

### 2a. HTML/String Generation in `calculation-service.js`

A scan of all 742 lines of `calculation-service.js` confirms the following:

| Method | Returns HTML? | Details |
|---|---|---|
| `calculateAndSum()` | ❌ No | Pure numeric data object |
| `calculateAccessorySalePrice()` | ❌ No | Returns a number |
| `calculateAccessoryCost()` | ❌ No | Returns a number |
| `calculateF1ComponentPrice()` | ❌ No | Returns a number |
| `calculateF1Costs()` | ❌ No | Returns a pure data object |
| `calculateF2Summary()` | ❌ No | Returns a pure numeric data object |
| `getQuoteTemplateData()` | ⚠️ **Partial** | Pre-formats prices as `$X.XX` strings |

#### `getQuoteTemplateData()` — The Boundary Violation

While no `<span>` HTML tags are emitted by `calculation-service.js` (these were removed in a prior refactoring session), the `getQuoteTemplateData()` method still performs **presentation-layer formatting** by converting raw numbers to `$` currency strings using its internal `formatPrice` helper (Line 618):

```javascript
// Line 618 – calculation-service.js
const formatPrice = (price) => (typeof price === 'number' && price > 0) ? `$${price.toFixed(2)}` : '';
```

This is then applied on lines 717–736 to fields like `motorPrice`, `remote1chPrice`, `chargerPrice`, `eAcceSum`, `wo_rb_price`, etc.:

```javascript
motorPrice: formatPrice(motorPrice),       // → "$250.00"
chargerPrice: formatPrice(chargerPrice),   // → "$45.00"
eAcceSum: formatPrice(eAcceSum),           // → "$800.00"
```

Several other fields on lines 688–694 are also pre-formatted as strings:
```javascript
subtotal: `$${(summaryData.sumPrice || 0).toFixed(2)}`,
gst:      `$${gstValue.toFixed(2)}`,
grandTotal: `$${grandTotal.toFixed(2)}`,
ourOffer:   `$${newOfferValue.toFixed(2)}`,
```

**Impact**: `getQuoteTemplateData()` is the data provider for **all PDF strategies** and could potentially feed future Excel/App layers. By returning pre-formatted `$`-strings instead of raw numbers, it prevents consumers from applying their own locale or currency formatting, breaks numeric comparison operations, and embeds `$0.00` instead of a useful zero-indicator for excluded/empty fields.

### 2b. Motorised Package & Winder Logic Evaluation

| Method | Classification |
|---|---|
| `calculateF2Summary()` — `motorPrice`, `calculatedRemotePrice` | ✅ **Strictly Mathematical** |
| `calculateF2Summary()` — `isDeliveryWaived`, `rawDeliveryFee`, `effectiveDeliveryFee` | ✅ **Strictly Mathematical** |
| `calculateF1Costs()` — `winderCost`, `bMotorCost`, `wMotorCost` | ✅ **Strictly Mathematical** |
| `getQuoteTemplateData()` — `formatPrice(motorPrice)` | ⚠️ **Mixed (Numeric → String)** |

The internal calculations for motors and winders are **clean and correct** — they work purely in numbers. The contamination occurs only at the boundary where `getQuoteTemplateData()` serializes those numbers into display strings.

---

## 3. Decoupling Strategy

### 3a. Recommended Architecture: Raw Data Contract

**Principle**: `CalculationService` should only produce a raw data contract. All presentation — currency symbols, HTML, styles, string formatting — should be the exclusive responsibility of the Generator Strategy layer.

#### Step 1: Delete `formatPrice` from `getQuoteTemplateData()`

Remove the internal `formatPrice` helper (line 618) and return **all price fields as raw numbers**:

```javascript
// BEFORE (service layer)
motorPrice: formatPrice(motorPrice),  // "$250.00"

// AFTER (service layer)  
motorPrice: motorPrice,               // 250
```

#### Step 2: Update the `getQuoteTemplateData()` Financial Summary Fields

Change lines 688–694 from pre-formatted strings to raw numeric pairs:

```javascript
// BEFORE
subtotal: `$${sumPrice.toFixed(2)}`,
grandTotal: `$${grandTotal.toFixed(2)}`,

// AFTER
subtotal: summaryData.sumPrice || 0,
grandTotal: grandTotal,
```

#### Step 3: Move All Formatting into `OriginalQuoteStrategy`

The strategy layer already owns `createRowData()` and is the correct place for currency formatting:

```javascript
// original-quote-strategy.js — proposed helper
_formatCurrency(value) {
    return (typeof value === 'number' && value > 0) ? `$${value.toFixed(2)}` : '';
}
```

Apply this wherever the template requires a formatted string, keeping the data contract clean.

### 3b. Waived Fee Strikethrough: Already Correct

The current architecture for waived fee styling is **already correctly layered**:

- `calculateF2Summary()` returns **boolean flags**: `isDeliveryWaived`, `isInstallWaived`, `isRemovalWaived`
- `getQuoteTemplateData()` passes these flags as-is into the template data payload
- `original-quote-strategy.js → createRowData()` reads `isExcluded` (a boolean) and generates `priceStyle` (the inline CSS string) internally

This is the correct pattern. The Renderer receives intent (`isExcluded: true`) and decides presentation (`text-decoration: line-through`). **No changes needed here.**

### 3c. Fix the Ghost Price: Unify the Fee Source

The most urgent structural fix is replacing the static `f2Config.unitPrices` with the Firestore-backed `ConfigManager.getFees()`:

```javascript
// CURRENT — bypasses Firestore (calculation-service.js:392)
const f2Config = this.configManager.getF2Config();
const UNIT_PRICES = f2Config.unitPrices || {};

// PROPOSED — uses live Firestore/JSON data
const fees = this.configManager.getFees();
const UNIT_PRICES = {
    delivery: fees.delivery ?? 0,
    install:  fees.install  ?? 0,
    removal:  fees.removal  ?? 0,
};
```

This single change eliminates the `$100` ghost and all other fee-related ghost prices by routing through the single source of truth already implemented in `ConfigManager`.

---

## Summary Table

| Risk | Severity | Affected File | Recommendation |
|---|---|---|---|
| `$100` ghost delivery via `f2-config.js` | 🔴 Critical | `f2-config.js`, `calculation-service.js` | Replace with `configManager.getFees()` |
| `$300` wifi hardcoded fallback | 🟡 Medium | `calculation-service.js`, `config-manager.js` | Ensure `ele_wifi_linx` entry exists in price data |
| `$50` charger hardcoded fallback | 🟡 Medium | `calculation-service.js:436` | Remove `|| 50`, let `getAccessoryPrice` return `null` → $0 |
| Currency pre-formatting in service layer | 🟠 High | `calculation-service.js:618–736` | Move `formatPrice` calls to `OriginalQuoteStrategy` |
| Waived fee styling | ✅ Clean | `original-quote-strategy.js` | No action required |
| Motor/Winder math | ✅ Clean | `calculation-service.js` | No action required |
