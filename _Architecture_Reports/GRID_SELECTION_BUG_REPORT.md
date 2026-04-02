# Investigation Report: Main Grid Item Selection Highlight Bug

## 1. Overview
The user reported that clicking on the "Item Number" (項次) cell in the main quote grid does not trigger the expected light blue highlight. This feature is intended to indicate the selected row for batch operations (Delete, Type Change, etc.).

## 2. Identified Components
- **View Logic**: [quick-quote-view.js](file:///c:/rbq6297/04-core-code/ui/views/quick-quote-view.js)
  - Method: `handleSequenceCellClick({ rowIndex })` (Lines 28-39)
  - Action: Dispatches `toggleMultiSelectSelection(rowIndex)`.
- **State Management**: [ui-reducer.js](file:///c:/rbq6297/04-core-code/reducers/ui-reducer.js)
  - Action: `TOGGLE_MULTI_SELECT_SELECTION` (Lines 33-41)
  - State: Updates `multiSelectSelectedIndexes` array.
- **Rendering**: [table-component.js](file:///c:/rbq6297/04-core-code/ui/table-component.js)
  - Renderer: `sequence` (Lines 119-141)
  - Logic: Applies `selected-row-highlight` class to cells whose index is in `multiSelectSelectedIndexes`.
- **Styling**: [results-table.css](file:///c:/rbq6297/04-core-code/ui/css/results-table.css)
  - Class: `.selected-row-highlight` (Lines 147-150)
  - Color: `var(--highlight-color)` (#a0d3e8).

## 3. Root Cause Diagnosis
The bug is caused by **CSS Specificity Competition**.

The project uses zebra striping for table readability:
```css
/* results-table.css:33 */
.results-table tbody tr:nth-child(odd)>td {
    background-color: #ffffff;
}

/* results-table.css:37 */
.results-table tbody tr:nth-child(even)>td {
    background-color: #f7f9fa;
}
```

The selection highlight is defined as:
```css
/* results-table.css:147 */
.results-table td.selected-row-highlight {
    background-color: var(--highlight-color);
}
```

### Analysis:
- The zebra striping selector `.results-table tbody tr:nth-child(...) > td` has **higher specificity** (0, 2, 3) compared to the selection selector `.results-table td.selected-row-highlight` (0, 2, 1).
- Because the zebra striping is more specific and targets the same property (`background-color`) on the same element (`td`), it overrides the highlight color. Even if the row index is correctly added to the state and the class is correctly applied to the DOM, the browser displays the zebra stripe color instead of the highlight color.

## 4. Proposed Solution

To fix this without breaking established patterns, the specificity of the selection highlight must be increased to override the zebra striping.

### Step-by-Step Fix:
1.  **Modify** `04-core-code/ui/css/results-table.css`.
2.  **Update** the selector for the highlight class to match the parent hierarchy:
    ```diff
    - .results-table td.selected-row-highlight {
    + .results-table tbody tr td.selected-row-highlight {
          background-color: var(--highlight-color);
          font-weight: bold;
      }
    ```
3.  (Optional but Recommended) Add `!important` to ensure the highlight takes precedence over hover states or other dynamic modifiers if needed:
    ```css
    .results-table tbody tr td.selected-row-highlight {
        background-color: var(--highlight-color) !important;
        font-weight: bold;
    }
    ```

## 5. Summary
No logic code changes are required in JavaScript. The system is correctly tracking and applying the selection state. The issue is purely a visual override in the CSS engine due to the specific targeting of zebra stripes.
