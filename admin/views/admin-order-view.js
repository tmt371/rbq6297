/* FILE: admin/views/admin-order-view.js */
import { loadGlobalAuditList } from '../../04-core-code/services/online-storage-service.js';
import { 
    softDeleteQuote, 
    hardDeleteQuotes, 
    batchSoftDeleteQuotes, 
    restoreQuote, 
    batchRestoreQuotes 
} from '../../04-core-code/services/quote-persistence-service.js';

let allCachedQuotes = []; // Holds both active and deleted quotes
let currentViewMode = 'active'; // 'active' or 'deleted'

/**
 * [NEW] Phase II.3: Admin Recycle Bin & God Mode
 * Orchestrates order management, restoration, and permanent deletion.
 * All UI labels and placeholders are strictly in English.
 */
export const AdminOrderView = {
    async render(container) {
        console.log("📑 [AdminOrderView] Initializing view...");
        
        // 1. Build Static Layout (Skeleton)
        this.renderSkeleton(container);

        // 2. Fetch data if empty, then apply filters
        if (allCachedQuotes.length === 0) {
            await this.fetchOrders(container);
        } else {
            this.applyFilters(container);
        }
    },

    renderSkeleton(container) {
        container.innerHTML = `
            <!-- 1. Control Bar (Strictly English) -->
            <div class="a4-control-bar" style="margin-top: 20px;">
                <input type="text" id="a4-search-input" placeholder="🔍 Search (ID / Customer)..." class="a4-search-input">
                
                <div class="a4-date-range">
                    <span class="a4-date-label">Date Range:</span>
                    <input type="date" id="a4-start-date" title="Start Date" class="a4-date-input">
                    <input type="date" id="a4-end-date" title="End Date" class="a4-date-input">
                </div>

                <label class="a4-filter-label">
                    <input type="checkbox" id="a4-zero-filter"> $0 Only
                </label>

                <select id="a4-sort-select" class="a4-sort-select">
                    <option value="desc">⬇️ Newest</option>
                    <option value="asc">⬆️ Oldest</option>
                </select>

                <button id="a4-refresh-btn" class="a4-refresh-btn">🔄 Refresh</button>
                <div class="a4-toolbar-divider"></div>
                <button id="a4-toggle-view-btn" class="a4-toggle-btn" style="background: ${currentViewMode === 'active' ? '#666' : 'var(--motor-blue)'}; color: white; border: none; font-weight: bold;">
                    ${currentViewMode === 'active' ? '🗑️ Recycle Bin' : '📋 Active Orders'}
                </button>
            </div>

            <!-- 2. Info Bar (Split for UX) -->
            <div class="a4-status-bar">
                <div class="a4-status-header" id="a4-status-text">SYNCING...</div>
                <div class="a4-status-actions" id="a4-batch-controls">
                    <span class="selected-count" id="a4-selected-count">0 SELECTED</span>
                    <div style="display: flex; gap: 8px;">
                        <!-- Conditional Batch Buttons -->
                        <button id="a4-batch-delete-btn" class="a4-batch-delete-btn ${currentViewMode === 'deleted' ? 'hidden' : ''}" disabled>🗑️ Batch Soft Delete</button>
                        <button id="a4-batch-restore-btn" class="btn btn-confirm ${currentViewMode === 'active' ? 'hidden' : ''}" style="margin:0; padding: 4px 12px; font-size: 11px;" disabled>✅ Batch Restore</button>
                        <button id="a4-batch-hard-delete-btn" class="${currentViewMode === 'active' ? 'hidden' : ''}" style="margin:0;" disabled>💀 Batch Hard Delete</button>
                    </div>
                </div>
            </div>

            <!-- 3. Table Container (Refactored to <table> for Super-Sticky support) -->
            <div class="data-section" style="border-color: var(--bg-dark); padding: 0; overflow: hidden; margin-top: 0;">
                <div class="a4-table-container">
                    <table class="a4-table">
                        <thead class="a4-table-header">
                            <tr>
                                <th class="col-frozen">
                                    <div class="frozen-top">
                                        <input type="checkbox" id="a4-select-all" title="Select All">
                                        <span style="font-size: 10px; font-weight: 900;">ACTIONS</span>
                                    </div>
                                    <div class="frozen-bottom">
                                        <span class="order-id-label">ORDER ID</span>
                                    </div>
                                </th>
                                <th>CLIENT</th>
                                <th>DATE</th>
                                <th>TOTAL</th>
                                <th>STATUS</th>
                                <th style="text-align: center;">MANAGE</th>
                            </tr>
                        </thead>
                        <tbody id="a4-order-list">
                            <!-- Rows injected here -->
                            <tr>
                                <td colspan="6" style="padding: 40px; text-align: center; color: #666;">🌐 Synchronizing Cloud Database...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Bind Control Events
        const controls = ['a4-search-input', 'a4-start-date', 'a4-end-date', 'a4-zero-filter', 'a4-sort-select'];
        controls.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.applyFilters(container));
        });

        // View Toggle
        document.getElementById('a4-toggle-view-btn').addEventListener('click', () => {
            currentViewMode = currentViewMode === 'active' ? 'deleted' : 'active';
            this.render(container); // Full re-render skeleton for button states
        });

        document.getElementById('a4-refresh-btn').addEventListener('click', () => {
            if (document.getElementById('a4-search-input')) document.getElementById('a4-search-input').value = '';
            if (document.getElementById('a4-start-date')) document.getElementById('a4-start-date').value = '';
            if (document.getElementById('a4-end-date')) document.getElementById('a4-end-date').value = '';
            if (document.getElementById('a4-zero-filter')) document.getElementById('a4-zero-filter').checked = false;
            if (document.getElementById('a4-sort-select')) document.getElementById('a4-sort-select').value = 'desc';
            this.fetchOrders(container);
        });
        
        // Select All Handler
        document.getElementById('a4-select-all').addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.a4-row-select');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            this.toggleBatchButton();
        });

        // Batch Action Handlers
        document.getElementById('a4-batch-delete-btn').addEventListener('click', () => this.handleBatchSoftDelete(container));
        document.getElementById('a4-batch-restore-btn').addEventListener('click', () => this.handleBatchRestore(container));
        document.getElementById('a4-batch-hard-delete-btn').addEventListener('click', () => this.handleBatchHardDelete(container));

        // Modal Skeleton Injection
        this.injectModal(container);
    },

    injectModal(container) {
        if (document.getElementById('a4-quick-view-modal')) return;
        const modalHtml = `
            <div id="a4-quick-view-modal" class="a4-modal-overlay hidden">
                <div class="a4-modal-content">
                    <span class="a4-modal-close" id="a4-modal-close-btn">✖</span>
                    <div id="a4-modal-body" style="margin-top: 15px; line-height: 1.6; font-size: 14px; color: #333;"></div>
                    <div style="margin-top: 25px; text-align: right;">
                        <button class="btn btn-confirm" id="a4-modal-done-btn" style="padding: 8px 20px; font-size: 12px; grid-column: auto;">DONE</button>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('a4-quick-view-modal');
        const closeFn = () => this.closeQuickView();
        document.getElementById('a4-modal-close-btn').addEventListener('click', closeFn);
        document.getElementById('a4-modal-done-btn').addEventListener('click', closeFn);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeFn(); });
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeFn(); });
    },

    showQuickView(quoteId) {
        const quote = allCachedQuotes.find(q => q.quoteId === quoteId);
        if (!quote) return;
        const modalBody = document.getElementById('a4-modal-body');
        const statusText = quote.isDeleted ? 'DELETED' : 'ACTIVE';
        const statusClass = quote.isDeleted ? 'status-deleted' : 'status-active';

        modalBody.innerHTML = `
            <h3 class="modal-order-id-title" style="margin-top: 0; color: #666; font-size: 14px; border-bottom: 2px solid #eee; padding-bottom: 8px;">Order ID: ${quote.quoteId}</h3>
            
            <div class="modal-4block-grid">
                <div class="info-card">
                    <h4>CUSTOMER INFO</h4>
                    <strong>${quote.customerName || 'Unknown'}</strong><br>
                    Phone: ${quote.customerPhone || 'N/A'}<br>
                    Email: ${quote.customerEmail || 'N/A'}<br>
                    Address: ${quote.customerAddress || 'N/A'}
                </div>
                <div class="info-card">
                    <h4>ORDER METADATA</h4>
                    <strong>Status: <span class="status-badge ${statusClass}">${statusText}</span></strong><br>
                    Created: ${quote.date?.split('T')[0] || 'N/A'}<br>
                    Modified: ${quote.lastModified ? quote.lastModified.split('T')[0] : (quote.date?.split('T')[0] || 'N/A')}
                </div>
                <div class="info-card">
                    <h4>VOLUME DATA</h4>
                    <strong>Total Items:</strong> ${quote.itemCount || 0}
                </div>
                <div class="info-card">
                    <h4>ACCOUNTING</h4>
                    <strong>Grand Total:</strong> $${Number(quote.totalAmount || 0).toFixed(2)}<br>
                    <strong>Deposit Paid:</strong> $${Number(quote.deposit || 0).toFixed(2)}
                </div>
            </div>
            
            <div class="internal-notes-container">
                <h4>INTERNAL NOTES</h4>
                <div class="notes-content">${quote.notes || '<i>No notes provided.</i>'}</div>
            </div>
        `;
        document.getElementById('a4-quick-view-modal').classList.remove('hidden');
    },

    closeQuickView() {
        const modal = document.getElementById('a4-quick-view-modal');
        if (modal) modal.classList.add('hidden');
    },

    async fetchOrders(container) {
        const listContainer = document.getElementById('a4-order-list');
        const statusText = document.getElementById('a4-status-text');
        if (listContainer) listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">🌐 Synchronizing Cloud Database...</div>`;
        if (statusText) statusText.textContent = 'SYNCING DATA...';

        try {
            const result = await loadGlobalAuditList();
            if (!result.success) throw new Error(result.message);
            allCachedQuotes = result.data; // Store all records for view toggling
            this.applyFilters(container);
        } catch (error) {
            console.error("❌ [AdminOrderView] Fetch failed:", error);
            if (listContainer) listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--danger-red);">${error.message}</div>`;
        }
    },

    applyFilters(container) {
        const searchVal = document.getElementById('a4-search-input')?.value.toLowerCase() || '';
        const startDateVal = document.getElementById('a4-start-date')?.value || '';
        const endDateVal = document.getElementById('a4-end-date')?.value || '';
        const showZeroOnly = document.getElementById('a4-zero-filter')?.checked || false;
        const sortDir = document.getElementById('a4-sort-select')?.value || 'desc';

        // 1. Partition by View Mode
        let filtered = allCachedQuotes.filter(q => {
            const isDeleted = q.isDeleted === true;
            if (currentViewMode === 'active' && isDeleted) return false;
            if (currentViewMode === 'deleted' && !isDeleted) return false;

            const matchesSearch = q.quoteId.toLowerCase().includes(searchVal) || q.customerName.toLowerCase().includes(searchVal);
            const matchesZero = showZeroOnly ? Number(q.totalAmount) === 0 : true;
            let matchesDate = true;
            if (q.date && q.date !== 'N/A') {
                const qDate = q.date.split('T')[0];
                if (startDateVal && qDate < startDateVal) matchesDate = false;
                if (endDateVal && qDate > endDateVal) matchesDate = false;
            } else if (startDateVal || endDateVal) matchesDate = false;

            return matchesSearch && matchesZero && matchesDate;
        });

        // 2. Sort
        filtered.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return sortDir === 'desc' ? dateB - dateA : dateA - dateB;
        });

        // 3. Render
        this.renderTableRows(filtered);
        
        // 4. Update Info Bar
        const statusText = document.getElementById('a4-status-text');
        if (statusText) {
            const modeText = currentViewMode === 'active' ? 'ACTIVE ORDERS' : 'RECYCLE BIN';
            statusText.textContent = `${modeText}: ${filtered.length} visible (Full DB: ${allCachedQuotes.length})`;
        }
        
        const selectAll = document.getElementById('a4-select-all');
        if (selectAll) selectAll.checked = false;
        this.toggleBatchButton();
    },

    renderTableRows(data) {
        const listContainer = document.getElementById('a4-order-list');
        if (!listContainer) return;

        if (data.length === 0) {
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #999;">No ${currentViewMode} orders found.</div>`;
            return;
        }

        let html = '';
        data.forEach(quote => {
            let formattedDate = 'N/A';
            if (quote.date && quote.date !== 'N/A') formattedDate = quote.date.split('T')[0];
            
            const statusLabel = quote.isDeleted ? 'DELETED' : 'ACTIVE';
            const statusColor = quote.isDeleted ? 'var(--danger-red)' : 'var(--hdw-green)';

            html += `
                <tr class="a4-table-row">
                    <!-- 1. Frozen Column (Checkbox + View + ID) -->
                    <td class="col-frozen">
                        <div class="frozen-content">
                            <div class="frozen-top">
                                <input type="checkbox" class="a4-row-select" data-id="${quote.quoteId}">
                                <button class="a4-view-btn btn-view-order" data-id="${quote.quoteId}">👁️ <span>View</span></button>
                            </div>
                            <div class="frozen-bottom">
                                <span class="order-id">${quote.quoteId}</span>
                            </div>
                        </div>
                    </td>
                    
                    <!-- 2. Client Name -->
                    <td><span style="font-size: 14px; font-weight: 600;">${quote.customerName}</span></td>
                    
                    <!-- 3. Date -->
                    <td><span style="font-size: 13px; color: #666;">${formattedDate}</span></td>
                    
                    <!-- 4. Total Amount -->
                    <td><span style="font-size: 14px; font-weight: 800; color: var(--motor-blue);">$${Number(quote.totalAmount).toFixed(2)}</span></td>
                    
                    <!-- 5. Status -->
                    <td><span style="font-size: 10px; font-weight: 900; color: ${statusColor};">${statusLabel}</span></td>

                    <!-- 6. Delete Button (Far Right) -->
                    <td style="text-align: center;">
                        ${currentViewMode === 'active' ? `
                            <button class="btn btn-abort soft-delete-btn btn-delete-order" data-id="${quote.quoteId}" style="padding: 6px; font-size: 11px; margin: 0; width: 100%;">
                                🗑️<span> Delete</span>
                            </button>
                        ` : `
                            <div style="display: flex; gap: 4px;">
                                <button class="btn btn-confirm restore-btn" data-id="${quote.quoteId}" style="padding: 6px; font-size: 11px; margin: 0; flex: 1;" title="Restore">✅</button>
                                <button class="btn btn-abort hard-delete-btn" data-id="${quote.quoteId}" style="padding: 6px; font-size: 11px; margin: 0; background: red; flex: 1;" title="Permanent Delete">💀</button>
                            </div>
                        `}
                    </td>
                </tr>
            `;
        });

        listContainer.innerHTML = html;

        // Row Listeners
        listContainer.querySelectorAll('.a4-row-select').forEach(cb => cb.addEventListener('change', () => this.toggleBatchButton()));
        listContainer.querySelectorAll('.a4-view-btn').forEach(btn => btn.addEventListener('click', (e) => this.showQuickView(e.currentTarget.getAttribute('data-id'))));
        
        listContainer.querySelectorAll('.soft-delete-btn').forEach(btn => btn.addEventListener('click', (e) => this.handleSoftDelete(e)));
        listContainer.querySelectorAll('.restore-btn').forEach(btn => btn.addEventListener('click', (e) => this.handleRestore(e)));
        listContainer.querySelectorAll('.hard-delete-btn').forEach(btn => btn.addEventListener('click', (e) => this.handleHardDelete(e)));
    },

    toggleBatchButton() {
        const selected = document.querySelectorAll('.a4-row-select:checked');
        const countText = document.getElementById('a4-selected-count');
        if (countText) countText.textContent = `${selected.length} SELECTED`;

        // Action Buttons
        const softDeleteBtn = document.getElementById('a4-batch-delete-btn');
        const restoreBtn = document.getElementById('a4-batch-restore-btn');
        const hardDeleteBtn = document.getElementById('a4-batch-hard-delete-btn');

        if (softDeleteBtn) softDeleteBtn.disabled = selected.length === 0;
        if (restoreBtn) restoreBtn.disabled = selected.length === 0;
        if (hardDeleteBtn) hardDeleteBtn.disabled = selected.length === 0;
    },

    // --- Action Handlers ---

    async handleSoftDelete(e) {
        const btn = e.target.closest('.soft-delete-btn');
        const id = btn ? btn.dataset.id : null;
        if (!id) { console.error("❌ [Admin] Missing ID for soft delete"); return; }
        
        if (confirm(`🗑️ SOFT DELETE: ${id}?\nMove this order to Recycle Bin.`)) {
            const res = await softDeleteQuote(id);
            if (res.success) this.fetchOrders();
        }
    },

    async handleRestore(e) {
        const btn = e.target.closest('.restore-btn');
        const id = btn ? btn.dataset.id : null;
        if (!id) return;

        if (confirm(`✅ RESTORE: ${id}?\nMove this order back to Active list.`)) {
            const res = await restoreQuote(id);
            if (res.success) this.fetchOrders();
        }
    },

    async handleHardDelete(e) {
        const btn = e.target.closest('.hard-delete-btn');
        const id = btn ? btn.dataset.id : null;
        if (!id) return;

        const input = prompt(`⚠️ DANGER: PERMANENT DELETION OF ${id}\nThis data will be purged from Firebase.\n\nType "DELETE" to confirm:`);
        if (input === 'DELETE') {
            const res = await hardDeleteQuotes([id]);
            if (res.success) this.fetchOrders();
        } else if (input !== null) {
            alert('❌ Incorrect password string. Deletion aborted.');
        }
    },

    async handleBatchSoftDelete() {
        const selected = document.querySelectorAll('.a4-row-select:checked');
        const ids = Array.from(selected).map(cb => cb.getAttribute('data-id'));
        if (confirm(`🗑️ BATCH SOFT DELETE: ${ids.length} orders?\nMoving to Recycle Bin.`)) {
            const res = await batchSoftDeleteQuotes(ids);
            if (res.success) this.fetchOrders();
        }
    },

    async handleBatchRestore() {
        const selected = document.querySelectorAll('.a4-row-select:checked');
        const ids = Array.from(selected).map(cb => cb.getAttribute('data-id'));
        if (confirm(`✅ BATCH RESTORE: ${ids.length} orders?\nReturning to Active list.`)) {
            const res = await batchRestoreQuotes(ids);
            if (res.success) this.fetchOrders();
        }
    },

    async handleBatchHardDelete() {
        const selected = document.querySelectorAll('.a4-row-select:checked');
        const ids = Array.from(selected).map(cb => cb.getAttribute('data-id'));
        const input = prompt(`🔥 GOD MODE: PERMANENT BATCH PURGE\nAre you sure you want to hard delete ${ids.length} records?\n\nType "DELETE" to confirm:`);
        if (input === 'DELETE') {
            const res = await hardDeleteQuotes(ids);
            if (res.success) this.fetchOrders();
        } else if (input !== null) {
            alert('❌ Confirmation failed. Batch purge aborted.');
        }
    }
};
