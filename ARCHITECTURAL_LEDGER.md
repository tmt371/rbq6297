# ARCHITECTURAL LEDGER

This document serves as the authoritative, integrated ledger for the RBQ project. It consolidates previous architectural contexts to ensure strict structural awareness and prevent regressions during AI development sessions.

## SECTION 1: SKELETON MAP (Where things are)

### Folder Tree
```text
04-core-code/
├── actions/      # Redux-style action creators definitions
├── config/       # Global constants, Firebase configuration, and regex definitions
├── reducers/     # State permutation logic
├── services/     # Core business logic, document generation, and external integration
│   └── generators/ # Sub-service classes for specific PDF documents
├── strategies/   # Design pattern implementations
├── ui/           # Visual layer
│   ├── css/        # Component-specific stylesheets
│   ├── partials/   # Reusable UI fragments
│   ├── tabs/       # Top-level tab components
│   └── views/      # Sub-views and dialog controllers (e.g. F1 to F4, S1 to S2)
└── utils/        # Stateless pure helper functions (formatting, parsing)
```

### Component Directory (Core Selections)
- `actions/quote-actions.js`: Dispatches side effects relating to saving and extracting quote states.
- `actions/ui-actions.js`: Controls transient visual states.
- `config/constants.js`: Provides enumerations for application-wide immutable strings.
- `config/initial-state.js`: Defines the default shape of the application's quote store.
- **`services/workflow-service.js`**: **SPECIAL FOCUS**. Manages PDF generation logic, enforcing the dual-path decoupling between "Silent/Direct Background Downloads" and "Interactive Tab/Blob URL Previews".
- **`services/calculation-service.js`**: **SPECIAL FOCUS**. Core mathematical engine for the quoting algorithm and centralized brand-mapping logic for all accessory constraints.
- `services/quote-persistence-service.js`: Interfaces with Firebase and local storage to serialize and hydrate quote documents.
- `ui/ui-manager.js`: Mounts root components and coordinates lifecycle events across the DOM.
- **`ui/views/detail-config-view.js`**: **SPECIAL FOCUS**. Handles complex multi-select UI logic, specifically focusing on Light-Filter (LF) mode grid interactions and dialog orchestration.
- `ui/views/f4-actions-view.js`: Controls final production handoffs, exporting constraints, and triggers for PDF processing.
- `ui/views/fabric-config-view.js`: Handles granular fabric property selections and constraints.
- **`utils/csv-parser.js`**: **SPECIAL FOCUS**. Handles robust CSV importing and strictly maintains a zero-length regex match safety valve (`match.index === regex.lastIndex` check) to prevent infinite loops and `Invalid array length` RangeErrors on entirely empty rows.

## SECTION 2: THE IRON RULES (Architectural Boundaries)

- **[PDF BLOB]** Individual PDF previews MUST use `Blob` URLs. NEVER use `document.write` as it disrupts the DOM execution timeline.
- **[DATA-DRIVEN UI]** Table striping and anchor styles must use explicitly calculated row classes (e.g., `.row-even`, `.row-fifth`) injected dynamically via the JS rendering strategy, not CSS pseudo-classes.
- **[NO HARDCODED SYMBOLS]** Currency formatting inherently belongs in JS utilities (`formatUtils`), thus HTML template structures must absolutely avoid hardcoding the `$` glyph.
- **[ASCII ONLY]** Accessories must exclusively utilize standard English ASCII strings (e.g., using "Set" instead of "組") to prevent strict PDF encoding engines (`jsPDF`) from corrupting localized output into gibberish.
- **[LF VALIDATION]** Always intercept and validate ineligible fabrics (e.g., rejecting non-B2/3/4 fabrics for LF support) early within the `handleSequenceCellClick` method flow.

## SECTION 3: RECENT CRITICAL FIXES (The "Don't Break Again" List)

- **Double Dollar Signs Effect:** Fixed by offloading string currency parsing universally to JS formatting utils rather than blindly merging mapped template literals with hardcoded HTML symbols.
- **Vanishing PDF Colors Bug:** Resolved by diagnosing that Array Index states were incorrectly mapping to Detached DOM fragments. Fixed by strictly keeping rendering operations tightly bound to live `tbody` children indexes in real-time.
- **Silent vs Tab Dual-Path:** Overcame Chrome strict popup-blocking by fully decoupling the "Print Work Order" interactive UI (opening a new tab from an explicit user click) versus the "Background PDF Generation" (using hidden iframes specifically for silent batch downloads) within `WorkflowService`.
- **CSV Parser Infinite Loop:** A lethal `RangeError: Invalid array length` crash during `import` was resolved by injecting a standard safety valve manually advancing `regex.lastIndex++` when matching zero-length empty string chains (like `, , , ,`) inside `_parseCsvLine()`.
- **Note:** All future detailed architecture reports MUST be persistently saved to `C:\rbq6297\_Architecture_Reports`.
