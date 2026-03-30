# F2 Financial Sync Audit Report

This report diagnoses the state-sync and mathematical discrepancies observed in the F2 Summary panel, specifically concerning the interaction between 'Our Offer' (OF), 'Deposit', and 'Balance'.

## 1. THE "STUCK" DEPOSIT
The logic responsible for recalculating the deposit is located in `f2-summary-view.js` within the `_calculateF2Summary()` method.

### Root Cause:
The system uses a "Grand Total Change Detector" to decide whether to reset the deposit:
- **Location**: [f2-summary-view.js:519-532](file:///c:/rbq6297/04-core-code/ui/views/f2-summary-view.js#L519-L532)
- **Code Trace**:
  ```javascript
  const grandTotalChanged = currentGrandTotal !== previousGrandTotalInState;
  ...
  if (grandTotalChanged) {
      finalDeposit = autoDeposit; // Recalculate
  } else {
      finalDeposit = (currentDepositInState !== null) ? currentDepositInState : autoDeposit;
  }
  ```
- **The Bug**: `previousGrandTotalInState` is pulled from `ui.f2.grandTotal` at the start of the function (Line 464). If any other part of the application (or a previous cycle of the same function) has already updated the state's `grandTotal`, the detector evaluates to `false`. When this happens, the system falls back to `currentDepositInState` (Line 531), which holds the stale value (e.g., 110).
- **Manual Flag Audit**: There is **no** `isDepositManuallyEdited` flag in the current codebase. The system relies entirely on the `grandTotalChanged` boolean, which is currently prone to race conditions.

## 2. THE BROKEN BALANCE MATH
The discrepancy where Total 198 and Deposit 110 results in Balance 98 (instead of 88) is caused by a **Variable Mismatch** during the calculation cycle.

- **Formula Source**: [f2-summary-view.js:534-540](file:///c:/rbq6297/04-core-code/ui/views/f2-summary-view.js#L534-L540)
- **Variables Used for "98"**:
  - `currentGrandTotal`: **198** (The new value calculated from OF 180).
  - `finalDeposit`: **100** (The newly calculated `autoDeposit` for 198).
- **Explanation**: 
  In the user's specific case, the Balance calculation (Line 535) used the **newly calculated** `autoDeposit` (100), arriving at `198 - 100 = 98`. However, either the state dispatch for `deposit` failed to update the UI field, or the UI field is holding onto a stale state value of 110 due to the "stuck deposit" bug described above. This creates a visual contradiction where the Balance reflects the *correct* new math while the Deposit field reflects the *stale* old math.

## 3. THE ROUNDING LOGIC
The rounding rule ("divide by 2, round up to nearest 10") is correctly implemented in the service layer.

- **Code Block**: [f2-summary-view.js:522](file:///c:/rbq6297/04-core-code/ui/views/f2-summary-view.js#L522)
- **Logic**:
  ```javascript
  const autoDeposit = Math.ceil((currentGrandTotal / 2) / 10) * 10;
  ```
- **Trace**:
  - Total 213 -> 213 / 2 = 106.5 -> 106.5 / 10 = 10.65 -> `Math.ceil(10.65)` = 11 -> `11 * 10` = **110**. (Matches observed behavior).
  - Total 198 -> 198 / 2 = 99 -> 99 / 10 = 9.9 -> `Math.ceil(9.9)` = 10 -> `10 * 10` = **100**. (This explains why Balance was 98).

任務完成
