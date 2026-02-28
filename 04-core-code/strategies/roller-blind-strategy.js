/* FILE: 04-core-code/strategies/roller-blind-strategy.js */
// [MODIFIED] (Stage 9 Phase 3 - Constants) Replaced magic strings with COMPONENT_CODES.
// [MODIFIED] (Funnel Phase 2) Added evaluateWinderForItem (Winder 黃金三角法則).

/**
 * @fileoverview Contains all business logic specific to the Roller Blind product.
 * This includes price calculation, validation rules, etc.
 */

// [MODIFIED] Changed the import from a bare module specifier to a browser-compatible CDN URL.
import { v4 as uuidv4 } from 'https://cdn.jsdelivr.net/npm/uuid@9.0.1/dist/esm-browser/index.js';
import { COMPONENT_CODES } from '../config/business-constants.js'; // [NEW]

export class RollerBlindStrategy {
    constructor({ configManager }) {
        this.configManager = configManager;
        // [MODIFIED] Phase 9.0: Silent constructor — log moved to initialize() guard
        this.isInitialized = false;
    }

    /**
     * [NEW] Phase 9.0: One-time initialization guard.
     * Ensures heavy init logic only runs once per session.
     */
    initialize() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        console.log("RollerBlindStrategy Initialized.");
    }

    /**
     * Calculates the price for a single roller blind item based on a price matrix.
     */
    calculatePrice(item, priceMatrix) {
        if (!item || !item.width || !item.height || !item.fabricType) {
            return { price: null, error: 'Incomplete item data.' };
        }
        if (!priceMatrix) {
            return { price: null, error: `Price matrix not found for fabric type: ${item.fabricType}` };
        }

        const widthIndex = priceMatrix.widths.findIndex(w => item.width <= w);
        const dropIndex = priceMatrix.drops.findIndex(d => item.height <= d);

        if (widthIndex === -1) {
            const errorMsg = `Width ${item.width} exceeds the maximum width in the price matrix.`;
            return { price: null, error: errorMsg };
        }
        if (dropIndex === -1) {
            const errorMsg = `Height ${item.height} exceeds the maximum height in the price matrix.`;
            return { price: null, error: errorMsg };
        }

        const price = priceMatrix.prices[dropIndex][widthIndex];

        // [NEW] (Funnel Phase 2) 在每行計價時同時評估 Winder
        const winderResult = this.evaluateWinderForItem(item);

        if (price !== undefined) {
            return { price: price, winder: winderResult };
        }
        return { price: null, error: 'Price not found for the given dimensions.', winder: winderResult };
    }

    /**
     * [REFACTORED] Returns the validation rules specific to roller blinds by fetching them from ConfigManager.
     * @returns {object}
     */
    getValidationRules() {
        const rules = this.configManager.getValidationRules('rollerBlind');
        if (!rules) {
            // Provide a safe fallback if rules are not found, preventing crashes.
            return {
                width: { name: 'Width' },
                height: { name: 'Height' }
            };
        }
        // Adapt the data from the config to the nested structure expected by the consumers.
        return {
            width: { min: rules.minWidth, max: rules.maxWidth, name: 'Width' },
            height: { min: rules.minHeight, max: rules.maxHeight, name: 'Height' }
        };
    }

    /**
     * Returns a new, empty item object for a roller blind.
     * @returns {object}
     */
    getInitialItemData() {
        return {
            itemId: uuidv4(),
            // --- Phase 1 Fields ---
            width: null,
            height: null,
            fabricType: null,
            linePrice: null,
            // --- Phase 2 Fields ---
            location: '',
            fabric: '',
            color: '',
            over: '',
            oi: '',
            lr: '',
            dual: '',
            chain: null,
            winder: '',
            motor: ''
        };
    }

    // --- Accessory Pricing Logic ---

    /**
     * [NEW] (Funnel Phase 2) Winder 黃金三角法則
     * 在 Strategy 層逐行評估單支捲簾是否需要 Winder，並回傳成本與售價。
     *
     * 規則 1 (強制免計價): width >= 2000mm → 工廠標配，成本 $0，售價 $0
     * 規則 2 (強制需計價): area >= threshold 且 width < 2000mm → 標準成本/售價
     * 規則 3 (手動需計價): 使用者於 K3 手動勾選 (item.winder === 'HD') → 標準成本/售價
     *
     * @param {object} item - 單行捲簾物件，需含 width, height, winder 屬性
     * @returns {{ hasWinder: boolean, winderCost: number, winderPrice: number, rule: string|null }}
     */
    evaluateWinderForItem(item) {
        // [NEW] (Phase 3.25) 馬達排他：有馬達的窗簾不計 Winder
        if (item.motor) {
            return { hasWinder: false, winderCost: 0, winderPrice: 0, rule: 'MOTOR_OVERRIDE' };
        }

        const width = item.width || 0;
        const height = item.height || 0;
        const area = width * height;

        // 從 JSON businessRules.logic 讀取面積門檻
        const thresholds = this.configManager.getLogicThresholds();
        const areaThreshold = (thresholds && thresholds.hdWinderThresholdArea) || 4000000;

        // 從 JSON accessories 讀取標準成本與售價
        const standardWinderCost = this.configManager.getAccessoryPrice('cost-winder') || 0;
        const standardWinderPrice = this.configManager.getAccessoryPrice('winderHD') || 0;

        // 檢查 K3 是否有手動勾選 (item.winder === 'HD')
        const isManuallySelected = item.winder === COMPONENT_CODES.WINDER_HD;

        let hasWinder = false;
        let winderCost = 0;
        let winderPrice = 0;
        let rule = null;

        if (width >= 2000) {
            // 規則 1: 寬度達標 → 強制配置，工廠標配不計價
            hasWinder = true;
            winderCost = 0;
            winderPrice = 0;
            rule = 'WIDTH_THRESHOLD_FREE';
        } else if (area >= areaThreshold) {
            // 規則 2: 面積達標 (寬度未滿 2000) → 強制配置，載入標準成本與售價
            hasWinder = true;
            winderCost = standardWinderCost;
            winderPrice = standardWinderPrice;
            rule = 'AREA_THRESHOLD_PAID';
        } else if (isManuallySelected) {
            // 規則 3: 尺寸未達標，但手動勾選 → 載入標準成本與售價
            hasWinder = true;
            winderCost = standardWinderCost;
            winderPrice = standardWinderPrice;
            rule = 'MANUAL_SELECTION_PAID';
        }

        return { hasWinder, winderCost, winderPrice, rule };
    }

    calculateDualPrice(items, pricePerPair) {
        // [MODIFIED] Use constant for 'D'
        const dualCount = items.filter(item => item.dual === COMPONENT_CODES.DUAL_BRACKET).length;
        const totalPrice = Math.floor(dualCount / 2) * pricePerPair;
        return totalPrice;
    }

    calculateWinderPrice(count, pricePerUnit) {
        return count * pricePerUnit;
    }

    calculateMotorPrice(count, pricePerUnit) {
        return count * pricePerUnit;
    }

    calculateRemotePrice(count, pricePerUnit) {
        return count * pricePerUnit;
    }

    calculateChargerPrice(count, pricePerUnit) {
        return count * pricePerUnit;
    }

    calculateCordPrice(count, pricePerUnit) {
        return count * pricePerUnit;
    }
}