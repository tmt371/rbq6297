/* FILE: 04-core-code/services/quote-persistence-service.js */

import { saveQuoteToCloud } from './online-storage-service.js';
import { db } from '../config/firebase-config.js';
import { writeBatch, doc } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js';
import { EVENTS } from '../config/constants.js';
import * as quoteActions from '../actions/quote-actions.js';
import { QUOTE_STATUS } from '../config/status-config.js';

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
        calculationService,
        configManager,
        productFactory,
        excelExportService
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

    _getQuoteDataWithSnapshots() {
        const { quoteData, ui } = this.stateService.getState();
        let dataWithSnapshot = JSON.parse(JSON.stringify(quoteData));

        if (this.authService && this.authService.currentUser) {
            dataWithSnapshot.ownerUid = this.authService.currentUser.uid;
        } else {
            console.error("WorkflowService: Cannot save. AuthService is missing or user is not logged in.");
        }

        const items = quoteData.products[quoteData.currentProduct].items;
        const hasMotor = items.some(item => !!item.motor);

        if (!dataWithSnapshot.metadata) {
            dataWithSnapshot.metadata = {};
        }
        dataWithSnapshot.metadata.hasMotor = hasMotor;

        if (dataWithSnapshot.f1Snapshot) {
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

            dataWithSnapshot.f1Snapshot.wifi_qty = ui.f1.wifi_qty || 0;

            dataWithSnapshot.f1Snapshot.w_motor_qty = ui.f1.w_motor_qty || 0;

        } else {
            console.error(
                'f1Snapshot object is missing from quoteData. Cannot save F1 state.'
            );
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
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: authResult.message,
                    type: 'error',
                });
                console.warn("Cloud save skipped due to network/config block. Proceeding to local save.");
                skipCloudSave = true;
            } else {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: authResult.message,
                    type: 'error',
                });
                await this.authService.logout();
                return;
            }
        }

        const currentState = this.stateService.getState();
        const { isCorrectionMode } = currentState.ui;
        const currentStatus = currentState.quoteData.status;

        if (isCorrectionMode) {
            return this.handleCorrectionSave();
        }

        const isLocked = currentStatus && currentStatus !== QUOTE_STATUS.A_ARCHIVED && currentStatus !== "Configuring";

        if (isLocked) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Order is established and LOCKED. Please use "Cancel / Correct" to make changes.',
                type: 'error'
            });
            return;
        }

        const dataToSave = this._getQuoteDataWithSnapshots();

        if (!skipCloudSave) {
            try {
                await saveQuoteToCloud(dataToSave);
            } catch (error) {
                console.error("WorkflowService: Cloud save failed, but proceeding to local save.", error);
            }
        }

        const result = this.fileService.saveToJson(dataToSave);
        const notificationType = result.success ? 'info' : 'error';
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: result.message,
            type: notificationType,
        });
    }

    async handleCorrectionSave() {
        try {
            const newData = this._getQuoteDataWithSnapshots();

            const currentId = newData.quoteId;
            const versionRegex = /-v(\d+)$/;
            const match = currentId.match(versionRegex);
            let newQuoteId;
            if (match) {
                const currentVersion = parseInt(match[1], 10);
                const newVersion = currentVersion + 1;
                newQuoteId = currentId.replace(versionRegex, `-v${newVersion}`);
            } else {
                newQuoteId = `${currentId}-v2`;
            }

            newData.quoteId = newQuoteId;
            newData.status = QUOTE_STATUS.A_ARCHIVED;

            const oldQuoteId = currentId;

            const batch = writeBatch(db);

            const newDocRef = doc(db, 'quotes', newQuoteId);
            batch.set(newDocRef, newData);

            const oldDocRef = doc(db, 'quotes', oldQuoteId);
            batch.update(oldDocRef, {
                status: QUOTE_STATUS.X_CANCELLED,
            });

            await batch.commit();

            console.log(`Correction successful: ${oldQuoteId} cancelled, ${newQuoteId} created.`);

            this.stateService.dispatch(quoteActions.setQuoteData(newData));
            this.stateService.dispatch({ type: 'ui/setCorrectionMode', payload: { isCorrectionMode: false } });

            this.fileService.saveToJson(newData);

            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: `Correction saved! New Order: ${newQuoteId}. Old Order: ${oldQuoteId} Cancelled.`,
                type: 'info'
            });

        } catch (error) {
            console.error("Correction Save Failed:", error);
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: `Correction failed: ${error.message}`,
                type: 'error'
            });
        }
    }

    async handleSaveAsNewVersion() {
        const authResult = await this.authService.verifyAuthentication();
        let skipCloudSave = false;

        if (!authResult.success) {
            if (authResult.reason === 'blocked') {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: authResult.message,
                    type: 'error',
                });
                console.warn("Cloud save skipped due to network/config block. Proceeding to local save.");
                skipCloudSave = true;
            } else {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: authResult.message,
                    type: 'error',
                });
                await this.authService.logout();
                return;
            }
        }

        const dataToSave = this._getQuoteDataWithSnapshots();

        const currentId = dataToSave.quoteId || `RB${new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14)}`;
        const versionRegex = /-v(\d+)$/;
        const match = currentId.match(versionRegex);

        let newQuoteId;
        if (match) {
            const currentVersion = parseInt(match[1], 10);
            const newVersion = currentVersion + 1;
            newQuoteId = currentId.replace(versionRegex, `-v${newVersion}`);
        } else {
            newQuoteId = `${currentId}-v2`;
        }

        dataToSave.quoteId = newQuoteId;
        dataToSave.status = QUOTE_STATUS.A_ARCHIVED;

        let cloudSaveSuccess = false;
        if (!skipCloudSave) {
            try {
                await saveQuoteToCloud(dataToSave);
                cloudSaveSuccess = true;
            } catch (error) {
                console.error("WorkflowService: Cloud save (new version) failed, but proceeding to local save.", error);
            }
        }

        const localSaveResult = this.fileService.saveToJson(dataToSave);

        this.stateService.dispatch(quoteActions.setQuoteData(dataToSave));

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

    handleExportCSV() {
        const dataToExport = this._getQuoteDataWithSnapshots();
        const result = this.fileService.exportToCsv(dataToExport);
        const notificationType = result.success ? 'info' : 'error';
        this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
            message: result.message,
            type: notificationType,
        });
    }

    async handleGenerateExcel() {
        try {
            const { quoteData, ui } = this.stateService.getState();
            await this.excelExportService.generateExcel(quoteData, ui);

            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Excel file generated and downloaded.',
                type: 'info',
            });
        } catch (error) {
            console.error('Error generating Excel:', error);
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: 'Failed to generate Excel file. See console for details.',
                type: 'error',
            });
        }
    }

    async handleUpdateStatus({ newStatus }) {
        this.stateService.dispatch(quoteActions.updateQuoteProperty('status', newStatus));

        const dataToSave = this._getQuoteDataWithSnapshots();

        try {
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
        }
    }

    async handleCancelOrder({ cancelReason }) {
        this.stateService.dispatch(quoteActions.updateQuoteProperty('status', QUOTE_STATUS.X_CANCELLED));

        const currentMetadata = this.stateService.getState().quoteData.metadata || {};
        const newMetadata = { ...currentMetadata, cancelReason: cancelReason };
        this.stateService.dispatch(quoteActions.updateQuoteProperty('metadata', newMetadata));

        const dataToSave = this._getQuoteDataWithSnapshots();

        try {
            const result = await saveQuoteToCloud(dataToSave);

            if (result.success) {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                    message: 'Order has been CANCELLED.',
                    type: 'info'
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error("WorkflowService: Cancel order save failed.", error);
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: `Cancellation failed: ${error.message}`,
                type: 'error'
            });
        }
    }
}