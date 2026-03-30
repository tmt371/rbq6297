# 🚨 Technical Report: Order Status FSM & F3 Button Binding Audit [v3.40] 🚨

**Auditor**: Agent 3 (Validator)
**Mission**: Read-only forensic mapping of Order Lifecycle and F3 Action Button gating.
**Status**: audit_complete ✅

---

## 1. Status Registry (FSM Definition)
Derived from `04-core-code/config/status-config.js`.

| Step | Status Key | Display name | Transition Origin (Legal From) |
| :--- | :--- | :--- | :--- |
| A | `A_SAVED` | A. Saved (Draft) | New, `B_QUOTED` |
| B | `B_QUOTED` | B. Quoted | `A_SAVED`, `B_QUOTED` |
| C | `C_CONFIRMED` | C. Order Confirmed | `B_QUOTED` |
| D | `D_DEPOSIT_PAID` | D. Deposit Paid | `C_CONFIRMED` |
| E | `E_TO_FACTORY` | E. To Factory | `D_DEPOSIT_PAID`, `Y_ON_HOLD` |
| F | `F_PRODUCTION` | F. Production | `E_TO_FACTORY`, `Y_ON_HOLD` |
| G | `G_READY_PICKUP` | G. Pickup Ready | `F_PRODUCTION` |
| H | `H_DELIVERED` | H. Picked Up/Delivered | `G_READY_PICKUP` |
| I | `I_COMPLETED` | I. Installed/Completed | `G_READY_PICKUP`, `H_DELIVERED` |
| J | `J_INVOICED` | J. Bill/Invoice Sent | `I_COMPLETED` |
| K | `K_OVERDUE` | K. Overdue | `J_INVOICED` |
| L | `L_CLOSED` | L. Closed (Paid) | `J_INVOICED`, `K_OVERDUE` |
| Y | `Y_ON_HOLD` | Y. On Hold (Issue) | `D`, `E`, `F` |
| X | `X_CANCELLED` | X. Order Cancelled | `A`, `B`, `C`, `D`, `Y` |

---

## 2. Transition Mechanics & Field Requirements
Derived from `f4-actions-view.js` logic.

### Triggers & Gates:
- **D_DEPOSIT_PAID Intercept**: If status is updated to `D_DEPOSIT_PAID` but `metadata.payments` is empty, the UI intercepts and forces the **Payment Modal** to open (`f4-actions-view.js:143`).
- **L_CLOSED Gate**: Validates `totalPaid >= quoteTotal`. Action is blocked if payment is insufficient (`f4-actions-view.js:122`).
- **Correction Mode**: Disables `Save`, `Save as New`, `XLS`, and `Work Order` buttons. Forces `f4-status-dropdown` to read-only (`f4-actions-view.js:240`).

### Locking Behavior (Panel Gating):
- **Read-Only Statuses**: `J_INVOICED`, `K_OVERDUE`, `L_CLOSED`, `X_CANCELLED`. These disable the status dropdown and update buttons for non-admins (`f4-actions-view.js:267`).
- **Data Hard-Lock**: Once a status is `B_QUOTED` or higher, the standard `f1-key-save` and `save-as-new` buttons are disabled (`f4-actions-view.js:261`).

---

## 3. F3 [f3-group-action] Permission Matrix
Mapping of 5 buttons in `f3-quote-prep-view.js` against the active Status.

| Button ID | Action | Enabled Statuses | Gating Logic / Reason |
| :--- | :--- | :--- | :--- |
| `add-quote` | Generate Quote | `A. Saved`, `B. Quoted` | Primary sales phase only. |
| `add-gth` | Gmail Quote | `A. Saved`, `B. Quoted` | Primary sales phase only. |
| `add-invoice` | Smart Invoice | `B. Quoted`, `C-L` (except `K, L`) | Disabled in `On Hold` / `Cancelled`. |
| `add-receipt` | Smart Receipt | `C-L` (All after Quote) | Requires `liveLedger` via `_smartFinancialRoute`. |
| `add-overdue` | Overdue Stmt | `K. Overdue` | Strictly gated to the Overdue status. |

### Smart Routing Logic (`_smartFinancialRoute`):
- **Invoice Button**: If `totalPaid === 0`, triggers Tax Invoice. If `totalPaid > 0`, routes to Receipt (`f3-quote-prep-view.js:301`).
- **Receipt Button**: Determines "Deposit" vs "Balance" receipt based on `balanceDue`.

---

## 4. Logical Gaps & Conflicts
1. **Overdue Inconsistency**: The `add-overdue` button is *only* enabled if status is exactly `K. Overdue`. However, if an order is `L. Closed` but needs a historical overdue statement, the button is disabled.
2. **Cancellation Dead-End**: `X. Order Cancelled` has no outbound transitions (`status-config.js:54`). Any document generation (Quote/Invoice) is disabled.
3. **Admin Bypass**: Admins can see all statuses in the dropdown, but `f3-quote-prep-view.js` button state logic does **not** check roles. Even an Admin cannot click "Add Overdue" unless the status is `K. Overdue`.

---

✅ [代理三稽核報告] 訂單狀態 FSM 與 F3 按鈕綁定邏輯偵察完畢。完整技術報告已儲存於 _Architecture_Reports/Order_Status_and_F3_Binding_Audit.md。
