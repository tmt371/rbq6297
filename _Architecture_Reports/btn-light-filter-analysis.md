# System Analysis: `btn-light-filter` Workflow

Created: 2026-04-01  
Document Version: 1.0  
Status: Final

## 1. Overview
The "Light Filter" button (`id="btn-light-filter"`) is a critical functional element in the **K1 Tab (Location + Fabric)**. Its purpose is to toggle the **Light-Filter (LF) configuration mode**. 

This mode allows users to:
- Filter and select eligible roller blind items (B2, B3, B4) from the main table.
- Apply a batch update of specific Fabric Name (prefixed with "Light-filter") and Color properties to the selected items.
- Visually mark the modified rows with a pink background (handled via CSS and the `lfModifiedRowIndexes` metadata).

## 2. Related Files
The following files participate in the lifecycle of this feature:

### UI Layer
- `04-core-code/ui/tabs/k1-tab/k1-tab.html`: Defines the physical button element.
- `04-core-code/ui/tabs/k1-tab/k1-tab-component.js`: Manages the overall K1 tab container.
- `04-core-code/ui/tabs/k1-tab/k1-tab-input-handler.js`: Attaches the `click` listener to the DOM element.

### Controller & View Layer
- `04-core-code/app-controller.js`: The central hub that subscribes to the toggle event and delegates it to the correct view.
- `04-core-code/ui/views/detail-config-view.js`: Acts as a manager, forwarding the request to the specialized `FabricConfigView`.
- `04-core-code/ui/views/fabric-config-view.js`: Orchestrates the state logic, eligibility checks (B2/B3/B4), and toggles between "Selection Mode" and "Launch Dialog" mode.

### Dialog / Modal Layer
- `04-core-code/ui/views/dialogs/fabric-lf-dialog.js`: Constructs the input UI for the batch update and dispatches the final data change.
- `04-core-code/ui/components/dialog-component.js`: The generic host for the confirmation modal.

### State & Business Logic
- `04-core-code/config/constants.js`: Defines the `EVENTS.USER_TOGGLED_K2_MODE`.
- `04-core-code/config/business-constants.js`: Defines `LOGIC_CODES.MODE_LF` and `LOGIC_CODES.LIGHT_FILTER`.
- `04-core-code/actions/ui-actions.js`: Mutates `ui.activeEditMode` and selection arrays.
- `04-core-code/actions/quote-actions.js`: Mutates the actual `quoteData.products[].items` properties.
- `04-core-code/reducers/ui-reducer.js`: Handles state updates for mode toggling.
- `04-core-code/reducers/quote-reducer.js`: Handles data updates for fabric/color.

## 3. Step-by-Step Execution Flow

### Phase A: Entry into Selection Mode
1. **Mouse Click**: User clicks `#btn-light-filter`.
2. **Detection**: `K1TabInputHandler._onLFClick()` catches the event.
3. **Publication**: It publishes `EVENTS.USER_TOGGLED_K2_MODE` with `{ mode: 'LF' }`.
4. **Subscription**: `AppController` receives the event and calls `detailConfigView.handleModeToggle({ mode: 'LF' })`.
5. **Delegation**: `DetailConfigView` calls `fabricConfigView.handleModeToggle({ mode: 'LF' })`.
6. **State Shift**: `FabricConfigView` detects `activeEditMode` is currently `null`. It dispatches `setActiveEditMode('LF')` and updates visible columns to show Fabric/Color.
7. **User Selection**: The system remains in "LF mode". The user clicks on rows (sequence cells) in the main table. These rows are added to `ui.multiSelectSelectedIndexes`.

### Phase B: Launching the Dialog
8. **Second Click**: User clicks `#btn-light-filter` again while `activeEditMode` is already `LF`.
9. **Logic Trigger**: `FabricConfigView` checks if any rows are selected. If yes, it calls `lfDialog.show()`.
10. **Validation**: `FabricLFDialog` filters the selected rows, keeping only eligible B2/B3/B4 items that haven't already been modified.
11. **Modal UI**: `FabricLFDialog` publishes `EVENTS.SHOW_CONFIRMATION_DIALOG` with a layout containing "F-Name" and "F-Color" inputs.

### Phase C: Data Submission
12. **Confirmation**: User fills inputs and clicks "Confirm".
13. **Data Mutation**: 
    - `batchUpdateLFProperties` is dispatched (updates `items[rowIndex].fabric` and `color`).
    - `addLFModifiedRows` is dispatched (updates `quoteData.uiMetadata.lfModifiedRowIndexes`).
14. **Cleanup**: `_exitAllK2Modes()` is called, clearing all selections and setting `activeEditMode` back to `null`.
15. **Re-render**: `STATE_CHANGED` is published, triggering the UI to show the updated values and pink backgrounds.

## 4. Event & State Map

### Primary Events
| Event Constant | Direction | Payload Shape |
| :--- | :--- | :--- |
| `USER_TOGGLED_K2_MODE` | Outgoing | `{ mode: "LF" }` |
| `SHOW_NOTIFICATION` | Outgoing | `{ message: string, type: "info"\|"error" }` |
| `SHOW_CONFIRMATION_DIALOG`| Incoming | `{ message: string, layout: Array, callback: Function }` |

### State Properties (UI)
- `state.ui.activeEditMode`: Becomes `"LF"`.
- `state.ui.multiSelectSelectedIndexes`: Array of integers (0-based row indices).

### State Properties (Data)
- `state.quoteData.products[currentProduct].items[rowIndex].fabric`: Updated as `"Light-filter [User Value]"`.
- `state.quoteData.products[currentProduct].items[rowIndex].color`: Updated as `"[User Value]"`.
- `state.quoteData.uiMetadata.lfModifiedRowIndexes`: Updated to include the newly modified indices.

## 5. Potential Vulnerabilities

### 1. Tight Architectural Coupling
The event path `InputHandler -> Controller -> Manager View -> Sub-View -> Dialog` is five layers deep. A change in the interface of `DetailConfigView` could break the entire chain. Logic is fragmented across these layers.

### 2. Manual DOM Access in Modals
The `FabricLFDialog` callback relies on `document.getElementById` to retrieve input values after the modal is rendered. This bypasses the virtual state management pattern used elsewhere and could lead to conflicts if ID uniqueness is not strictly maintained.

### 3. Hardcoded String Prefixes
The string prefix `"Light-filter "` is hardcoded directly in the callback inside `fabric-lf-dialog.js`. If the business logic for naming conventions changes, this value must be hunted down in the dialog logic rather than a centralized config.

### 4. Direct View-to-Action Dispatch
The `FabricLFDialog` dispatches actions directly. In a strictly decoupled architecture, the view should only notify the controller of a "submit" intent, and the controller should handle the state mutation.

### 5. Selection Logic Sync
The `handleSequenceCellClick` method in `DetailConfigView` contains "if/else" logic that checks `activeEditMode`. If a new mode is added to the system, THIS view must be updated manually, or the sequence click will fall through to the default behavior.
