/* FILE: 04-core-code/config/status-config.js */
// [NEW] (F4 Status Phase 1) Defines all statuses for the quote lifecycle
// [MODIFIED] (F4 Status Tweak) Translated to "Hybrid" English version for conciseness.

export const QUOTE_STATUS = {
    A_ARCHIVED: "A. Saved",
    B_VALID_ORDER: "B. Order Valid",
    C_SENT_TO_FACTORY: "C. To Factory",
    D_IN_PRODUCTION: "D. Production",
    E_READY_FOR_PICKUP: "E. Pickup Ready",
    F_PICKED_UP: "F. Picked Up",
    G_COMPLETED: "G. Completed",
    H_INVOICE_SENT: "H. Bill Sent",
    I_INVOICE_OVERDUE: "I. Overdue",
    J_CLOSED: "J. Closed"
};