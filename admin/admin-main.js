import { ConfigManager } from '../04-core-code/config-manager.js';
import { EventAggregator } from '../04-core-code/event-aggregator.js';
// [NEW] Phase 6.2: Firebase imports for Firestore seeding
import { db } from '../04-core-code/config/firebase-config.js';
import { doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { AdminOrderView } from './views/admin-order-view.js';
import { AdminUserView } from './views/admin-user-view.js';

// [NEW] Phase 6.2: Global seeding function for browser console execution
window.seedFirebaseV2 = async function () {
    console.log("🚀 [Seeder] Starting Firebase V2 data seeding...");
    try {
        // Step 1: Fetch local V2 JSON
        const response = await fetch('../03-data-models/price-matrix-v2.0.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch V2 JSON: HTTP ${response.status}`);
        }
        const data = await response.json();
        console.log("📄 [Seeder] V2 JSON loaded successfully.", {
            hasMatrices: !!data.matrices,
            hasMotors: !!data.motors,
            hasAccessories: !!data.accessories,
            motorCount: data.motors?.length || 0,
            accessoryCount: data.accessories?.length || 0
        });

        // [NEW] Phase 6.2c: Transform nested 2D arrays → Objects for Firestore compatibility
        const payload = JSON.parse(JSON.stringify(data)); // deep clone
        if (payload.matrices) {
            for (const fabricKey in payload.matrices) {
                const pricesArray = payload.matrices[fabricKey].prices;
                if (Array.isArray(pricesArray)) {
                    const pricesObj = {};
                    pricesArray.forEach((row, idx) => {
                        pricesObj[idx] = row;
                    });
                    payload.matrices[fabricKey].prices = pricesObj;
                }
            }
        }
        console.log("🔄 [Seeder] Nested arrays transformed to Objects for Firestore.");

        // Step 2: Write to Firestore → collection: pricing_data, document: v2_matrix
        const docRef = doc(db, 'pricing_data', 'v2_matrix');
        await setDoc(docRef, payload);

        console.log("✅ [Seeder] Firebase seeding SUCCESSFUL!");
        console.log("   Collection: pricing_data");
        console.log("   Document:   v2_matrix");
        console.log("   Payload included: meta, fabricTypeSequence, matrices, motors, accessories, businessRules");
        alert("✅ SUCCESS: V2 Data perfectly seeded to Firebase!");
        return { success: true, message: "V2 data seeded to Firestore." };
    } catch (error) {
        console.error("❌ [Seeder] Firebase seeding FAILED:", error.message);
        console.error("   Full error:", error);
        alert("❌ ERROR: " + error.message);
        return { success: false, error: error.message };
    }
};
console.log("🔧 [Admin] window.seedFirebaseV2() is ready. Execute it in the console to seed Firestore.");

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🛠️ [Admin Portal] Initializing...");

    const loadingOverlay = document.getElementById('loading-overlay');
    const statusBadge = document.getElementById('status-badge');

    // Setup Tab Navigation — [MODIFIED] Phase 8.2b: Fixed selectors + A3 tab support
    let activeTab = 'a1';
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (index === 0) { activeTab = 'a1'; renderA1Hardware(); }
            else if (index === 2) { activeTab = 'a3'; renderA3Fees(); }
            else if (index === 3) { activeTab = 'a4'; AdminOrderView.render(adminContentArea); }
            else if (index === 4) { activeTab = 'a5'; AdminUserView.render(adminContentArea); }
            else { activeTab = 'a2'; renderA2Fabrics(); }
        });
    });

    // Dependencies
    const eventAggregator = new EventAggregator();
    const configManager = new ConfigManager(eventAggregator);

    try {
        // Feature A: Load price matrices
        await configManager.loadPriceMatrices(true); // Force refresh

        if (statusBadge) {
            statusBadge.textContent = 'Connected';
            statusBadge.classList.remove('disconnected');
            statusBadge.classList.add('connected');
        }

        // Feature B: Render Full A1 Hardware Table
        renderA1Hardware();

        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    } catch (error) {
        console.error("❌ [Admin Portal] Initialization failed - Error details:", error.message, error.stack);
        if (loadingOverlay) {
            loadingOverlay.textContent = 'Failed to load configuration. Check console for details.';
            loadingOverlay.style.color = '#dc3545';
        }
    }

    // =================== Phase 6.1: Edit Mode & Data Gathering ===================

    // Cache DOM references
    const drawerToggle = document.getElementById('drawerToggle');
    const adminDrawer = document.getElementById('adminDrawer');
    const vArrow = document.getElementById('vArrow');
    const btnEnterEdit = document.getElementById('btnEnterEdit');
    const btnAbort = document.getElementById('btnAbort');
    const btnConfirm = document.getElementById('btnConfirm');
    const adminContentArea = document.getElementById('admin-content-area');

    // --- Drawer Toggle ---
    if (drawerToggle) {
        drawerToggle.addEventListener('click', () => {
            if (adminDrawer) {
                adminDrawer.classList.toggle('open');
                const isOpen = adminDrawer.classList.contains('open');
                if (vArrow) {
                    vArrow.innerText = isOpen ? '﹀' : '︿';
                }
            }
        });
    }

    // --- Edit Mode Helpers ---
    function enterEditMode() {
        document.body.classList.add('edit-active');
        document.body.classList.remove('edit-locked');
        // Remove readonly from all data inputs
        document.querySelectorAll('#admin-content-area .data-input').forEach(input => {
            input.removeAttribute('readonly');
        });
        // Toggle button visibility
        if (btnEnterEdit) btnEnterEdit.style.display = 'none';
        if (btnAbort) btnAbort.style.display = '';
        if (btnConfirm) btnConfirm.disabled = true; // Enable only when dirty
        console.log("🔓 [Admin] Edit mode activated");
    }

    function exitEditMode() {
        document.body.classList.remove('edit-active');
        document.body.classList.add('edit-locked');
        // Re-add readonly to all data inputs
        document.querySelectorAll('#admin-content-area .data-input').forEach(input => {
            input.setAttribute('readonly', '');
        });
        // Clear all dirty markers
        document.querySelectorAll('#admin-content-area .is-dirty').forEach(row => {
            row.classList.remove('is-dirty');
        });
        // Toggle button visibility
        if (btnEnterEdit) btnEnterEdit.style.display = '';
        if (btnAbort) btnAbort.style.display = 'none';
        if (btnConfirm) btnConfirm.disabled = true;
        console.log("🔒 [Admin] Edit mode deactivated");
    }

    // --- Initialize: hide ABORT button on load ---
    if (btnAbort) btnAbort.style.display = 'none';

    // --- Event: ENTER EDIT MODE ---
    if (btnEnterEdit) {
        btnEnterEdit.addEventListener('click', enterEditMode);
    }

    // --- Event: ABORT ---
    if (btnAbort) {
        btnAbort.addEventListener('click', () => {
            // Re-render original data from ConfigManager (discard DOM changes)
            renderA1Hardware();
            exitEditMode();
            console.log("🔄 [Admin] Changes discarded, grid re-rendered from source data.");
        });
    }

    // --- Event: Dirty Detection ---
    if (adminContentArea) {
        adminContentArea.addEventListener('input', (e) => {
            if (e.target.classList.contains('data-input')) {
                const itemRow = e.target.closest('.item-row');
                if (itemRow) {
                    itemRow.classList.add('is-dirty');
                }
                if (btnConfirm) {
                    btnConfirm.disabled = false;
                }
            }
        });
    }

    // --- Event: CONFIRM (Data Gathering) ---
    if (btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            const gatheredMotors = [];
            const gatheredAccessories = [];

            const allRows = document.querySelectorAll('#admin-content-area .item-row');
            allRows.forEach(row => {
                const dataId = row.getAttribute('data-id') || '';
                const inputs = row.querySelectorAll('.data-input');
                // Determine section by parent section tag
                const parentSection = row.closest('.data-section');
                const sectionTag = parentSection?.querySelector('.section-tag')?.textContent?.trim().toUpperCase() || '';

                if (sectionTag === 'MOTORS') {
                    // Motors: [id, brand, model, cost, price]
                    gatheredMotors.push({
                        id: dataId,
                        brand: inputs[0]?.value || '',
                        model: inputs[1]?.value || '',
                        cost: Number(inputs[2]?.value) || 0,
                        price: Number(inputs[3]?.value) || 0
                    });
                } else {
                    // Electronics / Hardware: [id, category, item, cost, price]
                    gatheredAccessories.push({
                        id: dataId,
                        category: inputs[0]?.value || '',
                        item: inputs[1]?.value || '',
                        cost: Number(inputs[2]?.value) || 0,
                        price: Number(inputs[3]?.value) || 0
                    });
                }
            });

            const reconstructedData = {
                motors: gatheredMotors,
                accessories: gatheredAccessories
            };

            console.log("📦 [Admin] Gathered Data:", reconstructedData);
            console.log(`   Motors: ${gatheredMotors.length} items, Accessories: ${gatheredAccessories.length} items`);

            const dirtyCount = document.querySelectorAll('#admin-content-area .is-dirty').length;
            console.log(`   Modified rows: ${dirtyCount}`);

            // [MODIFIED] Phase 6.3: Write to Firestore instead of just logging
            try {
                btnConfirm.textContent = '⏳ SAVING...';
                btnConfirm.disabled = true;
                await updateDoc(doc(db, 'pricing_data', 'v2_matrix'), {
                    motors: reconstructedData.motors,
                    accessories: reconstructedData.accessories
                });
                alert('✅ SUCCESS: Prices updated in Cloud Database!');
                console.log("✅ [Admin] Firestore updated successfully.");
                // Re-load fresh data from Firestore and re-render
                await configManager.loadPriceMatrices(true);
                renderA1Hardware();
            } catch (saveError) {
                console.error("❌ [Admin] Firestore save failed:", saveError);
                alert('❌ ERROR: ' + saveError.message);
            }

            exitEditMode();
            btnConfirm.textContent = '💾 CONFIRM';
        });
    }

    // =================== Render Function ===================

    function renderA1Hardware() {
        const matrices = configManager.getPriceMatrices() || {};
        const contentArea = document.getElementById('admin-content-area');
        if (!contentArea) {
            console.warn("⚠️ admin-content-area not found");
            return;
        }

        let finalHtml = '';

        // 1. Render Motors (V2 Array)
        const motorsArray = matrices.motors || [];
        finalHtml += `
        <div class="data-section" style="border-color: var(--motor-blue);">
            <span class="section-tag" style="background: var(--motor-blue);">MOTORS</span>
            <div class="desktop-header">
                <span>ID</span><span>BRAND</span><span>MODEL</span><span>COST</span><span>PRICE</span>
            </div>
            <div class="item-list">
        `;
        motorsArray.forEach((motor, idx) => {
            const itemId = motor.id || `M-${idx + 1}`;
            finalHtml += `
            <div class="item-row" data-id="${itemId}">
                <span class="id-text">${itemId}</span>
                <div class="input-group"><span class="mobile-hint">BRAND</span><input type="text" class="data-input" value="${motor.brand}" readonly></div>
                <div class="input-group"><span class="mobile-hint">MODEL</span><input type="text" class="data-input" value="${motor.model}" readonly></div>
                <div class="input-group"><span class="mobile-hint">COST</span><input type="number" class="data-input" value="${motor.cost}" readonly></div>
                <div class="input-group"><span class="mobile-hint">PRICE</span><input type="number" class="data-input" value="${motor.price}" readonly style="color:var(--motor-blue); font-weight:bold;"></div>
            </div>
            `;
        });
        finalHtml += `</div></div>`;

        // 2. Render Accessories — split into Electronics and Hardware
        const accessoriesArray = matrices.accessories || [];
        const electronics = accessoriesArray.filter(a => a.category === 'Electronics');
        const hardware = accessoriesArray.filter(a => a.category === 'Hardware');

        // Electronics section
        finalHtml += `
        <div class="data-section" style="border-color: var(--elec-purple);">
            <span class="section-tag" style="background: var(--elec-purple);">ELECTRONICS</span>
            <div class="desktop-header">
                <span>ID</span><span>CATEGORY</span><span>ITEM</span><span>COST</span><span>PRICE</span>
            </div>
            <div class="item-list">
        `;
        electronics.forEach((acc, idx) => {
            const itemId = acc.id || `E-${idx + 1}`;
            finalHtml += `
            <div class="item-row" data-id="${itemId}">
                <span class="id-text">${itemId}</span>
                <div class="input-group"><span class="mobile-hint">CATEGORY</span><input type="text" class="data-input" value="${acc.category}" readonly></div>
                <div class="input-group"><span class="mobile-hint">ITEM</span><input type="text" class="data-input" value="${acc.item}" readonly></div>
                <div class="input-group"><span class="mobile-hint">COST</span><input type="number" class="data-input" value="${acc.cost}" readonly></div>
                <div class="input-group"><span class="mobile-hint">PRICE</span><input type="number" class="data-input" value="${acc.price}" readonly style="color:var(--elec-purple); font-weight:bold;"></div>
            </div>
            `;
        });
        finalHtml += `</div></div>`;

        // Hardware section
        finalHtml += `
        <div class="data-section" style="border-color: var(--hdw-green, #28a745);">
            <span class="section-tag" style="background: var(--hdw-green, #28a745);">HARDWARE</span>
            <div class="desktop-header">
                <span>ID</span><span>CATEGORY</span><span>ITEM</span><span>COST</span><span>PRICE</span>
            </div>
            <div class="item-list">
        `;
        hardware.forEach((acc, idx) => {
            const itemId = acc.id || `H-${idx + 1}`;
            finalHtml += `
            <div class="item-row" data-id="${itemId}">
                <span class="id-text">${itemId}</span>
                <div class="input-group"><span class="mobile-hint">CATEGORY</span><input type="text" class="data-input" value="${acc.category}" readonly></div>
                <div class="input-group"><span class="mobile-hint">ITEM</span><input type="text" class="data-input" value="${acc.item}" readonly></div>
                <div class="input-group"><span class="mobile-hint">COST</span><input type="number" class="data-input" value="${acc.cost}" readonly></div>
                <div class="input-group"><span class="mobile-hint">PRICE</span><input type="number" class="data-input" value="${acc.price}" readonly style="color:var(--hdw-green, #28a745); font-weight:bold;"></div>
            </div>
            `;
        });
        finalHtml += `</div></div>`;

        contentArea.innerHTML = finalHtml;
        console.log("✅ [Admin Portal] A1 Hardware sectioned tables rendered from V2 arrays.");
    }

    // =================== A3: Fee Configuration Render ===================

    function renderA3Fees() {
        const contentArea = document.getElementById('admin-content-area');
        if (!contentArea) {
            console.warn("⚠️ admin-content-area not found");
            return;
        }

        const fees = configManager.getFees();

        const html = `
        <div class="a3-card">
            <div class="a3-card-header">⚙️ SYSTEM GLOBAL FEE CONFIGURATION</div>
            <div class="a3-card-body">
                <table class="a3-fee-table">
                    <tbody>
                        <tr>
                            <td>🚚</td>
                            <td>Delivery Fee (per unit)</td>
                            <td><input type="number" class="a3-fee-input" id="a3-fee-delivery" value="${fees.delivery}" step="1" min="0"></td>
                        </tr>
                        <tr>
                            <td>🛠️</td>
                            <td>Installation Fee (per unit)</td>
                            <td><input type="number" class="a3-fee-input" id="a3-fee-install" value="${fees.install}" step="1" min="0"></td>
                        </tr>
                        <tr>
                            <td>🗑️</td>
                            <td>Removal Fee (per unit)</td>
                            <td><input type="number" class="a3-fee-input" id="a3-fee-removal" value="${fees.removal}" step="1" min="0"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="a3-card-footer">
                <button class="a3-btn-confirm" id="a3-btn-confirm">💾 CONFIRM & SYNC TO CLOUD</button>
            </div>
        </div>
        `;

        contentArea.innerHTML = html;

        // Bind confirm button
        const a3Confirm = document.getElementById('a3-btn-confirm');
        if (a3Confirm) {
            a3Confirm.addEventListener('click', async () => {
                const delivery = Number(document.getElementById('a3-fee-delivery').value) || 0;
                const install = Number(document.getElementById('a3-fee-install').value) || 0;
                const removal = Number(document.getElementById('a3-fee-removal').value) || 0;

                try {
                    a3Confirm.textContent = '⏳ SYNCING...';
                    a3Confirm.disabled = true;

                    await updateDoc(doc(db, 'pricing_data', 'v2_matrix'), {
                        fees: { delivery, install, removal }
                    });

                    // Refresh config so F2 picks up new defaults
                    await configManager.loadPriceMatrices(true);

                    alert('✅ Cloud Synchronization Successful!');
                    console.log("✅ [Admin A3] Fees synced to Firestore:", { delivery, install, removal });

                } catch (err) {
                    console.error("❌ [Admin A3] Firestore fee update failed:", err);
                    alert('❌ ERROR: ' + err.message);
                } finally {
                    a3Confirm.textContent = '💾 CONFIRM & SYNC TO CLOUD';
                    a3Confirm.disabled = false;
                }
            });
        }

        console.log("✅ [Admin Portal] A3 Fee Configuration card rendered.", fees);
    }

    // =================== A2: Fabric Matrix Viewer ===================

    // [MODIFIED] Phase 10.1b: Strict sequence + B5 support
    const A2_TARGET_SEQUENCE = ['B1', 'B2', 'B3', 'B4', 'B5', 'SN'];
    const FABRIC_DESCRIPTIONS = {
        'B1': 'UNILINE - SUNSET',
        'B2': 'GRACETECH - VALDES, BANES, GEM, ECLIPSE',
        'B3': 'SHAW - LE REVE, SKYE',
        'B4': 'SHAW - LINESQUE',
        'B5': 'SHAW - VIBE',
        'SN': 'UNILINE - UNIVIEW 10%'
    };

    function renderA2Fabrics() {
        const contentArea = document.getElementById('admin-content-area');
        if (!contentArea) return;

        // Build sidebar buttons in strict order — all 6 always rendered
        let sidebarHtml = '<div class="a2-sidebar-title">Fabric Types</div>';
        A2_TARGET_SEQUENCE.forEach((key, idx) => {
            sidebarHtml += `<button class="a2-fabric-btn${idx === 0 ? ' active' : ''}" data-fabric="${key}">${key}</button>`;
        });

        contentArea.innerHTML = `
            <div class="a2-container">
                <div class="a2-sidebar" id="a2-sidebar">${sidebarHtml}</div>
                <div class="a2-main" id="a2-matrix-area"></div>
            </div>
        `;

        // Bind sidebar clicks
        const sidebar = document.getElementById('a2-sidebar');
        sidebar.addEventListener('click', (e) => {
            const btn = e.target.closest('.a2-fabric-btn');
            if (!btn) return;
            sidebar.querySelectorAll('.a2-fabric-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderA2FabricMatrix(btn.dataset.fabric);
        });

        // Render first fabric by default
        renderA2FabricMatrix(A2_TARGET_SEQUENCE[0]);
        console.log(`✅ [Admin Portal] A2 Fabric viewer loaded. ${A2_TARGET_SEQUENCE.length} fabric types in sidebar.`);
    }

    function renderA2FabricMatrix(fabricKey) {
        const matrixArea = document.getElementById('a2-matrix-area');
        if (!matrixArea) return;

        const matrices = configManager.getPriceMatrices() || {};
        const matrix = matrices[fabricKey];

        // [MODIFIED] Phase 10.1b: Use description map for header, handle missing matrices
        const fabricName = FABRIC_DESCRIPTIONS[fabricKey] || (matrix && matrix.name) || '';

        if (!matrix || !matrix.prices) {
            // Check for alias
            if (matrix && matrix.aliasFor) {
                matrixArea.innerHTML = `
                    <div class="a2-card">
                        <div class="a2-card-header">
                            📊 ${fabricKey} PRICE MATRIX
                            <span class="a2-fabric-name">${fabricName} → Alias of ${matrix.aliasFor}</span>
                        </div>
                        <div class="a2-empty-state">This fabric type uses the same matrix as <strong>${matrix.aliasFor}</strong>.</div>
                    </div>`;
            } else {
                matrixArea.innerHTML = `
                    <div class="a2-card">
                        <div class="a2-card-header">
                            📊 ${fabricKey} PRICE MATRIX
                            <span class="a2-fabric-name">${fabricName}</span>
                        </div>
                        <div class="a2-empty-state">⚠️ Matrix Data Missing — Requires CSV Import</div>
                    </div>`;
            }
            return;
        }

        const widths = matrix.widths || [];
        const drops = matrix.drops || [];
        const prices = matrix.prices || [];

        // Build table header
        let headerHtml = '<tr><th class="a2-corner">Drop \\ Width</th>';
        widths.forEach(w => {
            headerHtml += `<th>${w}</th>`;
        });
        headerHtml += '</tr>';

        // Build table body
        let bodyHtml = '';
        drops.forEach((drop, rowIdx) => {
            bodyHtml += `<tr><td class="a2-row-header">${drop}</td>`;
            const row = prices[rowIdx] || [];
            widths.forEach((_, colIdx) => {
                const val = row[colIdx];
                if (val === null || val === undefined) {
                    bodyHtml += '<td class="a2-null-cell">—</td>';
                } else {
                    bodyHtml += `<td>$${val}</td>`;
                }
            });
            bodyHtml += '</tr>';
        });

        matrixArea.innerHTML = `
            <div class="a2-card">
                <div class="a2-card-header">
                    📊 ${fabricKey} PRICE MATRIX
                    <span class="a2-fabric-name">${fabricName}</span>
                </div>
                <div class="a2-matrix-scroll">
                    <table class="a2-matrix-table">
                        <thead>${headerHtml}</thead>
                        <tbody>${bodyHtml}</tbody>
                    </table>
                </div>
            </div>
        `;

        console.log(`✅ [Admin A2] Rendered matrix for ${fabricKey}: ${drops.length} rows × ${widths.length} cols`);
    }

});
