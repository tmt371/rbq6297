# Structural Purification Report

**Date**: 2026-03-28
**Status**: Complete

---

## Summary

This refactoring addresses the two structural risks identified in `CORE_STRUCTURAL_AUDIT.md`:
1. Ghost prices caused by disconnected fallback constants
2. String-formatted data leaking out of the service layer

---

## STEP 1: Pricing Authority Unification

### Root Cause Eliminated: `$100` Ghost Delivery

| File | Change |
|---|---|
| `calculation-service.js` | Replaced `getF2Config().unitPrices` with `configManager.getFees()` in `calculateF2Summary()` |
| `f2-config.js` | All `unitPrices` values zeroed and marked `DEPRECATED`; file retained for structural compatibility only |

`UNIT_PRICES` is now built from the live Firestore/JSON-backed `getFees()` object, which is already zeroed by default in `ConfigManager` (Line 85: `this.fees = data.fees || { delivery: 0, install: 0, removal: 0 }`). The static module `f2-config.js` is now a neutralized dead-end that can never propagate ghost values.

### Hardcoded Fallbacks Removed

| Location | Old Value | New Value | Reason |
|---|---|---|---|
| `calculateF2Summary()` → `pCharger` | `\|\| 50` | `\|\| 0` | Charger price must come from accessories data |
| `calculateF2Summary()` → `wifiSalePrice` | `\|\| 300` | `\|\| 0` | WiFi price must come from `ele_wifi_linx` accessory entry |
| `getQuoteTemplateData()` → `wifiSalePrice` | `\|\| 300` | `\|\| 0` | Duplicate of above, same resolution |
| `calculateF1ComponentPrice()` → `wMotorCost` | `\|\| 130` | `\|\| 0` | W-Motor cost must come from `cost-w-motor-linx` motor entry |
| `f2-config.js` → `delivery` | `100` | `0` | Was the primary ghost source; now zeroed |
| `f2-config.js` → `wifi` | `200` | `0` | Additional ghost source; now zeroed |

---

## STEP 2: Service Output Purification

### `getQuoteTemplateData()` — `formatPrice` Helper Removed

The internal `formatPrice` function (which returned `"$X.XX"` strings) has been deleted from `calculation-service.js`.

All fields in the `getQuoteTemplateData()` return object are now **pure numbers**:

| Category | Fields Purified |
|---|---|
| Financial summary | `subtotal`, `gst`, `grandTotal`, `ourOffer`, `deposit`, `balance`, `savings` |
| Accessory prices | `motorPrice`, `remote1chPrice`, `remote16chPrice`, `chargerPrice`, `cord3mPrice`, `wifiHubPrice` |
| Work order prices | `bmotorPrice`, `wmotorPrice`, `hdWinderPrice`, `dualComboPrice`, `dualSlimPrice`, `bracketPrice`, `eAcceSum`, `wo_rb_price`, `wo_acce_price`, `wo_total_price` |
| Qty fields | Changed from `'' ` (empty string) fallback to `0` (numeric) for consistency |

### `original-quote-strategy.js` — Formatting Added at the Boundary

A `_formatCurrency(value)` private method has been added to `OriginalQuoteStrategy`. This is the new **single point of currency formatting** for the PDF strategy layer. It receives raw numbers and converts them to `$X.XX` strings only at the moment of HTML template injection.

---

## Architectural Contract (Post-Refactor)

```
CalculationService → returns { subtotal: 1500, gst: 150, ... }  // Pure numbers
        ↓
OriginalQuoteStrategy → _formatCurrency(1500) → "$1,500.00"      // Formatted at boundary
        ↓
populateTemplate(html, rowData) → "<td>$1,500.00</td>"           // Injected into HTML
```

This separation ensures `CalculationService` can now safely power Excel export and future App API consumers without them needing to strip `$` characters or parse strings.
