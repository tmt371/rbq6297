# F-Panel Locking & Status Flow Audit Report

**Date**: 2026-03-12  
**Source Files**: `status-config.js`, `ui-manager.js`, `style.css`, `f4-actions-view.js`  
**Purpose**: Detailed analysis of the FSM, UI Locking rules, and Payment overrides in the RB Quoting System.

---

## 1. The 14-Step Finite State Machine (FSM)
Statuses are centrally tracked in `04-core-code/config/status-config.js` as an explicit enum:

```javascript
export const QUOTE_STATUS = {
    A_SAVED: "A. Saved (Draft)",
    B_QUOTED: "B. Quoted",
    C_CONFIRMED: "C. Order Confirmed",
    D_DEPOSIT_PAID: "D. Deposit Paid",
    E_TO_FACTORY: "E. To Factory",
    F_PRODUCTION: "F. Production",
    G_READY_PICKUP: "G. Pickup Ready",
    H_DELIVERED: "H. Picked Up/Delivered",
    I_COMPLETED: "I. Installed/Completed",
    J_INVOICED: "J. Bill/Invoice Sent",
    K_OVERDUE: "K. Overdue",
    L_CLOSED: "L. Closed (Paid)",
    Y_ON_HOLD: "Y. On Hold (Issue)",
    X_CANCELLED: "X. Order Cancelled"
};
```

---

## 2. Global UI Locking Logic
The system enforces a strict "Read-Only" mode once an order progresses past the "Draft" stage.

### The Trigger (`ui-manager.js`)
During the main `render()` loop, the `UIManager` checks if the current `status` is inside the `shouldBeLockedByStatus` array constraint (*which strictly includes ALL statuses from `B_QUOTED` down to `X_CANCELLED`*).

If it matches, and the system is **NOT** explicitly placed into "Correction Mode" by an Admin, the variable `finalLockState` drops to `true`.

### The Enforcement (`style.css`)
```css
.global-ui-locked .results-panel,
.global-ui-locked .keyboard-panel,
.global-ui-locked .tab-content-container {
    pointer-events: none !important;
    opacity: 0.85;
}
```
When `finalLockState` is activated, `document.body` receives the `global-ui-locked` CSS class. This strictly disables `pointer-events` (mouse clicks, selection, focus) across the entire configuration UI, explicitly targeting:
1. `.tab-content-container` (The Left Panel K1-K5 inputs)
2. `.keyboard-panel` (The Numeric Keypad)
3. `.results-panel` (The F1 Cost breakdown grid and F2 Summary)

---

## 3. The "Payment Window" Exemption
If the UI locks down entirely at `C_CONFIRMED`, how can a user logically proceed to `D_DEPOSIT_PAID`?

**The architecture strategically exempts the F4 Panel from the global CSS lock.**

Because the F4 Panel (`#f4-content`) is housed within the `#function-panel` (not `.results-panel` or `.tab-content-container`), it does NOT inherit `pointer-events: none`. The locking inside F4 is handled explicitly via Javascript.

### Payment Logic (`f4-actions-view.js` lines 277-284)
```javascript
if (this.f4.btnOpenPaymentModal) {
    this.f4.btnOpenPaymentModal.disabled = isNewQuote;
    if (this.f4.paymentAmount) this.f4.paymentAmount.disabled = isNewQuote;
    if (this.f4.btnRegisterPayment) this.f4.btnRegisterPayment.disabled = isNewQuote;
}
```
Unlike the F4 "Save" buttons which are explicitly disabled in `lockedStates`, the payment controls (`btnOpenPaymentModal`, `paymentAmount`, `btnRegisterPayment`) are **ONLY** disabled if `isNewQuote` is true.

**Flow Execution Path**:
1. User changes state from `B_QUOTED` to `C_CONFIRMED`.
2. The entire left configuration panel and pricing grid instantly freeze (locked).
3. The F4 Panel remains interactive. The Payment Section remains unlocked.
4. The Sales rep clicks "Register Payment".
5. The payment validates, is recorded in the master ledger, and triggers a state sync.
6. User can legally transition to `D_DEPOSIT_PAID` without triggering a formal "Correction".

**Conclusion**: The system strictly segments configuration (immutable after confirmed) from financial administration (mutable throughout the lifecycle), preventing configuration tampering while maintaining ledger flexibility.
