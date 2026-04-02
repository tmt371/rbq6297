# Audit Report: Work Order Sorting and Color Logic

This report documents the audit of the "Two-Tier Sorting and Color Mapping Logic" within the Work Order generation pipeline. We investigated whether the business rules for fabric categorization and frequency-based grouping are currently active and correct.

## 1. Audit Findings: Sorting Logic

The sorting logic is currently centralized in the `DataPreparationService`, but it deviates from the predefined business rules.

| Sorting Tier | Requirement | Current Implementation Status | Location |
| :--- | :--- | :--- | :--- |
| **Tier 1** | Sort by TYPE: BO > SN > LF | **Active & correct**. BO is Rank 1, SN is Rank 2, LF is Rank 3. | `data-preparation-service.js:L213-L224` |
| **Tier 2** | Group by "Fabric + Color" Frequency | **Missing / Misaligned**. The code currently sorts by the frequency of the TYPE (BO/SN/LF) rather than the specific fabric combination frequency. | `data-preparation-service.js:L226-L229` |
| **Stability** | Fallback to original index | **Active & correct**. Uses `originalIndex` as the quaternary sort key. | `data-preparation-service.js:L237` |

### Discrepancy Detail
The current secondary sort key (`typeCounts[a.typeCode]`) is redundant because the primary sort already separates items by type. The system is counting how many "Blockouts" there are total, rather than how many "Vibe - White" items there are within the Blockout category.

## 2. Audit Findings: Color Mapping Logic

The background and text color mapping logic was found within the rendering strategy and matches the user's expectations.

| Type | Background Color | Status | Location |
| :--- | :--- | :--- | :--- |
| **BO (Blockout)** | Light Gray (`#F2F2F2`) | **Active & correct**. | `work-order-strategy.js:L76` |
| **SN (Screen)** | Light Blue (`#E6F2FF`) | **Active & correct**. | `work-order-strategy.js:L79` |
| **LF (Filter)** | Light Pink (`#FFE6E6`) | **Active & correct**. | `work-order-strategy.js:L73` |

### Secondary Highlighting (Text Color)
We identified that frequency-based counting **does exist** in `work-order-strategy.js` (lines 34-58), but it is only used to assign **text colors** (Red/Orange) to help the manufacturing team identify multiple fabrics of the same type. It has not been integrated into the sorting mechanism.

## 3. Proposal for Restoration

To reactivate the true Two-Tier Sorting logic, we propose the following refactoring:

1.  **Relocate Fabric Frequency Logic**: Move the frequency counting of `Fabric Name + Fabric Color` from `work-order-strategy.js` into `DataPreparationService`.
2.  **Update `_sortItems`**:
    - Keep **Primary Sort**: Category Rank (BO > SN > LF).
    - Implement **Secondary Sort**: Fabric Key Frequency (Count of specific Fabric + Color combination).
    - Implement **Tertiary Sort**: Alphabetical Fabric Name (for stability between ties in frequency).
    - Implement **Quaternary Sort**: Original Index.

---

## Conclusion
The Tier 1 categorization and color mappings are healthy. However, the Tier 2 frequency-based grouping was partially bypassed or misimplemented during the refactor to the `DataPreparationService`. Moving the frequency counting logic to the service layer will resolve this and restore the expected manufacturing order.

任務完成
