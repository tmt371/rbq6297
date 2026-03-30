// /04-core-code/config/f2-config.js
// [DEPRECATED] unitPrices in this file are NO LONGER the pricing authority.
// Fee defaults are now served by ConfigManager.getFees() (Firestore/JSON source).
// This object is retained for structural compatibility but all values are intentionally zeroed.

export const f2Config = {
    unitPrices: {
        wifi: 0,        // DEPRECATED: use configManager.getAccessoryPrice('wifiHub')
        delivery: 0,    // DEPRECATED: was $100 ghost source \u2014 now 0, live value from getFees()
        install: 0,     // DEPRECATED: live value from getFees()
        removal: 0,     // DEPRECATED: live value from getFees()
        surcharge: 0
    },
};