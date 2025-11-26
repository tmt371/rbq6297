/* FILE: 04-core-code/config/regex.js */
// [NEW] (Stage 9 Phase 4) Centralized Regex definitions to avoid DRY violations.

export const REGEX = {
    // Matches invisible Unicode characters (e.g., Zero Width Space, Left-To-Right Mark, BOM)
    // Ranges: U+200B-U+200F, U+202A-U+202E, U+2060-U+206F, U+FEFF
    INVISIBLE_CHAR: /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g
};