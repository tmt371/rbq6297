/* FILE: 04-core-code/services/generators/original-quote-strategy.js */
// [NEW] (階段 3) 建立原表 (Original Quote / AQ) 產生策略

import { populateTemplate } from '../../utils/template-utils.js';
import { formatCurrency } from '../../utils/format-utils.js';

export class OriginalQuoteStrategy {
    constructor() {
        console.log("OriginalQuoteStrategy Initialized.");
    }

    /**
     * [MOVED] 此函式從 quote-generator-service.js 移轉過來
     * [MODIFIED] Renamed function
     * 產生附錄 (Appendix) 頁面的表格列 (tbody)
     * @param {object} templateData 
     * @param {string} detailedItemListRowTemplate 
     * @returns {string}
     */
    generateDetailsPageHtml(templateData, detailedItemListRowTemplate, documentType = 'Quotation') {
        if (documentType === 'Receipt' || documentType === 'Overdue Invoice') {
            return '';
        }
        const { items, mulTimes } = templateData;

        const rows = items
            .filter(item => item.width && item.height)
            .map((item, index) => {

                let fabricClass = '';
                if (item.fabric && item.fabric.toLowerCase().includes('light-filter')) {
                    fabricClass = 'bg-light-filter';
                } else if (item.fabricType === 'SN') {
                    fabricClass = 'bg-screen';
                } else if (['B1', 'B2', 'B3', 'B4', 'B5'].includes(item.fabricType)) {
                    fabricClass = 'bg-blockout';
                }

                const finalPrice = (item.linePrice || 0) * mulTimes;

                const winderText = item.winder === 'HD' ? 'Y' : '';
                const dualText = item.dual === 'D' ? 'Y' : '';
                const motorText = item.motor ? 'Y' : '';

                const rowData = {
                    index: index + 1,
                    fabricClass: fabricClass,
                    fabric: item.fabric || '',
                    color: item.color || '',
                    location: item.location || '',
                    winder: winderText,
                    dual: dualText,
                    motor: motorText,
                    price: formatCurrency(finalPrice),
                    isEmptyClassHD: winderText ? '' : 'is-empty-cell',
                    isEmptyClassDual: dualText ? '' : 'is-empty-cell',
                    isEmptyClassMotor: motorText ? '' : 'is-empty-cell',
                };

                // [MODIFIED] (階段 1) Call external util
                return populateTemplate(detailedItemListRowTemplate, rowData);
            })
            .join('');

        return rows;
    }

    /**
     * [MOVED] 此函式從 quote-generator-service.js 移轉過來
     * [MODIFIED] Renamed function
     * 產生第一頁的項目總結表格 (tbody)
     * @param {object} templateData 
     * @param {string} quoteTemplateRowTemplate 
     * @returns {string}
     */
    generatePageOneHtml(templateData, quoteTemplateRowTemplate) {
        const { summaryData, uiState, items } = templateData;
        const rows = [];
        const validItemCount = items.filter(i => i.width && i.height).length;

        // [MODIFIED] Remove inline helper function
        const createRowData = (number, description, qty, price, discountedPrice, isExcluded = false) => {
            // [FIX v6291] æ­¥é? 3: å¦‚æ? Price è¢«æ??¤ï?Discounted Price é¡¯ç¤º??0
            const discountedPriceValue = isExcluded ? 0 : discountedPrice;
            const isDiscounted = discountedPriceValue < price;

            // [FIX v6291] (ä¿®å¾© PDF æ­¥é? 1.2, 1.3, 1.4) å¯¦ç ¾æ­?¢º?„é??²æ¨£å¼ é?è¼?
            let priceStyle = 'style="color: #333;"'; // (1.3) ? è¨­ Price ?ºé???
            // (1.3) ? è¨­ Discounted Price ?ºé???(CSS ?ƒä½¿?¶ç‚ºç´…è‰²ï¼Œstyle ?¨æ–¼è¦†è?)
            let discountedPriceStyle = 'style="color: #333;"';

            if (isExcluded) {
                // (1.4) Price: ?°è‰²?ªé™¤ç·?Discounted: ç´…è‰² (ä¸¦é¡¯ç¤?0)
                priceStyle = 'style="text-decoration: line-through; color: #999999;"';
                discountedPriceStyle = 'style="color: #d32f2f;"';
            } else if (isDiscounted) {
                // (1.2) Price: ?°è‰² Discounted: ç´…è‰²
                priceStyle = 'style="color: #999999;"';
                discountedPriceStyle = 'style="color: #d32f2f;"'; // ä¿ æ?ç´…è‰² (CSS ? è¨­)
            }
            // (1.3) ?…æ? (isExcluded = false ä¸?isDiscounted = false) å·²åœ¨? è¨­ä¸­è???(?©è€…ç??ºé???

            // [MODIFIED] Return data object using central formatCurrency helper
            return {
                number,
                description,
                qty,
                price: formatCurrency(price),
                discountedPrice: formatCurrency(discountedPriceValue),
                priceStyle,
                discountedPriceStyle
            };
        };

        let itemNumber = 1;

        // Row 1: Roller Blinds
        rows.push(createRowData(
            itemNumber++,
            'Roller Blinds',
            validItemCount,
            summaryData.firstRbPrice || 0,
            summaryData.disRbPrice || 0,
            false // ç¢ºä? Roller Blinds Price æ°¸é?ä¸ æ?è¢«å???
        ));

        // Row 2: Installation Accessories (Optional)
        // [FIX v6291] æ­¥é? 1: ä¿®æ­£ isExcluded ? è¼¯ï¼Œç¢ºä¿?Price æ°¸é?ä¸ æ?è¢«å???
        if (summaryData.acceSum > 0) {
            rows.push(createRowData(
                itemNumber++,
                'Installation Accessories',
                'NA',
                summaryData.acceSum || 0,
                summaryData.acceSum || 0,
                false // ç¢ºä?æ­¤é???Price æ°¸é?ä¸ æ?è¢«å???
            ));
        }

        // Row 3: Motorised Package (Optional)
        // [MODIFIED v6291] æ­¥é? 2 & 5: è¨»è§£
        // [FIX v6291] æ­¥é? 2: ä¿®æ­£ isExcluded ? è¼¯ï¼Œç¢ºä¿?Price æ°¸é?ä¸ æ?è¢«å???
        if (summaryData.eAcceSum > 0) {
            rows.push(createRowData(
                itemNumber++,
                'Motorised Package',
                'NA',
                summaryData.eAcceSum || 0,
                summaryData.eAcceSum || 0,
                false // ç¢ºä?æ­¤é???Price æ°¸é?ä¸ æ?è¢«å???
            ));
        }

        // Row 4: Delivery
        // [FIX v3.47] Use proper Unit Price and Fee from templateData and display as 0 if excluded
        rows.push(createRowData(
            itemNumber++,
            'Delivery',
            templateData.deliveryQty || 1,
            templateData.deliveryUnitPrice || 0,
            templateData.deliveryFee || 0,
            templateData.isDeliveryWaived === true
        ));

        // Row 5: Installation
        rows.push(createRowData(
            itemNumber++,
            'Installation',
            templateData.installQty || 0, 
            templateData.installUnitPrice || 0,
            templateData.installFee || 0,
            templateData.isInstallWaived === true
        ));

        // Row 6: Removal
        rows.push(createRowData(
            itemNumber++,
            'Removal',
            templateData.removalQty || 0,
            templateData.removalUnitPrice || 0,
            templateData.removalFee || 0,
            templateData.isRemovalWaived === true
        ));

        // [MODIFIED] Map data objects to HTML strings using the template
        return rows.map(rowData =>
            // [MODIFIED] (階段 1) Call external util
            populateTemplate(quoteTemplateRowTemplate, rowData)
        ).join('');
    }
}