/* FILE: 04-core-code/config/status-config.js */
// [NEW] (F4 Status Phase 1) Defines all statuses for the quote lifecycle
// [MODIFIED] (F4 Status Tweak) Translated to "Hybrid" English version for conciseness.
// [MODIFIED] (Correction Flow Phase 1) Added X_CANCELLED status.

export const QUOTE_STATUS = {
    A_SAVED: "A. Saved (Draft)",
    B_QUOTED: "B. Quoted",
    C_CONFIRMED: "C. Order Confirmed",
    D_DEPOSIT_PAID: "D. Deposit Paid",
    E_TO_FACTORY: "E. To Factory",
    F_PRODUCTION: "F. Production",
    G_READY_PICKUP: "G. Pickup Ready",
    H_DELIVERED: "H. Picked Up/Delivered",
    I_COMPLETED: "I. Installed/Completed",
    J_INVOICED: "J. Bill/Invoice Sent",
    K_OVERDUE: "K. Overdue",
    L_CLOSED: "L. Closed (Paid)",
    Y_ON_HOLD: "Y. On Hold (Issue)",
    X_CANCELLED: "X. Order Cancelled"
};

export const ROLE_STATUS_PERMISSIONS = {
    admin: Object.keys(QUOTE_STATUS), // Admin can select anything
    sales: [ // Sales / Quote App Users
        'A_SAVED', 'B_QUOTED', 'C_CONFIRMED',
        'E_TO_FACTORY', 'I_COMPLETED',
        'Y_ON_HOLD', 'X_CANCELLED'
    ],
    factory: [ // Future factory app
        'E_TO_FACTORY', 'F_PRODUCTION',
        'G_READY_PICKUP', 'H_DELIVERED', 'Y_ON_HOLD'
    ],
    accountant: [ // Future accounting app
        'D_DEPOSIT_PAID', 'J_INVOICED',
        'K_OVERDUE', 'L_CLOSED', 'Y_ON_HOLD'
    ]
};

export const STATE_TRANSITIONS = {
    [QUOTE_STATUS.A_SAVED]: [QUOTE_STATUS.B_QUOTED, QUOTE_STATUS.X_CANCELLED],
    [QUOTE_STATUS.B_QUOTED]: [QUOTE_STATUS.C_CONFIRMED, QUOTE_STATUS.A_SAVED, QUOTE_STATUS.X_CANCELLED],
    [QUOTE_STATUS.C_CONFIRMED]: [QUOTE_STATUS.D_DEPOSIT_PAID, QUOTE_STATUS.X_CANCELLED],
    [QUOTE_STATUS.D_DEPOSIT_PAID]: [QUOTE_STATUS.E_TO_FACTORY, QUOTE_STATUS.Y_ON_HOLD, QUOTE_STATUS.X_CANCELLED],
    [QUOTE_STATUS.E_TO_FACTORY]: [QUOTE_STATUS.F_PRODUCTION, QUOTE_STATUS.Y_ON_HOLD],
    [QUOTE_STATUS.F_PRODUCTION]: [QUOTE_STATUS.G_READY_PICKUP, QUOTE_STATUS.E_TO_FACTORY, QUOTE_STATUS.Y_ON_HOLD],
    [QUOTE_STATUS.G_READY_PICKUP]: [QUOTE_STATUS.H_DELIVERED, QUOTE_STATUS.I_COMPLETED, QUOTE_STATUS.F_PRODUCTION],
    [QUOTE_STATUS.H_DELIVERED]: [QUOTE_STATUS.I_COMPLETED, QUOTE_STATUS.G_READY_PICKUP],
    [QUOTE_STATUS.I_COMPLETED]: [QUOTE_STATUS.J_INVOICED],
    [QUOTE_STATUS.J_INVOICED]: [QUOTE_STATUS.L_CLOSED, QUOTE_STATUS.K_OVERDUE],
    [QUOTE_STATUS.K_OVERDUE]: [QUOTE_STATUS.L_CLOSED],
    [QUOTE_STATUS.L_CLOSED]: [],
    [QUOTE_STATUS.Y_ON_HOLD]: [QUOTE_STATUS.E_TO_FACTORY, QUOTE_STATUS.F_PRODUCTION, QUOTE_STATUS.X_CANCELLED],
    [QUOTE_STATUS.X_CANCELLED]: []
};