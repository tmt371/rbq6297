/* FILE: 04-core-code/ui/views/k2-fabric-view.js */
// [MODIFIED] (Stage 9 Phase 3 - Constants) Replaced magic strings with FABRIC_CODES and LOGIC_CODES.

import { EVENTS, DOM_IDS } from '../../config/constants.js';
import * as uiActions from '../../actions/ui-actions.js';
import * as quoteActions from '../../actions/quote-actions.js';
import { FABRIC_CODES, LOGIC_CODES } from '../../config/business-constants.js'; // [NEW]

/**
 * @fileoverview A dedicated sub-view for handling all logic related to the K2 (Fabric) tab.
 */
export class K2FabricView {
    constructor({ stateService, eventAggregator }) {
        this.stateService = stateService;
        this.eventAggregator = eventAggregator;

        this.indexesToExcludeFromBatchUpdate = new Set();

        this.eventAggregator.subscribe(EVENTS.USER_REQUESTED_NC_DIALOG, () => this.handleNCDialogRequest());
        this.eventAggregator.subscribe(EVENTS.USER_REQUESTED_LF_DIALOG, () => this._showLFDialog());
        this.eventAggregator.subscribe(EVENTS.USER_REQUESTED_SSET_DIALOG, () => this._showSSetDialog());

        console.log("K2FabricView Initialized.");
    }

    _getState() {
        return this.stateService.getState();
    }

    _getItems() {
        const { quoteData } = this._getState();
        return quoteData.products[quoteData.currentProduct].items;
    }

    handleFocusModeRequest() {
        this._exitAllK2Modes();
    }

    handleSequenceCellClick({ rowIndex }) {
        const { activeEditMode } = this._getState().ui;
        const item = this._getItems()[rowIndex];
        if (!item || (item.width === null && item.height === null)) return;

        // [MODIFIED] Use constants for mode checks
        if (activeEditMode === LOGIC_CODES.MODE_LF_DEL) {
            const { lfModifiedRowIndexes } = this._getState().quoteData.uiMetadata;
            if (!lfModifiedRowIndexes.includes(rowIndex)) {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Only items with a Light-Filter setting (pink background) can be selected for deletion.', type: 'error' });
                return;
            }
            this.stateService.dispatch(uiActions.toggleLFSelection(rowIndex));

        } else if (activeEditMode === LOGIC_CODES.MODE_LF || activeEditMode === LOGIC_CODES.MODE_SSET) {
            this.stateService.dispatch(uiActions.toggleMultiSelectSelection(rowIndex));
        }
    }

    handleModeToggle({ mode }) {
        // [MODIFIED] Compare against constant values (which match the button ID parts or event data)
        if (mode === LOGIC_CODES.MODE_LF) {
            this._handleLFModeToggle();
        } else if (mode === LOGIC_CODES.MODE_LF_DEL) {
            this._handleLFDModeToggle();
        } else if (mode === LOGIC_CODES.MODE_SSET) {
            this._handleSSetModeToggle();
        }
    }

    _handleLFModeToggle() {
        const { activeEditMode } = this._getState().ui;

        // [MODIFIED] Use constant
        if (activeEditMode === LOGIC_CODES.MODE_LF) {
            const { multiSelectSelectedIndexes } = this._getState().ui;

            if (multiSelectSelectedIndexes.length === 0) {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'LF mode cancelled. No items selected.' });
                this._exitAllK2Modes();
                return;
            }

            this._showLFDialog();

        } else {
            const items = this._getItems();
            // [MODIFIED] Use FABRIC_CODES constants
            const eligibleTypes = [FABRIC_CODES.B2, FABRIC_CODES.B3, FABRIC_CODES.B4];
            const hasEligibleItems = items.some(item =>
                item.width && item.height && eligibleTypes.includes(item.fabricType)
            );

            if (!hasEligibleItems) {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'LF is only applicable for B2, B3, and B4 items.' });
                return;
            }

            this._exitAllK2Modes();
            // [MODIFIED] Dispatch constant value
            this.stateService.dispatch(uiActions.setActiveEditMode(LOGIC_CODES.MODE_LF));
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Please select items from the main table.' });
        }
    }

    _handleLFDModeToggle() {
        const { activeEditMode } = this._getState().ui;

        // [MODIFIED] Use constant
        if (activeEditMode === LOGIC_CODES.MODE_LF_DEL) {
            const { lfSelectedRowIndexes } = this._getState().ui;
            if (lfSelectedRowIndexes.length > 0) {
                this.stateService.dispatch(quoteActions.removeLFProperties(lfSelectedRowIndexes));
                this.stateService.dispatch(quoteActions.removeLFModifiedRows(lfSelectedRowIndexes));
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Light-Filter settings have been cleared.' });
            }
            this._exitAllK2Modes();
        } else {
            this._exitAllK2Modes();
            // [MODIFIED] Dispatch constant value
            this.stateService.dispatch(uiActions.setActiveEditMode(LOGIC_CODES.MODE_LF_DEL));
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Please select the roller blinds for which you want to cancel the Light-Filter fabric setting. After selection, click the LF-Del button again.' });
        }
    }

    _handleSSetModeToggle() {
        const { activeEditMode } = this._getState().ui;

        // [MODIFIED] Use constant
        if (activeEditMode === LOGIC_CODES.MODE_SSET) {
            const { multiSelectSelectedIndexes } = this._getState().ui;

            if (multiSelectSelectedIndexes.length === 0) {
                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'SSet mode cancelled. No items selected.' });
                this._exitAllK2Modes();
                return;
            }

            this._showSSetDialog();

        } else {
            this._exitAllK2Modes();
            // [MODIFIED] Dispatch constant value
            this.stateService.dispatch(uiActions.setActiveEditMode(LOGIC_CODES.MODE_SSET));
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Please select items from the main table.' });
        }
    }

    handleNCDialogRequest() {
        this.stateService.dispatch(uiActions.setModalActive(true));

        const { lfModifiedRowIndexes } = this._getState().quoteData.uiMetadata;
        const lfItemsExist = lfModifiedRowIndexes.length > 0;

        if (!lfItemsExist) {
            this._showNCDialog(false);
            return;
        }

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: 'This quote contains Light-Filter (LF) items. How would you like to proceed?',
            closeOnOverlayClick: false,
            gridTemplateColumns: '1fr 1fr',
            gap: '10px 10px',
            layout: [
                [
                    {
                        type: 'button',
                        text: 'Overwrite LF items (Update All)',
                        className: 'primary-confirm-button',
                        colspan: 1,
                        callback: () => {
                            this._showNCDialog(true);
                            return false;
                        }
                    },
                    {
                        type: 'button',
                        text: 'Preserve LF items (Update Non-LF Only)',
                        colspan: 1,
                        callback: () => {
                            this._showNCDialog(false);
                            return false;
                        }
                    }
                ],
                [
                    { type: 'text', text: '' },
                    {
                        type: 'button',
                        text: 'Cancel',
                        className: 'secondary',
                        colspan: 1,
                        callback: () => {
                            this.stateService.dispatch(uiActions.setModalActive(false));
                            return true;
                        }
                    }
                ]
            ]
        });
    }

    _showNCDialog(overwriteLF = false) {
        const items = this._getItems();
        const { lfModifiedRowIndexes } = this._getState().quoteData.uiMetadata;
        const indexesToExclude = overwriteLF ? new Set() : new Set(lfModifiedRowIndexes);

        const eligibleTypes = new Set();
        const typeData = {};

        items.forEach((item, index) => {
            if (item.width && item.height && item.fabricType) {
                if (!indexesToExclude.has(index)) {
                    eligibleTypes.add(item.fabricType);
                    if (!typeData[item.fabricType]) {
                        typeData[item.fabricType] = {
                            fabric: item.fabric || '',
                            color: item.color || ''
                        };
                    }
                }
            }
        });

        const sortedTypes = Array.from(eligibleTypes).sort();
        if (sortedTypes.length === 0) {
            const message = overwriteLF
                ? 'No items to overwrite.'
                : 'No non-LF items available to edit.';
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: message });
            this.stateService.dispatch(uiActions.setModalActive(false));
            return;
        }

        const layout = [];
        const inputIds = [];
        layout.push([
            { type: 'text', text: 'Type', className: 'font-bold text-right' },
            { type: 'text', text: 'F-Name', className: 'font-bold' },
            { type: 'text', text: 'F-Color', className: 'font-bold' },
        ]);

        sortedTypes.forEach(type => {
            const fNameId = `k2-dialog-fname-${type}`;
            const fColorId = `k2-dialog-fcolor-${type}`;
            layout.push([
                { type: 'text', text: type, className: 'text-right' },
                { type: 'input', id: fNameId, value: typeData[type].fabric, 'data-type': type, 'data-field': 'fabric', inputType: 'text', disableEnterConfirm: true },
                { type: 'input', id: fColorId, value: typeData[type].color, 'data-type': type, 'data-field': 'color', inputType: 'text', disableEnterConfirm: true },
            ]);
            inputIds.push(fNameId, fColorId);
        });

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: 'Batch Edit Fabric (N&C)',
            closeOnOverlayClick: false,
            gridTemplateColumns: '0.8fr 1.2fr 1.2fr',
            layout: [
                ...layout,
                [
                    {
                        type: 'button',
                        text: 'Confirm',
                        className: 'primary-confirm-button',
                        colspan: 2,
                        callback: () => {
                            try {
                                const { lfModifiedRowIndexes } = this._getState().quoteData.uiMetadata;
                                const finalIndexesToExclude = overwriteLF ? new Set() : new Set(lfModifiedRowIndexes);

                                sortedTypes.forEach(type => {
                                    const fName = document.getElementById(`k2-dialog-fname-${type}`).value;
                                    const fColor = document.getElementById(`k2-dialog-fcolor-${type}`).value;
                                    if (fName || fColor) {
                                        this.stateService.dispatch(quoteActions.batchUpdatePropertyByType(type, 'fabric', fName, finalIndexesToExclude));
                                        this.stateService.dispatch(quoteActions.batchUpdatePropertyByType(type, 'color', fColor, finalIndexesToExclude));
                                    }
                                });

                                if (overwriteLF && lfModifiedRowIndexes.length > 0) {
                                    this.stateService.dispatch(quoteActions.removeLFModifiedRows(lfModifiedRowIndexes));
                                }

                            } catch (e) {
                                console.error('Error applying N&C batch update:', e);
                            } finally {
                                this.stateService.dispatch(uiActions.setModalActive(false));
                            }
                            return true;
                        }
                    },
                    {
                        type: 'button', text: 'Cancel', className: 'secondary', colspan: 1,
                        callback: () => {
                            this.stateService.dispatch(uiActions.setModalActive(false));
                            return true;
                        }
                    }
                ]
            ],
            onOpen: () => {
                const confirmButton = document.querySelector('.dialog-overlay .primary-confirm-button');

                inputIds.forEach((id, index) => {
                    const input = document.getElementById(id);
                    if (input) {
                        const focusNext = (isBlur = false) => {
                            const nextId = inputIds[index + 1];
                            const nextInput = nextId ? document.getElementById(nextId) : null;

                            if (nextInput) {
                                nextInput.focus();
                                if (isBlur && (index + 1) % 2 !== 0) {
                                    nextInput.select();
                                }
                                if (isBlur && (index + 1) % 2 === 0) {
                                    nextInput.select();
                                }
                            } else {
                                confirmButton?.focus();
                            }
                        };

                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                focusNext(true);
                            }
                        });

                        input.addEventListener('blur', (e) => {
                            const relatedTarget = e.relatedTarget || document.activeElement;
                            const nextId = inputIds[index + 1];
                            if (relatedTarget && relatedTarget.id === nextId) {
                                return;
                            }
                            focusNext(true);
                        });
                    }
                });

                if (confirmButton) {
                    confirmButton.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            confirmButton.click();
                        }
                    });
                }

                if (inputIds.length > 0) {
                    setTimeout(() => {
                        const firstInput = document.getElementById(inputIds[0]);
                        firstInput?.focus();
                        firstInput?.select();
                    }, 50);
                }
            }
        });
    }

    _showLFDialog() {
        const { ui, quoteData } = this._getState();
        const { multiSelectSelectedIndexes } = ui;
        const { lfModifiedRowIndexes } = quoteData.uiMetadata;
        const items = this._getItems();

        if (multiSelectSelectedIndexes.length === 0) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Please select items from the main table first.' });
            this._exitAllK2Modes();
            return;
        }

        // [MODIFIED] Use FABRIC_CODES constants
        const eligibleTypes = [FABRIC_CODES.B2, FABRIC_CODES.B3, FABRIC_CODES.B4];

        const eligibleIndexes = multiSelectSelectedIndexes.filter(index => {
            const item = items[index];
            return item && item.width && item.height &&
                eligibleTypes.includes(item.fabricType) &&
                !lfModifiedRowIndexes.includes(index);
        });

        if (eligibleIndexes.length === 0) {
            const msg = 'The selection contains no eligible B2, B3, or B4 items, or they are already set as LF.';
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: msg });
            this._exitAllK2Modes();
            return;
        }

        const fNameId = 'k2-dialog-fname-lf';
        const fColorId = 'k2-dialog-fcolor-lf';
        const layout = [
            [
                { type: 'text', text: 'Type', className: 'font-bold text-right' },
                { type: 'text', text: 'F-Name', className: 'font-bold' },
                { type: 'text', text: 'F-Color', className: 'font-bold' },
            ],
            [
                // [MODIFIED] Use LOGIC_CODES.LIGHT_FILTER ('LF') for data-type
                { type: 'text', text: LOGIC_CODES.LIGHT_FILTER, className: 'text-right' },
                { type: 'input', id: fNameId, value: '', 'data-type': LOGIC_CODES.LIGHT_FILTER, 'data-field': 'fabric', inputType: 'text', disableEnterConfirm: true },
                { type: 'input', id: fColorId, value: '', 'data-type': LOGIC_CODES.LIGHT_FILTER, 'data-field': 'color', inputType: 'text', disableEnterConfirm: true },
            ]
        ];
        const inputIds = [fNameId, fColorId];

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `Batch Edit Light-Filter (${eligibleIndexes.length} selected items)`,
            closeOnOverlayClick: false,
            gridTemplateColumns: '0.8fr 1.2fr 1.2fr',
            layout: [
                ...layout,
                [
                    {
                        type: 'button',
                        text: 'Confirm',
                        className: 'primary-confirm-button',
                        colspan: 2,
                        callback: () => {
                            try {
                                const fName = document.getElementById(fNameId).value;
                                const fColor = document.getElementById(fColorId).value;

                                if (fName && fColor) {
                                    const fabricNameWithPrefix = `Light-filter ${fName}`;
                                    this.stateService.dispatch(quoteActions.batchUpdateLFProperties(eligibleIndexes, fabricNameWithPrefix, fColor));
                                    this.stateService.dispatch(quoteActions.addLFModifiedRows(eligibleIndexes));
                                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: `Light-Filter applied to ${eligibleIndexes.length} items.` });
                                } else {
                                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'No changes applied. Both F-Name and F-Color are required.', type: 'error' });
                                    return false;
                                }
                            } catch (e) {
                                console.error('Error applying LF batch update:', e);
                            } finally {
                                if (document.getElementById(fNameId).value && document.getElementById(fColorId).value) {
                                    this._exitAllK2Modes();
                                }
                            }
                            return (document.getElementById(fNameId).value && document.getElementById(fColorId).value);
                        }
                    },
                    {
                        type: 'button', text: 'Cancel', className: 'secondary', colspan: 1,
                        callback: () => {
                            this._exitAllK2Modes();
                            return true;
                        }
                    }
                ]
            ],
            onOpen: () => {
                const fNameInput = document.getElementById(fNameId);
                const fColorInput = document.getElementById(fColorId);
                const confirmButton = document.querySelector('.dialog-overlay .primary-confirm-button');

                const focusNext = (currentId, isBlur = false) => {
                    if (currentId === fNameId) {
                        fColorInput?.focus();
                        if (isBlur) fColorInput?.select();
                    } else if (currentId === fColorId) {
                        confirmButton?.focus();
                    }
                };

                inputIds.forEach((id, index) => {
                    const input = document.getElementById(id);
                    if (input) {
                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                focusNext(id, true);
                            }
                        });
                        input.addEventListener('blur', (e) => {
                            const relatedTarget = e.relatedTarget || document.activeElement;
                            const nextId = inputIds[index + 1];
                            if (relatedTarget && relatedTarget.id === nextId) {
                                return;
                            }
                            focusNext(id, true);
                        });
                    }
                });

                if (confirmButton) {
                    confirmButton.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            confirmButton.click();
                        }
                    });
                }

                if (inputIds.length > 0) {
                    setTimeout(() => {
                        fNameInput?.focus();
                        fNameInput?.select();
                    }, 50);
                }
            }
        });
    }

    _showSSetDialog() {
        const { ui, quoteData } = this._getState();
        const { multiSelectSelectedIndexes } = ui;
        const { lfModifiedRowIndexes } = quoteData.uiMetadata;
        const items = this._getItems();

        if (multiSelectSelectedIndexes.length === 0) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Please select items from the main table first.' });
            this._exitAllK2Modes();
            return;
        }

        const eligibleTypes = new Set();
        const typeData = {};

        multiSelectSelectedIndexes.forEach(index => {
            const item = items[index];
            if (item && item.width && item.height && item.fabricType) {
                eligibleTypes.add(item.fabricType);
                if (!typeData[item.fabricType]) {
                    typeData[item.fabricType] = {
                        fabric: item.fabric || '',
                        color: item.color || ''
                    };
                }
            }
        });

        const sortedTypes = Array.from(eligibleTypes).sort();

        if (sortedTypes.length === 0) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'No items with a valid Fabric Type (B1-SN) were found in your selection.' });
            this._exitAllK2Modes();
            return;
        }

        const layout = [];
        const inputIds = [];
        layout.push([
            { type: 'text', text: 'Type', className: 'font-bold text-right' },
            { type: 'text', text: 'F-Name', className: 'font-bold' },
            { type: 'text', text: 'F-Color', className: 'font-bold' },
        ]);

        sortedTypes.forEach(type => {
            const fNameId = `k2-dialog-fname-sset-${type}`;
            const fColorId = `k2-dialog-fcolor-sset-${type}`;
            layout.push([
                { type: 'text', text: type, className: 'text-right' },
                { type: 'input', id: fNameId, value: typeData[type].fabric, 'data-type': type, 'data-field': 'fabric', inputType: 'text', disableEnterConfirm: true },
                { type: 'input', id: fColorId, value: typeData[type].color, 'data-type': type, 'data-field': 'color', inputType: 'text', disableEnterConfirm: true },
            ]);
            inputIds.push(fNameId, fColorId);
        });

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `Selective Set (${multiSelectSelectedIndexes.length} selected items)`,
            closeOnOverlayClick: false,
            gridTemplateColumns: '0.8fr 1.2fr 1.2fr',
            layout: [
                ...layout,
                [
                    {
                        type: 'button',
                        text: 'Confirm',
                        className: 'primary-confirm-button',
                        colspan: 2,
                        callback: () => {
                            try {
                                const typeMap = {};
                                let typesApplied = 0;

                                sortedTypes.forEach(type => {
                                    const fName = document.getElementById(`k2-dialog-fname-sset-${type}`).value;
                                    const fColor = document.getElementById(`k2-dialog-fcolor-sset-${type}`).value;
                                    if (fName && fColor) {
                                        if (!typeMap[type]) typeMap[type] = {};
                                        typeMap[type]['fabric'] = fName;
                                        typeMap[type]['color'] = fColor;
                                        typesApplied++;
                                    }
                                });

                                if (typesApplied === 0) {
                                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'No changes applied. Please fill in both F-Name and F-Color for a type.', type: 'error' });
                                    return false;
                                }

                                this.stateService.dispatch(quoteActions.batchUpdatePropertiesForIndexes(multiSelectSelectedIndexes, typeMap));

                                const { lfModifiedRowIndexes } = this._getState().quoteData.uiMetadata;
                                const lfIndexesToClear = multiSelectSelectedIndexes.filter(index =>
                                    lfModifiedRowIndexes.includes(index)
                                );

                                if (lfIndexesToClear.length > 0) {
                                    this.stateService.dispatch(quoteActions.removeLFModifiedRows(lfIndexesToClear));
                                }

                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: `SSet applied to items.` });

                            } catch (e) {
                                console.error('Error applying SSet batch update:', e);
                            } finally {
                                this._exitAllK2Modes();
                            }
                            return true;
                        }
                    },
                    {
                        type: 'button', text: 'Cancel', className: 'secondary', colspan: 1,
                        callback: () => {
                            this._exitAllK2Modes();
                            return true;
                        }
                    }
                ]
            ],
            onOpen: () => {
                const confirmButton = document.querySelector('.dialog-overlay .primary-confirm-button');

                inputIds.forEach((id, index) => {
                    const input = document.getElementById(id);
                    if (input) {
                        const focusNext = (isBlur = false) => {
                            const nextId = inputIds[index + 1];
                            const nextInput = nextId ? document.getElementById(nextId) : null;

                            if (nextInput) {
                                nextInput.focus();
                                if (isBlur && (index + 1) % 2 !== 0) {
                                    nextInput.select();
                                }
                                if (isBlur && (index + 1) % 2 === 0) {
                                    nextInput.select();
                                }
                            } else {
                                confirmButton?.focus();
                            }
                        };

                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                focusNext(true);
                            }
                        });

                        input.addEventListener('blur', (e) => {
                            const relatedTarget = e.relatedTarget || document.activeElement;
                            const nextId = inputIds[index + 1];
                            if (relatedTarget && relatedTarget.id === nextId) {
                                return;
                            }
                            focusNext(true);
                        });
                    }
                });

                if (confirmButton) {
                    confirmButton.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            confirmButton.click();
                        }
                    });
                }

                if (inputIds.length > 0) {
                    setTimeout(() => {
                        const firstInput = document.getElementById(inputIds[0]);
                        firstInput?.focus();
                        firstInput?.select();
                    }, 50);
                }
            }
        });
    }

    _exitAllK2Modes() {
        this.stateService.dispatch(uiActions.setActiveEditMode(null));
        this.stateService.dispatch(uiActions.clearMultiSelectSelection());
        this.stateService.dispatch(uiActions.clearLFSelection());
        this.indexesToExcludeFromBatchUpdate.clear();
        this._updatePanelInputsState();
    }

    _updatePanelInputsState() {
        // (Original content removed as it depended on fabricBatchTable which is gone)
        // This method is now effectively a no-op or cleanup.
    }

    activate() {
        this.stateService.dispatch(uiActions.setVisibleColumns(['sequence', 'fabricTypeDisplay', 'fabric', 'color']));
        this._exitAllK2Modes();
    }
}