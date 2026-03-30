# F3 DOM Binding Deep Clean Audit

**Date**: 2026-03-12  
**Directive**: v3.18 — DOM Integrity Check & Listener Re-wiring  
**Files Modified**: `04-core-code/ui/views/f3-quote-prep-view.js`

---

## 1. DOM Integrity Probe
To diagnose the silent failure of the QUO button's tollbooth guard, a deep DOM probe was injected into the exact lifecycle moment the F3 tab activates (`activate()`).

**Injected Probe**:
```javascript
console.log("🛠️ [F3-PROBE] Checking Button ID 'btn-add-quote':", document.getElementById('btn-add-quote'));
```
If the output reads `null`, it proves the UI is binding listeners to elements that do not yet exist in the DOM (e.g., HTML hasn't finished rendering or a ghost clone of the DOM is active).

## 2. Aggressive Re-Binding (Deep Clean)
Because standard `.addEventListener` calls were reportedly failing or being overwritten by legacy ghost listeners, the F3 activation lifecycle was modified to aggressively seize control of the button.

### Execution:
A 100ms async delay (`setTimeout`) was introduced upon F3 activation to allow all HTML and components to fully settle. Once the delay concludes, the script forcefully overrides the button's native `.onclick` property, purging any previous listeners and guaranteeing the Tollbooth logic executes first.

**Code Injected into `activate()`**:
```javascript
setTimeout(() => {
    const btn = document.getElementById('btn-add-quote');
    if (btn) {
        console.log("✅ [F3-PROBE] Button found, attaching Double-Lock listener.");
        btn.onclick = (e) => { // Direct assignment to override ghost listeners
            console.log("🎯 [F3] Quote button clicked (Direct Bind).");
            if (!this._enforceSaveTollbooth()) return;
            this._smartFinancialRoute('quote');
        };
    } else {
        console.error("❌ [F3-PROBE] Critical Error: btn-add-quote NOT FOUND in DOM.");
    }
}, 100);
```

### Result Expected 
When the user clicks the Quote button, the console will now decisively track the event lifecycle:
1. "🎯 [F3] Quote button clicked (Direct Bind)."
2. "🚫 [F3] Quote blocked by tollbooth." (If unsaved).
3. A visual warning toast "Please click SAVE first...".
