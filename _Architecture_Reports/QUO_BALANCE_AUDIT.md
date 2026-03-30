# Quotation Balance Audit Report

This audit identifies why Quotations (documents without registered payments) are incorrectly displaying the full invoice total in the "Balance" row instead of the expected remaining balance after the initial 50% deposit.

## 1. The Calculation Flaw (`calculation-service.js`)

In the [Phase I.6 refactor](file:///c:/rbq6297/04-core-code/services/calculation-service.js), the calculation for the balance was unified under a "ledger-first" logic:

```javascript
// Line 600 - 601
const actualTotalPaidNumber = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
const dynamicBalanceNumber = grandTotal - actualTotalPaidNumber;
```

### The Issue:
When `hasPayments` is **FALSE** (standard for Quotations):
- `actualTotalPaidNumber` is exactly `0`.
- `dynamicBalanceNumber` becomes `grandTotal - 0 = grandTotal`.
- The system correctly calculates that $0 has been paid toward the ledger, but it fails to account for the **expected** financial split (50% Deposit / 50% Balance) that a Quotation is meant to display.

### Data Binding Audit:
The `uiBalance` field, which previously carried the "expected balance" string from the F2 UI state, was removed from the return object in the latest refactor, leaving the generator with only the ledger-based `uiDynamicBalance`.

## 2. The Template Mapping (`quote-generator-service.js`)

The [Summary Table mapping](file:///c:/rbq6297/04-core-code/services/quote-generator-service.js#L310-L318) for the Balance row is currently implemented as follows:

```javascript
} else if (labelText.includes('Balance')) {
    if (templateData.hasPayments) {
        labelCell.innerText = 'Balance Due';
        valueCell.innerText = `$${templateData.uiDynamicBalance}`;
    } else {
        labelCell.innerText = 'Balance';
        valueCell.innerText = `$${templateData.uiDynamicBalance}`; // <--- Root of the UI Flaw
    }
}
```

### The Issue:
While the code correctly toggles the label between "Balance Due" and "Balance", it **blindly uses `uiDynamicBalance`** for both cases. In Quotation mode (`hasPayments` = false), this variable reflects the full `grandTotal`.

## 3. Proposed Fix Architecture

To restore correct Quotation behavior while preserving the new Invoice/Receipt logic, the following adjustments are required:

### A. Calculation Service Adjustment
Re-inject the expected balance from the UI state into the template data:
- **`uiBalance`**: Sourced from `ui.f2.balance`. This represents the remaining amount after the initial 50% deposit shown in F2.

### B. Generator Logic Split
Refine the row mapping to distinguish between **Ledger Reality** (Invoices/Receipts) and **Baseline Expectations** (Quotations):

| Scenario | Deposit Label | Deposit Value | Balance Label | Balance Value |
| :--- | :--- | :--- | :--- | :--- |
| **`hasPayments` == TRUE** | "Deposit paid" | `uiTotalPaid` | "Balance Due" | `uiDynamicBalance` |
| **`hasPayments` == FALSE** | "Deposit" | `uiInitialDeposit`| "Balance" | `uiBalance` |

### C. Logic flow:
1. IF `hasPayments` is true: Use the cumulative sum of actual payments from the ledger.
2. IF `hasPayments` is false: Use the 50% split values currently calculated and displayed in the F2 UI.

任務完成
