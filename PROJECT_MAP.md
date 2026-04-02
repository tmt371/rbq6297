# RB Quoting System - PROJECT SKELETON MAP (v6297)

## SECTION 1: Folder Tree
```text
04-core-code/
├── actions/
│   └── app-actions.js             # Global event definitions and publishers
├── config/
│   ├── business-constants.js      # Business rules, product codes, and logic enums
│   ├── constants.js               # UI identifiers and system event names
│   └── initial-state.js           # Reactive state baseline structure
├── services/
│   ├── app-controller.js          # Central command hub binding events to services
│   ├── calculation-service.js     # Financial brain and PDF brand-mapping provider
│   ├── data-preparation-service.js # Manufacturing data sanitizer and SOOT
│   ├── file-service.js            # Firestore/DB persistence and retrieval
│   ├── quote-generator-service.js  # HTML-to-PDF template orchestrator
│   ├── state-service.js           # Reactive state manager and snapshot handler
│   ├── workflow-service.js        # Multi-mode PDF generation (Silent vs. Tab)
│   └── generators/                # Strategy-based PDF layout engines
│       ├── installation-worksheet-strategy.js
│       ├── work-order-strategy.js
│       └── invoice-strategy.js
├── ui/
│   ├── views/                     # F1-F4 feature panels and business views
│   │   └── dialogs/               # Modular fabric-specific config modals
│   └── partials/                  # Handlebars HTML segments for PDF rendering
└── utils/
    ├── csv-parser.js              # Robust config and matrix importer
    ├── format-utils.js            # Global currency and string formatters
    └── template-utils.js          # Core Handlebars population engine
```

## SECTION 2: Component Directory
- **workflow-service.js**: Manages PDF lifecycle, including silent background downloads for bulk generation and Blob-URL-based browser previews for single views.
- **calculation-service.js**: Computes line-item and total pricing; includes normalizing logic for accessory brand strings (Linx, Alpha, etc.).
- **app-controller.js**: Decouples UI from services by listening for AppActions and routing data.
- **data-preparation-service.js**: The final filter before manufacturing; calculates manufacturing offsets and cleanses duplicate entries.
- **state-service.js**: Ensures state consistency and handles deep-cloning of F1/F2 business snapshots.
- **installation-worksheet-strategy.js**: Provides original-sequence layouts with visual aids like Zebra Striping and 5-row anchors.

## SECTION 3: Global Data Contracts
### Firestore `brandConfig` (within ui.f1)
- `motorBrand`: String (Normalized brand name for motors)
- `remoteBrand`: String (Normalized brand name for remotes)
- `wifiBrand`: String (Normalized brand name for WiFi hubs)

### Firestore `fees` (within quoteData)
- `deliveryFee`: Number (Waived = 0)
- `installFee`: Number (Waived = 0)
- `removalFee`: Number (Waived = 0)

任務完成
