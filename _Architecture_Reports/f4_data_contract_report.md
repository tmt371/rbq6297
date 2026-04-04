# F4 Quoting System - Data Contract Report (OCR Blueprint)

This document defines the strict data contract required for importing external measurement data into the F4 Quoting System. The OCR tool's output must adhere to these specifications for the system to correctly parse and utilize the data.

---

## 1. DATA STRUCTURE (4-Part CSV Format)
The F4 system uses a multi-part CSV format with specific line positioning.

| Line # | Content | Description |
| :--- | :--- | :--- |
| **Row 1** | **Project Summary Headers** | Keys for F1 (Accessories), F2 (Financials), and F3 (Customer) snapshots. |
| **Row 2** | **Project Summary Values** | Corresponding values for the headers in Row 1. |
| **Row 3** | *(Blank)* | A single empty row for structure. |
| **Row 4** | **Item Detail Headers** | Column headers for the measurement table. |
| **Row 5+** | **Item Data Rows** | Individual measurement rows (one per line). |

---

## 2. EXACT FIELD NAMES (Key Mapping)

### Item Detail Level (Measurement Table)
These are the headers expected starting at **Row 4**.

| Header | F4 Property | OCR Target Mapping |
| :--- | :--- | :--- |
| `#` | `sequence` | Row index (e.g., `1`, `2`, `3`). |
| `Width` | `item.width` | **Width in mm.** |
| `Height` | `item.height` | **Height in mm.** |
| `Type` | `item.fabricType` | Fabric Code (e.g., `B1`, `SN`). |
| `Price` | `item.linePrice` | Calculated line price (e.g., `120.00`). |
| `Location` | `item.location` | Text label (e.g., `Bedroom 1`). |
| `F-Name` | `item.fabric` | Fabric Name (e.g., `Balmoral`). |
| `F-Color` | `item.color` | Fabric Color (e.g., `Chalk`). |
| `Over` | `item.over` | Roll Direction (`O` / empty). |
| `O/I` | `item.oi` | Mount Type (`IN` / `OUT`). |
| `L/R` | `item.lr` | Control Side (`L` / `R`). |
| `Dual` | `item.dual` | Double Blind Marker (`D` / empty). |
| `Chain` | `item.chain` | Chain length in mm. |
| `Winder` | `item.winder` | Winder code (`HD` / empty). |
| `Motor` | `item.motor` | Motor code (`Motor` / empty). |
| `IsLF` | *(Internal)* | Light Filtering Flag (`1` / `0`). |

---

## 3. DATA TYPES & ENUMS (Value Formatting)

### Numerical Fields
*   **Width & Height**: Expected as **raw integers** representing millimeters (e.g., `2390`). Do NOT include "mm" or quotes (unless escaping).
*   **Price**: Formatted to **2 decimal places** (e.g., `350.50`).
*   **Chain**: Expected as an **integer** (e.g., `1500`).

### Enum Constants (Case Sensitive)
| Field | Value | Meaning |
| :--- | :--- | :--- |
| **Control Side (L/R)** | `"L"` | Left |
| | `"R"` | Right |
| **Mount Type (O/I)** | `"IN"` | In Recess |
| | `"OUT"` | Face Fix |
| **Roll Direction (Over)** | `"O"` | Roll Over |
| | `""` | Roll Under (Default) |
| **Blind Marker (Dual)** | `"D"` | Dual / Double Blind |
| **Winder Type** | `"HD"` | Heavy Duty Winder |
| **Drive Type** | `"Motor"`| Motorized Drive |

### Blind Categories (Type & Formatting)
| Category | `Type` Code | Special Formatting Rule |
| :--- | :--- | :--- |
| **Blockout** | `B1`, `B2`, `B3`, `B4`, `B5` | Standard |
| **Sunscreen** | `SN` | Standard |
| **Light Filtering** | `B2`, `B3`, or `B4` | Set `IsLF` to `1` AND prefix `F-Name` with `"Light-filter "`. |
| **Dual Blind** | Standard | Set `Dual` to `"D"`. |

---

## 4. BLANK HANDLING (Missing Data)
*   **Width/Height**: If missing, export as an **empty string** `""`. The importer will convert this to `null`.
*   **Optional Fields**: Any optional string field (e.g., Location, Motor) should be an **empty string** `""` if not applicable.
*   **IsLF**: Must default to `0` if the item is not a Light-filtering variant.

---

## 5. PROJECT SUMMARY DATA (Required Snapshot Keys)
Row 1 must contain exactly these 50 headers. Use empty strings in Row 2 for unknown values.
*   **Customer Keys**: `customer.name`, `customer.address`, `customer.phone`, `customer.email`, `customer.postcode`.
*   **Date Keys**: `issueDate`, `dueDate`, `quoteId`.
*   **Accessories**: `winder_qty`, `motor_qty`, `charger_qty`, `cord_qty`, `wifi_qty`.
*   **Financials**: `sumPrice`, `grandTotal`, `deposit`, `balance`, `gst`.

> [!IMPORTANT]
> The F4 CSV parser strictly relies on column ordering. While Row 1/2 are flexible due to header-lookup, the **Item Detail rows (Row 5+)** MUST follow the exact sequence defined in Section 2.

任務結束
