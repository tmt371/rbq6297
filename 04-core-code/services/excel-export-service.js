/* FILE: 04-core-code/services/excel-export-service.js */
// [NEW] (v6299 Phase 1) New service to handle Excel (.xlsx) generation using ExcelJS.
// [MODIFIED] (v6299 Phase 2) Implemented 'work-sheet' generation with sorting and dimension correction logic.

export class ExcelExportService {
    constructor({ configManager }) {
        this.configManager = configManager;
        console.log("ExcelExportService Initialized with ConfigManager.");
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

        // 1. Create Work Sheet (Calculated Data) - [NEW] Phase 2
        this._generateWorkSheet(workbook, quoteData);

        // 2. Create Data Sheet (Raw Data)
        this._generateDataSheet(workbook, quoteData);

        // 3. Trigger Download
        const buffer = await workbook.xlsx.writeBuffer();
        this._triggerDownload(buffer, this._generateFileName(quoteData));
    }

    /**
     * [NEW] (Phase 2) Generates the 'work-sheet' for factory production.
     * Applies sorting rules and dimension corrections.
     */
    _generateWorkSheet(workbook, quoteData) {
        const sheet = workbook.addWorksheet('work-sheet');

        // --- 1. Define Columns (A~O) ---
        const columns = [
            'NO', '#', 'F-Name', 'F-Color', 'Width', 'Height',
            'Over', 'O/I', 'L/R', 'Dual', 'Chain', 'Winder', 'Motor',
            'Location', 'Price'
        ];
        sheet.addRow(columns);

        // --- 2. Prepare & Sort Items ---
        const rawItems = quoteData.products[quoteData.currentProduct].items;
        const lfModifiedRowIndexes = quoteData.uiMetadata?.lfModifiedRowIndexes || [];

        // Map to internal structure for sorting
        const processableItems = rawItems
            .map((item, index) => ({ ...item, originalIndex: index + 1 })) // Keep original sequence #
            .filter(item => item.width && item.height); // Filter empty rows

        // Apply Sorting Logic
        const sortedItems = this._sortItemsForWorkOrder(processableItems, lfModifiedRowIndexes);

        // --- 3. Populate Rows with Corrections ---
        sortedItems.forEach((item, newIndex) => {
            const originalIndex = item.originalIndex - 1; // Back to 0-based for checks
            const isLF = lfModifiedRowIndexes.includes(originalIndex);

            // Calculate Corrected Dimensions
            const { correctedWidth, correctedHeight } = this._calculateProductionDimensions(item);

            const rowData = [
                newIndex + 1,                  // NO (New Sequence)
                item.originalIndex,            // # (Original Sequence)
                this._sanitize(item.fabric),   // F-Name
                this._sanitize(item.color),    // F-Color
                correctedWidth,                // Width (Corrected)
                correctedHeight,               // Height (Corrected)
                this._sanitize(item.over),     // Over
                this._sanitize(item.oi),       // O/I
                this._sanitize(item.lr),       // L/R
                this._sanitize(item.dual),     // Dual
                item.chain,                    // Chain
                this._sanitize(item.winder),   // Winder
                this._sanitize(item.motor),    // Motor
                this._sanitize(item.location), // Location
                item.linePrice                 // Price
            ];

            sheet.addRow(rowData);
        });
    }

    /**
     * [NEW] (Phase 2) Logic for sorting items based on Type and Quantity.
     * Priority: B-Series > SN > LF. Inside groups: Quantity Descending.
     */
    _sortItemsForWorkOrder(items, lfIndexes) {
        // 1. Calculate Frequencies for Secondary Sorting
        const typeCounts = {};
        items.forEach(item => {
            const type = item.fabricType || 'Unknown';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        // 2. Define Sort Category Helper
        const getCategory = (item) => {
            const originalIndex = item.originalIndex - 1;
            // Priority 3 (Last): Light Filter (LF)
            if (lfIndexes.includes(originalIndex)) return 3;

            const type = item.fabricType || '';
            // Priority 1: Blockout (B-Series)
            if (type.startsWith('B')) return 1;
            // Priority 2: Screen (SN)
            if (type === 'SN') return 2;

            // Others
            return 4;
        };

        // 3. Execute Sort
        return items.sort((a, b) => {
            const catA = getCategory(a);
            const catB = getCategory(b);

            // Primary: Category (Ascending)
            if (catA !== catB) return catA - catB;

            // Secondary: Quantity of that Fabric Type (Descending)
            const countA = typeCounts[a.fabricType] || 0;
            const countB = typeCounts[b.fabricType] || 0;
            if (countA !== countB) return countB - countA;

            // Tertiary: Group by Fabric Type Name (to keep B1s together, B2s together)
            if (a.fabricType !== b.fabricType) {
                return (a.fabricType || '').localeCompare(b.fabricType || '');
            }

            // Quaternary: Original Sequence (to maintain stability)
            return a.originalIndex - b.originalIndex;
        });
    }

    /**
     * [NEW] (Phase 2) Calculates production dimensions based on rules.
     * Width: IN (-4), OUT (-2)
     * Height: Next Drop - 5
     */
    _calculateProductionDimensions(item) {
        // --- Width Correction ---
        let width = item.width;
        if (item.oi === 'IN') {
            width = width - 4;
        } else if (item.oi === 'OUT') {
            width = width - 2;
        }

        // --- Height Correction ---
        let height = item.height;
        const matrix = this.configManager.getPriceMatrix(item.fabricType);
        if (matrix && matrix.drops) {
            // Rule: Find the drop closest to X but LARGER than X.
            // Then: Corrected Height = Drop - 5.
            // Example: 2655 -> Next is 2700 -> 2695.
            const nextDrop = matrix.drops.find(d => d > item.height);

            if (nextDrop) {
                height = nextDrop - 5;
            } else {
                // Fallback: If height exceeds all drops (edge case),
                // use the raw height or handle as error? 
                // For now, we assume the input was valid against the matrix max.
                // We will keep raw height to avoid producing 0 or NaN.
                console.warn(`No larger drop found for height ${item.height} in type ${item.fabricType}. Keeping raw height.`);
            }
        }

        return { correctedWidth: width, correctedHeight: height };
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
        ].map(val => this._sanitize(val)); // Apply sanitation

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