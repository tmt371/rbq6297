/* FILE: 04-core-code/services/generators/work-order-strategy.js */
// [MODIFIED] (v6299 Phase 5) Injected configManager for height calculation.
// [MODIFIED] (v6299 Phase 5 Fix) Renamed method to generateRows and updated logic for manufacturing corrections.

import { populateTemplate } from '../../utils/template-utils.js';

export class WorkOrderStrategy {
    constructor({ configManager } = {}) {
        this.configManager = configManager;
    }

    /**
     * Generates the table rows for the Work Order HTML.
     * Applies manufacturing corrections (Width/Height) and name cleaning.
     * @param {object} quoteData - The raw quote data.
     * @param {object} ui - The UI state.
     * @param {string} rowTemplate - The HTML template for a single row.
     */
    generateRows(quoteData, ui, rowTemplate) {
        const currentProductKey = quoteData.currentProduct;
        const rawItems = quoteData.products[currentProductKey].items;
        const lfModifiedRowIndexes = quoteData.uiMetadata?.lfModifiedRowIndexes || [];

        // 1. Prepare Items (Add original index and LF status)
        const itemsWithIndex = rawItems
            .map((item, index) => ({
                ...item,
                originalIndex: index + 1,
                isLf: lfModifiedRowIndexes.includes(index),
            }))
            .filter((item) => item.width && item.height);

        // 2. Sort Items (B > SN > LF, then by Qty)
        const sortedItems = this._sortItems(itemsWithIndex);

        // 3. Generate HTML
        return sortedItems.map((item, index) => {
            // --- Manufacturing Logic ---

            // A. Width & Height Correction
            const { mWidth, mHeight } = this._calculateManufacturingDimensions(item);

            // B. Name Cleaning
            let cleanFabricName = item.fabric || '';
            cleanFabricName = cleanFabricName.replace(/^Light-filter\s+/i, '');

            // C. Combine Name + Color
            const fcolor = `${cleanFabricName} ${item.color || ''}`.trim();

            const rowData = {
                rowNumber: index + 1,
                index: item.originalIndex,
                location: item.location || '',
                fcolor: fcolor,
                width: mWidth,
                height: mHeight,
                lr: item.lr || '',
                over: item.over || '', // Roll direction
                dual: item.dual === 'D' ? 'Y' : '',
                winder: item.winder === 'HD' ? 'Y' : '',
                chain: item.chain || '',
                motor: item.motor ? 'Y' : '',
                price: item.linePrice ? `$${item.linePrice.toFixed(2)}` : '',
                // Add CSS classes for styling
                fabricClass: this._getRowClass(item),
                isEmptyClassDual: item.dual === 'D' ? '' : 'is-empty-cell',
                isEmptyClassHD: item.winder === 'HD' ? '' : 'is-empty-cell',
                isEmptyClassMotor: item.motor ? '' : 'is-empty-cell'
            };

            return populateTemplate(rowTemplate, rowData);
        }).join('');
    }

    _calculateManufacturingDimensions(item) {
        // 1. Width Correction
        let mWidth = item.width;
        if (item.oi === 'IN') {
            mWidth = mWidth - 4;
        } else if (item.oi === 'OUT') {
            mWidth = mWidth - 2;
        }

        // 2. Height Correction (Chart Lookup)
        let mHeight = item.height;
        if (this.configManager) {
            const matrix = this.configManager.getPriceMatrix(item.fabricType);
            if (matrix && matrix.drops) {
                // Find the drop closest to X but LARGER than X (Next Drop)
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
            if (item.isLf) return 3; // LF Last
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

    _getRowClass(item) {
        if (item.isLf) return 'bg-light-filter';
        const type = item.fabricType || '';
        if (type.startsWith('B')) return 'bg-blockout';
        if (type === 'SN') return 'bg-screen';
        return '';
    }
}