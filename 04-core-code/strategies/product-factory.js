/* FILE: 04-core-code/strategies/product-factory.js */

import { RollerBlindStrategy } from './roller-blind-strategy.js';
import { PRODUCT_TYPES } from '../config/business-constants.js';

/**
 * @fileoverview A factory for creating product-specific strategy objects.
 * This allows the application to easily support multiple product types.
 */

const strategyMap = {
    [PRODUCT_TYPES.ROLLER_BLIND]: RollerBlindStrategy,
};

export class ProductFactory {
    constructor({ configManager }) {
        this.configManager = configManager;
        console.log("ProductFactory Initialized with ConfigManager.");
    }

    /**
     * Returns an instance of the strategy for the given product type.
     * @param {string} productType - The type of the product (e.g., PRODUCT_TYPES.ROLLER_BLIND).
     * @returns {object|null} An instance of the corresponding product strategy, or null if not found.
     */
    getProductStrategy(productType) {
        const StrategyClass = strategyMap[productType];

        if (StrategyClass) {
            return new StrategyClass({ configManager: this.configManager });
        } else {
            console.error(`No strategy found for product type: ${productType}`);
            return null;
        }
    }
}