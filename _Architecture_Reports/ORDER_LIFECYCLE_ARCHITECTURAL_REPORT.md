# Order Lifecycle & State Machine Report

## 1. Status Definitions & Permissions

The system defines order statuses in `04-core-code/config/status-config.js` and implements permission checks in both the UI (`f4-actions-view.js`) and the Service layer (`quote-persistence-service.js`).

### Available Statuses
1. `A_SAVED` ("A. Saved (Draft)")
2. `B_QUOTED` ("B. Quoted")
3. `C_CONFIRMED` ("C. Order Confirmed")
4. `D_DEPOSIT_PAID` ("D. Deposit Paid")
5. `E_TO_FACTORY` ("E. To Factory")
... through `L_CLOSED` and including `Y_ON_HOLD`, `X_CANCELLED`.

### Permission & Editability Checks
**UI Layer (`f4-actions-view.js`)**:
The UI disables the `Save` and `Save As New Version` buttons if the order's status is found within a hardcoded `lockedStates` array. 
- **Locked States**: `[B_QUOTED, C_CONFIRMED, D_DEPOSIT_PAID, ...]` (Everything except `A_SAVED`).
- **Result**: Once an order moves out of "Draft" (even just to "Quoted"), the UI disables standard saving mechanisms.

**Service Layer (`quote-persistence-service.js`)**:
The backend service enforces an overlapping but slightly different rule in `handleSaveToFile()`:
- **Rule**: `const isLocked = currentStatus && currentStatus !== QUOTE_STATUS.A_ARCHIVED && currentStatus !== "Configuring";`
- **Result**: Any status other than the base "Draft" status forces the system into a locked state, rejecting overwrites.

## 2. Versioning Logic (The `-v2`, `-v3` mechanism)

**Generation**:
The logic resides in `QuotePersistenceService.handleSaveAsNewVersion()`. 
- **Methodology**: It examines the current `quoteId` against a RegEx: `/-v(\d+)$/`.
- If matched, it increments the integer (e.g., `RB123-v2` → `RB123-v3`).
- If no match exists, it blindly appends `-v2` to the current ID (e.g., `RB123` → `RB123-v2`).

**Tracking & Linking (Ledger ID)**:
The system uses `_getBaseLedgerId()` to link versions and corrections back to a single financial ledger. 
- It splits the `quoteId` by `-` and strips any trailing version markers (`-A`, `-B`, `-v2`), identifying the "Master Document" (e.g., `RB123`) which corresponds to the `accounting_ledgers` ID.

## 3. Persistence Gatekeeping

**Why does it trigger a "LOCKED" warning even if the cloud write failed?**
- When a user changes the status dropdown (e.g., from `A_SAVED` to `B_QUOTED`), they sometimes trigger a local state dispatch *before* the cloud confirmation.
- If the subsequent cloud write fails (or is swallowed by the `saveQuoteToCloud` try/catch block), the local memory `state.quoteData.status` remains `B_QUOTED`.
- When the user clicks "Save" again to retry, `handleSaveToFile()` inspects the *local* state, sees `B_QUOTED`, and instantly throws the "Order is established and LOCKED" error. The UI prevents the user from recovering the failed save.

## 4. Known Issues & Logic Gaps

1. **The "B_QUOTED" Contradiction**: The user assumes `B_QUOTED` should allow creating a new version (`-v2`). However, `f4-actions-view.js` places `B_QUOTED` in the `lockedStates` array, disabling the "Save As New Version" button entirely. A user literally cannot create a v2 from a Quoted document via the standard UI buttons.
2. **Double-Barreled Blocking**: The UI strictly disables save buttons, but if those buttons were somehow clicked (or triggered via keyboard shortcuts), the Service layer redundantly blocks all non-draft statuses.
3. **Draft Constant Name Drift**: The service layer references `QUOTE_STATUS.A_ARCHIVED` to check for drafts, but the `status-config.js` defines it as `QUOTE_STATUS.A_SAVED`. (Though JS might resolve this if they are aliases, it represents semantic drift).
4. **False Progression Path**: Changing a status from the dropdown updates the visual UI immediately. If the network drops, the user sees "Quoted" and cannot interact with the fields anymore, assuming successful persistence, but the cloud remains empty.

任務完成
