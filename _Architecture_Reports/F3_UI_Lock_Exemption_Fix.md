# F3 UI Lock Exemption Fix

**Date**: 2026-03-12  
**Directive**: v3.7 — F3 Panel Global UI Lock Exemption  
**File Modified**: `style.css`

---

## 1. Root Cause

The global UI lock is enforced by `ui-manager.js` adding the class `global-ui-locked` to `document.body` whenever the order status is past Draft (B through X) and Correction Mode is inactive.

The CSS rule in `style.css` then applies `pointer-events: none` to three selectors:

```css
.global-ui-locked .results-panel,
.global-ui-locked .keyboard-panel,
.global-ui-locked .tab-content-container { pointer-events: none !important; }
```

**The bug**: `#f3-content` and `#f4-content` are both children of `.tab-content-container` (see `right-panel.html` line 19), so they both inherited `pointer-events: none` along with F1 and F2. This is architecturally incorrect — F3 and F4 are *financial action panels*, not configuration panels.

---

## 2. Surgical Fix Applied

**File**: `c:\rbq6297\style.css`  
**Lines added** immediately after the `.global-ui-locked` block:

```css
/* [Scheme B / DIRECTIVE-v3.7] Exempt financial panels from the global UI lock.
   F3 (document generation) and F4 (payment/order actions) must remain interactive
   after an order is confirmed. Only F1/F2 configuration panels should be read-only. */
.global-ui-locked #f3-content,
.global-ui-locked #f4-content {
    pointer-events: auto !important;
    opacity: 1 !important;
}
```

No JavaScript changes were required. The locking was purely CSS-based.

---

## 3. Post-Fix Behaviour Matrix

| Panel | Status ≥ B_QUOTED | Locked? |
|---|---|---|
| F1 (Component Cost) | `pointer-events: none` | ✅ Locked |
| F2 (Pricing Summary) | `pointer-events: none` | ✅ Locked |
| **F3 (Document Generation)** | `pointer-events: auto` (exempted) | ✅ **Active** |
| **F4 (Order Actions / Payment)** | `pointer-events: auto` (exempted) | ✅ **Active** |

---

## 4. No Changes Required

- `f3-quote-prep-view.js` — no JS button disabling based on status; buttons only disabled if `quoteId` is absent.
- `f4-actions-view.js` — already handled F4 exemptions via JS directly.
- `ui-manager.js` — no change; the `global-ui-locked` toggle logic remains correct.
