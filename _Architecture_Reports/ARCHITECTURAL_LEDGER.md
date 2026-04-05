# RBQ6297 ARCHITECTURAL LEDGER
> Authoritative single-source reference for all AI sessions. DO NOT contradict these patterns.
> Last Updated: 2026-04-05

---

## SECTION 1: SKELETON MAP

### Folder Tree
```
04-core-code/
├── actions/
│   ├── quote-actions.js       # Action creators for quote state changes
│   └── ui-actions.js          # Action creators for UI state changes
├── config/
│   ├── business-constants.js  # Magic-string constants (MOUNT_TYPES, FABRIC_CODES, etc.)
│   ├── constants.js           # EVENTS, DOM_IDS, STORAGE_KEYS enums
│   ├── firebase-config.js     # Firebase init (gitignored; injected at deploy via Vercel env var)
│   ├── firebase-config.example.js  # Placeholder template for CI/CD
│   ├── initial-state.js       # Root state shape and defaults
│   ├── paths.js               # Centralised asset/data file paths
│   └── f2-config.js           # F2 panel static configuration
├── reducers/
│   ├── root-reducer.js        # Combines ui + quoteData sub-reducers
│   ├── quote-reducer.js       # Handles all quoteData mutations
│   └── ui-reducer.js          # Handles all ui state mutations
├── strategies/
│   ├── product-factory.js     # Registry: maps productType -> Strategy instance
│   └── roller-blind-strategy.js  # Pricing, Winder logic, initial item shape
├── services/
│   ├── auth-service.js        # Firebase Auth wrapper (login/logout/password reset)
│   ├── calculation-service.js # CRITICAL: Core price math + centralised accessory brand-mapping
│   ├── data-preparation-service.js  # Normalises quote items for PDF/Excel rendering
│   ├── excel-export-service.js      # Generates .xlsx output via SheetJS
│   ├── file-service.js        # Parses local JSON/CSV files for state injection
│   ├── focus-service.js       # Manages active cell / keyboard focus
│   ├── migration-service.js   # Upgrades old quote shapes to current schema
│   ├── ocr-api-service.js     # CRITICAL: Calls Gemini 2.5 Flash; key fetched via getConfigManager()
│   ├── online-storage-service.js    # Firestore CRUD helpers (load/search by quoteId)
│   ├── quote-generator-service.js   # Orchestrates PDF HTML generation via Strategies
│   ├── quote-persistence-service.js # Save/load/status/payment lifecycle
│   ├── state-service.js       # Redux-style store; dispatches reducer; publishes events
│   ├── workflow-service.js    # CRITICAL: Coordinates workflows: PDF dual-path, load, reset
│   └── generators/
│       ├── gth-quote-strategy.js              # Gmail-ready quote HTML strategy
│       ├── installation-worksheet-strategy.js # Installation worksheet PDF strategy
│       ├── original-quote-strategy.js         # Standard quote/invoice PDF strategy
│       └── work-order-strategy.js             # Factory work order PDF strategy
├── ui/
│   ├── dialog-component.js    # Reusable confirmation/input modal
│   ├── input-handler.js       # Keyboard + numpad event -> EVENTS publisher
│   ├── left-panel-tab-manager.js  # K-tab switching and panel collapse
│   ├── notification-component.js  # Toast notification renderer
│   ├── ocr-view.js            # CRITICAL: OCR modal: image queue, crop, Gemini injection flow
│   ├── panel-component.js     # Slide/collapse panel wrapper
│   ├── right-panel-component.js   # F-panel tab manager (F1-F4)
│   ├── search-dialog-component.js # Cloud quote search dialog
│   ├── summary-component.js   # Bottom sum bar renderer
│   ├── table-component.js     # Main grid renderer; reads quoteData.products[key].items
│   ├── ui-manager.js          # Master renderer; re-renders all components on STATE_CHANGED
│   ├── tabs/                  # K1/K2/K3 tab input handlers + components
│   └── views/
│       ├── detail-config-view.js  # CRITICAL: Multi-tab K-panel host; LF mode multi-select
│       ├── drive-accessories-view.js  # K3: Motor/Chain/Drive accessories UI
│       ├── f1-cost-view.js    # F1: Itemised cost breakdown panel
│       ├── f2-summary-view.js # F2: Summary totals + fee adjustments
│       ├── f3-quote-prep-view.js  # F3: Document generation (Quote/Invoice/Receipt)
│       ├── f4-actions-view.js # F4: Admin actions (Status, Correction, Cancellation)
│       ├── fabric-config-view.js  # K2: Fabric type cycling and batch options
│       ├── k1-location-view.js    # K1: Room/Location text input
│       ├── k2-options-view.js     # K2: OI/LR/Over option selectors
│       ├── quick-quote-view.js    # Main table input handler (ENT commits row)
│       ├── search-tab-s1-view.js  # Search dialog: filters tab
│       └── search-tab-s2-view.js  # Search dialog: results + preview tab
├── utils/
│   ├── csv-parser.js          # CRITICAL: Robust CSV importer; safety valve for zero-length regex
│   ├── format-utils.js        # Currency/number formatters (JS only, no $ in HTML)
│   └── template-utils.js      # HTML template helpers
├── app-context.js             # DI container: instantiates + wires all services and components
├── app-controller.js          # Event subscriber hub; owns UI lock + autosave
├── config-manager.js          # CRITICAL: Singleton; loads price matrix + geminiApiKey from Firestore
├── event-aggregator.js        # Pub/sub bus (publish / subscribe / unsubscribe)
└── main.js                    # Bootstrap: auth gate -> AppContext.initialize() -> load partials
```

---

## SECTION 2: THE IRON RULES

- **[PDF BLOB]** All PDF previews MUST generate a Blob URL (URL.createObjectURL) opened via window.open(url, '_blank'). NEVER use document.write.

- **[SILENT DOWNLOAD]** Silent multi-PDF downloads use the _downloadPdfSilently() hidden-iframe pattern in WorkflowService. Do NOT use display:none on the iframe -- it breaks jsPDF-autotable layout calculations.

- **[DATA-DRIVEN UI]** Table row classes (row-even, row-fifth) MUST be injected by JS. Never hardcode in HTML templates.

- **[NO HARDCODED SYMBOLS]** All currency formatting ($) belongs exclusively in format-utils.js. HTML/PDF templates must never hardcode $ -- causes double-dollar-sign bugs.

- **[ASCII ONLY]** All accessory label strings in PDF output must use English only (e.g., "Set", "HD Winder"). CJK characters cause jsPDF encoding corruption.

- **[LF VALIDATION]** LF (Light Filtering) mode may only activate on items with fabricType in ['B2', 'B3', 'B4']. Intercept ineligible items early in handleSequenceCellClick in quick-quote-view.js.

- **[SECURITY -- NO HARDCODED KEYS]** The Gemini API key MUST NEVER be hardcoded in frontend source. It is stored in Firestore (pricing_data/v2_matrix.geminiApiKey) and accessed exclusively via getConfigManager().getGeminiApiKey() inside ocr-api-service.js.

- **[DATA SCHEMA]** Every item injected from OCR, CSV, or file load MUST contain: productType: 'rollerBlind' and a unique id field. Omitting these crashes ProductFactory and quoteReducer.

- **[STATE NESTING]** Quote items live at quoteData.products[currentProduct].items -- NOT quoteData.items. Dispatching to the root key is silently ignored by the TableComponent.

---

## SECTION 3: RECENT CRITICAL FIXES

- **[Double Dollar Signs]** format-utils.js was prepending $ while HTML templates also had hardcoded $. Fix: removed all $ from HTML templates; formatting is JS-only.

- **[Vanishing PDF Colors]** Two causes: (1) Price matrix index was off-by-one. (2) PDF strategy read from a detached/stale DOM node. Fix: always re-query the live DOM inside the generation callback; never cache pre-generation DOM references.

- **[Silent vs. Tab Dual-Path]** handleGenerateBothWorksheets accepts an isSilent boolean. isSilent=true triggers _downloadPdfSilently() (iframe). isSilent=false opens a Blob URL tab. This is the ONLY approved dual-path pattern.

- **[CSV Parser Infinite Loop]** csv-parser.js used RegExp.exec() in a loop that stalled on zero-length matches. Fix: added a lastIndex progression guard -- if lastIndex does not advance, manually increment it to prevent the infinite loop.

- **[OCR Data Schema Alignment]** Gemini JSON was mapped to wrong field names (mount/control vs. oi/lr/over/fabricType). Fix: strict mapping -- Mounting -> oi (IN/OUT), Control Side -> lr (L/R), Over -> over (O/""), Type -> fabricType (S->SN, B->B1, LF->B2).

- **[ConfigManager Destructuring Bug]** OcrApiService({ configManager }) crashed when called without arguments. Fix: removed constructor injection. ocr-api-service.js now imports getConfigManager() and calls it at runtime inside recognizeImages(). Constructor is now constructor() {}.

- **[OCR State Nesting Bug]** OCR-injected items were dispatched to quoteData.items (non-existent). Fix: updated to target quoteData.products[currentProductKey].items with a full object spread to preserve quote metadata (quoteId, customer, etc.).
