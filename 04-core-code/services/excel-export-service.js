/* FILE: 04-core-code/services/excel-export-service.js */
// [NEW] (v6299 Phase 1) New service to handle Excel (.xlsx) generation using ExcelJS.
// [MODIFIED] (v6299 Phase 2) Implemented 'work-sheet' generation with sorting and dimension correction logic.
// [MODIFIED] (v6299 Phase 3) Added visual styling and Side Panel cost summary.
// [FIX] (Phase 3 Fix) Passed 'ui' state to _generateWorkSheet to fix ReferenceError.
// [MODIFIED] (v6299 Phase 4 Fix) Updated Side Panel to 3 columns (P,Q,R) with full item breakdown.
// [MODIFIED] (v6299 Phase 4 Refinement) Added Color Legend and removed "Light-filter" prefix from F-Name.
// [MODIFIED] (v6299 Phase 4 Tweak 2) Added TYPE column, lighter pink, shifted Side Panel, removed Legend.
// [MODIFIED] (v6299 Print Optimization) Added pageSetup for A4 Landscape Fit-to-Width.
// [MODIFIED] (v6297 Stage 9 Phase 3) Refactored to use DataPreparationService as the Single Source of Truth.
// [MODIFIED] (Stage 9 Phase 4) Imported centralized REGEX to remove hardcoded regex.

import { REGEX } from '../config/regex.js'; // [NEW]

export class ExcelExportService {
    constructor({ configManager, calculationService, dataPreparationService }) {
        this.configManager = configManager;
        this.calculationService = calculationService;
        this.dataPreparationService = dataPreparationService; // [NEW] Injected Service
        console.log("ExcelExportService Initialized with ConfigManager, CalculationService, and DataPreparationService.");
    }

    /**
     * Main entry point to generate and download the Excel file.
     * @param {object} quoteData - The full quote data object.
     * @param {object} ui - The UI state for cost calculation.
     */
    async generateExcel(quoteData, ui) {
        if (!window.ExcelJS) {
            console.error("ExcelJS library not loaded.");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Ez Blinds Quote System';
        workbook.created = new Date();

        // Calculate Costs for Side Panel
        const f1Costs = this.calculationService.calculateF1Costs(quoteData, ui);
        const f2Summary = this.calculationService.calculateF2Summary(quoteData, ui);

        // [NEW] Prepare standardized data using the new service
        const uiMetadata = quoteData.uiMetadata || {};
        const exportData = this.dataPreparationService.getExportData(quoteData, uiMetadata);

        // 1. Create Work Sheet (Using Standardized Data)
        this._generateWorkSheet(workbook, exportData, f1Costs, f2Summary, ui, quoteData);

        // 2. Create Data Sheet (Raw Data - kept for backup reference)
        this._generateDataSheet(workbook, quoteData);

        // 3. Trigger Download
        const buffer = await workbook.xlsx.writeBuffer();
        this._triggerDownload(buffer, this._generateFileName(quoteData));
    }

    /**
     * Generates the 'work-sheet' for factory production.
     * [MODIFIED] Now uses pre-processed 'exportData' from DataPreparationService.
     */
    _generateWorkSheet(workbook, exportData, f1Costs, f2Summary, ui, quoteData) {
        const sheet = workbook.addWorksheet('work-sheet');

        // --- (Print Optimization) Set Print Area & Scale ---
        sheet.pageSetup = {
            paperSize: 9, // 9 = A4
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,  // Force width to 1 page
            fitToHeight: 0, // 0 = Automatic height
            showGridLines: true
        };
        sheet.pageMargins = {
            left: 0.25, right: 0.25,
            top: 0.4, bottom: 0.4,
            header: 0.3, footer: 0.3
        };

        // --- 1. Define Columns (A~P) ---
        const columns = [
            'NO', '#', 'TYPE', 'F-Name', 'F-Color', 'Width', 'Height',
            'Over', 'O/I', 'L/R', 'Dual', 'Chain', 'Winder', 'Motor',
            'Location', 'Price'
        ];
        const headerRow = sheet.addRow(columns);

        // Style Header Row
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' } // Light Grey Header
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // --- 2. Populate Rows using Standardized Export Items ---
        // [MODIFIED] Iterate over exportData.items which are already sorted and calculated
        exportData.items.forEach((item) => {

            // Determine Background Color based on Standardized Type Code or Flags
            let argbColor = null;
            if (item.isLf) {
                argbColor = 'FFFFE6E6'; // Lighter Pink
            } else if (item.typeCode === 'BO') {
                argbColor = 'FFE0E0E0'; // Light Grey
            } else if (item.typeCode === 'SN') {
                argbColor = 'FFE0FFFF'; // Light Cyan
            }

            const rowData = [
                item.displayIndex,    // NO
                item.originalIndex,   // #
                item.typeCode,        // TYPE (Normalized)
                item.fabricName,      // F-Name (Cleaned)
                item.fabricColor,     // F-Color
                item.mWidth,          // Manufacturing Width
                item.mHeight,         // Manufacturing Height
                item.over,
                item.oi,
                item.lr,
                item.dual,
                item.chain,
                item.winder,
                item.motor,
                item.location,
                item.price
            ];

            const row = sheet.addRow(rowData);

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                // Apply Borders
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                // Center align most columns
                // Name=4, Color=5, Location=15 are Left aligned
                if (colNumber !== 4 && colNumber !== 5 && colNumber !== 15) {
                    cell.alignment = { horizontal: 'center' };
                }

                // Apply Background Color
                if (argbColor) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: argbColor }
                    };
                }
            });
        });

        // --- 4. Side Panel Generation (Columns Q, R, S) ---
        // [NOTE] This logic remains largely unchanged as it depends on F1/F2 calc services,
        // which are separate from the Item Data Preparation.
        const qtys = f1Costs.qtys || {};

        // Acce Sum
        const acceSum = (f1Costs.winderCost || 0) + (f1Costs.dualComboCost || 0) + (f1Costs.slimCost || 0);

        // E-Acce Sum
        const eAcceSum =
            (f1Costs.bMotorCost || 0) +
            (f1Costs.wMotorCost || 0) +
            (f1Costs.remote1chCost || 0) +
            (f1Costs.remote16chCost || 0) +
            (f1Costs.chargerCost || 0) +
            (f1Costs.cordCost || 0) +
            (f1Costs.wifiCost || 0);

        // RB Price Logic
        const retailTotal = quoteData.products.rollerBlind.summary.totalSum || 0;
        const discount = (ui && ui.f1) ? (ui.f1.discountPercentage || 0) : 0;
        const rbPriceDiscounted = retailTotal * (1 - (discount / 100));

        const subTotal = f1Costs.componentTotal + rbPriceDiscounted;
        const gst = subTotal * 0.1;
        const total = subTotal + gst;

        // Define Side Panel Data Rows
        const sidePanelRows = [
            // Block A: Mechanical
            { label: 'HD Winder', qty: qtys.winder || 0, value: f1Costs.winderCost || 0 },
            { label: 'Dual Combo', qty: qtys.combo || 0, value: f1Costs.dualComboCost || 0 },
            { label: 'Dual Slim', qty: qtys.slim || 0, value: f1Costs.slimCost || 0 },
            { label: 'Acce Sum', qty: '', value: acceSum, isBold: true, bg: 'FFEFEFEF' },

            { label: '', qty: '', value: '' }, // Spacer

            // Block B: Motorization
            { label: 'B-Motor', qty: qtys.b_motor || 0, value: f1Costs.bMotorCost || 0 },
            { label: 'W-Motor', qty: qtys.w_motor || 0, value: f1Costs.wMotorCost || 0 },
            { label: 'Remote 1Ch', qty: qtys.remote1ch || 0, value: f1Costs.remote1chCost || 0 },
            { label: 'Remote 16Ch', qty: qtys.remote16ch || 0, value: f1Costs.remote16chCost || 0 },
            { label: 'Charger', qty: qtys.charger || 0, value: f1Costs.chargerCost || 0 },
            { label: '3M Cord', qty: qtys.cord || 0, value: f1Costs.cordCost || 0 },
            { label: 'Wifi Hub', qty: qtys.wifi || 0, value: f1Costs.wifiCost || 0 },
            { label: 'E-Acce Sum', qty: '', value: eAcceSum, isBold: true, bg: 'FFEFEFEF' },

            { label: '', qty: '', value: '' }, // Spacer

            // Block C: Roller Blind
            { label: 'RB Retail', qty: '', value: retailTotal },
            { label: 'Discount %', qty: `${discount}%`, value: '' },
            { label: 'RB Price', qty: '', value: rbPriceDiscounted, isBold: true, bg: 'FFEFEFEF' },

            { label: '', qty: '', value: '' }, // Spacer

            // Block D: Final Summary
            { label: 'SubTotal', qty: '', value: subTotal },
            { label: 'GST', qty: '10%', value: gst },
            { label: 'TOTAL', qty: '', value: total, isBold: true, bg: 'FFFFE0E0', color: 'FFDC143C' }
        ];

        // Render Side Panel
        const startRow = 2;
        const labelCol = 17; // Q
        const colQ = 18; // R
        const colR = 19; // S

        sheet.getColumn(labelCol).width = 18;
        sheet.getColumn(colQ).width = 10;
        sheet.getColumn(colR).width = 15;

        const headerP = sheet.getCell(1, labelCol);
        headerP.value = 'Item';
        headerP.font = { bold: true };
        headerP.border = { bottom: { style: 'thin' } };

        const headerQ = sheet.getCell(1, colQ);
        headerQ.value = 'Qty';
        headerQ.font = { bold: true };
        headerQ.alignment = { horizontal: 'center' };
        headerQ.border = { bottom: { style: 'thin' } };

        const headerR = sheet.getCell(1, colR);
        headerR.value = 'Amount';
        headerR.font = { bold: true };
        headerR.alignment = { horizontal: 'right' };
        headerR.border = { bottom: { style: 'thin' } };

        sidePanelRows.forEach((data, index) => {
            const currentRow = startRow + index;
            const row = sheet.getRow(currentRow);

            // Cell P: Label
            const cellP = row.getCell(labelCol);
            cellP.value = data.label;
            cellP.border = { left: { style: 'thin' } };
            if (data.isBold) cellP.font = { bold: true };

            // Cell Q: Quantity
            const cellQ = row.getCell(colQ);
            cellQ.value = data.qty;
            cellQ.alignment = { horizontal: 'center' };
            if (data.isBold) cellQ.font = { bold: true };

            // Cell R: Amount
            const cellR = row.getCell(colR);
            cellR.value = (data.value !== '' && data.value !== null) ? data.value : '';
            if (typeof data.value === 'number') {
                cellR.numFmt = '$#,##0.00';
            }
            cellR.border = { right: { style: 'thin' } };
            if (data.isBold) cellR.font = { bold: true };
            if (data.color) cellR.font = { bold: true, color: { argb: data.color } };

            if (data.bg) {
                const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: data.bg } };
                cellP.fill = fill;
                cellQ.fill = fill;
                cellR.fill = fill;
                const borderStyle = { style: 'thin' };
                cellP.border = { top: borderStyle, bottom: borderStyle, left: { style: 'thin' } };
                cellQ.border = { top: borderStyle, bottom: borderStyle };
                cellR.border = { top: borderStyle, bottom: borderStyle, right: { style: 'thin' } };
            }
        });
    }

    _generateDataSheet(workbook, quoteData) {
        const sheet = workbook.addWorksheet('data-sheet');

        const f3SnapshotKeys = [
            'quoteId', 'issueDate', 'dueDate',
            'customer.name', 'customer.address', 'customer.phone', 'customer.email', 'customer.postcode'
        ];
        const f1SnapshotKeys = [
            'winder_qty', 'motor_qty', 'charger_qty', 'cord_qty',
            'remote_1ch_qty', 'remote_16ch_qty', 'dual_combo_qty', 'dual_slim_qty',
            'discountPercentage', 'wifi_qty', 'w_motor_qty'
        ];
        const f2SnapshotKeys = [
            'wifiQty', 'deliveryQty', 'installQty', 'removalQty', 'mulTimes', 'discount',
            'wifiSum', 'deliveryFee', 'installFee', 'removalFee',
            'deliveryFeeExcluded', 'installFeeExcluded', 'removalFeeExcluded',
            'acceSum', 'eAcceSum', 'surchargeFee', 'totalSumForRbTime', 'firstRbPrice',
            'disRbPrice', 'singleprofit', 'rbProfit', 'gst', 'netProfit',
            'deposit', 'balance', 'newOffer', 'f2_17_pre_sum', 'sumPrice',
            'grandTotal', 'gstExcluded', 'taxExclusiveTotal'
        ];

        const projectHeaders = [...f3SnapshotKeys, ...f1SnapshotKeys, ...f2SnapshotKeys];
        sheet.addRow(projectHeaders);

        const f1Snapshot = quoteData.f1Snapshot || {};
        const f2Snapshot = quoteData.f2Snapshot || {};

        const getNestedValue = (obj, path) => {
            try {
                return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : '', obj);
            } catch (e) {
                return '';
            }
        };

        const projectValues = [
            quoteData.quoteId || '',
            quoteData.issueDate || '',
            quoteData.dueDate || '',
            getNestedValue(quoteData, 'customer.name'),
            getNestedValue(quoteData, 'customer.address'),
            getNestedValue(quoteData, 'customer.phone'),
            getNestedValue(quoteData, 'customer.email'),
            getNestedValue(quoteData, 'customer.postcode'),
            ...f1SnapshotKeys.map(key => (f1Snapshot[key] !== undefined && f1Snapshot[key] !== null) ? f1Snapshot[key] : ''),
            ...f2SnapshotKeys.map(key => (f2Snapshot[key] !== undefined && f2Snapshot[key] !== null) ? f2Snapshot[key] : '')
        ].map(val => this._sanitize(val));

        sheet.addRow(projectValues);
        sheet.addRow([]);

        const itemHeaders = [
            '#', 'Width', 'Height', 'Type', 'Price',
            'Location', 'F-Name', 'F-Color', 'Over', 'O/I', 'L/R',
            'Dual', 'Chain', 'Winder', 'Motor', 'IsLF'
        ];
        sheet.addRow(itemHeaders);

        const currentProductKey = quoteData.currentProduct;
        const productData = quoteData.products[currentProductKey];
        const lfModifiedRowIndexes = quoteData.uiMetadata?.lfModifiedRowIndexes || [];

        if (productData && productData.items) {
            productData.items.forEach((item, index) => {
                if (item.width || item.height) {
                    const rowData = [
                        index + 1,
                        item.width || '',
                        item.height || '',
                        item.fabricType || '',
                        item.linePrice !== null ? item.linePrice : '',
                        item.location || '',
                        item.fabric || '',
                        item.color || '',
                        item.over || '',
                        item.oi || '',
                        item.lr || '',
                        item.dual || '',
                        item.chain || '',
                        item.winder || '',
                        item.motor || '',
                        lfModifiedRowIndexes.includes(index) ? 1 : 0
                    ];
                    const sanitizedRow = rowData.map(val => typeof val === 'string' ? this._sanitize(val) : val);
                    sheet.addRow(sanitizedRow);
                }
            });
        }
    }

    /**
     * [MODIFIED] Use centralized Regex for sanitation.
     */
    _sanitize(value) {
        if (typeof value !== 'string') return value;
        // [MODIFIED] Use the imported REGEX constant
        return value.replace(REGEX.INVISIBLE_CHAR, '');
    }

    _generateFileName(quoteData) {
        const quoteId = quoteData?.quoteId;
        let timestamp;

        if (quoteId && quoteId.startsWith('RB')) {
            timestamp = quoteId.substring(2);
        } else {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            timestamp = `${yyyy}${mm}${dd}${hh}${min}`;
        }

        const customerName = quoteData?.customer?.name || 'customer';
        const customerPhone = quoteData?.customer?.phone || '';
        const safeName = customerName.replace(/[\s/\\?%*:|"<>]/g, '_') || 'customer';
        const safePhone = customerPhone.replace(/[\s/\\?%*:|"<>]/g, '_');

        let parts = ['worksheet', safeName];
        if (safePhone) {
            parts.push(safePhone);
        }
        parts.push(timestamp);

        return `${parts.join('-')}.xlsx`;
    }

    _triggerDownload(buffer, fileName) {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
