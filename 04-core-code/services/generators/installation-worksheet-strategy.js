import { populateTemplate } from '../../utils/template-utils.js';

/**
 * Strategy for generating the Installation Worksheet.
 * Focuses on original sequence and strictly excludes pricing and coloring.
 */
export class InstallationWorksheetStrategy {
    constructor({ dataPreparationService } = {}) {
        this.dataPreparationService = dataPreparationService;
        this.templateDir = '04-core-code/ui/partials';
    }

    async generate(quoteData, currentProductKey, mainTemplate, rowTemplate, templateData = {}) {
        const product = quoteData.products[currentProductKey];
        
        // --- [NEW] Bulletproof Data Sourcing (Mirroring Work Order) ---
        // 1. Fetch cleaned & validated data from the preparation service
        const exportData = this.dataPreparationService.getExportData(quoteData, quoteData.uiMetadata);
        
        // 2. Take the validated items and sort them back to their natural sequence (Original Sequence)
        const validItems = [...exportData.items].sort((a, b) => a.originalIndex - b.originalIndex);

        // --- Initialize Counters ---
        let dualCount = 0;
        let chainCount = 0;
        let hdCount = 0;
        let motorCount = 0;

        let rowsHtml = validItems.map((item, index) => {
            // Stats (for accessories reference)
            if (item.dual === 'Y') dualCount++;
            if (item.chain) chainCount++;
            if (item.winder === 'Y') hdCount++;
            if (item.motor === 'Y') motorCount++;

            const rowNumber = index + 1;
            let rowClasses = '';
            if (rowNumber % 2 === 0) rowClasses += 'row-even ';
            if (rowNumber % 5 === 0) rowClasses += 'row-fifth ';

            const rowData = {
                rowNumber: rowNumber, // Normalized NO based on the final valid sequence
                rowClasses: rowClasses.trim(),
                location: item.location,
                type: item.typeCode, // BO, SN, LF
                fabric: item.fabricName,
                color: item.fabricColor,
                width: item.mWidth,
                height: item.mHeight,
                over: item.over,
                oi: item.oi,
                lr: item.lr,
                dual: item.dual,
                chain: item.chain,
                winder: item.winder,
                motor: item.motor
            };

            return populateTemplate(rowTemplate, rowData);
        }).join('');

        // [NEW] Append Summary Row (colspan="10" matching 14-column layout)
        const dualPairs = Math.floor(dualCount / 2);
        const summaryRowHtml = `
            <tr class="wo-summary-row">
                <td colspan="10" class="wo-summary-label">(Summary)</td>
                <td class="text-center">${dualPairs}</td>
                <td class="text-center">${chainCount}</td>
                <td class="text-center">${hdCount}</td>
                <td class="text-center">${motorCount}</td>
            </tr>
        `;
        rowsHtml += summaryRowHtml;

        // 3. Generate Accessories Summary (Installers need to know hardware counts)
        // [NEW] Map quantities from templateData for full accuracy
        const finalData = {
            quoteId: quoteData.quoteId || 'N/A',
            customerFullName: quoteData.customerInfo?.fullName || templateData.customerFullName || 'N/A',
            pdfFileName: `Install_${quoteData.quoteId}_${templateData.customerFullName || ''}.pdf`,
            installationWorksheetRows: rowsHtml,
            
            // Accessory counts (from templateData source of truth)
            bmotorQty: templateData.bmotorQty || 0,
            wmotorQty: templateData.wmotorQty || 0,
            remote1chQty: templateData.remote1chQty || 0,
            remote16chQty: templateData.remote16chQty || 0,
            chargerQty: templateData.chargerQty || 0,
            cord3mQty: templateData.cord3mQty || 0,
            wifiHubQty: templateData.wifiHubQty || 0,
            hdWinderQty: templateData.hdWinderQty || 0,
            dualComboQty: templateData.dualComboQty || 0,
            dualSlimQty: templateData.dualSlimQty || 0,
            bracketQty: templateData.bracketQty || 0,
            
            // [NEW] Brand strings mapping for worksheet
            motorBrand: templateData.motorBrand || '',
            remoteBrand: templateData.remoteBrand || '',
            wifiBrand: templateData.wifiBrand || ''
        };

        return populateTemplate(mainTemplate, finalData);
    }
}
