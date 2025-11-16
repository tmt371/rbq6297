/* FILE: 04-core-code/services/quote-generator-service.js */
// [MODIFIED] (階段 4) Refactored: GTH logic moved to GthQuoteStrategy.

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
        workOrderStrategy,
        originalQuoteStrategy,
        gthQuoteStrategy // [NEW] (階段 4)
    }) {
        this.calculationService = calculationService;

        // [NEW] (階段 2) Store injected strategies
        this.workOrderStrategy = workOrderStrategy;
        this.originalQuoteStrategy = originalQuoteStrategy;
        this.gthQuoteStrategy = gthQuoteStrategy; // [NEW] (階段 4)

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

        // [MODIFIED] (階段 4) Check for strategy
        if (!this.gmailTemplate || !this.gmailClientScript || !this.gthQuoteStrategy) {
            console.error("QuoteGeneratorService: Gmail template, client script, or GthQuoteStrategy are not loaded yet.");
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

            // [MODIFIED] (階段 4) Call external strategy
            itemsTableBody: this.gthQuoteStrategy.generateCardsHtml(
                templateData,
                this.gmailTemplateCard
            ),

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

        // [MODIFIED] (階段 3) Check for strategy
        if (!this.quoteTemplate || !this.detailsTemplate || !this.quoteClientScript || !this.originalQuoteStrategy) {
            console.error("QuoteGeneratorService: Templates, client script, or OriginalQuoteStrategy are not loaded yet.");
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

            // [MODIFIED] (階段 3) Call external strategy
            itemsTableBody: this.originalQuoteStrategy.generatePageOneHtml(
                templateData,
                this.quoteTemplateRow
            ),
            rollerBlindsTableRows: this.originalQuoteStrategy.generateDetailsPageHtml(
                templateData,
                this.detailedItemListRow
            ),

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
    // [REMOVED] (階段 3) _generateItemsTableHtml_RowsOnly moved to original-quote-strategy.js
    // [REMOVED] (階段 3) _generatePageOneItemsTableHtml_Original moved to original-quote-strategy.js
    // [REMOVED] (階段 4) _generatePageOneItemsTableHtml_GTH moved to gth-quote-strategy.js
}