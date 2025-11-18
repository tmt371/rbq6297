/* FILE: 04-core-code/services/quote-persistence-service.js */
// [NEW] (v6297) 階段 1：建立新檔案以實現持久化
// [MODIFIED] (第 1 次編修) 在儲存方法中加入 authService.verifyAuthentication() 驗證

// [MODIFIED] 從 workflow-service.js 移入此處
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
        // [NEW] 複製 _getQuoteDataWithSnapshots 所需的依賴
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

    // [MOVED] 從 workflow-service.js 移入
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
        // const getValue = (id) => document.getElementById(id)?.value || '';
        // dataWithSnapshot.quoteId = getValue('f3-quote-id');
        // ... (all other getValue calls removed)

        // --- 4. [NEW] (v6295) Capture F2 Snapshot ---
        // Save the entire F2 state object
        dataWithSnapshot.f2Snapshot = JSON.parse(JSON.stringify(ui.f2));

        // --- 5. [NEW] (HOTFIX Tweak 3) Add/Update creationDate ---
        // This ensures every save action (overwrite or new version) updates the timestamp.
        dataWithSnapshot.creationDate = new Date().toISOString();

        return dataWithSnapshot;
    }

    // [MOVED] 從 workflow-service.js 移入
    // [MODIFIED] (第 1 次編修) 加入 authService.verifyAuthentication()
    async handleSaveToFile() {
        // [NEW] (第 1 次編修) 執行任何動作前，先驗證 token
        const authResult = await this.authService.verifyAuthentication();
        if (!authResult.success) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: authResult.message,
                type: 'error',
            });
            // 驗證失敗 (Token 過期)，強制登出並立即停止儲存
            await this.authService.logout();
            return;
        }
        // [END] (第 1 次編修)

        const dataToSave = this._getQuoteDataWithSnapshots();

        // --- [NEW] (v6298-fix-6) Robust Firebase Save ---
        // We wrap the cloud save in a try...catch block.
        // If it fails (e.g., Ad Blocker, no permissions, no internet),
        // we log the error but *do not* stop the function.
        // This ensures the local save will *always* be attempted.
        try {
            await saveQuoteToCloud(dataToSave);
        } catch (error) {
            // saveQuoteToCloud already logs its own friendly error
            console.error("WorkflowService: Cloud save failed, but proceeding to local save.", error);
        }
        // --- [END NEW] ---

        const result = this.fileService.saveToJson(dataToSave);
        const notificationType = result.success ? 'info' : 'error';
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: result.message,
            type: notificationType,
        });
    }

    // [MOVED] 從 workflow-service.js 移入
    // [MODIFIED] (第 1 次編修) 加入 authService.verifyAuthentication()
    async handleSaveAsNewVersion() {
        // [NEW] (第 1 次編修) 執行任何動作前，先驗證 token
        const authResult = await this.authService.verifyAuthentication();
        if (!authResult.success) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: authResult.message,
                type: 'error',
            });
            // 驗證失敗 (Token 過期)，強制登出並立即停止儲存
            await this.authService.logout();
            return;
        }
        // [END] (第 1 次編修)

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
        try {
            await saveQuoteToCloud(dataToSave);
            cloudSaveSuccess = true;
        } catch (error) {
            console.error("WorkflowService: Cloud save (new version) failed, but proceeding to local save.", error);
        }

        const localSaveResult = this.fileService.saveToJson(dataToSave);

        // 5. Dispatch to update the app's state to this new version
        this.stateService.dispatch(quoteActions.setQuoteData(dataToSave));

        // 6. Notify user
        const message = cloudSaveSuccess
            ? `New version saved as: ${newQuoteId}`
            : `New version saved locally. Cloud save failed.`;

        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: message,
            type: localSaveResult.success ? 'info' : 'error',
        });
    }

    // [MOVED] 從 workflow-service.js 移入
    handleExportCSV() {
        const dataToExport = this._getQuoteDataWithSnapshots();
        const result = this.fileService.exportToCsv(dataToExport);
        const notificationType = result.success ? 'info' : 'error';
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: result.message,
            type: notificationType,
        });
    }
}