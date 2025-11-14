/* FILE: 04-core-code/services/file-service.js */
// [MODIFIED] (Tweak 1) _generateFileName now uses quoteId timestamp if available.

import { dataToCsv, csvToData } from '../utils/csv-parser.js';
import { initialState } from '../config/initial-state.js';

/**
 * @fileoverview Service for handling all file-related operations
 * like saving, loading, and exporting.
 */
export class FileService {
    constructor({ productFactory }) {
        this.productFactory = productFactory;
        console.log("FileService Initialized.");
    }

    _triggerDownload(content, fileName, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    _generateFileName(quoteData, extension) {
        let timestamp;

        // [NEW] Tweak 1: 檢查是否存在有效的 quoteId
        const quoteId = quoteData?.quoteId;
        // 檢查 quoteId 是否存在，且是否以 "RB" 開頭並跟著數字 (基本格式驗證)
        if (quoteId && quoteId.startsWith('RB') && !isNaN(parseInt(quoteId.substring(2, 16)))) {
            // 從 "RB202511122247" 提取 "202511122247"
            timestamp = quoteId.substring(2, 16);
        } else {
            // (Fallback) 如果是新報價單，使用當下時間
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            timestamp = `${yyyy}${mm}${dd}${hh}${min}`;
        }

        // [MODIFIED] å¯¦ä??°ç?æª”å?? è¼¯
        const customerName = quoteData?.customer?.name || 'customer';
        const customerPhone = quoteData?.customer?.phone || '';

        // ç°¡å?ä¸¦æ??†ï?ç§»é™¤ä¸ å??¨å??ƒä¸¦?¿æ?ç©ºç™½
        const safeName = customerName.replace(/[\s/\\?%*:|"<>]/g, '_') || 'customer';
        const safePhone = customerPhone.replace(/[\s/\\?%*:|"<>]/g, '_');

        let parts = ['quote', safeName];
        if (safePhone) {
            parts.push(safePhone);
        }
        parts.push(timestamp); // [MODIFIED] 使用我們決定的 timestamp

        return `${parts.join('-')}.${extension}`;
    }

    saveToJson(quoteData) {
        try {
            const jsonString = JSON.stringify(quoteData, null, 2);
            // [MODIFIED] ?³é? quoteData ä»¥ç”¢?Ÿæ–°æª”å?
            const fileName = this._generateFileName(quoteData, 'json');
            this._triggerDownload(jsonString, fileName, 'application/json');
            return { success: true, message: 'Quote file is being downloaded...' };
        } catch (error) {
            console.error("Failed to save JSON file:", error);
            return { success: false, message: 'Error creating quote file.' };
        }
    }

    exportToCsv(quoteData) {
        try {
            const csvString = dataToCsv(quoteData);
            // [MODIFIED] ?³é? quoteData ä»¥ç”¢?Ÿæ–°æª”å?
            const fileName = this._generateFileName(quoteData, 'csv');
            this._triggerDownload(csvString, fileName, 'text/csv;charset=utf-8;');
            return { success: true, message: 'CSV file is being downloaded...' };
        } catch (error) {
            console.error("Failed to export CSV file:", error);
            return { success: false, message: 'Error creating CSV file.' };
        }
    }

    parseFileContent(fileName, content) {
        try {
            let loadedData = null;

            if (fileName.toLowerCase().endsWith('.json')) {
                loadedData = JSON.parse(content);
            } else if (fileName.toLowerCase().endsWith('.csv')) {
                const parsedResult = csvToData(content);
                if (parsedResult === null) {
                    throw new Error("CSV parser returned null.");
                }

                // [MODIFIED v6285 Phase 5] Destructure all returned parts from csvToData
                // [MODIFIED v6295-fix] Destructure the new f2Snapshot
                const { items, lfIndexes, f1Snapshot, f2Snapshot, f3Data } = parsedResult;

                const productStrategy = this.productFactory.getProductStrategy('rollerBlind');
                const newItem = productStrategy.getInitialItemData();
                items.push(newItem);

                const newQuoteData = JSON.parse(JSON.stringify(initialState.quoteData));
                newQuoteData.products.rollerBlind.items = items;
                newQuoteData.uiMetadata.lfModifiedRowIndexes = lfIndexes;

                // [MODIFIED v6285 Phase 5] Assign the parsed f1Snapshot and f3Data
                if (f1Snapshot) {
                    Object.assign(newQuoteData.f1Snapshot, f1Snapshot);
                }
                if (f3Data) {
                    Object.assign(newQuoteData, f3Data); // Assign f3Data (quoteId, issueDate, customer...)
                }
                // [FIX] (v6295-fix) è£œä??ºæ???f2Snapshot ?„å?? è¼¯
                if (f2Snapshot) {
                    Object.assign(newQuoteData.f2Snapshot, f2Snapshot);
                }

                loadedData = newQuoteData;

            } else {
                return { success: false, message: `Unsupported file type: ${fileName}` };
            }

            if (loadedData && !loadedData.uiMetadata) {
                loadedData.uiMetadata = {
                    lfModifiedRowIndexes: []
                };
            }

            // [MODIFIED v6285 Phase 5] Also ensure f1Snapshot exists on loaded JSON data
            if (loadedData && !loadedData.f1Snapshot) {
                console.warn("Patching loaded JSON file with missing f1Snapshot.");
                loadedData.f1Snapshot = JSON.parse(JSON.stringify(initialState.quoteData.f1Snapshot));
            }

            // [NEW] (v6295) Ensure f2Snapshot exists on loaded JSON/CSV data
            if (loadedData && !loadedData.f2Snapshot) {
                console.warn("Patching loaded file with missing f2Snapshot.");
                loadedData.f2Snapshot = JSON.parse(JSON.stringify(initialState.quoteData.f2Snapshot));
            }

            // [NEW v6285 Phase 5] Ensure customer object exists on loaded JSON data
            if (loadedData && !loadedData.customer) {
                console.warn("Patching loaded JSON file with missing customer object.");
                loadedData.customer = JSON.parse(JSON.stringify(initialState.quoteData.customer));
            }

            const currentProduct = loadedData?.currentProduct;
            const productData = loadedData?.products?.[currentProduct];

            if (productData && Array.isArray(productData.items)) {
                return { success: true, data: loadedData, message: `Successfully loaded data from ${fileName}` };
            } else {
                if (loadedData && loadedData.rollerBlindItems && Array.isArray(loadedData.rollerBlindItems)) {
                    return { success: true, data: loadedData, message: `Successfully loaded legacy data from ${fileName}` };
                }
                throw new Error("File content is not in a valid quote format.");
            }
        } catch (error) {
            console.error("Failed to parse file content:", error);
            return { success: false, message: `Error loading file: ${error.message}` };
        }
    }
}