# F4 Actions View: Status Dropdown Disabled Bug Report

## Overview
This report details the investigation into why the "Status" dropdown in the F4 Actions tab is greyed out (all options disabled) when loading an existing quote with the status **"A. Saved"**.

## Core Finding
The root cause is a **string value mismatch** between historical Firestore data and the updated `QUOTE_STATUS` configuration, which breaks the Finite State Machine (FSM) lookup logic.

### 1. Affected Files and Code Lines
*   **Configuration**: [`status-config.js`](file:///c:/rbq6297/04-core-code/config/status-config.js)
    *   `QUOTE_STATUS.A_SAVED` is defined as `"A. Saved (Draft)"` (Line 7).
*   **UI Logic**: [`f4-actions-view.js`](file:///c:/rbq6297/04-core-code/ui/views/f4-actions-view.js)
    *   Lookup in `STATE_TRANSITIONS` happens at Line 311.
    *   Option disabling logic occurs at Lines 324-330.

### 2. Root Cause Analysis
When a quote is loaded from Firestore with status `"A. Saved"`:
1.  **State Lookup Failure**: The `effectiveStatus` becomes `"A. Saved"`. The system attempts to find transitions using `STATE_TRANSITIONS[effectiveStatus]` (Line 311).
2.  **Undefined Transitions**: Since `STATE_TRANSITIONS` keys are mapped to the new constant `"A. Saved (Draft)"`, the lookup for `"A. Saved"` returns `undefined` (resulting in an empty `allowedTransitions` array).
3.  **Strict Transition Enforcement**:
    *   For each dropdown option (e.g., `"B. Quoted"`), the code checks `isLegalTransition = (displayValue === effectiveStatus) || allowedTransitions.includes(displayValue)`.
    *   Since `"B. Quoted" !== "A. Saved"` and `allowedTransitions` is empty, every option is marked as illegal.
4.  **UI Consequence**: Every `<option>` tag receives the `disabled` attribute, making the dropdown effectively unselectable even if the parent `<select>` is technically enabled.

### 3. Verification of Other Factors
*   **Validation Errors**: While new items are initialized with `width: null` (in `initial-state.js`), the current `F4ActionsView` does **not** contain logic to disable the dropdown based on item-level validation. It only checks `isNewQuote` and `isStatusReadOnly`.
*   **RBAC (Role Permissions)**: Admin users have bypass permissions for read-only states, but they are **not** exempt from the state transition sequence (FSM) sequence in the current implementation (Line 327: "NO Admin bypass for FSM sequence").

## Proposed Solution
To resolve this without data migration, the system should fuzzy-match or map legacy status strings to current constants.

### Recommended Fix:
Update `f4-actions-view.js` to normalize the status before processing:
1.  Map legacy strings (e.g., `"A. Saved"`) to the modern equivalents (e.g., `"A. Saved (Draft)"`).
2.  Alternatively, use a fallback in `STATE_TRANSITIONS` lookup that handles partial matches (e.g., using `.includes()`).

---
**Status**: Investigated. No code changes performed.
**Conclusion**: 任務完成
