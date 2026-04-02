# Diagnostic Report: Work Order HTML Source and Rendering Architecture

This report details the investigation into how the Work Order HTML table is generated and why the background colors are appearing on every cell (row-level bleed), even though the goal was to limit them to specific columns.

## 1. Trace of the Render Pipeline

The Work Order table rows are generated through a collaborative process involving a service dispatcher, a specialized strategy, and an HTML partial template.

### A. The Orchestrator
- **File**: [`04-core-code/services/quote-generator-service.js`](file:///c:/rbq6297/04-core-code/services/quote-generator-service.js)
- **Mechanism**: Fetches the base Work Order template and row template from the filesystem.
- **Lines (70-72)**: Pre-fetches `work-order-template-row.html`.
- **Line (91)**: Dispatches the row generation to the `WorkOrderStrategy`.

### B. The Logic Source
- **File**: [`04-core-code/services/generators/work-order-strategy.js`](file:///c:/rbq6297/04-core-code/services/generators/work-order-strategy.js)
- **Mechanism**: A JavaScript class method `generateRows(quoteData, ui, rowTemplate)` iterates over the standardized quote items.
- **Lines (73, 76, 79)**: Explicitly constructs the `rowStyle` string containing hardcoded HEX values (e.g., `#F2F2F2` for Blockout).
- **Line (122)**: Calls `populateTemplate(rowTemplate, rowData)` to perform string interpolation on the fetched HTML snippet.

### C. The Snippet Structure (Template)
- **File**: [`04-core-code/ui/partials/work-order-template-row.html`](file:///c:/rbq6297/04-core-code/ui/partials/work-order-template-row.html)
- **Mechanism**: A static HTML snippet using triple-brace placeholders (e.g., `{{{rowStyle}}}`).
- **Key Vulnerability**: The `style="{{{rowStyle}}}"` attribute is hardcoded into **EVERY** `<td>` element on lines 2 through 17.

---

## 2. Identification of the Styling Source

The "row-level bleed" is actually a **column-by-column application of an identical style string**. 

| Component | Source of Injection | Behavior |
| :--- | :--- | :--- |
| **Inline HEX Style** | `rowStyle` in `work-order-strategy.js` | Applied to every `<td>` in `work-order-template-row.html`. |
| **CSS Classes** | `fabricClass` in `work-order-strategy.js` | Applied only to cells 1, 2, 3, and 4 in the template. |
| **Row Level** | None | The `<tr>` itself has no background class or style in the template. |

Because `rowStyle` contains the background color and is stamped onto every cell, the effect is a solid row of color.

---

## 3. Proposed Definitive Fix

To resolve this issue once and for all, we must decouple the background color from the universal `rowStyle` and associate it strictly with the target fabric-related columns.

### A. Modify `work-order-strategy.js`
- **Rename Variable**: Change `rowStyle` to `fabricBgStyle`.
- **Logic**: Ensure `fabricBgStyle` only contains the background color relevant to the fabric type (BO/SN/LF).

### B. Modify `work-order-template-row.html`
- **Scrub Non-Target Cells**: Remove the `style="{{{rowStyle}}}"` (or `{{{fabricBgStyle}}}`) from all cells except the target indices.
- **Retain Shading on Indices 1-4**:
    - **Cell 1 (#)**: `style="{{{fabricBgStyle}}}"`
    - **Cell 2 (TYPE)**: `style="{{{fabricBgStyle}}}"`
    - **Cell 3 (F-Name)**: `style="{{{fabricBgStyle}}} {{{fabricTextStyle}}}"`
    - **Cell 4 (F-Color)**: `style="{{{fabricBgStyle}}} {{{fabricTextStyle}}}"`
- **Result**: All other cells (NO, W, H, etc.) will have **no** inline background style, defaulting to white.

---

## Conclusion
The bug is rooted in a "deceptively simple" template where a single variable was reused across all table columns for uniformity. By splitting this logic and scrubbing the universal attribute from the `work-order-template-row.html` partial, the PDF generator will receive a "clean" HTML source where only the relevant columns are colored.

任務完成
