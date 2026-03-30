# Data Flow Integrity Report: F2 State Synchronization Gap

## 1. Event Dispatch Analysis
**Location:** `f2-summary-view.js`
- **Method Responsible:** User interactions are captured by `setupF2InputListener` which binds `change` (and for some fields, `input` and `focus`) events to DOM elements. When fired, it invokes `handleF2ValueChange({ id, value })`.
- **Dispatch Path:** The view converts the input to a float and calls `this.stateService.dispatch(uiActions.setF2Value(key, numericValue))`. It does not directly publish to the EventAggregator; instead, it purely interacts with the State Service as intended for Redux-style architectures.
- **Payload Completeness:** The switch statement correctly identifies the new input IDs (e.g., `'f2-delivery-unit'` maps to `deliveryUnitPrice`). The payload correctly contains the raw numeric values for all fee unit prices and sends them upstream. It *also* passes them explicitly via `domValues` into `_calculateF2Summary()`.

## 2. State Persistence Audit (Root Cause Identified)
**Location:** `state-service.js` & `ui-reducer.js`
- **Reducer Constraint:** Inside `ui-reducer.js`, the action `SET_F2_VALUE` contains the following strict guard clause:
  ```javascript
  case UI_ACTION_TYPES.SET_F2_VALUE: {
      const { key, value } = action.payload;
      if (state.f2.hasOwnProperty(key)) { // <-- THE GAP
          return { ...state, f2: { ...state.f2, [key]: value } };
      }
      return state;
  }
  ```
- **Silent Failure:** The reducer explicitly blocks any keys that are **not pre-defined** in `initialState.ui.f2`. Since `deliveryUnitPrice`, `installUnitPrice`, and `removalUnitPrice` are relatively modern additions to the architecture (e.g., added during Phase 8.1 / v3.47 updates), if they weren't explicitly initialized in `initial-state.js` with default values (even `null`), `hasOwnProperty` will evaluate to `false`. 
- **Result:** The reducer silently rejects the dispatch payload and the UI state refuses to save the user's manual price input.

## 3. Downstream Consumption Audit
**Location:** `calculation-service.js`
- **State Reliance:** When generating the PDF payload, `getQuoteTemplateData(quoteData, uiState)` is called. Since there is no DOM available, it relies entirely on the variables stored in `uiState.f2`.
- **Destructive Fallback:** Because the Reducer dropped the manual input values, `uiState.f2.deliveryUnitPrice` evaluates to `undefined`.
- **Constants Fallback:** In the absence of state-provided values, `calculation-service.js` safely assumes the user hasn't modified them. It executes `const fees = this.configManager?.getFees?.() || { delivery: 100... }` and defaults strictly to the predefined Config Constants/UNIT_PRICES.

## Conclusion
The single-source-of-truth is failing due to a **property validation reject** inside `ui-reducer.js`. 
To solve this, the newly added dynamic fee variables either need to bypass the `hasOwnProperty` check, or (`initial-state.js`) must be updated to explicitly declare these unit price keys.
