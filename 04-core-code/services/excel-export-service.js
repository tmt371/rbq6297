/* FILE: 04-core-code/services/excel-export-service.js */
// [NEW] (v6299 Phase 1) New service to handle Excel (.xlsx) generation using ExcelJS.
// Currently implements 'data-sheet' generation which mirrors the CSV export format.

export class ExcelExportService {
    constructor() {
        console.log("ExcelExportService Initialized.");
    }

    /**
     * Main entry point to generate and download the Excel file.
     * @param {object} quoteData - The full quote data object.
     */
    async generateExcel(quoteData) {
        if (!window.ExcelJS) {
            console.error("ExcelJS library not loaded.");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Ez Blinds Quote System';
        workbook.created = new Date();

        // 1. Create Data Sheet (Raw Data)
        this._generateDataSheet(workbook, quoteData);

        // 2. Create Work Sheet (To be implemented in Phase 2)
        // this._generateWorkSheet(workbook, quoteData); 

        // 3. Trigger Download
        const buffer = await workbook.xlsx.writeBuffer();
        this._triggerDownload(buffer, this._generateFileName(quoteData));
    }

    /**
     * Generates the 'data-sheet' containing raw data, identical to the CSV structure.
     */
    _generateDataSheet(workbook, quoteData) {
        const sheet = workbook.addWorksheet('data-sheet');

        // Define Snapshot Keys (Must match csv-parser.js)
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

        // --- Row 1: Project Headers ---
        const projectHeaders = [...f3SnapshotKeys, ...f1SnapshotKeys, ...f2SnapshotKeys];
        sheet.addRow(projectHeaders);

        // --- Row 2: Project Values ---
        const f1Snapshot = quoteData.f1Snapshot || {};
        const f2Snapshot = quoteData.f2Snapshot || {};

        // Helper to safely get nested properties (e.g., 'customer.name')
        const getNestedValue = (obj, path) => {
            try {
                return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : '', obj);
            } catch (e) {
                return '';
            }
        };

        const projectValues = [
            // F3 Values
            quoteData.quoteId || '',
            quoteData.issueDate || '',
            quoteData.dueDate || '',
            getNestedValue(quoteData, 'customer.name'),
            getNestedValue(quoteData, 'customer.address'),
            getNestedValue(quoteData, 'customer.phone'),
            getNestedValue(quoteData, 'customer.email'),
            getNestedValue(quoteData, 'customer.postcode'),
            // F1 Values
            ...f1SnapshotKeys.map(key => (f1Snapshot[key] !== undefined && f1Snapshot[key] !== null) ? f1Snapshot[key] : ''),
            // F2 Values
            ...f2SnapshotKeys.map(key => (f2Snapshot[key] !== undefined && f2Snapshot[key] !== null) ? f2Snapshot[key] : '')
        ].map(this._sanitize); // Apply sanitation

        sheet.addRow(projectValues);

        // --- Row 3: Blank (Spacer) ---
        sheet.addRow([]);

        // --- Row 4: Item Headers ---
        const itemHeaders = [
            '#', 'Width', 'Height', 'Type', 'Price',
            'Location', 'F-Name', 'F-Color', 'Over', 'O/I', 'L/R',
            'Dual', 'Chain', 'Winder', 'Motor', 'IsLF'
        ];
        sheet.addRow(itemHeaders);

        // --- Row 5+: Item Data ---
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
                        item.linePrice !== null ? item.linePrice : '', // ExcelJS handles numbers better than CSV strings
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
                    // Apply sanitation to string fields, keep numbers as numbers
                    const sanitizedRow = rowData.map(val => typeof val === 'string' ? this._sanitize(val) : val);
                    sheet.addRow(sanitizedRow);
                }
            });
        }
    }

    /**
     * Removes invisible Unicode characters that break Excel/CSV parsing.
     * Same logic as in csv-parser.js fix.
     */
    _sanitize(value) {
        if (typeof value !== 'string') return value;
        // Remove U+200B(Zero Width Space), U+202A-U+202E(BiDi controls), U+FEFF(BOM), etc.
        // eslint-disable-next-line no-control-regex
        return value.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');
    }

    _generateFileName(quoteData) {
        // Replicate the file naming logic from FileService
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

        let parts = ['worksheet', safeName]; // [MODIFIED] Prefix is 'worksheet'
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