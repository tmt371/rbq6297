/* FILE: 04-core-code/services/quote-persistence-service.js */
// [MODIFIED] (Scheme B - Correction Bugfix) Strip payment clone on correction, use Base Ledger ID.
import { saveQuoteToCloud } from './online-storage-service.js';
import { db } from '../config/firebase-config.js';
import { writeBatch, doc, getDoc, updateDoc, setDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js';
import { EVENTS } from '../config/constants.js';
import * as quoteActions from '../actions/quote-actions.js';
import { QUOTE_STATUS } from '../config/status-config.js';

export class QuotePersistenceService {
    constructor({
        eventAggregator, stateService, fileService, authService,
        calculationService, configManager, productFactory, excelExportService
    }) {
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.fileService = fileService;
        this.authService = authService;
        this.calculationService = calculationService;
        this.configManager = configManager;
        this.productFactory = productFactory;
        this.excelExportService = excelExportService;
        console.log('QuotePersistenceService Initialized.');
    }

    /**
     * [Scheme B] Extracts the Base Quote ID (Master Ledger key) from any versioned quoteId.
     * Rule: split by '-', use first two segments as the base.
     * e.g., 'Q-2410-001-A' -> 'Q-2410-001'
     *       'Q-001'         -> 'Q-001'
     * @param {string} quoteId
     * @returns {string}
     */
    _getBaseLedgerId(quoteId) {
        if (!quoteId) return quoteId;
        // A versioned ID ends with a uppercase letter segment, e.g. -A, -v2, -B
        // Strategy: remove trailing '-' + non-numeric/noncore suffix produced by correction flow
        // Correction renames Q-001 -> Q-001-A (or -B, -C), so strip the last dash-segment if it is a version marker
        const parts = quoteId.split('-');
        // The base is everything except the last segment IF the last segment is a single uppercase letter (A-Z) or vN pattern
        if (parts.length > 1) {
            const last = parts[parts.length - 1];
            if (/^[A-Z]$/.test(last) || /^v\d+$/.test(last)) {
                return parts.slice(0, parts.length - 1).join('-');
            }
        }
        return quoteId;
    }

    _getQuoteDataWithSnapshots() {
        const { quoteData, ui } = this.stateService.getState();
        let dataWithSnapshot = JSON.parse(JSON.stringify(quoteData));

        if (this.authService && this.authService.currentUser) {
            dataWithSnapshot.ownerUid = this.authService.currentUser.uid;
        }

        const items = quoteData.products[quoteData.currentProduct].items;
        const hasMotor = items.some(item => !!item.motor);

        if (!dataWithSnapshot.metadata) dataWithSnapshot.metadata = {};
        dataWithSnapshot.metadata.hasMotor = hasMotor;

        if (dataWithSnapshot.f1Snapshot) {
            dataWithSnapshot.f1Snapshot.winder_qty = items.filter((item) => item.winder === 'HD').length;
            dataWithSnapshot.f1Snapshot.motor_qty = items.filter((item) => !!item.motor).length;
            dataWithSnapshot.f1Snapshot.charger_qty = ui.driveChargerCount || 0;
            dataWithSnapshot.f1Snapshot.cord_qty = ui.driveCordCount || 0;

            const totalRemoteQty = ui.driveRemoteCount || 0;
            const remote1chQty = ui.f1.remote_1ch_qty;
            const remote16chQty = ui.f1.remote_1ch_qty === null ? totalRemoteQty - remote1chQty : ui.f1.remote_16ch_qty;

            const totalDualPairs = Math.floor(items.filter((item) => item.dual === 'D').length / 2);
            const comboQty = ui.f1.dual_combo_qty === null ? totalDualPairs : ui.f1.dual_combo_qty;
            const slimQty = ui.f1.dual_slim_qty === null ? 0 : ui.f1.dual_slim_qty;
            dataWithSnapshot.f1Snapshot.remote_1ch_qty = remote1chQty;
            dataWithSnapshot.f1Snapshot.remote_16ch_qty = remote16chQty;
            dataWithSnapshot.f1Snapshot.dual_combo_qty = comboQty;
            dataWithSnapshot.f1Snapshot.dual_slim_qty = slimQty;
            dataWithSnapshot.f1Snapshot.discountPercentage = ui.f1.discountPercentage;
            dataWithSnapshot.f1Snapshot.wifi_qty = ui.f1.wifi_qty || 0;
            dataWithSnapshot.f1Snapshot.w_motor_qty = ui.f1.w_motor_qty || 0;
        }

        dataWithSnapshot.f2Snapshot = JSON.parse(JSON.stringify(ui.f2));
        dataWithSnapshot.creationDate = new Date().toISOString();
        return dataWithSnapshot;
    }

    async handleSaveToFile() {
        const authResult = await this.authService.verifyAuthentication();
        let skipCloudSave = false;

        if (!authResult.success) {
            if (authResult.reason === 'blocked') {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: authResult.message, type: 'error' });
                skipCloudSave = true;
            } else {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: authResult.message, type: 'error' });
                await this.authService.logout();
                return;
            }
        }

        const currentState = this.stateService.getState();
        const { isCorrectionMode } = currentState.ui;
        const currentStatus = currentState.quoteData.status;

        if (isCorrectionMode) return this.handleCorrectionSave();

        const isLocked = currentStatus && currentStatus !== QUOTE_STATUS.A_SAVED && currentStatus !== "Configuring";
        if (isLocked) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Order is established and LOCKED. Please use "Cancel / Correct" to make changes.', type: 'error'
            });
            return;
        }

        const dataToSave = this._getQuoteDataWithSnapshots();

        try {
            if (!skipCloudSave) {
                const result = await saveQuoteToCloud(dataToSave);
                if (result.success) {
                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                        message: `Quote ${dataToSave.quoteId || 'Draft'} successfully saved and overwritten in Cloud.`, type: 'info',
                    });
                } else {
                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                        message: `Save Failed: ${result.message || 'Cloud rejected the request.'}`, type: 'error',
                    });
                }
            }
        } catch (error) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: `Cloud save error: ${error.message || 'Check network connection.'}`, type: 'error',
            });
            throw error;
        }
    }

    async handleCorrectionSave() {
        try {
            const newData = this._getQuoteDataWithSnapshots();
            const currentId = newData.quoteId;
            const versionRegex = /-([A-Z])$/;
            const match = currentId.match(versionRegex);
            const nextLetter = match
                ? String.fromCharCode(match[1].charCodeAt(0) + 1)
                : 'A';
            const baseId = this._getBaseLedgerId(currentId);
            let newQuoteId = match
                ? currentId.replace(versionRegex, `-${nextLetter}`)
                : `${currentId}-A`;

            newData.quoteId = newQuoteId;
            newData.status = QUOTE_STATUS.A_SAVED;

            // [Scheme B] STRIP payments from the new quote's metadata.
            // Payments live exclusively in accounting_ledgers keyed by the Base ID.
            // The corrected quote document must NOT carry a payments clone.
            if (newData.metadata) {
                delete newData.metadata.payments;
            }

            const oldQuoteId = currentId;
            const batch = writeBatch(db);

            // 1. Mark old quote as cancelled
            const oldDocRef = doc(db, 'quotes', oldQuoteId);
            batch.update(oldDocRef, { status: QUOTE_STATUS.X_CANCELLED });

            // 2. [Scheme B] Update the MASTER LEDGER (keyed by baseId) with the new total and
            //    link it to the new corrected quoteId. DO NOT copy or insert new payment records.
            const grandTotal = parseFloat(newData.f2Snapshot?.grandTotal || 0);
            const masterLedgerRef = doc(db, 'accounting_ledgers', baseId);
            batch.set(masterLedgerRef, {
                latestQuoteId: newQuoteId,
                totalAmount: grandTotal,
                status: QUOTE_STATUS.A_SAVED,
                lastUpdated: new Date().toISOString()
            }, { merge: true });

            // Commit Batch
            await batch.commit();

            this.stateService.dispatch(quoteActions.setQuoteData(newData));
            this.stateService.dispatch({ type: 'ui/setCorrectionMode', payload: { isCorrectionMode: false } });
            this.fileService.saveToJson(newData);

            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: `Correction saved! New Order: ${newQuoteId}. Old Order: ${oldQuoteId} Cancelled.`, type: 'info'
            });
        } catch (error) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: `Correction failed: ${error.message}`, type: 'error' });
        }
    }

    async handleSaveAsNewVersion() {
        const authResult = await this.authService.verifyAuthentication();
        let skipCloudSave = false;

        if (!authResult.success) {
            if (authResult.reason === 'blocked') {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: authResult.message, type: 'error' });
                skipCloudSave = true;
            } else {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: authResult.message, type: 'error' });
                await this.authService.logout();
                return;
            }
        }

        const dataToSave = this._getQuoteDataWithSnapshots();
        const currentId = dataToSave.quoteId || `RB${new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14)}`;
        const versionRegex = /-v(\d+)$/;
        const match = currentId.match(versionRegex);
        let newQuoteId = match ? currentId.replace(versionRegex, `-v${parseInt(match[1], 10) + 1}`) : `${currentId}-v2`;

        dataToSave.quoteId = newQuoteId;
        dataToSave.status = QUOTE_STATUS.A_SAVED;

        let cloudSaveSuccess = false;
        let errorMessage = '';
        if (!skipCloudSave) {
            try {
                const result = await saveQuoteToCloud(dataToSave);
                if (result.success) {
                    cloudSaveSuccess = true;
                } else {
                    errorMessage = result.message;
                }
            } catch (error) {
                errorMessage = error.message;
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: `Cloud save error: ${errorMessage}. Proceeding to local save only.`, type: 'error',
                });
            }
        }

        if (cloudSaveSuccess) {
            this.stateService.dispatch(quoteActions.setQuoteData(dataToSave));
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { 
                message: `Saved as new version: ${newQuoteId}`, type: 'info' 
            });
        } else {
            const finalMsg = skipCloudSave ? 'Cloud Offline. Versioning aborted.' : `Save Failed: ${errorMessage || 'Cloud rejected the request.'}`;
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: finalMsg, type: 'error' });
        }
    }

    handleExportCSV() {
        const result = this.fileService.exportToCsv(this._getQuoteDataWithSnapshots());
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: result.message, type: result.success ? 'info' : 'error' });
    }

    async handleGenerateExcel() {
        try {
            const { quoteData, ui } = this.stateService.getState();
            await this.excelExportService.generateExcel(quoteData, ui);
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Excel file generated and downloaded.', type: 'info' });
        } catch (error) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Failed to generate Excel file. See console for details.', type: 'error' });
        }
    }

    // [DIRECTIVE-v3.11] Scheme B Pipeline Rebuild
    // Single Source of Truth: Writes ONLY to accounting_ledgers, and initializes the ledger
    // with the baseline financial data (totalAmount) to prevent $0 totals on receipt generation.
    async handleRegisterPayment(quoteId, paymentPayload) {
        try {
            const userEmail = (this.authService && this.authService.currentUser) ? this.authService.currentUser.email : 'Unknown';
            const paymentRecord = {
                id: 'pay_' + Date.now(),
                amount: paymentPayload.amount,
                date: paymentPayload.date,
                method: paymentPayload.method,
                createdBy: userEmail,
                timestamp: new Date().toISOString()
            };

            const currentState = this.stateService.getState();
            const { quoteData } = currentState;
            // [DIRECTIVE-v3.13 & v3.14] Secure Ledger Initialization Math (Add GST)
            const currentGrandTotal = quoteData.f2Snapshot?.grandTotal || currentState.ui?.f2?.grandTotal || (currentState.ui?.f2?.newOffer ? currentState.ui.f2.newOffer * 1.1 : 0);

            // [Scheme B] Always write to the BASE ledger ID (Master Ledger).
            const baseLedgerId = this._getBaseLedgerId(quoteId);
            const ledgerRef = doc(db, "accounting_ledgers", baseLedgerId);
            
            // 🎯 INITIALIZE BASE PRICE & APPEND HISTORY
            const ledgerPayload = {
                latestQuoteId: quoteData.quoteId, 
                totalAmount: currentGrandTotal,   
                status: quoteData.status,
                lastUpdated: new Date().toISOString(),
                payments: arrayUnion(paymentRecord) 
            };

            await setDoc(ledgerRef, ledgerPayload, { merge: true });

            // [REMOVED] Deprecated dual-write to 'quotes' collection is fully severed.

            // 3. Update local state immediately for UI reactivity
            const currentMetadata = currentState.quoteData.metadata || {};
            const updatedPayments = [...(currentMetadata.payments || []), paymentRecord];
            const updatedMetadata = { ...currentMetadata, payments: updatedPayments };

            this.stateService.dispatch(quoteActions.updateQuoteProperty('metadata', updatedMetadata));

            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                type: 'info',
                message: `✅ Payment of $${paymentPayload.amount} registered successfully.`
            });
        } catch (error) {
            // [DIRECTIVE-v3.10] F4 Payment Error Diagnostic Probe
            console.error("🚨 [FIRESTORE WRITE FAILURE] Exact Error:", error.code, error.message, error);

            if (error.code === 'permission-denied') {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { 
                    type: 'warning', 
                    message: `Failed to save: permission-denied (Ledger strictly locked).` 
                });
            } else {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { 
                    type: 'error', 
                    message: `Failed to save: ${error.code || 'unknown-error'}` 
                });
            }
        }
    }

    /**
     * [Scheme B] Live-fetches the Master Ledger from Firestore for a given quoteId.
     * Resolves versioned IDs to the Base Ledger ID automatically.
     * Returns { totalAmount, payments, totalPaid, balanceDue, exists }.
     * @param {string} quoteId
     */
    async getLiveLedger(quoteId) {
        const baseLedgerId = this._getBaseLedgerId(quoteId);
        const ledgerRef = doc(db, 'accounting_ledgers', baseLedgerId);
        try {
            const snap = await getDoc(ledgerRef);
            if (!snap.exists()) {
                return { exists: false, totalAmount: 0, payments: [], totalPaid: 0, balanceDue: 0 };
            }
            const data = snap.data();
            const payments = Array.isArray(data.payments) ? data.payments : [];
            const totalAmount = parseFloat(data.totalAmount || 0);
            const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            const balanceDue = Math.max(0, totalAmount - totalPaid);
            return { exists: true, totalAmount, payments, totalPaid, balanceDue };
        } catch (err) {
            console.warn('[getLiveLedger] Firestore read failed, returning zeroed ledger.', err);
            return { exists: false, totalAmount: 0, payments: [], totalPaid: 0, balanceDue: 0 };
        }
    }

    async updateQuoteStatusOnly(quoteId, newStatus) {
        try {
            const docRef = doc(db, "quotes", quoteId);
            await updateDoc(docRef, { status: newStatus });
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { type: 'info', message: `Status partially updated to: ${newStatus}` });
            return true;
        } catch (error) {
            if (error.code === 'not-found') {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { type: 'warning', message: 'Please Save (💾) this order at least once before updating its status.' });
            } else if (error.code === 'permission-denied') {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { type: 'warning', message: 'No administrative clearance to modify this state. Attempt suppressed.' });
            } else {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { type: 'error', message: 'Failed to update status. Please check connection.' });
                throw error;
            }
            return false;
        }
    }

    async handleUpdateStatus({ newStatus }) {
        this.stateService.dispatch(quoteActions.updateQuoteProperty('status', newStatus));
        const dataToSave = this._getQuoteDataWithSnapshots();
        try {
            const result = await saveQuoteToCloud(dataToSave);
            if (result.success) {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: `Status updated to: ${newStatus}`, type: 'info' });
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: `Status update failed: ${error.message || 'Network Error'}`, type: 'error' });
            throw error;
        }
    }

    async handleCancelOrder({ cancelReason }) {
        this.stateService.dispatch(quoteActions.updateQuoteProperty('status', QUOTE_STATUS.X_CANCELLED));
        const currentMetadata = this.stateService.getState().quoteData.metadata || {};
        const newMetadata = { ...currentMetadata, cancelReason: cancelReason, cancelDate: new Date().toISOString() };
        this.stateService.dispatch(quoteActions.updateQuoteProperty('metadata', newMetadata));

        const dataToSave = this._getQuoteDataWithSnapshots();
        try {
            const result = await saveQuoteToCloud(dataToSave);
            if (result.success) {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Order has been CANCELLED.', type: 'info' });
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: `Cancellation failed: ${error.message || 'Network Error'}`, type: 'error' });
            throw error;
        }
    }

    /**
     * [NEW] (Phase II.1) Soft Delete: 將報價單標記為 isDeleted: true，
     * 但保留原始數據於 Firestore 中。
     * @param {string} quoteId 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async softDeleteQuote(quoteId) {
        try {
            const docRef = doc(db, 'quotes', quoteId);
            await updateDoc(docRef, { isDeleted: true });
            console.log(`🗑️ [Admin] Quote ${quoteId} soft-deleted (flagged).`);
            return { success: true };
        } catch (e) {
            console.error(`❌ [Admin] Soft delete failed for ${quoteId}:`, e);
            return { success: false, error: e.message };
        }
    }

    /**
     * [NEW] (Phase II.1) Hard Delete: 使用批量寫入 (Batch) 永久從 Firestore 中移除文件。
     * 強烈建議僅由 God Mode 管理員操作。
     * @param {Array<string>} quoteIdArray 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async hardDeleteQuotes(quoteIdArray) {
        if (!Array.isArray(quoteIdArray) || quoteIdArray.length === 0) return { success: true };
        
        const batch = writeBatch(db);
        quoteIdArray.forEach(id => {
            const docRef = doc(db, 'quotes', id);
            batch.delete(docRef);
        });

        try {
            await batch.commit();
            console.log(`🔥 [Admin] Hard deleted ${quoteIdArray.length} quotes from Firestore.`);
            return { success: true };
        } catch (e) {
            console.error('❌ [Admin] Hard delete batch commit failed:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * [NEW] Phase II.2.6: Batch Soft Delete using writeBatch for performance.
     * @param {Array<string>} quoteIdArray 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async batchSoftDeleteQuotes(quoteIdArray) {
        if (!Array.isArray(quoteIdArray) || quoteIdArray.length === 0) return { success: true };
        
        const batch = writeBatch(db);
        quoteIdArray.forEach(id => {
            const docRef = doc(db, 'quotes', id);
            batch.update(docRef, { isDeleted: true });
        });

        try {
            await batch.commit();
            console.log(`🗑️ [Admin] Batch soft-deleted ${quoteIdArray.length} quotes.`);
            return { success: true };
        } catch (e) {
            console.error('❌ [Admin] Batch soft-delete commit failed:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * [NEW] (Phase II.3) Restore: 將報價單恢復為未刪除狀態 (isDeleted: false)。
     * @param {string} quoteId 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async restoreQuote(quoteId) {
        try {
            const docRef = doc(db, 'quotes', quoteId);
            await updateDoc(docRef, { isDeleted: false });
            console.log(`✅ [Admin] Quote ${quoteId} restored.`);
            return { success: true };
        } catch (e) {
            console.error(`❌ [Admin] Restoration failed for ${quoteId}:`, e);
            return { success: false, error: e.message };
        }
    }

    /**
     * [NEW] (Phase II.3) Batch Restore: 使用 writeBatch 批量恢復報價單。
     * @param {Array<string>} quoteIdArray 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async batchRestoreQuotes(quoteIdArray) {
        if (!Array.isArray(quoteIdArray) || quoteIdArray.length === 0) return { success: true };
        
        const batch = writeBatch(db);
        quoteIdArray.forEach(id => {
            const docRef = doc(db, 'quotes', id);
            batch.update(docRef, { isDeleted: false });
        });

        try {
            await batch.commit();
            console.log(`✅ [Admin] Batch restored ${quoteIdArray.length} quotes.`);
            return { success: true };
        } catch (e) {
            console.error('❌ [Admin] Batch restore commit failed:', e);
            return { success: false, error: e.message };
        }
    }
}

/**
 * [NEW] (Phase II.1 Standalone) Soft Delete function for modular UI access.
 */
export async function softDeleteQuote(quoteId) {
    try {
        const docRef = doc(db, 'quotes', quoteId);
        await updateDoc(docRef, { isDeleted: true });
        console.log(`🗑️ [Admin] Quote ${quoteId} soft-deleted (flagged).`);
        return { success: true };
    } catch (e) {
        console.error(`❌ [Admin] Soft delete failed for ${quoteId}:`, e);
        return { success: false, error: e.message };
    }
}

/**
 * [NEW] (Phase II.3 Standalone) Restore function for modular UI access.
 */
export async function restoreQuote(quoteId) {
    try {
        const docRef = doc(db, 'quotes', quoteId);
        await updateDoc(docRef, { isDeleted: false });
        console.log(`✅ [Admin] Quote ${quoteId} restored.`);
        return { success: true };
    } catch (e) {
        console.error(`❌ [Admin] Restoration failed for ${quoteId}:`, e);
        return { success: false, error: e.message };
    }
}

/**
 * [NEW] (Phase II.1 Standalone) Hard Delete function for modular UI access.
 */
export async function hardDeleteQuotes(quoteIdArray) {
    if (!Array.isArray(quoteIdArray) || quoteIdArray.length === 0) return { success: true };
    
    const batch = writeBatch(db);
    quoteIdArray.forEach(id => {
        const docRef = doc(db, 'quotes', id);
        batch.delete(docRef);
    });

    try {
        await batch.commit();
        console.log(`🔥 [Admin] Hard deleted ${quoteIdArray.length} quotes from Firestore.`);
        return { success: true };
    } catch (e) {
        console.error('❌ [Admin] Hard delete batch commit failed:', e);
        return { success: false, error: e.message };
    }
}

/**
 * [NEW] (Phase II.2.6 Standalone) Batch Soft Delete function for modular UI access.
 */
export async function batchSoftDeleteQuotes(quoteIdArray) {
    if (!Array.isArray(quoteIdArray) || quoteIdArray.length === 0) return { success: true };
    
    const batch = writeBatch(db);
    quoteIdArray.forEach(id => {
        const docRef = doc(db, 'quotes', id);
        batch.update(docRef, { isDeleted: true });
    });

    try {
        await batch.commit();
        console.log(`🗑️ [Admin] Batch soft-deleted ${quoteIdArray.length} quotes.`);
        return { success: true };
    } catch (e) {
        console.error('❌ [Admin] Batch soft-delete commit failed:', e);
        return { success: false, error: e.message };
    }
}

/**
 * [NEW] (Phase II.3 Standalone) Batch Restore function for modular UI access.
 */
export async function batchRestoreQuotes(quoteIdArray) {
    if (!Array.isArray(quoteIdArray) || quoteIdArray.length === 0) return { success: true };
    
    const batch = writeBatch(db);
    quoteIdArray.forEach(id => {
        const docRef = doc(db, 'quotes', id);
        batch.update(docRef, { isDeleted: false });
    });

    try {
        await batch.commit();
        console.log(`✅ [Admin] Batch restored ${quoteIdArray.length} quotes.`);
        return { success: true };
    } catch (e) {
        console.error('❌ [Admin] Batch restore commit failed:', e);
        return { success: false, error: e.message };
    }
}