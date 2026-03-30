# F4 Payment Diagnostic Probe

**Date**: 2026-03-12  
**Directive**: v3.10 — Firestore Write Error Diagnostic  
**File Modified**: `04-core-code/services/quote-persistence-service.js`

---

## 1. Trace Overview

The execution paths trace as follows:
1. User clicks "Register Payment" in the F4 panel (`f4-actions-view.js` line 230).
2. The UI pushes the payload to the app-level `quotePersistenceService.handleRegisterPayment`.
3. The method attempts to write `arrayUnion(paymentRecord)` to the `accounting_ledgers` collection, and also update `metadata.payments` on the `quotes` collection.
4. Any errors from Firestore bubble up to the `catch (error)` block at line 287.

---

## 2. Telemetry Injections

No business logic, database writes, or references were altered. The diagnostic changes were strictly constrained to the `catch (error)` block in `quote-persistence-service.js`. 

### A. Deep Console Logging
A highly visible error log was added to capture the exact Firestore error code, message, and full stack object:
```javascript
console.error("🚨 [FIRESTORE WRITE FAILURE] Exact Error:", error.code, error.message, error);
```

### B. UI Surface Telemetry (Red Toast)
The `EVENTS.SHOW_NOTIFICATION` payload was enhanced to explicitly print `error.code` directly onto the Red Toast, allowing non-developers to capture the core failure reason via screenshot.

```javascript
// Example modification:
this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { 
    type: 'error', 
    message: `Failed to save: ${error.code || 'unknown-error'}` 
});
```

---

## 3. Next Actions for the Architect
The system is now primed to reveal the exact failure reason that was causing the invisible Red Toast.

1. Reload the application.
2. Navigate to an existing `B_QUOTED` order.
3. Change status to `C_CONFIRMED` and click **Register Payment**.
4. Observe the **exact error code** displayed in the bottom-right Red Toast (e.g., `permission-denied`, `invalid-argument`).
5. Open the Chrome DevTools Console (F12) to inspect the full trace output by the new 🚨 probe.
6. Provide that exact code to the AI to engineer the structural fix.
