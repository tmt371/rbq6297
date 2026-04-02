# RB Quoting System - AI HANDOFF MEMO

## SECTION 1: The Iron Rules (Architectural Boundaries)
* **PDF Generation (New Tabs)**: MUST use `Blob URL` instead of `document.write`. This prevents browser script blocking and ensures "View Page Source" visibility.
* **Table Readability**: Styling (Zebra Striping/5-Row Anchors) MUST be "Data-Driven." Inject explicit CSS classes (e.g., `row-even`, `row-fifth`) during the row-generation loop rather than relying on CSS `:nth-child`.
* **PDF Trigger Logic**: Only the "Generate Both" dual-workflow triggers `_downloadPdfSilently`. All single PDF generators MUST use `isSilent = false` to allow the browser to open the preview tab first.
* **State Management**: Always deep-clone snapshots from `stateService` before modifying data for calculation to avoid polluting the reactive UI state.

## SECTION 2: Recent Critical Fixes (Regression Prevention)
* **LF-Mode UX**: Strict per-click validation is enforced in `handleSequenceCellClick`. Intercept invalid fabrics (non-B2, B3, B4) immediately and return early with a toast notification BEFORE any UI highlight or array mutation.
* **Price Symbol Integrity**: The "Double Dollar Sign" bug is prevented by using JS formatting utilities (`format-utils.js`) for symbols. Do NOT hardcode `$` in HTML templates.
* **Character Encoding**: Ensure all accessory names and descriptions are 100% ASCII English. Avoid Japanese/CJK characters (e.g., use "Set" instead of "セット") to prevent jsPDF encoding corruption (mojibake).
* **PDF Layout Sync**: Any visual guidance for the Installation Worksheet (e.g., 5-row bottom border) must be explicitly implemented in both the template CSS and the `didParseCell` hook of the `autoTable` configuration.

## SECTION 3: Standard Procedures
* **Reporting**: `C:\rbq6297\_Architecture_Reports` is the mandatory directory for all system analysis, audit, and recovery reports.
* **Modularization**: Keep feature logic (F1-F4) isolated in their respective views and dialog handlers. Services should focus on logic, not UI state.
* **Validation**: Always verify UI changes in both the HTML live preview and the generated PDF output.

任務完成
