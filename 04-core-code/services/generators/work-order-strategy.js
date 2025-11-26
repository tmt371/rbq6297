/* FILE: 04-core-code/services/generators/work-order-strategy.js */

import { populateTemplate } from '../../utils/template-utils.js';
import { LOGIC_CODES } from '../../config/business-constants.js';

export class WorkOrderStrategy {
    constructor({ configManager, dataPreparationService } = {}) {
        this.configManager = configManager;
        this.dataPreparationService = dataPreparationService;
    }

    /**
     * Generates the table rows for the Work Order HTML.
     */
    generateRows(quoteData, ui, rowTemplate) {
        const uiMetadata = quoteData.uiMetadata || {};
        const exportData = this.dataPreparationService.getExportData(quoteData, uiMetadata);
        const sortedItems = exportData.items;

        // --- Initialize Counters ---
        let dualCount = 0;
        let hdCount = 0;
        let totalListPrice = 0;

        // --- Generate HTML Rows ---
        const rowsHtml = sortedItems.map((item, index) => {
            // Stats (using standardized properties from ExportItem)
            if (item.dual === 'Y') dualCount++;
            if (item.winder === 'Y') hdCount++;
            if (item.price) totalListPrice += item.price;

            // --- Styles Mapping ---
            let fabricClass = '';
            if (item.isLf) {
                fabricClass = 'bg-light-filter';
            } else if (item.typeCode === LOGIC_CODES.BLOCKOUT) {
                fabricClass = 'bg-blockout';
            } else if (item.typeCode === LOGIC_CODES.SCREEN) {
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
                winder: item.winder,  // 'Y' or ''
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
}