/* FILE: 04-core-code/strategies/product-factory.js */
// [MODIFIED] (Stage 9 Phase 3 - Constants) Replaced magic string 'rollerBlind' with PRODUCT_TYPES.ROLLER_BLIND.

import { RollerBlindStrategy } from './roller-blind-strategy.js';
import { PRODUCT_TYPES } from '../config/business-constants.js'; // [NEW]

/**
 * @fileoverview A factory for creating product-specific strategy objects.
 * This allows the application to easily support multiple product types.
 */

// Strategy Map using constant keys
const strategyMap = {
    [PRODUCT_TYPES.ROLLER_BLIND]: RollerBlindStrategy,
    // --- Future expansions ---
    // [PRODUCT_TYPES.SHEER_CURTAIN]: SheerCurtainStrategy,
    // [PRODUCT_TYPES.FLY_SCREEN]: FlyScreenStrategy,
};

export class ProductFactory {
    constructor({ configManager }) {
        this.configManager = configManager;
        // [NEW] Phase 9.0: Singleton cache — strategies created once per session
        this.strategyCache = new Map();
        console.log("ProductFactory Initialized with ConfigManager.");
    }

    /**
     * Returns a cached instance of the strategy for the given product type.
     * [MODIFIED] Phase 9.0: Singleton pattern — returns cached instance if available.
     * @param {string} productType - The type of the product (e.g., PRODUCT_TYPES.ROLLER_BLIND).
     * @returns {object|null} An instance of the corresponding product strategy, or null if not found.
     */
    getProductStrategy(productType) {
        // Phase 9.0: Return cached instance if available
        if (this.strategyCache.has(productType)) {
            return this.strategyCache.get(productType);
        }

        const StrategyClass = strategyMap[productType];

        if (StrategyClass) {
            const instance = new StrategyClass({ configManager: this.configManager });
            // Phase 9.0: Call one-time initializer if available
            if (typeof instance.initialize === 'function') {
                instance.initialize();
            }
            this.strategyCache.set(productType, instance);
            console.log(`✅ [ProductFactory] Strategy cached for: ${productType}`);
            return instance;
        } else {
            console.error(`No strategy found for product type: ${productType}`);
            return null;
        }
    }
}