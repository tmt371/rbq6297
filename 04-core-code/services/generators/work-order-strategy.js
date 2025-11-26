/* FILE: 04-core-code/services/generators/work-order-strategy.js */
// [MODIFIED] (v6299 Phase 5) Injected configManager for height calculation.
// [MODIFIED] (v6299 Phase 5 Fix) Renamed method to generateRows and updated logic for manufacturing corrections.
// [MODIFIED] (v6299 Phase 6) Restored the Summary Row at the bottom of the table.
// [MODIFIED] (v6299 Phase 7) Refactored Summary Row to use CSS classes.
// [MODIFIED] (v6299 Phase 8 Fix) Implemented TYPE logic, split F-Name/F-Color, aligned columns with Excel.
// [MODIFIED] (v6299 Phase 8 Tweak) Updated TYPE labels to short codes (BO, SN, LF).
// [MODIFIED] (v6299 Phase 10 Tweak) Reduced 'off' font size in summary row.
// [MODIFIED] (v6297 Stage 9 Phase 3) Refactored to use DataPreparationService as Single Source of Truth.

import { populateTemplate } from '../../utils/template-utils.js';

export class WorkOrderStrategy {
    constructor({ configManager, dataPreparationService } = {}) {
        this.configManager = configManager;
        this.dataPreparationService = dataPreparationService; // [NEW] Injected Service
    }

    /**
     * Generates the table rows for the Work Order HTML.
     */
    generateRows(quoteData, ui, rowTemplate) {
        // [NEW] Use DataPreparationService to get standardized, sorted, and calculated data
        const uiMetadata = quoteData.uiMetadata || {};
        const exportData = this.dataPreparationService.getExportData(quoteData, uiMetadata);
        const sortedItems = exportData.items;

        // --- Initialize Counters ---
        let dualCount = 0;
        let hdCount = 0;
        let totalListPrice = 0;

        // 3. Generate HTML Rows
        const rowsHtml = sortedItems.map((item, index) => {
            // Stats (using standardized properties from ExportItem)
            if (item.dual === 'Y') dualCount++;
            if (item.winder === 'Y') hdCount++; // ExportItem normalizes 'HD' to 'Y' or specific code if changed
            if (item.price) totalListPrice += item.price;

            // --- Styles Mapping ---
            let fabricClass = '';
            if (item.isLf) {
                fabricClass = 'bg-light-filter';
            } else if (item.typeCode === 'BO') {
                fabricClass = 'bg-blockout';
            } else if (item.typeCode === 'SN') {
                fabricClass = 'bg-screen';
            }

            const rowData = {
                rowNumber: item.displayIndex,
                index: item.originalIndex,
                type: item.typeCode, // BO, SN, LF
                fabric: item.fabricName,
                color: item.fabricColor,
                width: item.mWidth,   // Use manufacturing width
                height: item.mHeight, // Use manufacturing height
                over: item.over,
                oi: item.oi,
                lr: item.lr,
                dual: item.dual,      // 'Y' or ''
                chain: item.chain,
                winder: item.winder,  // 'Y' or '' (Standardized)
                motor: item.motor,    // 'Y' or ''
                location: item.location,
                price: item.formattedPrice,

                // Styles
                fabricClass: fabricClass,
                isEmptyClassDual: item.dual ? '' : 'is-empty-cell',
                isEmptyClassHD: item.winder ? '' : 'is-empty-cell',
                isEmptyClassMotor: item.motor ? '' : 'is-empty-cell'
            };

            return populateTemplate(rowTemplate, rowData);
        }).join('');

        // --- Generate Summary Row ---
        const dualPairs = Math.floor(dualCount / 2);
        const discountPercentage = ui.f1?.discountPercentage || 0;
        const discountedTotal = totalListPrice * (1 - (discountPercentage / 100));

        const summaryRowHtml = `
            <tr class="wo-summary-row">
                <td data-label="NO" class="wo-summary-label" colspan="10">(Summary)</td>
                <td data-label="dual" class="text-center">${dualPairs}</td>
                <td data-label="chain" class="text-center"></td>
                <td data-label="HD" class="text-center">${hdCount}</td>
                <td data-label="motor" class="text-center wo-text-red wo-text-small">${discountPercentage}%<span style="font-size: 70%;">off</span></td>
                <td data-label="loc" class="text-center"></td>
                <td data-label="PRICE" class="text-right wo-text-red">$${discountedTotal.toFixed(2)}</td>
            </tr>
        `;

        return rowsHtml + summaryRowHtml;
    }

    // [REMOVED] _calculateManufacturingDimensions logic is now handled by DataPreparationService
    // [REMOVED] _sortItems logic is now handled by DataPreparationService
    // [REMOVED] _getRowClass logic is now integrated into generateRows
}