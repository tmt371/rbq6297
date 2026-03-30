/* FILE: 04-core-code/services/generators/work-order-strategy.js */
// [MODIFIED] (v6299 Phase 5) Injected configManager for height calculation.
// [MODIFIED] (v6299 Phase 5 Fix) Renamed method to generateRows and updated logic for manufacturing corrections.
// [MODIFIED] (v6299 Phase 6) Restored the Summary Row at the bottom of the table.
// [MODIFIED] (v6299 Phase 7) Refactored Summary Row to use CSS classes.
// [MODIFIED] (v6299 Phase 8 Fix) Implemented TYPE logic, split F-Name/F-Color, aligned columns with Excel.
// [MODIFIED] (v6299 Phase 8 Tweak) Updated TYPE labels to short codes (BO, SN, LF).
// [MODIFIED] (v6299 Phase 10 Tweak) Reduced 'off' font size in summary row.
// [MODIFIED] (v6297 Stage 9 Phase 3) Refactored to use DataPreparationService as Single Source of Truth.
// [MODIFIED] (Stage 9 Phase 3 - Constants) Replaced magic strings with LOGIC_CODES.

import { populateTemplate } from '../../utils/template-utils.js';
import { LOGIC_CODES } from '../../config/business-constants.js'; // [NEW]

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

        // --- Pre-process items to determine fabric text colors per TYPE ---
        const fabricCounts = { [LOGIC_CODES.BLOCKOUT]: {}, [LOGIC_CODES.SCREEN]: {}, [LOGIC_CODES.LIGHT_FILTER]: {} };
        const itemsArray = sortedItems || [];

        itemsArray.forEach(item => {
            const type = item.typeCode || '';
            const fabricStr = (item.fabricName || '').trim();
            const colorStr = (item.fabricColor || '').trim();
            const fabricKey = `${fabricStr} ${colorStr}`.trim(); // Combine F-name + F-color

            if (fabricCounts[type] && fabricKey) {
                fabricCounts[type][fabricKey] = (fabricCounts[type][fabricKey] || 0) + 1;
            }
        });

        const fabricColors = { [LOGIC_CODES.BLOCKOUT]: {}, [LOGIC_CODES.SCREEN]: {}, [LOGIC_CODES.LIGHT_FILTER]: {} };
        Object.keys(fabricColors).forEach(type => {
            // Sort fabrics by count descending
            const sortedFabrics = Object.keys(fabricCounts[type]).sort((a, b) => fabricCounts[type][b] - fabricCounts[type][a]);
            sortedFabrics.forEach((fabric, index) => {
                if (index === 0) fabricColors[type][fabric] = ''; // Default
                else if (index === 1) fabricColors[type][fabric] = '#FF0000'; // Red
                else fabricColors[type][fabric] = '#FFA500'; // Orange
            });
        });
        // ------------------------------------------------------------------

        // 3. Generate HTML Rows
        const rowsHtml = sortedItems.map((item, index) => {
            // Stats (using standardized properties from ExportItem)
            if (item.dual === 'Y') dualCount++;
            if (item.winder === 'Y') hdCount++;
            if (item.price) totalListPrice += item.price;

            // --- Styles Mapping ---
            let fabricClass = '';
            let rowStyle = '';
            if (item.isLf) {
                fabricClass = 'bg-light-filter';
                rowStyle = 'background-color: #FFE6E6;';
            } else if (item.typeCode === LOGIC_CODES.BLOCKOUT) { // [MODIFIED] Use constant
                fabricClass = 'bg-blockout';
                rowStyle = 'background-color: #F2F2F2;';
            } else if (item.typeCode === LOGIC_CODES.SCREEN) { // [MODIFIED] Use constant
                fabricClass = 'bg-screen';
                rowStyle = 'background-color: #E6F2FF;';
            }

            // --- Fabric Text Style ---
            let fabricTextStyle = '';
            const typeStr = item.typeCode || '';
            const fabricStr = (item.fabricName || '').trim();
            const colorStr = (item.fabricColor || '').trim();
            const fabricKey = `${fabricStr} ${colorStr}`.trim();
            if (fabricColors[typeStr] && fabricColors[typeStr][fabricKey]) {
                const textColor = fabricColors[typeStr][fabricKey];
                if (textColor) {
                    fabricTextStyle = `color: ${textColor}; font-weight: bold;`;
                }
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
                rowStyle: rowStyle,
                fabricTextStyle: fabricTextStyle,
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
                <td data-label="motor" class="text-center wo-text-red wo-text-small" style="color: #FF0000; font-weight: bold;">${discountPercentage}%<span style="font-size: 70%;">off</span></td>
                <td data-label="loc" class="text-center"></td>
                <td data-label="PRICE" class="text-right wo-text-red" style="color: #FF0000; font-weight: bold;">$${discountedTotal.toFixed(2)}</td>
            </tr>
        `;

        return rowsHtml + summaryRowHtml;
    }
}