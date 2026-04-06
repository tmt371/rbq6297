/* FILE: admin/views/admin-user-view.js */
import { db, auth, firebaseConfig } from '../../04-core-code/config/firebase-config.js';
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

/** 
 * [A5] Secondary Firebase Auth Instance 
 * Used to create new users WITHOUT signing out the current admin.
 * The secondary app operates in total isolation from the primary session.
 */
let secondaryApp;
let secondaryAuth;
try {
    const existingApp = getApps().find(app => app.name === 'SecondaryUserCreator');
    secondaryApp = existingApp || initializeApp(firebaseConfig, 'SecondaryUserCreator');
    secondaryAuth = getAuth(secondaryApp);
    console.log("[A5] Secondary Firebase App instance established.");
} catch (e) {
    console.warn("[A5] Secondary App initialization warning:", e.message);
}

/**
 * Lightweight, self-contained inline toast for the standalone Admin page.
 * Cannot use NotificationComponent as it requires the main app's EventAggregator.
 * @param {string} message 
 * @param {'success'|'error'} type 
 */
function showAdminToast(message, type = 'success') {
    // Inject styles once
    if (!document.getElementById('a5-toast-style')) {
        const style = document.createElement('style');
        style.id = 'a5-toast-style';
        style.textContent = `
            #a5-toast-container {
                position: fixed; bottom: 30px; right: 30px;
                z-index: 9999; display: flex; flex-direction: column; gap: 10px;
            }
            .a5-toast {
                padding: 14px 22px; border-radius: 8px; font-size: 14px; font-weight: 600;
                color: #fff; box-shadow: 0 6px 20px rgba(0,0,0,0.25);
                animation: a5-slide-in 0.3s ease forwards;
            }
            .a5-toast.success { background: #003366; border-left: 4px solid #28a745; }
            .a5-toast.error   { background: #cc0000; border-left: 4px solid #ff6b6b; }
            @keyframes a5-slide-in {
                from { opacity: 0; transform: translateX(30px); }
                to   { opacity: 1; transform: translateX(0); }
            }
        `;
        document.head.appendChild(style);
    }

    let toastContainer = document.getElementById('a5-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'a5-toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `a5-toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.remove(), 5000);
}

/**
 * [NEW] Phase A5: User Management view module.
 * Step 3.3: "Ghost" User Creation — Non-Disruptive Auth.
 */
export const AdminUserView = {
    async render(container) {
        console.log("[A5] AdminUserView initializing UI...");
        
        if (!container) return;

        container.innerHTML = `
            <div class="a5-container" style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #003366; font-weight: 800; border-bottom: 2px solid #003366;">A5: USER MANAGEMENT</h2>
                    <button id="a5-btn-create-user" class="btn btn-confirm" style="margin: 0; padding: 10px 20px; font-weight: bold;">➕ CREATE NEW USER</button>
                </div>

                <!-- Create User Form -->
                <div id="a5-create-form-container" class="a5-create-card" style="display: none;">
                    <h3 style="margin-top: 0; font-size: 14px; color: #003366;">CREATE NEW USER ACCOUNT</h3>
                    
                    <div class="a5-form-row">
                        <label for="new-user-email">EMAIL ADDRESS</label>
                        <input type="email" id="new-user-email" class="data-input" placeholder="example@email.com" autocomplete="off">
                    </div>

                    <div class="a5-form-row">
                        <label for="new-user-password">PASSWORD</label>
                        <input type="password" id="new-user-password" class="data-input" placeholder="Min 6 characters" autocomplete="new-password">
                    </div>

                    <div class="a5-form-row">
                        <label for="new-user-role">ASSIGN ROLE</label>
                        <select id="new-user-role" class="data-input">
                            <option value="sales">Sales (Normal User)</option>
                            <option value="admin">Admin (Absolute Authority)</option>
                        </select>
                    </div>

                    <div class="a5-form-actions">
                        <button id="a5-btn-cancel-create" class="btn btn-abort">CANCEL</button>
                        <button id="a5-btn-submit-create" class="btn btn-confirm" style="background: #003366;">CREATE USER</button>
                    </div>
                </div>

                <!-- User Card Grid -->
                <div id="a5-user-list" class="a5-user-grid">
                    <div style="padding: 40px; text-align: center; color: #999; grid-column: 1 / -1;">🌐 Synchronizing User Database...</div>
                </div>
            </div>
        `;

        // --- Bind Listeners ---
        const btnCreate = document.getElementById('a5-btn-create-user');
        const createForm = document.getElementById('a5-create-form-container');
        const btnCancel = document.getElementById('a5-btn-cancel-create');
        const btnSubmit = document.getElementById('a5-btn-submit-create');

        if (btnCreate && createForm) {
            btnCreate.addEventListener('click', () => {
                createForm.style.display = 'block';
                btnCreate.style.display = 'none';
            });
        }

        if (btnCancel && createForm && btnCreate) {
            btnCancel.addEventListener('click', () => this._resetAndHideForm(createForm, btnCreate));
        }

        // --- [STEP 3.3] THE GHOST CREATION HANDLER ---
        if (btnSubmit) {
            btnSubmit.addEventListener('click', () => this.handleCreateUser(btnSubmit, createForm, btnCreate));
        }

        // --- [STEP 4.1] DELEGATED CLICK LISTENER FOR CARDS ---
        const userListGrid = document.getElementById('a5-user-list');
        if (userListGrid) {
            userListGrid.addEventListener('click', (e) => this.handleCardActions(e));
        }

        // --- Initial Fetch ---
        await this.fetchUsers();
    },

    /**
     * [STEP 3.3] The "Ghost" User Creation.
     * Creates a Firebase Auth user via the Secondary App (preserving admin session),
     * then syncs the profile data to the Firestore 'users' collection.
     */
    async handleCreateUser(btnSubmit, createForm, btnCreate) {
        const email = document.getElementById('new-user-email')?.value?.trim();
        const password = document.getElementById('new-user-password')?.value;
        const role = document.getElementById('new-user-role')?.value || 'sales';

        // --- Client-Side Validation ---
        if (!email || !password) {
            showAdminToast('Email and password are required.', 'error');
            return;
        }
        if (password.length < 6) {
            showAdminToast('Password must be at least 6 characters.', 'error');
            return;
        }
        if (!secondaryAuth) {
            showAdminToast('Secondary Auth instance is not ready. Please refresh.', 'error');
            return;
        }

        // --- Loading State ---
        const originalLabel = btnSubmit.textContent;
        btnSubmit.textContent = '⏳ CREATING...';
        btnSubmit.disabled = true;

        try {
            // ===== PATH A: CREATE IN FIREBASE AUTH (via Secondary App) =====
            console.log(`[A5] 🚀 Creating Auth account for: ${email}`);
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUid = userCredential.user.uid;
            console.log(`[A5] ✅ Auth account created. UID: ${newUid}`);

            // ===== PATH B: SYNC PROFILE TO FIRESTORE (via Primary db) =====
            const userDocRef = doc(db, 'users', newUid);
            await setDoc(userDocRef, {
                email,
                role,
                status: 'active',
                createdAt: serverTimestamp()
            });
            console.log(`[A5] ✅ Firestore profile written to /users/${newUid}`);

            // ===== SESSION CLEANUP: Sign out of secondary instance immediately =====
            await signOut(secondaryAuth);
            console.log("[A5] 🔒 Secondary Auth session cleaned up. Admin session intact.");

            // --- Success ---
            showAdminToast(`✅ User "${email}" created successfully!`, 'success');
            this._resetAndHideForm(createForm, btnCreate);
            await this.fetchUsers(); // Refresh the card grid

        } catch (error) {
            console.error("❌ [A5] User creation failed:", error.code, error.message);

            // Firebase error code → friendly message mapping
            const friendlyMessages = {
                'auth/email-already-in-use': 'This email address is already in use.',
                'auth/invalid-email':         'The email address is not valid.',
                'auth/weak-password':          'Password is too weak. Use at least 6 characters.',
                'auth/network-request-failed': 'Network error. Check your internet connection.',
            };
            const friendlyMsg = friendlyMessages[error.code] || error.message;
            showAdminToast(`❌ Error: ${friendlyMsg}`, 'error');

            // Ensure secondary is signed out even on failure
            try { await signOut(secondaryAuth); } catch (_) { /* ignore */ }

        } finally {
            btnSubmit.textContent = originalLabel;
            btnSubmit.disabled = false;
        }
    },

    /**
     * Reset and hide the create form, restore the trigger button.
     */
    _resetAndHideForm(createForm, btnCreate) {
        if (createForm) createForm.style.display = 'none';
        if (btnCreate)  btnCreate.style.display = 'block';
        const emailInput    = document.getElementById('new-user-email');
        const passInput     = document.getElementById('new-user-password');
        const roleSelect    = document.getElementById('new-user-role');
        if (emailInput)  emailInput.value  = '';
        if (passInput)   passInput.value   = '';
        if (roleSelect)  roleSelect.value  = 'sales';
    },

    /**
     * Fetch all documents from 'users' collection in Firestore.
     */
    async fetchUsers() {
        console.log("📑 [A5] Fetching user records from Firestore...");
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const usersArray = [];
            querySnapshot.forEach((doc) => {
                usersArray.push({ id: doc.id, ...doc.data() });
            });
            console.log("✅ [A5] Fetched Users:", usersArray);
            this.renderUserCards(usersArray);
        } catch (error) {
            console.error("❌ [A5] Firestore fetch failed:", error.message);
            const listContainer = document.getElementById('a5-user-list');
            if (listContainer) {
                listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--danger-red); font-weight: bold; grid-column: 1 / -1;">Error: ${error.message}</div>`;
            }
        }
    },

    /**
     * Render user data as responsive cards in the grid.
     */
    renderUserCards(users) {
        const listContainer = document.getElementById('a5-user-list');
        if (!listContainer) return;

        if (users.length === 0) {
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #999; grid-column: 1 / -1;">No users found in database.</div>`;
            return;
        }

        let html = '';
        users.forEach(user => {
            const roleColor = user.role === 'admin' ? '#01579b' : '#666';
            const roleBg    = user.role === 'admin' ? '#e1f5fe' : '#f5f5f5';
            const statusColor = user.status === 'active' ? '#28a745' : '#999';

            html += `
                <div class="user-card">
                    <div class="uc-row">
                        <span class="uc-label">Email</span>
                        <span class="uc-val email-val">${user.email || 'N/A'}</span>
                    </div>
                    <div class="uc-row">
                        <span class="uc-label">Role</span>
                        <span class="uc-val" style="padding: 4px 10px; border-radius: 4px; background: ${roleBg}; color: ${roleColor}; font-size: 11px; font-weight: 800;">
                            ${(user.role || 'sales').toUpperCase()}
                        </span>
                    </div>
                    <div class="uc-row">
                        <span class="uc-label">Status</span>
                        <span class="uc-val" style="color: ${statusColor};">
                            ● ${(user.status || 'active').toUpperCase()}
                        </span>
                    </div>
                    <div class="uc-actions">
                        <button class="btn btn-reset-password" data-uid="${user.id}" data-email="${user.email}" style="padding: 6px 12px; margin: 0; flex: 1;">RESET PW</button>
                        <button class="btn btn-toggle-status ${user.status === 'disabled' ? 'activate' : 'deactivate'}" data-uid="${user.id}" data-status="${user.status || 'active'}" style="padding: 6px 12px; margin: 0; flex: 1;">
                            ${(user.status === 'disabled' ? 'ACTIVATE' : 'DEACTIVATE')}
                        </button>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;
    },

    /**
     * [STEP 4.1] Handle Card Tool Actions via Event Delegation.
     */
    handleCardActions(e) {
        const btnToggle = e.target.closest('.btn-toggle-status');
        const btnReset  = e.target.closest('.btn-reset-password');

        if (btnToggle) {
            const uid = btnToggle.getAttribute('data-uid');
            const currentStatus = btnToggle.getAttribute('data-status');
            const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
            
            console.log(`[A5] Requested Status Toggle for UID: ${uid} (${currentStatus} -> ${newStatus})`);
            
            if (confirm(`Are you sure you want to ${newStatus === 'active' ? 'ACTIVATE' : 'DEACTIVATE'} this user?`)) {
                this.updateUserStatus(uid, newStatus);
            }
        }

        if (btnReset) {
            const uid   = btnReset.getAttribute('data-uid');
            const email = btnReset.getAttribute('data-email');
            
            console.log(`[A5] Requested Password Reset for UID: ${uid} (Email: ${email})`);
            
            if (confirm(`Send a secure password reset email to ${email}?`)) {
                this.sendUserPasswordReset(email);
            }
        }
    },

    /**
     * [STEP 4.2] Persist status change to Firestore.
     */
    async updateUserStatus(uid, newStatus) {
        showAdminToast(`⏳ Updating status to ${newStatus.toUpperCase()}...`, 'success');
        try {
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, { status: newStatus });
            
            console.log(`[A5] ✅ Successfully updated UID ${uid} to ${newStatus}`);
            showAdminToast(`✅ Status updated to ${newStatus.toUpperCase()}`, 'success');
            
            // Refresh UI
            await this.fetchUsers();
        } catch (error) {
            console.error("❌ [A5] Status update failed:", error);
            showAdminToast(`❌ Failed to update status: ${error.message}`, 'error');
        }
    },

    /**
     * [STEP 4.3] Trigger Firebase Auth password reset email.
     */
    async sendUserPasswordReset(email) {
        if (!email) {
            showAdminToast("❌ Error: Valid email required for password reset.", "error");
            return;
        }

        showAdminToast(`⏳ Sending reset email...`, 'success');
        try {
            // Using the primary 'auth' instance (the admin's current connection)
            const actionCodeSettings = {
                url: window.location.origin, // Forces redirect back to localhost during development
                handleCodeInApp: true
            };
            await sendPasswordResetEmail(auth, email, actionCodeSettings);
            
            console.log(`[A5] ✅ Successfully triggered password reset email for ${email}`);
            showAdminToast(`✅ Reset email sent to ${email}`, 'success');
        } catch (error) {
            console.error("❌ [A5] Password reset request failed:", error);
            
            // Map common error codes
            const resetErrorMap = {
                'auth/user-not-found': 'This email is not associated with an account.',
                'auth/too-many-requests': 'Too many requests. Please try again later.',
                'auth/invalid-email': 'The email address format is invalid.'
            };
            const friendlyMsg = resetErrorMap[error.code] || error.message;
            showAdminToast(`❌ Failed: ${friendlyMsg}`, 'error');
        }
    }
};

// Expose globally
window.AdminUserView = AdminUserView;
