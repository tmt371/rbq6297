# Work Order PDF Generation Enhancement Report

## 1. Filename Format Enhancement
### Current Implementation
The PDF filename is constructed in `04-core-code/services/calculation-service.js` within the `getQuoteTemplateData` method.
*   **File**: [`calculation-service.js`](file:///c:/rbq6297/04-core-code/services/calculation-service.js)
*   **Logic (Lines 681-690)**:
    ```javascript
    pdfFileName: (() => {
        const fn = (liveQuoteData.customer.firstName || '').trim();
        const ln = (liveQuoteData.customer.lastName || '').trim();
        const ph = (liveQuoteData.customer.phone || '').trim();
        const qn = liveQuoteData.quoteId || 'WO';
        let fileNameName = fn || ln || 'customer';
        let name = `${qn}_${fileNameName}`; // Currently "[QuoteID]_[Customer]"
        if (ph) name += `_${ph}`;
        return name;
    })(),
    ```

### Proposed Change
To prepend "Order ", modify line 687 to:
```javascript
let name = `Order ${qn}_${fileNameName}`;
```

---

## 2. Table Cell Highlights (TYPE Background)
### Current Implementation
The background color for fabric types (BO, SN, LF) is applied in the `didParseCell` hook of the `jsPDF-autotable` configuration inside the Work Order HTML template.
*   **File**: [`work-order-template.html`](file:///c:/rbq6297/04-core-code/ui/partials/work-order-template.html)
*   **Logic (Lines 577-587)**: Currently, the hook checks the `typeCode` for the row and applies the `fillColor` to **every** cell in that row.

### Proposed Change
Restrict the coloring to columns 2, 3, 4, and 5 (indices 1, 2, 3, and 4 in `autoTable`).
Update the logic in `didParseCell` to:
```javascript
if (data.section === 'body' && data.column.index >= 1 && data.column.index <= 4) {
    const rowElement = data.row.raw;
    const typeCell = rowElement.querySelector('td:nth-child(3)');
    if (typeCell) {
        const typeCode = typeCell.innerText.trim();
        if (typeCode === 'SN') data.cell.styles.fillColor = [224, 247, 250];
        else if (typeCode === 'BO') data.cell.styles.fillColor = [240, 240, 240];
        else if (typeCode === 'LF') data.cell.styles.fillColor = [255, 235, 235];
    }
}
```

---

## 3. Financial Summary Precision Fix
### Current Implementation
The "Financial Summary" values are being recalculated in the dispatcher rather than sourced from the finalized financial state.
*   **File**: [`calculation-service.js`](file:///c:/rbq6297/04-core-code/services/calculation-service.js)
*   **Logic (Lines 658-660 and 752-754)**:
    ```javascript
    const f1_rb_price = retailTotal * (1 - (discountPercentage / 100)); // Raw math causing decimals
    ...
    wo_rb_price: f1_rb_price || 0,
    wo_total_price: f1_sub_total || 0,
    ```

### Proposed Change
Source these values directly from the `ui.f2` state (the Source of Truth) and apply `.toFixed(2)` to ensure string-safe precision for the template.
*   **Modify `getQuoteTemplateData` mapping**:
    ```javascript
    wo_rb_price: Number(ui.f2.disRbPrice || 0).toFixed(2),
    wo_acce_price: Number((ui.f2.acceSum || 0) + (ui.f2.eAcceSum || 0)).toFixed(2),
    wo_total_price: Number(ui.f2.grandTotal || 0).toFixed(2),
    ```

---
**Investigation Completed**
任務完成
