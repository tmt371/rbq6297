/* FILE: 04-core-code/utils/template-utils.js */
// [NEW] (階段 1) 建立通用模板工具函式庫

/**
 * 填充模板中的佔位符。
 * @param {string} template - 包含 {{key}} 或 {{{key}}} 佔位符的 HTML 模板。
 * @param {object} data - 一個包含 key:value 對應的資料物件。
 * @returns {string} 填充後的 HTML 字串。
 */
export function populateTemplate(template, data) {
    // [MOVED] 此函式從 quote-generator-service.js 移轉過來
    return template.replace(/\{\{\{?([\w\-]+)\}\}\}?/g, (match, key) => {
        const value = data.hasOwnProperty(key) ? data[key] : null;

        // 允許 `null` 或 `0` 被渲染
        if (value !== null && value !== undefined) {
            return value;
        }

        // Fallback for GTH keys that might not be in templateData root
        if (key === 'total') return data.grandTotal;
        if (key === 'deposit') return data.deposit;
        if (key === 'balance') return data.balance;
        if (key === 'ourOffer') return data.ourOffer;

        return match; // Keep original placeholder if key not found
    });
}

/**
 * 格式化客戶資訊為 HTML 字串。
 * @param {object} templateData - 包含 customerName, customerAddress 等的資料物件。
 * @returns {string} 格式化後的 HTML。
 */
export function formatCustomerInfo(templateData) {
    // [MOVED] 此函式從 quote-generator-service.js 移轉過來
    let html = `<strong>${templateData.customerName || ''}</strong><br>`;
    if (templateData.customerAddress) html += `${templateData.customerAddress.replace(/\n/g, '<br>')}<br>`;
    if (templateData.customerPhone) html += `Phone: ${templateData.customerPhone}<br>`;
    if (templateData.customerEmail) html += `Email: ${templateData.customerEmail}`;
    return html;
}