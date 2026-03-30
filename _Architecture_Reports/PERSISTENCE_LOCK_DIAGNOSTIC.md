# Save-Lock Sequence Audit: Cloud Failure Diagnostic

## 1. 虛假成功提示：通知與內存 Promise 的脫節 (The Toast vs. The Promise)
- **診斷結果**: 存在嚴重的「異步結果忽略」問題。
- **代碼路徑**: `QuotePersistenceService.handleSaveToFile` 呼叫了 `await saveQuoteToCloud(dataToSave)`。
- **吞掉錯誤**: `online-storage-service.js` 中的 `saveQuoteToCloud` 函數內部定義了 `try-catch`。當發生錯誤（如網絡中斷或 Quote ID 為空）時，它會返回一個包含 `{ success: false }` 的對象，而 **不會抛出異常 (throw error)**。
- **邏輯缺失**: `QuotePersistenceService` 在調用處 **沒有檢查返回值的 `success` 標記**：
  ```javascript
  // 04-core-code/services/quote-persistence-service.js
  123: if (!skipCloudSave) await saveQuoteToCloud(dataToSave); // 返回值被忽略
  124: this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
  125:     message: `Quote ${dataToSave.quoteId || 'Draft'} successfully saved...` // 無條件顯示成功
  126: });
  ```
- **結論**: 即便 Firestore 寫入失敗或因 Quote ID 為空而被攔截，UI 依然會無條件彈出「成功」提示。

## 2. 鎖定觸發分析：為何系統認為已「建立」 (Lock Trigger Analysis)
- **觸發機制**: 鎖定信息由 `QuotePersistenceService` (L113) 觸發。它基於 `currentStatus` 進行判斷。
- **判定標準**: 如果狀態不是 `A_ARCHIVED`（Draft）且不是 `"Configuring"`，則判定為 **LOCKED**。
- **斷裂原因**: 
    1. 用戶可能在 F4 界面手動更改了狀態下拉選單（例如改為 "Ordered" 或 "Sent"）。
    2. 當用戶更改狀態時，系統可能觸發了本地狀態更新，但由于上述的「寫入失敗忽略」，數據並未真正到達雲端。
    3. 當用戶嘗試第二次保存時，`QuotePersistenceService` 檢測到本地狀態已不再是「草稿」，因此觸發了防止覆蓋已建立訂單的保護機制。
- **結論**: 系統的鎖定機制僅依賴於 **本地 UI 狀態** 中的 `status` 字段，而非雲端數據的真實存在性。

## 3. 數據脫節：為何 Firestore 沒有記錄 (Data Disconnect)
- **Quote ID 缺失**: 對於全新報價單，本地 state 中的 `quoteId` 最初為 `null`。
- **驗證攔截**: `saveQuoteToCloud` (L23) 有一個硬性檢查：`if (!quoteData || !quoteData.quoteId) { return { success: false } }`。
- **失敗鏈條**: 
    - 點擊 Save -> `quoteId` 為空 -> `saveQuoteToCloud` 返回 `success: false` -> Persistence Service 忽略並提示「成功」。
    - 結果就是用戶認為存檔了，但資料庫根本沒收到請求，且本地 ID 仍為空（或未正確回填）。

## 診斷結論
目前的持久化層缺乏 **嚴格的寫入確認機制**。服務層過於信任 `online-storage-service.js` 的 Promise 解析，而忽略了業務層級的 `success` 標記檢查。這導致了「UI 顯示成功，但數據在傳輸層被丟棄」的嚴重同步問題。

任務完成
