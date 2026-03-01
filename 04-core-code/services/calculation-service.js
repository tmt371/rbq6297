/* FILE: 04-core-code/services/calculation-service.js */
// [MODIFIED] (Phase 7) Added calculateF1Costs, and updated getQuoteTemplateData to use F1 costs
// [MODIFIED] (Phase 8) Updated getQuoteTemplateData, passing F1 cost details (RB, Acce, Total) for work order usage
// [MODIFIED] (Accounting V2 Phase 2) Added taxExclusiveTotal calculation in calculateF2Summary
// [MODIFIED] (Accounting V2 Phase 2 Fix) taxExclusiveTotal is now always equal to newOffer
// [MODIFIED] (F1 Motor Split) Updated calculateF1Costs to split B-Motor/W-Motor costs ($160/$130).
// [MODIFIED] (F1 Motor Split) Updated calculateF2Summary to split B-Motor/W-Motor sales prices ($250/$200).
// [MODIFIED] (F1 Motor Split Fix) Updated getQuoteTemplateData to use correct SALES price for motors ($250/$200).
// [MODIFIED] (F1 Motor Split Fix 2) Hardcoded motor sales price calculation in getQuoteTemplateData for robustness.
// [MODIFIED] (Stage 9 Phase 3 - Constants) Replaced magic strings 'HD' and 'D' with COMPONENT_CODES.
// [MODIFIED] (Stage 9 Fix WorkOrder Cost) Reverted motor price in getQuoteTemplateData to USE COST ($160/$130) for Work Order.
// [MODIFIED] (Stage 9 Final Fix) Differentiate Quote (Sales Price) vs WorkOrder (Cost Price) in getQuoteTemplateData.

import { COMPONENT_CODES } from '../config/business-constants.js';

/**
 * @fileoverview Service for handling all price and sum calculations.
 * Acts as a generic executor that delegates product-specific logic to a strategy.
 */
export class CalculationService {
    constructor({ stateService, productFactory, configManager }) {
        this.stateService = stateService;
        this.productFactory = productFactory;
        this.configManager = configManager;
        console.log("CalculationService Initialized.");
    }

    /**
     * Calculates line prices for all valid items and the total sum using a provided product strategy.
     */
    calculateAndSum(quoteData, productStrategy) {
        if (!productStrategy) {
            console.error("CalculationService: productStrategy is required for calculateAndSum.");
            return { quoteData, firstError: { message: "Product strategy not provided." } };
        }

        const currentProductKey = quoteData.currentProduct;
        const currentProductData = quoteData.products[currentProductKey];

        let firstError = null;

        // [NEW] (Funnel Phase 2.5) Winder 累加器 — 從 Strategy 逐行評估結果收集
        let accumulatedWinderQty = 0;
        let accumulatedWinderCost = 0;
        let accumulatedWinderPrice = 0;
        // [NEW] (Phase 3.3b) HD Winder free vs paid split
        let hdFreeQty = 0;
        let hdPaidQty = 0;

        const newItems = currentProductData.items.map((item, index) => {
            const newItem = { ...item, linePrice: null };
            if (item.width && item.height && item.fabricType) {
                const priceMatrix = this.configManager.getPriceMatrix(item.fabricType);
                const result = productStrategy.calculatePrice(item, priceMatrix);

                if (result.price !== null) {
                    newItem.linePrice = result.price;
                } else if (result.error && !firstError) {
                    const errorColumn = result.error.toLowerCase().includes('width') ? 'width' : 'height';
                    firstError = {
                        message: `Row ${index + 1}: ${result.error}`,
                        rowIndex: index,
                        column: errorColumn
                    };
                }

                // [NEW] (Funnel Phase 2.5) Accumulate winder evaluation from strategy
                if (result.winder && result.winder.hasWinder) {
                    accumulatedWinderQty++;
                    accumulatedWinderCost += result.winder.winderCost;
                    accumulatedWinderPrice += result.winder.winderPrice;
                    // [NEW] (Phase 3.3b) HD free vs paid split
                    if (result.winder.winderCost === 0) {
                        hdFreeQty++;
                    } else {
                        hdPaidQty++;
                    }
                }
            }
            return newItem;
        });

        const itemsTotal = newItems.reduce((sum, item) => sum + (item.linePrice || 0), 0);

        let accessoriesTotal = 0;
        const currentSummary = currentProductData.summary;
        if (currentSummary && currentSummary.accessories) {
            const acc = currentSummary.accessories;
            accessoriesTotal += acc.winder?.price || 0;
            accessoriesTotal += acc.motor?.price || 0;
            accessoriesTotal += acc.remote?.price || 0;
            accessoriesTotal += acc.charger?.price || 0;
            accessoriesTotal += acc.cord3m?.price || 0;
        }

        const newSummary = {
            ...currentSummary,
            totalSum: itemsTotal + accessoriesTotal,
            // [MODIFIED] (Phase 3.3b) Winder evaluation with free/paid split
            winderEvaluation: {
                qty: accumulatedWinderQty,
                totalCost: accumulatedWinderCost,
                totalPrice: accumulatedWinderPrice,
                hdFreeQty,
                hdPaidQty
            }
        };

        const newProductData = {
            ...currentProductData,
            items: newItems,
            summary: newSummary
        };

        const updatedQuoteData = {
            ...quoteData,
            products: {
                ...quoteData.products,
                [currentProductKey]: newProductData
            }
        };
        return { updatedQuoteData, firstError };
    }

    /**
     * [NEW] Calculates the SALE PRICE for a given accessory.
     * This method is explicit and should be used for calculating prices for the end customer.
     */
    calculateAccessorySalePrice(productType, accessoryName, data) {
        const productStrategy = this.productFactory.getProductStrategy(productType);
        if (!productStrategy) return 0;

        const { accessoryPriceKeyMap, accessoryMethodNameMap } = this.configManager.getAccessoryMappings();
        let priceKey = accessoryPriceKeyMap[accessoryName] || accessoryName;

        // [FIX] (Phase 10.5) Intercept and override legacy V1 keys that might still be cached in Firestore
        if (priceKey === 'remoteStandard') priceKey = 'ele_rem_1ch_linx';
        if (priceKey === 'chargerStandard') priceKey = 'ele_charger';

        if (!priceKey) {
            console.warn(`[Quote Engine] Optional accessory '${accessoryName}' has no price key. Defaulting to $0.`);
            return 0;
        }

        const pricePerUnit = this.configManager.getAccessoryPrice(priceKey);
        if (pricePerUnit === null || pricePerUnit === undefined) {
            console.warn(`[Quote Engine] Optional accessory '${priceKey}' not found in V2 arrays. Defaulting to $0.`);
            return 0;
        }

        let methodName = accessoryMethodNameMap[accessoryName];
        // [FIX] Handle direct V2 ID inputs gracefully to find the correct calculation method
        if (accessoryName === 'ele_rem_1ch_linx' || accessoryName === 'ele_rem_16ch_linx') methodName = 'calculateRemotePrice';
        if (accessoryName === 'ele_charger') methodName = 'calculateChargerPrice';

        if (methodName && productStrategy[methodName]) {
            const args = (data.items) ?
                [data.items, pricePerUnit] : [data.count, pricePerUnit];
            return productStrategy[methodName](...args);
        }

        return 0;
    }

    /**
     * [NEW] Calculates the COST for a given accessory.
     * This method is explicit and should be used for internal cost calculations.
     */
    calculateAccessoryCost(productType, accessoryName, data) {
        const productStrategy = this.productFactory.getProductStrategy(productType);
        if (!productStrategy) return 0;

        // Cost key must be provided in the data object.
        if (!data || !data.costKey) {
            console.error(`Cost calculation for '${accessoryName}' requires a 'costKey' in the data payload.`);
            return 0;
        }
        const priceKey = data.costKey;

        const pricePerUnit = this.configManager.getAccessoryPrice(priceKey);
        if (pricePerUnit === null) return 0;

        const { accessoryMethodNameMap } = this.configManager.getAccessoryMappings();
        const methodName = accessoryMethodNameMap[accessoryName];

        if (methodName && productStrategy[methodName]) {
            const args = (data.items) ? [data.items, pricePerUnit] : [data.count, pricePerUnit];
            return productStrategy[methodName](...args);
        }

        return 0;
    }

    /**
     * @deprecated since v5.93. Use calculateAccessorySalePrice() or calculateAccessoryCost() instead.
     * [REFACTORED] This method is now deprecated and will be removed in a future version.
     */
    calculateAccessoryPrice(productType, accessoryName, data) {
        console.warn("DEPRECATED: `calculateAccessoryPrice` was called. Please update to use `calculateAccessorySalePrice` or `calculateAccessoryCost`.");
        if (data && data.costKey) {
            return this.calculateAccessoryCost(productType, accessoryName, data);
        } else {
            return this.calculateAccessorySalePrice(productType, accessoryName, data);
        }
    }

    /**
     * [REFACTORED] Calculates the total price for a given F1 panel component based on its quantity.
     * It now fetches mappings from the ConfigManager.
     * [MODIFIED] (Phase 7) This method has been renamed to calculateF1ComponentPrice
     */
    calculateF1ComponentPrice(componentKey, quantity) {
        if (typeof quantity !== 'number' || quantity < 0) {
            return 0;
        }

        const f1KeyMap = {
            'winder': 'cost-winder',
            'motor': 'cost-motor', // Maps to default cost $160 (B-Motor)
            'remote-1ch': 'cost-L-1ch-remote',
            'remote-16ch': 'cost-L-16ch-remote',
            'charger': 'cost-charger',
            '3m-cord': 'cost-3mcord',
            'dual-combo': 'cost-combo-dual',
            'slim': 'cost-slim-dual',
            'wifihub': 'wifiHub'
        };

        let accessoryKey = f1KeyMap[componentKey];

        // [MODIFIED] (Phase 5.9) W-Motor cost now from V2 array via ConfigManager
        if (componentKey === 'w-motor') {
            const wMotorCost = this.configManager.getAccessoryPrice('cost-w-motor-linx') || 130;
            return quantity * wMotorCost;
        }

        if (!accessoryKey) {
            // Fallback for wifihub if map above implies it.
            if (componentKey === 'wifihub') accessoryKey = 'wifiHub';
            else {
                console.error(`No accessory key found for F1 component: ${componentKey}`);
                return 0;
            }
        }

        const unitPrice = this.configManager.getAccessoryPrice(accessoryKey);
        if (unitPrice === null) {
            return 0;
        }

        return unitPrice * quantity;
    }

    /**
     * [NEW] (Phase 7)
     * Moved logic from f1-cost-view.js to here, centrally calculating F1 *Costs*.
     * This is the single source of truth for F1 panel cost calculations.
     * [MODIFIED] (F1 Motor Split) Split motor costs into B-Motor and W-Motor.
     */
    calculateF1Costs(quoteData, uiState) {
        const items = quoteData.products[quoteData.currentProduct].items;
        const ui = uiState;

        const componentPrices = {};

        // [MODIFIED] (Funnel Phase 2.5) 替換舊公式，改用 Strategy 逐行評估 Winder 黃金三角法則
        // 舊: const winderQty = items.filter(item => item.winder === 'HD').length;
        //     componentPrices.winder = this.calculateF1ComponentPrice('winder', winderQty); // = count * $8
        const productStrategy = this.productFactory.getProductStrategy(quoteData.currentProduct);
        let winderQty = 0;
        let winderTotalCost = 0;
        // [NEW] (Phase 3.3c) HD Winder free vs paid split
        let hdFreeQty = 0;
        let hdPaidQty = 0;
        items.forEach(item => {
            const winderResult = productStrategy.evaluateWinderForItem(item);
            if (winderResult.hasWinder) {
                winderQty++;
                winderTotalCost += winderResult.winderCost;
                if (winderResult.winderCost === 0) {
                    hdFreeQty++;
                } else {
                    hdPaidQty++;
                }
            }
        });
        componentPrices.winder = winderTotalCost;

        // Motor (Total)
        const totalMotorQty = items.filter(item => !!item.motor).length;

        // [NEW] (F1 Motor Split) Logic
        // W-Motor Qty comes from UI state (set via dialog)
        let wMotorQty = ui.f1.w_motor_qty || 0;
        // Clamp W-Motor Qty to Total Motor Qty (cannot exceed total)
        if (wMotorQty > totalMotorQty) wMotorQty = totalMotorQty;
        // B-Motor Qty is the remainder
        const bMotorQty = totalMotorQty - wMotorQty;

        // [MODIFIED] (Phase 3.3c) Brand defaults changed to 'linx'
        const currentMotorBrand = ui.f1?.motorBrand || 'linx';
        const currentRemoteBrand = ui.f1?.remoteBrand || 'linx';

        // [MODIFIED] (Phase 3.1) 用品牌 Key 動態查詢成本，取代硬寫數字
        // 舊: componentPrices.b_motor = this.calculateF1ComponentPrice('motor', bMotorQty); // = bMotorQty * $160
        //     componentPrices.w_motor = this.calculateF1ComponentPrice('w-motor', wMotorQty); // = wMotorQty * $130
        const bMotorUnitCost = this.configManager.getAccessoryPrice(`cost-b-motor-${currentMotorBrand}`) || 0;
        const wMotorUnitCost = this.configManager.getAccessoryPrice(`cost-w-motor-${currentMotorBrand}`) || 0;
        componentPrices.b_motor = bMotorQty * bMotorUnitCost;
        componentPrices.w_motor = wMotorQty * wMotorUnitCost;

        // Combined Motor Cost for display if needed, but we return details
        componentPrices.motor = componentPrices.b_motor + componentPrices.w_motor;

        // Remotes (Use F1 UI state quantities)
        const totalRemoteCount = ui.driveRemoteCount || 0;
        let remote1chQty = ui.f1.remote_1ch_qty || 0;
        let remote16chQty = ui.f1.remote_16ch_qty || 0;
        if (totalRemoteCount !== (remote1chQty + remote16chQty)) {
            remote1chQty = 0;
            remote16chQty = totalRemoteCount;
        }
        remote1chQty = remote1chQty || 0;
        remote16chQty = remote16chQty || 0;
        // [MODIFIED] (Phase 3.1) 用品牌 Key 動態查詢遙控器成本
        // 舊: this.calculateF1ComponentPrice('remote-1ch', qty) // = qty * $40 (固定 L-Brand)
        //     this.calculateF1ComponentPrice('remote-16ch', qty) // = qty * $70 (固定 L-Brand)
        const remote1chUnitCost = this.configManager.getAccessoryPrice(`cost-remote-1ch-${currentRemoteBrand}`) || 0;
        const remote16chUnitCost = this.configManager.getAccessoryPrice(`cost-remote-16ch-${currentRemoteBrand}`) || 0;
        componentPrices['remote-1ch'] = remote1chQty * remote1chUnitCost;
        componentPrices['remote-16ch'] = remote16chQty * remote16chUnitCost;

        // Charger (Use K3 UI state quantities)
        const chargerQty = ui.driveChargerCount || 0;
        componentPrices.charger = this.calculateF1ComponentPrice('charger', chargerQty);

        // 3M Cord (Use K3 UI state quantities)
        const cordQty = ui.driveCordCount || 0;
        componentPrices['3m-cord'] = this.calculateF1ComponentPrice('3m-cord', cordQty);

        // Dual (Use F1 UI state quantities)
        // [MODIFIED] Use constant
        const totalDualPairs = Math.floor(items.filter(item => item.dual === COMPONENT_CODES.DUAL_BRACKET).length / 2);
        const comboQty = (ui.f1.dual_combo_qty === null) ? totalDualPairs : ui.f1.dual_combo_qty;
        const slimQty = (ui.f1.dual_slim_qty === null) ? 0 : ui.f1.dual_slim_qty;
        componentPrices['dual-combo'] = this.calculateF1ComponentPrice('dual-combo', comboQty);
        componentPrices.slim = this.calculateF1ComponentPrice('slim', slimQty);

        // Wifi (Use F1 UI state quantities)
        const wifiQty = ui.f1.wifi_qty || 0;
        componentPrices.wifihub = this.calculateF1ComponentPrice('wifihub', wifiQty);

        // Total Sum
        const componentTotal =
            componentPrices.winder +
            componentPrices.b_motor +
            componentPrices.w_motor +
            componentPrices['remote-1ch'] +
            componentPrices['remote-16ch'] +
            componentPrices.charger +
            componentPrices['3m-cord'] +
            componentPrices['dual-combo'] +
            componentPrices.slim +
            componentPrices.wifihub;

        // Return an object containing cost details
        return {
            winderCost: componentPrices.winder,
            motorCost: componentPrices.motor, // Combined for F1 Total display if needed, but UI splits it
            bMotorCost: componentPrices.b_motor, // [NEW]
            wMotorCost: componentPrices.w_motor, // [NEW]

            remote1chCost: componentPrices['remote-1ch'],
            remote16chCost: componentPrices['remote-16ch'],
            chargerCost: componentPrices.charger,
            cordCost: componentPrices['3m-cord'],
            dualComboCost: componentPrices['dual-combo'],
            slimCost: componentPrices.slim,
            wifiCost: componentPrices.wifihub,
            componentTotal: componentTotal,
            // Return QTYs used in calculation for F1 View display
            qtys: {
                winder: winderQty,
                motor: totalMotorQty,
                b_motor: bMotorQty,
                w_motor: wMotorQty,
                remote1ch: remote1chQty,
                remote16ch: remote16chQty,
                charger: chargerQty,
                cord: cordQty,
                combo: comboQty,
                slim: slimQty,
                wifi: wifiQty,
                // [NEW] (Phase 3.3c) HD Winder free vs paid counts
                hdFree: hdFreeQty,
                hdPaid: hdPaidQty
            }
        };
    }

    /**
     * Calculates all values for the F2 summary panel.
     * [MODIFIED] (Phase 11.4b) Added strict NaN-safe input sanitization to prevent cascading $NaN.
     */
    calculateF2Summary(quoteData, uiState) {
        const currentProductKey = quoteData.currentProduct;
        const items = quoteData.products[currentProductKey].items;
        const productSummary = quoteData.products[currentProductKey].summary;

        const f2Config = this.configManager.getF2Config();
        const UNIT_PRICES = f2Config.unitPrices || {};

        const accessories = productSummary.accessories || {};

        // --- [MODIFIED] (Phase 11.4b) Strict NaN Sanitization Block ---
        // Force all incoming state and UI values into safe numbers to prevent NaN cascading
        const f1State = uiState.f1 || {};
        const f2State = uiState.f2 || {};

        const totalSumFromQuickQuote = Number(productSummary.totalSum) || 0;
        const winderPrice = Number(accessories.winderCostSum) || 0;
        const dualPrice = Number(accessories.dualCostSum) || 0;

        const wifiQty = Number(f1State.wifi_qty) || 0;
        const deliveryQty = Number(f2State.deliveryQty) || 0;
        const installQty = Number(f2State.installQty) || 0;
        const removalQty = Number(f2State.removalQty) || 0;

        // mulTimes needs special care: if it's somehow missing, NaN, or explicitly 0, we default to 1
        // to prevent the entire quote from multiplying to $0 unintentionally.
        let safeMulTimes = Number(f2State.mulTimes);
        if (isNaN(safeMulTimes) || safeMulTimes === 0) {
            safeMulTimes = 1;
        }
        const mulTimes = safeMulTimes;

        const discount = Number(f2State.discount) || 0;
        // --------------------------------------------------------------

        // [MODIFIED] (F1 Motor Split) Calculate Motor Sale Price dynamically here
        const totalMotorQty = items.filter(item => !!item.motor).length;
        let wMotorQty = Number(f1State.w_motor_qty) || 0;
        if (wMotorQty > totalMotorQty) wMotorQty = totalMotorQty;
        const bMotorQty = totalMotorQty - wMotorQty;

        // [MODIFIED] (Phase 3.1) 用品牌 Key 動態查詢馬達售價，取代硬寫 $250/$200
        const currentMotorBrandF2 = f1State.motorBrand || 'linx';
        const bMotorSalePrice = Number(this.configManager.getAccessoryPrice(`price-b-motor-${currentMotorBrandF2}`)) || 0;
        const wMotorSalePrice = Number(this.configManager.getAccessoryPrice(`price-w-motor-${currentMotorBrandF2}`)) || 0;
        const motorPrice = (bMotorQty * bMotorSalePrice) + (wMotorQty * wMotorSalePrice);

        // [MODIFIED] (Phase 4.4e) Precision dictionary mapping & Charger Business Rule
        // Default brand for remote and motor remains 'linx'
        const currentRemoteBrand = f1State.remoteBrand || 'linx';
        const remote1Qty = Number(f1State.remote_1ch_qty) || 0;
        const remote16Qty = Number(f1State.remote_16ch_qty) || 0;

        // Fix: Correct DB key naming order for remotes (e.g., price-remote-1ch-linx)
        const pR1 = Number(this.configManager.getAccessoryPrice(`price-remote-1ch-${currentRemoteBrand}`)) || 0;
        const pR16 = Number(this.configManager.getAccessoryPrice(`price-remote-16ch-${currentRemoteBrand}`)) || 0;
        const calculatedRemotePrice = (remote1Qty * pR1) + (remote16Qty * pR16);

        // [MODIFIED] (Phase 5.9) Charger retail price now from V2 array
        const chargerQty = Number(uiState.driveChargerCount) || 0;
        const pCharger = Number(this.configManager.getAccessoryPrice('price-charger')) || 50;
        const calculatedChargerPrice = chargerQty * pCharger;

        // Cord Fallback (to cost) since no retail price is defined in DB
        const cordQty = Number(uiState.driveCordCount) || 0;
        const pCord = Number(this.configManager.getAccessoryPrice('cost-3mcord')) || Number(this.configManager.getAccessoryPrice('cord3m')) || 0;
        const calculatedCordPrice = cordQty * pCord;

        // [MODIFIED] (Phase 4.6a) Get WiFi Sale Price from ConfigManager instead of hardcoded $300
        // Note: Fallback to $300 only if DB entry is missing
        const wifiSalePrice = Number(this.configManager.getAccessoryPrice('wifiHub')) || 300;
        const wifiSum = wifiQty * wifiSalePrice;

        // [MODIFIED] (Phase 12.6.3) Parse values strictly from DOM inputs to enforce correct logic
        const getDomVal = (id, fallback) => {
            const el = document.getElementById(id);
            if (el && el.value !== '') {
                const val = parseFloat(el.value);
                return isNaN(val) ? fallback : val;
            }
            return fallback;
        };

        const deliveryUnitPrice = getDomVal('f2-delivery-unit', Number(f2State.deliveryUnitPrice ?? UNIT_PRICES.delivery ?? 100) || 0);
        const installUnitPrice = getDomVal('f2-install-unit', Number(f2State.installUnitPrice ?? UNIT_PRICES.install ?? 20) || 0);
        const removalUnitPrice = getDomVal('f2-removal-unit', Number(f2State.removalUnitPrice ?? UNIT_PRICES.removal ?? 20) || 0);

        const domDeliveryQty = getDomVal('f2-b13-delivery-qty', deliveryQty);
        const domInstallQty = getDomVal('f2-b14-install-qty', installQty);
        const domRemovalQty = getDomVal('f2-b15-removal-qty', removalQty);

        const deliveryFee = domDeliveryQty * deliveryUnitPrice;
        const installFee = domInstallQty * installUnitPrice;
        const removalFee = domRemovalQty * removalUnitPrice;

        const acceSum = winderPrice + dualPrice;
        // [MODIFIED] Use the calculated motorPrice and other accessory prices
        const eAcceSum = motorPrice + calculatedRemotePrice + calculatedChargerPrice + calculatedCordPrice + wifiSum;

        const surchargeFee =
            (f2State.deliveryFeeExcluded ? 0 : deliveryFee) +
            (f2State.installFeeExcluded ? 0 : installFee) +
            (f2State.removalFeeExcluded ? 0 : removalFee);

        const firstRbPrice = totalSumFromQuickQuote * mulTimes;
        const disRbPriceValue = firstRbPrice * (1 - (discount / 100));
        const disRbPrice = Math.round(disRbPriceValue * 100) / 100;

        // [MODIFIED] (Phase 2) New calculation logic
        const f2_17_pre_sum = acceSum + eAcceSum + surchargeFee;
        const sumPrice = disRbPrice + f2_17_pre_sum; // This is the new f2-b22-sumprice

        // --- [MODIFIED] (F1/F2 Refactor Phase 3 & 11.4b NaN Safe) ---
        // --- Start: Read F1 Cost Totals from State (Refactored) ---
        // Read the pre-calculated cost totals directly from the UI state.
        const f1SubTotal = Number(f1State.f1_subTotal) || 0;
        const f1_final_total = Number(f1State.f1_finalTotal) || 0;
        // --- End: Read F1 Cost Totals from State ---

        // [MODIFIED] (F1/F2 Refactor Phase 3) We must still calculate f1_rb_price
        // because it is used for the "RB Profit" calculation.
        const f1DiscountPercentage = Number(f1State.discountPercentage) || 0;
        const retailTotalFromF1 = Number(quoteData.products?.rollerBlind?.summary?.totalSum) || 0;
        const f1_rb_price = retailTotalFromF1 * (1 - (f1DiscountPercentage / 100));
        // --- End of modification ---

        const rbProfit = disRbPrice - f1_rb_price;
        const validItemCount = items.filter(item => typeof item.linePrice === 'number' && item.linePrice > 0).length;
        const singleprofit = validItemCount > 0 ? rbProfit / validItemCount : 0;

        // [MODIFIED] (Phase 2) Keep old calculations for compatibility
        const sumProfit = sumPrice - f1SubTotal; // Old `sumProfit` (REMOVED IN PHASE 3)
        const old_gst = sumPrice * 1.1; // Old `gst` (GST-inclusive total) for getQuoteTemplateData

        // [MODIFIED] (Phase 2) New calculations based on `newOffer`
        const newOffer = (f2State.newOffer !== null && f2State.newOffer !== undefined) ? Number(f2State.newOffer) || sumPrice : sumPrice;

        // [MODIFIED] (Phase 11) Calculate *both* potential and actual GST
        const potential_gst = newOffer * 0.1; // The value to display

        const actual_gst = f2State.gstExcluded ? 0 : potential_gst; // The value to use in calculations

        const grandTotal = newOffer + actual_gst; // [MODIFIED] Uses actual_gst

        // [NEW] (Accounting V2 Phase 2) Calculate tax exclusive total for XERO
        // [FIX] Definition update: "Our Offer" IS the Tax Exclusive Amount.
        const taxExclusiveTotal = newOffer;

        // [MODIFIED v6290 Task 1 & 2] netProfit logic now depends on gstExcluded state
        const netProfit = f2State.gstExcluded
            ? grandTotal - f1SubTotal
            : grandTotal - f1_final_total;

        return {
            totalSumForRbTime: totalSumFromQuickQuote,
            wifiSum,
            deliveryFee,
            installFee,
            removalFee,
            acceSum,
            eAcceSum,
            firstRbPrice,
            disRbPrice,
            sumPrice, // (new value for f2-b22)
            rbProfit,
            singleprofit,

            // --- Old values (for compatibility + render) ---
            sumProfit: sumProfit, // (for f2-b23 - will be removed in Phase 3)
            gst: old_gst, // (for getQuoteTemplateData compatibility - will be removed in Phase 4)

            // --- New values (for Phase 2+) ---
            f2_17_pre_sum: f2_17_pre_sum,
            newOffer: newOffer,
            new_gst: actual_gst, // [MODIFIED] Return actual_gst to display $0.00 when excluded
            grandTotal: grandTotal,
            netProfit: netProfit, // (new value for f2-b25)

            // [NEW] (Accounting V2 Phase 2)
            taxExclusiveTotal: taxExclusiveTotal,

            mulTimes, // [FIX] Add mulTimes to the return object so its value can be persisted.

            // [NEW] Return calculated motor price so F2 view can render it (overriding default K3 calculation)
            calculatedMotorPrice: motorPrice,

            // [NEW] (Phase 4.4c) Returning new calculated accessory retail prices
            motorPrice: motorPrice,
            remotePrice: calculatedRemotePrice,
            chargerPrice: calculatedChargerPrice,
            cordPrice: calculatedCordPrice,

        };
    }

    /**
     * [NEW] Gathers all necessary data for the quote template.
     * This method is the new home for the logic previously in QuoteGeneratorService._prepareTemplateData.
     * @param {object} quoteData - The *original* quote data from the state (used for items).
     * @param {object} ui - The current UI state.
     * @param {object} liveQuoteData - The *live, up-to-date* quoteData, passed from workflow service.
     * @param {boolean} isWorkOrder - [NEW] Flag to determine if we use COST (True) or SALES (False) prices.
     * @returns {object} A comprehensive data object ready for template population.
     */
    getQuoteTemplateData(quoteData, ui, liveQuoteData, isWorkOrder = false) {
        // 1. Get F2 *Sales* Total (We use this for Overall Totals in both cases generally, or at least for Quote)
        const summaryData = this.calculateF2Summary(quoteData, ui);
        // 2. Get F1 *Cost* Total (We use this for Work Order details)
        const f1Costs = this.calculateF1Costs(quoteData, ui);

        const currentProductType = quoteData.currentProduct;

        // [MODIFIED] (Phase 4) Grand total is now derived from F2's newOffer state, not F3.
        const newOfferValue = (ui.f2.newOffer !== null && ui.f2.newOffer !== undefined) ? ui.f2.newOffer : summaryData.sumPrice;

        // [MODIFIED] (Phase 11) Use new_gst (potential) and grandTotal (calculated) from summaryData
        const gstValue = summaryData.new_gst;
        const grandTotal = summaryData.grandTotal; // This value is already correct (newOffer + actual_gst)

        // [NEW v6290 Task 3] Get correct Deposit/Balance from F2 state, not rough calculation
        const depositValue = ui.f2.deposit;
        const balanceValue = ui.f2.balance;

        const items = quoteData.products.rollerBlind.items;
        const formatPrice = (price) => (typeof price === 'number' && price > 0) ? `$${price.toFixed(2)}` : '';

        // --- Determine Item Prices (Cost vs Sales) ---
        let motorPrice, remote1chPrice, remote16chPrice, chargerPrice, cord3mPrice, wifiHubPrice, eAcceSum;

        const motorQty = f1Costs.qtys.motor || '';
        const remote1chQty = f1Costs.qtys.remote1ch || '';
        const remote16chQty = f1Costs.qtys.remote16ch || '';
        const chargerQty = f1Costs.qtys.charger || '';
        const cord3mQty = f1Costs.qtys.cord || '';
        const wifiHubQty = f1Costs.qtys.wifi || '';

        if (isWorkOrder) {
            // --- Work Order: Use COSTS (from F1) ---
            motorPrice = f1Costs.motorCost; // (bQty*160 + wQty*130)
            remote1chPrice = f1Costs.remote1chCost;
            remote16chPrice = f1Costs.remote16chCost;
            chargerPrice = f1Costs.chargerCost;
            cord3mPrice = f1Costs.cordCost;
            wifiHubPrice = f1Costs.wifiCost;
            // eAcceSum for Work Order (Sum of Costs)
            eAcceSum = motorPrice + remote1chPrice + remote16chPrice + chargerPrice + cord3mPrice + wifiHubPrice;

        } else {
            // --- Quote: Use SALES PRICES ---
            // Motor Sales Price: (bQty * 250) + (wQty * 200)
            // We can re-use the logic from calculateF2Summary which does exactly this for 'calculatedMotorPrice'
            motorPrice = summaryData.calculatedMotorPrice;

            // Other Accessories Sales Prices
            // Use helper `calculateAccessorySalePrice` which handles standard pricing (e.g. remote=$100)

            // Remote 1CH
            remote1chPrice = this.calculateAccessorySalePrice(currentProductType, 'ele_rem_1ch_linx', { count: remote1chQty });

            // Remote 16CH
            remote16chPrice = this.calculateAccessorySalePrice(currentProductType, 'ele_rem_16ch_linx', { count: remote16chQty });

            // Charger
            chargerPrice = this.calculateAccessorySalePrice(currentProductType, 'ele_charger', { count: chargerQty });

            // Cord
            cord3mPrice = this.calculateAccessorySalePrice(currentProductType, 'cord', { count: cord3mQty });

            // [MODIFIED] (Phase 4.6a) Get WiFi Sale Price from ConfigManager
            const wifiSalePrice = this.configManager.getAccessoryPrice('wifiHub') || 300;
            wifiHubPrice = wifiHubQty * wifiSalePrice;

            // eAcceSum for Quote (Sum of Sales Prices)
            eAcceSum = motorPrice + remote1chPrice + remote16chPrice + chargerPrice + cord3mPrice + wifiHubPrice;
        }

        // [NEW] (Phase 8) F1 costs for Work Order table
        // These are specifically "Work Order" costs, so they always use F1 data.
        // 1. RB Cost
        const retailTotal = quoteData.products.rollerBlind.summary.totalSum || 0;
        const discountPercentage = ui.f1.discountPercentage || 0;
        const f1_rb_price = retailTotal * (1 - (discountPercentage / 100));
        // 2. Acce. Cost (excluding E-item)
        const acce_total = f1Costs.winderCost + f1Costs.dualComboCost + f1Costs.slimCost;
        // 3. F1 Total Cost
        const f1_sub_total = f1Costs.componentTotal + f1_rb_price;


        // [MODIFIED] Read from the liveQuoteData object instead of f3Data(DOM)
        let documentTitleParts = [];
        if (liveQuoteData.quoteId) documentTitleParts.push(liveQuoteData.quoteId);
        if (liveQuoteData.customer.name) documentTitleParts.push(liveQuoteData.customer.name);
        if (liveQuoteData.customer.phone) documentTitleParts.push(liveQuoteData.customer.phone);
        const documentTitle = documentTitleParts.join(' ');

        return {
            documentTitle: documentTitle,
            quoteId: liveQuoteData.quoteId,
            issueDate: liveQuoteData.issueDate,
            dueDate: liveQuoteData.dueDate,
            customerName: liveQuoteData.customer.name, // [MODIFIED]
            // [NEW] (Phase 10.6) Combined first+last name for Work Order header
            customerFullName: `${liveQuoteData.customer.firstName || ''} ${liveQuoteData.customer.lastName || ''}`.trim() || liveQuoteData.customer.name || 'TBA',
            customerAddress: liveQuoteData.customer.address, // [MODIFIED]
            customerPhone: liveQuoteData.customer.phone, // [MODIFIED]
            customerEmail: liveQuoteData.customer.email, // [MODIFIED]

            // [NEW] (Phase 10.8) Dynamic PDF filename: [QuoteNo]_[Name]_[Phone].pdf
            pdfFileName: (() => {
                const fn = (liveQuoteData.customer.firstName || '').trim();
                const ln = (liveQuoteData.customer.lastName || '').trim();
                const ph = (liveQuoteData.customer.phone || '').trim();
                const qn = liveQuoteData.quoteId || 'WO';
                let fileNameName = fn || ln || 'customer';
                let name = `${qn}_${fileNameName}`;
                if (ph) name += `_${ph}`;
                return name;
            })(),

            // [MODIFIED] (Phase 4) All totals are now based on the new grandTotal
            subtotal: `$${(summaryData.sumPrice || 0).toFixed(2)}`,
            gst: `$${gstValue.toFixed(2)}`,
            grandTotal: `$${grandTotal.toFixed(2)}`,

            // [FIX v6291] Step 5: Ensure ourOffer is passed correctly
            ourOffer: `$${newOfferValue.toFixed(2)}`,

            // [MODIFIED v6290 Task 3] Use correct values from F2 state
            deposit: `$${(depositValue || 0).toFixed(2)}`,
            balance: `$${(balanceValue || 0).toFixed(2)}`,

            savings: `$${((summaryData.firstRbPrice || 0) - (summaryData.disRbPrice || 0)).toFixed(2)}`,
            generalNotes: (liveQuoteData.generalNotes || '').replace(/\n/g, '<br>'), // [MODIFIED]
            termsAndConditions: (liveQuoteData.termsConditions || 'Standard terms and conditions apply.').replace(/\n/g, '<br>'), // [MODIFIED]


            // Data for the detailed list (Appendix)
            items: items,
            mulTimes: summaryData.mulTimes || 1,

            // [MODIFIED] (Phase 7) Data for the accessories table (Appendix / Work Order)
            motorQty: motorQty,
            motorPrice: formatPrice(motorPrice), // [FIX] Depends on isWorkOrder flag
            remote1chQty: remote1chQty,
            remote1chPrice: formatPrice(remote1chPrice),
            remote16chQty: remote16chQty,
            remote16chPrice: formatPrice(remote16chPrice),
            chargerQty: chargerQty,
            chargerPrice: formatPrice(chargerPrice),
            cord3mQty: cord3mQty,
            cord3mPrice: formatPrice(cord3mPrice),
            wifiHubQty: wifiHubQty, // [NEW] (v6295)
            wifiHubPrice: formatPrice(wifiHubPrice), // [NEW] (v6295)

            eAcceSum: formatPrice(eAcceSum), // [FIX] Depends on isWorkOrder flag

            // [NEW] (Phase 8) F1 costs for Work Order table (Always Costs)
            wo_rb_price: formatPrice(f1_rb_price),
            wo_acce_price: formatPrice(acce_total),
            // 'eAcceSum' (wo_e_item_price) already passed above
            wo_total_price: formatPrice(f1_sub_total),

            // Pass the entire summary for flexibility
            summaryData: summaryData,
            uiState: ui
        };
    }
}