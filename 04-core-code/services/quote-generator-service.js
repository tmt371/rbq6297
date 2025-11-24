/* FILE: 04-core-code/services/quote-generator-service.js */
// [MODIFIED] (?Оцо╡ 4) Refactored: GTH logic moved to GthQuoteStrategy.
// [FIX] (v6299 Phase 5 Fix) Update generateWorkOrderHtml to pass raw quoteData to strategy.

import { paths } from '../config/paths.js';
import { populateTemplate, formatCustomerInfo } from '../utils/template-utils.js';

/**
 * @fileoverview A service for generating quote HTML, now acting as a dispatcher.
 * It pre-fetches templates and delegates generation to injected strategies.
 */
export class QuoteGeneratorService {
    constructor({
        calculationService,
        workOrderStrategy,
        originalQuoteStrategy,
        gthQuoteStrategy
    }) {
        this.calculationService = calculationService;
        this.workOrderStrategy = workOrderStrategy;
        this.originalQuoteStrategy = originalQuoteStrategy;
        this.gthQuoteStrategy = gthQuoteStrategy;

        this.quoteTemplate = '';
        this.detailsTemplate = '';
        this.gmailTemplate = '';
        this.quoteTemplateRow = '';
        this.gmailTemplateCard = '';
        this.quoteClientScript = '';
        this.gmailClientScript = '';
        this.detailedItemListRow = '';
        this.workOrderTemplate = '';
        this.workOrderRowTemplate = '';

        this.actionBarHtml = `
     <div id="action-bar">
        <button id="copy-html-btn">Copy HTML</button>
        <button id="print-btn">Print / Save PDF</button>
    </div>`;

        console.log("QuoteGeneratorService Initialized (as Dispatcher).");
    }

    async _loadTemplates() {
        if (this.quoteTemplate && this.detailsTemplate && this.gmailTemplate && this.quoteTemplateRow && this.gmailTemplateCard && this.quoteClientScript && this.gmailClientScript && this.detailedItemListRow && this.workOrderTemplate && this.workOrderRowTemplate) {
            return;
        }
        console.log("QuoteGeneratorService: First click detected, fetching templates...");

        try {
            [
                this.quoteTemplate,
                this.detailsTemplate,
                this.gmailTemplate,
                this.quoteTemplateRow,
                this.gmailTemplateCard,
                this.quoteClientScript,
                this.gmailClientScript,
                this.detailedItemListRow,
                this.workOrderTemplate,
                this.workOrderRowTemplate
            ] = await Promise.all([
                fetch(paths.partials.quoteTemplate).then(res => res.text()),
                fetch(paths.partials.detailedItemList).then(res => res.text()),
                fetch(paths.partials.gmailSimple).then(res => res.text()),
                fetch(paths.partials.quoteTemplateRow).then(res => res.text()),
                fetch(paths.partials.gmailTemplateCard).then(res => res.text()),
                fetch(paths.partials.quoteClientScript).then(res => res.text()),
                fetch(paths.partials.gmailClientScript).then(res => res.text()),
                fetch(paths.partials.detailedItemListRow).then(res => res.text()),
                fetch(paths.partials.workOrderTemplate).then(res => res.text()),
                fetch(paths.partials.workOrderTemplateRow).then(res => res.text()),
            ]);
            console.log("QuoteGeneratorService: All templates fetched.");
        } catch (error) {
            console.error("QuoteGeneratorService: Failed to pre-fetch HTML templates:", error);
        }
    }

    /**
     * Generates the HTML for the Work Order (No Prices).
     */
    async generateWorkOrderHtml(quoteData, ui) {
        await this._loadTemplates();

        if (!this.workOrderTemplate || !this.workOrderRowTemplate || !this.workOrderStrategy) {
            console.error("QuoteGeneratorService: Work Order templates or strategy are not loaded yet.");
            return null;
        }

        // [FIX] Pass raw quoteData and ui to the strategy so it can perform sorting and calculations correctly.
        // We no longer pass 'templateData' because the strategy needs access to 'uiMetadata' for LF checks
        // and 'priceMatrix' (via configManager) which requires raw data.
        const workOrderTableRows = this.workOrderStrategy.generateRows(
            quoteData,
            ui,
            this.workOrderRowTemplate
        );

        // We still need templateData for the summary/header fields (customer name, totals, etc.)
        const templateData = this.calculationService.getQuoteTemplateData(quoteData, ui, quoteData);

        const populatedData = {
            ...templateData,
            workOrderTableRows: workOrderTableRows
        };

        let finalHtml = populateTemplate(this.workOrderTemplate, populatedData);
        return finalHtml;
    }


    async generateGmailQuoteHtml(quoteData, ui, f3Data) {
        await this._loadTemplates();

        if (!this.gmailTemplate || !this.gmailClientScript || !this.gthQuoteStrategy) {
            console.error("QuoteGeneratorService: Gmail template, client script, or GthQuoteStrategy are not loaded yet.");
            return null;
        }

        const templateData = this.calculationService.getQuoteTemplateData(quoteData, ui, f3Data);

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
            `;
        }

        let finalHtml = populateTemplate(this.gmailTemplate, {
            ...templateData,
            total: templateData.grandTotal,
            deposit: templateData.deposit,
            balance: templateData.balance,
            ourOffer: templateData.ourOffer,
            customerInfoHtml: formatCustomerInfo(templateData),
            itemsTableBody: this.gthQuoteStrategy.generateCardsHtml(
                templateData,
                this.gmailTemplateCard
            ),
            gstRowHtml: gstRowHtml
        });

        finalHtml = finalHtml.replace(
            '<body>',
            `<body><script>${this.gmailClientScript}</script>` // Inject script at top of body or replace body end
        ).replace('</body>', ''); // Remove old body tag to avoid duplication if appending

        // Actually, better to just append script before closing body
        // Resetting for clean append:
        // finalHtml += `<script>${this.gmailClientScript}</script>`; 
        // But the template usually has </body>. Let's stick to previous logic:
        // finalHtml = finalHtml.replace('</body>', `<script>${this.gmailClientScript}</script></body>`);
        // Re-implementing the verified logic from previous file:
        finalHtml = finalHtml.replace('</body>', `<script>${this.gmailClientScript}</script></body>`);

        return finalHtml;
    }

    async generateQuoteHtml(quoteData, ui, f3Data) {
        await this._loadTemplates();

        if (!this.quoteTemplate || !this.detailsTemplate || !this.quoteClientScript || !this.originalQuoteStrategy) {
            console.error("QuoteGeneratorService: Templates, client script, or OriginalQuoteStrategy are not loaded yet.");
            return null;
        }

        const templateData = this.calculationService.getQuoteTemplateData(quoteData, ui, f3Data);

        let gstRowHtml = '';
        if (!templateData.uiState.f2.gstExcluded) {
            gstRowHtml = `
                 <tr> 
                    <td class="summary-label">GST (10%)</td> 
                    <td class="summary-value">${templateData.gst}</td>
                 </tr>
            `;
        }

        const populatedDataWithHtml = {
            ...templateData,
            customerInfoHtml: formatCustomerInfo(templateData),
            itemsTableBody: this.originalQuoteStrategy.generatePageOneHtml(
                templateData,
                this.quoteTemplateRow
            ),
            rollerBlindsTableRows: this.originalQuoteStrategy.generateDetailsPageHtml(
                templateData,
                this.detailedItemListRow
            ),
            gstRowHtml: gstRowHtml
        };

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
        finalHtml = populateTemplate(finalHtml, populatedDataWithHtml);

        finalHtml = finalHtml.replace(
            '<body>',
            `<body>${this.actionBarHtml}`
        );

        finalHtml = finalHtml.replace(
            '</body>',
            `<script>${this.quoteClientScript}</script></body>`
        );

        return finalHtml;
    }
}