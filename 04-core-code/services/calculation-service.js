/* FILE: 04-core-code/services/calculation-service.js */

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
     * [NEW] Maps raw brand values (e.g., 'linx', 'alpha') to display names (e.g., 'Linx', 'Alpha').
     * @param {string} brand - Raw brand identifier.
     * @private
     */
    _mapBrandName(brand) {
        if (!brand) return '';
        const lower = brand.toLowerCase();
        const mapping = {
            'linx': 'Linx',
            'alpha': 'Alpha',
            'tbs': 'TBS',
            'luna': 'Luna'
        };
        return mapping[lower] || (brand.charAt(0).toUpperCase() + brand.slice(1));
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

        let accumulatedWinderQty = 0;
        let accumulatedWinderCost = 0;
        let accumulatedWinderPrice = 0;
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

                if (result.winder && result.winder.hasWinder) {
                    accumulatedWinderQty++;
                    accumulatedWinderCost += result.winder.winderCost;
                    accumulatedWinderPrice += result.winder.winderPrice;
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

        // [PURIFIED] Removed || 130 hardcoded fallback — returns 0 if not found in data
        if (componentKey === 'w-motor') {
            const wMotorCost = this.configManager.getAccessoryPrice('cost-w-motor-linx') || 0;
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

        const productStrategy = this.productFactory.getProductStrategy(quoteData.currentProduct);
        let winderQty = 0;
        let winderTotalCost = 0;
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
        let wMotorQty = ui.f1.w_motor_qty || 0;
        if (wMotorQty > totalMotorQty) wMotorQty = totalMotorQty;
        const bMotorQty = totalMotorQty - wMotorQty;

        const currentMotorBrand = ui.f1?.motorBrand || 'linx';
        const currentRemoteBrand = ui.f1?.remoteBrand || 'linx';

        const bMotorUnitCost = this.configManager.getAccessoryPrice(`cost-b-motor-${currentMotorBrand}`) || 0;
        const wMotorUnitCost = this.configManager.getAccessoryPrice(`cost-w-motor-${currentMotorBrand}`) || 0;
        componentPrices.b_motor = bMotorQty * bMotorUnitCost;
        componentPrices.w_motor = wMotorQty * wMotorUnitCost;

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
        const totalDualPairs = Math.floor(items.filter(item => item.dual === COMPONENT_CODES.DUAL_BRACKET).length / 2);
        const comboQty = (ui.f1.dual_combo_qty === null) ? totalDualPairs : ui.f1.dual_combo_qty;
        const slimQty = (ui.f1.dual_slim_qty === null) ? 0 : ui.f1.dual_slim_qty;
        componentPrices['dual-combo'] = this.calculateF1ComponentPrice('dual-combo', comboQty);
        componentPrices.slim = this.calculateF1ComponentPrice('slim', slimQty);

        // Wifi (Use F1 UI state quantities)
        const wifiQty = ui.f1.wifi_qty || 0;
        componentPrices.wifihub = this.calculateF1ComponentPrice('wifihub', wifiQty);

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

        return {
            winderCost: componentPrices.winder,
            motorCost: componentPrices.motor,
            bMotorCost: componentPrices.b_motor,
            wMotorCost: componentPrices.w_motor,
            remote1chCost: componentPrices['remote-1ch'],
            remote16chCost: componentPrices['remote-16ch'],
            chargerCost: componentPrices.charger,
            cordCost: componentPrices['3m-cord'],
            dualComboCost: componentPrices['dual-combo'],
            slimCost: componentPrices.slim,
            wifiCost: componentPrices.wifihub,
            componentTotal: componentTotal,
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
                hdFree: hdFreeQty,
                hdPaid: hdPaidQty
            }
        };
    }

    /**
         * [PRESERVED] Calculates all values for the F2 summary panel.
         * Contains NaN safety and business rules for delivery, motors, and profits.
         */
    calculateF2Summary(quoteData, uiState, domValues = {}) {
        const currentProductKey = quoteData.currentProduct;
        const items = quoteData.products[currentProductKey].items;
        const productSummary = quoteData.products[currentProductKey].summary;

        // [UNIFIED] Pricing authority now routes through ConfigManager.getFees() (Firestore/JSON source)
        // Replaces the static f2Config.unitPrices import which caused $100 ghost delivery fees.
        const liveFees = this.configManager.getFees();
        const UNIT_PRICES = {
            delivery: liveFees.delivery ?? 0,
            install:  liveFees.install  ?? 0,
            removal:  liveFees.removal  ?? 0,
        };

        const accessories = productSummary.accessories || {};

        const f1State = uiState.f1 || {};
        const f2State = uiState.f2 || {};

        const totalSumFromQuickQuote = Number(productSummary.totalSum) || 0;
        const winderPrice = Number(productSummary.winderEvaluation?.totalPrice) || 0;
        const dualPrice = Number(accessories.dualCostSum) || 0;

        const wifiQty = Number(f1State.wifi_qty) || 0;
        const deliveryQty = Number(f2State.deliveryQty) || 0;
        const installQty = Number(f2State.installQty) || 0;
        const removalQty = Number(f2State.removalQty) || 0;

        let safeMulTimes = Number(f2State.mulTimes);
        if (isNaN(safeMulTimes) || safeMulTimes === 0) {
            safeMulTimes = 1;
        }
        const mulTimes = safeMulTimes;

        const discount = Number(f2State.discount) || 0;

        const totalMotorQty = items.filter(item => !!item.motor).length;
        let wMotorQty = Number(f1State.w_motor_qty) || 0;
        if (wMotorQty > totalMotorQty) wMotorQty = totalMotorQty;
        const bMotorQty = totalMotorQty - wMotorQty;

        const currentMotorBrandF2 = f1State.motorBrand || 'linx';
        const bMotorSalePrice = Number(this.configManager.getAccessoryPrice(`price-b-motor-${currentMotorBrandF2}`)) || 0;
        const wMotorSalePrice = Number(this.configManager.getAccessoryPrice(`price-w-motor-${currentMotorBrandF2}`)) || 0;
        const motorPrice = (bMotorQty * bMotorSalePrice) + (wMotorQty * wMotorSalePrice);

        const currentRemoteBrand = f1State.remoteBrand || 'linx';
        const remote1Qty = Number(f1State.remote_1ch_qty) || 0;
        const remote16Qty = Number(f1State.remote_16ch_qty) || 0;

        const pR1 = Number(this.configManager.getAccessoryPrice(`price-remote-1ch-${currentRemoteBrand}`)) || 0;
        const pR16 = Number(this.configManager.getAccessoryPrice(`price-remote-16ch-${currentRemoteBrand}`)) || 0;
        const calculatedRemotePrice = (remote1Qty * pR1) + (remote16Qty * pR16);

        const chargerQty = Number(uiState.driveChargerCount) || 0;
        // [PURIFIED] Removed || 50 hardcoded fallback
        const pCharger = Number(this.configManager.getAccessoryPrice('price-charger')) || 0;
        const calculatedChargerPrice = chargerQty * pCharger;

        const cordQty = Number(uiState.driveCordCount) || 0;
        const pCord = Number(this.configManager.getAccessoryPrice('cost-3mcord')) || Number(this.configManager.getAccessoryPrice('cord3m')) || 0;
        const calculatedCordPrice = cordQty * pCord;

        // [PURIFIED] Removed || 300 hardcoded fallback
        const wifiSalePrice = Number(this.configManager.getAccessoryPrice('wifiHub')) || 0;
        const wifiSum = wifiQty * wifiSalePrice;

        const getValFromArgsOrDefault = (valFromArg, fallback) => {
            if (valFromArg !== undefined && valFromArg !== null && valFromArg !== '') {
                const val = parseFloat(valFromArg);
                return isNaN(val) ? fallback : val;
            }
            return fallback;
        };

        // [FIX: Waived Sync Dual-Track] Preserve original Data for Strikethrough Rendering
        const isDeliveryWaived = f2State.deliveryFeeExcluded === true;
        const isInstallWaived = f2State.installFeeExcluded === true;
        const isRemovalWaived = f2State.removalFeeExcluded === true;

        const rawDeliveryUnitPrice = getValFromArgsOrDefault(domValues?.deliveryUnitPrice, Number(f2State.deliveryUnitPrice ?? UNIT_PRICES.delivery ?? 0) || 0);
        const rawInstallUnitPrice = getValFromArgsOrDefault(domValues?.installUnitPrice, Number(f2State.installUnitPrice ?? UNIT_PRICES.install ?? 0) || 0);
        const rawRemovalUnitPrice = getValFromArgsOrDefault(domValues?.removalUnitPrice, Number(f2State.removalUnitPrice ?? UNIT_PRICES.removal ?? 0) || 0);

        const rawDeliveryQty = getValFromArgsOrDefault(domValues?.deliveryQty, deliveryQty);
        const rawInstallQty = getValFromArgsOrDefault(domValues?.installQty, installQty);
        const rawRemovalQty = getValFromArgsOrDefault(domValues?.removalQty, removalQty);

        const rawDeliveryFee = rawDeliveryQty * rawDeliveryUnitPrice;
        const rawInstallFee = rawInstallQty * rawInstallUnitPrice;
        const rawRemovalFee = rawRemovalQty * rawRemovalUnitPrice;

        const effectiveDeliveryFee = isDeliveryWaived ? 0 : rawDeliveryFee;
        const effectiveInstallFee = isInstallWaived ? 0 : rawInstallFee;
        const effectiveRemovalFee = isRemovalWaived ? 0 : rawRemovalFee;

        const acceSum = winderPrice + dualPrice;
        const eAcceSum = motorPrice + calculatedRemotePrice + calculatedChargerPrice + calculatedCordPrice + wifiSum;

        const surchargeFee = effectiveDeliveryFee + effectiveInstallFee + effectiveRemovalFee;

        const firstRbPrice = totalSumFromQuickQuote * mulTimes;
        const disRbPriceValue = firstRbPrice * (1 - (discount / 100));
        const disRbPrice = Math.round(disRbPriceValue * 100) / 100;

        const f2_17_pre_sum = acceSum + eAcceSum + surchargeFee;
        const sumPrice = disRbPrice + f2_17_pre_sum;

        const f1SubTotal = Number(f1State.f1_subTotal) || 0;
        const f1_final_total = Number(f1State.f1_finalTotal) || 0;

        const f1DiscountPercentage = Number(f1State.discountPercentage) || 0;
        const retailTotalFromF1 = Number(quoteData.products?.rollerBlind?.summary?.totalSum) || 0;
        const f1_rb_price = retailTotalFromF1 * (1 - (f1DiscountPercentage / 100));

        const rbProfit = disRbPrice - f1_rb_price;
        const validItemCount = items.filter(item => typeof item.linePrice === 'number' && item.linePrice > 0).length;
        const singleprofit = validItemCount > 0 ? rbProfit / validItemCount : 0;

        const sumProfit = sumPrice - f1SubTotal;
        const old_gst = sumPrice * 1.1;

        // [HOTFIX] 防止舊狀態污染 Our Offer。只有當手寫價格大於 0 時才採用，否則一律採用最新計算出的 sumPrice。
        const rawNewOffer = Number(f2State.newOffer);
        const newOffer = (rawNewOffer > 0) ? rawNewOffer : sumPrice;
        const potential_gst = newOffer * 0.1;
        const actual_gst = f2State.gstExcluded ? 0 : potential_gst;
        const grandTotal = newOffer + actual_gst;

        const taxExclusiveTotal = newOffer;

        const netProfit = f2State.gstExcluded
            ? grandTotal - f1SubTotal
            : grandTotal - f1_final_total;

        return {
            totalSumForRbTime: totalSumFromQuickQuote,
            wifiSum,
            deliveryQty: rawDeliveryQty,
            installQty: rawInstallQty,
            removalQty: rawRemovalQty,
            deliveryUnitPrice: rawDeliveryUnitPrice,
            installUnitPrice: rawInstallUnitPrice,
            removalUnitPrice: rawRemovalUnitPrice,
            deliveryFee: rawDeliveryFee,
            installFee: rawInstallFee,
            removalFee: rawRemovalFee,
            effectiveDeliveryFee,
            effectiveInstallFee,
            effectiveRemovalFee,
            isDeliveryWaived,
            isInstallWaived,
            isRemovalWaived,
            acceSum,
            eAcceSum,
            firstRbPrice,
            disRbPrice,
            sumPrice,
            rbProfit,
            singleprofit,
            sumProfit: sumProfit,
            gst: old_gst,
            f2_17_pre_sum: f2_17_pre_sum,
            newOffer: newOffer,
            new_gst: actual_gst,
            grandTotal: grandTotal,
            netProfit: netProfit,
            taxExclusiveTotal: taxExclusiveTotal,
            mulTimes,
            calculatedMotorPrice: motorPrice,
            motorPrice: motorPrice,
            remotePrice: calculatedRemotePrice,
            chargerPrice: calculatedChargerPrice,
            cordPrice: calculatedCordPrice,
        };
    }

    /**
     * [NEW v3.35 Patch] 補完遺失的 UI 更新函數
     * 解決 F3 視圖在輸入資料時因為找不到此函數而卡死報錯的問題。
     */
    updateGrandTotal(value) {
        const numericValue = Number(value) || 0;
        console.log("🔄 [CalculationService] Syncing UI Grand Total:", numericValue);

        // 確保 F3 View 底部的 setTotalSum 全局函數被觸發
        if (typeof setTotalSum === 'function') {
            setTotalSum(numericValue);
        }

        // 更新 StateService 中的 UI 狀態
        if (this.stateService) {
            const state = this.stateService.getState();
            this.stateService.dispatch({
                ...state,
                ui: { ...state.ui, lastCalculatedTotal: numericValue }
            });
        }
    }

    /**
     * [v3.35] THE FIX: Data Truth Alignment.
     * Replaces the old buggy logic while 100% preserving all Work Order and Filename logic.
     * Includes the liveLedger truth check to override UI state.
     */
    getQuoteTemplateData(quoteData, ui, liveQuoteData, isWorkOrder = false, documentType = 'Quotation', receiptData = null, liveLedger = null) {
        // 1. Get F2 *Sales* Total
        const summaryData = this.calculateF2Summary(quoteData, ui);
        // 2. Get F1 *Cost* Total
        const f1Costs = this.calculateF1Costs(quoteData, ui);

        const currentProductType = quoteData.currentProduct;

        const hasRealProducts = (summaryData.sumPrice || 0) > 0;

        // --- [PHASE I.6] Hybrid Data Sourcing Architecture ---
        let uiOurOffer, gstValue, grandTotal, depositValue, balanceValue;
        let payments = [];

        // 1. Determine Source of Truth for Order Baseline
        if (!isWorkOrder && liveLedger && liveLedger.exists) {
            grandTotal = Number(liveLedger.totalAmount) || 0;
            uiOurOffer = (ui.f2.newOffer !== null && ui.f2.newOffer !== undefined) ? Number(ui.f2.newOffer) : (summaryData.sumPrice || 0);
            gstValue = grandTotal - uiOurOffer;
            payments = liveLedger.payments || [];
        } else {
            uiOurOffer = (ui.f2.newOffer !== null && ui.f2.newOffer !== undefined) ? Number(ui.f2.newOffer) || 0 : (summaryData.sumPrice || 0);
            gstValue = ui.f2.gst || 0;
            grandTotal = summaryData.grandTotal || 0;
            payments = liveQuoteData?.metadata?.payments || [];
        }

        // 2. Cumulative Payment Calculation (The Source of Truth for Balance Due)
        const actualTotalPaidNumber = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const dynamicBalanceNumber = grandTotal - actualTotalPaidNumber;

        // 3. Flags for Generator Logic
        const hasPayments = actualTotalPaidNumber > 0;
        const isGstActive = gstValue > 0 || !!ui.f2.gstIncluded;

        // 4. Payment History String for Notes
        let paymentHistoryString = "";
        if (hasPayments) {
            paymentHistoryString = "<b>Payment History:</b><br>";
            payments.forEach(p => {
                const dateParts = p.date.split('-');
                const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0].slice(-2)}` : p.date;
                paymentHistoryString += `- ${formattedDate}: $${Number(p.amount).toFixed(2)}<br>`;
            });
            paymentHistoryString += "<hr>";
        }

        const items = quoteData.products.rollerBlind.items;
        // [PURIFIED] formatPrice removed from service layer — formatting belongs in the Strategy/Renderer

        // --- Determine Item Prices (Cost vs Sales) ---
        let motorPrice, remote1chPrice, remote16chPrice, chargerPrice, cord3mPrice, wifiHubPrice, eAcceSum;

        const motorQty = f1Costs.qtys.motor || 0;
        const remote1chQty = f1Costs.qtys.remote1ch || 0;
        const remote16chQty = f1Costs.qtys.remote16ch || 0;
        const chargerQty = f1Costs.qtys.charger || 0;
        const cord3mQty = f1Costs.qtys.cord || 0;
        const wifiHubQty = f1Costs.qtys.wifi || 0;

        if (isWorkOrder) {
            motorPrice = f1Costs.motorCost;
            remote1chPrice = f1Costs.remote1chCost;
            remote16chPrice = f1Costs.remote16chCost;
            chargerPrice = f1Costs.chargerCost;
            cord3mPrice = f1Costs.cordCost;
            wifiHubPrice = f1Costs.wifiCost;
            eAcceSum = (f1Costs.bMotorCost || 0) + (f1Costs.wMotorCost || 0) +
                (f1Costs.remote1chCost || 0) + (f1Costs.remote16chCost || 0) +
                (f1Costs.chargerCost || 0) + (f1Costs.cordCost || 0) +
                (f1Costs.wifiCost || 0) + (f1Costs.winderCost || 0) +
                (f1Costs.dualComboCost || 0) + (f1Costs.slimCost || 0);
        } else {
            motorPrice = summaryData.calculatedMotorPrice;
            remote1chPrice = this.calculateAccessorySalePrice(currentProductType, 'ele_rem_1ch_linx', { count: remote1chQty });
            remote16chPrice = this.calculateAccessorySalePrice(currentProductType, 'ele_rem_16ch_linx', { count: remote16chQty });
            chargerPrice = this.calculateAccessorySalePrice(currentProductType, 'ele_charger', { count: chargerQty });
            cord3mPrice = this.calculateAccessorySalePrice(currentProductType, 'cord', { count: cord3mQty });
            // [PURIFIED] Removed || 300 hardcoded fallback
            const wifiSalePrice = this.configManager.getAccessoryPrice('wifiHub') || 0;
            wifiHubPrice = wifiHubQty * wifiSalePrice;
            eAcceSum = motorPrice + remote1chPrice + remote16chPrice + chargerPrice + cord3mPrice + wifiHubPrice;
        }

        const retailTotal = quoteData.products.rollerBlind.summary.totalSum || 0;
        const discountPercentage = ui.f1.discountPercentage || 0;
        const f1_rb_price = retailTotal * (1 - (discountPercentage / 100));
        const acce_total = f1Costs.winderCost + f1Costs.dualComboCost + f1Costs.slimCost;
        const f1_sub_total = f1Costs.componentTotal + f1_rb_price;

        let documentTitleParts = [];
        if (documentType !== 'Quotation') documentTitleParts.push(documentType);
        if (liveQuoteData.quoteId) documentTitleParts.push(liveQuoteData.quoteId);
        if (liveQuoteData.customer.name) documentTitleParts.push(liveQuoteData.customer.name);
        if (liveQuoteData.customer.phone) documentTitleParts.push(liveQuoteData.customer.phone);
        const documentTitle = documentTitleParts.join(' ');

        return {
            documentTitle: documentTitle,
            documentType: documentType.toUpperCase(),
            receiptRowHtml: '',
            quoteId: liveQuoteData.quoteId,
            issueDate: liveQuoteData.issueDate,
            dueDate: liveQuoteData.dueDate,
            customerName: liveQuoteData.customer.name,
            customerFullName: `${liveQuoteData.customer.firstName || ''} ${liveQuoteData.customer.lastName || ''}`.trim() || liveQuoteData.customer.name || 'TBA',
            customerAddress: liveQuoteData.customer.address,
            customerPhone: liveQuoteData.customer.phone,
            customerEmail: liveQuoteData.customer.email,
            pdfFileName: (() => {
                const fn = (liveQuoteData.customer.firstName || '').trim();
                const ln = (liveQuoteData.customer.lastName || '').trim();
                const ph = (liveQuoteData.customer.phone || '').trim();
                const qn = liveQuoteData.quoteId || 'WO';
                let fileNameName = fn || ln || 'customer';
                let name = `Order ${qn}_${fileNameName}`;
                if (ph) name += `_${ph}`;
                return name;
            })(),
            // [PHASE I.6] Prepared Source-of-Truth Strings
            uiSubtotal: ui.f2.sumPrice || 0,
            uiOurOffer: uiOurOffer,
            uiGst: gstValue,
            uiTotal: grandTotal,
            uiTotalPaid: actualTotalPaidNumber.toFixed(2),
            uiDynamicBalance: dynamicBalanceNumber.toFixed(2),
            uiInitialDeposit: ui.f2.deposit || 0,
            uiBalance: ui.f2.balance || 0,
            hasPayments: hasPayments,
            isGstActive: isGstActive,
            payments: payments,

            subtotal: summaryData.sumPrice || 0,
            gst: gstValue,
            grandTotal: grandTotal,
            ourOffer: uiOurOffer,
            deposit: actualTotalPaidNumber,
            balance: dynamicBalanceNumber,
            savings: (summaryData.firstRbPrice || 0) - (summaryData.disRbPrice || 0),
            generalNotes: (paymentHistoryString + (liveQuoteData.generalNotes || '')).replace(/\n/g, '<br>'),
            termsAndConditions: (liveQuoteData.termsConditions || 'Standard terms and conditions apply.').replace(/\n/g, '<br>'),
            items: items,
            mulTimes: summaryData.mulTimes || 1,

            // --- [NEW] v3.47 Fee Exports mapping for PDF ---
            deliveryExcluded: summaryData.isDeliveryWaived || false,
            installExcluded: summaryData.isInstallWaived || false,
            removalExcluded: summaryData.isRemovalWaived || false,
            isDeliveryWaived: summaryData.isDeliveryWaived || false,
            isInstallWaived: summaryData.isInstallWaived || false,
            isRemovalWaived: summaryData.isRemovalWaived || false,
            deliveryQty: summaryData.deliveryQty || 0,
            deliveryUnitPrice: summaryData.deliveryUnitPrice || 0,
            deliveryFee: summaryData.deliveryFee || 0,
            installQty: summaryData.installQty || 0,
            installUnitPrice: summaryData.installUnitPrice || 0,
            installFee: summaryData.installFee || 0,
            removalQty: summaryData.removalQty || 0,
            removalUnitPrice: summaryData.removalUnitPrice || 0,
            removalFee: summaryData.removalFee || 0,

            // [PURIFIED] All price fields returned as raw numbers (no $ prefix or .toFixed formatting)
            motorQty, motorPrice: motorPrice || 0,
            remote1chQty, remote1chPrice: remote1chPrice || 0,
            remote16chQty, remote16chPrice: remote16chPrice || 0,
            chargerQty, chargerPrice: chargerPrice || 0,
            cord3mQty, cord3mPrice: cord3mPrice || 0,
            wifiHubQty, wifiHubPrice: wifiHubPrice || 0,
            bmotorQty: f1Costs.qtys.b_motor || 0,
            bmotorPrice: f1Costs.bMotorCost || 0,
            wmotorQty: f1Costs.qtys.w_motor || 0,
            wmotorPrice: f1Costs.wMotorCost || 0,
            hdWinderQty: f1Costs.qtys.hdPaid || 0,
            hdWinderPrice: f1Costs.winderCost || 0,
            dualComboQty: f1Costs.qtys.combo || 0,
            dualComboPrice: f1Costs.dualComboCost || 0,
            dualSlimQty: f1Costs.qtys.slim || 0,
            dualSlimPrice: f1Costs.slimCost || 0,
            bracketQty: 0, bracketPrice: 0,
            eAcceSum: eAcceSum || 0,

            // --- [NEW] Brand Mapping for Document Summaries (Motor, Remote, WiFi) ---
            motorBrand: this._mapBrandName(ui.f1?.motorBrand),
            remoteBrand: this._mapBrandName(ui.f1?.remoteBrand),
            wifiBrand: this._mapBrandName(ui.f1?.wifiBrand),

            wo_rb_price: Number(ui.f2.disRbPrice || 0).toFixed(2),
            wo_acce_price: Number((ui.f2.acceSum || 0) + (ui.f2.eAcceSum || 0)).toFixed(2),
            wo_total_price: Number(ui.f2.grandTotal || 0).toFixed(2),
            summaryData: summaryData,
            uiState: ui
        };
    }
}
