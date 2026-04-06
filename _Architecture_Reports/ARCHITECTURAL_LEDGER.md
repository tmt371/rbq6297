# ARCHITECTURAL LEDGER: RBQ6297 (F4)

This document is the authoritative source of truth for the RBQ6297 project structure, design constraints, and regression history. It must be consulted before any major architectural changes.

---

## SECTION 1: SKELETON MAP (Where things are)

### 📂 Folder Tree (Simplified)
```
rbq6297/
├── 04-core-code/
│   ├── config/ (Firebase, constants, and global environment setup)
│   ├── services/
│   │   ├── calculation-service.js (Core math and brand mapping logic)
│   │   ├── workflow-service.js (PDF generation and download orchestration)
│   │   └── ocr-api-service.js (Gemini API integration for data entry)
│   ├── ui/
│   │   ├── ui-manager.js (Main application UI hub and lifecycle)
│   │   ├── ocr-view.js (OCR results review and review grid management)
│   │   └── views/
│   │       └── detail-config-view.js (LF Mode and complex configuration UI)
│   └── utils/
│       ├── csv-parser.js (Import logic with infinite loop guards)
│       └── format-utils.js (Strict currency and unit formatting)
└── admin/
    ├── admin.html (Administrative portal entry point)
    ├── admin-main.js (Tab routing and cross-view event binding)
    ├── admin-style.css (Admin UI styling with swipeable navigation)
    └── views/
        ├── admin-user-view.js (A5: Ghost User Management & Grid UI)
        └── admin-order-view.js (A4: Order/Batch management)
```

### 📋 Component Directory
- **`workflow-service.js`**: Manages PDF generation (Silent/Direct Download vs. Tab/Blob Preview).
- **`calculation-service.js`**: Core math and centralized brand-mapping for accessories.
- **`detail-config-view.js`**: Handles complex multi-select UI logic (LF Mode).
- **`csv-parser.js`**: Handles robust CSV importing with infinite loop safety guards.
- **`admin-user-view.js`**: User management hub using Secondary Firebase App for non-disruptive creation.
- **`ui-manager.js`**: Central command for UI rendering and state-to-view synchronization.
- **`ocr-view.js`**: Provides the "Broad Match" Review Grid for incoming Gemini extractions.
- **`notification-component.js`**: Application-wide toast system (Note: Admin uses internal version).

---

## SECTION 1: SKELETON MAP (Where things are) ---
- [A4 Modal]: Refactored to a 2x2 Information Grid (Customer | Status, Volume | Accounting) with a dedicated Internal Notes section.
- [A2 Matrix]: Implemented Cross-Freeze (XY Sticky) Table for large data sets.

--- SECTION 2: THE IRON RULES (New Boundaries) ---
- RULE: [MOBILE GRID] All Admin Modals MUST follow the 2x2 grid pattern (Side-by-side on Desktop, Stacked on Mobile) for core metadata.
- RULE: [STICKY OVERRIDE] Mobile sticky columns MUST use `white-space: normal !important` and `touch-action: pan-y` to prevent scroll-lock and text bleeding.
- RULE: [A2 XY-STICKY] Pricing matrices must freeze both the top row (Width) and first column (Drop) with appropriate Z-indices.

--- SECTION 3: RECENT CRITICAL FIXES (Regression Prevention) ---
- Fix: A4 "Super-Sticky" single composite column (Checkbox + ID + View) to prevent Webkit column collision.
- Fix: A3 Fee Layout (Constrained input width to 80px to prevent label truncation).
- Fix: A1/A2 Vertical Scroll Lock (Fixed via `overflow-y: auto` on tab containers).
- Fix: Modal Order ID Injection (Ensuring ID is visible at the top of all detail views).
- Fix: Auth Link Expired (Added `actionCodeSettings` with `window.location.origin` to force local redirects).
- Fix: Swipeable Admin Tabs (Implemented horizontal overflow flexboxes for Admin navigation on mobile).

---
> [!NOTE]
> All architecture reports and decision logs MUST be saved to `C:\rbq6297\_Architecture_Reports`.
