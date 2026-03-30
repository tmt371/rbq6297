# AI Handoff Memo (Updated: 2026-03-30 — Phase I.9 Complete)

## 1. 核心鐵律 (The Iron Rules)

- **【數據純淨化】**: `CalculationService` outputs raw Numbers only. Currency formatting (`$`, decimal points) is strictly prohibited at the Service layer — it belongs in Strategies or `format-utils.js`.
- **【唯一真相來源】**: Never hardcode price fallbacks (e.g. `|| 100`). All prices must be fetched via `ConfigManager.getFees()` from Firestore.
- **【View-Only Browser API Rule】**: Services MUST NOT call `window.open()`, `DOMParser`, or any browser-specific API. These are exclusively handled at the Controller/View layer.
- **【PDF GENERATOR BAN】**: `quote-generator-service.js` MUST NOT perform math or conditional business logic (like overriding document types based on payments). It only receives explicit intents and pre-formatted strings from `calculation-service.js`.
- **【F2 DEPOSIT LOCK】**: The `#f2-deposit` field utilizes a manual lock (`state.ui.f2.isDepositManuallyEdited`). NEVER implement logic that blindly overwrites the deposit when the grand total changes. Always respect the manual lock flag.
- **【DOM REACTIVITY】**: In Vanilla JS UI views (like F2), after dispatching a calculated financial value to the state (e.g., `finalDeposit`), you MUST explicitly update the corresponding DOM element's `.value` to prevent visual desyncs.

---

## 2. 架構防禦指南 (Architectural Guards)

- **【環境隔離】** *(COMPLETED — Phase D)*: `WorkflowService` is now fully decoupled from the browser environment. All `window.open` calls have been replaced with event publishing. New code must follow this pattern without exception.
- **【模組拆分】** *(COMPLETED — Phase D)*: `fabric-config-view.js` reduced from 724 to ~195 lines. Dialog logic extracted to:
  - `04-core-code/ui/views/dialogs/fabric-nc-dialog.js`
  - `04-core-code/ui/views/dialogs/fabric-lf-dialog.js`
  - `04-core-code/ui/views/dialogs/fabric-sset-dialog.js`
- **【產品去耦合】**: UI views should minimize direct dependencies on `rollerBlind`-specific attributes to leave room for future product types.

---

## 3. ⚠️ 持久化風險警告 (Persistence Risk — Multi-User Warning)

> **CRITICAL FOR FUTURE DEVELOPMENT**: The current cloud save mechanism (`saveQuoteToCloud`) performs a **full document overwrite** via `setDoc`. In a multi-user environment, a second user saving after the first will silently overwrite all prior changes.
>
> Before any multi-user or concurrent editing feature is implemented, this must be replaced with:
> - **Firestore Transactions** (atomic read-modify-write), or
> - **Optimistic Locking** (timestamp comparison before write), or
> - **Field-level `updateDoc`** (only write changed fields, not the full document).

---

## 4. 近期重大修復 (Recent Critical Fixes)

- **$100 幽靈費用修復**: `f2-config.js` 已中和，靜態價格回退已移除。所有費用透過 `ConfigManager.getFees()` 取得。
- **生命週期管理**: `RightPanel` 現在在切換時正確呼叫 `deactivate()`，防止殭屍狀態殘留。
- **收據格式修復**: 標籤列重複金額已移除、字體縮小至 14px、抬頭從 "OFFICIAL RECEIPT" 更名為 "RECEIPT"。

---

## 5. 標準作業程序 (Standard Procedures)

- **Clean-as-you-go**: Remove tombstone comments (`// [REMOVED]`), commented-out dead code, and historical version logs in every file you touch. Keep only the most recent architectural summary.
- **All formatting via `format-utils.js`**: Use `formatCurrency()`, `formatDateYMD()`, `safeNumber()` — never re-implement these inline.
- **All architectural documents** must be saved in `C:\rbq6297\_Architecture_Reports\` — never in the project root.

---

## 6. 待辦事項 (Next Steps for Future Sessions)

- [ ] **Persistence Hardening**: Implement Firestore transactions or `updateDoc` (field-level) to prevent concurrent write conflicts.
- [ ] **Product Extensibility**: Gradually remove hardcoded `rollerBlind` references in `f1-cost-view.js` and `quick-quote-view.js`.
- [ ] **`quote-generator-service.js` isolation**: This service still uses `DOMParser` internally — it should eventually be abstracted to remain browser-environment-agnostic.
