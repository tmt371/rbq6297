# Architecture Proposal: Deep Deposit Manual Lock Mechanism

Following the [F2 Financial Sync Audit](file:///c:/rbq6297/_Architecture_Reports/F2_FINANCIAL_SYNC_AUDIT.md), this proposal outlines the architectural changes required to introduce a robust "Manual Lock" for the \#f2-deposit field. This will eliminate the race conditions associated with `grandTotalChanged` and ensure the system respects explicit user input.

## 1. CURRENT EVENT TRACING
The current flow for user-entered deposit values is as follows:

- **Listener**: Initialized in `f2-summary-view.js` ([Line 170](file:///c:/rbq6297/04-core-code/ui/views/f2-summary-view.js#L170)) using the `input` event on `#f2-deposit`.
- **Logic Routing**: Routes through `handleF2ValueChange({ id: 'f2-deposit', value: ... })` ([Line 412](file:///c:/rbq6297/04-core-code/ui/views/f2-summary-view.js#L412)).
- **Dispatch Pattern**:
  ```javascript
  this.stateService.dispatch(uiActions.setF2Value('deposit', numericValue));
  this._calculateF2Summary();
  ```
- **The Gap**: The system currently treats a manual user edit exactly the same as an automated system update. There is no metadata in the state to distinguish *who* or *why* the deposit value was set.

## 2. PROPOSED "MANUAL LOCK" ARCHITECTURE

### A. State Extension
Introduce a new boolean flag in the F2 UI state:
- **Path**: `initialState.ui.f2.isDepositManuallyEdited`
- **Default**: `false`

### B. Logical Logic Flow
The proposal follows the **"Respect the Human"** principle:

1. **Setting the Lock**:
   - In `f2-summary-view.js`, specifically within the `f2-deposit` case of `handleF2ValueChange`, the system will dispatch a second action:
     `stateService.dispatch(uiActions.setF2Value('isDepositManuallyEdited', true))`
   - **Trigger**: Any `input` event on the deposit field.

2. **Clearing the Lock (Reset Trigger)**:
   - To avoid "permanent lock" frustration, the most intuitive reset trigger is **field clearance**.
   - **Logic**: If the user deletes the value (e.g., `value === ''`), the system dispatches `isDepositManuallyEdited: false`. This signals the system to resume auto-calculation.

3. **Recalculation Routing (The Replacement)**:
   - The flawed `grandTotalChanged` logic in `_calculateF2Summary` will be completely removed.
   - **New Logic**:
     ```javascript
     const isLocked = state.ui.f2.isDepositManuallyEdited;
     const autoCalc = Math.ceil((currentGrandTotal / 2) / 10) * 10;
     
     // 1. Determine Final Deposit
     const finalDeposit = isLocked ? currentDepositInState : autoCalc;
     
     // 2. Calculate Balance based on THE RESULT of the logic above
     const finalBalance = currentGrandTotal - finalDeposit;
     ```

## 3. ADVANTAGES & BUSINESS SAFETY
- **Precision**: Eliminates the "Stale Total" race condition. The balance will always be subtracted from the deposit that is *actually* in the UI/State.
- **User Agency**: If a user promises a customer a specific $200 deposit, the system won't "fight" them and force a recalculation just because an accessory was added.
- **Transparency**: The "Our Offer" warning logic can be extended to the deposit field (e.g., changing the label color if a manual deposit is active) for better user feedback.

## 4. IMPACT ON QUOTATION WORKFLOW
For a Quotation system, this is the safest approach. Sales reps often negotiate specific deposit amounts that don't follow the "50% rounded to 10" rule. By locking the value upon manual entry, we ensure the Quotation PDF perfectly matches the rep's agreement with the customer, while still providing smart defaults for 90% of standard cases.

任務完成
