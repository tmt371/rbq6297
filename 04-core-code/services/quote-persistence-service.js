/* FILE: 04-core-code/services/quote-persistence-service.js */
// [NEW] (v6297) ?段 1：建立新檔æ?以實?æ?久å?
// [MODIFIED] (¬?1 次編¿? ?儲存方法中?入 authService.verifyAuthentication() 驗è?
// [MODIFIED] (¬?11 次編¿? ?å? 'blocked' ?誤，é?級為警å?並繼續執行本?儲存€?
// [MODIFIED] (F4 Status Phase 3) Added handleUpdateStatus logic.

// [MODIFIED] ¾?workflow-service.js 移入此è?
import {
    saveQuoteToCloud,
} from './online-storage-service.js';
import { EVENTS } from '../config/constants.js';
import * as quoteActions from '../actions/quote-actions.js'; // [NEW] 複製依賴

/**
 * @fileoverview A new service dedicated to data persistence.
 * This service handles saving, loading, snapshotting, and exporting data.
 * It will be the future home for accounting integration logic.
 */
export class QuotePersistenceService {
    constructor({
        eventAggregator,
        stateService,
        fileService,
        authService,
        // [NEW] 複製 _getQuoteDataWithSnapshots ?€?€?ä?³?
        calculationService,
        configManager,
        productFactory
    }) {
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.fileService = fileService;
        this.authService = authService;
        this.calculationService = calculationService;
        this.configManager = configManager;
        this.productFactory = productFactory;

        console.log('QuotePersistenceService Initialized.');
    }


    // [MOVED] ¾?workflow-service.js 移入
    _getQuoteDataWithSnapshots() {
        const { quoteData, ui } = this.stateService.getState();
        // Create a deep copy to avoid mutating the original state
        let dataWithSnapshot = JSON.parse(JSON.stringify(quoteData));

        // --- [NEW] (v6297) 0. Capture Owner UID ---
        // [FIX] Check for authService AND authService.currentUser
        if (this.authService && this.authService.currentUser) {
            dataWithSnapshot.ownerUid = this.authService.currentUser.uid;
        } else {
            console.error("WorkflowService: Cannot save. AuthService is missing or user is not logged in.");
            // We still proceed, but the ownerUid will be null.
            // Our Firestore rules (which we will update later) will block this.
        }

        // --- [NEW] (v6298-F4-Search) 1. Calculate and Capture Metadata ---
        const items = quoteData.products[quoteData.currentProduct].items;
        const hasMotor = items.some(item => !!item.motor);

        // Ensure metadata object exists (it was just added to initialState)
        if (!dataWithSnapshot.metadata) {
            dataWithSnapshot.metadata = {};
        }
        dataWithSnapshot.metadata.hasMotor = hasMotor;


        // --- 2. Capture F1 Snapshot (from Phase 4) ---
        if (dataWithSnapshot.f1Snapshot) {
            // const items =
            //     quoteData.products[quoteData.currentProduct].items;

            dataWithSnapshot.f1Snapshot.winder_qty = items.filter(
                (item) => item.winder === 'HD'
            ).length;
            dataWithSnapshot.f1Snapshot.motor_qty = items.filter(
                (item) => !!item.motor
            ).length;
            dataWithSnapshot.f1Snapshot.charger_qty =
                ui.driveChargerCount || 0;
            dataWithSnapshot.f1Snapshot.cord_qty = ui.driveCordCount || 0;

            const totalRemoteQty = ui.driveRemoteCount || 0;
            const remote1chQty = ui.f1.remote_1ch_qty;
            const remote16chQty =
                ui.f1.remote_1ch_qty === null
                    ? totalRemoteQty - remote1chQty
                    : ui.f1.remote_16ch_qty;

            const totalDualPairs = Math.floor(
                items.filter((item) => item.dual === 'D').length / 2
            );
            const comboQty =
                ui.f1.dual_combo_qty === null
                    ? totalDualPairs
                    : ui.f1.dual_combo_qty;
            const slimQty =
                ui.f1.dual_slim_qty === null ? 0 : ui.f1.dual_slim_qty;
            dataWithSnapshot.f1Snapshot.remote_1ch_qty = remote1chQty;
            dataWithSnapshot.f1Snapshot.remote_16ch_qty = remote16chQty;
            dataWithSnapshot.f1Snapshot.dual_combo_qty = comboQty;
            dataWithSnapshot.f1Snapshot.dual_slim_qty = slimQty;
            dataWithSnapshot.f1Snapshot.discountPercentage =
                ui.f1.discountPercentage;

            // [NEW] (v6295) Fix omission: Save F1 Wifi Qty
            dataWithSnapshot.f1Snapshot.wifi_qty = ui.f1.wifi_qty || 0;
        } else {
            console.error(
                'f1Snapshot object is missing from quoteData. Cannot save F1 state.'
            );
        }

        // --- 3. Capture F3 Snapshot (NEW Phase 5) ---
        // [REMOVED] No longer need to read from DOM. All data (quoteId, issueDate, customer, notes)
        // is already present in the `dataWithSnapshot` object because F3 view updates state live.

        // --- 4. [NEW] (v6295) Capture F2 Snapshot ---
        // Save the entire F2 state object
        dataWithSnapshot.f2Snapshot = JSON.parse(JSON.stringify(ui.f2));

        // --- 5. [NEW] (HOTFIX Tweak 3) Add/Update creationDate ---
        // This ensures every save action (overwrite or new version) updates the timestamp.
        dataWithSnapshot.creationDate = new Date().toISOString();

        return dataWithSnapshot;
    }

    // [MOVED] ¾?workflow-service.js 移入
    // [MODIFIED] (¬?1 次編¿? ?入 authService.verifyAuthentication()
    // [MODIFIED] (¬?11 次編¿? ?å? 'blocked' ?誤?特殊è??ï?不中?本?儲­?
    async handleSaveToFile() {
        const authResult = await this.authService.verifyAuthentication();
        let skipCloudSave = false;

        if (!authResult.success) {
            if (authResult.reason === 'blocked') {
                // [NEW] 如æ??被?æ? (Config/Network Error)，顯示警?ä?繼ç??è??地?å?
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: authResult.message, // e.g., "Cloud connection failed..."
                    type: 'error', // or warning
                });
                console.warn("Cloud save skipped due to network/config block. Proceeding to local save.");
                skipCloudSave = true;
            } else {
                // [NEW] 如æ??其他å???(例å? token ?æ?)，å??è??æ??登?è?中斷?輯
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: authResult.message,
                    type: 'error',
                });
                await this.authService.logout();
                return;
            }
        }

        const dataToSave = this._getQuoteDataWithSnapshots();

        // --- [NEW] (v6298-fix-6) Robust Firebase Save ---
        // [MODIFIED] (¬?11 次編¿? 如æ?被æ?記為 skipCloudSave，å?跳é??端?å?
        if (!skipCloudSave) {
            try {
                await saveQuoteToCloud(dataToSave);
            } catch (error) {
                console.error("WorkflowService: Cloud save failed, but proceeding to local save.", error);
            }
        }
        // --- [END NEW] ---

        const result = this.fileService.saveToJson(dataToSave);
        const notificationType = result.success ? 'info' : 'error';
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: result.message,
            type: notificationType,
        });
    }

    // [MOVED] ¾?workflow-service.js 移入
    // [MODIFIED] (¬?1 次編¿? ?入 authService.verifyAuthentication()
    // [MODIFIED] (¬?11 次編¿? ?å? 'blocked' ?誤?特殊è??ï?不中?本?儲­?
    async handleSaveAsNewVersion() {
        const authResult = await this.authService.verifyAuthentication();
        let skipCloudSave = false;

        if (!authResult.success) {
            if (authResult.reason === 'blocked') {
                // [NEW] ?å? Blocked，顯示警?ä?繼ç?
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: authResult.message,
                    type: 'error',
                });
                console.warn("Cloud save skipped due to network/config block. Proceeding to local save.");
                skipCloudSave = true;
            } else {
                // ?å? Expired，登?並?止
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: authResult.message,
                    type: 'error',
                });
                await this.authService.logout();
                return;
            }
        }

        // 1. Get the current data, with all snapshots and a NEW creationDate
        const dataToSave = this._getQuoteDataWithSnapshots();

        // 2. Generate the new versioned quoteId
        const currentId = dataToSave.quoteId || `RB${new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14)}`;

        // Regex to find a version suffix like "-v2"
        const versionRegex = /-v(\d+)$/;
        const match = currentId.match(versionRegex);

        let newQuoteId;
        if (match) {
            // If it has a version (e.g., "-v2"), increment it
            const currentVersion = parseInt(match[1], 10);
            const newVersion = currentVersion + 1;
            // Replace the old suffix with the new one
            newQuoteId = currentId.replace(versionRegex, `-v${newVersion}`);
        } else {
            // If it has no version, add "-v2" (Start with v2, as v1 is the original)
            newQuoteId = `${currentId}-v2`;
        }

        // 3. Update the data object with the new ID
        dataToSave.quoteId = newQuoteId;

        // 4. Save to both cloud (new document) and local (new file)
        let cloudSaveSuccess = false;
        // [MODIFIED] (¬?11 次編¿? 檢查 skipCloudSave
        if (!skipCloudSave) {
            try {
                await saveQuoteToCloud(dataToSave);
                cloudSaveSuccess = true;
            } catch (error) {
                console.error("WorkflowService: Cloud save (new version) failed, but proceeding to local save.", error);
            }
        }

        const localSaveResult = this.fileService.saveToJson(dataToSave);

        // 5. Dispatch to update the app's state to this new version
        this.stateService.dispatch(quoteActions.setQuoteData(dataToSave));

        // 6. Notify user
        let message;
        if (skipCloudSave) {
            message = `Saved LOCALLY as: ${newQuoteId} (Cloud Offline)`;
        } else {
            message = cloudSaveSuccess
                ? `New version saved as: ${newQuoteId}`
                : `New version saved locally. Cloud save failed.`;
        }

        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: message,
            type: localSaveResult.success ? 'info' : 'error',
        });
    }

    // [MOVED] ¾?workflow-service.js 移入
    handleExportCSV() {
        const dataToExport = this._getQuoteDataWithSnapshots();
        const result = this.fileService.exportToCsv(dataToExport);
        const notificationType = result.success ? 'info' : 'error';
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: result.message,
            type: notificationType,
        });
    }

    /**
     * [NEW] (F4 Status Phase 3) Updates only the status of the quote and saves to cloud.
     * @param {object} payload
     * @param {string} payload.newStatus The new status string.
     */
    async handleUpdateStatus({ newStatus }) {
        // 1. 立即更新本地 state，使 UI 保持同步
        this.stateService.dispatch(quoteActions.updateQuoteProperty('status', newStatus));

        // 2. 獲取包含新 status 和新 creationDate 的快照
        // Note: _getQuoteDataWithSnapshots() automatically updates 'creationDate' to now.
        const dataToSave = this._getQuoteDataWithSnapshots();

        try {
            // 3. 儲存到火店
            // We explicitly want to save to the cloud here to share the status update.
            // We do NOT save to local file to avoid annoying download prompts for just a status change.
            const result = await saveQuoteToCloud(dataToSave);

            if (result.success) {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: `Status updated to: ${newStatus}`,
                    type: 'info'
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error("WorkflowService: Status update save failed.", error);
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: `Status update failed: ${error.message}`,
                type: 'error'
            });
            // Optional: Revert local state if needed, but current flow keeps UI optimistic.
        }
    }
}