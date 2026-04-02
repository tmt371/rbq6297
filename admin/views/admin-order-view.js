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
                <input type="text" id="a4-search-input" placeholder="🔍 Search (ID / Customer)...">
                
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px; font-weight: bold; color: #666;">Date Range:</span>
                    <input type="date" id="a4-start-date" title="Start Date" style="padding: 5px; font-size: 12px; border: 1px solid #ccc; border-radius: 4px;">
                    <input type="date" id="a4-end-date" title="End Date" style="padding: 5px; font-size: 12px; border: 1px solid #ccc; border-radius: 4px;">
                </div>

                <label>
                    <input type="checkbox" id="a4-zero-filter"> $0 Only
                </label>

                <select id="a4-sort-select">
                    <option value="desc">⬇️ Newest</option>
                    <option value="asc">⬆️ Oldest</option>
                </select>

                <button id="a4-refresh-btn">🔄 Refresh</button>
                <div style="border-left: 1px solid #ccc; height: 24px; margin: 0 5px;"></div>
                <button id="a4-toggle-view-btn" style="background: ${currentViewMode === 'active' ? '#666' : 'var(--motor-blue)'}; color: white; border: none; font-weight: bold;">
                    ${currentViewMode === 'active' ? '🗑️ Recycle Bin' : '📋 Active Orders'}
                </button>
            </div>

            <!-- 2. Info Bar -->
            <div class="a4-info-bar">
                <span id="a4-status-text">SYNCING...</span>
                <div id="a4-batch-controls" style="display: flex; gap: 10px; align-items: center;">
                    <span id="a4-selected-count" style="color: var(--danger-red); font-weight: 800;">0 SELECTED</span>
                    
                    <!-- Conditional Batch Buttons -->
                    <button id="a4-batch-delete-btn" class="a4-batch-delete-btn ${currentViewMode === 'deleted' ? 'hidden' : ''}" disabled>🗑️ Batch Soft Delete</button>
                    <button id="a4-batch-restore-btn" class="btn btn-confirm ${currentViewMode === 'active' ? 'hidden' : ''}" style="margin:0; padding: 4px 12px; font-size: 11px;" disabled>✅ Batch Restore</button>
                    <button id="a4-batch-hard-delete-btn" class="${currentViewMode === 'active' ? 'hidden' : ''}" style="margin:0;" disabled>💀 Batch Hard Delete</button>
                </div>
            </div>

            <!-- 3. Table Container -->
            <div class="data-section" style="border-color: var(--bg-dark); padding: 0; overflow: hidden; margin-top: 0;">
                <div class="a4-table-scroll-wrapper">
                    <div class="desktop-header" style="grid-template-columns: 40px 140px 100px 1fr 100px 200px;">
                        <input type="checkbox" id="a4-select-all" title="Select All">
                        <span>QUOTE ID</span><span>DATE</span><span>CUSTOMER</span><span>TOTAL</span><span>ACTIONS</span>
                    </div>
                    <div class="item-list" id="a4-order-list">
                        <!-- Rows injected here -->
                    </div>
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
                    <h3 style="margin-top:0; font-weight: 800; color: #003366; border-bottom: 2px solid #003366; padding-bottom: 10px;">Order Details</h3>
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
        modalBody.innerHTML = `
            <div style="background: #f0f4f8; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
                <div style="margin-bottom: 8px;"><span style="font-size: 10px; font-weight: 900; color: #003366; text-transform: uppercase;">Customer Info</span><br><strong style="font-size: 16px;">${quote.customerName}</strong></div>
                <strong>Phone:</strong> ${quote.customerPhone}<br><strong>Email:</strong> ${quote.customerEmail}<br><strong>Address:</strong> ${quote.customerAddress}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div><span style="font-size: 10px; font-weight: 900; color: #003366; text-transform: uppercase;">Volume Data</span><br><strong>Total Items:</strong> ${quote.itemCount}</div>
                <div><span style="font-size: 10px; font-weight: 900; color: #003366; text-transform: uppercase;">Accounting</span><br><strong>Grand Total:</strong> $${Number(quote.totalAmount).toFixed(2)}<br><strong>Deposit Paid:</strong> $${Number(quote.deposit).toFixed(2)}</div>
            </div>
            <div style="background: #fff9db; border: 1px solid #ffeeba; padding: 12px; border-radius: 6px;">
                <span style="font-size: 10px; font-weight: 900; color: #856404; text-transform: uppercase;">Internal Notes</span><br><div style="font-style: italic; color: #555;">${quote.notes}</div>
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
            
            html += `
                <div class="item-row" style="grid-template-columns: 40px 140px 100px 1fr 100px 200px; align-items: center;">
                    <input type="checkbox" class="a4-row-select" data-id="${quote.quoteId}">
                    <span class="id-text" style="font-weight: bold; color: #333;">${quote.quoteId}</span>
                    <span style="font-size: 12px; color: #666;">${formattedDate}</span>
                    <span style="font-size: 14px; font-weight: 600;">${quote.customerName}</span>
                    <span style="font-size: 14px; font-weight: 800; color: var(--motor-blue);">$${Number(quote.totalAmount).toFixed(2)}</span>
                    <div class="input-group" style="flex-direction: row; gap: 4px;">
                        <button class="a4-view-btn" data-id="${quote.quoteId}" style="margin: 0; padding: 4px 8px;">👁️</button>
                        ${currentViewMode === 'active' ? `
                            <button class="btn btn-abort soft-delete-btn" data-id="${quote.quoteId}" style="padding: 6px; font-size: 11px; margin: 0; flex: 1;">🗑️ DELETE</button>
                        ` : `
                            <button class="btn btn-confirm restore-btn" data-id="${quote.quoteId}" style="padding: 6px; font-size: 11px; margin: 0; flex: 1;">✅ RESTORE</button>
                            <button class="btn btn-abort hard-delete-btn" data-id="${quote.quoteId}" style="padding: 6px; font-size: 11px; margin: 0; background: red;">💀</button>
                        `}
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;

        // Row Listeners
        listContainer.querySelectorAll('.a4-row-select').forEach(cb => cb.addEventListener('change', () => this.toggleBatchButton()));
        listContainer.querySelectorAll('.a4-view-btn').forEach(btn => btn.addEventListener('click', (e) => this.showQuickView(e.target.getAttribute('data-id'))));
        
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
        const id = e.target.getAttribute('data-id');
        if (confirm(`🗑️ SOFT DELETE: ${id}?\nMove this order to Recycle Bin.`)) {
            const res = await softDeleteQuote(id);
            if (res.success) this.fetchOrders();
        }
    },

    async handleRestore(e) {
        const id = e.target.getAttribute('data-id');
        if (confirm(`✅ RESTORE: ${id}?\nMove this order back to Active list.`)) {
            const res = await restoreQuote(id);
            if (res.success) this.fetchOrders();
        }
    },

    async handleHardDelete(e) {
        const id = e.target.getAttribute('data-id');
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
