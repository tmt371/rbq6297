/* FILE: 04-core-code/services/quote-generator-service.js */
// [MODIFIED] (階段 2) Refactored: Work Order logic moved to WorkOrderStrategy.

import { paths } from '../config/paths.js';
// [NEW] (階段 1) Import the new external utility functions
import { populateTemplate, formatCustomerInfo } from '../utils/template-utils.js';
// [REMOVED] (階段 2) WorkOrderStrategy is injected, not imported here.

/**
 * @fileoverview A service for generating quote HTML, now acting as a dispatcher.
 * It pre-fetches templates and delegates generation to injected strategies.
 */
export class QuoteGeneratorService {
    constructor({
        calculationService,
        workOrderStrategy /* [NEW] (階段 2) */
        // originalQuoteStrategy, // [FUTURE]
        // gthQuoteStrategy // [FUTURE]
    }) {
        this.calculationService = calculationService;

        // [NEW] (階段 2) Store injected strategies
        this.workOrderStrategy = workOrderStrategy;
        // this.originalQuoteStrategy = originalQuoteStrategy;
        // this.gthQuoteStrategy = gthQuoteStrategy;

        this.quoteTemplate = '';
        this.detailsTemplate = '';
        this.gmailTemplate = ''; // [NEW]
        // [NEW] Add new template properties
        this.quoteTemplateRow = '';
        this.gmailTemplateCard = '';
        // [NEW] Add property to hold the fetched client script content
        this.quoteClientScript = '';
        // [NEW] Add property to hold the GTH client script content
        this.gmailClientScript = '';
        // [NEW] Add property for the detailed list row
        this.detailedItemListRow = '';
        // [NEW] 階段 1: Add property for the work order template
        this.workOrderTemplate = '';
        // [MODIFIED] 階段 2 修復: Renamed from 'workOrderTemplateRow'
        this.workOrderRowTemplate = ''; // Will hold work-order-template-row.html

        // [MODIFIED] The script now includes a robust CSS inlining mechanism.
        this.actionBarHtml = `
     <div id="action-bar">
        <button id="copy-html-btn">Copy HTML</button>
        <button id="print-btn">Print / Save PDF</button>
    </div>`;

        console.log("QuoteGeneratorService Initialized (as Dispatcher).");
    }

    // [REMOVED] Original _initialize() logic is moved to _loadTemplates()
    async _initialize() {
        // This function is now a placeholder, but we keep it
        // in case the _loadTemplates() call fails, we can re-call it.
        try {
            [
                this.quoteTemplate,
                this.detailsTemplate,
                this.gmailTemplate,
                // [NEW] Load the new templates
                this.quoteTemplateRow,
                this.gmailTemplateCard,
                // [NEW] Fetch the client script content as text
                this.quoteClientScript,
                // [NEW] Fetch the GTH client script content as text
                this.gmailClientScript,
                // [NEW] Fetch the detailed list row template
                this.detailedItemListRow,
                // [NEW] 階段 1: Fetch the new work order template
                this.workOrderTemplate,
                // [MODIFIED] 階段 2 修復: Load the new work order row template
                this.workOrderRowTemplate
            ] = await Promise.all([
                fetch(paths.partials.quoteTemplate).then(res => res.text()),
                fetch(paths.partials.detailedItemList).then(res => res.text()),
                fetch(paths.partials.gmailSimple).then(res => res.text()), // [NEW]
                // [NEW] Fetch the new templates
                fetch(paths.partials.quoteTemplateRow).then(res => res.text()),
                fetch(paths.partials.gmailTemplateCard).then(res => res.text()),
                // [NEW] Fetch the client script
                fetch(paths.partials.quoteClientScript).then(res => res.text()),
                // [NEW] Fetch the GTH client script
                fetch(paths.partials.gmailClientScript).then(res => res.text()),
                // [NEW] Fetch the detailed list row
                fetch(paths.partials.detailedItemListRow).then(res => res.text()),
                // [NEW] 階段 1: Fetch the work order template
                fetch(paths.partials.workOrderTemplate).then(res => res.text()),
                // [MODIFIED] 階段 2 修復: Fetch the work order row template
                fetch(paths.partials.workOrderTemplateRow).then(res => res.text()),
            ]);
            console.log("QuoteGeneratorService: All (8) HTML templates and (2) client scripts pre-fetched and cached.");
        } catch (error) {
            console.error("QuoteGeneratorService: Failed to pre-fetch HTML templates:", error);
            // In a real-world scenario, you might want to publish an error event here.
        }
    }

    // [NEW] (Refactor - Lazy Load)
    // This method ensures templates are loaded, but only fetches them once.
    async _loadTemplates() {
        // Check if templates are already loaded.
        // [MODIFIED] 階段 2 修復: Check for new work order row template
        if (this.quoteTemplate && this.detailsTemplate && this.gmailTemplate && this.quoteTemplateRow && this.gmailTemplateCard && this.quoteClientScript && this.gmailClientScript && this.detailedItemListRow && this.workOrderTemplate && this.workOrderRowTemplate) {
            return; // Already loaded, do nothing.
        }

        // If not loaded, call the original _initialize logic to fetch them.
        console.log("QuoteGeneratorService: First click detected, fetching templates...");
        await this._initialize();
    }

    // [MODIFIED] 階段 2: 實作工單 HTML 的產生
    /**
     * Generates the HTML for the Work Order (No Prices).
     * @param {object} quoteData - The application's quote data.
     * @param {object} ui - The application's UI state.
     * @returns {Promise<string|null>} The populated HTML string or null if templates aren't loaded.
     */
    async generateWorkOrderHtml(quoteData, ui) {
        // 1. 確保模板已載入
        await this._loadTemplates();

        if (!this.workOrderTemplate || !this.workOrderRowTemplate || !this.workOrderStrategy) {
            console.error("QuoteGeneratorService: Work Order templates or strategy are not loaded yet.");
            return null;
        }

        // 2. 獲取填充資料
        const templateData = this.calculationService.getQuoteTemplateData(quoteData, ui, quoteData);

        // 3. [NEW] (階段 2) 呼叫策略 (Strategy) 產生表格列
        const workOrderTableRows = this.workOrderStrategy.generateRows(
            templateData,
            this.workOrderRowTemplate
        );

        // 4. (階段 2) 組合所有資料
        const populatedData = {
            ...templateData,
            workOrderTableRows: workOrderTableRows
        };

        // 5. (階段 2) 填充主模板
        // [MODIFIED] (階段 1) Call external util
        let finalHtml = populateTemplate(this.workOrderTemplate, populatedData);

        return finalHtml;
    }


    /**
     * [NEW] (Phase 3, Step C) Generates the simple HTML for Gmail.
     */
    async generateGmailQuoteHtml(quoteData, ui, f3Data) {
        // [NEW] (Refactor - Lazy Load) Ensure templates are loaded before proceeding.
        await this._loadTemplates();

        if (!this.gmailTemplate || !this.gmailClientScript) {
            console.error("QuoteGeneratorService: Gmail template or client script is not loaded yet.");
            return null;
        }

        // 1. Get common data
        // [MODIFIED v6291] æ­¥é? 5: getQuoteTemplateData ç¢ºä?ç¸½æ˜¯è¿”å? ourOffer
        const templateData = this.calculationService.getQuoteTemplateData(quoteData, ui, f3Data);

        // 2. [NEW v6290 Task 2] Conditionally create the GST row HTML
        let gstRowHtml = '';
        if (!templateData.uiState.f2.gstExcluded) {
            gstRowHtml = `
                 <tr>
                     <td class="summary-label"
                         style="padding: 8px 0; border: 1px solid #dddddd; font-size: 13.3px; text-align: right; padding-right: 20px; color: #555555;">
                         GST</td>
                     <td class="summary-value"
                         style="padding: 8px 0; border: 1px solid #dddddd; font-size: 13.3px; text-align: right; font-weight: 500; padding-right: 10px;">
                         ${templateData.gst}</td>
                </tr>
            `; // [FIX v6291] ç§»é™¤?¯èª¤??`\`
        }

        // 3. Populate the GTH template
        // [MODIFIED] (階段 1) Call external util
        let finalHtml = populateTemplate(this.gmailTemplate, {
            ...templateData,
            // [MODIFIED] v6290 Bind to correct F2 values
            total: templateData.grandTotal,
            deposit: templateData.deposit,
            balance: templateData.balance,
            ourOffer: templateData.ourOffer, // [FIX v6291] æ­¥é? 5: ç¢ºä? ourOffer è¢«å‚³??

            // [MODIFIED] (階段 1) Call external util
            customerInfoHtml: formatCustomerInfo(templateData),
            // [MODIFIED v6290 Task 1] Ensure item list is formatted
            itemsTableBody: this._generatePageOneItemsTableHtml_GTH(templateData),
            // [NEW v6290 Task 2] Pass the conditional GST row
            gstRowHtml: gstRowHtml
        });

        // 4. [REMOVED v6290 Task 2] Remove the faulty regex replacement
        // const gstRowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?GST[\s\S]*?<\/td>[\s\S]*?<\/tr>/i;
        // finalHtml = finalHtml.replace(gstRowRegex, '');


        // 5. [MODIFIED] Inject the GTH script content (fetched from file)
        finalHtml = finalHtml.replace(
            '</body>',
            `<script>${this.gmailClientScript}</script></body>`
        );

        return finalHtml;
    }

    /**
     * Generates the full HTML for PDF/Print.
     */
    async generateQuoteHtml(quoteData, ui, f3Data) {
        // [NEW] (Refactor - Lazy Load) Ensure templates are loaded before proceeding.
        await this._loadTemplates();

        if (!this.quoteTemplate || !this.detailsTemplate || !this.quoteClientScript) {
            console.error("QuoteGeneratorService: Templates or client script are not loaded yet.");
            return null;
        }

        // 1. Delegate all data preparation to CalculationService.
        // [MODIFIED v6291] æ­¥é? 5: getQuoteTemplateData ç¢ºä?ç¸½æ˜¯è¿”å? ourOffer
        const templateData = this.calculationService.getQuoteTemplateData(quoteData, ui, f3Data);

        // 2. [NEW v6290 Task 2] Conditionally create the GST row HTML for the *Original Table*
        let gstRowHtml = '';
        if (!templateData.uiState.f2.gstExcluded) {
            gstRowHtml = `
                 <tr> 
                    <td class="summary-label">GST (10%)</td> 
                    <td class="summary-value">${templateData.gst}</td>
                 </tr>
            `;
        }

        // 3. Generate HTML snippets using the prepared data.
        const populatedDataWithHtml = {
            ...templateData,
            // [MODIFIED] (階段 1) Call external util
            customerInfoHtml: formatCustomerInfo(templateData),
            // [MODIFIED v6290 Task 1] Use the single-table generator
            // [FIX v6291] (æ­¥é? 1, 2) æ­¤å‡½?¸ç ¾?¨å ªè¿”å? <tr>...</tr>
            itemsTableBody: this._generatePageOneItemsTableHtml_Original(templateData),
            // [MODIFIED] Call renamed function and use new placeholder key
            rollerBlindsTableRows: this._generateItemsTableHtml_RowsOnly(templateData),
            gstRowHtml: gstRowHtml // [NEW] Pass the conditional GST row
        };

        // 4. Populate templates
        // [MODIFIED] (階段 1) Call external util
        const populatedDetailsPageHtml = populateTemplate(this.detailsTemplate, populatedDataWithHtml);

        const styleMatch = populatedDetailsPageHtml.match(/<style>([\s\S]*)<\/style>/i);
        const detailsBodyMatch = populatedDetailsPageHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);

        if (!detailsBodyMatch) {
            throw new Error("Could not find body content in the details template.");
        }

        const detailsStyleContent = styleMatch ? styleMatch[0] : '';
        const detailsBodyContent = detailsBodyMatch[1];

        let finalHtml = this.quoteTemplate.replace('</head>', `${detailsStyleContent}</head>`);
        finalHtml = finalHtml.replace('</body>', `${detailsBodyContent}</body>`);
        // [MODIFIED] (階段 1) Call external util
        finalHtml = populateTemplate(finalHtml, populatedDataWithHtml);

        // 5. Inject the action bar and script into the final HTML
        finalHtml = finalHtml.replace(
            '<body>',
            `<body>${this.actionBarHtml}`
        );

        // [MODIFIED] Re-add the script injection, but wrap the fetched script content
        finalHtml = finalHtml.replace(
            '</body>',
            `<script>${this.quoteClientScript}</script></body>`
        );

        return finalHtml;
    }

    // [REMOVED] (階段 1) _populateTemplate moved to template-utils.js
    // [REMOVED] (階段 1) _formatCustomerInfo moved to template-utils.js

    // [REMOVED] (階段 2) _generateWorkOrderItemsTableHtml moved to work-order-strategy.js
    // _generateWorkOrderItemsTableHtml(templateData) { ... }


    // [MODIFIED] Renamed function
    _generateItemsTableHtml_RowsOnly(templateData) {
        const { items, mulTimes } = templateData;
        // [REMOVED] Headers are now defined in detailed-item-list-final.html
        // const headers = ['#', 'F-NAME', 'F-COLOR', 'Location', 'HD', 'Dual', 'Motor', 'Price'];

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

                // [REMOVED] The inline 'cell' helper function is removed.

                // [NEW] Create data object for the template
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
                    price: `$${finalPrice.toFixed(2)}`,
                    isEmptyClassHD: winderText ? '' : 'is-empty-cell',
                    isEmptyClassDual: dualText ? '' : 'is-empty-cell',
                    isEmptyClassMotor: motorText ? '' : 'is-empty-cell',
                };

                // [NEW] Populate the new external template
                // [MODIFIED] (階段 1) Call external util
                return populateTemplate(this.detailedItemListRow, rowData);
            })
            .join('');

        // [REMOVED] The <table> wrapper string is deleted.
        return rows;
    }

    // [NEW v6290 Task 1] This is the new function for "Original" (Add Quote)
    // It generates a SINGLE table
    _generatePageOneItemsTableHtml_Original(templateData) {
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
        // [è¨»] æ­¥é? 6: æ­¤è?? è¼¯å·²æ­£ç¢ºï?isExcluded ?ƒç¹¼??deliveryExcluded
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
        // [è¨»] æ­¥é? 7: æ­¤è?? è¼¯å·²æ­£ç¢ºï?isExcluded ?ƒç¹¼??installExcluded
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
        // [è¨»] æ­¥é? 8: æ­¤è?? è¼¯å·²æ­£ç¢ºï?isExcluded ?ƒç¹¼??removalExcluded
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
            populateTemplate(this.quoteTemplateRow, rowData)
        ).join('');
    }

    // [NEW v6290 Task 1] This is the restored function for GTH
    // It generates MULTIPLE tables (cards)
    _generatePageOneItemsTableHtml_GTH(templateData) {
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
            populateTemplate(this.gmailTemplateCard, rowData)
        ).join('');
    }
}