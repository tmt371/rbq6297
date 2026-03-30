# QUO Button Tollbooth Diagnostic Report

**Date**: 2026-03-12  
**Directive**: v3.16 — Two-Phase Diagnostic & Conditional Repair  

## Phase 1: Diagnostic Audit Results
**Status**: HALTED (Condition B / C Confirmed)

### Findings
During the audit of `04-core-code/ui/views/f3-quote-prep-view.js`, it was discovered that the `btn-add-quote` event listener **does not explicitly bypass the tollbooth**. Instead, it delegates execution directly to the central route `this._smartFinancialRoute('quote')`. 

Crucially, the central route *does* contain the tollbooth guard at the very top (`if (!this._enforceSaveTollbooth()) return;`). Therefore, the code *appears* structurally sound and attempts to call the guard, meaning **Condition B** ("Logic Correct but Fails") is triggered. 

Because Condition B is active, **all code modifications have been halted** to prevent structural damage or redundant event blocking. 

### Source Snippets (Current Architecture)

**1. The Listener (`f3-quote-prep-view.js` Lines 247-251):**
```javascript
// --- Add Quote Button Listener (smart routing) ---
if (this.f3.buttons.addQuote) {
    this._addListener(this.f3.buttons.addQuote, 'click', () => {
        this._smartFinancialRoute('quote');
    });
}
```

**2. The Central Route with Guard (`f3-quote-prep-view.js` Lines 339-348):**
```javascript
async _smartFinancialRoute(intent) {
    // Tollbooth guard is present here natively
    if (!this._enforceSaveTollbooth()) return;
    const { quoteData, ui } = this.stateService.getState();
    const quoteId = quoteData.quoteId;

    // Draft / new orders always generate a plain Quotation
    if (intent === 'quote' || !quoteId) {
        this.eventAggregator.publish(EVENTS.USER_REQUESTED_PRINTABLE_QUOTE);
        return;
    }
    // ...
}
```

**Architectural Inference**:
The failure reported during UAT may have been a ghost symptom caused by the `this` binding error resolved in Hotfix v3.15, which temporarily disconnected the tollbooth from `_smartFinancialRoute`. Now that v3.15 is deployed, the QUO button is inherently protected by the internal guard within `_smartFinancialRoute`. If the Architect wishes to double-bind the guard to the click listener explicitly (Condition A approach) for symmetry with the GTH/Receipt buttons, a new directive is required to override the logic lock.
