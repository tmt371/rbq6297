# Comparative Toast Mechanism Diagnostic Report

**Date**: 2026-03-12  
**Directive**: v3.24 — Comparative Toast Diagnostic  

---

## 🔍 Agent 1: The Success Path Audit (Cloud Save)
**Target**: `04-core-code/services/quote-persistence-service.js` (Line 125)

1. **Object Structure**:
   ```javascript
   this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
       message: `Quote ${dataToSave.quoteId || 'Draft'} successfully saved and overwritten in Cloud.`, 
       type: 'info'
   });
   ```
2. **Context**: Async. It is explicitly called *after* `await saveQuoteToCloud(dataToSave)`.
3. **Thread**: Residing in the microtask queue. By the time it publishes, the heavy lifting of the save operation is complete, and the UI is ready to transition back to an idle state.

---

## 🔍 Agent 2: The Failure Path Audit (F3 Tollbooth)
**Target**: `04-core-code/ui/views/f3-quote-prep-view.js` (Line 330)

1. **Object Structure**:
   ```javascript
   this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { 
       type: 'warning', 
       message: 'Please click SAVE first to generate a Quote ID before printing documents.' 
   });
   ```
2. **Context**: Synchronous. It is triggered immediately inside the button's DOM `click` event listener.
3. **Side-by-Side Comparison**:
   - **Service Path**: Async -> `info` -> Works.
   - **View Path**: Sync -> `warning` -> Invisible.
   - **Singleton Check**: Both use `this.eventAggregator`, which is the correct shared instance from `AppContext`.

---

## 🔍 Agent 3: Synchronization & UI State Check

### 1. Notification Component Integrity
The `NotificationComponent` treats `type: 'warning'` and `type: 'info'` as **identical** for rendering (both use the base `.toast-message` class). There is no internal logic that filters out `warning` messages.

### 2. The Rendering Race Condition (Primary Suspect)
- **Success Path**: The toast is published just as the `executeWithStateLock` is about to finish. A state update (`isProcessing: false`) follows almost immediately, triggering `UIManager.render`.
- **Failure Path**: The toast is published in a "Stillness" state. No state update follows because the handler returns early (`return false`).

### 3. DOM Hierarchy Audit
The `#toast-container` is at the root level of `index.html`. It is NOT nested within any panel that could be clipped. `z-index` (9999) is higher than all UI panels (100) and inferior only to the Dialog Overlay (10000), which is currently hidden.

---

## ✅ Final Conclusion
The mechanism is structurally sound and functionally consistent across both paths. The fact that `[TOAST INK]` logs appear for both proves the signal chain is intact. 

**Architectural Discrepancy Identified**: 
The only meaningful difference is the **Execution Queue**. The success toast benefits from an `async` loop, while the tollbooth toast fires in a synchronous burst. 

✅ [代理三稽核報告] 儲存成功與攔截警告之機制對比完畢。報告儲存於 _Architecture_Reports/Comparative_Toast_Mechanism_Report.md，請總架構師研判差異。
