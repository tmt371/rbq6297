// /04-core-code/config-manager.js
// [MODIFIED] (Phase 6.3) Refactored to read from Firebase SSOT with local JSON fallback.
import { f2Config } from './config/f2-config.js';
import { paths } from './config/paths.js';
import { EVENTS } from './config/constants.js';
// [NEW] Phase 6.3: Firebase imports for Firestore read
import { db } from './config/firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

export class ConfigManager {
    constructor(eventAggregator) {
        this.eventAggregator = eventAggregator;
        this.priceMatrices = null;
        this.accessories = null;
        this.motors = null;
        this.f2Config = f2Config || {};
        this.fabricTypeSequence = null;
        this.businessRules = null;
        this.isInitialized = false;
    }

    async loadPriceMatrices(forceRefresh = false) {
        return this.initialize(forceRefresh);
    }

    // [MODIFIED] Phase 6.3: Try Firestore SSOT first, fallback to local JSON
    async initialize(forceRefresh = false) {
        if (!forceRefresh && this.isInitialized) return;

        let data = null;
        let source = '';

        // --- Attempt 1: Firestore SSOT ---
        try {
            const docRef = doc(db, 'pricing_data', 'v2_matrix');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                data = docSnap.data();
                source = 'Firestore';

                // [CRITICAL] Restore 2D price arrays from Firestore Objects
                // During seeding (Phase 6.2c), we converted prices[][] → prices{0:[], 1:[]}
                // We must reverse this transformation for calculation-service compatibility.
                if (data.matrices) {
                    for (const fabricKey in data.matrices) {
                        const pricesData = data.matrices[fabricKey].prices;
                        if (pricesData && typeof pricesData === 'object' && !Array.isArray(pricesData)) {
                            // Convert indexed object back to 2D array
                            const keys = Object.keys(pricesData).sort((a, b) => Number(a) - Number(b));
                            data.matrices[fabricKey].prices = keys.map(k => pricesData[k]);
                        }
                    }
                }
                console.log(`✅ ConfigManager: Data loaded from ${source}.`);
            } else {
                console.warn("⚠️ ConfigManager: Firestore document 'pricing_data/v2_matrix' not found. Falling back to local JSON.");
            }
        } catch (firestoreError) {
            console.warn("⚠️ ConfigManager: Firestore read failed, falling back to local JSON.", firestoreError.message);
        }

        // --- Attempt 2: Local JSON Fallback ---
        if (!data) {
            try {
                const response = await fetch(paths.data.priceMatrix);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                data = await response.json();
                source = 'Local JSON';
                console.log(`✅ ConfigManager: Data loaded from ${source} (fallback).`);
            } catch (jsonError) {
                console.error("❌ ConfigManager: Both Firestore and local JSON failed.", jsonError);
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Error: Could not load the price list!', type: 'error' });
                return;
            }
        }

        // --- Apply data ---
        this.priceMatrices = data.matrices;
        this.motors = data.motors || [];
        this.accessories = data.accessories || [];
        this.fabricTypeSequence = data.fabricTypeSequence || [];
        this.businessRules = data.businessRules || {};
        // [NEW] Phase 8.1: Store fees with local defaults
        this.fees = data.fees || { delivery: 100, install: 20, removal: 20 };
        this.isInitialized = true;
        console.log(`ConfigManager initialized successfully from ${source} (V2).`);
    }

    // [NEW] Phase 8.1: Get fee unit prices (from Firestore or local defaults)
    getFees() {
        return this.fees || { delivery: 100, install: 20, removal: 20 };
    }

    getPriceMatrix(fabricType) {
        if (!this.isInitialized || !this.priceMatrices) {
            console.error("ConfigManager not initialized or matrices not loaded.");
            return null;
        }

        const matrix = this.priceMatrices[fabricType];

        if (matrix && matrix.aliasFor) {
            const aliasTargetMatrix = this.priceMatrices[matrix.aliasFor];
            if (aliasTargetMatrix) {
                return { ...aliasTargetMatrix, name: matrix.name };
            } else {
                console.error(`Alias target '${matrix.aliasFor}' not found for fabric type '${fabricType}'.`);
                return null;
            }
        }

        return matrix || null;
    }

    /**
     * [MODIFIED] (Phase 5.9) Looks up a price from the V2 arrays by a structured key.
     * Supports legacy flat keys for backward compatibility with calculation-service.
     * Key format examples:
     *   - Motor cost:  "cost-b-motor-linx" → motors.find(brand=linx, model=Battery Motor).cost
     *   - Motor price: "price-b-motor-linx" → motors.find(brand=linx, model=Battery Motor).price
     *   - Remote cost: "cost-remote-1ch-linx" → accessories.find(id contains rem_1ch_linx).cost
     *   - Accessory:   "cost-charger" → accessories.find(id=ele_charger).cost
     *   - Legacy key:  "wifiHub" → accessories.find(id=ele_wifi_linx).price (fallback)
     */
    getAccessoryPrice(accessoryKey) {
        if (!this.isInitialized) {
            console.error("ConfigManager not initialized.");
            return null;
        }

        // --- Motor lookups: cost-b-motor-{brand}, price-b-motor-{brand}, cost-w-motor-{brand}, price-w-motor-{brand} ---
        const motorMatch = accessoryKey.match(/^(cost|price)-(b|w)-motor-(\w+)$/);
        if (motorMatch) {
            const [, priceType, motorType, brand] = motorMatch;
            const modelName = motorType === 'b' ? 'Battery Motor' : 'Wired Motor';
            const motor = this.motors.find(m => m.brand.toLowerCase() === brand.toLowerCase() && m.model === modelName);
            if (motor) return motor[priceType === 'cost' ? 'cost' : 'price'];
            console.warn(`Motor not found for key: ${accessoryKey}`);
            return null;
        }

        // --- Remote lookups: cost-remote-1ch-{brand}, price-remote-1ch-{brand}, cost-remote-16ch-{brand}, price-remote-16ch-{brand} ---
        const remoteMatch = accessoryKey.match(/^(cost|price)-remote-(1ch|16ch)-(\w+)$/);
        if (remoteMatch) {
            const [, priceType, channel, brand] = remoteMatch;
            const idFragment = `rem_${channel}_${brand.toLowerCase()}`;
            const acc = this.accessories.find(a => a.id.includes(idFragment));
            if (acc) return acc[priceType === 'cost' ? 'cost' : 'price'];
            console.warn(`Remote not found for key: ${accessoryKey}`);
            return null;
        }

        // --- Generic cost lookups: cost-winder, cost-charger, cost-3mcord, cost-combo-dual, cost-slim-dual ---
        const costMap = {
            'cost-winder': 'hdw_winder',
            'cost-charger': 'ele_charger',
            'cost-3mcord': 'hdw_cord3m',
            'cost-combo-dual': 'hdw_combo_dual',
            'cost-slim-dual': 'hdw_slim_dual',
            // [FIX] (Phase 11.3) Aligned key format with regex-based remote lookup path
            'cost-remote-1ch-linx': 'ele_rem_1ch_linx',
            'cost-remote-16ch-linx': 'ele_rem_16ch_linx',
        };
        if (costMap[accessoryKey]) {
            const acc = this.accessories.find(a => a.id === costMap[accessoryKey]);
            if (acc) return acc.cost;
            console.warn(`Accessory cost not found for key: ${accessoryKey}`);
            return null;
        }

        // --- Legacy sell-price lookups (used by roller-blind-strategy and F2 summary) ---
        // [MODIFIED] (Phase 10.3) Added V2 direct ID entries for accessoryPriceKeyMap compatibility
        const priceMap = {
            'winderHD': 'hdw_winder',
            'cord3m': 'hdw_cord3m',
            'comboBracket': 'hdw_combo_dual',
            'slimComboBracket': 'hdw_slim_dual',
            'stainlessSteelChain': 'hdw_ss_chain',
            'price-charger': 'ele_charger',
            'price-cord3m': 'hdw_cord3m',
            'ele_rem_1ch_linx': 'ele_rem_1ch_linx',
            'ele_rem_16ch_linx': 'ele_rem_16ch_linx',
            'ele_charger': 'ele_charger',
            // [FIX] (Phase 11.3) Add missing cord mapping so calculateAccessorySalePrice resolves
            'cord': 'hdw_cord3m',
        };
        if (priceMap[accessoryKey]) {
            const acc = this.accessories.find(a => a.id === priceMap[accessoryKey]);
            if (acc) return acc.price;
            console.warn(`Accessory price not found for key: ${accessoryKey}`);
            return null;
        }

        // --- WiFi Hub lookup ---
        if (accessoryKey === 'wifiHub') {
            // Default to linx wifi hub price
            const acc = this.accessories.find(a => a.id === 'ele_wifi_linx');
            if (acc) return acc.price;
            return 300; // fallback
        }

        console.warn(`Accessory price for '${accessoryKey}' not found in V2 arrays.`);
        return null;
    }

    getFabricTypeSequence() {
        if (!this.isInitialized || !this.fabricTypeSequence) {
            console.error("ConfigManager not initialized or fabricTypeSequence not loaded.");
            return [];
        }
        return this.fabricTypeSequence;
    }

    getF2Config() {
        return this.f2Config;
    }

    // [ADDED] New getter method for validation rules.
    getValidationRules(productType) {
        if (!this.isInitialized || !this.businessRules) return null;
        return this.businessRules.validation?.[productType] || null;
    }

    // [ADDED] New getter method for logic thresholds.
    getLogicThresholds() {
        if (!this.isInitialized || !this.businessRules) return null;
        return this.businessRules.logic || null;
    }

    // [ADDED] New getter method for accessory mappings.
    getAccessoryMappings() {
        if (!this.isInitialized || !this.businessRules) return { accessoryPriceKeyMap: {}, accessoryMethodNameMap: {} };
        return this.businessRules.mappings || { accessoryPriceKeyMap: {}, accessoryMethodNameMap: {} };
    }

    // [ADDED] Phase 5.1b: Accessors for Admin Portal
    getBusinessRules() {
        return this.businessRules || {};
    }

    // [MODIFIED] (Phase 5.9) Returns the full data object including motors and accessories arrays
    getPriceMatrices() {
        return {
            ...(this.priceMatrices || {}),
            motors: this.motors || [],
            accessories: this.accessories || []
        };
    }

    // [NEW] (Phase 5.9) Direct getters for the V2 arrays
    getMotors() {
        return this.motors || [];
    }

    getAccessories() {
        return this.accessories || [];
    }
}