/* FILE: 04-core-code/utils/csv-parser.js */
// [MODIFIED] (v6295-fix) Added F2 snapshot support and fixed null/string handling.
// [MODIFIED] (F1 Motor Split Fix) Added w_motor_qty to f1SnapshotKeys to ensure persistence on load.
// [FIX] (CSV Export) Added sanitation for invisible unicode characters (e.g., U+202C) to prevent Excel parsing errors.

/**
 * @fileoverview Utility functions for parsing and stringifying CSV data.
 */

// [FIX] х░ОхЕецн?в║??initialState цибцЭ┐я╝Мф╗еф┐ох╛й csvToData_OldFormat ??ReferenceError
import { initialState } from '../config/initial-state.js';

// [MODIFIED v6285 Phase 5] Define the exact keys and order for all snapshot data
// [MODIFIED v6295] Add 'wifi_qty' to the snapshot keys
// [MODIFIED v6298-F4-Search] Add 'customer.postcode' to the snapshot keys
const f3SnapshotKeys = [
    'quoteId', 'issueDate', 'dueDate',
    'customer.name', 'customer.address', 'customer.phone', 'customer.email', 'customer.postcode'
];
const f1SnapshotKeys = [
    'winder_qty', 'motor_qty', 'charger_qty', 'cord_qty',
    'remote_1ch_qty', 'remote_16ch_qty', 'dual_combo_qty', 'dual_slim_qty',
    'discountPercentage', 'wifi_qty',
    'w_motor_qty' // [NEW] (F1 Motor Split Fix) Ensure this is persisted/loaded
];

// [NEW] (v6295-fix) Define keys for F2 snapshot
const f2SnapshotKeys = [
    'wifiQty', 'deliveryQty', 'installQty', 'removalQty', 'mulTimes', 'discount',
    'wifiSum', 'deliveryFee', 'installFee', 'removalFee',
    'deliveryFeeExcluded', 'installFeeExcluded', 'removalFeeExcluded',
    'acceSum', 'eAcceSum', 'surchargeFee', 'totalSumForRbTime', 'firstRbPrice',
    'disRbPrice', 'singleprofit', 'rbProfit', 'gst', 'netProfit',
    'deposit', 'balance', 'newOffer', 'f2_17_pre_sum', 'sumPrice',
    'grandTotal', 'gstExcluded', 'taxExclusiveTotal'
];

// Helper to safely get nested properties
const getNestedValue = (obj, path) => {
    try {
        return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : '', obj);
    } catch (e) {
        return '';
    }
};

/**
 * Converts the application's quote data object into a comprehensive CSV formatted string,
 * including all detailed item properties and LF status.
 * @param {object} quoteData The application's quote data.
 * @returns {string} A string in CSV format.
 */
export function dataToCsv(quoteData) {
    const currentProductKey = quoteData?.currentProduct;
    const productData = quoteData?.products?.[currentProductKey];
    const lfModifiedRowIndexes = quoteData?.uiMetadata?.lfModifiedRowIndexes || [];

    if (!productData || !productData.items) return "";

    // --- [NEW] Helper: Sanitize and format value for CSV ---
    const processCsvValue = (value) => {
        let strValue = (value === null || value === undefined) ? '' : String(value);

        // 1. Remove invisible Unicode control characters (e.g., U+202C from phone numbers)
        // eslint-disable-next-line no-control-regex
        strValue = strValue.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');

        // 2. Escape double quotes by doubling them
        strValue = strValue.replace(/"/g, '""');

        // 3. Replace newlines with spaces to keep row integrity
        strValue = strValue.replace(/\n/g, ' ');

        // 4. Quote the string if it contains special CSV characters
        if (strValue.includes(',') || strValue.includes(' ') || strValue.includes('"')) {
            return `"${strValue}"`;
        }
        return strValue;
    };

    // --- [MODIFIED v6295-fix] Create Project Summary Header and Row (F1, F2, F3) ---
    const projectHeaders = [...f3SnapshotKeys, ...f1SnapshotKeys, ...f2SnapshotKeys];

    const f1Snapshot = quoteData.f1Snapshot || {};
    const f2Snapshot = quoteData.f2Snapshot || {}; // [NEW] (v6295-fix)

    const projectValues = [
        // F3 Values
        quoteData.quoteId || '',
        quoteData.issueDate || '',
        quoteData.dueDate || '',
        getNestedValue(quoteData, 'customer.name'),
        getNestedValue(quoteData, 'customer.address'),
        getNestedValue(quoteData, 'customer.phone'),
        getNestedValue(quoteData, 'customer.email'),
        getNestedValue(quoteData, 'customer.postcode'), // [NEW] (v6298-F4-Search)
        // F1 Values
        ...f1SnapshotKeys.map(key => {
            const value = f1Snapshot[key];
            return (value !== null && value !== undefined) ? value : '';
        }),
        // [NEW] (v6295-fix) F2 Values
        ...f2SnapshotKeys.map(key => {
            const value = f2Snapshot[key];
            return (value !== null && value !== undefined) ? value : '';
        })
    ].map(processCsvValue); // [FIX] Apply sanitation

    // --- Create Item Header and Rows ---
    const itemHeaders = [
        '#', 'Width', 'Height', 'Type', 'Price',
        'Location', 'F-Name', 'F-Color', 'Over', 'O/I', 'L/R',
        'Dual', 'Chain', 'Winder', 'Motor', 'IsLF'
    ];

    const itemRows = productData.items.map((item, index) => {
        if (item.width || item.height) {
            const rowData = [
                index + 1,
                item.width || '',
                item.height || '',
                item.fabricType || '',
                item.linePrice !== null ? item.linePrice.toFixed(2) : '',
                item.location || '',
                item.fabric || '',
                item.color || '',
                item.over || '',
                item.oi || '',
                item.lr || '',
                item.dual || '',
                item.chain || '',
                item.winder || '',
                item.motor || '',
                lfModifiedRowIndexes.includes(index) ? 1 : 0
            ];

            return rowData.map(processCsvValue).join(','); // [FIX] Apply sanitation
        }
        return null;
    }).filter(row => row !== null);


    // [MODIFIED v6285 Phase 5] Combine all parts in the new format
    return [
        projectHeaders.join(','),
        projectValues.join(','),
        '', // Add a blank line for readability
        itemHeaders.join(','),
        ...itemRows
    ].join('\n');
}


/**
 * [PRIVATE] ш╝ФхКй?╜цХ╕я╝Мф╜┐?ицнгшжПшбичд║х?ф╛Жцнгчв║шзг??CSV шбМя?ф╕жш??Жх??лхЬих╝Хш??зч??Чш???
 * @param {string} line - ?ош? CSV хнЧф╕▓??
 * @returns {Array<string>} - шз??х╛Мч?цмДф??????
 */
function _parseCsvLine(line) {
    const values = [];

    // [FIX] ф┐оцнг Regexя╝?
    // 1. чз╗щЩдчммф??Лч╛дч╡?(?:^|,) х╛МцЦ╣хдЪщ???|я╝МщАЩц?х░ОшЗ┤?╣щ??пшкд
    // 2. х░Зчммф║МхАЛч╛дч╡ДцФ╣?║ц??▓ч╛дч╡?((...))я╝Мчв║ф┐?match[1] хзЛч??ЕхРл?СхАСцГ│шжБч?цмДф??зхо╣
    const regex = /(?:^|,)((?:"(?:[^"]|"")*"|[^,]*))/g;
    let match;

    while (match = regex.exec(line)) {
        if (match[1] === undefined || match[1] === null) continue;

        let value = match[1];

        // [FIX] чз╗щЩдф╕А?ЛщМпшкдч??Пш╝пя╝Мmatch[1] (?ХчН▓ч╛дч?) ф╕Нц??ЕхРлшбМщ??ДщАЧш?
        // if (value.startsWith(',')) {
        //     value = value.substring(1);
        // }

        // чз╗щЩдх╝Хш?ф╕жх?ш╜Йч╛й
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1).replace(/""/g, '"');
        }
        values.push(value.trim());
    }

    // ?Хч?шбМх░╛?пчй║цмДф??Дц?ц│?
    if (line.endsWith(',')) {
        values.push('');
    }

    return values;
}


/**
 * Converts a CSV formatted string into an object containing item objects and LF indexes.
 * This function is "pure" and has no external dependencies.
 * @param {string} csvString The string containing CSV data.
 * @returns {{items: Array<object>, lfIndexes: Array<number>, f1Snapshot: object, f2Snapshot: object, f3Data: object}|null} An object with items, LF status, F1/F2 snapshot, and F3 data, or null if parsing fails.
 */
export function csvToData(csvString) {
    try {
        const lines = csvString.trim().split('\n');

        // [MODIFIED v6285 Phase 5] Parse new 4-part format
        if (lines.length < 4) {
            // Fallback for old format (Phase 3/4)
            return csvToData_OldFormat(csvString);
        }

        const projectHeaderLine = lines[0];
        const projectDataLine = lines[1];
        const itemHeaderLine = lines[3];
        const itemDataLines = lines.slice(4);

        const projectHeaders = _parseCsvLine(projectHeaderLine);
        const projectValues = _parseCsvLine(projectDataLine);

        // --- 1. Parse Project Data (F1 + F2 + F3) ---
        const f1Snapshot = {};
        const f2Snapshot = {}; // [NEW] (v6295-fix)
        const f3Data = { customer: {} };

        projectHeaders.forEach((header, index) => {
            const value = projectValues[index] || null;
            if (value === null || value === '') return; // [MODIFIED] цквцЯечй║хА?
            let finalValue;

            // [FIX] (v6295-fix) Determine data type based on which key array it's in
            if (f1SnapshotKeys.includes(header) || f2SnapshotKeys.includes(header)) {
                // хжВц???F1 ??F2 keyя╝Мх?шйжш??ЫчВ║?╕х?
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    finalValue = numValue;
                } else if (value.toLowerCase() === 'true') {
                    finalValue = true;
                } else if (value.toLowerCase() === 'false') {
                    finalValue = false;
                } else if (value.toLowerCase() === 'null') { // [FIX] Handle 'null' string
                    finalValue = null;
                } else {
                    finalValue = value; // Keep as string if not num/bool (e.g. for f2.wifiQty which is text "null")
                }
            } else {
                // хжВц???F3 key (хнЧф╕▓)я╝МчЫ┤?еш│ж??
                finalValue = value;
            }

            // [FIX] (v6295-fix) Handle 'null' strings being converted to null
            if (finalValue === null && f2SnapshotKeys.includes(header)) {
                f2Snapshot[header] = null;
                return;
            }
            if (finalValue === null) return; // ф╕НхД▓хнШчДб?ИхА?

            // Assign to the correct snapshot object
            if (f1SnapshotKeys.includes(header)) {
                f1Snapshot[header] = finalValue;
            } else if (f2SnapshotKeys.includes(header)) { // [NEW] (v6295-fix)
                f2Snapshot[header] = finalValue;
            } else if (header.startsWith('customer.')) {
                f3Data.customer[header.split('.')[1]] = finalValue;
            } else if (f3SnapshotKeys.includes(header)) {
                f3Data[header] = finalValue;
            }
        });


        // --- 2. Parse Item Data ---
        const items = [];
        const lfIndexes = [];
        const itemHeaders = _parseCsvLine(itemHeaderLine);
        const isLfIndex = itemHeaders.indexOf('IsLF');

        itemDataLines.forEach((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.toLowerCase().startsWith('total')) {
                return;
            }

            // [FIX] ф╜┐чФицн?в║??CSV шз????
            const values = _parseCsvLine(trimmedLine);

            // [FIX] чз╗щЩдх╝Хш? (ш╝ФхКй?╜цХ╕х╖▓хЕзх╡МшЗ│ _parseCsvLine)

            const item = {
                itemId: `item-${Date.now()}-${items.length}`,
                width: parseInt(values[1], 10) || null,
                height: parseInt(values[2], 10) || null,
                fabricType: values[3] || null,
                linePrice: parseFloat(values[4]) || null,
                location: values[5] || '',
                fabric: values[6] || '',
                color: values[7] || '',
                over: values[8] || '',
                oi: values[9] || '',
                lr: values[10] || '',
                dual: values[11] || '',
                chain: parseInt(values[12], 10) || null,
                winder: values[13] || '',
                motor: values[14] || ''
            };
            items.push(item);

            if (isLfIndex > -1) {
                const isLf = parseInt(values[isLfIndex], 10) === 1;
                if (isLf) {
                    lfIndexes.push(items.length - 1);
                }
            }
        });

        return { items, lfIndexes, f1Snapshot, f2Snapshot, f3Data };

    } catch (error) {
        console.error("Failed to parse CSV string (New Format):", error);
        // If new format fails, try the old one
        try {
            return csvToData_OldFormat(csvString);
        } catch (oldError) {
            console.error("Failed to parse CSV string (Old Format):", oldError);
            return null;
        }
    }
}

/**
 * [FALLBACK] Kept the old parser logic to handle files saved in the previous format (Phase 4 / 8th Edit)
 */
function csvToData_OldFormat(csvString) {
    const lines = csvString.trim().split('\n');
    const headerIndex = lines.findIndex(line => line.trim() !== '' && line.startsWith('#,Width'));
    if (headerIndex === -1) return null; // Not a recognized format

    const headerLine = lines[headerIndex];
    const headers = headerLine.split(','); // Old parser OK here

    const f1Snapshot = {};
    const snapshotKeys = Object.keys(initialState.quoteData.f1Snapshot);
    const snapshotIndices = {};
    snapshotKeys.forEach(key => {
        snapshotIndices[key] = headers.indexOf(key);
    });

    const dataLines = lines.slice(headerIndex + 1);
    const items = [];
    const lfIndexes = [];
    const isLfIndex = headers.indexOf('IsLF');

    dataLines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.toLowerCase().startsWith('total')) {
            return;
        }

        const values = trimmedLine.split(','); // Old parser OK here

        if (values[0] === 'F1_SNAPSHOT' && values.length >= 3) {
            // This is the Phase 3 format, not Phase 4. Handle it anyway.
            const key = values[1];
            const value = values[2];
            if (f1Snapshot.hasOwnProperty(key)) {
                const numValue = parseFloat(value);
                f1Snapshot[key] = isNaN(numValue) ? value : numValue;
            }
            return; // Skip to the next line
        }

        if (index === 0) {
            snapshotKeys.forEach(key => {
                const colIndex = snapshotIndices[key];
                if (colIndex > -1 && values[colIndex] !== undefined && values[colIndex] !== '') {
                    const value = values[colIndex];
                    const numValue = parseFloat(value);
                    f1Snapshot[key] = isNaN(numValue) ? value : numValue;
                }
            });
        }

        const item = {
            itemId: `item-${Date.now()}-${items.length}`,
            width: parseInt(values[1], 10) || null,
            height: parseInt(values[2], 10) || null,
            fabricType: values[3] || null,
            linePrice: parseFloat(values[4]) || null,
            location: values[5] || '',
            fabric: values[6] || '',
            color: values[7] || '',
            over: values[8] || '',
            oi: values[9] || '',
            lr: values[10] || '',
            dual: values[11] || '',
            chain: parseInt(values[12], 10) || null,
            winder: values[13] || '',
            motor: values[14] || ''
        };
        items.push(item);

        if (isLfIndex > -1) {
            const isLf = parseInt(values[isLfIndex], 10) === 1;
            if (isLf) {
                lfIndexes.push(items.length - 1);
            }
        }
    });

    // [MODIFIED] (v6295-fix) Return an empty f2Snapshot for compatibility
    return { items, lfIndexes, f1Snapshot, f2Snapshot: {}, f3Data: { customer: {} } };
}