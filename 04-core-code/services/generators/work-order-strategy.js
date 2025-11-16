/* FILE: 04-core-code/services/generators/work-order-strategy.js */
// [NEW] (階段 2) 建立工單 (Work Order) 產生策略

import { populateTemplate } from '../../utils/template-utils.js';

export class WorkOrderStrategy {
    constructor() {
        console.log("WorkOrderStrategy Initialized.");
    }

    /**
     * [MOVED] 此函式從 quote-generator-service.js 移轉過來
     * [MODIFIED] (階段 2 修復) 建立一個專門給工單使用、不含價格、且帶有複雜排序的函式
     * @param {object} templateData - 來自 calculationService.getQuoteTemplateData 的資料
     * @param {string} workOrderRowTemplate - work-order-template-row.html 的模板內容
     * @returns {string} 填充後的 HTML 表格列 (tbody)
     */
    generateRows(templateData, workOrderRowTemplate) {
        const { items } = templateData;

        // --- (Tweak 6) 排序邏輯 ---

        // 1. 預先處理，計算 Fcolor 和 B-Type 的出現次數
        const fcolorCounts = {};
        const bTypeCounts = {};
        const validItems = items
            .filter(item => item.width && item.height)
            .map((item, index) => {
                // [FIX] (Tweak 6B) Fcolor 應同時包含 fabric 和 color
                const fcolorKey = `${item.fabric || ''}|${item.color || ''}`;
                const bTypeKey = item.fabricType || '';

                fcolorCounts[fcolorKey] = (fcolorCounts[fcolorKey] || 0) + 1;

                if (bTypeKey.startsWith('B')) {
                    bTypeCounts[bTypeKey] = (bTypeCounts[bTypeKey] || 0) + 1;
                }

                return {
                    ...item,
                    originalIndex: index, // (Tweak 6) 保留原始 ＃
                    fcolorKey: fcolorKey,
                    bTypeKey: bTypeKey
                };
            });

        // 2. 定義排序類別 (Tweak 6)
        // [FIX] (Tweak 6A) 修正 getSortCategory 的邏輯錯誤
        const getSortCategoryFixed = (item) => {
            if (item.fabricType && item.fabricType.startsWith('B')) return 0; // 灰色 (B1-B5)
            if (item.fabricType === 'SN') return 1; // 水藍色 (SN)
            if (item.fabric && item.fabric.toLowerCase().includes('light-filter')) return 2; // 粉紅色 (LF)
            return 3; // 其他
        };


        // 3. 執行複雜排序 (Tweak 6)
        validItems.sort((a, b) => {
            const categoryA = getSortCategoryFixed(a);
            const categoryB = getSortCategoryFixed(b);

            // A. 按主類別排序 (B > SN > LF)
            if (categoryA !== categoryB) {
                return categoryA - categoryB;
            }

            // B. 如果在同一類別中
            const fcolorCountA = fcolorCounts[a.fcolorKey];
            const fcolorCountB = fcolorCounts[b.fcolorKey];

            // B1. 按 Fcolor 數量排序 (多 -> 少) (Tweak 6B, 6C, 6D)
            if (fcolorCountA !== fcolorCountB) {
                return fcolorCountB - fcolorCountA;
            }

            // B2. (Query 6A) 如果是 B 類別 (灰色)，且 Fcolor 數量相同
            if (categoryA === 0) {
                const bTypeCountA = bTypeCounts[a.bTypeKey] || 0;
                const bTypeCountB = bTypeCounts[b.bTypeKey] || 0;

                // 按 B-Type 數量排序 (多 -> 少) (Tweak 6A)
                if (bTypeCountA !== bTypeCountB) {
                    return bTypeCountB - bTypeCountA;
                }

                // (Tweak 6A) 如果 B-Type 數量也相同，按 B-Type 名稱排序 (B1 > B2)
                if (a.bTypeKey !== b.bTypeKey) {
                    return a.bTypeKey.localeCompare(b.bTypeKey);
                }
            }

            // C. 如果還是相同，保持原始 ＃ 順序
            return a.originalIndex - b.originalIndex;
        });

        // --- (Tweak 2, 3, 4, 5) 產生 HTML ---
        const rows = validItems.map((item, mapIndex) => { // (Tweak 3) 取得 mapIndex

            // (Tweak 2) 決定著色
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

            const rowData = {
                rowNumber: mapIndex + 1, // (Tweak 3)
                index: item.originalIndex + 1, // (Tweak 6) 使用原始 ＃
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
                isEmptyClassHD: winderText ? '' : 'is-empty-cell',
                isEmptyClassDual: dualText ? '' : 'is-empty-cell',
                isEmptyClassMotor: motorText ? '' : 'is-empty-cell',
            };

            // (Tweak 2) 使用 workOrderRowTemplate
            // [MODIFIED] (階段 1) Call external util
            return populateTemplate(workOrderRowTemplate, rowData);
        })
            .join('');

        return rows;
    }
}