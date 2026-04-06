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

## SECTION 2: THE IRON RULES (Architectural Boundaries)

- **RULE: [PDF BLOB]** Individual PDF previews MUST use Blob URLs. NEVER use `document.write`.
- **RULE: [DATA-DRIVEN UI]** Table striping/anchors must use explicit row classes (`row-even`, `row-fifth`) injected via JS strategy.
- **RULE: [NO HARDCODED SYMBOLS]** Currency formatting belongs in JS utilities; HTML templates must not hardcode `$`.
- **RULE: [ASCII ONLY]** Accessories must use English strings (e.g., "Set") to avoid PDF encoding corruption (No Japanese/CJK).
- **RULE: [LF VALIDATION]** Always intercept ineligible fabrics (non B2,3,4) early in `handleSequenceCellClick`.
- **RULE: [ADMIN AUTH]** User creation MUST use a Secondary Firebase App instance to prevent logging out the active admin.
- **RULE: [FIRESTORE SECURITY]** The `/users` collection is strictly locked down; read/write access requires verifying the user's `role == 'admin'` directly via `get()`.

---

## SECTION 3: RECENT CRITICAL FIXES (The "Don't Break Again" List)

- **Double Dollar Signs**: Fixed by centralizing unit formatting to prevent double-injection of currency symbols.
- **Vanishing PDF Colors**: Resolved by fixing Array Indexing and Detached DOM issues in the generation path.
- **Silent vs Tab**: Implemented dual-path logic to handle background downloads vs. active tab previews correctly.
- **CSV Parser Infinite Loop**: Added `lastIndex` progression guard for empty regex matches during parsing.
- **Auth Link Expired**: Fixed password resets by adding `actionCodeSettings` with `window.location.origin` to force local redirects.
- **Swipeable Admin Tabs**: Implemented horizontal overflow flexboxes for Admin navigation on mobile.

---
> [!NOTE]
> All architecture reports and decision logs MUST be saved to `C:\rbq6297\_Architecture_Reports`.

任務完成
