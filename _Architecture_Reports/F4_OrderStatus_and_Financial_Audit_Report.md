# F4 訂單與財務生命週期體檢報告 (F4 Order Status & Financial Lifecycle Audit)

## 1. F4 狀態切換機制 (Status Transition Mechanism)
在 F4 面板中，訂單狀態的切換並非單純的字串更新，而是具備權限檢查 (RBAC) 與狀態機 (FSM) 規則的嚴格流程。

### 觸發與核心邏輯 (`f4-actions-view.js`)
- **觸發事件**: 用戶在 `#f4-status-dropdown` 選擇新狀態，並點擊 `#f4-status-update-btn`。
- **RBAC 與 FSM 校驗**: 下拉選單在渲染時 (`render()`) 會根據當前用戶角色 (`admin` 或 `sales`) 及 `ROLE_STATUS_PERMISSIONS` 決定可選項目，並同時根據 `STATE_TRANSITIONS` 檢查狀態機的合法路徑。若不符合，選項會被設為 `disabled`。
- **特殊節點攔截 (Tollbooths)**:
  1. **進入 `D_DEPOSIT_PAID` (已付訂金)**: 系統會預先檢查 `quoteData.metadata.payments` 是否有付款紀錄。若無，則攔截狀態推進，自動彈出 `#f4-payment-modal` 徵求付款資訊。完成付款後自動繼續推進狀態。
  2. **進入 `L_CLOSED` (結案)**: 系統嚴格核對 `totalPaid` (所有 payments 金額總和) 是否大於等於 `quoteTotal` (來自 `f2.grandTotal` 或 `f2Snapshot.grandTotal`)。若未結清，強行阻斷結案動作。

### 狀態持久化 (`quote-persistence-service.js`)
- UI 派發 `EVENTS.USER_REQUESTED_UPDATE_STATUS` 後，由 `QuotePersistenceService.handleUpdateStatus` 處理。
- 更新本地狀態的 `status` 屬性。
- 將整包 `quoteData` (包含所有 Snapshots) 透過 `saveQuoteToCloud` 覆寫回 Firestore 的 `quotes` collection 中。

---

## 2. 財務資訊紀錄實況 (Financial Data Persistence)
當前系統的財務紀錄採用了「**雙寫入 (Dual-Write)**」以及「**快照 (Snapshot)**」混合的架構。

### 付款紀錄 (Transactional History)
當用戶透過 F4 面板新增付款時 (`handleRegisterPayment`)，系統並非只記錄單一的 `deposit` 數字，而是創建一筆獨立的交易紀錄：
```json
{
  "id": "pay_1678234567890",
  "amount": 500,
  "date": "2026-03-12",
  "method": "Credit Card",
  "createdBy": "sales@rb.com",
  "timestamp": "2026-03-12T01:00:00.000Z"
}
```
**雙寫入目標**:
1. **`accounting_ledgers` (Firestore Collection)**: 基於 `quoteId` 作為主鍵，使用 `arrayUnion` 將該筆交易推入 `payments` 陣列中。
2. **`quotes` (Firestore Collection)**: 同步將該交易紀錄推入 `metadata.payments` 中，利用 NoSQL 特性讓業務端在讀取訂單時能立刻獲得收款歷史，而無需 Join。

### 報價總金額 (Static Snapshot)
- 系統**並沒有**將報價總額 (`grandTotal`) 或折扣等明細寫入 `accounting_ledgers` 中。
- 這些數字僅在存檔時，以靜態快照的形式 (`f2Snapshot`) 覆蓋儲存於 `quotes` collection 的文檔內。

---

## 3. 系統斷層與隱患 (Architectural Gaps & Accounting Risks)
從「單一事實來源 (Single Source of Truth)」與會計系統對接的角度來看，當前架構存在以下隱患：

### A. 帳本資訊不對稱 (Incomplete Ledger Truth)
`accounting_ledgers` 集合目前**只存有 `payments` (貸方/收入)，卻沒有儲存 `grandTotal` (借方/應收帳款)**。
- **影響**: 若未來開發獨立的會計後台，會計人員無法單純透過掃描 `accounting_ledgers` 來得知「這張帳單總共應該收多少錢」，必須再去 Query `quotes` collection 解析龐大的 JSON 結構。這違背了分離帳本的初衷。

### B. 餘額與訂金的隱式計算 (Implicit Balance Generation)
- **現狀**: 系統資料庫中不存在 `balance` (尾款) 或 `deposit_amount` (訂金總額) 欄位。這些數字全都是前端在渲染 PDF 或 UI 時，由 `grandTotal - sum(payments)` 動態計算出來的。
- **影響**: 在高併發或數據庫層級的報表計算時，無法直接下 SQL / NoSQL 查詢「所有尾款大於 0 的訂單」，需要拉回本地計算。

### C. 訂單更正 (Cancel / Correct) 的帳單繼承風險
- **現狀**: 當執行 Correction 時 (`handleCorrectionSave`)，系統會將舊訂單的 `payments` 陣列複製一份，直接寫入**新的** `accounting_ledgers/{newQuoteId}` 中。
- **影響**: 會計實務上，同一筆金流 (Credit Card Authorization) 不應該在資料庫中被複製成兩筆不同 ID 的 ledger 紀錄，這會導致總公司層級的帳務對帳 (Reconciliation) 時出現重複入帳的錯覺。應採用指向同一個 Master Ledger ID，或利用 Reference 的方式處理版本更迭。

---
✅ 全域體檢完成
