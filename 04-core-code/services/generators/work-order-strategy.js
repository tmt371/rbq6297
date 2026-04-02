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

        // --- [PHASE II.6a] Text Style Sequencer ---
        // 1. Identify unique fabric combinations within each type in the order they appear 
        // (Items are already sorted by Frequency > Name > Index)
        const typeSequences = {}; // { TYPE: [uniqueKeys] }
        sortedItems.forEach(item => {
            const type = item.typeCode || 'UNKNOWN';
            const key = `${(item.fabricName || '').trim()} ${(item.fabricColor || '').trim()}`.trim();
            if (!typeSequences[type]) typeSequences[type] = [];
            if (!typeSequences[type].includes(key)) {
                typeSequences[type].push(key);
            }
        });

        const styleSequence = [
            '', // 1st: Black (Default)
            'color: #ff0000;', // 2nd: Red
            'color: #0000ff;', // 3rd: Blue
            'font-weight: bold;', // 4th: Bold Black
            'color: #ff0000; font-weight: bold;', // 5th: Bold Red
            'color: #0000ff; font-weight: bold;'  // 6th: Bold Blue
        ];
        // ------------------------------------------------------------------

        // 3. Generate HTML Rows
        const rowsHtml = sortedItems.map((item, index) => {
            // Stats
            if (item.dual === 'Y') dualCount++;
            if (item.winder === 'Y') hdCount++;
            if (item.price) totalListPrice += item.price;

            // --- Styles Mapping ---
            let fabricClass = '';
            let fabricBgStyle = ''; // [PHASE II.6a] Renamed to reflect its specific role
            if (item.isLf) {
                fabricClass = 'bg-light-filter';
                fabricBgStyle = 'background-color: #FFEBEB;'; // Updated pink
            } else if (item.typeCode === LOGIC_CODES.BLOCKOUT) {
                fabricClass = 'bg-blockout';
                fabricBgStyle = 'background-color: #F2F2F2;';
            } else if (item.typeCode === LOGIC_CODES.SCREEN) {
                fabricClass = 'bg-screen';
                fabricBgStyle = 'background-color: #E0F7FA;'; // Updated light blue
            }

            // --- Fabric Text Style (Sequencer) ---
            let fabricTextStyle = '';
            const typeStr = item.typeCode || '';
            const fabricKey = `${(item.fabricName || '').trim()} ${(item.fabricColor || '').trim()}`.trim();
            if (typeSequences[typeStr]) {
                const seqIdx = typeSequences[typeStr].indexOf(fabricKey);
                if (seqIdx !== -1) {
                    fabricTextStyle = styleSequence[seqIdx % styleSequence.length];
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
                fabricBgStyle: fabricBgStyle, // [PHASE II.6a]
                fabricTextStyle: fabricTextStyle,
                isEmptyClassDual: item.dual ? '' : 'is-empty-cell',
                isEmptyClassHD: item.winder ? '' : 'is-empty-cell',
                isEmptyClassMotor: item.motor ? '' : 'is-empty-cell'
            };

            return populateTemplate(rowTemplate, rowData);
        }).join('');

        // --- [PHASE II.6a] Generate Summary Row (Aligned with 16-column layout) ---
        const dualPairs = Math.floor(dualCount / 2);
        const discountPercentage = ui.f1?.discountPercentage || 0;
        const discountedTotal = totalListPrice * (1 - (discountPercentage / 100));

        const summaryRowHtml = `
            <tr class="wo-summary-row">
                <td data-label="NO" class="wo-summary-label" colspan="9">(Summary)</td>
                <td data-label="dual" class="text-center">${dualPairs}</td>
                <td data-label="chain" class="text-center"></td>
                <td data-label="HD" class="text-center">${hdCount}</td>
                <td data-label="motor" class="text-center wo-text-red wo-text-small" style="color: #FF0000; font-weight: bold;">${discountPercentage}%<span style="font-size: 70%;">off</span></td>
                <td data-label="Location" class="text-center"></td>
                <td data-label="#" class="text-center"></td>
                <td data-label="PRICE" class="text-right wo-text-red" style="color: #FF0000; font-weight: bold;">$${discountedTotal.toFixed(2)}</td>
            </tr>
        `;

        return rowsHtml + summaryRowHtml;
    }
}