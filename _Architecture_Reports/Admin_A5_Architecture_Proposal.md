# Admin A5 Architecture Proposal: User Management

> **Classification**: Architectural Blueprint — Read-Only, Pre-Implementation Planning Document  
> **Date**: 2026-04-06  
> **Author**: AI Architectural Analysis  
> **Status**: Awaiting Admin Approval

---

## Part 1: Audit of Existing Admin Architecture (A1–A4)

### 1.1 File Structure

```
admin/
├── admin.html               # Entry point: tab bar, drawer, <div id="admin-content-area">
├── admin-main.js            # Orchestrator: tab routing, A1/A2/A3 render functions, edit mode
├── admin-style.css          # Admin-specific styles
└── views/
    └── admin-order-view.js  # A4: Self-contained module (exported static object)
```

### 1.2 Rendering Architecture

The Admin Dashboard uses a **single-page, content-area swap pattern**. All panels (A1–A4) inject their HTML into the shared `<div id="admin-content-area">` container, replacing it entirely on each tab switch.

**Tab Routing (admin-main.js, Lines 68–79)**:
```javascript
tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
        if (index === 0) { activeTab = 'a1'; renderA1Hardware(); }
        else if (index === 2) { activeTab = 'a3'; renderA3Fees(); }
        else if (index === 3) { activeTab = 'a4'; AdminOrderView.render(adminContentArea); }
        else { activeTab = 'a2'; renderA2Fabrics(); }
    });
});
```

### 1.3 Module Responsibilities

| Tab | Module | Pattern | Data Source | Write Target |
|-----|--------|---------|-------------|--------------|
| **A1: Accessories** | `renderA1Hardware()` in `admin-main.js` | Inline function | `ConfigManager.getPriceMatrices()` | Firestore `pricing_data/v2_matrix` |
| **A2: Fabrics** | `renderA2Fabrics()` / `renderA2FabricMatrix()` in `admin-main.js` | Inline function | `ConfigManager.getPriceMatrices()` | Read-only viewer only |
| **A3: Advanced** | `renderA3Fees()` in `admin-main.js` | Inline function | `ConfigManager.getFees()` | Firestore `pricing_data/v2_matrix.fees` |
| **A4: Orders** | `AdminOrderView` in `admin/views/admin-order-view.js` | **Exported static object** | Firestore `quotes` collection | Firestore (soft/hard delete, restore) |

### 1.4 Edit Mode System

A1 implements a full edit mode lifecycle:
- **View Mode**: All `.data-input` elements have `readonly` attribute; body has `edit-locked` class.
- **Edit Mode**: Triggered by `#btnEnterEdit`. Removes `readonly`; body gets `edit-active` class.
- **Dirty Detection**: Any `.data-input` change marks its parent `.item-row` with `is-dirty`.
- **Confirm/Abort**: Gather all rows from DOM → `updateDoc(db, 'pricing_data', 'v2_matrix', {...})`.

A3 and A4 are simpler and use their own independent submit/confirm flows within the content area.

### 1.5 Key Dependency: A4 Pattern (The Template for A5)

A4 (`AdminOrderView`) is the most architecturally mature module. It follows the **"self-render, self-bind" static object pattern**: `AdminOrderView.render(container)` builds its own HTML, binds all of its own listeners, and manages its own data fetching. **A5 must follow this same pattern**, stored in `admin/views/admin-user-view.js`.

---

## Part 2: A5 Architecture Proposal — User Management

### 2.1 UI Integration

**Tab Bar Addition** in `admin.html`: Add a 5th tab:
```html
<div class="tab">A5: USERS</div>
```

**Tab Router Update** in `admin-main.js`: Add index `4` to the tab router:
```javascript
else if (index === 4) { activeTab = 'a5'; AdminUserView.render(adminContentArea); }
```

**Module File**: Create `admin/views/admin-user-view.js`, following the `AdminOrderView` static object pattern. Import it in `admin.html`:
```html
<script type="module" src="./views/admin-user-view.js"></script>
```

---

### 2.2 The Core Architectural Problem: Firebase Client SDK User Creation

> [!CAUTION]
> **Critical Constraint**: The Firebase **Client SDK** method `createUserWithEmailAndPassword(auth, email, password)` automatically **signs out the currently authenticated admin** and signs in as the newly created user. This is a fundamental security design decision by Firebase and cannot be overridden at the client level.

#### Option A: Secondary Firebase App Instance (Recommended — No Backend Required)

**Mechanism**: Firebase allows initializing a **second, isolated app instance** using `initializeApp(firebaseConfig, 'SecondaryApp')`. The auth state of the secondary instance is completely independent of the primary.

```javascript
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

// Secondary instance — does NOT affect the admin's primary session
const secondaryApp = initializeApp(firebaseConfig, 'AdminUserCreator');
const secondaryAuth = getAuth(secondaryApp);

// Create user without affecting admin session
const userCredential = await createUserWithEmailAndPassword(
    secondaryAuth, email, password
);

// Immediately sign out of secondary instance (cleanup)
await signOut(secondaryAuth);
```

**Verdict**: ✅ **Best solution for a frontend-only architecture**. Zero backend needed, no Cloud Functions costs, and the admin session is fully preserved. The secondary app instance is created once on module load and reused.

#### Option B: Firebase Admin SDK via Cloud Functions (Overkill for This Use Case)

**Mechanism**: A Firebase Cloud Function using the Admin SDK (`admin.auth().createUser()`) bypasses client SDK limitations entirely since it runs server-side.

**Verdict**: ❌ **Rejected for this use case**. Introduces infrastructure complexity (Cloud Functions billing, deployment pipeline), adds network latency, and is unnecessary when Option A resolves the problem cleanly at the client level.

---

### 2.3 Role Management Architecture

#### Proposed: Firestore `users` Collection as the Source of Truth

Firebase Auth **Custom Claims** (e.g., `role: 'admin'`) are set via the **Admin SDK only** (not the client SDK), making them inaccessible from the frontend without Cloud Functions.

Instead, the proposed architecture uses a **Firestore `users` collection** as an accessible metadata store:

```
Firestore Collection: /users
└── Document ID = Firebase Auth UID
    ├── email: "user@example.com"
    ├── displayName: "John Smith"
    ├── role: "admin" | "sales"
    └── createdAt: Timestamp
```

**Role Enforcement at the Client**:
1. The main app reads the current user's `/users/{uid}` document after login.
2. The `role` field is used to gate UI access (e.g., disabling `f4-btn-admin-entry` for `role !== 'admin'`).
3. **Security Note**: Firestore Security Rules must enforce that users cannot self-modify their own `role` field.

> [!IMPORTANT]
> **This requires a Firestore Security Rule**: `allow write: if request.auth.token.role == 'admin'` or by checking the `/users/{uid}.role` document directly in the rule. The admin user must have their role set manually first via the Firebase Console.

---

### 2.4 A5 Proposed Feature Set

| Feature | Implementation |
|---------|---------------|
| **List Users** | Read `/users` collection from Firestore; display UID, email, name, role |
| **Create User** | Form (email, password, name, role) → `createUserWithEmailAndPassword(secondaryAuth, ...)` → `setDoc('/users/uid', {...})` |
| **Set Password** | Admin-entered new password → `updatePassword(targetUser, newPass)` — only works if `targetUser` is currently signed in, meaning this requires Cloud Functions. Use a "Send Password Reset Email" approach instead via `sendPasswordResetEmail(auth, email)`. |
| **Delete User** | `deleteDoc('/users/uid')` to remove Firestore record. For Auth deletion, requires Cloud Functions or admin action from Firebase Console. Surface this clearly as "Deactivate" (hide in main app) vs "Full Delete". |
| **Change Role** | `updateDoc('/users/uid', { role: 'admin' | 'sales' })` |

---

### 2.5 A5 Proposed UI Skeleton

```
A5: USER MANAGEMENT
┌─────────────────────────────────────────────────────┐
│  ➕ ADD USER  |  🔄 REFRESH  |  🔍 Search email... │
├─────────────────────────────────────────────────────┤
│  UID              EMAIL               ROLE   ACTIONS │
│  qAbc123...       admin@example.com   ADMIN  [Edit] │
│  xDef456...       sales@example.com   SALES  [Edit] │
└─────────────────────────────────────────────────────┘

"Add User" / "Edit User" → Modal Form:
  ┌── Email ──────────────────────────────────┐
  │── Password (for new user only) ───────────│
  │── Display Name ────────────────────────── │
  │── Role: [ ADMIN | SALES ] ────────────────│
  │  [CANCEL]              [SAVE / CREATE]    │
  └───────────────────────────────────────────┘
```

---

## Part 3: Implementation Plan (Pending Approval)

### Files to Create
| File | Purpose |
|------|---------|
| `admin/views/admin-user-view.js` | A5 self-contained module (follow AdminOrderView pattern) |

### Files to Modify
| File | Change |
|------|--------|
| `admin/admin.html` | Add `<div class="tab">A5: USERS</div>` to tab bar; add `<script>` import |
| `admin/admin-main.js` | Add `index === 4` case to tab router; import `AdminUserView` |

### Prerequisites
- **Firestore Security Rules**: Must be updated to prevent non-admin users from writing to `/users/{uid}.role`.
- **Admin Bootstrap**: The first admin user's `role: 'admin'` record in the `/users` collection must be seeded manually once via the Firebase Console.

---

## Part 4: Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Secondary App Instance re-initialization | Low | Initialize once at module level; guard with `getApps()` check |
| Admin cannot delete users from Auth | Medium | Document clearly; surface "Deactivate" (Firestore) vs "Full Purge" (Console-only) |
| Firestore rule misconfiguration exposing role field | **High** | Mandatory security rule review before any deployment |
| Password reset emails going to spam | Low | Use Firebase default email sender; advise admin to check spam |

---

*Report saved to: `C:\rbq6297\_Architecture_Reports\Admin_A5_Architecture_Proposal.md`*
