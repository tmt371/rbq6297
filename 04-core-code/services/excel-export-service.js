/* FILE: 04-core-code/services/excel-export-service.js */
// [NEW] (v6299 Phase 1) New service to handle Excel (.xlsx) generation using ExcelJS.
// [MODIFIED] (v6299 Phase 2) Implemented 'work-sheet' generation with sorting and dimension correction logic.
// [MODIFIED] (v6299 Phase 3) Added visual styling and Side Panel cost summary.
// [FIX] (Phase 3 Fix) Passed 'ui' state to _generateWorkSheet to fix ReferenceError.

export class ExcelExportService {
    constructor({ configManager, calculationService }) {
        this.configManager = configManager;
        this.calculationService = calculationService;
        console.log("ExcelExportService Initialized with ConfigManager and CalculationService.");
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

        // 1. Create Work Sheet (Calculated Data + Styles)
        // [FIX] Pass 'ui' to _generateWorkSheet
        this._generateWorkSheet(workbook, quoteData, f1Costs, f2Summary, ui);

        // 2. Create Data Sheet (Raw Data)
        this._generateDataSheet(workbook, quoteData);

        // 3. Trigger Download
        const buffer = await workbook.xlsx.writeBuffer();
        this._triggerDownload(buffer, this._generateFileName(quoteData));
    }

    /**
     * Generates the 'work-sheet' for factory production.
     * Applies sorting, dimension corrections, STYLES, and SIDE PANEL.
     * [FIX] Added 'ui' parameter.
     */
    _generateWorkSheet(workbook, quoteData, f1Costs, f2Summary, ui) {
        const sheet = workbook.addWorksheet('work-sheet');

        // --- 1. Define Columns (A~O) ---
        const columns = [
            'NO', '#', 'F-Name', 'F-Color', 'Width', 'Height',
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

        // --- 2. Prepare & Sort Items ---
        const rawItems = quoteData.products[quoteData.currentProduct].items;
        const lfModifiedRowIndexes = quoteData.uiMetadata?.lfModifiedRowIndexes || [];

        const processableItems = rawItems
            .map((item, index) => ({ ...item, originalIndex: index + 1 }))
            .filter(item => item.width && item.height);

        const sortedItems = this._sortItemsForWorkOrder(processableItems, lfModifiedRowIndexes);

        // --- 3. Populate Rows with Corrections & Styles ---
        sortedItems.forEach((item, newIndex) => {
            const originalIndex = item.originalIndex - 1;
            const isLF = lfModifiedRowIndexes.includes(originalIndex);
            const fabricType = item.fabricType || '';

            const { correctedWidth, correctedHeight } = this._calculateProductionDimensions(item);

            const rowData = [
                newIndex + 1,
                item.originalIndex,
                this._sanitize(item.fabric),
                this._sanitize(item.color),
                correctedWidth,
                correctedHeight,
                this._sanitize(item.over),
                this._sanitize(item.oi),
                this._sanitize(item.lr),
                this._sanitize(item.dual),
                item.chain,
                this._sanitize(item.winder),
                this._sanitize(item.motor),
                this._sanitize(item.location),
                item.linePrice
            ];

            const row = sheet.addRow(rowData);

            // Apply Row Styling
            let argbColor = null;
            if (isLF) {
                argbColor = 'FFFFC0CB'; // Pink for LF
            } else if (fabricType.startsWith('B')) {
                argbColor = 'FFE0E0E0'; // Light Grey for Blockout
            } else if (fabricType === 'SN') {
                argbColor = 'FFE0FFFF'; // Light Cyan/Blue for Screen
            }

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                // Apply Borders
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                // Center align most columns
                if (colNumber !== 3 && colNumber !== 4 && colNumber !== 14) { // Align Text Left for Name, Color, Location
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

        // --- 4. Side Panel Generation (Columns P, Q) ---

        // Acce Sum = Winder + Dual + Slim (Component costs from F1)
        const acceSum = (f1Costs.winderCost || 0) + (f1Costs.dualComboCost || 0) + (f1Costs.slimCost || 0);

        // E-Acce Sum = Motor + W-Motor + Remotes + Charger + Cord + Wifi
        const eAcceSum =
            (f1Costs.bMotorCost || 0) +
            (f1Costs.wMotorCost || 0) +
            (f1Costs.remote1chCost || 0) +
            (f1Costs.remote16chCost || 0) +
            (f1Costs.chargerCost || 0) +
            (f1Costs.cordCost || 0) +
            (f1Costs.wifiCost || 0);

        // RB Price (Discounted)
        // [FIX] Now we can safely access 'ui'
        const retailTotal = quoteData.products.rollerBlind.summary.totalSum || 0;
        const discount = (ui && ui.f1) ? (ui.f1.discountPercentage || 0) : 0;
        const rbPriceDiscounted = retailTotal * (1 - (discount / 100));

        // Use calculated totals (prefer f1Costs component total + rbPrice)
        const subTotal = f1Costs.componentTotal + rbPriceDiscounted;
        const gst = subTotal * 0.1;
        const total = subTotal + gst;

        // Define Side Panel Data
        const sidePanelData = [
            { label: 'Acce Sum', value: acceSum },
            { label: 'E-Acce Sum', value: eAcceSum },
            { label: 'RB Price (Disc)', value: rbPriceDiscounted },
            { label: 'SubTotal', value: subTotal },
            { label: 'GST', value: gst },
            { label: 'TOTAL', value: total }
        ];

        // Render Side Panel starting at Row 2, Column P (16)
        const startRow = 2;
        const labelCol = 16; // P
        const valueCol = 17; // Q

        // Set Column Widths
        sheet.getColumn(labelCol).width = 15;
        sheet.getColumn(valueCol).width = 12;

        sidePanelData.forEach((data, index) => {
            const currentRow = startRow + index;
            const row = sheet.getRow(currentRow);

            const labelCell = row.getCell(labelCol);
            labelCell.value = data.label;
            labelCell.font = { bold: true };
            labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            const valueCell = row.getCell(valueCol);
            valueCell.value = data.value;
            valueCell.numFmt = '$#,##0.00';
            valueCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            // Highlight TOTAL
            if (data.label === 'TOTAL') {
                labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } }; // Light Red
                valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } };
                valueCell.font = { bold: true, color: { argb: 'FFDC143C' } };
            }
        });
    }

    /**
     * Logic for sorting items based on Type and Quantity.
     * Priority: B-Series > SN > LF. Inside groups: Quantity Descending.
     */
    _sortItemsForWorkOrder(items, lfIndexes) {
        const typeCounts = {};
        items.forEach(item => {
            const type = item.fabricType || 'Unknown';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        const getCategory = (item) => {
            const originalIndex = item.originalIndex - 1;
            if (lfIndexes.includes(originalIndex)) return 3; // LF Last
            const type = item.fabricType || '';
            if (type.startsWith('B')) return 1; // Blockout First
            if (type === 'SN') return 2; // Screen Second
            return 4; // Others
        };

        return items.sort((a, b) => {
            const catA = getCategory(a);
            const catB = getCategory(b);
            if (catA !== catB) return catA - catB;

            const countA = typeCounts[a.fabricType] || 0;
            const countB = typeCounts[b.fabricType] || 0;
            if (countA !== countB) return countB - countA;

            if (a.fabricType !== b.fabricType) {
                return (a.fabricType || '').localeCompare(b.fabricType || '');
            }
            return a.originalIndex - b.originalIndex;
        });
    }

    /**
     * Calculates production dimensions based on rules.
     */
    _calculateProductionDimensions(item) {
        let width = item.width;
        if (item.oi === 'IN') {
            width = width - 4;
        } else if (item.oi === 'OUT') {
            width = width - 2;
        }

        let height = item.height;
        const matrix = this.configManager.getPriceMatrix(item.fabricType);
        if (matrix && matrix.drops) {
            const nextDrop = matrix.drops.find(d => d > item.height);
            if (nextDrop) {
                height = nextDrop - 5;
            } else {
                console.warn(`No larger drop found for height ${item.height}.`);
            }
        }
        return { correctedWidth: width, correctedHeight: height };
    }

    /**
     * Generates the 'data-sheet' containing raw data.
     */
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

    _sanitize(value) {
        if (typeof value !== 'string') return value;
        return value.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');
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