/* FILE: 04-core-code/config/status-config.js */
// [NEW] (F4 Status Phase 1) Defines all statuses for the quote lifecycle

export const QUOTE_STATUS = {
    A_ARCHIVED: "A. 已存檔",
    B_VALID_ORDER: "B. 有效訂單 (待收款)", // (客戶同意報價，等待訂金)
    C_SENT_TO_FACTORY: "C. 訂單已送工廠", // (收到訂金，轉交工廠)
    D_IN_PRODUCTION: "D. 工廠生產中",
    E_READY_FOR_PICKUP: "E. 工廠通知可取貨",
    F_PICKED_UP: "F. 已取貨",
    G_COMPLETED: "G. 安裝完工",
    H_INVOICE_SENT: "H. 尾款帳單已送出",
    I_INVOICE_OVERDUE: "I. 尾款帳單逾期",
    J_CLOSED: "J. 結案"
};