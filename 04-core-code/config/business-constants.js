/* FILE: 04-core-code/config/business-constants.js */
// [NEW] (Stage 9 - Business Logic Constantization)
// This file serves as the Single Source of Truth for all business-related magic strings.
// NOTE: The values defined here MUST match the raw strings currently stored in JSON/CSV files
// to ensure backward compatibility.

export const PRODUCT_TYPES = {
    ROLLER_BLIND: 'rollerBlind'
};

export const COMPONENT_CODES = {
    WINDER_HD: 'HD',
    DUAL_BRACKET: 'D',
    MOTOR: 'Motor',     // Stored in item.motor
    CHAIN: 'Chain',     // Used in UI/Logic context
    WINDER: 'Winder',   // Used in UI/Logic context
    REMOTE: 'Remote',
    CHARGER: 'Charger',
    CORD: '3MCord'
};

export const MOUNT_TYPES = {
    IN_RECESS: 'IN',
    FACE_FIX: 'OUT',
    CONTROL_LEFT: 'L',
    CONTROL_RIGHT: 'R',
    ROLL_OVER: 'O',
    ROLL_UNDER: '' // Default is empty string
};

// Keys used in Price Matrix and Item.fabricType
export const FABRIC_CODES = {
    B1: 'B1',
    B2: 'B2',
    B3: 'B3',
    B4: 'B4',
    B5: 'B5',
    SN: 'SN'
};

// Codes used for Logic Processing (e.g. DataPreparationService, K2 Views)
export const LOGIC_CODES = {
    LIGHT_FILTER: 'LF',
    BLOCKOUT: 'BO',
    SCREEN: 'SN',
    // Edit Modes
    MODE_LF: 'LF',
    MODE_LF_DEL: 'LFD',
    MODE_SSET: 'SSet'
};

// Keys used in F1/F4 UI for accessory identification
export const ACCESSORY_KEYS = {
    WINDER: 'winder',
    MOTOR: 'motor',
    REMOTE: 'remote',
    CHARGER: 'charger',
    CORD: 'cord',
    DUAL: 'dual',
    CHAIN: 'chain'
};