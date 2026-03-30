# System Recovery Audit Report
**Date:** 2026-03-14
**Project:** Ez Blinds Quote Engine

## 1. 核心函數診斷 (CalculationService)

經過比對「原始代碼」與「目前檔案 (v3.35)」，診斷結果如下：

### 核心函數存在狀態
*   **`calculateAndSum`**: **[存在]** 函數邏輯完整，保留了 Funnel Phase 2.5 的 Winder 累加器。
*   **`calculateF1Costs`**: **[存在]** 保留了 F1 Motor Split 邏輯與品牌動態成本查詢。
*   **`calculateF2Summary`**: **[存在]** 包含 Accounting V2 要求的 Tax Exclusive Total 與 Profit 計算。
*   **`getQuoteTemplateData`**: **[已變更]** 目前版本已升級至 v3.35 Truth Alignment，會優先查詢 `liveLedger`。若 Ledger 尚未同步，可能會導致 PDF 數據與 UI 顯示不一致。

### 🚨 關鍵遺失函數
*   **`updateGrandTotal`**: **[消失]** 
    目前 `f3-quote-prep-view.js` 的 `handleInputChange` 試圖呼叫 `this.calculationService.updateGrandTotal(value)`，但在 `calculation-service.js` 中完全找不到該函數定義。這會導致 F3 頁面在輸入時發生 JS 錯誤。

## 2. 商業規則診斷 (Business Rules)

### 馬達價差 (Motor Split)
*   **現狀**: 目前代碼保留了 B-Motor ($250) 與 W-Motor ($200) 的銷售與成本拆分邏輯。
*   **風險**: 在 `calculateF2Summary` 中，馬達售價強烈依賴 `configManager` 的數據，若配置表遺失，將回傳 $0。

### Winder 計算 (Winder Rules)
*   **現狀**: 「黃金三角」規則（Strategy 逐行評估）依然存在於 `calculateAndSum` 與 `calculateF1Costs`。
*   **截斷疑慮**: 目前版本的 `hdFreeQty` 與 `hdPaidQty` 分類正確，但在 `getQuoteTemplateData` 中，配件總和 `eAcceSum` 的計算方式在「報價單」與「工作單」模式下有些微結構差異，需確認是否符合原始預期。

## 3. HTML 與環境診斷 (index.html)

根據 `f3-quote-prep-view.js` 的需求，目前的 `index.html` 存在以下缺口：

### 關鍵 ID 遺失 (Static HTML 面向)
目前的 `index.html` 僅為一個殼 (Shell)，以下關鍵元素在靜態 HTML 中不存在，推測應存在於 `right-panel.html`：
*   **輸入框**: `#f3-quote-id`, `#f3-customer-firstname`, `#f3-customer-lastname` 等 11 個關鍵欄位。
*   **按鈕**: `#btn-add-quote`, `#btn-gth`, `#btn-add-invoice` 等。
*   **風險**: 若 `right-panel.html` 加載失敗，F3 視圖將完全無法初始化（`_cacheF3Elements` 會報錯）。

### Library 遺失
*   **Eruda**: 目前 `index.html` 雖然有 Eruda 的加載腳本 (L122)，但其 `onload` 函數被注釋掉了，且僅限 `localhost` 觸發。若在生產環境或特定 IP 下測試，將失去開發者工具。
*   **Firebase**: 雖然有引用，但未見到具體的 `initializeApp` 配置在 `index.html` 中，需依賴 `main.js` 正確加載。

## 4. 診斷總結與建議

目前專案的「功能遺失」主因並非代碼被刪除，而是**「版本錯置」**：
1.  **Service 不匹配**: UI 視圖引用了 Service 並不存在的 `updateGrandTotal`。
2.  **架構分離**: 核心 UI 欄位已移往 `partials/right-panel.html`，若主頁面加載邏輯受損，會顯得欄位「消失」。
3.  **數據真值轉換**: v3.35 引入的 `liveLedger` 邏輯大幅改變了 PDF 的取值方式，若後端 Firestore 數據未同步，前端計算會顯得失效。

---
✅ **系統診斷完成** - 報告已存儲至 `_Architecture_Reports/system_recovery_audit.md`
