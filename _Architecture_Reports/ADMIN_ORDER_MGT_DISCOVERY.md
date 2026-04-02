# Discovery Report: Phase II.0 - Admin Order Management (God Mode)

This report documents the architectural discovery of the Admin Portal to prepare for the implementation of the new **Order Management** tab.

## 1. ADMIN ENTRY POINT & WORKFLOW
- **Entry Access**: Users access the Admin panel via the **"Admin" button** located in the **F4 tab** of the main application.
- **Navigation Type**: It is not a modal. It opens **`admin.html` in a new browser tab** ([f4-actions-view.js:224](file:///c:/rbq6297/04-core-code/ui/views/f4-actions-view.js#L224)).
- **Environment Initialization**:
    - **Host**: `admin.html` (Project root).
    - **Logic Engine**: `admin-main.js` (The primary controller for the Admin portal).
    - **Config Layer**: `config-manager.js` (Fetches pricing matrices and fees).
- **Authentication**: Gatekeeping is handled by `auth-service.js` which checks for the `'admin'` role before enabling the entry button in F4.

## 2. ADMIN UI LAYOUT & TAB STRUCTURE
- **Rendering Pattern**: The UI is **monolithic**. There are no separate component files for each tab; instead, `admin-main.js` contains a `render` function for each tab that generates an HTML string and injects it into the DOM.
- **Tab Headers**: Defined in `admin.html` under the `.tabs-fixed` class ([Lines 597-601](file:///c:/rbq6297/admin.html#L597-L601)).
- **Content Injection Point**: A single div with ID **`#admin-content-area`** ([Line 603](file:///c:/rbq6297/admin.html#L603)).
- **Injection Strategy for Tab 4**: 
    - **HTML**: Place `<div class="tab">A4: ORDERS</div>` immediately after the A3 tab at [admin.html:600](file:///c:/rbq6297/admin.html#L600).
    - **JS Switch**: Inject a new condition for `index === 3` in the `tabs.forEach` listener in `admin-main.js` ([Line 75](file:///c:/rbq6297/04-core-code/admin-main.js#L75)).
    - **New Logic**: Implement a `renderA4Orders()` function in `admin-main.js` to build the new management UI.

## 3. QUOTE FETCHING LOGIC
- **Primary Service**: `online-storage-service.js`.
- **Current Core Method**: `searchQuotesAdvanced(uid, filters)` ([Line 99](file:///c:/rbq6297/04-core-code/services/online-storage-service.js#L99)).
- **Architectural Gap**: The current search is strictly isolated by `where("ownerUid", "==", uid)`. 
- **Requirement for God Mode**: A new administrative fetch method (e.g., `loadGlobalAuditList()`) must be added to `online-storage-service.js` that:
    1.  Bypasses the `ownerUid` restriction.
    2.  Supports filtering by the `status` metadata field (to distinguish between "Active Orders" and "Recycle Bin/Cancelled" orders).
    3.  Leverages `getDocs(collection(db, 'quotes'))` to pull the comprehensive system ledger.

## 4. DESIGN AESTHETICS (A1 Pattern)
The new Order Management tab should follow the **"Grid / Data Section"** layout established in `renderA1Hardware()`. This uses a `.data-section` wrapper with a `.desktop-header` for column titles and `.item-row` for individual order records.

任務完成
