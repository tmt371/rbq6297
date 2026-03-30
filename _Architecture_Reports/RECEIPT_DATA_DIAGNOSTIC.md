# Receipt Data Diagnostic: "Deposit Paid" Bleed Issue

## 1. Concatenation Logic
The logic improperly injecting both the descriptive text and the dollar amount into the single left-hand label cell is located in **`04-core-code/services/quote-generator-service.js`** spanning **lines 359-363**:

```javascript
if (overdueDepositAmount != null) {
    depLabel.innerText = `Deposit Paid ${overdueDepositDateFormatted} | $${Number(overdueDepositAmount).toFixed(2)}`;
} else {
    depLabel.innerText = `Deposit Paid ${overdueDepositDateFormatted}`;
}
```

## 2. Data Source Identification
The variables constructed in this string originate from the following hierarchical fallback chains:

* **`overdueDepositAmount` (The redundant "$20.00")**:
  * Priority 1: `receiptData.amount` (Function argument mapping to immediate UI input)
  * Priority 2: `liveLedger.totalPaid` (The persistent central ledger sum)
  * Note: This is redundant because `templateData.deposit` already injects this exact number into the adjacent `depVal` cell.

* **`overdueDepositDateFormatted` (The "28/3/26")**:
  * Priority 1: `receiptData.date` 
  * Priority 2: `liveLedger.payments[last].date` (Fetched from the latest payment array entry)
  * Priority 3: `f3Data.issueDate` (Default fallback)

## 3. Style Audit: The 18px Font "Bleed"

The oversized 18px font causing the text box boundary bleed originates from a hardcoded inline style inside `ui/partials/quote-template-final.html` (e.g., `<td class="summary-label" style="background-color: #FFFFE0 !important; font-size: 18px; ...">`).

In the mutation cleanup block of **`quote-generator-service.js` (lines 366-370)**, the agent script successfully clears the highlighting but *fails* to strip the font-size enlargement:

```javascript
// Remove Receipt background color override to match standard layout
if (depLabel) depLabel.style.backgroundColor = '';
if (depVal) depVal.style.backgroundColor = '';
if (balLabel) balLabel.style.backgroundColor = '';
if (balVal) balVal.style.backgroundColor = '';
// -> MISSING: depLabel.style.fontSize = '';
```
Because the `fontSize` persists, the abnormally lengthy label string `Deposit Paid 28/3/26 | $20.00` forces the column out of alignment.

任務完成
