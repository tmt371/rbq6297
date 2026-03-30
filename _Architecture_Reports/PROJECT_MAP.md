# 04-core-code / Project Skeleton Map

## Section 1: Folder Tree
```text
04-core-code/
├── actions/
├── config/
├── reducers/
├── services/
│   └── generators/
├── ui/
│   ├── css/
│   ├── dialogs/
│   ├── partials/
│   ├── tabs/
│   └── views/
│       └── dialogs/          ← [NEW] Phase D: Extracted dialog components
└── utils/
```

## Section 2: Component Directory

### /actions
* `quote-actions.js`: Defines Redux-style action creators for mutating quote data (items, customer info).
* `ui-actions.js`: Defines action creators for managing UI state (active tabs, modal visibility).

### /config
* `action-types.js`: Enumerates all possible Redux-style action type strings.
* `business-constants.js`: Hardcoded business rules, tax rates, and predefined operational settings.
* `constants.js`: Central registry for DOM IDs, Event Aggregator channel names, and global enums. **`EVENTS.OPEN_DOCUMENT_WINDOW` is the standardized event for opening external browser tabs — services publish this event rather than calling `window.open` directly.**
* `f2-config.js`: (Neutralized) Legacy static pricing module replaced by Firestore data.
* `firebase-config.js`: Firebase initialization logic and connection parameters.
* `initial-state.js`: Defines the default, blank-slate state tree for the application.
* `paths.js`: Centralized URL and path resolution for HTML partials and assets.
* `regex.js`: Shared regular expressions for validation.
* `status-config.js`: Defines order statuses, payment statuses, and their allowed transitions.

### /reducers
* `quote-reducer.js`: Handles exact state mutations for the `quoteData` branch.
* `ui-reducer.js`: Handles exact state mutations for the `ui` branch.
* `root-reducer.js`: Combines all sub-reducers into a single state processing pipeline.

### /services
* `auth-service.js`: Manages user authentication and Google login state.
* `calculation-service.js`: The absolute single source of truth for ALL financial arithmetic. Responsible for calculating grand totals, dynamic balances, and auto-deposits. Outputs strict numerical results and formatted strings for the UI and PDF layers.
* `data-preparation-service.js`: Formats and sanitizes data structures for external export.
* `excel-export-service.js`: Generates `.xlsx` Work Sheets and Data Sheets.
* `file-service.js`: Handles local saving and loading of `.rbq` JSON files.
* `focus-service.js`: Manages keyboard interactions, focus trapping, and Enter/Tab navigation.
* `migration-service.js`: Upgrades older `.rbq` file versions to the current schema.
* `online-storage-service.js`: Interfaces with Firestore (`quotes` collection) for cloud persistence.
* `quote-generator-service.js`: Strictly a "dumb renderer" for PDF generation. Coordinates HTML template assembly and maps pre-calculated variables to the document layout. Performs zero mathematical operations.
* `quote-persistence-service.js`: Manages the macro-workflow of saving, versioning, and syncing to Firestore.
* `state-service.js`: The central Redux-like store managing `quoteData` and `ui` state through dispatch.
* `workflow-service.js`: Orchestrates complex user workflows across multiple UI components. **Does NOT call any browser APIs directly — all `window.open` calls are delegated via `EVENTS.OPEN_DOCUMENT_WINDOW`.**

#### /services/generators
* `original-quote-strategy.js`: Populates the "Original Quote" (AQ) HTML template with strategy-specific formatting.
* `work-order-strategy.js`: Populates the "Work Order" HTML template with internal manufacturing details.
* `gth-quote-strategy.js`: Populates the specialized "GTH (Gmail)" HTML template.

### /ui/views
* `detail-config-view.js`: Manages the layout and sub-tabs for detailed item configuration (K1-K5).
* `drive-accessories-view.js`: Handles logic for the "Drive / Acce." K5 popover context.
* `f1-cost-view.js`: Renders the F1 (Cost) tab, displaying breakdown of component costs and global discounts.
* `f2-summary-view.js`: Renders the F2 (Summary) tab. Manages the 'isDepositManuallyEdited' manual lock state for deposits and enforces strict DOM reactivity (immediate re-renders) after calculation updates.
* `f3-quote-prep-view.js`: Renders the F3 (Quote Prep) tab, collecting printing preferences and document type selections.
* `f4-actions-view.js`: Renders the F4 (Actions) tab, presenting a unified dashboard for saving, searching, and admin functions.
* `fabric-config-view.js`: Manages the K2 Fabric selection screen, orchestrating the three dialog sub-components (NC, LF, SSet). **Reduced from 724 to ~195 lines in Phase D.**

#### /ui/views/dialogs ← [NEW] Phase D
* `fabric-nc-dialog.js`: Encapsulates the "Batch Edit Fabric (N&C)" dialog — form layout, type-grouping, and keyboard navigation.
* `fabric-lf-dialog.js`: Encapsulates the "Batch Edit Light-Filter" dialog — eligibility filtering, LF prefix injection, and keyboard navigation.
* `fabric-sset-dialog.js`: Encapsulates the "Selective Set" dialog — multi-type overriding for a set of selected row indexes.
* `k1-location-view.js`: Focuses solely on location/room inputs for roller blind items.
* `k2-options-view.js`: Handles basic roller blind dimensions (width/height), winder, and motor selections.
* `quick-quote-view.js`: Manages the main item data grid layout.
* `search-tab-s1-view.js`: The primary search interface for querying quotes by customer name/phone.
* `search-tab-s2-view.js`: The results dashboard for analyzing and reloading identified quotes.

### /utils
* `csv-parser.js`: Parses legacy or external CSV data into internal quote structures.
* `format-utils.js`: Centralized formatting functions for currency (`$X.00`), standardized dates (`YYYY-MM-DD`), and safe number parsing.
* `template-utils.js`: Replaces `{{keys}}` in HTML templates with dynamic JS payload values.

## Section 3: Global Data Contracts

### 1. `fees` (Firestore Document / Local Config)
Provides global base pricing constants that update dynamically.
* `deliveryUnitPrice`, `installUnitPrice`, `removalUnitPrice` (Numbers)

### 2. `accounting_ledgers` (Firestore Collection)
The single source of truth for an order's financial lifecycle.
* **Core Totals**: `totalAmount` (Number), `deposit` / `totalPaid` (Number), `balanceDue` (Number).
* **Payment History**: `payments` (Array of objects containing `amount`, `date`, `method`, and `receiptNote`).
* **Metadata**: `quoteId` (String), `status` (String - linking back to order timeline).
