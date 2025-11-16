/* FILE: 04-core-code/services/generators/gth-quote-strategy.js */
// [NEW] (階段 4) 建立居表 (GTH) 產生策略

import { populateTemplate } from '../../utils/template-utils.js';

export class GthQuoteStrategy {
    constructor() {
        console.log("GthQuoteStrategy Initialized.");
    }

    /**
     * [MOVED] 此函式從 quote-generator-service.js 移轉過來
     * [MODIFIED] Renamed function
     * 產生 GTH (居表) 的項目卡片 (tbody)
     * @param {object} templateData 
     * @param {string} gmailTemplateCardTemplate 
     * @returns {string}
     */
    generateCardsHtml(templateData, gmailTemplateCardTemplate) {
        const { summaryData, uiState, items } = templateData;
        const rows = [];
        const validItemCount = items.filter(i => i.width && i.height).length;

        // [MODIFIED] Remove inline helper function
        const createRowData = (number, description, qty, price, discountedPrice, isExcluded = false) => {
            // [FIX v6291] æ­¥é? 3: å¦‚æ? Price è¢«æ??¤ï?Discounted Price é¡¯ç¤º??0
            const discountedPriceValue = isExcluded ? 0 : discountedPrice;
            const isDiscounted = discountedPriceValue < price;

            // [FIX v6291] (ä¿®å¾© PDF æ­¥é? 1.2, 1.3, 1.4) å¯¦ç ¾æ­?¢º?„é??²æ¨£å¼ é?è¼?(GTH ?ˆæœ¬)
            let priceStyle = 'style="color: #333;"'; // (1.3) ? è¨­ Price ?ºé???
            let discountedPriceStyle = 'style="font-weight: bold; color: #333;"'; // (1.3) GTH ? è¨­é»‘è‰²ç²—é?

            if (isExcluded) {
                // (1.4) Price: ?°è‰²?ªé™¤ç·?Discounted: ç´…è‰²
                priceStyle = 'style="text-decoration: line-through; color: #999999;"';
                discountedPriceStyle = 'style="font-weight: bold; color: #d32f2f;"';
            } else if (isDiscounted) {
                // (1.2) Price: ?°è‰² Discounted: ç´…è‰²
                priceStyle = 'style="color: #999999;"';
                discountedPriceStyle = 'style="font-weight: bold; color: #d32f2f;"';
            }
            // (1.3) ?…æ? (isExcluded = false ä¸?isDiscounted = false) å·²åœ¨? è¨­ä¸­è???

            // [MODIFIED] Return data object instead of string
            return {
                number,
                description,
                qty,
                price: price.toFixed(2),
                discountedPrice: discountedPriceValue.toFixed(2),
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

        // Row 3: Motorised Accessories (Optional)
        // [FIX v6291] æ­¥é? 2: ä¿®æ­£ isExcluded ? è¼¯ï¼Œç¢ºä¿?Price æ°¸é?ä¸ æ?è¢«å???
        // [MODIFIED v6291] æ­¥é? 2: è¨»è§£
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
        const deliveryExcluded = uiState.f2.deliveryFeeExcluded;
        rows.push(createRowData(
            itemNumber++,
            'Delivery',
            uiState.f2.deliveryQty || 1,
            summaryData.deliveryFee || 0,
            summaryData.deliveryFee || 0,
            deliveryExcluded
        ));

        // Row 5: Installation
        // [MODIFIED v6290 Bug 1 Fix]
        const installExcluded = uiState.f2.installFeeExcluded;
        rows.push(createRowData(
            itemNumber++,
            'Installation',
            uiState.f2.installQty || 0, // Use installQty from F2 state
            summaryData.installFee || 0,
            summaryData.installFee || 0,
            installExcluded
        ));

        // Row 6: Removal
        const removalExcluded = uiState.f2.removalFeeExcluded;
        rows.push(createRowData(
            itemNumber++,
            'Removal',
            uiState.f2.removalQty || 0,
            summaryData.removalFee || 0,
            summaryData.removalFee || 0,
            removalExcluded
        ));

        // [MODIFIED] Map data objects to HTML strings using the template
        return rows.map(rowData =>
            // [MODIFIED] (階段 1) Call external util
            populateTemplate(gmailTemplateCardTemplate, rowData)
        ).join('');
    }
}