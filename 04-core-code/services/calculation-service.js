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
            totalSum: itemsTotal + accessoriesTotal
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
        const priceKey = accessoryPriceKeyMap[accessoryName];

        if (!priceKey) {
            console.error(`No sale price key found for accessory: ${accessoryName}`);
            return 0;
        }

        const pricePerUnit = this.configManager.getAccessoryPrice(priceKey);
        if (pricePerUnit === null) return 0;

        const methodName = accessoryMethodNameMap[accessoryName];

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

        // [NEW] (F1 Motor Split) Special handling for W-Motor cost ($130)
        if (componentKey === 'w-motor') {
            return quantity * 130;
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

        // Winder
        // [MODIFIED] Use constant
        const winderQty = items.filter(item => item.winder === COMPONENT_CODES.WINDER_HD).length;
        componentPrices.winder = this.calculateF1ComponentPrice('winder', winderQty);

        // Motor (Total)
        const totalMotorQty = items.filter(item => !!item.motor).length;

        // [NEW] (F1 Motor Split) Logic
        // W-Motor Qty comes from UI state (set via dialog)
        let wMotorQty = ui.f1.w_motor_qty || 0;
        // Clamp W-Motor Qty to Total Motor Qty (cannot exceed total)
        if (wMotorQty > totalMotorQty) wMotorQty = totalMotorQty;
        // B-Motor Qty is the remainder
        const bMotorQty = totalMotorQty - wMotorQty;

        // Calculate Costs
        // B-Motor Cost: $160 (Standard)
        componentPrices.b_motor = this.calculateF1ComponentPrice('motor', bMotorQty);
        // W-Motor Cost: $130 (Special)
        componentPrices.w_motor = this.calculateF1ComponentPrice('w-motor', wMotorQty);

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
        componentPrices['remote-1ch'] = this.calculateF1ComponentPrice('remote-1ch', remote1chQty);
        componentPrices['remote-16ch'] = this.calculateF1ComponentPrice('remote-16ch', remote16chQty);

        // Charger (Use K4 UI state quantities)
        const chargerQty = ui.driveChargerCount || 0;
        componentPrices.charger = this.calculateF1ComponentPrice('charger', chargerQty);

        // 3M Cord (Use K4 UI state quantities)
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
                motor: totalMotorQty, // Total
                b_motor: bMotorQty, // [NEW]
                w_motor: wMotorQty, // [NEW]
                remote1ch: remote1chQty,
                remote16ch: remote16chQty,
                charger: chargerQty,
                cord: cordQty,
                combo: comboQty,
                slim: slimQty,
                wifi: wifiQty
            }
        };
    }


    /**
     * Calculates all values for the F2 summary panel.
     */
    calculateF2Summary(quoteData, uiState) {
        const currentProductKey = quoteData.currentProduct;
        const items = quoteData.products[currentProductKey].items;
        const productSummary = quoteData.products[currentProductKey].summary;
        const totalSumFromQuickQuote = productSummary.totalSum || 0;

        const f2Config = this.configManager.getF2Config();
        const UNIT_PRICES = f2Config.unitPrices || {};

        const accessories = productSummary.accessories || {};
        const winderPrice = accessories.winderCostSum || 0;
        const dualPrice = accessories.dualCostSum || 0;

        // [MODIFIED] (F1 Motor Split) Calculate Motor Sale Price dynamically here
        const totalMotorQty = items.filter(item => !!item.motor).length;
        let wMotorQty = uiState.f1.w_motor_qty || 0;
        if (wMotorQty > totalMotorQty) wMotorQty = totalMotorQty;
        const bMotorQty = totalMotorQty - wMotorQty;

        // Sale Prices: B=$250, W=$200
        const motorPrice = (bMotorQty * 250) + (wMotorQty * 200);

        const remotePrice = accessories.remoteCostSum || 0;
        const chargerPrice = accessories.chargerCostSum || 0;
        const cordPrice = accessories.cordCostSum || 0;

        const f1State = uiState.f1;
        const f2State = uiState.f2;

        const wifiQty = uiState.f1.wifi_qty || 0; // [MODIFIED] (v6295) Get Wifi Qty from F1 state
        const deliveryQty = f2State.deliveryQty || 0;
        const installQty = f2State.installQty || 0;
        const removalQty = f2State.removalQty || 0;
        const mulTimes = (f2State.mulTimes === null || f2State.mulTimes === undefined) ? 1 : f2State.mulTimes;
        const discount = f2State.discount || 0;

        const wifiSum = wifiQty * 300; // [MODIFIED] (v6295) Use $300 sale price
        const deliveryFee = deliveryQty * UNIT_PRICES.delivery;
        const installFee = installQty * UNIT_PRICES.install;
        const removalFee = removalQty * UNIT_PRICES.removal;

        const acceSum = winderPrice + dualPrice;
        // [MODIFIED] Use the calculated motorPrice (Sales Price) instead of motorCostSum from accessories
        const eAcceSum = motorPrice + remotePrice + chargerPrice + cordPrice + wifiSum;

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

        // --- [MODIFIED] (F1/F2 Refactor Phase 3) ---
        // --- Start: Read F1 Cost Totals from State (Refactored) ---
        // Read the pre-calculated cost totals directly from the UI state.
        const f1SubTotal = uiState.f1.f1_subTotal || 0;
        const f1_final_total = uiState.f1.f1_finalTotal || 0;
        // --- End: Read F1 Cost Totals from State ---

        // [MODIFIED] (F1/F2 Refactor Phase 3) We must still calculate f1_rb_price
        // because it is used for the "RB Profit" calculation.
        const f1DiscountPercentage = f1State.discountPercentage || 0;
        const retailTotalFromF1 = quoteData.products.rollerBlind.summary.totalSum || 0;
        const f1_rb_price = retailTotalFromF1 * (1 - (f1DiscountPercentage / 100));
        // --- End of modification ---

        const rbProfit = disRbPrice - f1_rb_price;
        const validItemCount = items.filter(item => typeof item.linePrice === 'number' && item.linePrice > 0).length;
        const singleprofit = validItemCount > 0 ? rbProfit / validItemCount : 0;

        // [MODIFIED] (Phase 2) Keep old calculations for compatibility
        const sumProfit = sumPrice - f1SubTotal; // Old `sumProfit` (REMOVED IN PHASE 3)
        const old_gst = sumPrice * 1.1; // Old `gst` (GST-inclusive total) for getQuoteTemplateData

        // [MODIFIED] (Phase 2) New calculations based on `newOffer`
        const newOffer = (f2State.newOffer !== null && f2State.newOffer !== undefined) ? f2State.newOffer : sumPrice;

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
            new_gst: potential_gst, // [MODIFIED] Always return the potential_gst for display
            grandTotal: grandTotal,
            netProfit: netProfit, // (new value for f2-b25)

            // [NEW] (Accounting V2 Phase 2)
            taxExclusiveTotal: taxExclusiveTotal,

            mulTimes, // [FIX] Add mulTimes to the return object so its value can be persisted.

            // [NEW] Return calculated motor price so F2 view can render it (overriding default K4 calculation)
            calculatedMotorPrice: motorPrice
        };
    }

    /**
     * [NEW] Gathers all necessary data for the quote template.
     * This method is the new home for the logic previously in QuoteGeneratorService._prepareTemplateData.
     * @param {object} quoteData - The *original* quote data from the state (used for items).
     * @param {object} ui - The current UI state.
     * @param {object} liveQuoteData - The *live, up-to-date* quoteData, passed from workflow service.
     * @returns {object} A comprehensive data object ready for template population.
     */
    getQuoteTemplateData(quoteData, ui, liveQuoteData) {
        // [MODIFIED] (Phase 7) 
        // 1. Get F2 *Sales* Total
        const summaryData = this.calculateF2Summary(quoteData, ui);
        // 2. Get F1 *Cost* Total
        const f1Costs = this.calculateF1Costs(quoteData, ui);

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

        // [NEW] (Phase 7) Use F1 cost components (f1Costs) for QTY and Cost
        const motorQty = f1Costs.qtys.motor || '';

        // [MODIFIED] (Stage 9 Fix WorkOrder Cost)
        // For Work Order / Gen-Order, we must use COST Price (F1), NOT Sales Price (F2).
        // Previously we hardcoded (b*250 + w*200). Now we use the cost calculated by calculateF1Costs.
        const motorPrice = f1Costs.motorCost; // This is (bQty*160 + wQty*130)

        const remote1chQty = f1Costs.qtys.remote1ch || '';
        const remote1chPrice = f1Costs.remote1chCost; // F1 cost

        const remote16chQty = f1Costs.qtys.remote16ch || '';
        const remote16chPrice = f1Costs.remote16chCost; // F1 cost

        const chargerQty = f1Costs.qtys.charger || '';
        const chargerPrice = f1Costs.chargerCost; // F1 cost

        const cord3mQty = f1Costs.qtys.cord || '';
        const cord3mPrice = f1Costs.cordCost; // F1 cost

        const wifiHubQty = f1Costs.qtys.wifi || '';
        const wifiHubPrice = f1Costs.wifiCost; // F1 cost

        // [MODIFIED] (Stage 9 Fix WorkOrder Cost) Recalculate eAcceSum using the COST motor price
        // Note: All other items (remote, etc.) are already Costs derived from f1Costs.
        const eAcceSum = motorPrice + remote1chPrice + remote16chPrice + chargerPrice + cord3mPrice + wifiHubPrice;

        // [NEW] (Phase 8) Calculate detailed F1 costs for Work Order table
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
            customerAddress: liveQuoteData.customer.address, // [MODIFIED]
            customerPhone: liveQuoteData.customer.phone, // [MODIFIED]
            customerEmail: liveQuoteData.customer.email, // [MODIFIED]

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
            motorPrice: formatPrice(motorPrice), // [FIX] Now uses COST Price ($160/$130)
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

            eAcceSum: formatPrice(eAcceSum), // [FIX] Now uses COST Total

            // [NEW] (Phase 8) F1 costs for Work Order table
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