/**
 * @fileoverview Centralized formatting utilities to eliminate redundant logic across services and views.
 */

/**
 * Format a raw number as a currency string.
 * @param {number|string} value - The value to format.
 * @returns {string} - Formatted string prefixed with '$' and 2 decimals. Returns '$0.00' if invalid/null/undefined.
 */
export const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') {
        return '$0.00';
    }
    const num = Number(value);
    return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`;
};

/**
 * Format a Date object or date string to YYYY-MM-DD format.
 * @param {Date|string} date - The date to format.
 * @returns {string} - "YYYY-MM-DD" formatted string or empty string if invalid.
 */
export const formatDateYMD = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

/**
 * Safely parse a value to a number.
 * @param {any} value - The value to parse.
 * @returns {number} - The parsed float, or 0 if invalid.
 */
export const safeNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
};
