/* FILE: 04-core-code/services/data-preparation-service.js */

import { REGEX } from '../config/regex.js';
import { COMPONENT_CODES, MOUNT_TYPES, LOGIC_CODES } from '../config/business-constants.js';

/**
 * @typedef {Object} ExportItem
 * @property {number} displayIndex - The row number shown to user (1, 2, 3...).
 * @property {number} originalIndex - The original index in the data array (matches # column).
 * @property {string} typeCode - Normalized type code: 'BO' (Blockout), 'SN' (Screen), 'LF' (Light Filter).
 * @property {string} fabricName - Cleaned fabric name (removed 'Light-filter ' prefix).
 * @property {string} fabricColor - Fabric color.
 * @property {number} rawWidth - User input width (for CSV/Backup).
 * @property {number} rawHeight - User input height (for CSV/Backup).
 * @property {number} mWidth - Manufacturing Width (calculated with deduction rules).
 * @property {number} mHeight - Manufacturing Height (calculated with drop rules).
 * @property {string} location - Location label.
 * @property {string} winder - Winder type (e.g., 'HD', '').
 * @property {string} motor - Motor type (e.g., 'Motor', '').
 * @property {string} control - Derived control type (Chain/Motor).
 * @property {string} dual - Dual bracket indicator ('Y'/'').
 * @property {string} chain - Chain length.
 * @property {string} oi - Orientation (IN/OUT).
 * @property {string} over - Over roll (O/U).
 * @property {string} lr - Left/Right (L/R).
 * @property {number} price - Calculated line price.
 * @property {string} formattedPrice - Price formatted as currency string.
 * @property {boolean} isLf - Flag indicating if this is a Light Filter item (pink).
 */

/**
 * @fileoverview Service responsible for preparing and normalizing data for various export formats.
 * It encapsulates business rules for:
 * 1. Dimensions Correction (Manufacturing Sizes)
 * 2. Sorting (B > SN > LF)
 * 3. Type Labeling
 * 4. Data Sanitation
 */
export class DataPreparationService {
    /**
     * @param {object} dependencies
     * @param {ConfigManager} dependencies.configManager - Needed for Price Matrix lookups (Drop logic).
     */
    constructor({ configManager }) {
        this.configManager = configManager;
        console.log("DataPreparationService Initialized (Core Logic Ready).");
    }

    /**
     * Main entry point. Returns a structured object containing processed data ready for export.
     * @param {object} quoteData - The full quote data from state.
     * @param {object} uiMetadata - UI metadata (e.g. lfModifiedRowIndexes).
     * @returns {object} Organized data for exports { items: ExportItem[] }.
     */
    getExportData(quoteData, uiMetadata) {
        const currentProductKey = quoteData.currentProduct;
        const rawItems = quoteData.products[currentProductKey].items;
        const lfModifiedRowIndexes = uiMetadata?.lfModifiedRowIndexes || [];

        const processableItems = rawItems
            .map((item, index) => this._prepareItem(item, index, lfModifiedRowIndexes))
            .filter(item => item.rawWidth && item.rawHeight);

        const sortedItems = this._sortItems(processableItems);

        sortedItems.forEach((item, index) => {
            item.displayIndex = index + 1;
        });

        return {
            items: sortedItems
        };
    }

    /**
     * Process a single item: Sanitize, Calculate Dimensions, Determine Type.
     */
    _prepareItem(item, index, lfIndexes) {
        const isLf = lfIndexes.includes(index);
        const { mWidth, mHeight } = this._calculateManufacturingDimensions(item);
        const typeCode = this._determineTypeCode(item, isLf);
        const fabricName = this._cleanFabricName(item.fabric);

        return {
            originalIndex: index + 1,
            typeCode: typeCode,
            fabricName: this._sanitize(fabricName),
            fabricColor: this._sanitize(item.color),

            rawWidth: item.width,
            rawHeight: item.height,
            mWidth: mWidth,
            mHeight: mHeight,

            location: this._sanitize(item.location),
            over: this._sanitize(item.over),
            oi: this._sanitize(item.oi),
            lr: this._sanitize(item.lr),

            dual: item.dual === COMPONENT_CODES.DUAL_BRACKET ? 'Y' : '',
            winder: item.winder === COMPONENT_CODES.WINDER_HD ? 'Y' : '',
            motor: item.motor ? 'Y' : '',
            chain: item.chain || '',

            price: item.linePrice,
            formattedPrice: item.linePrice ? `$${item.linePrice.toFixed(2)}` : '',

            isLf: isLf
        };
    }

    /**
     * Removes invisible characters from a string.
     */
    _sanitize(value) {
        if (typeof value !== 'string') return value || '';
        return value.replace(REGEX.INVISIBLE_CHAR, '');
    }

    /**
     * Removes "Light-filter " prefix from fabric name.
     */
    _cleanFabricName(fabric) {
        if (!fabric) return '';
        return fabric.replace(/^Light-filter\s+/i, '');
    }

    /**
     * Determines the simplified Type Code (BO, SN, LF).
     */
    _determineTypeCode(item, isLf) {
        if (isLf) {
            return LOGIC_CODES.LIGHT_FILTER;
        }
        const type = item.fabricType || '';
        if (type.startsWith('B')) {
            return LOGIC_CODES.BLOCKOUT;
        }
        if (type === 'SN') {
            return LOGIC_CODES.SCREEN;
        }
        return "";
    }

    /**
     * Calculates Manufacturing Dimensions (Business Rules).
     * Width: IN -4mm, OUT -2mm.
     * Height: Lookup Price Matrix Drop - 5mm (unless exact match).
     */
    _calculateManufacturingDimensions(item) {
        let mWidth = item.width;
        if (item.oi === MOUNT_TYPES.IN_RECESS) {
            mWidth = mWidth - 4;
        } else if (item.oi === MOUNT_TYPES.FACE_FIX) {
            mWidth = mWidth - 2;
        }

        let mHeight = item.height;
        if (this.configManager) {
            const matrix = this.configManager.getPriceMatrix(item.fabricType);
            if (matrix && matrix.drops) {
                const nextDrop = matrix.drops.find(d => d >= item.height);

                if (nextDrop) {
                    if (nextDrop === item.height) {
                        mHeight = item.height;
                    } else {
                        mHeight = nextDrop - 5;
                    }
                }
            }
        }
        return { mWidth, mHeight };
    }

    /**
     * Sorts items based on business rules:
     * 1. Category: Blockout (BO) -> Screen (SN) -> Light Filter (LF) -> Others
     * 2. Quantity: Most frequent fabric type first within category
     * 3. Fabric Name: Alphabetical
     * 4. Original Index: Stable sort
     */
    _sortItems(items) {
        const typeCounts = {};
        items.forEach((item) => {
            const type = item.typeCode || 'Unknown';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        const getCategoryRank = (item) => {
            if (item.typeCode === LOGIC_CODES.LIGHT_FILTER) return 3;
            if (item.typeCode === LOGIC_CODES.BLOCKOUT) return 1;
            if (item.typeCode === LOGIC_CODES.SCREEN) return 2;
            return 4;
        };

        return items.sort((a, b) => {
            const catA = getCategoryRank(a);
            const catB = getCategoryRank(b);
            if (catA !== catB) return catA - catB;

            const countA = typeCounts[a.typeCode] || 0;
            const countB = typeCounts[b.typeCode] || 0;
            if (countA !== countB) return countB - countA;

            if (a.typeCode !== b.typeCode) {
                return (a.typeCode || '').localeCompare(b.typeCode || '');
            }

            return a.originalIndex - b.originalIndex;
        });
    }
}