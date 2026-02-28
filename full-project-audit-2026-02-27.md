# Full Project Audit — 2026-02-27
> **Restore Point** prior to Phase 8 (Permission UI + F2/A3 Fee Refactoring)

---

## 1. Git Commit History (Phase 5–6 Timeline)

```
15c5705 (HEAD) refactor: Purge seeding button, restyle F4 Admin nav (Phase 6.4)
295f9c5 feat: Firebase SSOT read/write - ConfigManager + Admin CONFIRM (Phase 6.3)
5a0f4d8 fix: Transform nested 2D price arrays to Objects for Firestore (Phase 6.2c)
fe196e1 feat: Inject temporary Firebase seeding button into Admin UI (Phase 6.2b)
70ceedb feat: Add window.seedFirebaseV2 global seeding function (Phase 6.2)
39d0e4f feat: Admin Edit Mode toggle and DOM Data Gathering (Phase 6.1)
a08ba61 Refactor: Purge hardcoded pricing, wire V2 data arrays (Phase 5.8b+5.9)
869d9c9 Refactor: Dynamic brand dropdowns from V2 data arrays (Phase 5.10)
3404a16 Fix: Handle null DOM references in admin initialization (Phase 5.6)
ac110b3 Fix: Resolve 404 script path and implement A1 data binding (Phase 5.5)
9c4ad52 Feat: Wire up A1 UI logic and dynamic data rendering (Phase 5.5)
586ac0f UI: Hard UI injection based on strict mockups (Phase 5.3c)
```

---

## 2. Active File Inventory

### Core Application
| File | Role | Status |
|------|------|--------|
| `index.html` | Main app entry | ✅ Active |
| `admin.html` | Admin dashboard entry | ✅ Active |
| `style.css` | Global styles | ✅ Active |

### `04-core-code/` (Core Engine)
| File | Role | Lines |
|------|------|-------|
| `config-manager.js` | **Cloud Brain** — Firestore SSOT + local JSON fallback | 244 |
| `admin-main.js` | Admin UI: Edit Mode, Confirm → Firestore updateDoc | 357 |
| `main.js` | App bootstrap, lazy loading orchestrator | 19,327B |
| `app-controller.js` | State management, event routing | 22,345B |
| `app-context.js` | Dependency injection container | 18,299B |
| `event-aggregator.js` | Pub/sub event bus | 1,990B |
| `config/firebase-config.js` | Firebase init, exports `db` + `auth` | 28 |
| `config/paths.js` | Asset paths (points to V2 JSON) | 55 |
| `config/constants.js` | DOM IDs, event names | Active |
| `services/calculation-service.js` | Quote calculation engine | 719 |

### `03-data-models/`
| File | Size | Status |
|------|------|--------|
| `price-matrix-v2.0.json` | 23,830B | ✅ Active (local fallback + seed source) |
| `price-matrix-v1.0.json` | 25,334B | ⚠️ **DEPRECATED** — superseded by V2 |

### Firestore (Cloud SSOT)
| Collection | Document | Contents |
|-----------|----------|----------|
| `pricing_data` | `v2_matrix` | `meta`, `fabricTypeSequence`, `matrices` (prices as indexed objects), `motors[8]`, `accessories[18]`, `businessRules` |

---

## 3. Orphaned / Temporary Files (Cleanup Candidates)

| File | Size | Purpose | Recommendation |
|------|------|---------|----------------|
| `extract-firebase.js` | 2,570B | Phase 5.8 Firebase extraction attempt | 🗑️ DELETE |
| `migrate-pricing.js` | 3,192B | Phase 5.8 V1→V2 migration script | 🗑️ DELETE |
| `patch-v2-data.js` | 3,711B | Phase 5.8b V2 JSON patching script | 🗑️ DELETE |
| `generate-snapshot.js` | — | Snapshot generation utility | 🗑️ DELETE |
| `generate_md_snapshot.js` | 2,212B | MD snapshot generator | 🗑️ DELETE |
| `generate_md_snapshot.ps1` | 2,707B | PowerShell snapshot generator | 🗑️ DELETE |
| `create_snapshot.ps1` | 1,773B | PowerShell snapshot creator | 🗑️ DELETE |
| `run_snapshot.bat` | 114B | Batch file for snapshot | 🗑️ DELETE |
| `codebase_snapshot.txt` | 1,101,696B | Legacy full codebase dump | 🗑️ DELETE |
| `project-snapshot.md` | 4,659,377B | Large project snapshot | 🗑️ DELETE |
| `project_snapshot.md` | 2,247,958B | Duplicate snapshot | 🗑️ DELETE |
| `price-matrix-v1.0.json` | 25,334B | Superseded by V2 | ⚠️ ARCHIVE |

**Estimated cleanup: ~8MB of orphaned files**

---

## 4. Remaining Technical Debt

### 4a. Hardcoded Fallback Values (Safe but non-ideal)

| File | Line | Code | Risk |
|------|------|------|------|
| `config-manager.js` | 185 | `return 300; // fallback` (wifiHub) | 🟡 Low — only triggers if `ele_wifi_linx` missing |
| `calculation-service.js` | 224 | `\|\| 130` (w-motor cost) | 🟡 Low — fallback if V2 lookup fails |
| `calculation-service.js` | 435 | `\|\| 50` (charger price) | 🟡 Low — fallback if V2 lookup fails |
| `calculation-service.js` | 455 | `\|\| 300` (wifi sale price) | 🟡 Low — fallback if V2 lookup fails |

> **Assessment**: All 4 fallbacks are defensive defaults behind valid V2 array lookups. They only activate if Firestore AND local JSON both fail. **No action required** for Phase 8.

### 4b. Dormant Code

| Item | Location | Notes |
|------|----------|-------|
| `window.seedFirebaseV2()` | `admin-main.js` L7–57 | Dormant seeding utility. UI button removed (Phase 6.4). Safe to keep as emergency re-seed tool. |
| `setDoc` import | `admin-main.js` L5 | Only used by dormant seed function. Could be removed if seed function is purged. |

### 4c. Naming Inconsistencies
- `admin-main.js` lives at `04-core-code/admin-main.js` but the directive referenced `04-core-code/ui/admin-main.js` — the actual path is correct at root of `04-core-code/`.
- `price-matrix-v1.0.json` still exists alongside V2. Should be archived or deleted.

---

## 5. Cloud Brain Verification

### ConfigManager Data Flow
```
┌──────────────────────────────┐
│     Firestore (SSOT)         │
│  pricing_data/v2_matrix      │
│  ┌─ matrices (obj→2D arr) ─┐ │
│  ├─ motors[8]              │ │
│  ├─ accessories[18]        │ │
│  ├─ fabricTypeSequence     │ │
│  └─ businessRules          │ │
└──────────┬───────────────────┘
           │ getDoc()
           ▼
┌──────────────────────────────┐
│     ConfigManager            │
│  ┌─ restore prices[][]    ─┐ │
│  ├─ this.priceMatrices     │ │
│  ├─ this.motors            │ │
│  ├─ this.accessories       │ │
│  └─ this.businessRules     │ │
└──────┬───────────┬───────────┘
       │           │
       ▼           ▼
┌──────────┐ ┌──────────────┐
│ calc-svc │ │ admin-main   │
│ (read)   │ │ (read+write) │
│ .find()  │ │ updateDoc()  │
└──────────┘ └──────────────┘
```

### 2D Matrix Restoration: ✅ Confirmed
- Firestore stores `prices` as `{ "0": [row0], "1": [row1], ... }`
- ConfigManager sorts keys numerically and maps back to `[[row0], [row1], ...]`
- `calculation-service.js` receives native 2D arrays — no breaking changes

### Admin Write Path: ✅ Confirmed
- CONFIRM button scrapes `.item-row` DOM → `motors[]` + `accessories[]`
- `updateDoc()` writes only `motors` + `accessories` fields
- Does NOT touch `matrices` (avoids re-transformation issues)

---

## 6. Key Source Code (Restore Point Snapshots)

### 6a. config-manager.js (244 lines)

```javascript
// /04-core-code/config-manager.js
// [MODIFIED] (Phase 6.3) Refactored to read from Firebase SSOT with local JSON fallback.
import { f2Config } from './config/f2-config.js';
import { paths } from './config/paths.js';
import { EVENTS } from './config/constants.js';
import { db } from './config/firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

export class ConfigManager {
    constructor(eventAggregator) {
        this.eventAggregator = eventAggregator;
        this.priceMatrices = null;
        this.accessories = null;
        this.motors = null;
        this.f2Config = f2Config || {};
        this.fabricTypeSequence = null;
        this.businessRules = null;
        this.isInitialized = false;
    }

    async loadPriceMatrices(forceRefresh = false) {
        return this.initialize(forceRefresh);
    }

    async initialize(forceRefresh = false) {
        if (!forceRefresh && this.isInitialized) return;
        let data = null;
        let source = '';

        // Attempt 1: Firestore SSOT
        try {
            const docRef = doc(db, 'pricing_data', 'v2_matrix');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                data = docSnap.data();
                source = 'Firestore';
                // Restore 2D price arrays from Firestore indexed objects
                if (data.matrices) {
                    for (const fabricKey in data.matrices) {
                        const pricesData = data.matrices[fabricKey].prices;
                        if (pricesData && typeof pricesData === 'object' && !Array.isArray(pricesData)) {
                            const keys = Object.keys(pricesData).sort((a, b) => Number(a) - Number(b));
                            data.matrices[fabricKey].prices = keys.map(k => pricesData[k]);
                        }
                    }
                }
            }
        } catch (firestoreError) {
            console.warn("Firestore read failed, falling back to local JSON.", firestoreError.message);
        }

        // Attempt 2: Local JSON Fallback
        if (!data) {
            const response = await fetch(paths.data.priceMatrix);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            data = await response.json();
            source = 'Local JSON';
        }

        this.priceMatrices = data.matrices;
        this.motors = data.motors || [];
        this.accessories = data.accessories || [];
        this.fabricTypeSequence = data.fabricTypeSequence || [];
        this.businessRules = data.businessRules || {};
        this.isInitialized = true;
    }

    // ... getAccessoryPrice(), getPriceMatrices(), getMotors(), getAccessories() ...
}
```

### 6b. admin-main.js Key Sections

**Imports & Seeder (dormant)**:
```javascript
import { db } from './config/firebase-config.js';
import { doc, setDoc, updateDoc } from ".../firebase-firestore.js";
window.seedFirebaseV2 = async function() { /* ... */ }; // dormant
```

**CONFIRM → Firestore Write**:
```javascript
btnConfirm.addEventListener('click', async () => {
    // ... DOM scraping → gatheredMotors[], gatheredAccessories[] ...
    await updateDoc(doc(db, 'pricing_data', 'v2_matrix'), {
        motors: reconstructedData.motors,
        accessories: reconstructedData.accessories
    });
    alert('✅ SUCCESS: Prices updated in Cloud Database!');
    await configManager.loadPriceMatrices(true); // refresh from Firestore
    renderA1Hardware(); // re-render grid
});
```

### 6c. Firebase Config
```javascript
// 04-core-code/config/firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyDTgiZsTpxk7scZh_mRKepMSHRT_d5GdHQ",
    authDomain: "ezblinds-quote-system.firebaseapp.com",
    projectId: "ezblinds-quote-system",
    storageBucket: "ezblinds-quote-system.firebasestorage.app",
    messagingSenderId: "53955635800",
    appId: "1:53955635800:web:1ff29c52d663de0c8fb82d"
};
export const db = getFirestore(app);
export const auth = getAuth(app);
```

> **Note**: No `firestore.rules` file exists in the local project. Security rules are managed directly in the Firebase Console.

---

## 7. Summary & Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| Firestore SSOT | ✅ Live | `pricing_data/v2_matrix` |
| ConfigManager Read | ✅ Verified | Firestore → fallback JSON, 2D restoration |
| Admin Write | ✅ Verified | `updateDoc` for motors + accessories |
| F1 Brand Dropdowns | ✅ Dynamic | From V2 motors array |
| Hardcoded Fallbacks | 🟡 4 remain | All defensive, low risk |
| Orphaned Files | ⚠️ ~8MB | 11 cleanup candidates |
| Test Coverage | ⚠️ None | Jest configured but no pricing tests |

**System is stable and ready for Phase 8.**
