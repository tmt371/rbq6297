/* FILE: 04-core-code/utils/csv-parser.js */

import { initialState } from '../config/initial-state.js';
import { REGEX } from '../config/regex.js';

const f3SnapshotKeys = [
    'quoteId', 'issueDate', 'dueDate',
    'customer.name', 'customer.address', 'customer.phone', 'customer.email', 'customer.postcode'
];
const f1SnapshotKeys = [
    'winder_qty', 'motor_qty', 'charger_qty', 'cord_qty',
    'remote_1ch_qty', 'remote_16ch_qty', 'dual_combo_qty', 'dual_slim_qty',
    'discountPercentage', 'wifi_qty',
    'w_motor_qty'
];

const f2SnapshotKeys = [
    'wifiQty', 'deliveryQty', 'installQty', 'removalQty', 'mulTimes', 'discount',
    'wifiSum', 'deliveryFee', 'installFee', 'removalFee',
    'deliveryFeeExcluded', 'installFeeExcluded', 'removalFeeExcluded',
    'acceSum', 'eAcceSum', 'surchargeFee', 'totalSumForRbTime', 'firstRbPrice',
    'disRbPrice', 'singleprofit', 'rbProfit', 'gst', 'netProfit',
    'deposit', 'balance', 'newOffer', 'f2_17_pre_sum', 'sumPrice',
    'grandTotal', 'gstExcluded', 'taxExclusiveTotal'
];

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

    const processCsvValue = (value) => {
        let strValue = (value === null || value === undefined) ? '' : String(value);

        strValue = strValue.replace(REGEX.INVISIBLE_CHAR, '');
        strValue = strValue.replace(/"/g, '""');
        strValue = strValue.replace(/\n/g, ' ');

        if (strValue.includes(',') || strValue.includes(' ') || strValue.includes('"')) {
            return `"${strValue}"`;
        }
        return strValue;
    };

    const projectHeaders = [...f3SnapshotKeys, ...f1SnapshotKeys, ...f2SnapshotKeys];

    const f1Snapshot = quoteData.f1Snapshot || {};
    const f2Snapshot = quoteData.f2Snapshot || {};

    const projectValues = [
        quoteData.quoteId || '',
        quoteData.issueDate || '',
        quoteData.dueDate || '',
        getNestedValue(quoteData, 'customer.name'),
        getNestedValue(quoteData, 'customer.address'),
        getNestedValue(quoteData, 'customer.phone'),
        getNestedValue(quoteData, 'customer.email'),
        getNestedValue(quoteData, 'customer.postcode'),
        ...f1SnapshotKeys.map(key => {
            const value = f1Snapshot[key];
            return (value !== null && value !== undefined) ? value : '';
        }),
        ...f2SnapshotKeys.map(key => {
            const value = f2Snapshot[key];
            return (value !== null && value !== undefined) ? value : '';
        })
    ].map(processCsvValue);

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

            return rowData.map(processCsvValue).join(',');
        }
        return null;
    }).filter(row => row !== null);

    return [
        projectHeaders.join(','),
        projectValues.join(','),
        '',
        itemHeaders.join(','),
        ...itemRows
    ].join('\n');
}


function _parseCsvLine(line) {
    const values = [];
    const regex = /(?:^|,)((?:"(?:[^"]|"")*"|[^,]*))/g;
    let match;

    while (match = regex.exec(line)) {
        if (match[1] === undefined || match[1] === null) continue;

        let value = match[1];

        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1).replace(/""/g, '"');
        }
        values.push(value.trim());
    }

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

        if (lines.length < 4) {
            return csvToData_OldFormat(csvString);
        }

        const projectHeaderLine = lines[0];
        const projectDataLine = lines[1];
        const itemHeaderLine = lines[3];
        const itemDataLines = lines.slice(4);

        const projectHeaders = _parseCsvLine(projectHeaderLine);
        const projectValues = _parseCsvLine(projectDataLine);

        const f1Snapshot = {};
        const f2Snapshot = {};
        const f3Data = { customer: {} };

        projectHeaders.forEach((header, index) => {
            const value = projectValues[index] || null;
            if (value === null || value === '') return;
            let finalValue;

            if (f1SnapshotKeys.includes(header) || f2SnapshotKeys.includes(header)) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    finalValue = numValue;
                } else if (value.toLowerCase() === 'true') {
                    finalValue = true;
                } else if (value.toLowerCase() === 'false') {
                    finalValue = false;
                } else if (value.toLowerCase() === 'null') {
                    finalValue = null;
                } else {
                    finalValue = value;
                }
            } else {
                finalValue = value;
            }

            if (finalValue === null && f2SnapshotKeys.includes(header)) {
                f2Snapshot[header] = null;
                return;
            }
            if (finalValue === null) return;

            if (f1SnapshotKeys.includes(header)) {
                f1Snapshot[header] = finalValue;
            } else if (f2SnapshotKeys.includes(header)) {
                f2Snapshot[header] = finalValue;
            } else if (header.startsWith('customer.')) {
                f3Data.customer[header.split('.')[1]] = finalValue;
            } else if (f3SnapshotKeys.includes(header)) {
                f3Data[header] = finalValue;
            }
        });

        const items = [];
        const lfIndexes = [];
        const itemHeaders = _parseCsvLine(itemHeaderLine);
        const isLfIndex = itemHeaders.indexOf('IsLF');

        itemDataLines.forEach((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.toLowerCase().startsWith('total')) {
                return;
            }

            const values = _parseCsvLine(trimmedLine);

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
        try {
            return csvToData_OldFormat(csvString);
        } catch (oldError) {
            console.error("Failed to parse CSV string (Old Format):", oldError);
            return null;
        }
    }
}

function csvToData_OldFormat(csvString) {
    const lines = csvString.trim().split('\n');
    const headerIndex = lines.findIndex(line => line.trim() !== '' && line.startsWith('#,Width'));
    if (headerIndex === -1) return null;

    const headerLine = lines[headerIndex];
    const headers = headerLine.split(',');

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

        const values = trimmedLine.split(',');

        if (values[0] === 'F1_SNAPSHOT' && values.length >= 3) {
            const key = values[1];
            const value = values[2];
            if (f1Snapshot.hasOwnProperty(key)) {
                const numValue = parseFloat(value);
                f1Snapshot[key] = isNaN(numValue) ? value : numValue;
            }
            return;
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

    return { items, lfIndexes, f1Snapshot, f2Snapshot: {}, f3Data: { customer: {} } };
}