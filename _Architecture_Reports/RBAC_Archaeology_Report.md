# 🚨 Technical Report: RBAC (Role-Based Access Control) Archaeology [v3.42] 🚨

**Auditor**: Agent 3 (Validator)
**Mission**: Forensic mapping of User vs Admin role identification and enforcement.
**Status**: archaeology_complete ✅

---

## 1. Authentication Core (`auth-service.js`)
- **Identification**: The `AuthService` is a standard Firebase 9 wrapper. It **does not** contain any hardcoded email lists or local role assignment logic.
- **Session Data**: The `currentUser` object is directly from `firebase/auth`. No custom profile fetching or role-augmentation is performed at the service level.

---

## 2. Source of Truth (The "Missing" Link)
- **Role Source**: Roles are identified via **Firebase Custom Claims**.
- **Evidence**: `f4-actions-view.js` (line 24-25) explicitly calls:
  ```javascript
  const tokenResult = await user.getIdTokenResult();
  this.currentUserRole = tokenResult.claims.role;
  ```
- **Conclusion**: Roles are **not** stored in Firestore documents or local config. They are baked into the JWT (JSON Web Token) by an external process (Firebase Admin SDK or Cloud Functions).

---

## 3. UI Enforcement Points (`f4-actions-view.js`)
The F4 view is the primary enforcer of RBAC:

### Admin vs User Privileges:
- **Admin Specific Buttons**: `btnAdminEntry` (Admin UI) is disabled if `role !== 'admin'`.
- **Status Gating**: `readOnlyStatusStates` (`J_INVOICED`, `K_OVERDUE`, `L_CLOSED`, `X_CANCELLED`) lock the UI for Sales users, but can be bypassed if `hasGodMode` (Admin role) is true.
- **FSM Permissions**: The `statusDropdown` is populated using `ROLE_STATUS_PERMISSIONS` from `status-config.js`. 
    - `sales`: Restricted to a subset of statuses.
    - `admin`: Can select from the full status list.

### `app-controller.js` Participation:
- **Null**: The `AppController` acts as a traffic cop for events but does **not** perform role-based filtering. It assumes the views (like F4) have already sanitized the available actions.

---

## 4. Current Status Summary
| Feature | Implementation Status | Data Source |
| :--- | :--- | :--- |
| **Role Detection** | ✅ Functional | Firebase Custom Claims |
| **Status Locking** | ✅ Functional | `f4-actions-view.js` UI logic |
| **Admin Entry** | ✅ Functional | Button gating (`f4-btn-admin-entry`) |
| **Local Role Override** | ❌ Missing | No client-side override exists |
| **Role Registry** | ❌ Missing | No `USER_ROLES` constant found in code |

---

✅ [代理三稽核報告] 權限機制考古偵察完畢。已確認身分識別邏輯的埋設位置。已確認角色資料來源為 Firebase Custom Claims，而非本地或是 Firestore 文件。UI 端的鎖定邏輯則完全集中在 F4ActionsView 中。
