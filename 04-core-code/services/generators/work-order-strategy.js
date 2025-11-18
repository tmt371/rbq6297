/* FILE: 04-core-code/services/generators/work-order-strategy.js */
// [MODIFIED] (HOTFIX Tweak 2) Fixed LF (pink) coloring bug by re-ordering checks in getSortCategoryFixed.
// [MODIFIED] (第 2 次編修) 修正 filter 和 map 的順序，以修復 originalIndex 錯位及項目丟失的 Bug。
// [MODIFIED] (第 3 次編修) 將 item.linePrice 綁定到 rowData.price，以在工單上顯示價格。
// [MODIFIED] (第 5 次編修) 在表格末端新增「統計行」 (Summary Row)。
// [MODIFIED] (第 10 次編修) 微調統計行文字：移除中文、將 "OFF" 改為 "off" 並縮小字體。

import { populateTemplate } from '../../utils/template-utils.js';

export class WorkOrderStrategy {
    constructor() {
        console.log("WorkOrderStrategy Initialized.");
    }

    /**
     * [MOVED] 此函式從 quote-generator-service.js 移至此處
     * [MODIFIED] (階段 2 修復) 建立一個專門給工廠使用、不含價格、且帶有複雜排序的函式
     * @param {object} templateData - 來自 calculationService.getQuoteTemplateData 的結果
     * @param {string} workOrderRowTemplate - work-order-template-row.html 的模板內容
     * @returns {string} 填入後的 HTML 表格列 (tbody)
     */
    generateRows(templateData, workOrderRowTemplate) {
        const { items } = templateData;

        // --- (Tweak 6) 排序邏輯 ---

        // 1. 預先計算，找出 Fcolor 和 B-Type 的出現次數
        const fcolorCounts = {};
        const bTypeCounts = {};
        // [MODIFIED] (第 2 次編修) 修正 Bug A 和 Bug B
        // Bug A: 將 .map 移至 .filter 之前，以確保 originalIndex 是 items 的原始索引
        // Bug B: 將 .filter 邏輯從 '&&' 改為 '||'，以包含只有單邊尺寸的項目
        const validItems = items
            .map((item, index) => {
                // [FIX] (Tweak 6B) Fcolor 鍵值應包含 fabric 和 color
                const fcolorKey = `${item.fabric || ''}|${item.color || ''}`;
                const bTypeKey = item.fabricType || '';

                fcolorCounts[fcolorKey] = (fcolorCounts[fcolorKey] || 0) + 1;

                if (bTypeKey.startsWith('B')) {
                    bTypeCounts[bTypeKey] = (bTypeCounts[bTypeKey] || 0) + 1;
                }

                return {
                    ...item,
                    originalIndex: index, // (Tweak 6) (第 2 次編修 FIX) 現在這是正確的原始索引
                    fcolorKey: fcolorKey,
                    bTypeKey: bTypeKey
                };
            })
            .filter(item => item.width || item.height); // (第 2 次編修 FIX) 確保有寬度 *或* 高度的項目都被包含

        // 2. 定義排序類別 (Tweak 6)
        // [MODIFIED] (Bug Fix Tweak 2) 將 LF (粉紅) 的檢查移到最前面
        const getSortCategoryFixed = (item) => {
            if (item.fabric && item.fabric.toLowerCase().includes('light-filter')) return 2; // 粉紅色 (LF)
            if (item.fabricType && item.fabricType.startsWith('B')) return 0; // 灰色 (B1-B5)
            if (item.fabricType === 'SN') return 1; // 水藍色 (SN)
            return 3; // 其他
        };


        // 3. 執行複雜排序 (Tweak 6)
        validItems.sort((a, b) => {
            const categoryA = getSortCategoryFixed(a);
            const categoryB = getSortCategoryFixed(b);

            // A. 依主類別排序 (B > SN > LF)
            if (categoryA !== categoryB) {
                return categoryA - categoryB;
            }

            // B. 如果是同一類別
            const fcolorCountA = fcolorCounts[a.fcolorKey];
            const fcolorCountB = fcolorCounts[b.fcolorKey];

            // B1. 依 Fcolor 數量排序 (多 -> 少) (Tweak 6B, 6C, 6D)
            if (fcolorCountA !== fcolorCountB) {
                return fcolorCountB - fcolorCountA;
            }

            // B2. (Query 6A) 如果是 B 類別 (灰色)，且 Fcolor 數量相同
            if (categoryA === 0) {
                const bTypeCountA = bTypeCounts[a.bTypeKey] || 0;
                const bTypeCountB = bTypeCounts[b.bTypeKey] || 0;

                // 依 B-Type 數量排序 (多 -> 少) (Tweak 6A)
                if (bTypeCountA !== bTypeCountB) {
                    return bTypeCountB - bTypeCountA;
                }

                // (Tweak 6A) 如果 B-Type 數量也相同，則依 B-Type 名稱排序 (B1 > B2)
                if (a.bTypeKey !== b.bTypeKey) {
                    return a.bTypeKey.localeCompare(b.bTypeKey);
                }
            }

            // C. 如果還是相同，則依原始索引排序
            return a.originalIndex - b.originalIndex;
        });

        // --- (Tweak 2, 3, 4, 5) 產生 HTML ---
        const rows = validItems.map((item, mapIndex) => { // (Tweak 3) 使用 mapIndex

            // (Tweak 2) 決定顏色
            let fabricClass = '';
            const category = getSortCategoryFixed(item);
            if (category === 0) {
                fabricClass = 'bg-blockout'; // 灰色
            } else if (category === 1) {
                fabricClass = 'bg-screen'; // 水藍色
            } else if (category === 2) {
                fabricClass = 'bg-light-filter'; // 粉紅色
            }

            // (Tweak 2) 準備欄位資料
            const winderText = item.winder === 'HD' ? 'Y' : '';
            const dualText = item.dual === 'D' ? 'Y' : '';
            const motorText = item.motor ? 'Y' : '';
            const fcolorText = `${item.fabric || ''} ${item.color || ''}`.trim();

            // [NEW] (第 3 次編修) 格式化價格
            const priceText = (item.linePrice !== null && item.linePrice !== undefined)
                ? item.linePrice.toFixed(2)
                : '';

            const rowData = {
                rowNumber: mapIndex + 1, // (Tweak 3)
                index: item.originalIndex + 1, // (Tweak 6) (第 2 次編修 FIX) 使用正確的原始索引
                location: item.location || '', // (Tweak 4)
                fabricClass: fabricClass,
                fcolor: fcolorText,
                width: item.width || '',
                height: item.height || '',
                lr: item.lr || '',
                over: item.oi || '', // (假設 over = oi)
                winder: winderText,
                dual: dualText,
                motor: motorText,
                chain: item.chain || '', // (Tweak 5) 移除 mm
                price: priceText, // [NEW] (第 3 次編修) 傳遞價格
                isEmptyClassHD: winderText ? '' : 'is-empty-cell',
                isEmptyClassDual: dualText ? '' : 'is-empty-cell',
                isEmptyClassMotor: motorText ? '' : 'is-empty-cell',
            };

            // (Tweak 2) 使用 workOrderRowTemplate
            // [MODIFIED] (階段 1) Call external util
            return populateTemplate(workOrderRowTemplate, rowData);
        })
            .join('');

        // --- [NEW] (第 5 次編修) 統計行邏輯 ---

        // 1. 計算 Dual, HD, 和 Price 總和
        let dualCount = 0;
        let hdCount = 0;
        let priceTotal = 0;

        validItems.forEach(item => {
            if (item.dual === 'D') {
                dualCount++;
            }
            if (item.winder === 'HD') {
                hdCount++;
            }
            if (item.linePrice !== null && item.linePrice !== undefined) {
                priceTotal += item.linePrice;
            }
        });

        const dualValue = dualCount / 2;

        // 2. 獲取折扣 X (來自 F1)
        const discountX = templateData.uiState?.f1?.discountPercentage || 0;

        // 3. 計算折扣後的 Price
        const finalPrice = priceTotal * ((100 - discountX) / 100);

        // 4. 建立 HTML 字串 (共 13 欄)
        // [MODIFIED] (第 10 次編修) 修改 <td> 1 (移除中文) 和 <td> 12 (修改 OFF)
        const summaryRowHtml = `
            <tr class="summary-row" style="font-weight: bold; background-color: #f0f2f5; border-top: 2px solid #555;">
                <td data-label="NO" class="text-center" colspan="8" style="text-align: right; padding-right: 10px;">(Summary)</td>
                <td data-label="dual" class="text-center">${dualValue}</td>
                <td data-label="HD" class="text-center">${hdCount}</td>
                <td data-label="chain" class="text-center"></td>
                <td data-label="motor" class="text-center" style="font-size: 0.9em; color: #c0392b;">${discountX} %<span style="font-size: 90%;">off</span></td>
                <td data-label="PRICE" class="text-right" style="color: #c0392b;">${finalPrice.toFixed(2)}</td>
            </tr>
        `;

        // 5. 附加到 rows 並返回
        return rows + summaryRowHtml;
    }
}