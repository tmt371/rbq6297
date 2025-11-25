/* FILE: 04-core-code/services/generators/work-order-strategy.js */
// [MODIFIED] (v6299 Phase 5) Injected configManager for height calculation.
// [MODIFIED] (v6299 Phase 5 Fix) Renamed method to generateRows and updated logic for manufacturing corrections.
// [MODIFIED] (v6299 Phase 6) Restored the Summary Row at the bottom of the table.
// [MODIFIED] (v6299 Phase 7) Refactored Summary Row to use CSS classes.
// [MODIFIED] (v6299 Phase 8 Fix) Implemented TYPE logic, split F-Name/F-Color, aligned columns with Excel.
// [MODIFIED] (v6299 Phase 8 Tweak) Updated TYPE labels to short codes (BO, SN, LF).
// [MODIFIED] (v6299 Phase 10 Tweak) Reduced 'off' font size in summary row.

import { populateTemplate } from '../../utils/template-utils.js';

export class WorkOrderStrategy {
    constructor({ configManager } = {}) {
        this.configManager = configManager;
    }

    /**
     * Generates the table rows for the Work Order HTML.
     */
    generateRows(quoteData, ui, rowTemplate) {
        const currentProductKey = quoteData.currentProduct;
        const rawItems = quoteData.products[currentProductKey].items;
        const lfModifiedRowIndexes = quoteData.uiMetadata?.lfModifiedRowIndexes || [];

        // 1. Prepare Items
        const itemsWithIndex = rawItems
            .map((item, index) => ({
                ...item,
                originalIndex: index + 1,
                isLf: lfModifiedRowIndexes.includes(index),
            }))
            .filter((item) => item.width && item.height);

        // 2. Sort Items
        const sortedItems = this._sortItems(itemsWithIndex);

        // --- Initialize Counters ---
        let dualCount = 0;
        let hdCount = 0;
        let totalListPrice = 0;

        // 3. Generate HTML Rows
        const rowsHtml = sortedItems.map((item, index) => {
            // Stats
            if (item.dual === 'D') dualCount++;
            if (item.winder === 'HD') hdCount++;
            if (item.linePrice) totalListPrice += item.linePrice;

            // --- Logic ---
            // A. Dimensions
            const { mWidth, mHeight } = this._calculateManufacturingDimensions(item);

            // B. Name Cleaning
            let cleanFabricName = item.fabric || '';
            cleanFabricName = cleanFabricName.replace(/^Light-filter\s+/i, '');

            // C. TYPE Logic (Short Codes)
            let typeLabel = '';
            if (item.isLf) {
                typeLabel = "LF";
            } else if ((item.fabricType || '').startsWith('B')) {
                typeLabel = "BO";
            } else if (item.fabricType === 'SN') {
                typeLabel = "SN";
            }

            const rowData = {
                rowNumber: index + 1,
                index: item.originalIndex,
                type: typeLabel,
                fabric: cleanFabricName,
                color: item.color || '',
                width: mWidth,
                height: mHeight,
                over: item.over || '',
                oi: item.oi || '',
                lr: item.lr || '',
                dual: item.dual === 'D' ? 'Y' : '',
                chain: item.chain || '',
                winder: item.winder === 'HD' ? 'Y' : '',
                motor: item.motor ? 'Y' : '',
                location: item.location || '',
                price: item.linePrice ? `$${item.linePrice.toFixed(2)}` : '',

                // Styles
                fabricClass: this._getRowClass(item),
                isEmptyClassDual: item.dual === 'D' ? '' : 'is-empty-cell',
                isEmptyClassHD: item.winder === 'HD' ? '' : 'is-empty-cell',
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

    _calculateManufacturingDimensions(item) {
        let mWidth = item.width;
        if (item.oi === 'IN') {
            mWidth = mWidth - 4;
        } else if (item.oi === 'OUT') {
            mWidth = mWidth - 2;
        }

        let mHeight = item.height;
        if (this.configManager) {
            const matrix = this.configManager.getPriceMatrix(item.fabricType);
            if (matrix && matrix.drops) {
                const nextDrop = matrix.drops.find(d => d > item.height);
                if (nextDrop) {
                    mHeight = nextDrop - 5;
                }
            }
        }
        return { mWidth, mHeight };
    }

    _sortItems(items) {
        const typeCounts = {};
        items.forEach((item) => {
            const type = item.fabricType || 'Unknown';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        const getCategory = (item) => {
            if (item.isLf) return 3;
            const type = item.fabricType || '';
            if (type.startsWith('B')) return 1;
            if (type === 'SN') return 2;
            return 4;
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

    _getRowClass(item) {
        if (item.isLf) return 'bg-light-filter';
        const type = item.fabricType || '';
        if (type.startsWith('B')) return 'bg-blockout';
        if (type === 'SN') return 'bg-screen';
        return '';
    }
}