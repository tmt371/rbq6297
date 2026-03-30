/* FILE: 04-core-code/services/quote-generator-service.js */
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
        if (this.quoteTemplate && this.detailsTemplate && this.gmailTemplate &&
            this.quoteTemplateRow && this.gmailTemplateCard && this.quoteClientScript &&
            this.gmailClientScript && this.detailedItemListRow && this.workOrderTemplate &&
            this.workOrderRowTemplate) {
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
                fetch(paths.partials.workOrderTemplateRow).then(res => res.text())
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

        const workOrderTableRows = this.workOrderStrategy.generateRows(
            quoteData,
            ui,
            this.workOrderRowTemplate
        );

        // [MODIFIED] (Phase 11.5) Ensure we strictly fetch the absolute latest state to avoid stale names/dates.
        const latestQuoteData = this.calculationService.stateService.getState().quoteData;
        const templateData = this.calculationService.getQuoteTemplateData(quoteData, ui, latestQuoteData, true);

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

        // [MODIFIED] Pass 'false' (default) for isWorkOrder to use Sales Prices
        const templateData = this.calculationService.getQuoteTemplateData(quoteData, ui, f3Data, false);

        let gstRowHtml = '';
        if (templateData.isGstActive) {
            gstRowHtml = `
                 <tr>
                     <td class="summary-label"
                         style="padding: 8px 0; border: 1px solid #dddddd; font-size: 13.3px; text-align: right; padding-right: 20px; color: #555555;">
                         GST</td>
                     <td class="summary-value"
                         style="padding: 8px 0; border: 1px solid #dddddd; font-size: 13.3px; text-align: right; font-weight: 500; padding-right: 10px;">
                         $${Number(templateData.uiGst).toFixed(2)}</td>
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
            `<body><script>${this.gmailClientScript}</script>`
        ).replace('</body>', '');

        finalHtml = finalHtml.replace('</body>', `<script>${this.gmailClientScript}</script></body>`);

        return finalHtml;
    }

    async generateQuoteHtml(quoteData, ui, f3Data, documentType = 'Quotation', receiptData = null, liveLedger = null) {
        await this._loadTemplates();

        if (!this.quoteTemplate || !this.detailsTemplate || !this.quoteClientScript || !this.originalQuoteStrategy) {
            console.error("QuoteGeneratorService: Templates, client script, or OriginalQuoteStrategy are not loaded yet.");
            return null;
        }

        // [PHASE I.1] Implementation: All financial data is now sourced from templateData.uiState.f2
        // which represents the UI "Source of Truth".
        const templateData = this.calculationService.getQuoteTemplateData(quoteData, ui, f3Data, false, documentType, receiptData, liveLedger);

        let gstRowHtml = '';
        if (templateData.isGstActive) {
            gstRowHtml = `
                 <tr> 
                    <td class="summary-label">GST (10%)</td> 
                    <td class="summary-value">$${Number(templateData.uiGst).toFixed(2)}</td>
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
                this.detailedItemListRow,
                documentType
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

        // --- [NEW] Agent 1 & 2 Blueprint: Strict DOM Mutation ---
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(finalHtml, 'text/html');

            const h2Title = doc.querySelector('.quotation-meta h2');
            if (h2Title) {
                // [DIRECTIVE-v3.47] Strict Header Enforcement: No "Smart" overrides
                if (documentType === 'Tax Invoice' || documentType === 'Invoice') {
                    h2Title.innerText = 'INVOICE';
                } else if (documentType === 'Receipt') {
                    h2Title.innerText = 'RECEIPT';
                } else if (documentType === 'Overdue Invoice' || documentType === 'Statement') {
                    h2Title.innerText = 'STATEMENT';
                } else {
                    h2Title.innerText = (documentType || 'QUOTATION').toUpperCase();
                }
            }

            // --- [v3.39] Due Date Calculation (D+3 for Statements) ---
            if (documentType === 'Overdue Invoice' || documentType === 'Overdue' || documentType === 'Statement') {
                const dueDateEl = doc.querySelector('.due-date-value') || doc.querySelector('[data-field="dueDate"]');
                const issueDateStr = f3Data?.issueDate || new Date().toISOString().split('T')[0];
                if (issueDateStr) {
                    const parts = issueDateStr.split('-');
                    const issueDateObj = (parts.length === 3) 
                        ? new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]), 12, 0, 0)
                        : new Date(issueDateStr);
                    
                    issueDateObj.setDate(issueDateObj.getDate() + 3);
                    const dd = String(issueDateObj.getDate()).padStart(2, '0');
                    const mm = String(issueDateObj.getMonth() + 1).padStart(2, '0');
                    const yyyy = issueDateObj.getFullYear();
                    const dueDateFormatted = `Due Date: ${dd}/${mm}/${yyyy}`;
                    if (dueDateEl) dueDateEl.textContent = dueDateFormatted;
                }
            }

            // --- [PHASE I.6] Summary Table Architecture: Pure Sourced Rendering ---
            const summaryTable = doc.querySelector('.summary-details');
            if (summaryTable) {
                const trs = Array.from(summaryTable.querySelectorAll('tr'));
                
                // Helper to setup row styling
                const applyRowStyle = (tr) => {
                    const label = tr.querySelector('.summary-label');
                    const value = tr.querySelector('.summary-value');
                    if (label) label.style.fontSize = '14px';
                    if (value) value.style.fontSize = '14px';
                    
                    if (documentType.includes('Overdue') || documentType.includes('Statement')) {
                        const text = label?.innerText || '';
                        if (text.includes('Balance')) {
                            tr.style.color = '#d32f2f';
                            if (label) { label.style.color = '#d32f2f'; label.style.fontWeight = 'bold'; }
                            if (value) { value.style.color = '#d32f2f'; value.style.fontWeight = 'bold'; }
                        }
                    }
                };

                trs.forEach(tr => {
                    const labelCell = tr.querySelector('.summary-label');
                    const valueCell = tr.querySelector('.summary-value');
                    if (!labelCell || !valueCell) return;

                    const labelText = labelCell.innerText.trim();

                    // NO MATH IN GENERATOR - Strict string mapping from CalculationService
                    if (labelText.includes('Subtotal')) {
                        valueCell.innerText = `$${Number(templateData.uiSubtotal).toFixed(2)}`;
                    } else if (labelText.includes('Our Offer')) {
                        valueCell.innerText = `$${Number(templateData.uiOurOffer).toFixed(2)}`;
                    } else if (labelText.includes('GST')) {
                        if (templateData.isGstActive) {
                            valueCell.innerText = `$${Number(templateData.uiGst).toFixed(2)}`;
                        } else {
                            tr.remove(); // Remove active row if GST inactive
                        }
                    } else if (labelText.includes('Total')) {
                        valueCell.innerText = `$${Number(templateData.uiTotal).toFixed(2)}`;
                    } else if (labelText.includes('Deposit')) {
                        if (templateData.hasPayments) {
                            labelCell.innerText = 'Deposit paid';
                            valueCell.innerText = `$${templateData.uiTotalPaid}`;
                        } else {
                            labelCell.innerText = 'Deposit';
                            valueCell.innerText = `$${Number(templateData.uiInitialDeposit).toFixed(2)}`;
                        }
                    } else if (labelText.includes('Balance')) {
                        if (templateData.hasPayments) {
                            labelCell.innerText = 'Balance Due';
                            valueCell.innerText = `$${templateData.uiDynamicBalance}`;
                        } else {
                            labelCell.innerText = 'Balance';
                            valueCell.innerText = `$${templateData.uiBalance}`;
                        }
                    }

                    applyRowStyle(tr);
                });
            }

            finalHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
        } catch (err) {
            console.error('Error during PDF DOM mutation:', err);
        }

        return finalHtml;
    }
}